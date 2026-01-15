import { supabase } from './supabase';

export interface Reserva {
    id: string;
    parcela_id: number;
    fecha_inicio: string;
    fecha_fin: string;
    nombre_responsable: string;
    celular?: string;
    observaciones?: string;
    estado: 'pendiente' | 'confirmada' | 'cancelada';
}

export async function checkAvailability(parcelaId: number, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Check existing reservations
    const { data: reservas, error: resError } = await supabase
        .from('reservas')
        .select('*')
        .eq('parcela_id', parcelaId)
        .neq('estado', 'cancelada')
        .or(`fecha_inicio.lte.${endDate},fecha_fin.gte.${startDate}`);

    if (resError) throw resError;

    // Filter strictly logic in JS just to be safe (Supabase OR syntax can be tricky with ranges)
    const conflictingReservations = (reservas || []).filter(r => {
        const rStart = new Date(r.fecha_inicio);
        const rEnd = new Date(r.fecha_fin);
        return (start <= rEnd && end >= rStart);
    });

    if (conflictingReservations.length > 0) {
        return {
            available: false,
            reason: 'Reservada',
            conflict: conflictingReservations[0]
        };
    }

    // 2. Check active estadias (Occupied right now)
    // Need to find parcel name first to check estadias...
    const { data: parcela } = await supabase
        .from('parcelas')
        .select('nombre_parcela')
        .eq('id', parcelaId)
        .single();

    if (parcela) {
        // Find active estadias in this parcel
        // Note: Estadias store 'nombre_parcela' in 'parcela_asignada' (historically)
        const { data: estadias } = await supabase
            .from('estadias')
            .select('*')
            .eq('parcela_asignada', parcela.nombre_parcela)
            .eq('estado_estadia', 'activa')
            .neq('ingreso_confirmado', false); // Only real check-ins

        // Check date overlap with estadias
        const conflictingEstadias = (estadias || []).filter(e => {
            const eStart = new Date(e.fecha_ingreso);
            const eEnd = new Date(e.fecha_egreso_programada);
            return (start <= eEnd && end >= eStart);
        });

        if (conflictingEstadias.length > 0) {
            return {
                available: false,
                reason: 'Ocupada',
                conflict: conflictingEstadias[0]
            };
        }
    }

    return { available: true };
}
