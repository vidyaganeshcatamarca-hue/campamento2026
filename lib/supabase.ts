import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// TypeScript types based on your Supabase schema
export interface Acampante {
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
    estado?: 'libre' | 'ocupada' | 'mantenimiento';
    estadia_id?: string;
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
    fecha_ingreso?: string;
    fecha_egreso_programada: string;
    cant_personas_total?: number;
    cant_parcelas_total?: number;
    cant_sillas_total?: number;
    cant_mesas_total?: number;
    tipo_vehiculo?: string;
    descuento_arbitrario?: number;
    acumulado_noches_persona?: number;
    dias_parcela_total: number;
    p_persona: number;
    p_parcela: number;
    p_silla: number;
    p_mesa: number;
    p_vehiculo: number;
    monto_total_calculado: number;
    saldo_pendiente: number;
}
