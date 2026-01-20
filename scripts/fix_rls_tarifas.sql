-- FIX RLS: Permitir lectura pública de tarifas_historial
-- Esto soluciona el problema donde los precios devuelven null/0 porque el usuario no tiene permiso de ver la tabla.

BEGIN;

-- 1. Asegurarnos que RLS está activo (buena práctica)
ALTER TABLE tarifas_historial ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar política previa si existe (para evitar error de duplicado)
DROP POLICY IF EXISTS "policy_read_tarifas" ON tarifas_historial;

-- 3. Crear política permisiva de LECTURA para TODOS (autenticados y anónimos)
CREATE POLICY "policy_read_tarifas"
ON tarifas_historial
FOR SELECT
USING (true); -- 'true' significa que cualquiera puede ver todas las filas

COMMIT;
