-- Enable RLS on acampantes if not already enabled
ALTER TABLE acampantes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to updates acampantes
-- This is needed for the Re-entry feature where we update estadia_id
DROP POLICY IF EXISTS "Permitir update a usuarios autenticados" ON acampantes;

CREATE POLICY "Permitir update a usuarios autenticados"
ON acampantes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure insert/select is also allowed
DROP POLICY IF EXISTS "Permitir select a usuarios autenticados" ON acampantes;
CREATE POLICY "Permitir select a usuarios autenticados"
ON acampantes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir insert a usuarios autenticados" ON acampantes;
CREATE POLICY "Permitir insert a usuarios autenticados"
ON acampantes
FOR INSERT
TO authenticated
WITH CHECK (true);
