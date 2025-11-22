-- ============================================
-- MIGRACIÓN: Relacionar dias_bloqueados con canchas
-- ============================================
-- Este script actualiza la tabla dias_bloqueados para:
-- 1. Permitir bloquear canchas específicas o todas las canchas
-- 2. Agregar relación opcional con la tabla canchas
-- ============================================

-- PASO 1: Agregar columna cancha_id (nullable)
-- Si es NULL, el bloqueo aplica a TODAS las canchas
-- Si tiene un ID, solo aplica a esa cancha específica
ALTER TABLE dias_bloqueados
ADD COLUMN cancha_id INTEGER DEFAULT NULL;

-- PASO 2: Agregar clave foránea a canchas
ALTER TABLE dias_bloqueados
ADD CONSTRAINT fk_dias_bloqueados_cancha
    FOREIGN KEY (cancha_id)
    REFERENCES canchas(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- PASO 3: Crear índice para mejorar performance
CREATE INDEX idx_dias_bloqueados_cancha_id ON dias_bloqueados(cancha_id);

-- PASO 4: Crear índice compuesto para búsquedas comunes
CREATE INDEX idx_dias_bloqueados_fecha_cancha ON dias_bloqueados(fecha, cancha_id);

-- ============================================
-- FUNCIÓN: Verificar si una cancha está bloqueada en una fecha
-- ============================================
CREATE OR REPLACE FUNCTION es_cancha_bloqueada(p_cancha_id INTEGER, p_fecha DATE)
RETURNS BOOLEAN AS $$
BEGIN
    -- Retorna TRUE si existe un bloqueo para:
    -- 1. Esa cancha específica en esa fecha, O
    -- 2. Todas las canchas (cancha_id IS NULL) en esa fecha
    RETURN EXISTS (
        SELECT 1
        FROM dias_bloqueados
        WHERE fecha = p_fecha
        AND (cancha_id = p_cancha_id OR cancha_id IS NULL)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN: Obtener motivo de bloqueo de una cancha
-- ============================================
CREATE OR REPLACE FUNCTION obtener_motivo_bloqueo(p_cancha_id INTEGER, p_fecha DATE)
RETURNS TABLE(motivo VARCHAR, descripcion TEXT, aplica_todas BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT
        db.motivo,
        db.descripcion,
        (db.cancha_id IS NULL) as aplica_todas
    FROM dias_bloqueados db
    WHERE db.fecha = p_fecha
    AND (db.cancha_id = p_cancha_id OR db.cancha_id IS NULL)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Validar que no se creen reservas en días bloqueados
-- ============================================
CREATE OR REPLACE FUNCTION validar_dia_bloqueado_reserva()
RETURNS TRIGGER AS $$
DECLARE
    v_bloqueado BOOLEAN;
    v_motivo VARCHAR;
BEGIN
    -- Verificar si la cancha está bloqueada en esa fecha
    SELECT es_cancha_bloqueada(NEW.cancha_id, NEW.fecha) INTO v_bloqueado;

    IF v_bloqueado THEN
        -- Obtener el motivo del bloqueo
        SELECT motivo INTO v_motivo
        FROM dias_bloqueados
        WHERE fecha = NEW.fecha
        AND (cancha_id = NEW.cancha_id OR cancha_id IS NULL)
        LIMIT 1;

        RAISE EXCEPTION 'No se puede reservar en esta fecha. Motivo: %', v_motivo;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en la tabla reservas
DROP TRIGGER IF EXISTS trigger_validar_dia_bloqueado ON reservas;
CREATE TRIGGER trigger_validar_dia_bloqueado
    BEFORE INSERT OR UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION validar_dia_bloqueado_reserva();

-- ============================================
-- VISTA: Días bloqueados con información de cancha
-- ============================================
CREATE OR REPLACE VIEW vista_dias_bloqueados_detalle AS
SELECT
    db.id,
    db.fecha,
    db.motivo,
    db.descripcion,
    db.cancha_id,
    c.nombre as cancha_nombre,
    CASE
        WHEN db.cancha_id IS NULL THEN 'Todas las canchas'
        ELSE c.nombre
    END as alcance,
    (db.cancha_id IS NULL) as aplica_todas_canchas,
    db.created_at,
    db.updated_at
FROM dias_bloqueados db
LEFT JOIN canchas c ON db.cancha_id = c.id
ORDER BY db.fecha ASC;

-- ============================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- ============================================
-- Los feriados existentes quedan sin cancha_id (NULL)
-- lo que significa que aplican a TODAS las canchas

-- Ejemplo: Bloquear solo Cancha 1 para mantenimiento
/*
INSERT INTO dias_bloqueados (fecha, motivo, descripcion, cancha_id)
VALUES
    ('2025-12-15', 'Mantenimiento', 'Cambio de césped sintético', 1),
    ('2025-12-16', 'Mantenimiento', 'Cambio de césped sintético', 1);
*/

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migración completada exitosamente';
    RAISE NOTICE '';
    RAISE NOTICE 'Cambios realizados:';
    RAISE NOTICE '✅ Columna cancha_id agregada a dias_bloqueados';
    RAISE NOTICE '✅ Clave foránea creada (FK a canchas)';
    RAISE NOTICE '✅ Índices creados para performance';
    RAISE NOTICE '✅ Función es_cancha_bloqueada() creada';
    RAISE NOTICE '✅ Función obtener_motivo_bloqueo() creada';
    RAISE NOTICE '✅ Trigger de validación en reservas creado';
    RAISE NOTICE '✅ Vista vista_dias_bloqueados_detalle creada';
    RAISE NOTICE '';
    RAISE NOTICE 'Comportamiento:';
    RAISE NOTICE '- cancha_id = NULL: Bloquea TODAS las canchas';
    RAISE NOTICE '- cancha_id = N: Bloquea solo la cancha N';
    RAISE NOTICE '- Reservas bloqueadas automáticamente en días bloqueados';
    RAISE NOTICE '============================================';
END $$;

-- Mostrar vista de días bloqueados
SELECT * FROM vista_dias_bloqueados_detalle LIMIT 10;
