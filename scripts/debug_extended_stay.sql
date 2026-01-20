-- DIAGNOSTICO PROFUNDO: Estadia Extendida (Arregui Carina)
-- Buscamos entender por qué el precio da 0.

-- 1. Ver la data cruda de la estadía (fechas corruptas? año 2025?)
SELECT 
    id, 
    celular_responsable, 
    fecha_ingreso, 
    fecha_egreso_programada, 
    EXTRACT(YEAR FROM fecha_ingreso) as año_ingreso,
    estado_estadia, 
    cant_personas_total as personas_db,
    tipo_vehiculo
FROM estadias 
WHERE celular_responsable = '3415040653'; -- ID de la captura pantalla

-- 2. Simulación Manual de Precios (Cruzar fechas con la tabla de precios REAL)
WITH target_estadia AS (
    SELECT * FROM estadias WHERE celular_responsable = '3415040653' LIMIT 1
),
dias_generados AS (
    SELECT 
        (e.fecha_ingreso AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date as dia_inicio_arg,
        generate_series(
            (e.fecha_ingreso AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
            ((e.fecha_egreso_programada AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - interval '1 day')::date,
            '1 day'
        )::date as dia_serie
    FROM target_estadia e
)
SELECT 
    d.dia_serie,
    -- Buscar precio 'persona' para este día
    (SELECT monto FROM tarifas_historial 
     WHERE LOWER(categoria) = 'persona' 
     AND d.dia_serie >= fecha_desde 
     AND (fecha_hasta IS NULL OR d.dia_serie <= fecha_hasta)
     ORDER BY fecha_desde DESC LIMIT 1
    ) as precio_encontrado,
    -- Ver qué rangos existen para 'persona'
    (SELECT string_agg(fecha_desde || '->' || COALESCE(fecha_hasta::text, '∞') || ' ($' || monto || ')', ' | ') 
     FROM tarifas_historial WHERE LOWER(categoria) = 'persona') as rangos_disponibles
FROM dias_generados d;
