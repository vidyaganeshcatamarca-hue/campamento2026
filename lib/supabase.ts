import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// TypeScript types based on your Supabase schema
export interface Acampante {
    id: string;
    celular: string;
    nombre_completo: string;
    dni_pasaporte?: string;
    es_persona_riesgo?: boolean;
    estadia_id?: string;
    celular_responsable?: string;
    es_responsable_pago?: boolean;
    created_at?: string;
    fecha_salida_individual?: string;
    obra_social?: string;
    enfermedades?: string;
    alergias?: string;
    medicacion?: string;
    tratamiento?: string;
    contacto_emergencia?: string;
    edad?: number;
    grupo_sanguineo?: string;
}

export interface Estadia {
    id: string;
    celular_responsable: string;
    fecha_ingreso?: string;
    fecha_egreso_programada: string;
    fecha_egreso_real?: string;
    cant_personas_total?: number;
    cant_parcelas_total?: number;
    cant_sillas_total?: number;
    cant_mesas_total?: number;
    costo_total_calculado?: number;
    descuento_arbitrario?: number;
    monto_final_a_pagar?: number;
    saldo_pendiente?: number;
    estado_estadia?: 'activa' | 'finalizada';
    created_at?: string;
    ingreso_confirmado?: boolean;
    tipo_vehiculo?: string;
    acumulado_noches_persona?: number;
    cant_vehiculos_total?: number;
    parcela_asignada?: string | null; // NUEVO: Nombre de la parcela asignada (ej: "A1", "CAMA-1")
    observaciones?: string; // Para auditoría y notas
}

export interface Pago {
    id: string;
    estadia_id?: string;
    monto_abonado: number;
    fecha_pago?: string;
    metodo_pago?: string;
}

export interface Parcela {
    id: number;
    nombre_parcela: string;
    estado?: 'libre' | 'ocupada' | 'mantenimiento' | 'reservada';
    estadia_id?: string; // DEPRECATED: Usar cantidad_integrantes
    cantidad_integrantes?: number; // NUEVO: Contador de personas en esta parcela
}

export interface PrecioConfig {
    id: number;
    clave: string;
    valor_por_dia: number;
    updated_at?: string;
}

export interface VisitaDiaria {
    id: string;
    nombre_completo: string;
    dni?: string;
    celular?: string;
    patente_vehiculo?: string;
    fecha_visita?: string;
    monto_pagado?: number;
    metodo_pago?: string;
    observaciones?: string;
    created_at?: string;
}

export interface VistaEstadiaConTotales {
    id: string;
    celular_responsable: string;
    fecha_ingreso: string | null;
    fecha_egreso_programada: string;
    cant_personas_total: number;
    cant_parcelas_total: number;
    cant_sillas_total: number;
    cant_mesas_total: number;
    estado_estadia: string;
    descuento_arbitrario: number;
    ingreso_confirmado: boolean;
    tipo_vehiculo: string | null;
    acumulado_noches_persona: number;
    dias_parcela: number; // Días que la parcela estuvo ocupada
    cant_camas: number;  // Nuevas camas de habitación
    cant_parcelas_camping: number;  // Parcelas de camping (sin camas)
    p_persona: number; // Precio unitario por persona/noche
    p_parcela: number; // Precio unitario por carpa/día
    p_cama: number;  // Nuevo precio de cama
    p_silla: number; // Precio unitario por silla/día
    p_mesa: number; // Precio unitario por mesa/día
    p_vehiculo: number; // Precio unitario por vehículo/día (0 si ninguno)
    monto_total_final: number; // Monto total calculado con descuento
    saldo_pendiente: number; // Monto total - pagos realizados
    parcela_asignada?: string | null; // Nombre de parcela/s asignada/s
    es_habitacion?: boolean; // NUEVO: Flag para distinguir precio cama
}
