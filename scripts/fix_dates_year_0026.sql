-- FIX DATA: Reparar años corruptos (0025 -> 2026)
-- Corrección ajustada: El usuario confirma que estamos en 2026, por lo que '0025' debe ser '2026'.
-- (Probablemente se ingresó '25' en algún lugar y se interpretó como año 25 d.C., pero correspondía a la temporada actual 2026).

BEGIN;

-- 1. Identificar y arreglar Fechas de Ingreso (0025 -> 2026)
-- Sumamos 2001 años para pasar de 25 a 2026
UPDATE estadias
SET fecha_ingreso = fecha_ingreso + interval '2001 years'
WHERE EXTRACT(YEAR FROM fecha_ingreso) = 25;

-- 2. Identificar y arreglar Fechas de Egreso (0025 -> 2026)
UPDATE estadias
SET fecha_egreso_programada = fecha_egreso_programada + interval '2001 years'
WHERE EXTRACT(YEAR FROM fecha_egreso_programada) = 25;

-- 3. Por si acaso hay alguno en '0026' que deba ser 2026 (add 2000)
UPDATE estadias
SET fecha_ingreso = fecha_ingreso + interval '2000 years'
WHERE EXTRACT(YEAR FROM fecha_ingreso) = 26;

UPDATE estadias
SET fecha_egreso_programada = fecha_egreso_programada + interval '2000 years'
WHERE EXTRACT(YEAR FROM fecha_egreso_programada) = 26;


-- 4. Verificación:
SELECT id, celular_responsable, fecha_ingreso, fecha_egreso_programada 
FROM estadias 
WHERE celular_responsable = '3415040653';

COMMIT;
