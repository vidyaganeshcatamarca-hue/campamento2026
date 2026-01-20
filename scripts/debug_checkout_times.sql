-- DIAGNOSTICO: Ver timestamps exactos de egresos para Enero 2026
-- Buscamos ver si están en UTC 00:00 o UTC 15:00 (Mediodía Arg)

SELECT 
    id, 
    celular_responsable, 
    fecha_egreso_programada 
FROM estadias 
WHERE fecha_egreso_programada >= '2026-01-20 00:00:00+00' 
AND fecha_egreso_programada <= '2026-01-21 12:00:00+00'
ORDER BY fecha_egreso_programada;
