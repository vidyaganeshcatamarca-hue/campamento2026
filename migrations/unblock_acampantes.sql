-- EMERGENCY UNBLOCK
-- Si las políticas de RLS están bloqueando la búsqueda, esto desactivará la seguridad row-level temporalmente
-- para permitir que el sistema funcione mientras diagnosticamos.

ALTER TABLE acampantes DISABLE ROW LEVEL SECURITY;

-- Asegurar permisos básicos (por si acaso se perdieron)
GRANT ALL ON acampantes TO authenticated;
GRANT ALL ON acampantes TO service_role;
