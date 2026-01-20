-- FIX DATA: Reparar años corruptos (0025 -> 2025)
-- El problema es que las fechas quedaron guardadas como año 25 d.C. en lugar de 2025.

BEGIN;

-- 1. Identificar y arreglar Fechas de Ingreso (Año < 1000)
UPDATE estadias
SET fecha_ingreso = fecha_ingreso + interval '2000 years'
WHERE EXTRACT(YEAR FROM fecha_ingreso) < 1000;

-- 2. Identificar y arreglar Fechas de Egreso (Año < 1000)
UPDATE estadias
SET fecha_egreso_programada = fecha_egreso_programada + interval '2000 years'
WHERE EXTRACT(YEAR FROM fecha_egreso_programada) < 1000;

-- 3. Verificación: Mostrar las filas corregidas (ahora deberían ser 2025/2026)
SELECT id, celular_responsable, fecha_ingreso, fecha_egreso_programada 
FROM estadias 
WHERE celular_responsable = '3415040653';

COMMIT;
