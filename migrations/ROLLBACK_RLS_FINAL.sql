-- EMERGENCY ROLLBACK SCRIPT
-- Este script desactiva por completo la seguridad RLS (Row Level Security) que se activó recientemente.
-- Esto debe restaurar la visibilidad inmediata de los datos en Dashboard y Recepción.

BEGIN;

-- 1. Desactivar RLS en ACAMPANTES (Causa principal sospechosa)
ALTER TABLE acampantes DISABLE ROW LEVEL SECURITY;

-- 2. Desactivar RLS en ESTADIAS (Por precaución)
ALTER TABLE estadias DISABLE ROW LEVEL SECURITY;

-- 3. Garantizar permisos explícitos de lectura/escritura a todos los roles del sistema
GRANT ALL ON TABLE acampantes TO postgres;
GRANT ALL ON TABLE acampantes TO anon;
GRANT ALL ON TABLE acampantes TO authenticated;
GRANT ALL ON TABLE acampantes TO service_role;

GRANT ALL ON TABLE estadias TO postgres;
GRANT ALL ON TABLE estadias TO anon;
GRANT ALL ON TABLE estadias TO authenticated;
GRANT ALL ON TABLE estadias TO service_role;

COMMIT;
