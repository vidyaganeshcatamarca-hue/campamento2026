-- Debug de la Query exacta del Reporte
-- Reemplaza el INNER JOIN por LEFT JOIN para ver si son huérfanos
-- Y prueba la lógica OR para recibos pendientes

SELECT 
    p.id::TEXT as pago_id,
    p.monto_abonado,
    p.fecha_pago,
    p.metodo_pago,
    p.estadia_id::TEXT,
    COALESCE(p.recibo_emitido, false) as recibo_emitido,
    e.id as estadia_existe
FROM pagos p
LEFT JOIN estadias e ON p.estadia_id = e.id
WHERE 
    TRIM(p.metodo_pago) ILIKE 'transferencia'
    AND (
        COALESCE(p.recibo_emitido, false) = false
        OR 
        p.fecha_pago >= '2026-02-01'::DATE
    );
