// Funciones auxiliares para Liquidación
import { supabase } from '@/lib/supabase';

export interface AcampanteReasign {
    nombre_completo: string;
    celular: string; // Primary Key
    es_responsable_pago: boolean;
}

export interface EstadiaActiva {
    id: string;
    celular_responsable: string;
}

/**
 * Carga todos los acampantes de una estadía
 */
export async function cargarAcampantes(estadiaId: string) {
    const { data, error } = await supabase
        .from('acampantes')
        .select('*')
        .eq('estadia_id', estadiaId)
        .order('es_responsable_pago', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Carga estadías activas para reasignación (excluyendo la actual)
 */
export async function cargarEstadiasActivas(estadiaIdActual: string) {
    const { data, error } = await supabase
        .from('vista_estadias_con_totales')
        .select('id, celular_responsable')
        .eq('estado_estadia', 'activa')
        .neq('id', estadiaIdActual);

    if (error) throw error;
    return data || [];
}

/**
 * Reasigna un acampante de una estadía a otra
 */
export async function reasignarAcampante(
    acompanteCelular: string,
    nuevoResponsableCelular: string,
    estadiaDestinoId: string
) {
    const { error } = await supabase
        .from('acampantes')
        .update({
            es_responsable_pago: false,
            celular_responsable: nuevoResponsableCelular,
            estadia_id: estadiaDestinoId
        })
        .eq('celular', acompanteCelular);

    if (error) throw error;
}

/**
 * Procesa el pago inicial en liquidación
 */
export async function procesarPagoInicial(params: {
    estadiaId: string;
    montoAbonar: number;
    metodoPago: string;
    responsableNombre: string;
    descuentoEspecial: number;
    vistaEstadia: any;
    fechaPromesa: string;
}) {
    const { estadiaId, montoAbonar, metodoPago, responsableNombre, descuentoEspecial, vistaEstadia, fechaPromesa } = params;

    // 1. Registrar pago
    const { error: pagoError } = await supabase
        .from('pagos')
        .insert({
            estadia_id: estadiaId,
            monto_abonado: montoAbonar,
            metodo_pago: metodoPago,
            responsable_nombre: responsableNombre,
            monto_total: vistaEstadia.monto_total_final - descuentoEspecial
        });

    if (pagoError) throw pagoError;

    // 2. Calcular nuevo saldo
    const nuevoSaldo = (vistaEstadia.monto_total_final - descuentoEspecial - montoAbonar);

    // 3. Asignar parcelas desde localStorage
    const parcelasSeleccionadasStr = localStorage.getItem(`parcelas_${estadiaId}`);
    if (parcelasSeleccionadasStr) {
        const parcelasSeleccionadas = JSON.parse(parcelasSeleccionadasStr);

        for (const parcelaId of parcelasSeleccionadas) {
            await supabase
                .from('parcelas')
                .update({
                    estado: 'ocupada',
                    estadia_id: estadiaId
                })
                .eq('id', parcelaId);
        }

        localStorage.removeItem(`parcelas_${estadiaId}`);
    }

    // 4. Marcar ingreso confirmado y estado activo
    await supabase
        .from('estadias')
        .update({
            ingreso_confirmado: true,
            estado_estadia: 'activa',
            fecha_promesa_pago: nuevoSaldo > 0 && fechaPromesa ? fechaPromesa : null
        })
        .eq('id', estadiaId);

    return nuevoSaldo;
}
