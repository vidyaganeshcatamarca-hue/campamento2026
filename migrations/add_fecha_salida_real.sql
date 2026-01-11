-- Agregar campo fecha_salida_real a la tabla estadias
-- Este campo registra cuando realmente salió el acampante (puede diferir de fecha_egreso_programada)

ALTER TABLE estadias 
ADD COLUMN IF NOT EXISTS fecha_salida_real TIMESTAMPTZ;

COMMENT ON COLUMN estadias.fecha_salida_real IS 'Fecha y hora real de salida del campamento (checkout). NULL si aún está activo.';
