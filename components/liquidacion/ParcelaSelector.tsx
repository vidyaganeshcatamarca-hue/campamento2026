'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Eye, EyeOff, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Parcela {
    id: number;
    nombre_parcela: string;
    estado: 'disponible' | 'ocupada';
    estadia_id?: string;
    responsable_nombre?: string;
    celular_responsable?: string;
    cant_personas?: number;
}

interface ParcelaSelectorProps {
    estadiaId: string;
    cantParcelas: number;
    onParcelasSeleccionadas: (parcelaIds: number[], fusionInfo?: any) => void;
}

export function ParcelaSelector({ estadiaId, cantParcelas, onParcelasSeleccionadas }: ParcelaSelectorProps) {
    const [parcelas, setParcelas] = useState<Parcela[]>([]);
    const [showOcupadas, setShowOcupadas] = useState(false);
    const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [parcelaConflicto, setParcelaConflicto] = useState<Parcela | null>(null);

    useEffect(() => {
        cargarParcelas();
    }, []);

    const cargarParcelas = async () => {
        try {
            // Cargar todas las parcelas con información de ocupación
            const { data, error } = await supabase
                .from('parcelas')
                .select(`
                    id,
                    nombre_parcela,
                    estado,
                    estadia_id,
                    estadias!inner (
                        celular_responsable,
                        cant_personas_total
                    ),
                    acampantes!inner (
                        nombre_completo,
                        es_responsable_pago
                    )
                `)
                .order('nombre_parcela');

            if (error) throw error;

            const parcelasFormateadas = (data || []).map((p: any) => ({
                id: p.id,
                nombre_parcela: p.nombre_parcela,
                estado: p.estado,
                estadia_id: p.estadia_id,
                celular_responsable: p.estadias?.celular_responsable,
                cant_personas: p.estadias?.cant_personas_total,
                responsable_nombre: p.acampantes?.find((a: any) => a.es_responsable_pago)?.nombre_completo
            }));

            setParcelas(parcelasFormateadas);
        } catch (error) {
            console.error('Error cargando parcelas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSeleccionParcela = (parcelaId: number, parcela: Parcela) => {
        // Si la parcela está ocupada y estamos intentando seleccionarla
        if (parcela.estado === 'ocupada' && !seleccionadas.includes(parcelaId)) {
            setParcelaConflicto(parcela);
            setShowConfirmModal(true);
            return;
        }

        // Toggle selección normal
        setSeleccionadas(prev => {
            if (prev.includes(parcelaId)) {
                return prev.filter(id => id !== parcelaId);
            }
            if (prev.length < cantParcelas) {
                return [...prev, parcelaId];
            }
            return prev;
        });
    };

    const confirmarAsignacionCompartida = () => {
        if (!parcelaConflicto) return;

        // Agregar a seleccionadas
        setSeleccionadas(prev => [...prev, parcelaConflicto.id]);

        // Pasar información de fusión
        onParcelasSeleccionadas(
            [...seleccionadas, parcelaConflicto.id],
            {
                debeFusionar: true,
                estadiaDestinoId: parcelaConflicto.estadia_id,
                celularResponsable: parcelaConflicto.celular_responsable,
                responsableNombre: parcelaConflicto.responsable_nombre
            }
        );

        setShowConfirmModal(false);
        setParcelaConflicto(null);
    };

    const parcelasFiltradas = parcelas.filter(p =>
        showOcupadas ? true : p.estado === 'disponible'
    );

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Seleccionar Parcelas ({seleccionadas.length}/{cantParcelas})</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowOcupadas(!showOcupadas)}
                        >
                            {showOcupadas ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                            {showOcupadas ? 'Ocultar' : 'Mostrar'} Ocupadas
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center text-muted py-4">Cargando parcelas...</p>
                    ) : (
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                            {parcelasFiltradas.map(parcela => {
                                const isSelected = seleccionadas.includes(parcela.id);
                                const isOcupada = parcela.estado === 'ocupada';

                                return (
                                    <button
                                        key={parcela.id}
                                        onClick={() => handleSeleccionParcela(parcela.id, parcela)}
                                        className={`
                                            p-4 rounded-lg border-2 transition-all text-center
                                            ${isSelected
                                                ? 'border-primary bg-primary/10'
                                                : isOcupada
                                                    ? 'border-amber-400 bg-amber-50 hover:border-amber-500'
                                                    : 'border-gray-200 hover:border-primary/50'
                                            }
                                        `}
                                    >
                                        <div className="font-bold text-lg">{parcela.nombre_parcela}</div>
                                        {isOcupada && (
                                            <div className="mt-2 space-y-1">
                                                <Badge variant="warning" className="text-xs">
                                                    <Users className="w-3 h-3 mr-1" />
                                                    {parcela.cant_personas} pers.
                                                </Badge>
                                                <p className="text-xs text-muted truncate">
                                                    {parcela.responsable_nombre}
                                                </p>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {seleccionadas.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm text-blue-800">
                                <strong>Parcelas seleccionadas:</strong> {seleccionadas.join(', ')}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de Confirmación para Parcela Compartida */}
            {showConfirmModal && parcelaConflicto && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowConfirmModal(false)}
                >
                    <div
                        className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-lg font-bold mb-2">Parcela Compartida</h3>
                                <p className="text-sm text-foreground">
                                    La parcela <strong>{parcelaConflicto.nombre_parcela}</strong> ya está asignada a:
                                </p>
                                <div className="mt-3 p-3 bg-gray-50 rounded border">
                                    <p className="font-medium">{parcelaConflicto.responsable_nombre}</p>
                                    <p className="text-sm text-muted">📱 {parcelaConflicto.celular_responsable}</p>
                                    <p className="text-xs text-muted mt-1">{parcelaConflicto.cant_personas} personas</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                            <p className="text-sm text-blue-800 font-medium mb-2">
                                Al asignar esta parcela se hará lo siguiente:
                            </p>
                            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                                <li>Fusionar estadías automáticamente</li>
                                <li>Mover acampantes al grupo del responsable</li>
                                <li>SUMAR todos los recursos (carpas, sillas, mesas, vehículos)</li>
                                <li>Mantener pagos individuales</li>
                            </ul>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={confirmarAsignacionCompartida}
                                variant="primary"
                                className="flex-1"
                            >
                                Sí, Compartir Parcela
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    setParcelaConflicto(null);
                                }}
                                variant="outline"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div >
            )
            }
        </>
    );
}
