-- Agregar campo fecha_promesa_pago a tabla estadias
-- Este campo registra cuándo el huésped se compromete a pagar su saldo pendiente

ALTER TABLE estadias 
ADD COLUMN IF NOT EXISTS fecha_promesa_pago DATE NULL;

COMMENT ON COLUMN estadias.fecha_promesa_pago IS 
'Fecha en que el huésped se compromete a pagar el saldo pendiente. Sirve para evitar enviar recordatorios de pago antes de esta fecha comprometida.';

-- Índice para consultas de recordatorios
CREATE INDEX IF NOT EXISTS idx_estadias_promesa_pago 
ON estadias(fecha_promesa_pago) 
WHERE fecha_promesa_pago IS NOT NULL AND saldo_pendiente > 0;
