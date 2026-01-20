'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Check, ArrowLeft, Plus, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Toaster, toast } from 'sonner';

export default function RecursosPage() {
    const params = useParams();
    const estadia_id = params?.estadia_id as string;
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [estadia, setEstadia] = useState<any>(null);
    const [precios, setPrecios] = useState<Record<string, number>>({});

    // Formulario Extras
    const [tipoRecurso, setTipoRecurso] = useState('silla');
    const [cantidad, setCantidad] = useState(1);
    const [dias, setDias] = useState(1);
    const [procesando, setProcesando] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. Cargar Estadía
            const { data: est, error } = await supabase
                .from('estadias')
                .select('*')
                .eq('id', estadia_id)
                .single();

            if (error) throw error;
            setEstadia(est);

            // 2. Cargar Precios (Ahora con Historial: Tomamos el vigente actual)
            const { data: preciosData } = await supabase
                .from('tarifas_historial')
                .select('categoria, monto, fecha_desde')
                .order('fecha_desde', { ascending: false }); // Traer los más recientes primero

            const preciosMap: Record<string, number> = {};
            // Al iterar sobre orden descendente, la primera vez que vemos una categoria es la más nueva -> vigente
            preciosData?.forEach(p => {
                if (preciosMap[p.categoria] === undefined) {
                    preciosMap[p.categoria] = p.monto;
                }
            });
            setPrecios(preciosMap);

        } catch (error) {
            console.error(error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const calcularCosto = () => {
        const precioUnitario = precios[tipoRecurso] || 0;
        return precioUnitario * cantidad * dias;
    };

    const handleAgregarCargo = async () => {
        if (!estadia_id) {
            toast.error('ID de estadía perdido. Recargue la página.');
            return;
        }
        const costo = calcularCosto();
        if (costo <= 0) {
            toast.error('El costo debe ser mayor a 0');
            return;
        }

        setProcesando(true);
        try {
            // "Hack" para sumar deuda sin tabla extra: Restar de descuento_arbitrario
            const descuentoActual = estadia.descuento_arbitrario || 0;
            const nuevoDescuento = descuentoActual - costo;

            // Agregar nota simple para auditoría visual rápida
            const nota = `[Recurso Extra] ${cantidad}x ${tipoRecurso.toUpperCase()} por ${dias} días ($${formatCurrency(costo)})`;
            const obsActual = estadia.observaciones || '';
            const nuevasObs = obsActual ? `${obsActual}\n${nota}` : nota;

            // Preparar nuevo objeto extra
            const nuevoRecursoExtra = {
                tipo: tipoRecurso,
                cantidad: cantidad,
                dias: dias,
                precio_unitario: precios[tipoRecurso] || 0,
                precio_total: costo,
                fecha: new Date().toISOString()
            };

            // Obtener array actual y sumar el nuevo
            const recursosExtrasActuales = estadia.recursos_extra || [];
            const nuevosRecursosExtras = [...recursosExtrasActuales, nuevoRecursoExtra];

            // Preparar update dinámico
            const updates: any = {
                descuento_arbitrario: nuevoDescuento, // Seguimos usándolo para el cobro monetario
                observaciones: nuevasObs,
                recursos_extra: nuevosRecursosExtras // Guardamos el array actualizado
            };

            const { error } = await supabase
                .from('estadias')
                .update(updates)
                .eq('id', estadia_id);

            if (error) {
                console.error('Supabase Error:', error);
                throw error;
            }

            toast.success('Recurso cargado y stock actualizado');

            // Recargar datos
            fetchData();
            // Reset form
            setCantidad(1);
            setDias(1);

        } catch (error: any) {
            console.error('Error detallado:', error);
            toast.error(`Error al cargar el recurso: ${error.message || 'Desconocido'}`);
        } finally {
            setProcesando(false);
        }
    };

    if (loading) return <Layout>Cargando...</Layout>;

    return (
        <Layout>
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header Nav */}
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver
                    </Button>
                    <h1 className="text-2xl font-bold text-primary">Gestión de Recursos</h1>
                </div>

                {/* Info Actual: Fijos y Extras */}
                <Card>
                    <CardHeader>
                        <CardTitle>Inventario de Recursos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Fijos (Base) */}
                        <div>
                            <p className="text-sm font-semibold text-muted mb-2 uppercase">Recursos Fijos (Toda la estadía)</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-gray-50 rounded">
                                    <p className="text-sm text-muted">Sillas</p>
                                    <p className="text-xl font-bold">{estadia.cant_sillas_total || 0}</p>
                                </div>
                                <div className="text-center p-3 bg-gray-50 rounded">
                                    <p className="text-sm text-muted">Mesas</p>
                                    <p className="text-xl font-bold">{estadia.cant_mesas_total || 0}</p>
                                </div>
                                <div className="text-center p-3 bg-gray-50 rounded">
                                    <p className="text-sm text-muted">Vehículo</p>
                                    <p className="text-lg font-bold capitalize">{estadia.tipo_vehiculo || 'Ninguno'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Extras (JSONB) */}
                        <div>
                            <p className="text-sm font-semibold text-muted mb-2 uppercase">Recursos Extra (Alquiler Temporal)</p>
                            {(!estadia.recursos_extra || estadia.recursos_extra.length === 0) ? (
                                <p className="text-sm text-muted italic">No hay recursos extra cargados.</p>
                            ) : (
                                <div className="space-y-2">
                                    {estadia.recursos_extra.map((extra: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center bg-blue-50 p-2 rounded border border-blue-100 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="info" className="bg-white">{extra.cantidad}x</Badge>
                                                <span className="font-medium capitalize">{extra.tipo}</span>
                                                <span className="text-muted text-xs">({extra.dias} días)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted">{new Date(extra.fecha).toLocaleDateString()}</span>
                                                <span className="font-bold text-primary">{formatCurrency(extra.precio_total)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Totales Extras */}
                                    <div className="pt-2 mt-2 border-t flex justify-end gap-4 text-sm font-medium">
                                        <span>Total Sillas Extra: {estadia.recursos_extra.filter((e: any) => e.tipo === 'silla').reduce((acc: number, cur: any) => acc + cur.cantidad, 0)}</span>
                                        <span>Total Mesas Extra: {estadia.recursos_extra.filter((e: any) => e.tipo === 'mesa').reduce((acc: number, cur: any) => acc + cur.cantidad, 0)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Formulario Extras */}
                <Card className="border-2 border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Agregar Alquiler Temporal
                        </CardTitle>
                        <p className="text-sm text-muted">
                            Suma un costo extra por alquiler de recursos por días específicos.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Recurso</label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={tipoRecurso}
                                    onChange={(e) => setTipoRecurso(e.target.value)}
                                >
                                    <option value="silla">Silla ({formatCurrency(precios['silla'] || 0)}/día)</option>
                                    <option value="mesa">Mesa ({formatCurrency(precios['mesa'] || 0)}/día)</option>
                                    <option value="auto">Vehículo ({formatCurrency(precios['auto'] || 0)}/día)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Cantidad</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={cantidad}
                                        onChange={(e) => setCantidad(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Días</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={dias}
                                        onChange={(e) => setDias(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Resumen Costo */}
                        <div className="bg-primary/5 p-4 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted">Costo Adicional</p>
                                <p className="text-2xl font-bold text-primary">
                                    {formatCurrency(calcularCosto())}
                                </p>
                            </div>
                            <Button
                                onClick={handleAgregarCargo}
                                disabled={procesando}
                                className="gap-2"
                            >
                                {procesando ? 'Procesando...' : (
                                    <>
                                        <DollarSign className="w-4 h-4" />
                                        Cargar a Cuenta
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                            <p>
                                Nota: Este cargo se agregará a la deuda total ("Saldo Pendiente") y quedará registrado en las observaciones de la estadía.
                            </p>
                        </div>

                    </CardContent>
                </Card>
            </div>
            <Toaster />
        </Layout>
    );
}
