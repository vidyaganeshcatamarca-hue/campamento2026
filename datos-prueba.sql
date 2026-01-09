-- Script para popular datos iniciales de prueba en Supabase

-- 1. Configuración de Precios
INSERT INTO precios_config (clave, valor_por_dia) VALUES
('persona', 5000.00),
('parcela', 3000.00),
('silla', 500.00),
('mesa', 800.00),
('auto', 2000.00),
('moto', 1000.00)
ON CONFLICT (clave) DO UPDATE SET valor_por_dia = EXCLUDED.valor_por_dia;

-- 2. Crear Parcelas (20 parcelas de ejemplo)
INSERT INTO parcelas (nombre_parcela, estado) VALUES
('A1', 'libre'),
('A2', 'libre'),
('A3', 'libre'),
('B1', 'libre'),
('B2', 'libre'),
('B3', 'libre'),
('C1', 'libre'),
('C2', 'libre'),
('C3', 'libre'),
('D1', 'libre'),
('D2', 'libre'),
('D3', 'libre'),
('E1', 'libre'),
('E2', 'libre'),
('E3', 'libre'),
('F1', 'libre'),
('F2', 'libre'),
('F3', 'libre'),
('G1', 'libre'),
('G2', 'libre')
ON CONFLICT DO NOTHING;

-- 3. Estadía de prueba pendiente de check-in
-- Esta simula una familia que llenó el Google Form
INSERT INTO estadias (
    celular_responsable,
    fecha_ingreso,
    fecha_egreso_programada,
    cant_personas_total,
    cant_parcelas_total,
    cant_sillas_total,
    cant_mesas_total,
    tipo_vehiculo,
    acumulado_noches_persona,
    estado_estadia,
    ingreso_confirmado
) VALUES (
    '1234567890',
    '2026-01-10T12:00:00-03:00',
    '2026-01-15T12:00:00-03:00',
    3,
    1,
    4,
    1,
    'auto',
    15, -- 3 personas x 5 noches
    'activa',
    FALSE
);

-- 4. Acampante responsable (pendiente de check-in)
INSERT INTO acampantes (
    celular,
    nombre_completo,
    dni_pasaporte,
    edad,
    grupo_sanguineo,
    es_persona_riesgo,
    es_responsable_pago,
    celular_responsable,
    obra_social,
    enfermedades,
    alergias,
    medicacion,
    tratamiento,
    contacto_emergencia,
    fecha_salida_individual,
    estadia_id
) VALUES (
    '1234567890',
    'Juan Pérez',
    '12345678',
    35,
    'O+',
    FALSE,
    TRUE,
    '1234567890',
    'OSDE',
    'Ninguna',
    'Ninguna',
    'Ninguna',
    'No',
    'María López - 0987654321',
    '2026-01-15T12:00:00-03:00',
    (SELECT id FROM estadias WHERE celular_responsable = '1234567890' LIMIT 1)
);

-- 5. Otros integrantes del grupo
INSERT INTO acampantes (
    celular,
    nombre_completo,
    edad,
    es_persona_riesgo,
    es_responsable_pago,
    celular_responsable,
    fecha_salida_individual,
    estadia_id
) VALUES 
(
    '1234567891',
    'Ana Pérez',
    30,
    FALSE,
    FALSE,
    '1234567890',
    '2026-01-15T12:00:00-03:00',
    (SELECT id FROM estadias WHERE celular_responsable = '1234567890' LIMIT 1)
),
(
    '1234567892',
    'Carlos Pérez',
    8,
    FALSE,
    FALSE,
    '1234567890',
    '2026-01-15T12:00:00-03:00',
    (SELECT id FROM estadias WHERE celular_responsable = '1234567890' LIMIT 1)
);

-- 6. Persona con riesgo médico (para probar alertas)
INSERT INTO estadias (
    celular_responsable,
    fecha_ingreso,
    fecha_egreso_programada,
    cant_personas_total,
    cant_parcelas_total,
    acumulado_noches_persona,
    estado_estadia,
    ingreso_confirmado
) VALUES (
    '9876543210',
    '2026-01-12T12:00:00-03:00',
    '2026-01-14T12:00:00-03:00',
    1,
    1,
    2,
    'activa',
    FALSE
);

INSERT INTO acampantes (
    celular,
    nombre_completo,
    edad,
    es_persona_riesgo,
    es_responsable_pago,
    celular_responsable,
    enfermedades,
    medicacion,
    contacto_emergencia,
    fecha_salida_individual,
    estadia_id
) VALUES (
    '9876543210',
    'Roberto González (Diabético)',
    72,
    TRUE,
    TRUE,
    '9876543210',
    'Diabetes tipo 2',
    'Metformina 850mg',
    'Patricia González - 1122334455',
    '2026-01-14T12:00:00-03:00',
    (SELECT id FROM estadias WHERE celular_responsable = '9876543210' LIMIT 1)
);
