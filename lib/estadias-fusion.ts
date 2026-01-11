import { supabase } from '@/lib/supabase';

export interface FusionInfo {
    debeFusionar: boolean;
    estadiaDestinoId: string;
    celularResponsable: string;
    responsableNombre: string;
    parcelaOcupadaId?: number;
}

/**
 * Fusiona dos estadías cuando comparten parcela
 * Mueve acampantes, suma recursos, cancela estadía vacía
 * 
 * @param estadiaOrigenId - ID de la estadía que se va a fusionar (persona entrante)
 * @param estadiaDestinoId - ID de la estadía destino (dueño de la parcela ocupada)
 * @param sinCarpa - Si true, la persona entrante no tiene carpa y solo se mueve el acampante
 */
export async function fusionarEstadias(
    estadiaOrigenId: string,
    estadiaDestinoId: string,
    sinCarpa: boolean = false
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Obtener datos de ambas estadías
        const { data: estadiaOrigen } = await supabase
            .from('estadias')
            .select('*')
            .eq('id', estadiaOrigenId)
            .single();

        const { data: estadiaDestino } = await supabase
            .from('estadias')
            .select('*')
            .eq('id', estadiaDestinoId)
            .single();

        if (!estadiaOrigen || !estadiaDestino) {
            return { success: false, error: 'No se encontraron las estadías' };
        }

        // 2. Mover todos los acampantes de origen a destino
        // Si la persona NO tiene carpa, solo la movemos sin hacer responsable
        const { error: moveError } = await supabase
            .from('acampantes')
            .update({
                estadia_id: estadiaDestinoId,
                celular_responsable: estadiaDestino.celular_responsable,
                es_responsable_pago: false // Siempre pasa a ser acompañante
            })
            .eq('estadia_id', estadiaOrigenId);

        if (moveError) throw moveError;

        // 3. Si la persona SÍ tiene carpa (fusión completa), SUMAR recursos
        if (!sinCarpa) {
            const recursosFinales = {
                cant_personas_total: (estadiaOrigen.cant_personas_total || 0) + (estadiaDestino.cant_personas_total || 0),
                cant_parcelas_total: (estadiaOrigen.cant_parcelas_total || 0) + (estadiaDestino.cant_parcelas_total || 0),
                cant_sillas_total: (estadiaOrigen.cant_sillas_total || 0) + (estadiaDestino.cant_sillas_total || 0),
                cant_mesas_total: (estadiaOrigen.cant_mesas_total || 0) + (estadiaDestino.cant_mesas_total || 0),
            };

            const { error: updateError } = await supabase
                .from('estadias')
                .update(recursosFinales)
                .eq('id', estadiaDestinoId);

            if (updateError) throw updateError;
        }

        // 4. Marcar estadía origen como cancelada
        const { error: cancelError } = await supabase
            .from('estadias')
            .update({ estado_estadia: 'cancelada' })
            .eq('id', estadiaOrigenId);

        if (cancelError) throw cancelError;

        return { success: true };

    } catch (error) {
        console.error('Error fusionando estadías:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}

/**
 * Asigna parcelas a una estadía
 * Si alguna parcela está ocupada y se confirma fusión, fusiona las estadías
 */
export async function asignarParcelas(
    estadiaId: string,
    parcelaIds: number[],
    fusionInfo?: FusionInfo,
    cantParcelas?: number
): Promise<{ success: boolean; error?: string; fusionada?: boolean }> {
    try {
        // Si hay que fusionar, hacerlo primero
        if (fusionInfo?.debeFusionar) {
            // Detectar si la persona NO tiene carpa (cant_parcelas_total = 0)
            const sinCarpa = cantParcelas === 0;

            const resultFusion = await fusionarEstadias(estadiaId, fusionInfo.estadiaDestinoId, sinCarpa);
            if (!resultFusion.success) {
                return resultFusion;
            }

            // Asignar parcelas a la estadía destino (fusionada)
            // Si la persona no tiene carpa, las parcelas libres que seleccionó se asignan a la estadía destino
            for (const parcelaId of parcelaIds) {
                await supabase
                    .from('parcelas')
                    .update({
                        estado: 'ocupada',
                        estadia_id: fusionInfo.estadiaDestinoId
                    })
                    .eq('id', parcelaId);
            }

            return { success: true, fusionada: true };
        }

        // Si no hay fusión, asignación normal
        for (const parcelaId of parcelaIds) {
            const { error } = await supabase
                .from('parcelas')
                .update({
                    estado: 'ocupada',
                    estadia_id: estadiaId
                })
                .eq('id', parcelaId);

            if (error) throw error;
        }

        return { success: true, fusionada: false };

    } catch (error) {
        console.error('Error asignando parcelas:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        };
    }
}
