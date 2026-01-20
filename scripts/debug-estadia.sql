-- Script de diagnóstico para ver qué días se están generando
-- Reemplaza 'ESTADIA_ID_AQUI' con el ID real de la estadía de María Juliana

WITH estadia_test AS (
    SELECT 
        id,
        fecha_ingreso,
        fecha_egreso_programada,
        cant_personas_total,
        celular_responsable
    FROM estadias 
    WHERE celular_responsable = '2914297683' -- María Juliana
    LIMIT 1
),
dias_generados AS (
    SELECT 
        e.id,
        generate_series(
            e.fecha_ingreso::timestamp, 
            (e.fecha_egreso_programada - interval '1 day')::timestamp, 
            '1 day'
        )::date as dia
    FROM estadia_test e
),
dias_con_precio AS (
    SELECT 
        d.dia,
        (SELECT monto FROM tarifas_historial 
         WHERE categoria = 'persona' 
         AND d.dia >= fecha_desde 
         AND (fecha_hasta IS NULL OR d.dia <= fecha_hasta) 
         ORDER BY fecha_desde DESC 
         LIMIT 1) as precio_dia,
        (SELECT fecha_desde FROM tarifas_historial 
         WHERE categoria = 'persona' 
         AND d.dia >= fecha_desde 
         AND (fecha_hasta IS NULL OR d.dia <= fecha_hasta) 
         ORDER BY fecha_desde DESC 
         LIMIT 1) as precio_desde,
        (SELECT fecha_hasta FROM tarifas_historial 
         WHERE categoria = 'persona' 
         AND d.dia >= fecha_desde 
         AND (fecha_hasta IS NULL OR d.dia <= fecha_hasta) 
         ORDER BY fecha_desde DESC 
         LIMIT 1) as precio_hasta
    FROM dias_generados d
)
SELECT 
    dia,
    precio_dia,
    precio_desde,
    precio_hasta,
    CASE 
        WHEN precio_dia = 10000 THEN 'PRECIO VIEJO'
        WHEN precio_dia = 5000 THEN 'PRECIO NUEVO'
        ELSE 'ERROR'
    END as cual_precio
FROM dias_con_precio
ORDER BY dia;

-- También mostrar el conteo
SELECT 
    CASE 
        WHEN precio_dia = 10000 THEN 'PRECIO VIEJO ($10k)'
        WHEN precio_dia = 5000 THEN 'PRECIO NUEVO ($5k)'
        ELSE 'ERROR'
    END as tipo_precio,
    COUNT(*) as cantidad_dias,
    SUM(precio_dia) as total_sin_personas
FROM (
    SELECT 
        d.dia,
        (SELECT monto FROM tarifas_historial 
         WHERE categoria = 'persona' 
         AND d.dia >= fecha_desde 
         AND (fecha_hasta IS NULL OR d.dia <= fecha_hasta) 
         ORDER BY fecha_desde DESC 
         LIMIT 1) as precio_dia
    FROM (
        SELECT 
            generate_series(
                e.fecha_ingreso::timestamp, 
                (e.fecha_egreso_programada - interval '1 day')::timestamp, 
                '1 day'
            )::date as dia
        FROM estadia_test e
    ) d
) dias_con_precio
GROUP BY tipo_precio;
