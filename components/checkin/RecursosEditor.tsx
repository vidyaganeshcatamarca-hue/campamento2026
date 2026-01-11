'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RecursosEditorProps {
    estadiaId: string;
    recursos: {
        cant_parcelas_total: number;
        cant_sillas_total: number;
        cant_mesas_total: number;
        tipo_vehiculo: string;
    };
    cantPersonas: number;
    onActualizar: () => void;
}

export function RecursosEditor({ estadiaId, recursos, cantPersonas, onActualizar }: RecursosEditorProps) {
    const [editando, setEditando] = useState(false);
    const [carpas, setCarpas] = useState(recursos.cant_parcelas_total || 1);
    const [sillas, setSillas] = useState(recursos.cant_sillas_total || 0);
    const [mesas, setMesas] = useState(recursos.cant_mesas_total || 0);
    const [vehiculo, setVehiculo] = useState(recursos.tipo_vehiculo || 'ninguno');
    const [guardando, setGuardando] = useState(false);

    const handleGuardar = async () => {
        setGuardando(true);
        try {
            const { error } = await supabase
                .from('estadias')
                .update({
                    cant_parcelas_total: carpas,
                    cant_sillas_total: sillas,
                    cant_mesas_total: mesas,
                    tipo_vehiculo: vehiculo
                })
                .eq('id', estadiaId);

            if (error) throw error;

            setEditando(false);
            onActualizar();
        } catch (error) {
            console.error('Error actualizando recursos:', error);
            alert('Error al guardar. Intente nuevamente.');
        } finally {
            setGuardando(false);
        }
    };

    // Detectar posibles inconsistencias
    const posibleDuplicacion = cantPersonas > 1 && recursos.cant_parcelas_total >= cantPersonas;

    return (
        <Card className={posibleDuplicacion ? 'border-2 border-amber-400' : ''}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Recursos del Grupo</CardTitle>
                    {!editando && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditando(true)}
                        >
                            Editar Recursos
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {posibleDuplicacion && !editando && (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-medium text-amber-800">⚠️ Posible duplicación de recursos</p>
                            <p className="text-amber-700 mt-1">
                                Hay {cantPersonas} personas y {recursos.cant_parcelas_total} {recursos.cant_parcelas_total === 1 ? 'carpa' : 'carpas'}.
                                Si comparten carpa, corrige los valores usando el botón "Editar Recursos".
                            </p>
                            <p className="text-xs text-amber-600 mt-2 font-medium">
                                Regla: Carpas=MIN, Sillas/Mesas=SUMA, Vehículos=Mayor prioridad
                            </p>
                        </div>
                    </div>
                )}

                {editando ? (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800 mb-4">
                            <p className="font-medium mb-1">📋 Reglas de corrección:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li><strong>Carpas:</strong> Si comparten, usar el MÍNIMO (ej: ambos dijeron 1 → queda 1)</li>
                                <li><strong>Sillas/Mesas:</strong> SUMAR las de cada persona (ej: 2+3 → queda 5)</li>
                                <li><strong>Vehículos:</strong> Usar el de mayor prioridad (Auto &gt; Moto &gt; Ninguno)</li>
                            </ul>
                        </div>

                        <Input
                            label="Carpas/Parcelas *"
                            type="number"
                            value={carpas}
                            onChange={(e) => setCarpas(parseInt(e.target.value) || 0)}
                            min={1}
                        />

                        <Input
                            label="Sillas"
                            type="number"
                            value={sillas}
                            onChange={(e) => setSillas(parseInt(e.target.value) || 0)}
                            min={0}
                        />

                        <Input
                            label="Mesas"
                            type="number"
                            value={mesas}
                            onChange={(e) => setMesas(parseInt(e.target.value) || 0)}
                            min={0}
                        />

                        <div>
                            <label className="block text-sm font-medium mb-1">Vehículo</label>
                            <select
                                value={vehiculo}
                                onChange={(e) => setVehiculo(e.target.value)}
                                className="input"
                            >
                                <option value="ninguno">Ninguno</option>
                                <option value="moto">Moto</option>
                                <option value="auto">Auto</option>
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleGuardar}
                                disabled={guardando}
                                variant="primary"
                                className="flex-1"
                            >
                                {guardando ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                            <Button
                                onClick={() => {
                                    setCarpas(recursos.cant_parcelas_total || 1);
                                    setSillas(recursos.cant_sillas_total || 0);
                                    setMesas(recursos.cant_mesas_total || 0);
                                    setVehiculo(recursos.tipo_vehiculo || 'ninguno');
                                    setEditando(false);
                                }}
                                variant="outline"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted">Carpas</p>
                            <p className="text-xl font-bold">{recursos.cant_parcelas_total || 0}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted">Sillas</p>
                            <p className="text-xl font-bold">{recursos.cant_sillas_total || 0}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted">Mesas</p>
                            <p className="text-xl font-bold">{recursos.cant_mesas_total || 0}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted">Vehículo</p>
                            <p className="text-xl font-bold capitalize">{recursos.tipo_vehiculo || 'Ninguno'}</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
