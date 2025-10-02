-- Schema para Sistema de Reservas de Canchas de Fútbol - MariaDB
-- Crear base de datos
CREATE DATABASE IF NOT EXISTS futbol_reservas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE futbol_reservas;

-- Tabla de Canchas
CREATE TABLE canchas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    capacidad INT NOT NULL DEFAULT 22,
    precio_por_hora DECIMAL(10,2) NOT NULL,
    descripcion TEXT,
    estado ENUM('disponible', 'mantenimiento', 'fuera_servicio') DEFAULT 'disponible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de Tipos de Cliente (para descuentos y reglas especiales)
CREATE TABLE tipos_cliente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE, -- 'regular', 'frecuente', 'vip'
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
    min_reservas_mes INT DEFAULT 0,
    descripcion TEXT
);

-- Tabla de Clientes
CREATE TABLE clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    tipo_cliente_id INT DEFAULT 1,
    total_reservas INT DEFAULT 0,
    no_shows INT DEFAULT 0, -- contador de veces que no se presentó
    ultima_reserva DATE,
    estado ENUM('activo', 'suspendido', 'bloqueado') DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_clientes_telefono (telefono),
    INDEX idx_clientes_email (email),
    FOREIGN KEY (tipo_cliente_id) REFERENCES tipos_cliente(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Tabla de Estados de Reserva
CREATE TABLE estados_reserva (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE, -- 'pendiente', 'confirmada', 'cancelada', 'completada', 'no_show'
    descripcion TEXT
);

-- Tabla principal de Reservas
CREATE TABLE reservas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cancha_id INT NOT NULL,
    cliente_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    precio_total DECIMAL(10,2) NOT NULL,
    descuento_aplicado DECIMAL(5,2) DEFAULT 0,
    sena_requerida DECIMAL(10,2) DEFAULT 0,
    sena_pagada DECIMAL(10,2) DEFAULT 0,
    pago_completo BOOLEAN DEFAULT FALSE,
    estado_id INT DEFAULT 1, -- pendiente por defecto
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cancelacion TIMESTAMP NULL,
    razon_cancelacion TEXT,
    INDEX idx_reservas_fecha (fecha),
    INDEX idx_reservas_cancha_fecha (cancha_id, fecha),
    INDEX idx_reservas_cliente (cliente_id),
    -- Evitar reservas superpuestas
    UNIQUE KEY unique_cancha_fecha_hora (cancha_id, fecha, hora_inicio),
    FOREIGN KEY (cancha_id) REFERENCES canchas(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (estado_id) REFERENCES estados_reserva(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Tabla de Pagos (para llevar historial detallado)
CREATE TABLE pagos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reserva_id INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    tipo_pago ENUM('seña', 'saldo', 'completo', 'devolucion') NOT NULL,
    metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia') NOT NULL,
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Tabla de Configuraciones del Sistema
CREATE TABLE configuraciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    tipo ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    descripcion TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de Bloqueos de Horarios (para mantenimiento, eventos especiales, etc.)
CREATE TABLE bloqueos_horarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cancha_id INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    fecha_fin DATE NOT NULL,
    hora_fin TIME NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cancha_id) REFERENCES canchas(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Datos iniciales
INSERT INTO tipos_cliente (nombre, descuento_porcentaje, min_reservas_mes, descripcion) VALUES
('regular', 0, 0, 'Cliente regular sin descuentos'),
('frecuente', 10, 4, 'Cliente frecuente - 4+ reservas al mes'),
('vip', 20, 8, 'Cliente VIP - 8+ reservas al mes');

INSERT INTO estados_reserva (nombre, descripcion) VALUES
('pendiente', 'Reserva creada, pendiente de confirmación'),
('confirmada', 'Reserva confirmada con seña pagada'),
('cancelada', 'Reserva cancelada por el cliente o admin'),
('completada', 'Reserva completada exitosamente'),
('no_show', 'Cliente no se presentó a la reserva');

INSERT INTO canchas (nombre, capacidad, precio_por_hora, descripcion) VALUES
('Cancha 1', 22, 25000.00, 'Cancha principal con césped sintético'),
('Cancha 2', 14, 20000.00, 'Cancha secundaria, ideal para fútbol 7'),
('Cancha 3', 10, 15000.00, 'Cancha pequeña para fútbol 5');

INSERT INTO configuraciones (clave, valor, tipo, descripcion) VALUES
('sena_porcentaje', '30', 'number', 'Porcentaje de seña requerida (30%)'),
('horas_anticipacion_min', '2', 'number', 'Horas mínimas de anticipación para reservar'),
('duracion_maxima_horas', '3', 'number', 'Duración máxima de una reserva en horas'),
('penalizacion_no_show', '50', 'number', 'Porcentaje de penalización por no presentarse'),
('horario_apertura', '08:00', 'string', 'Hora de apertura del polideportivo'),
('horario_cierre', '23:00', 'string', 'Hora de cierre del polideportivo'),
('reservas_max_cliente_dia', '2', 'number', 'Máximo de reservas por cliente por día');

-- Vista para consultas frecuentes de disponibilidad
CREATE VIEW vista_disponibilidad AS
SELECT 
    c.id as cancha_id,
    c.nombre as cancha_nombre,
    c.precio_por_hora,
    r.fecha,
    r.hora_inicio,
    r.hora_fin,
    CASE WHEN r.id IS NOT NULL THEN 'ocupado' ELSE 'libre' END as estado
FROM canchas c
LEFT JOIN reservas r ON c.id = r.cancha_id 
    AND r.estado_id IN (1, 2) -- solo pendientes y confirmadas
WHERE c.estado = 'disponible';

-- Vista resumen de clientes
CREATE VIEW vista_clientes_resumen AS
SELECT 
    c.id,
    c.nombre,
    c.apellido,
    c.telefono,
    c.email,
    tc.nombre as tipo_cliente,
    tc.descuento_porcentaje,
    c.total_reservas,
    c.no_shows,
    CASE 
        WHEN c.no_shows >= 3 THEN 'riesgo'
        WHEN c.total_reservas >= tc.min_reservas_mes THEN 'buen_cliente'
        ELSE 'regular'
    END as categoria
FROM clientes c
JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id;