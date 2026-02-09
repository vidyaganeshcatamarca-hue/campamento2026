-- Script de Diagnóstico para Pagos y Transferencias

-- 1. Contar cuántos pagos hay por cada método (para ver cómo está escrito "transferencia")
SELECT metodo_pago, COUNT(*) as cantidad
FROM pagos
GROUP BY metodo_pago;

-- 2. Ver si existen pagos de tipo transferencia con recibo pendiente
SELECT id, monto_abonado, metodo_pago, recibo_emitido, fecha_pago, estadia_id
FROM pagos
WHERE metodo_pago ILIKE '%transferencia%' 
  AND (recibo_emitido IS NULL OR recibo_emitido = false)
LIMIT 10;

-- 3. Chequear si esos pagos tienen una estadía válida (si el JOIN falla)
SELECT p.id as pago_id, p.metodo_pago, e.id as estadia_id_en_tabla_estadias
FROM pagos p
LEFT JOIN estadias e ON p.estadia_id = e.id
WHERE p.metodo_pago ILIKE '%transferencia%'
  AND (p.recibo_emitido IS NULL OR p.recibo_emitido = false)
  AND e.id IS NULL; -- Si esto devuelve filas, tenemos pagos huérfanos sin estadía
