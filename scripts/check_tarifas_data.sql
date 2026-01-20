-- DIAGNOSTICO: Ver contenido real de tarifas_historial
SELECT id, categoria, monto, fecha_desde, fecha_hasta 
FROM tarifas_historial 
ORDER BY categoria, fecha_desde;
