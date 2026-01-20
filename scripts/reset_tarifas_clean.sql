-- SCRIPT DE RESET COMPLETO: Tarifas Historial
-- ADVERTENCIA: Borra todo el contenido de 'tarifas_historial' y lo regenera limpio.

BEGIN;

-- 1. Borrar todo (Reset)
TRUNCATE TABLE tarifas_historial;

-- 2. Insertar configuración limpia y sin duplicados

-- A. CAMBIO DE PRECIOS (19 de Enero 2026)
-- Persona
INSERT INTO tarifas_historial (categoria, monto, fecha_desde, fecha_hasta) VALUES 
('persona', 10000, '2000-01-01', '2026-01-18'),
('persona', 5000,  '2026-01-19', NULL);

-- Cama Habitación (Asumiendo misma lógica de fechas que Persona)
INSERT INTO tarifas_historial (categoria, monto, fecha_desde, fecha_hasta) VALUES 
('cama habitacion', 40000, '2000-01-01', '2026-01-18'),
('cama habitacion', 25000, '2026-01-19', NULL);

-- B. PRECIOS FIJOS (Sin cambio registrado en fecha, vigentes desde el inicio)
-- Auto
INSERT INTO tarifas_historial (categoria, monto, fecha_desde, fecha_hasta) VALUES 
('auto', 500, '2000-01-01', NULL);

-- Moto
INSERT INTO tarifas_historial (categoria, monto, fecha_desde, fecha_hasta) VALUES 
('moto', 250, '2000-01-01', NULL);

-- Mesa
INSERT INTO tarifas_historial (categoria, monto, fecha_desde, fecha_hasta) VALUES 
('mesa', 1250, '2000-01-01', NULL);

-- Silla
INSERT INTO tarifas_historial (categoria, monto, fecha_desde, fecha_hasta) VALUES 
('silla', 1000, '2000-01-01', NULL);

-- Parcela (Camping) - Según tus datos actuales está en 0
INSERT INTO tarifas_historial (categoria, monto, fecha_desde, fecha_hasta) VALUES 
('parcela', 0, '2000-01-01', NULL);


-- 3. Verificación
SELECT * FROM tarifas_historial ORDER BY categoria, fecha_desde;

COMMIT;
