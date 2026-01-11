'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, Users, Merge } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface EstadiaConAcampantes {
    id: string;
    celular_responsable: string;
    cant_personas_total: number;
    cant_parcelas_total: number;
    cant_sillas_total: number;
    cant_mesas_total: number;
    tipo_vehiculo: string;
    acampantes: Array<{
        id: string;
        nombre_completo: string;
        celular: string;
        es_responsable_pago: boolean;
    }>;
}

interface FusionEstadiasSelectorProps {
    estadiaActual: EstadiaConAcampantes;
    onFusionCompleta: () => void;
}

export function FusionEstadiasSelector({ estadiaActual, onFusionCompleta }: FusionEstadiasSelectorProps) {
    const [estadiasDisponibles, setEstadiasDisponibles] = useState<EstadiaConAcampantes[]>([]);
    const [loading, setLoading] = useState(false);
    const [fusionando, setFusionando] = useState(false);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        cargarEstadiasResponsables();
    }, []);

    const cargarEstadiasResponsables = async () => {
        setLoading(true);
        try {
            // Buscar estadías activas con responsables de pago
            const { data: estadias, error } = await supabase
                .from('estadias')
                .select(`
                    id,
                    celular_responsable,
                    cant_personas_total,
                    cant_parcelas_total,
                    cant_sillas_total,
                    cant_mesas_total,
                    tipo_vehiculo,
                    acampantes!inner (
                        id,
                        nombre_completo,
                        celular,
                        es_responsable_pago
                    )
                `)
                .eq('estado_estadia', 'activa')
                .eq('acampantes.es_responsable_pago', true)
                .neq('id', estadiaActual.id);

            if (error) throw error;
            setEstadiasDisponibles(estadias || []);
        } catch (error) {
            console.error('Error cargando estadías:', error);
        } finally {
            setLoading(false);
        }
    };

    const fusionarEstadias = async (estadiaDestinoId: string) => {
        setFusionando(true);
        try {
            const estadiaDestino = estadiasDisponibles.find(e => e.id === estadiaDestinoId);
            if (!estadiaDestino) return;

            // 1. Mover todos los acampantes de estadiaActual a estadiaDestino
            const { error: moveError } = await supabase
                .from('acampantes')
                .update({
                    estadia_id: estadiaDestinoId,
                    celular_responsable: estadiaDestino.celular_responsable,
                    es_responsable_pago: false // Todos pasan a ser acompañantes
                })
                .eq('estadia_id', estadiaActual.id);

            if (moveError) throw moveError;

            // 2. SUMAR recursos de ambas estadías
            const recursosFinales = {
                cant_personas_total: estadiaActual.cant_personas_total + estadiaDestino.cant_personas_total,
                cant_parcelas_total: estadiaActual.cant_parcelas_total + estadiaDestino.cant_parcelas_total,
                cant_sillas_total: estadiaActual.cant_sillas_total + estadiaDestino.cant_sillas_total,
                cant_mesas_total: estadiaActual.cant_mesas_total + estadiaDestino.cant_mesas_total,
                // Vehículos: contar cuántos hay en total
                // Si ambos tienen auto, ahora son 2 autos a cobrar (se refleja en el total)
            };

            const { error: updateError } = await supabase
                .from('estadias')
                .update(recursosFinales)
                .eq('id', estadiaDestinoId);

            if (updateError) throw updateError;

            // 3. Marcar estadía actual como cancelada (quedó vacía)
            const { error: cancelError } = await supabase
                .from('estadias')
                .update({ estado_estadia: 'cancelada' })
                .eq('id', estadiaActual.id);

            if (cancelError) throw cancelError;

            alert('✅ Estadías fusionadas exitosamente. Los recursos fueron sumados.');
            setShowModal(false);
            onFusionCompleta();

        } catch (error) {
            console.error('Error fusionando estadías:', error);
            alert('Error al fusionar. Intente nuevamente.');
        } finally {
            setFusionando(false);
        }
    };

    // Detectar si esta persona es responsable y posible duplicado
    const esResponsableActual = estadiaActual.acampantes.some(a => a.es_responsable_pago);
    const esPosibleDuplicado = esResponsableActual && estadiaActual.cant_personas_total === 1;

    if (!esPosibleDuplicado) return null;

    return (
        <>
            <Card className="border-2 border-amber-400 bg-amber-50/50">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <CardTitle className="text-amber-800">Posible Estadía Duplicada</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <p className="text-sm text-amber-800">
                            Esta persona se registró como <strong>responsable de pago</strong> pero podría
                            estar compartiendo carpa con otro grupo. Si es así, puedes fusionar esta estadía
                            con la del verdadero responsable.
                        </p>
                        <div className="bg-white border border-amber-300 rounded p-3 text-xs space-y-1">
                            <p className="font-medium text-amber-900">Al fusionar se hará lo siguiente:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                                <li>Mover acampantes a la estadía del responsable</li>
                                <li>Cambiar a "acompañante" (es_responsable_pago = false)</li>
                                <li><strong>SUMAR todos los recursos</strong> (carpas, sillas, mesas, vehículos)</li>
                                <li>Cancelar esta estadía duplicada</li>
                            </ul>
                        </div>
                        <Button
                            onClick={() => setShowModal(true)}
                            variant="primary"
                            className="w-full"
                        >
                            <Merge className="w-4 h-4 mr-2" />
                            Fusionar con Otra Estadía
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Modal de Selección */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold mb-2">Seleccionar Responsable del Grupo</h3>
                        <p className="text-sm text-muted mb-4">
                            ¿Con qué estadía (responsable) quieres fusionar este registro?
                        </p>

                        {loading ? (
                            <p className="text-center text-muted py-8">Cargando...</p>
                        ) : estadiasDisponibles.length === 0 ? (
                            <div className="bg-gray-50 border rounded p-4 text-center">
                                <p className="text-sm text-muted">No hay otras estadías activas disponibles</p>
                            </div>
                        ) : (
                            <div className="space-y-2 mb-4">
                                {estadiasDisponibles.map(estadia => (
                                    <button
                                        key={estadia.id}
                                        onClick={() => fusionarEstadias(estadia.id)}
                                        disabled={fusionando}
                                        className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition disabled:opacity-50"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <p className="font-medium text-primary">
                                                    📱 {estadia.celular_responsable}
                                                </p>
                                                {estadia.acampantes.map(a => (
                                                    <p key={a.id} className="text-sm text-muted mt-1">
                                                        {a.nombre_completo}
                                                    </p>
                                                ))}
                                                <div className="flex gap-2 mt-2">
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Users className="w-3 h-3 mr-1" />
                                                        {estadia.cant_personas_total} pers.
                                                    </Badge>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {estadia.cant_parcelas_total} carpas
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <Button
                            variant="outline"
                            onClick={() => setShowModal(false)}
                            disabled={fusionando}
                            className="w-full"
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
