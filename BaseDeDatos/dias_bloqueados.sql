-- ============================================
-- TABLA: dias_bloqueados
-- Descripción: Días en que el complejo permanece cerrado (feriados, mantenimiento)
-- ============================================

CREATE TABLE IF NOT EXISTS dias_bloqueados (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    motivo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
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

-- Políticas RLS
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
        ELSE TO_CHAR(fecha - CURRENT_DATE, 'FM999') || ' días'
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
