-- SCRIPT DE LIMPIEZA: Eliminar tarifas duplicadas/basura
-- Mantiene solo la configuración correcta para el cambio de precios del 19 de enero.

BEGIN;

-- 1. Eliminar duplicados "infinitos" viejos de PERSONA que causan conflicto
-- Borramos los que empiezan en 2000 y NO tienen fecha de fin (esos son los que sobran, pues ya tenemos uno que termina el 18-01)
DELETE FROM tarifas_historial 
WHERE categoria = 'persona' 
AND fecha_desde = '2000-01-01' 
AND fecha_hasta IS NULL;

-- 2. Asegurar que queda el registro CORRECTO del precio viejo (si lo borramos por error arriba, lo recreamos)
-- El precio de $10.000 debe existir hasta el 18-01-2026
INSERT INTO tarifas_historial (categoria, monto, fecha_desde, fecha_hasta)
SELECT 'persona', 10000, '2000-01-01', '2026-01-18'
WHERE NOT EXISTS (
    SELECT 1 FROM tarifas_historial 
    WHERE categoria = 'persona' 
    AND fecha_hasta = '2026-01-18'
);

-- 3. Limpieza similar para otras categorías si fuera necesario (ej. 'cama habitacion')
-- Borramos duplicados infinitos de CAMA si existe uno acotado
DELETE FROM tarifas_historial 
WHERE categoria = 'cama habitacion' 
AND fecha_desde = '2000-01-01' 
AND fecha_hasta IS NULL
AND EXISTS (
    SELECT 1 FROM tarifas_historial 
    WHERE categoria = 'cama habitacion' 
    AND fecha_hasta IS NOT NULL
);

-- 4. Verificación Final de lo que queda para 'persona'
SELECT * FROM tarifas_historial WHERE categoria = 'persona' ORDER BY fecha_desde;

COMMIT;
