-- ============================================
-- SCRIPT DE LIMPIEZA Y CREACIÓN COMPLETA
-- Para Supabase (PostgreSQL)
-- Primero elimina todo y luego lo crea desde cero
-- ============================================

-- ============================================
-- PASO 1: ELIMINAR TODO LO EXISTENTE
-- ============================================

-- Eliminar vistas (si existen)
DROP VIEW IF EXISTS vista_disponibilidad CASCADE;
DROP VIEW IF EXISTS vista_clientes_resumen CASCADE;
DROP VIEW IF EXISTS vista_estadisticas_canchas CASCADE;
DROP VIEW IF EXISTS vista_reservas_proximas CASCADE;
DROP VIEW IF EXISTS vista_proximos_dias_bloqueados CASCADE;

-- Eliminar tablas (si existen)
DROP TABLE IF EXISTS dias_bloqueados CASCADE;
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS reservas CASCADE;
DROP TABLE IF EXISTS bloqueos_horarios CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS estados_reserva CASCADE;
DROP TABLE IF EXISTS canchas CASCADE;
DROP TABLE IF EXISTS configuraciones CASCADE;
DROP TABLE IF EXISTS tipos_cliente CASCADE;

-- Eliminar funciones (si existen)
DROP FUNCTION IF EXISTS trigger_set_timestamp() CASCADE;
DROP FUNCTION IF EXISTS actualizar_total_reservas_cliente() CASCADE;
DROP FUNCTION IF EXISTS incrementar_no_shows() CASCADE;
DROP FUNCTION IF EXISTS actualizar_estado_cancha() CASCADE;
DROP FUNCTION IF EXISTS validar_disponibilidad_reserva() CASCADE;
DROP FUNCTION IF EXISTS obtener_horarios_disponibles(INTEGER, DATE, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calcular_precio_reserva(INTEGER, INTEGER, TIME, TIME) CASCADE;
DROP FUNCTION IF EXISTS es_admin() CASCADE;
DROP FUNCTION IF EXISTS obtener_cliente_id() CASCADE;
DROP FUNCTION IF EXISTS es_dia_bloqueado(DATE) CASCADE;

-- Eliminar tipos ENUM (si existen)
DROP TYPE IF EXISTS estado_cancha CASCADE;
DROP TYPE IF EXISTS estado_cliente CASCADE;
DROP TYPE IF EXISTS tipo_estado_reserva CASCADE;
DROP TYPE IF EXISTS tipo_pago CASCADE;
DROP TYPE IF EXISTS metodo_pago CASCADE;
DROP TYPE IF EXISTS rol_usuario CASCADE;
DROP TYPE IF EXISTS estado_usuario CASCADE;
DROP TYPE IF EXISTS tipo_config CASCADE;

-- ============================================
-- PASO 2: HABILITAR EXTENSIONES
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- PASO 3: CREAR TIPOS ENUM
-- ============================================

CREATE TYPE estado_cancha AS ENUM (
    'disponible',
    'reservada',
    'mantenimiento',
    'fuera_servicio'
);

CREATE TYPE estado_cliente AS ENUM (
    'activo',
    'suspendido',
    'bloqueado'
);

CREATE TYPE tipo_estado_reserva AS ENUM (
    'pendiente',
    'confirmada',
    'cancelada',
    'completada',
    'no_show'
);

CREATE TYPE tipo_pago AS ENUM (
    'seña',
    'saldo',
    'completo',
    'devolucion'
);

CREATE TYPE metodo_pago AS ENUM (
    'efectivo',
    'tarjeta',
    'transferencia'
);

CREATE TYPE rol_usuario AS ENUM (
    'cliente',
    'admin'
);

CREATE TYPE estado_usuario AS ENUM (
    'activo',
    'inactivo'
);

CREATE TYPE tipo_config AS ENUM (
    'string',
    'number',
    'boolean',
    'json'
);

-- ============================================
-- PASO 4: CREAR TABLAS
-- ============================================

-- Tabla: tipos_cliente
CREATE TABLE tipos_cliente (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descuento_porcentaje NUMERIC(5,2) DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    min_reservas_mes INTEGER DEFAULT 0 CHECK (min_reservas_mes >= 0),
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tipos_cliente_nombre ON tipos_cliente(nombre);

-- Tabla: canchas
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

CREATE INDEX idx_canchas_estado ON canchas(estado);
CREATE INDEX idx_canchas_nombre ON canchas(nombre);

-- Tabla: clientes
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
    CONSTRAINT fk_tipo_cliente FOREIGN KEY (tipo_cliente_id)
        REFERENCES tipos_cliente(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_clientes_telefono ON clientes(telefono);
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_clientes_tipo ON clientes(tipo_cliente_id);
CREATE INDEX idx_clientes_estado ON clientes(estado);
CREATE INDEX idx_clientes_nombre_apellido ON clientes(nombre, apellido);

-- Tabla: estados_reserva
CREATE TABLE estados_reserva (
    id SERIAL PRIMARY KEY,
    nombre tipo_estado_reserva NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: reservas
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
    CONSTRAINT chk_hora_valida CHECK (hora_fin > hora_inicio),
    CONSTRAINT chk_sena_valida CHECK (sena_pagada <= precio_total),
    CONSTRAINT unique_cancha_fecha_hora UNIQUE (cancha_id, fecha, hora_inicio)
);

CREATE INDEX idx_reservas_fecha ON reservas(fecha);
CREATE INDEX idx_reservas_cancha_fecha ON reservas(cancha_id, fecha);
CREATE INDEX idx_reservas_cliente ON reservas(cliente_id);
CREATE INDEX idx_reservas_estado ON reservas(estado_id);
CREATE INDEX idx_reservas_fecha_hora ON reservas(fecha, hora_inicio);
CREATE INDEX idx_reservas_pago_completo ON reservas(pago_completo);
CREATE INDEX idx_reservas_fecha_creacion ON reservas(fecha_creacion);

-- Tabla: pagos
CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    reserva_id INTEGER NOT NULL,
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    tipo tipo_pago NOT NULL,
    metodo metodo_pago NOT NULL,
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reserva FOREIGN KEY (reserva_id)
        REFERENCES reservas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX idx_pagos_reserva ON pagos(reserva_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);
CREATE INDEX idx_pagos_tipo ON pagos(tipo);
CREATE INDEX idx_pagos_metodo ON pagos(metodo);

-- Tabla: configuraciones
CREATE TABLE configuraciones (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    tipo tipo_config DEFAULT 'string',
    descripcion TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_configuraciones_clave ON configuraciones(clave);

-- Tabla: bloqueos_horarios
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
    CONSTRAINT fk_cancha_bloqueo FOREIGN KEY (cancha_id)
        REFERENCES canchas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_fecha_bloqueo_valida CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_bloqueos_cancha ON bloqueos_horarios(cancha_id);
CREATE INDEX idx_bloqueos_fechas ON bloqueos_horarios(fecha_inicio, fecha_fin);

-- Tabla: usuarios
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
    CONSTRAINT fk_cliente_usuario FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_estado ON usuarios(estado);
CREATE INDEX idx_usuarios_cliente ON usuarios(cliente_id);

-- Tabla: dias_bloqueados
CREATE TABLE dias_bloqueados (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    motivo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dias_bloqueados_fecha ON dias_bloqueados(fecha);

-- ============================================
-- PASO 5: CREAR FUNCIONES Y TRIGGERS
-- ============================================

-- Función para updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER set_timestamp_tipos_cliente BEFORE UPDATE ON tipos_cliente FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_canchas BEFORE UPDATE ON canchas FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_clientes BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_reservas BEFORE UPDATE ON reservas FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_configuraciones BEFORE UPDATE ON configuraciones FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_bloqueos BEFORE UPDATE ON bloqueos_horarios FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_usuarios BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_dias_bloqueados BEFORE UPDATE ON dias_bloqueados FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Función: Actualizar contador de reservas
CREATE OR REPLACE FUNCTION actualizar_total_reservas_cliente()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE clientes SET total_reservas = total_reservas + 1, ultima_reserva = NEW.fecha WHERE id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_reservas AFTER INSERT ON reservas FOR EACH ROW EXECUTE FUNCTION actualizar_total_reservas_cliente();

-- Función: Incrementar no-shows
CREATE OR REPLACE FUNCTION incrementar_no_shows()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado_id = (SELECT id FROM estados_reserva WHERE nombre = 'no_show') AND OLD.estado_id != NEW.estado_id THEN
        UPDATE clientes SET no_shows = no_shows + 1 WHERE id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_incrementar_no_shows AFTER UPDATE ON reservas FOR EACH ROW EXECUTE FUNCTION incrementar_no_shows();

-- Función: Verificar si es día bloqueado
CREATE OR REPLACE FUNCTION es_dia_bloqueado(p_fecha DATE)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM dias_bloqueados WHERE fecha = p_fecha);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PASO 6: FUNCIONES RLS
-- ============================================

CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE((SELECT rol = 'admin' FROM usuarios WHERE email = auth.email()), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION obtener_cliente_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT cliente_id FROM usuarios WHERE email = auth.email());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PASO 7: HABILITAR RLS
-- ============================================

ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_reserva ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE dias_bloqueados ENABLE ROW LEVEL SECURITY;

-- Políticas para canchas
CREATE POLICY "Canchas son visibles para todos" ON canchas FOR SELECT USING (true);
CREATE POLICY "Solo admins pueden crear canchas" ON canchas FOR INSERT WITH CHECK (es_admin());
CREATE POLICY "Solo admins pueden modificar canchas" ON canchas FOR UPDATE USING (es_admin());
CREATE POLICY "Solo admins pueden eliminar canchas" ON canchas FOR DELETE USING (es_admin());

-- Políticas para clientes
CREATE POLICY "Admins pueden ver todos los clientes" ON clientes FOR SELECT USING (es_admin() OR id = obtener_cliente_id());
CREATE POLICY "Solo admins pueden crear clientes" ON clientes FOR INSERT WITH CHECK (es_admin());
CREATE POLICY "Solo admins pueden modificar clientes" ON clientes FOR UPDATE USING (es_admin());
CREATE POLICY "Solo admins pueden eliminar clientes" ON clientes FOR DELETE USING (es_admin());

-- Políticas para reservas
CREATE POLICY "Usuarios pueden ver sus propias reservas" ON reservas FOR SELECT USING (es_admin() OR cliente_id = obtener_cliente_id());
CREATE POLICY "Usuarios pueden crear reservas" ON reservas FOR INSERT WITH CHECK (es_admin() OR cliente_id = obtener_cliente_id());
CREATE POLICY "Solo admins pueden modificar reservas" ON reservas FOR UPDATE USING (es_admin());
CREATE POLICY "Solo admins pueden eliminar reservas" ON reservas FOR DELETE USING (es_admin());

-- Políticas para pagos
CREATE POLICY "Usuarios pueden ver pagos de sus reservas" ON pagos FOR SELECT USING (es_admin() OR EXISTS (SELECT 1 FROM reservas WHERE reservas.id = pagos.reserva_id AND reservas.cliente_id = obtener_cliente_id()));
CREATE POLICY "Solo admins pueden crear pagos" ON pagos FOR INSERT WITH CHECK (es_admin());
CREATE POLICY "Solo admins pueden modificar pagos" ON pagos FOR UPDATE USING (es_admin());
CREATE POLICY "Solo admins pueden eliminar pagos" ON pagos FOR DELETE USING (es_admin());

-- Políticas para configuraciones
CREATE POLICY "Configuraciones visibles para todos" ON configuraciones FOR SELECT USING (true);
CREATE POLICY "Solo admins pueden crear configuraciones" ON configuraciones FOR INSERT WITH CHECK (es_admin());
CREATE POLICY "Solo admins pueden modificar configuraciones" ON configuraciones FOR UPDATE USING (es_admin());
CREATE POLICY "Solo admins pueden eliminar configuraciones" ON configuraciones FOR DELETE USING (es_admin());

-- Políticas para bloqueos_horarios
CREATE POLICY "Bloqueos visibles para todos" ON bloqueos_horarios FOR SELECT USING (true);
CREATE POLICY "Solo admins pueden crear bloqueos" ON bloqueos_horarios FOR INSERT WITH CHECK (es_admin());
CREATE POLICY "Solo admins pueden modificar bloqueos" ON bloqueos_horarios FOR UPDATE USING (es_admin());
CREATE POLICY "Solo admins pueden eliminar bloqueos" ON bloqueos_horarios FOR DELETE USING (es_admin());

-- Políticas para usuarios
CREATE POLICY "Usuarios pueden ver su propio perfil" ON usuarios FOR SELECT USING (es_admin() OR email = auth.email());
CREATE POLICY "Solo admins pueden crear usuarios" ON usuarios FOR INSERT WITH CHECK (es_admin());
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON usuarios FOR UPDATE USING (es_admin() OR email = auth.email());
CREATE POLICY "Solo admins pueden eliminar usuarios" ON usuarios FOR DELETE USING (es_admin());

-- Políticas para tipos_cliente y estados_reserva
CREATE POLICY "Tipos de cliente visibles para todos" ON tipos_cliente FOR SELECT USING (true);
CREATE POLICY "Solo admins pueden modificar tipos de cliente" ON tipos_cliente FOR ALL USING (es_admin());
CREATE POLICY "Estados de reserva visibles para todos" ON estados_reserva FOR SELECT USING (true);
CREATE POLICY "Solo admins pueden modificar estados de reserva" ON estados_reserva FOR ALL USING (es_admin());

-- Políticas para dias_bloqueados
CREATE POLICY "Dias bloqueados visibles para todos" ON dias_bloqueados FOR SELECT USING (true);
CREATE POLICY "Solo admins pueden crear dias bloqueados" ON dias_bloqueados FOR INSERT WITH CHECK (es_admin());
CREATE POLICY "Solo admins pueden modificar dias bloqueados" ON dias_bloqueados FOR UPDATE USING (es_admin());
CREATE POLICY "Solo admins pueden eliminar dias bloqueados" ON dias_bloqueados FOR DELETE USING (es_admin());

-- ============================================
-- PASO 8: INSERTAR DATOS INICIALES
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

-- Feriados nacionales argentinos 2025
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
('2025-12-25', 'Feriado Nacional', 'Navidad');

-- ============================================
-- FINALIZACIÓN
-- ============================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Schema creado exitosamente';
    RAISE NOTICE 'Base de datos: Sistema de Reservas de Canchas';
    RAISE NOTICE 'Versión: 1.1';
    RAISE NOTICE 'Tablas: 10 principales';
    RAISE NOTICE 'Triggers: 8 automáticos';
    RAISE NOTICE 'Funciones: 5 auxiliares';
    RAISE NOTICE 'RLS: Habilitado en todas las tablas';
    RAISE NOTICE 'Datos iniciales: Cargados';
    RAISE NOTICE '============================================';
END $$;
