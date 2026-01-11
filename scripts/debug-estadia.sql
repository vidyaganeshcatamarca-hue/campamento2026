-- Verificar datos de la vista para una estadía específica
-- Reemplaza 'ID_ESTADIA' con el ID real

SELECT 
    id,
    cant_personas_total,
    cant_parcelas_total,
    cant_camas,
    cant_parcelas_camping,
    acumulado_noches_persona,
    dias_parcela,
    p_persona,
    p_parcela,
    p_cama,
    monto_total_final
FROM vista_estadias_con_totales
WHERE id = '2da7b963-7b4f-48da-b036-633d18f9c96d';

-- También verificar las parcelas asignadas
SELECT nombre_parcela, estado 
FROM parcelas 
WHERE estadia_id = '2da7b963-7b4f-48da-b036-633d18f9c96d';
