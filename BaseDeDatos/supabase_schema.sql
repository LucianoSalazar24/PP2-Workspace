-- ============================================
-- SCHEMA PARA SISTEMA DE RESERVAS DE CANCHAS DE FÚTBOL
-- Base de datos: PostgreSQL (Supabase)
-- Version: 1.0
-- Fecha: 2025-11-22
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- ENUMS (Tipos Personalizados)
-- ============================================

-- Estados de canchas
CREATE TYPE estado_cancha AS ENUM (
    'disponible',
    'reservada',
    'mantenimiento',
    'fuera_servicio'
);

-- Estados de clientes
CREATE TYPE estado_cliente AS ENUM (
    'activo',
    'suspendido',
    'bloqueado'
);

-- Estados de reservas
CREATE TYPE tipo_estado_reserva AS ENUM (
    'pendiente',
    'confirmada',
    'cancelada',
    'completada',
    'no_show'
);

-- Tipos de pago
CREATE TYPE tipo_pago AS ENUM (
    'seña',
    'saldo',
    'completo',
    'devolucion'
);

-- Métodos de pago
CREATE TYPE metodo_pago AS ENUM (
    'efectivo',
    'tarjeta',
    'transferencia'
);

-- Roles de usuario
CREATE TYPE rol_usuario AS ENUM (
    'cliente',
    'admin'
);

-- Estados de usuario
CREATE TYPE estado_usuario AS ENUM (
    'activo',
    'inactivo'
);

-- Tipos de configuración
CREATE TYPE tipo_config AS ENUM (
    'string',
    'number',
    'boolean',
    'json'
);

-- ============================================
-- TABLA: tipos_cliente
-- Descripción: Define categorías de clientes con descuentos automáticos
-- ============================================

CREATE TABLE tipos_cliente (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descuento_porcentaje NUMERIC(5,2) DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    min_reservas_mes INTEGER DEFAULT 0 CHECK (min_reservas_mes >= 0),
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para tipos_cliente
CREATE INDEX idx_tipos_cliente_nombre ON tipos_cliente(nombre);

-- Comentarios de la tabla
COMMENT ON TABLE tipos_cliente IS 'Categorías de clientes con descuentos automáticos';
COMMENT ON COLUMN tipos_cliente.descuento_porcentaje IS 'Porcentaje de descuento aplicado (0-100)';
COMMENT ON COLUMN tipos_cliente.min_reservas_mes IS 'Mínimo de reservas mensuales requeridas para este tipo';

-- ============================================
-- TABLA: canchas
-- Descripción: Almacena información de las canchas de fútbol disponibles
-- ============================================

CREATE TABLE canchas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    capacidad INTEGER NOT NULL DEFAULT 22 CHECK (capacidad > 0 AND capacidad <= 50),
    precio_por_hora NUMERIC(10,2) NOT NULL CHECK (precio_por_hora > 0),
    descripcion TEXT,
    estado estado_cancha DEFAULT 'disponible',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para canchas
CREATE INDEX idx_canchas_estado ON canchas(estado);
CREATE INDEX idx_canchas_nombre ON canchas(nombre);

-- Comentarios de la tabla
COMMENT ON TABLE canchas IS 'Canchas de fútbol disponibles en el polideportivo';
COMMENT ON COLUMN canchas.capacidad IS 'Número máximo de jugadores permitidos';
COMMENT ON COLUMN canchas.precio_por_hora IS 'Precio base por hora de alquiler';

-- ============================================
-- TABLA: clientes
-- Descripción: Información de usuarios/clientes del sistema
-- ============================================

CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    tipo_cliente_id INTEGER DEFAULT 1,
    total_reservas INTEGER DEFAULT 0 CHECK (total_reservas >= 0),
    no_shows INTEGER DEFAULT 0 CHECK (no_shows >= 0),
    ultima_reserva DATE,
    estado estado_cliente DEFAULT 'activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_tipo_cliente FOREIGN KEY (tipo_cliente_id)
        REFERENCES tipos_cliente(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- Índices para clientes
CREATE INDEX idx_clientes_telefono ON clientes(telefono);
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_clientes_tipo ON clientes(tipo_cliente_id);
CREATE INDEX idx_clientes_estado ON clientes(estado);
CREATE INDEX idx_clientes_nombre_apellido ON clientes(nombre, apellido);

-- Comentarios de la tabla
COMMENT ON TABLE clientes IS 'Información de clientes del sistema de reservas';
COMMENT ON COLUMN clientes.no_shows IS 'Contador de veces que el cliente no se presentó';
COMMENT ON COLUMN clientes.total_reservas IS 'Total acumulado de reservas realizadas';

-- ============================================
-- TABLA: estados_reserva
-- Descripción: Catálogo de estados posibles de una reserva
-- ============================================

CREATE TABLE estados_reserva (
    id SERIAL PRIMARY KEY,
    nombre tipo_estado_reserva NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comentarios de la tabla
COMMENT ON TABLE estados_reserva IS 'Catálogo de estados de reservas';

-- ============================================
-- TABLA: reservas
-- Descripción: Registra todas las reservas del sistema
-- ============================================

CREATE TABLE reservas (
    id SERIAL PRIMARY KEY,
    cancha_id INTEGER NOT NULL,
    cliente_id INTEGER NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    precio_total NUMERIC(10,2) NOT NULL CHECK (precio_total >= 0),
    descuento_aplicado NUMERIC(5,2) DEFAULT 0 CHECK (descuento_aplicado >= 0 AND descuento_aplicado <= 100),
    sena_requerida NUMERIC(10,2) DEFAULT 0 CHECK (sena_requerida >= 0),
    sena_pagada NUMERIC(10,2) DEFAULT 0 CHECK (sena_pagada >= 0),
    pago_completo BOOLEAN DEFAULT FALSE,
    estado_id INTEGER DEFAULT 1,
    observaciones TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cancelacion TIMESTAMP WITH TIME ZONE,
    razon_cancelacion TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_cancha FOREIGN KEY (cancha_id)
        REFERENCES canchas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_cliente FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_estado FOREIGN KEY (estado_id)
        REFERENCES estados_reserva(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    -- Constraints adicionales
    CONSTRAINT chk_hora_valida CHECK (hora_fin > hora_inicio),
    CONSTRAINT chk_fecha_futura CHECK (fecha >= CURRENT_DATE OR (fecha = CURRENT_DATE AND hora_inicio > CURRENT_TIME)),
    CONSTRAINT chk_sena_valida CHECK (sena_pagada <= precio_total),

    -- Evitar reservas superpuestas
    CONSTRAINT unique_cancha_fecha_hora UNIQUE (cancha_id, fecha, hora_inicio)
);

-- Índices para reservas
CREATE INDEX idx_reservas_fecha ON reservas(fecha);
CREATE INDEX idx_reservas_cancha_fecha ON reservas(cancha_id, fecha);
CREATE INDEX idx_reservas_cliente ON reservas(cliente_id);
CREATE INDEX idx_reservas_estado ON reservas(estado_id);
CREATE INDEX idx_reservas_fecha_hora ON reservas(fecha, hora_inicio);
CREATE INDEX idx_reservas_pago_completo ON reservas(pago_completo);
CREATE INDEX idx_reservas_fecha_creacion ON reservas(fecha_creacion);

-- Comentarios de la tabla
COMMENT ON TABLE reservas IS 'Registro de todas las reservas del sistema';
COMMENT ON COLUMN reservas.descuento_aplicado IS 'Porcentaje de descuento aplicado a esta reserva';
COMMENT ON COLUMN reservas.sena_requerida IS 'Monto de seña requerida (por defecto 30% del total)';
COMMENT ON COLUMN reservas.sena_pagada IS 'Monto de seña efectivamente pagada';

-- ============================================
-- TABLA: pagos
-- Descripción: Historial detallado de pagos asociados a reservas
-- ============================================

CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    reserva_id INTEGER NOT NULL,
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    tipo tipo_pago NOT NULL,
    metodo metodo_pago NOT NULL,
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_reserva FOREIGN KEY (reserva_id)
        REFERENCES reservas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Índices para pagos
CREATE INDEX idx_pagos_reserva ON pagos(reserva_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);
CREATE INDEX idx_pagos_tipo ON pagos(tipo);
CREATE INDEX idx_pagos_metodo ON pagos(metodo);

-- Comentarios de la tabla
COMMENT ON TABLE pagos IS 'Historial de todos los pagos realizados';

-- ============================================
-- TABLA: configuraciones
-- Descripción: Configuraciones dinámicas del sistema
-- ============================================

CREATE TABLE configuraciones (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    tipo tipo_config DEFAULT 'string',
    descripcion TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para configuraciones
CREATE INDEX idx_configuraciones_clave ON configuraciones(clave);

-- Comentarios de la tabla
COMMENT ON TABLE configuraciones IS 'Configuraciones dinámicas del sistema';

-- ============================================
-- TABLA: bloqueos_horarios
-- Descripción: Bloquea horarios para mantenimiento o eventos especiales
-- ============================================

CREATE TABLE bloqueos_horarios (
    id SERIAL PRIMARY KEY,
    cancha_id INTEGER NOT NULL,
    fecha_inicio DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    fecha_fin DATE NOT NULL,
    hora_fin TIME NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_cancha_bloqueo FOREIGN KEY (cancha_id)
        REFERENCES canchas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Constraints adicionales
    CONSTRAINT chk_fecha_bloqueo_valida CHECK (fecha_fin >= fecha_inicio)
);

-- Índices para bloqueos_horarios
CREATE INDEX idx_bloqueos_cancha ON bloqueos_horarios(cancha_id);
CREATE INDEX idx_bloqueos_fechas ON bloqueos_horarios(fecha_inicio, fecha_fin);

-- Comentarios de la tabla
COMMENT ON TABLE bloqueos_horarios IS 'Bloqueos de horarios para mantenimiento o eventos';

-- ============================================
-- TABLA: usuarios
-- Descripción: Usuarios del sistema con autenticación
-- ============================================

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rol rol_usuario DEFAULT 'cliente',
    cliente_id INTEGER,
    estado estado_usuario DEFAULT 'activo',
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_cliente_usuario FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
        ON DELETE SET NULL
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_estado ON usuarios(estado);
CREATE INDEX idx_usuarios_cliente ON usuarios(cliente_id);

-- Comentarios de la tabla
COMMENT ON TABLE usuarios IS 'Usuarios del sistema con autenticación';

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a todas las tablas con updated_at
CREATE TRIGGER set_timestamp_tipos_cliente
    BEFORE UPDATE ON tipos_cliente
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_canchas
    BEFORE UPDATE ON canchas
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_clientes
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_reservas
    BEFORE UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_configuraciones
    BEFORE UPDATE ON configuraciones
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_bloqueos
    BEFORE UPDATE ON bloqueos_horarios
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_usuarios
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================
-- FUNCIONES Y TRIGGERS DE NEGOCIO
-- ============================================

-- Función: Actualizar contador de reservas del cliente
CREATE OR REPLACE FUNCTION actualizar_total_reservas_cliente()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE clientes
        SET total_reservas = total_reservas + 1,
            ultima_reserva = NEW.fecha
        WHERE id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_reservas
    AFTER INSERT ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_total_reservas_cliente();

-- Función: Incrementar contador de no-shows
CREATE OR REPLACE FUNCTION incrementar_no_shows()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado_id = (SELECT id FROM estados_reserva WHERE nombre = 'no_show')
       AND OLD.estado_id != NEW.estado_id THEN
        UPDATE clientes
        SET no_shows = no_shows + 1
        WHERE id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_incrementar_no_shows
    AFTER UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION incrementar_no_shows();

-- Función: Cambiar estado de cancha cuando se reserva
CREATE OR REPLACE FUNCTION actualizar_estado_cancha()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.estado_id IN (SELECT id FROM estados_reserva WHERE nombre IN ('pendiente', 'confirmada')) THEN
            UPDATE canchas
            SET estado = 'reservada'
            WHERE id = NEW.cancha_id
            AND estado = 'disponible';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.estado_id IN (SELECT id FROM estados_reserva WHERE nombre IN ('cancelada', 'completada')) THEN
            -- Verificar si hay otras reservas activas
            IF NOT EXISTS (
                SELECT 1 FROM reservas
                WHERE cancha_id = NEW.cancha_id
                AND id != NEW.id
                AND estado_id IN (SELECT id FROM estados_reserva WHERE nombre IN ('pendiente', 'confirmada'))
                AND fecha >= CURRENT_DATE
            ) THEN
                UPDATE canchas
                SET estado = 'disponible'
                WHERE id = NEW.cancha_id
                AND estado = 'reservada';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_estado_cancha
    AFTER INSERT OR UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_estado_cancha();

-- Función: Validar disponibilidad antes de insertar reserva
CREATE OR REPLACE FUNCTION validar_disponibilidad_reserva()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar solapamiento de horarios
    IF EXISTS (
        SELECT 1 FROM reservas
        WHERE cancha_id = NEW.cancha_id
        AND fecha = NEW.fecha
        AND estado_id IN (SELECT id FROM estados_reserva WHERE nombre IN ('pendiente', 'confirmada'))
        AND (
            (NEW.hora_inicio >= hora_inicio AND NEW.hora_inicio < hora_fin) OR
            (NEW.hora_fin > hora_inicio AND NEW.hora_fin <= hora_fin) OR
            (NEW.hora_inicio <= hora_inicio AND NEW.hora_fin >= hora_fin)
        )
    ) THEN
        RAISE EXCEPTION 'Ya existe una reserva en ese horario';
    END IF;

    -- Verificar bloqueos de horarios
    IF EXISTS (
        SELECT 1 FROM bloqueos_horarios
        WHERE cancha_id = NEW.cancha_id
        AND NEW.fecha BETWEEN fecha_inicio AND fecha_fin
        AND (
            (NEW.hora_inicio >= hora_inicio AND NEW.hora_inicio < hora_fin) OR
            (NEW.hora_fin > hora_inicio AND NEW.hora_fin <= hora_fin)
        )
    ) THEN
        RAISE EXCEPTION 'El horario está bloqueado para mantenimiento o evento especial';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_disponibilidad
    BEFORE INSERT OR UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION validar_disponibilidad_reserva();

-- ============================================
-- VISTAS
-- ============================================

-- Vista: Disponibilidad de canchas
CREATE OR REPLACE VIEW vista_disponibilidad AS
SELECT
    c.id as cancha_id,
    c.nombre as cancha_nombre,
    c.precio_por_hora,
    c.estado as estado_cancha,
    r.fecha,
    r.hora_inicio,
    r.hora_fin,
    r.id as reserva_id,
    CASE
        WHEN r.id IS NOT NULL THEN 'ocupado'::TEXT
        ELSE 'libre'::TEXT
    END as estado_horario
FROM canchas c
LEFT JOIN reservas r ON c.id = r.cancha_id
    AND r.estado_id IN (
        SELECT id FROM estados_reserva
        WHERE nombre IN ('pendiente', 'confirmada')
    )
WHERE c.estado IN ('disponible', 'reservada')
ORDER BY c.id, r.fecha, r.hora_inicio;

COMMENT ON VIEW vista_disponibilidad IS 'Vista de disponibilidad de canchas con reservas activas';

-- Vista: Resumen de clientes
CREATE OR REPLACE VIEW vista_clientes_resumen AS
SELECT
    c.id,
    c.nombre,
    c.apellido,
    c.telefono,
    c.email,
    c.estado,
    tc.nombre as tipo_cliente,
    tc.descuento_porcentaje,
    c.total_reservas,
    c.no_shows,
    c.ultima_reserva,
    CASE
        WHEN c.no_shows >= 3 THEN 'riesgo'::TEXT
        WHEN c.total_reservas >= tc.min_reservas_mes THEN 'buen_cliente'::TEXT
        ELSE 'regular'::TEXT
    END as categoria,
    CASE
        WHEN c.estado = 'bloqueado' THEN true
        WHEN c.no_shows >= 3 THEN true
        ELSE false
    END as requiere_atencion
FROM clientes c
JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id
ORDER BY c.id;

COMMENT ON VIEW vista_clientes_resumen IS 'Resumen de clientes con categorización y alertas';

-- Vista: Estadísticas de canchas
CREATE OR REPLACE VIEW vista_estadisticas_canchas AS
SELECT
    c.id,
    c.nombre,
    c.precio_por_hora,
    c.estado,
    COUNT(r.id) as total_reservas,
    COUNT(CASE WHEN r.estado_id IN (
        SELECT id FROM estados_reserva WHERE nombre = 'completada'
    ) THEN 1 END) as reservas_completadas,
    COUNT(CASE WHEN r.estado_id IN (
        SELECT id FROM estados_reserva WHERE nombre = 'cancelada'
    ) THEN 1 END) as reservas_canceladas,
    COALESCE(SUM(CASE
        WHEN r.pago_completo = true
        THEN r.precio_total
        ELSE 0
    END), 0) as ingresos_totales,
    COALESCE(AVG(r.precio_total), 0) as precio_promedio_reserva
FROM canchas c
LEFT JOIN reservas r ON c.id = r.cancha_id
GROUP BY c.id, c.nombre, c.precio_por_hora, c.estado
ORDER BY c.id;

COMMENT ON VIEW vista_estadisticas_canchas IS 'Estadísticas de uso e ingresos por cancha';

-- Vista: Reservas próximas (siguientes 7 días)
CREATE OR REPLACE VIEW vista_reservas_proximas AS
SELECT
    r.id,
    r.fecha,
    r.hora_inicio,
    r.hora_fin,
    c.nombre as cancha,
    cl.nombre || ' ' || cl.apellido as cliente,
    cl.telefono,
    r.precio_total,
    r.sena_pagada,
    r.pago_completo,
    er.nombre as estado
FROM reservas r
JOIN canchas c ON r.cancha_id = c.id
JOIN clientes cl ON r.cliente_id = cl.id
JOIN estados_reserva er ON r.estado_id = er.id
WHERE r.fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    AND er.nombre IN ('pendiente', 'confirmada')
ORDER BY r.fecha, r.hora_inicio;

COMMENT ON VIEW vista_reservas_proximas IS 'Reservas confirmadas para los próximos 7 días';

-- ============================================
-- FUNCIONES AUXILIARES
-- ============================================

-- Función: Obtener horarios disponibles para una fecha y cancha
CREATE OR REPLACE FUNCTION obtener_horarios_disponibles(
    p_cancha_id INTEGER,
    p_fecha DATE,
    p_duracion_horas INTEGER DEFAULT 1
)
RETURNS TABLE (
    hora_inicio TIME,
    hora_fin TIME,
    disponible BOOLEAN
) AS $$
DECLARE
    v_hora_apertura TIME;
    v_hora_cierre TIME;
    v_hora_actual TIME;
BEGIN
    -- Obtener horarios de configuración
    SELECT valor::TIME INTO v_hora_apertura
    FROM configuraciones WHERE clave = 'horario_apertura';

    SELECT valor::TIME INTO v_hora_cierre
    FROM configuraciones WHERE clave = 'horario_cierre';

    v_hora_actual := v_hora_apertura;

    -- Generar slots de tiempo
    WHILE v_hora_actual < v_hora_cierre LOOP
        RETURN QUERY
        SELECT
            v_hora_actual,
            (v_hora_actual + (p_duracion_horas || ' hours')::INTERVAL)::TIME,
            NOT EXISTS (
                SELECT 1 FROM reservas r
                WHERE r.cancha_id = p_cancha_id
                AND r.fecha = p_fecha
                AND r.estado_id IN (SELECT id FROM estados_reserva WHERE nombre IN ('pendiente', 'confirmada'))
                AND (
                    (v_hora_actual >= r.hora_inicio AND v_hora_actual < r.hora_fin) OR
                    ((v_hora_actual + (p_duracion_horas || ' hours')::INTERVAL)::TIME > r.hora_inicio
                     AND (v_hora_actual + (p_duracion_horas || ' hours')::INTERVAL)::TIME <= r.hora_fin)
                )
            ) AND NOT EXISTS (
                SELECT 1 FROM bloqueos_horarios b
                WHERE b.cancha_id = p_cancha_id
                AND p_fecha BETWEEN b.fecha_inicio AND b.fecha_fin
                AND (
                    (v_hora_actual >= b.hora_inicio AND v_hora_actual < b.hora_fin)
                )
            );

        v_hora_actual := v_hora_actual + INTERVAL '1 hour';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_horarios_disponibles IS 'Retorna horarios disponibles para una cancha en una fecha específica';

-- Función: Calcular precio con descuento
CREATE OR REPLACE FUNCTION calcular_precio_reserva(
    p_cancha_id INTEGER,
    p_cliente_id INTEGER,
    p_hora_inicio TIME,
    p_hora_fin TIME
)
RETURNS TABLE (
    precio_base NUMERIC,
    descuento_porcentaje NUMERIC,
    descuento_monto NUMERIC,
    precio_total NUMERIC,
    sena_requerida NUMERIC
) AS $$
DECLARE
    v_precio_hora NUMERIC;
    v_duracion_horas NUMERIC;
    v_descuento NUMERIC;
    v_sena_porcentaje NUMERIC;
BEGIN
    -- Obtener precio por hora de la cancha
    SELECT precio_por_hora INTO v_precio_hora
    FROM canchas WHERE id = p_cancha_id;

    -- Calcular duración en horas
    v_duracion_horas := EXTRACT(EPOCH FROM (p_hora_fin - p_hora_inicio)) / 3600;

    -- Obtener descuento del cliente
    SELECT tc.descuento_porcentaje INTO v_descuento
    FROM clientes c
    JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id
    WHERE c.id = p_cliente_id;

    -- Obtener porcentaje de seña
    SELECT valor::NUMERIC INTO v_sena_porcentaje
    FROM configuraciones WHERE clave = 'sena_porcentaje';

    -- Retornar cálculos
    RETURN QUERY
    SELECT
        (v_precio_hora * v_duracion_horas)::NUMERIC as precio_base,
        v_descuento as descuento_porcentaje,
        ((v_precio_hora * v_duracion_horas) * v_descuento / 100)::NUMERIC as descuento_monto,
        ((v_precio_hora * v_duracion_horas) - ((v_precio_hora * v_duracion_horas) * v_descuento / 100))::NUMERIC as precio_total,
        (((v_precio_hora * v_duracion_horas) - ((v_precio_hora * v_duracion_horas) * v_descuento / 100)) * v_sena_porcentaje / 100)::NUMERIC as sena_requerida;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_precio_reserva IS 'Calcula el precio de una reserva incluyendo descuentos y seña';

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Tipos de cliente
INSERT INTO tipos_cliente (nombre, descuento_porcentaje, min_reservas_mes, descripcion) VALUES
('regular', 0, 0, 'Cliente regular sin descuentos'),
('frecuente', 10, 4, 'Cliente frecuente - 4 o más reservas al mes'),
('vip', 20, 8, 'Cliente VIP - 8 o más reservas al mes');

-- Estados de reserva
INSERT INTO estados_reserva (nombre, descripcion) VALUES
('pendiente', 'Reserva creada, pendiente de confirmación y pago de seña'),
('confirmada', 'Reserva confirmada con seña pagada'),
('cancelada', 'Reserva cancelada por el cliente o administrador'),
('completada', 'Reserva completada exitosamente'),
('no_show', 'Cliente no se presentó a la reserva');

-- Canchas de ejemplo
INSERT INTO canchas (nombre, capacidad, precio_por_hora, descripcion) VALUES
('Cancha 1', 22, 25000.00, 'Cancha principal con césped sintético de última generación'),
('Cancha 2', 14, 20000.00, 'Cancha secundaria, ideal para fútbol 7'),
('Cancha 3', 10, 15000.00, 'Cancha pequeña para fútbol 5, techada');

-- Configuraciones del sistema
INSERT INTO configuraciones (clave, valor, tipo, descripcion) VALUES
('sena_porcentaje', '30', 'number', 'Porcentaje de seña requerida (30% del total)'),
('horas_anticipacion_min', '2', 'number', 'Horas mínimas de anticipación para reservar'),
('duracion_maxima_horas', '3', 'number', 'Duración máxima de una reserva en horas'),
('penalizacion_no_show', '50', 'number', 'Porcentaje de penalización por no presentarse'),
('horario_apertura', '08:00', 'string', 'Hora de apertura del polideportivo'),
('horario_cierre', '23:00', 'string', 'Hora de cierre del polideportivo'),
('reservas_max_cliente_dia', '2', 'number', 'Máximo de reservas por cliente por día');

-- ============================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security - RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_reserva ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Función auxiliar para verificar si el usuario es admin
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT rol = 'admin' FROM usuarios WHERE email = auth.email()),
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función auxiliar para obtener cliente_id del usuario autenticado
CREATE OR REPLACE FUNCTION obtener_cliente_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT cliente_id FROM usuarios WHERE email = auth.email());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para canchas (lectura pública, escritura solo admin)
CREATE POLICY "Canchas son visibles para todos" ON canchas
    FOR SELECT USING (true);

CREATE POLICY "Solo admins pueden crear canchas" ON canchas
    FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Solo admins pueden modificar canchas" ON canchas
    FOR UPDATE USING (es_admin());

CREATE POLICY "Solo admins pueden eliminar canchas" ON canchas
    FOR DELETE USING (es_admin());

-- Políticas para clientes
CREATE POLICY "Admins pueden ver todos los clientes" ON clientes
    FOR SELECT USING (es_admin() OR id = obtener_cliente_id());

CREATE POLICY "Solo admins pueden crear clientes" ON clientes
    FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Solo admins pueden modificar clientes" ON clientes
    FOR UPDATE USING (es_admin());

CREATE POLICY "Solo admins pueden eliminar clientes" ON clientes
    FOR DELETE USING (es_admin());

-- Políticas para reservas
CREATE POLICY "Usuarios pueden ver sus propias reservas" ON reservas
    FOR SELECT USING (es_admin() OR cliente_id = obtener_cliente_id());

CREATE POLICY "Usuarios pueden crear reservas" ON reservas
    FOR INSERT WITH CHECK (es_admin() OR cliente_id = obtener_cliente_id());

CREATE POLICY "Solo admins pueden modificar reservas" ON reservas
    FOR UPDATE USING (es_admin());

CREATE POLICY "Solo admins pueden eliminar reservas" ON reservas
    FOR DELETE USING (es_admin());

-- Políticas para pagos
CREATE POLICY "Usuarios pueden ver pagos de sus reservas" ON pagos
    FOR SELECT USING (
        es_admin() OR
        EXISTS (
            SELECT 1 FROM reservas
            WHERE reservas.id = pagos.reserva_id
            AND reservas.cliente_id = obtener_cliente_id()
        )
    );

CREATE POLICY "Solo admins pueden crear pagos" ON pagos
    FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Solo admins pueden modificar pagos" ON pagos
    FOR UPDATE USING (es_admin());

CREATE POLICY "Solo admins pueden eliminar pagos" ON pagos
    FOR DELETE USING (es_admin());

-- Políticas para configuraciones (lectura pública, escritura admin)
CREATE POLICY "Configuraciones visibles para todos" ON configuraciones
    FOR SELECT USING (true);

CREATE POLICY "Solo admins pueden crear configuraciones" ON configuraciones
    FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Solo admins pueden modificar configuraciones" ON configuraciones
    FOR UPDATE USING (es_admin());

CREATE POLICY "Solo admins pueden eliminar configuraciones" ON configuraciones
    FOR DELETE USING (es_admin());

-- Políticas para bloqueos_horarios
CREATE POLICY "Bloqueos visibles para todos" ON bloqueos_horarios
    FOR SELECT USING (true);

CREATE POLICY "Solo admins pueden crear bloqueos" ON bloqueos_horarios
    FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Solo admins pueden modificar bloqueos" ON bloqueos_horarios
    FOR UPDATE USING (es_admin());

CREATE POLICY "Solo admins pueden eliminar bloqueos" ON bloqueos_horarios
    FOR DELETE USING (es_admin());

-- Políticas para usuarios
CREATE POLICY "Usuarios pueden ver su propio perfil" ON usuarios
    FOR SELECT USING (es_admin() OR email = auth.email());

CREATE POLICY "Solo admins pueden crear usuarios" ON usuarios
    FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON usuarios
    FOR UPDATE USING (es_admin() OR email = auth.email());

CREATE POLICY "Solo admins pueden eliminar usuarios" ON usuarios
    FOR DELETE USING (es_admin());

-- Políticas para tipos_cliente y estados_reserva (solo lectura para todos)
CREATE POLICY "Tipos de cliente visibles para todos" ON tipos_cliente
    FOR SELECT USING (true);

CREATE POLICY "Solo admins pueden modificar tipos de cliente" ON tipos_cliente
    FOR ALL USING (es_admin());

CREATE POLICY "Estados de reserva visibles para todos" ON estados_reserva
    FOR SELECT USING (true);

CREATE POLICY "Solo admins pueden modificar estados de reserva" ON estados_reserva
    FOR ALL USING (es_admin());

-- ============================================
-- ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================

-- Índices compuestos para búsquedas frecuentes
CREATE INDEX idx_reservas_cancha_fecha_estado ON reservas(cancha_id, fecha, estado_id);
CREATE INDEX idx_reservas_cliente_fecha ON reservas(cliente_id, fecha DESC);
CREATE INDEX idx_reservas_estado_fecha ON reservas(estado_id, fecha);
CREATE INDEX idx_pagos_reserva_tipo ON pagos(reserva_id, tipo);

-- Índices para búsquedas de texto (requiere extensión pg_trgm habilitada al inicio)
CREATE INDEX idx_clientes_nombre_trgm ON clientes USING gin (nombre gin_trgm_ops);
CREATE INDEX idx_clientes_apellido_trgm ON clientes USING gin (apellido gin_trgm_ops);

-- ============================================
-- TABLA: dias_bloqueados
-- Descripción: Días en que el complejo permanece cerrado (feriados, mantenimiento)
-- ============================================

CREATE TABLE dias_bloqueados (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    motivo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para dias_bloqueados
CREATE INDEX idx_dias_bloqueados_fecha ON dias_bloqueados(fecha);

-- Comentarios
COMMENT ON TABLE dias_bloqueados IS 'Días en que el complejo permanece cerrado completamente';
COMMENT ON COLUMN dias_bloqueados.fecha IS 'Fecha del día bloqueado (debe ser única)';
COMMENT ON COLUMN dias_bloqueados.motivo IS 'Razón del cierre (feriado, mantenimiento, etc.)';

-- Trigger para updated_at
CREATE TRIGGER set_timestamp_dias_bloqueados
    BEFORE UPDATE ON dias_bloqueados
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Habilitar RLS
ALTER TABLE dias_bloqueados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para dias_bloqueados
CREATE POLICY "Dias bloqueados visibles para todos" ON dias_bloqueados
    FOR SELECT USING (true);

CREATE POLICY "Solo admins pueden crear dias bloqueados" ON dias_bloqueados
    FOR INSERT WITH CHECK (es_admin());

CREATE POLICY "Solo admins pueden modificar dias bloqueados" ON dias_bloqueados
    FOR UPDATE USING (es_admin());

CREATE POLICY "Solo admins pueden eliminar dias bloqueados" ON dias_bloqueados
    FOR DELETE USING (es_admin());

-- Función para verificar si una fecha es día bloqueado
CREATE OR REPLACE FUNCTION es_dia_bloqueado(p_fecha DATE)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM dias_bloqueados
        WHERE fecha = p_fecha
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION es_dia_bloqueado IS 'Retorna true si la fecha está bloqueada';

-- Vista para próximos días bloqueados
CREATE OR REPLACE VIEW vista_proximos_dias_bloqueados AS
SELECT
    id,
    fecha,
    motivo,
    descripcion,
    CASE
        WHEN fecha = CURRENT_DATE THEN 'HOY'::TEXT
        WHEN fecha = CURRENT_DATE + INTERVAL '1 day' THEN 'MAÑANA'::TEXT
        ELSE (fecha - CURRENT_DATE)::TEXT || ' días'
    END as dias_restantes
FROM dias_bloqueados
WHERE fecha >= CURRENT_DATE
ORDER BY fecha ASC;

COMMENT ON VIEW vista_proximos_dias_bloqueados IS 'Días bloqueados próximos y futuros';

-- Datos de ejemplo (feriados nacionales argentinos 2025)
INSERT INTO dias_bloqueados (fecha, motivo, descripcion) VALUES
('2025-01-01', 'Feriado Nacional', 'Año Nuevo'),
('2025-03-24', 'Feriado Nacional', 'Día Nacional de la Memoria por la Verdad y la Justicia'),
('2025-04-02', 'Feriado Nacional', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'),
('2025-04-18', 'Feriado Nacional', 'Viernes Santo'),
('2025-05-01', 'Feriado Nacional', 'Día del Trabajador'),
('2025-05-25', 'Feriado Nacional', 'Día de la Revolución de Mayo'),
('2025-06-20', 'Feriado Nacional', 'Paso a la Inmortalidad del General Manuel Belgrano'),
('2025-07-09', 'Feriado Nacional', 'Día de la Independencia'),
('2025-08-17', 'Feriado Nacional', 'Paso a la Inmortalidad del General José de San Martín'),
('2025-10-12', 'Feriado Nacional', 'Día del Respeto a la Diversidad Cultural'),
('2025-11-20', 'Feriado Nacional', 'Día de la Soberanía Nacional'),
('2025-12-08', 'Feriado Nacional', 'Inmaculada Concepción de María'),
('2025-12-25', 'Feriado Nacional', 'Navidad')
ON CONFLICT (fecha) DO NOTHING;

-- ============================================
-- FINALIZACIÓN
-- ============================================

-- Comentario general del esquema
COMMENT ON SCHEMA public IS 'Sistema de Reservas de Canchas de Fútbol - Version 1.0';

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Schema creado exitosamente';
    RAISE NOTICE 'Base de datos: Sistema de Reservas de Canchas';
    RAISE NOTICE 'Versión: 1.1';
    RAISE NOTICE 'Tablas: 10 principales + 5 vistas';
    RAISE NOTICE 'Triggers: 8 automáticos';
    RAISE NOTICE 'Funciones: 5 auxiliares';
    RAISE NOTICE 'RLS: Habilitado en todas las tablas';
    RAISE NOTICE '============================================';
END $$;
