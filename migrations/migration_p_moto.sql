-- MIGRACIÓN: AGREGAR P_MOTO A LA VISTA
-- Propósito: Permitir que el frontend diferencie el precio de auto y moto.

DROP VIEW IF EXISTS public.vista_estadias_con_totales CASCADE;

CREATE OR REPLACE VIEW public.vista_estadias_con_totales AS
WITH desglose_diario AS (
    SELECT 
        e.id as estadia_id,
        generate_series(e.fecha_ingreso::timestamp, (e.fecha_egreso_programada - interval '1 day')::timestamp, '1 day')::date as dia_ocupacion,
        e.tipo_vehiculo,
        e.cant_personas_total,
        e.cant_parcelas_total,
        e.cant_sillas_total,
        e.cant_mesas_total,
        e.acumulado_noches_persona,
        e.parcela_asignada,
        CASE 
            WHEN e.parcela_asignada IS NOT NULL AND LOWER(e.parcela_asignada) LIKE '%cama%' THEN true 
            ELSE false 
        END as es_habitacion
    FROM estadias e
    WHERE e.fecha_egreso_programada > e.fecha_ingreso
),
costos_diarios AS (
    SELECT 
        d.estadia_id,
        d.dia_ocupacion,
        
        -- 1. Costo Base (Persona o Cama)
        CASE 
            WHEN d.es_habitacion THEN 
                (COALESCE((
                    SELECT monto FROM tarifas_historial 
                    WHERE categoria = 'cama habitacion' 
                    AND d.dia_ocupacion >= fecha_desde 
                    AND (fecha_hasta IS NULL OR d.dia_ocupacion <= fecha_hasta) 
                    ORDER BY fecha_desde DESC 
                    LIMIT 1
                ), 0) * d.cant_personas_total)
            ELSE 
                (COALESCE((
                    SELECT monto FROM tarifas_historial 
                    WHERE categoria = 'persona' 
                    AND d.dia_ocupacion >= fecha_desde 
                    AND (fecha_hasta IS NULL OR d.dia_ocupacion <= fecha_hasta) 
                    ORDER BY fecha_desde DESC 
                    LIMIT 1
                ), 0) * d.cant_personas_total)
        END as costo_base_dia,

        -- 2. Costo Parcela (Solo Camping)
        CASE 
            WHEN d.es_habitacion THEN 0
            ELSE 
                (COALESCE((
                    SELECT monto FROM tarifas_historial 
                    WHERE categoria = 'parcela' 
                    AND d.dia_ocupacion >= fecha_desde 
                    AND (fecha_hasta IS NULL OR d.dia_ocupacion <= fecha_hasta) 
                    ORDER BY fecha_desde DESC 
                    LIMIT 1
                ), 0) * d.cant_parcelas_total)
        END as costo_parcela_dia,

        -- 3. Costo Extras
        (COALESCE((
            SELECT monto FROM tarifas_historial 
            WHERE categoria = 'silla' 
            AND d.dia_ocupacion >= fecha_desde 
            AND (fecha_hasta IS NULL OR d.dia_ocupacion <= fecha_hasta) 
            ORDER BY fecha_desde DESC 
            LIMIT 1
        ), 0) * d.cant_sillas_total) as costo_silla_dia,
        
        (COALESCE((
            SELECT monto FROM tarifas_historial 
            WHERE categoria = 'mesa' 
            AND d.dia_ocupacion >= fecha_desde 
            AND (fecha_hasta IS NULL OR d.dia_ocupacion <= fecha_hasta) 
            ORDER BY fecha_desde DESC 
            LIMIT 1
        ), 0) * d.cant_mesas_total) as costo_mesa_dia,
        
        CASE 
            WHEN d.tipo_vehiculo IS NOT NULL AND LOWER(d.tipo_vehiculo) LIKE '%moto%' THEN COALESCE((
                SELECT monto FROM tarifas_historial 
                WHERE categoria = 'moto' 
                AND d.dia_ocupacion >= fecha_desde 
                AND (fecha_hasta IS NULL OR d.dia_ocupacion <= fecha_hasta) 
                ORDER BY fecha_desde DESC 
                LIMIT 1
            ), 0)
            WHEN d.tipo_vehiculo IS NOT NULL AND LENGTH(TRIM(d.tipo_vehiculo)) > 0 AND LOWER(d.tipo_vehiculo) <> 'ninguno' THEN COALESCE((
                SELECT monto FROM tarifas_historial 
                WHERE categoria = 'auto' 
                AND d.dia_ocupacion >= fecha_desde 
                AND (fecha_hasta IS NULL OR d.dia_ocupacion <= fecha_hasta) 
                ORDER BY fecha_desde DESC 
                LIMIT 1
            ), 0)
            ELSE 0
        END as costo_vehiculo_dia
    FROM desglose_diario d
),
suma_costos AS (
    SELECT 
        estadia_id,
        SUM(costo_base_dia + costo_parcela_dia + costo_silla_dia + costo_mesa_dia + costo_vehiculo_dia) as monto_total_bruto
    FROM costos_diarios
    GROUP BY estadia_id
),
estadia_base AS (
    SELECT e.*,
        GREATEST(EXTRACT(DAY FROM (e.fecha_egreso_programada - e.fecha_ingreso)), 1) as dias_parcela,
        CASE 
            WHEN e.parcela_asignada IS NOT NULL AND LOWER(e.parcela_asignada) LIKE '%cama%' THEN true 
            ELSE false 
        END as es_habitacion
    FROM estadias e
),
pagos_totales AS (
    SELECT estadia_id, COALESCE(SUM(monto_abonado), 0) as total_pagado FROM pagos GROUP BY estadia_id
)
SELECT 
    e.id,
    e.celular_responsable,
    e.fecha_ingreso,
    e.fecha_egreso_programada,
    e.cant_personas_total,
    e.cant_parcelas_total,
    e.cant_sillas_total,
    e.cant_mesas_total,
    e.estado_estadia,
    e.descuento_arbitrario,
    e.ingreso_confirmado,
    e.tipo_vehiculo,
    e.acumulado_noches_persona,
    e.parcela_asignada,
    e.dias_parcela,
    e.es_habitacion,
    -- Precios unitarios referenciales
    COALESCE((SELECT monto FROM tarifas_historial WHERE categoria = 'persona' AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE) ORDER BY fecha_desde DESC LIMIT 1), 0) as p_persona,
    COALESCE((SELECT monto FROM tarifas_historial WHERE categoria = 'parcela' AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE) ORDER BY fecha_desde DESC LIMIT 1), 0) as p_parcela,
    COALESCE((SELECT monto FROM tarifas_historial WHERE categoria = 'cama habitacion' AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE) ORDER BY fecha_desde DESC LIMIT 1), 0) as p_cama,
    COALESCE((SELECT monto FROM tarifas_historial WHERE categoria = 'silla' AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE) ORDER BY fecha_desde DESC LIMIT 1), 0) as p_silla,
    COALESCE((SELECT monto FROM tarifas_historial WHERE categoria = 'mesa' AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE) ORDER BY fecha_desde DESC LIMIT 1), 0) as p_mesa,
    -- P_VEHICULO (Auto)
    COALESCE((SELECT monto FROM tarifas_historial WHERE categoria = 'auto' AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE) ORDER BY fecha_desde DESC LIMIT 1), 0) as p_vehiculo,
    -- P_MOTO
    COALESCE((SELECT monto FROM tarifas_historial WHERE categoria = 'moto' AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE) ORDER BY fecha_desde DESC LIMIT 1), 0) as p_moto,
    
    -- Totales Finales
    (COALESCE(sc.monto_total_bruto, 0) - COALESCE(e.descuento_arbitrario, 0)) as monto_total_final,
    (COALESCE(sc.monto_total_bruto, 0) - COALESCE(e.descuento_arbitrario, 0)) - COALESCE(pt.total_pagado, 0) as saldo_pendiente

FROM estadia_base e
LEFT JOIN suma_costos sc ON e.id = sc.estadia_id
LEFT JOIN pagos_totales pt ON e.id = pt.estadia_id;
