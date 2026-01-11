-- ============================================
-- MÓDULOS 15 & 16: SISTEMA DE KIOSCO
-- ============================================

-- Tabla de productos del kiosco
CREATE TABLE IF NOT EXISTS productos_kiosco (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL UNIQUE,
    precio DECIMAL(10,2) NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de ventas del kiosco
CREATE TABLE IF NOT EXISTS kiosco_ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID REFERENCES productos_kiosco(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL,
    monto_total DECIMAL(10,2) NOT NULL,
    fecha_venta TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_kiosco_ventas_fecha ON kiosco_ventas(fecha_venta);
CREATE INDEX IF NOT EXISTS idx_kiosco_ventas_producto ON kiosco_ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_kiosco_activo ON productos_kiosco(activo) WHERE activo = true;

-- Poblar productos iniciales
INSERT INTO productos_kiosco (nombre, precio) VALUES
    ('Desayuno', 8000.00),
    ('Almuerzo', 15000.00),
    ('Cena', 15000.00),
    ('Sandwich', 7000.00),
    ('Ensalada de Fruta', 6000.00),
    ('Otros', 5000.00)
ON CONFLICT (nombre) DO NOTHING;

-- Vista para reporte de ventas diarias
CREATE OR REPLACE VIEW vista_ventas_kiosco_diarias AS
SELECT 
    DATE(fecha_venta) as fecha,
    pk.nombre as producto,
    SUM(kv.cantidad) as cantidad_vendida,
    SUM(kv.monto_total) as total_ventas
FROM kiosco_ventas kv
JOIN productos_kiosco pk ON kv.producto_id = pk.id
GROUP BY DATE(fecha_venta), pk.nombre, pk.id
ORDER BY fecha DESC, total_ventas DESC;

-- Vista para ranking de productos
CREATE OR REPLACE VIEW vista_productos_mas_vendidos AS
SELECT 
    pk.nombre as producto,
    SUM(kv.cantidad) as total_cantidad,
    SUM(kv.monto_total) as total_monto,
    COUNT(kv.id) as num_transacciones
FROM productos_kiosco pk
LEFT JOIN kiosco_ventas kv ON pk.id = kv.producto_id
WHERE pk.activo = true
GROUP BY pk.nombre, pk.id
ORDER BY total_cantidad DESC;

COMMENT ON TABLE productos_kiosco IS 'Catálogo de productos disponibles en el kiosco';
COMMENT ON TABLE kiosco_ventas IS 'Registro de todas las ventas realizadas en el kiosco';
COMMENT ON VIEW vista_ventas_kiosco_diarias IS 'Reporte agregado de ventas por día y producto';
COMMENT ON VIEW vista_productos_mas_vendidos IS 'Ranking de productos más vendidos de todos los tiempos';
