-- ============================================================
-- Schema para Sistema de Reservas de Canchas de Fútbol - Supabase (PostgreSQL)
-- Migrado desde MariaDB + Reglas de Negocio aplicadas
-- ============================================================

-- Habilitar extensión necesaria para restricción de solapamiento
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. TIPOS ENUMERADOS
-- ============================================================

CREATE TYPE estado_cancha AS ENUM ('disponible', 'mantenimiento', 'fuera_servicio');
CREATE TYPE estado_cliente AS ENUM ('activo', 'suspendido', 'bloqueado');
CREATE TYPE estado_reserva AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_show');
CREATE TYPE tipo_pago AS ENUM ('seña', 'saldo', 'completo', 'devolucion');
CREATE TYPE metodo_pago AS ENUM ('efectivo', 'tarjeta', 'transferencia');
CREATE TYPE rol_usuario AS ENUM ('cliente', 'admin');
CREATE TYPE tipo_configuracion AS ENUM ('string', 'number', 'boolean', 'json');

-- ============================================================
-- 2. TABLAS
-- ============================================================

-- -----------------------------------------------
-- Tabla de Canchas
-- -----------------------------------------------
CREATE TABLE canchas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    capacidad INT NOT NULL DEFAULT 22,
    precio_por_hora NUMERIC(10,2) NOT NULL,
    descripcion TEXT,
    estado estado_cancha NOT NULL DEFAULT 'disponible',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Regla: el precio debe ser positivo
    CONSTRAINT chk_precio_positivo CHECK (precio_por_hora > 0),
    CONSTRAINT chk_capacidad_positiva CHECK (capacidad > 0)
);

-- -----------------------------------------------
-- Tabla de Tipos de Cliente (para descuentos)
-- -----------------------------------------------
CREATE TABLE tipos_cliente (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,        -- 'regular', 'frecuente', 'vip'
    descuento_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
    min_reservas_mes INT NOT NULL DEFAULT 0,
    descripcion TEXT,

    CONSTRAINT chk_descuento_rango CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100)
);

-- -----------------------------------------------
-- Tabla de Clientes
-- -----------------------------------------------
CREATE TABLE clientes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    tipo_cliente_id BIGINT DEFAULT 1 REFERENCES tipos_cliente(id) ON DELETE SET NULL ON UPDATE CASCADE,
    total_reservas INT NOT NULL DEFAULT 0,
    no_shows INT NOT NULL DEFAULT 0,  -- contador de veces que no se presentó
    ultima_reserva DATE,
    estado estado_cliente NOT NULL DEFAULT 'activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_no_shows_positivo CHECK (no_shows >= 0),
    CONSTRAINT chk_total_reservas_positivo CHECK (total_reservas >= 0)
);

CREATE INDEX idx_clientes_telefono ON clientes(telefono);
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_clientes_auth_user ON clientes(auth_user_id);

-- -----------------------------------------------
-- Tabla de Perfiles de Usuario (vinculada a Supabase Auth)
-- -----------------------------------------------
CREATE TABLE perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rol rol_usuario NOT NULL DEFAULT 'cliente',
    cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    ultimo_acceso TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- Tabla principal de Reservas
-- -----------------------------------------------
CREATE TABLE reservas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cancha_id BIGINT NOT NULL REFERENCES canchas(id) ON DELETE CASCADE ON UPDATE CASCADE,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    precio_total NUMERIC(10,2) NOT NULL,
    descuento_aplicado NUMERIC(5,2) NOT NULL DEFAULT 0,
    sena_requerida NUMERIC(10,2) NOT NULL DEFAULT 0,
    sena_pagada NUMERIC(10,2) NOT NULL DEFAULT 0,
    pago_completo BOOLEAN NOT NULL DEFAULT FALSE,
    estado estado_reserva NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_cancelacion TIMESTAMPTZ,
    razon_cancelacion TEXT,

    -- =============================================
    -- REGLA DE NEGOCIO: Validación de duración
    -- Mínimo 1 hora, máximo 3 horas
    -- =============================================
    CONSTRAINT chk_duracion_reserva CHECK (
        hora_fin > hora_inicio
        AND (hora_fin - hora_inicio) >= INTERVAL '1 hour'
        AND (hora_fin - hora_inicio) <= INTERVAL '3 hours'
    ),

    -- =============================================
    -- REGLA DE NEGOCIO: Horario operativo
    -- Solo entre 08:00 y 23:00
    -- =============================================
    CONSTRAINT chk_horario_operativo CHECK (
        hora_inicio >= '08:00'::TIME
        AND hora_fin <= '23:00'::TIME
    ),

    -- Precio debe ser positivo
    CONSTRAINT chk_precio_total_positivo CHECK (precio_total >= 0),
    CONSTRAINT chk_descuento_rango CHECK (descuento_aplicado >= 0 AND descuento_aplicado <= 100),
    CONSTRAINT chk_sena_positiva CHECK (sena_requerida >= 0 AND sena_pagada >= 0)
);

-- =============================================
-- REGLA DE NEGOCIO: Restricción de solapamiento
-- No permite reservar una cancha en un horario ya ocupado.
-- Solo aplica a reservas activas (pendiente, confirmada).
-- Usa btree_gist para exclusión por rango temporal.
-- =============================================

-- Función auxiliar para castear el enum a texto (necesario para EXCLUDE con gist)
CREATE OR REPLACE FUNCTION reserva_esta_activa(est estado_reserva)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN est IN ('pendiente', 'confirmada');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE reservas
    ADD CONSTRAINT excl_solapamiento_horario
    EXCLUDE USING gist (
        cancha_id WITH =,
        fecha WITH =,
        tsrange(
            ('2000-01-01'::DATE + hora_inicio)::TIMESTAMP,
            ('2000-01-01'::DATE + hora_fin)::TIMESTAMP
        ) WITH &&
    )
    WHERE (reserva_esta_activa(estado));

CREATE INDEX idx_reservas_fecha ON reservas(fecha);
CREATE INDEX idx_reservas_cancha_fecha ON reservas(cancha_id, fecha);
CREATE INDEX idx_reservas_cliente ON reservas(cliente_id);
CREATE INDEX idx_reservas_estado ON reservas(estado);

-- -----------------------------------------------
-- Tabla de Pagos
-- -----------------------------------------------
CREATE TABLE pagos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reserva_id BIGINT NOT NULL REFERENCES reservas(id) ON DELETE CASCADE ON UPDATE CASCADE,
    monto NUMERIC(10,2) NOT NULL,
    tipo_pago tipo_pago NOT NULL,
    metodo_pago metodo_pago NOT NULL,
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones TEXT,

    CONSTRAINT chk_monto_positivo CHECK (monto > 0)
);

CREATE INDEX idx_pagos_reserva ON pagos(reserva_id);

-- -----------------------------------------------
-- Tabla de Configuraciones del Sistema
-- -----------------------------------------------
CREATE TABLE configuraciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    tipo tipo_configuracion NOT NULL DEFAULT 'string',
    descripcion TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- Tabla de Bloqueos de Horarios
-- -----------------------------------------------
CREATE TABLE bloqueos_horarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cancha_id BIGINT NOT NULL REFERENCES canchas(id) ON DELETE CASCADE ON UPDATE CASCADE,
    fecha_inicio DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    fecha_fin DATE NOT NULL,
    hora_fin TIME NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_bloqueo_fechas CHECK (
        fecha_fin >= fecha_inicio
    )
);

CREATE INDEX idx_bloqueos_cancha ON bloqueos_horarios(cancha_id);


-- ============================================================
-- 3. FUNCIONES Y TRIGGERS
-- ============================================================

-- -----------------------------------------------
-- Trigger: Actualizar updated_at en canchas
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_canchas_updated_at
    BEFORE UPDATE ON canchas
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_updated_at();

CREATE TRIGGER trg_configuraciones_updated_at
    BEFORE UPDATE ON configuraciones
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_updated_at();

-- -----------------------------------------------
-- Trigger: Crear perfil y cliente al registrarse en Supabase Auth
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION fn_crear_perfil_nuevo_usuario()
RETURNS TRIGGER AS $$
DECLARE
    v_nombre TEXT;
    v_apellido TEXT;
    v_telefono TEXT;
    v_cliente_id BIGINT;
BEGIN
    -- Extraer datos del metadata de Supabase Auth
    v_nombre   := COALESCE(NEW.raw_user_meta_data->>'nombre', 'Sin nombre');
    v_apellido := COALESCE(NEW.raw_user_meta_data->>'apellido', 'Sin apellido');
    v_telefono := COALESCE(NEW.raw_user_meta_data->>'telefono', '');

    -- Crear registro de cliente
    INSERT INTO public.clientes (auth_user_id, nombre, apellido, telefono, email)
    VALUES (NEW.id, v_nombre, v_apellido, v_telefono, NEW.email)
    RETURNING id INTO v_cliente_id;

    -- Crear perfil vinculado
    INSERT INTO public.perfiles (id, nombre, apellido, rol, cliente_id)
    VALUES (NEW.id, v_nombre, v_apellido, 'cliente', v_cliente_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_nuevo_usuario_auth
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION fn_crear_perfil_nuevo_usuario();

-- -----------------------------------------------
-- Trigger: Calcular precio con descuento al crear reserva
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_precio_reserva()
RETURNS TRIGGER AS $$
DECLARE
    v_precio_hora NUMERIC(10,2);
    v_descuento NUMERIC(5,2);
    v_horas NUMERIC;
    v_sena_porcentaje NUMERIC;
BEGIN
    -- Obtener precio por hora de la cancha
    SELECT precio_por_hora INTO v_precio_hora
    FROM canchas WHERE id = NEW.cancha_id;

    -- Obtener descuento del tipo de cliente
    SELECT COALESCE(tc.descuento_porcentaje, 0) INTO v_descuento
    FROM clientes c
    LEFT JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id
    WHERE c.id = NEW.cliente_id;

    -- Calcular horas de duración
    v_horas := EXTRACT(EPOCH FROM (NEW.hora_fin - NEW.hora_inicio)) / 3600.0;

    -- Calcular precio total con descuento
    NEW.precio_total := ROUND(v_precio_hora * v_horas * (1 - v_descuento / 100), 2);
    NEW.descuento_aplicado := v_descuento;

    -- Calcular seña requerida (30% por defecto)
    SELECT COALESCE(valor::NUMERIC, 30) INTO v_sena_porcentaje
    FROM configuraciones WHERE clave = 'sena_porcentaje';

    NEW.sena_requerida := ROUND(NEW.precio_total * v_sena_porcentaje / 100, 2);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calcular_precio
    BEFORE INSERT ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION fn_calcular_precio_reserva();

-- -----------------------------------------------
-- REGLA DE NEGOCIO: Bloquear clientes con 3+ no-shows
-- Trigger que verifica antes de crear una reserva
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION fn_verificar_cliente_habilitado()
RETURNS TRIGGER AS $$
DECLARE
    v_estado estado_cliente;
    v_no_shows INT;
BEGIN
    SELECT estado, no_shows INTO v_estado, v_no_shows
    FROM clientes WHERE id = NEW.cliente_id;

    -- Cliente bloqueado o suspendido no puede reservar
    IF v_estado IN ('bloqueado', 'suspendido') THEN
        RAISE EXCEPTION 'El cliente está % y no puede realizar reservas. Contacte al administrador.', v_estado;
    END IF;

    -- 3 o más no-shows en el último mes = bloqueo automático
    IF v_no_shows >= 3 THEN
        UPDATE clientes SET estado = 'bloqueado' WHERE id = NEW.cliente_id;
        RAISE EXCEPTION 'El cliente ha sido bloqueado por tener 3 o más inasistencias (no-shows). Contacte al administrador.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verificar_cliente
    BEFORE INSERT ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION fn_verificar_cliente_habilitado();

-- -----------------------------------------------
-- Trigger: Actualizar contadores del cliente al cambiar estado de reserva
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_stats_cliente()
RETURNS TRIGGER AS $$
BEGIN
    -- Al completar una reserva
    IF NEW.estado = 'completada' AND OLD.estado != 'completada' THEN
        UPDATE clientes
        SET total_reservas = total_reservas + 1,
            ultima_reserva = NEW.fecha
        WHERE id = NEW.cliente_id;
    END IF;

    -- Al marcar como no-show
    IF NEW.estado = 'no_show' AND OLD.estado != 'no_show' THEN
        UPDATE clientes
        SET no_shows = no_shows + 1
        WHERE id = NEW.cliente_id;

        -- Auto-bloqueo si acumula 3+ no-shows
        UPDATE clientes
        SET estado = 'bloqueado'
        WHERE id = NEW.cliente_id AND no_shows >= 3;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stats_cliente
    AFTER UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_stats_cliente();

-- -----------------------------------------------
-- Función: Cancelar reservas pendientes sin seña después de 1 hora
-- (Llamar desde un Edge Function/cron del backend)
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION fn_cancelar_reservas_sin_sena()
RETURNS INT AS $$
DECLARE
    v_canceladas INT;
BEGIN
    UPDATE reservas
    SET estado = 'cancelada',
        fecha_cancelacion = now(),
        razon_cancelacion = 'Cancelación automática: seña no pagada dentro del plazo de 1 hora'
    WHERE estado = 'pendiente'
      AND sena_pagada = 0
      AND fecha_creacion < (now() - INTERVAL '1 hour');

    GET DIAGNOSTICS v_canceladas = ROW_COUNT;
    RETURN v_canceladas;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------
-- Función: Sugerir horarios alternativos cuando uno está ocupado
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION fn_sugerir_horarios_libres(
    p_cancha_id BIGINT,
    p_fecha DATE,
    p_duracion_horas INT DEFAULT 1
)
RETURNS TABLE (
    hora_inicio_sugerida TIME,
    hora_fin_sugerida TIME
) AS $$
DECLARE
    v_hora TIME := '08:00'::TIME;
    v_hora_cierre TIME := '23:00'::TIME;
    v_hora_fin_bloque TIME;
    v_conflictos INT;
BEGIN
    -- Recorrer cada bloque de hora dentro del horario operativo
    WHILE v_hora + (p_duracion_horas || ' hours')::INTERVAL <= v_hora_cierre LOOP
        v_hora_fin_bloque := v_hora + (p_duracion_horas || ' hours')::INTERVAL;

        -- Verificar si hay conflictos
        SELECT COUNT(*) INTO v_conflictos
        FROM reservas r
        WHERE r.cancha_id = p_cancha_id
          AND r.fecha = p_fecha
          AND r.estado IN ('pendiente', 'confirmada')
          AND NOT (r.hora_fin <= v_hora OR r.hora_inicio >= v_hora_fin_bloque);

        -- Si no hay conflictos, sugerir este bloque
        IF v_conflictos = 0 THEN
            hora_inicio_sugerida := v_hora;
            hora_fin_sugerida := v_hora_fin_bloque;
            RETURN NEXT;
        END IF;

        v_hora := v_hora + INTERVAL '1 hour';
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 4. VISTAS
-- ============================================================

-- Vista de disponibilidad
CREATE OR REPLACE VIEW vista_disponibilidad AS
SELECT
    c.id AS cancha_id,
    c.nombre AS cancha_nombre,
    c.precio_por_hora,
    r.fecha,
    r.hora_inicio,
    r.hora_fin,
    CASE WHEN r.id IS NOT NULL THEN 'ocupado' ELSE 'libre' END AS estado
FROM canchas c
LEFT JOIN reservas r ON c.id = r.cancha_id
    AND r.estado IN ('pendiente', 'confirmada')
WHERE c.estado = 'disponible';

-- Vista resumen de clientes
CREATE OR REPLACE VIEW vista_clientes_resumen AS
SELECT
    c.id,
    c.nombre,
    c.apellido,
    c.telefono,
    c.email,
    tc.nombre AS tipo_cliente,
    tc.descuento_porcentaje,
    c.total_reservas,
    c.no_shows,
    CASE
        WHEN c.no_shows >= 3 THEN 'riesgo'
        WHEN c.total_reservas >= tc.min_reservas_mes THEN 'buen_cliente'
        ELSE 'regular'
    END AS categoria
FROM clientes c
JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id;


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Función auxiliar para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION fn_obtener_rol_usuario()
RETURNS rol_usuario AS $$
BEGIN
    RETURN (
        SELECT rol FROM perfiles WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Función auxiliar para obtener el cliente_id del usuario actual
CREATE OR REPLACE FUNCTION fn_obtener_cliente_id()
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT cliente_id FROM perfiles WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----- CANCHAS -----
ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Canchas: lectura pública"
    ON canchas FOR SELECT
    USING (true);

CREATE POLICY "Canchas: solo admins modifican"
    ON canchas FOR ALL
    USING (fn_obtener_rol_usuario() = 'admin');

-- ----- CLIENTES -----
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes: ver propio perfil"
    ON clientes FOR SELECT
    USING (auth_user_id = auth.uid() OR fn_obtener_rol_usuario() = 'admin');

CREATE POLICY "Clientes: editar propio perfil"
    ON clientes FOR UPDATE
    USING (auth_user_id = auth.uid() OR fn_obtener_rol_usuario() = 'admin');

CREATE POLICY "Clientes: admins gestionan todo"
    ON clientes FOR ALL
    USING (fn_obtener_rol_usuario() = 'admin');

-- ----- PERFILES -----
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfiles: ver propio"
    ON perfiles FOR SELECT
    USING (id = auth.uid() OR fn_obtener_rol_usuario() = 'admin');

CREATE POLICY "Perfiles: editar propio"
    ON perfiles FOR UPDATE
    USING (id = auth.uid());

-- ----- RESERVAS -----
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reservas: ver propias"
    ON reservas FOR SELECT
    USING (cliente_id = fn_obtener_cliente_id() OR fn_obtener_rol_usuario() = 'admin');

CREATE POLICY "Reservas: crear propias"
    ON reservas FOR INSERT
    WITH CHECK (cliente_id = fn_obtener_cliente_id() OR fn_obtener_rol_usuario() = 'admin');

CREATE POLICY "Reservas: actualizar propias (limitado)"
    ON reservas FOR UPDATE
    USING (cliente_id = fn_obtener_cliente_id() OR fn_obtener_rol_usuario() = 'admin');

CREATE POLICY "Reservas: admins eliminan"
    ON reservas FOR DELETE
    USING (fn_obtener_rol_usuario() = 'admin');

-- ----- PAGOS -----
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pagos: ver propios"
    ON pagos FOR SELECT
    USING (
        reserva_id IN (SELECT id FROM reservas WHERE cliente_id = fn_obtener_cliente_id())
        OR fn_obtener_rol_usuario() = 'admin'
    );

CREATE POLICY "Pagos: admins gestionan"
    ON pagos FOR ALL
    USING (fn_obtener_rol_usuario() = 'admin');

-- ----- CONFIGURACIONES -----
ALTER TABLE configuraciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configuraciones: lectura pública"
    ON configuraciones FOR SELECT
    USING (true);

CREATE POLICY "Configuraciones: solo admins modifican"
    ON configuraciones FOR ALL
    USING (fn_obtener_rol_usuario() = 'admin');

-- ----- BLOQUEOS HORARIOS -----
ALTER TABLE bloqueos_horarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bloqueos: lectura pública"
    ON bloqueos_horarios FOR SELECT
    USING (true);

CREATE POLICY "Bloqueos: solo admins modifican"
    ON bloqueos_horarios FOR ALL
    USING (fn_obtener_rol_usuario() = 'admin');


-- ============================================================
-- 6. DATOS INICIALES (SEED)
-- ============================================================

INSERT INTO tipos_cliente (nombre, descuento_porcentaje, min_reservas_mes, descripcion) VALUES
    ('regular', 0, 0, 'Cliente regular sin descuentos'),
    ('frecuente', 10, 4, 'Cliente frecuente - 4+ reservas al mes'),
    ('vip', 20, 8, 'Cliente VIP - 8+ reservas al mes');

INSERT INTO canchas (nombre, capacidad, precio_por_hora, descripcion) VALUES
    ('Cancha 1 - Fútbol 11', 22, 25000.00, 'Cancha principal con césped sintético'),
    ('Cancha 2 - Fútbol 7', 14, 20000.00, 'Cancha secundaria, ideal para fútbol 7'),
    ('Cancha 3 - Fútbol 5', 10, 15000.00, 'Cancha pequeña para fútbol 5');

INSERT INTO configuraciones (clave, valor, tipo, descripcion) VALUES
    ('sena_porcentaje', '30', 'number', 'Porcentaje de seña requerida (30%)'),
    ('horas_anticipacion_min', '2', 'number', 'Horas mínimas de anticipación para reservar'),
    ('duracion_maxima_horas', '3', 'number', 'Duración máxima de una reserva en horas'),
    ('penalizacion_no_show', '50', 'number', 'Porcentaje de penalización por no presentarse'),
    ('horario_apertura', '08:00', 'string', 'Hora de apertura del polideportivo'),
    ('horario_cierre', '23:00', 'string', 'Hora de cierre del polideportivo'),
    ('reservas_max_cliente_dia', '2', 'number', 'Máximo de reservas por cliente por día'),
    ('tiempo_limite_sena_minutos', '60', 'number', 'Minutos para pagar seña antes de cancelación automática'),
    ('max_no_shows_bloqueo', '3', 'number', 'Cantidad de no-shows para bloquear al cliente');
