-- Vista CORREGIDA con lógica simplificada
-- REGLAS DE NEGOCIO:
-- 1. Camping: precio_persona × noches + precio_parcela × días + extras
-- 2. Habitación: precio_cama × días + extras
-- 3. Los extras siempre se cobran: sillas, mesas, vehículo

DROP VIEW IF EXISTS vista_estadias_con_totales CASCADE;

CREATE VIEW vista_estadias_con_totales AS
WITH pre_calculo AS (
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
        
        -- Días que la parcela estuvo/estará ocupada
        GREATEST(EXTRACT(DAY FROM (e.fecha_egreso_programada - e.fecha_ingreso)), 1) as dias_parcela,
        
        -- Detectar si es habitación o camping según nombre de parcela asignada
        CASE 
            WHEN e.parcela_asignada IS NOT NULL AND LOWER(e.parcela_asignada) LIKE '%cama%' THEN true
            ELSE false
        END as es_habitacion,
        
        -- Precios unitarios desde config
        COALESCE((SELECT valor_por_dia FROM precios_config WHERE clave = 'persona'), 0) as p_persona,
        COALESCE((SELECT valor_por_dia FROM precios_config WHERE clave = 'parcela'), 0) as p_parcela,
        COALESCE((SELECT valor_por_dia FROM precios_config WHERE clave = 'cama habitacion'), 0) as p_cama,
        COALESCE((SELECT valor_por_dia FROM precios_config WHERE clave = 'silla'), 0) as p_silla,
        COALESCE((SELECT valor_por_dia FROM precios_config WHERE clave = 'mesa'), 0) as p_mesa,
        COALESCE((
            CASE 
                WHEN e.tipo_vehiculo = 'auto' THEN (SELECT valor_por_dia FROM precios_config WHERE clave = 'auto')
                WHEN e.tipo_vehiculo = 'moto' THEN (SELECT valor_por_dia FROM precios_config WHERE clave = 'moto')
                ELSE 0
            END
        ), 0) as p_vehiculo
    FROM estadias e
),
calculo_monto AS (
    SELECT 
        *,
        -- CÁLCULO CORREGIDO
        (
            -- OPCIÓN 1: HABITACIÓN/CAMA
            -- Solo cobrar precio de cama por días (NO cobrar personas aparte)
            CASE 
                WHEN es_habitacion THEN
                    (dias_parcela * cant_personas_total * p_cama)
                ELSE
                    -- OPCIÓN 2: CAMPING
                    -- Cobrar personas por noches + parcela por días
                    (COALESCE(acumulado_noches_persona, 0) * p_persona) +
                    (dias_parcela * COALESCE(cant_parcelas_total, 0) * p_parcela)
            END +
            -- Extras (siempre se cobran)
            (dias_parcela * (
                (COALESCE(cant_sillas_total, 0) * p_silla) + 
                (COALESCE(cant_mesas_total, 0) * p_mesa) + 
                p_vehiculo
            ))
        ) - COALESCE(descuento_arbitrario, 0) as monto_total_final
    FROM pre_calculo
),
pagos_totales AS (
    SELECT 
        estadia_id,
        COALESCE(SUM(monto_abonado), 0) as total_pagado
    FROM pagos
    GROUP BY estadia_id
)
SELECT 
    cm.id,
    cm.celular_responsable,
    cm.fecha_ingreso,
    cm.fecha_egreso_programada,
    cm.cant_personas_total,
    cm.cant_parcelas_total,
    cm.cant_sillas_total,
    cm.cant_mesas_total,
    cm.estado_estadia,
    cm.descuento_arbitrario,
    cm.ingreso_confirmado,
    cm.tipo_vehiculo,
    cm.acumulado_noches_persona,
    cm.parcela_asignada,
    cm.dias_parcela,
    cm.es_habitacion,
    cm.p_persona,
    cm.p_parcela,
    cm.p_cama,
    cm.p_silla,
    cm.p_mesa,
    cm.p_vehiculo,
    cm.monto_total_final,
    COALESCE(cm.monto_total_final - pt.total_pagado, cm.monto_total_final) as saldo_pendiente
FROM calculo_monto cm
LEFT JOIN pagos_totales pt ON cm.id = pt.estadia_id;
