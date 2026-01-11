-- Vista corregida con lógica de camas vs carpas
-- REGLAS DE NEGOCIO:
-- 1. Cama = 1 persona, precio incluye alojamiento (NO suma parcela)
-- 2. Carpa = precio persona + parcela
-- 3. Mixto: personas en carpa cobran (persona + parcela), personas en cama cobran (cama)

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
        
        -- Días que la parcela estuvo/estará ocupada
        GREATEST(EXTRACT(DAY FROM (e.fecha_egreso_programada - e.fecha_ingreso)), 1) as dias_parcela,
        
        -- Contar cuántas CAMAS tiene asignadas (habitación)
        (SELECT COUNT(*) FROM parcelas p 
         WHERE p.estadia_id = e.id 
         AND LOWER(p.nombre_parcela) LIKE '%cama%') as cant_camas,
        
        -- Contar cuántas PARCELAS DE CAMPING tiene (excluir camas)
        (SELECT COUNT(*) FROM parcelas p 
         WHERE p.estadia_id = e.id 
         AND LOWER(p.nombre_parcela) NOT LIKE '%cama%') as cant_parcelas_camping,
        
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
        -- FÓRMULA CORREGIDA CON INFERENCIA:
        -- Si cant_parcelas_total = 0 → está en habitación (inferir cant_camas)
        -- Si tiene camas asignadas O carpas = 0, NO cobrar personas separadas
        
        -- Inferir cantidad de camas si no tiene parcelas de camping
        CASE 
            WHEN cant_parcelas_camping = 0 AND cant_camas = 0 THEN cant_personas_total
            ELSE cant_camas
        END as cant_camas_final,
        
        (
            -- Personas en camping (solo si tiene parcelas de camping)
            (CASE 
                WHEN cant_parcelas_camping > 0 THEN 
                    -- Solo cobrar personas si HAY parcelas de camping
                    (COALESCE(acumulado_noches_persona, 0) * p_persona)
                ELSE 
                    -- Si NO hay parcelas de camping, NO cobrar por personas
                    -- (las personas están en habitación, precio incluido en cama)
                    0
            END) + 
            -- Parcelas de camping
            (dias_parcela * cant_parcelas_camping * p_parcela) +
            -- Camas de habitación (usar cant_camas_final inferida)
            (dias_parcela * 
                CASE 
                    WHEN cant_parcelas_camping = 0 AND cant_camas = 0 THEN cant_personas_total
                    ELSE cant_camas
                END 
            * p_cama) +
            -- Recursos compartidos
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
    cm.dias_parcela,
    cm.cant_camas,
    cm.cant_parcelas_camping,
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
