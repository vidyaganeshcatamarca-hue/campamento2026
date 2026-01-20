-- DEBUG SCRIPT: Inspect Data for "Arregui Carina" Zero Balance Issue

-- 1. Check all available categories in tarifas_historial (Check for Case Sensitivity or extra spaces)
SELECT DISTINCT categoria, count(*) FROM tarifas_historial GROUP BY categoria;

-- 2. Inspect the stay for Arregui Carina
WITH target_stay AS (
    SELECT * FROM estadias 
    WHERE celular_responsable = '3415040653' -- From user screenshot
    LIMIT 1
)
SELECT 
    id, 
    celular_responsable, 
    fecha_ingreso, 
    fecha_egreso_programada, 
    tipo_vehiculo,
    cant_personas_total
FROM target_stay;

-- 3. Simulate the RPC logic for one day of this stay
WITH target_stay AS (
    SELECT * FROM estadias 
    WHERE celular_responsable = '3415040653' LIMIT 1
),
one_day AS (
    SELECT (fecha_ingreso AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date as dia
    FROM target_stay
)
SELECT 
    d.dia,
    -- Check Persona Price
    (SELECT monto FROM tarifas_historial 
     WHERE categoria = 'persona' 
     AND d.dia >= fecha_desde 
     AND (fecha_hasta IS NULL OR d.dia <= fecha_hasta)
    ) as precio_persona_raw,
    
    -- Check Vehicle Price
    (SELECT monto FROM tarifas_historial 
     WHERE categoria = (SELECT tipo_vehiculo FROM target_stay)
     AND d.dia >= fecha_desde 
     AND (fecha_hasta IS NULL OR d.dia <= fecha_hasta)
    ) as precio_vehiculo_raw
FROM one_day d;
