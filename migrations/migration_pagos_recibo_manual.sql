-- Agregar columna para marcar si se emitió recibo manual por la transferencia
ALTER TABLE pagos 
ADD COLUMN IF NOT EXISTS recibo_emitido BOOLEAN DEFAULT FALSE;

-- Comentario para documentación
COMMENT ON COLUMN pagos.recibo_emitido IS 'Indica si se ha confeccionado el recibo manual físico para esta transferencia';
