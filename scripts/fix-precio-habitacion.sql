-- Verificar y actualizar precio de habitación
-- Primero ver qué hay
SELECT * FROM precios_config WHERE clave LIKE '%cama%' OR clave LIKE '%habit%';

-- Si no existe, insertar
INSERT INTO precios_config (clave, valor_por_dia) 
VALUES ('cama habitacion', 40000.00)
ON CONFLICT (clave) 
DO UPDATE SET valor_por_dia = 40000.00;

-- Verificar que quedó bien
SELECT * FROM precios_config WHERE clave = 'cama habitacion';
