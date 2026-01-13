-- Agregar columna para asignar parcela individualmente a un acampante
-- Esto permite mover a una persona específica sin mover toda la estadía
ALTER TABLE acampantes 
ADD COLUMN IF NOT EXISTS parcela_asignada TEXT;

-- Comentario para documentación
COMMENT ON COLUMN acampantes.parcela_asignada IS 'Nombre de la parcela donde está físicamente esta persona (override de estadía)';
