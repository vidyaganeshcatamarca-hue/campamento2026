-- SCRIPT DE EMERGENCIA: RESTAURAR VISTA SIMPLIFICADA
-- Al parecer la versión "VERIFICADA" tenía lógica compleja que no coincide con tus datos actuales.
-- Esta versión "actualizada" es más simple y debería restaurar los saldos a la normalidad.

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
        
        -- Días que la parcela estuvo ocupada (mínimo 1 día)
        GREATEST(EXTRACT(DAY FROM (e.fecha_egreso_programada - e.fecha_ingreso)), 1) as dias_parcela,
        
        -- Precios unitarios
        (SELECT valor_por_dia FROM precios_config WHERE clave = 'persona') as p_persona,
        (SELECT valor_por_dia FROM precios_config WHERE clave = 'parcela') as p_parcela,
        (SELECT valor_por_dia FROM precios_config WHERE clave = 'silla') as p_silla,
        (SELECT valor_por_dia FROM precios_config WHERE clave = 'mesa') as p_mesa,
        COALESCE(
            CASE 
                WHEN e.tipo_vehiculo = 'auto' THEN (SELECT valor_por_dia FROM precios_config WHERE clave = 'auto')
                WHEN e.tipo_vehiculo = 'moto' THEN (SELECT valor_por_dia FROM precios_config WHERE clave = 'moto')
                ELSE 0 
            END, 0
        ) as p_vehiculo,
        
        -- Dummy columns to match interface if needed by TS types (VistaEstadiaConTotales interface expects these)
        0 as cant_camas,
        0 as cant_parcelas_camping,
        0 as p_cama,
        e.parcela_asignada
        
    FROM estadias e
),
calculo_monto AS (
    SELECT 
        *,
        -- CÁLCULO SIMPLIFICADO ORIGINAL:
        -- (Noches acumuladas * precio persona) + (Días * costo recursos)
        (
            (COALESCE(acumulado_noches_persona, 0) * p_persona) + 
            (dias_parcela * (
                (COALESCE(cant_parcelas_total, 0) * p_parcela) + 
                (COALESCE(cant_sillas_total, 0) * p_silla) + 
                (COALESCE(cant_mesas_total, 0) * p_mesa) + 
                p_vehiculo
            ))
        ) - COALESCE(descuento_arbitrario, 0) as monto_total_final
    FROM pre_calculo
)
SELECT 
    id,
    celular_responsable,
    fecha_ingreso,
    fecha_egreso_programada,
    cant_personas_total,
    cant_parcelas_total,
    cant_sillas_total,
    cant_mesas_total,
    estado_estadia,
    descuento_arbitrario,
    ingreso_confirmado,
    tipo_vehiculo,
    acumulado_noches_persona,
    dias_parcela,
    
    -- Campos extras para compatibilidad
    cant_camas,
    cant_parcelas_camping,
    p_persona,
    p_parcela,
    p_cama,
    p_silla,
    p_mesa,
    p_vehiculo,
    
    monto_total_final,
    
    -- Saldo pendiente
    monto_total_final - COALESCE(
        (SELECT SUM(monto_abonado) FROM pagos WHERE estadia_id = id), 0
    ) as saldo_pendiente,
    parcela_asignada,
    false as es_habitacion -- Default false
    
FROM calculo_monto;
