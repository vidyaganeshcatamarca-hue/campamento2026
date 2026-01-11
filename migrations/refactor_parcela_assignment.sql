-- =====================================================
-- Migración: Refactorizar Sistema de Asignación de Parcelas
-- Fecha: 2026-01-09
-- =====================================================

-- 1. Agregar columna parcela_asignada en tabla estadias
ALTER TABLE estadias 
ADD COLUMN IF NOT EXISTS parcela_asignada TEXT;

-- Comentario explicativo
COMMENT ON COLUMN estadias.parcela_asignada IS 'Nombre de la parcela asignada a esta estadía (ej: A1, B2, CAMA-1). NULL si no tiene parcela asignada aún.';

-- 2. Agregar columna cantidad_integrantes en tabla parcelas
ALTER TABLE parcelas 
ADD COLUMN IF NOT EXISTS cantidad_integrantes INTEGER DEFAULT 0;

-- Comentario explicativo
COMMENT ON COLUMN parcelas.cantidad_integrantes IS 'Contador de personas actualmente asignadas a esta parcela. Cuando llega a 0, la parcela queda libre.';

-- 3. Marcar estadia_id como deprecated (mantener por compatibilidad temporal)
COMMENT ON COLUMN parcelas.estadia_id IS 'DEPRECATED - Usar cantidad_integrantes en su lugar. Mantener NULL.';

-- 4. Actualizar todas las parcelas existentes
-- Resetear contadores a 0 y limpiar estadia_id
UPDATE parcelas 
SET cantidad_integrantes = 0,
    estadia_id = NULL
WHERE TRUE;

-- 5. Resetear parcelas_asignadas en estadias existentes
UPDATE estadias 
SET parcela_asignada = NULL
WHERE TRUE;

-- 6. Actualizar estado de parcelas basado en cantidad_integrantes
-- Marcar como libre si cantidad_integrantes = 0
UPDATE parcelas
SET estado = 'libre'
WHERE cantidad_integrantes = 0;

-- 7. Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_parcelas_cantidad_integrantes 
ON parcelas(cantidad_integrantes);

CREATE INDEX IF NOT EXISTS idx_estadias_parcela_asignada 
ON estadias(parcela_asignada);

-- =====================================================
-- Verificación
-- =====================================================

-- Ver todas las parcelas con su contador
SELECT nombre_parcela, estado, cantidad_integrantes, estadia_id
FROM parcelas
ORDER BY nombre_parcela;

-- Ver todas las estadías con parcela asignada
SELECT id, celular_responsable, parcela_asignada, ingreso_confirmado
FROM estadias
ORDER BY created_at DESC
LIMIT 10;
