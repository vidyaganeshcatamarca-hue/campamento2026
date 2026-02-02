-- CORRECCIÓN QUIRÚRGICA DE SALDO
-- ID: 1484f1a7-e13d-4bf7-8a65-8e38a3642533
-- Responsable: Maria Laura Adorno Jacquet
-- Problema: Tiene 'cant_personas_total' = 1, pero pagó por más personas.
-- Solución: Actualizar la cantidad de personas a 4 (estimado por el saldo negativo de 75k / 25k por persona = 3 personas extra).

UPDATE estadias
SET cant_personas_total = 4
WHERE id = '1484f1a7-e13d-4bf7-8a65-8e38a3642533';

-- Verificar el resultado después de update
SELECT id, celular_responsable, cant_personas_total, saldo_pendiente 
FROM vista_estadias_con_totales 
WHERE id = '1484f1a7-e13d-4bf7-8a65-8e38a3642533';
