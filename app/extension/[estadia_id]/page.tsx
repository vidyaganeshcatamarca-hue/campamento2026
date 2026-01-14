'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, VistaEstadiaConTotales, Acampante } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Save, Calendar, TrendingUp, CreditCard, DollarSign } from 'lucide-react';
import { formatCurrency, getNoonTimestamp } from '@/lib/utils';
import { toast } from 'sonner';

export default function ExtensionPage() {
    const router = useRouter();
    const params = useParams();
    const estadiaId = params.estadia_id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [estadia, setEstadia] = useState<VistaEstadiaConTotales | null>(null);
    const [responsable, setResponsable] = useState<Acampante | null>(null);

    // Estados de Formulario
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cuenta'>('cuenta');
    const [montoAbonar, setMontoAbonar] = useState<number>(0);

    useEffect(() => {
        fetchData();
    }, [estadiaId]);

    const fetchData = async () => {
        try {
            const { data: vista, error: vistaError } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('id', estadiaId)
                .single();

            if (vistaError) throw vistaError;
            setEstadia(vista);

            const { data: resp, error: respError } = await supabase
                .from('acampantes')
                .select('*')
                .eq('estadia_id', estadiaId)
                .eq('es_responsable_pago', true)
                .single();

            if (respError) throw respError;
            setResponsable(resp);

            // Fix: Ensure we use the exact date string from DB, avoiding timezone shifts
            // Assuming fecha_egreso_programada is ISO string, we want the date part locally or as stored
            const fechaEgreso = new Date(vista.fecha_egreso_programada);
            // Adjust to local date string yyyy-mm-dd
            // Best way: use the string part if it matches, or force local
            const fechaString = new Date(fechaEgreso.getTime() + fechaEgreso.getTimezoneOffset() * 60000)
                .toISOString().split('T')[0];

            setNuevaFecha(fechaString);

        } catch (error) {
            console.error('Error al cargar datos:', error);
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const calcularCostoExtension = () => {
        if (!estadia || !nuevaFecha) return null;

        // Parse inputs as noon to avoid boundary issues
        const fechaEgresoNueva = new Date(nuevaFecha + 'T12:00:00');
        const fechaEgresoActual = new Date(estadia.fecha_egreso_programada);

        // Calculate difference in milliseconds
        const diffTime = fechaEgresoNueva.getTime() - fechaEgresoActual.getTime();
        // Convert to days (rounding up to ensure partial days count as 1 if logic dictates, though here diff should be exact days)
        const diasAdicionales = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diasAdicionales <= 0) return { diasAdicionales: 0, costoExtension: 0, costoDiarioTotal: 0, puedeExtender: false };

        // 1. Costo Persona Diario
        const costoPersonaDiario = (estadia.cant_camas > 0)
            ? (estadia.cant_personas_total || 0) * estadia.p_cama
            : (estadia.cant_personas_total || 0) * estadia.p_persona;

        // 2. Costo Parcela/Recursos Diario
        const isHabitacion = estadia.cant_camas > 0 || (estadia as any).es_habitacion;
        const costoParcelaDiario = isHabitacion
            ? 0 // Las habitaciones no cobran costo de parcela aparte
            : (estadia.cant_parcelas_total || 0) * estadia.p_parcela;

        // 3. Extras Diarios
        const costoExtrasDiario =
            (estadia.cant_sillas_total || 0) * estadia.p_silla +
            (estadia.cant_mesas_total || 0) * estadia.p_mesa +
            estadia.p_vehiculo;

        const costoDiarioTotal = costoPersonaDiario + costoParcelaDiario + costoExtrasDiario;
        const costoExtension = diasAdicionales * costoDiarioTotal;

        return {
            diasAdicionales,
            costoExtension,
            costoDiarioTotal,
            puedeExtender: true
        };
    };

    const handleConfirmar = async () => {
        if (!estadia || !nuevaFecha) return;
        const calculo = calcularCostoExtension();
        if (!calculo || !calculo.puedeExtender) return;

        setSaving(true);
        try {
            // 1. Actualizar Estadía (Fecha Egreso + Acumulado Noches)
            // IMPORTANTE: Sumar días adicionales al acumulado para que la Vista recalcule el total
            const { error: updateError } = await supabase
                .from('estadias')
                .update({
                    fecha_egreso_programada: getNoonTimestamp(new Date(nuevaFecha + 'T12:00:00')),
                    acumulado_noches_persona: estadia.acumulado_noches_persona + calculo.diasAdicionales
                })
                .eq('id', estadiaId);

            if (updateError) throw updateError;

            // 2. Registrar Pago (si corresponde)
            if (metodoPago !== 'cuenta' && montoAbonar > 0) {
                const { error: pagoError } = await supabase
                    .from('pagos')
                    .insert({
                        estadia_id: estadiaId,
                        monto_abonado: montoAbonar,
                        metodo_pago: metodoPago,
                        fecha_pago: new Date().toISOString() // TODO: check timezone if needed
                    });

                if (pagoError) throw pagoError;
            }

            toast.success('Estadía extendida correctamente');
            router.push('/dashboard');

        } catch (error) {
            console.error('Error al extender:', error);
            toast.error('Error al guardar cambios');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Layout><div className="text-center py-12">Cargando...</div></Layout>;
    if (!estadia) return <Layout><div className="text-center py-12">No encontrado</div></Layout>;

    const calculo = calcularCostoExtension();
    const fechaMinima = new Date(estadia.fecha_egreso_programada).toISOString().split('T')[0];
    const saldoActual = estadia.saldo_pendiente;
    const nuevoSaldoTotal = saldoActual + (calculo?.costoExtension || 0) - (metodoPago !== 'cuenta' ? montoAbonar : 0);

    return (
        <Layout>
            <div className="space-y-6 max-w-3xl mx-auto pb-20">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="outline" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Extender Estadía</h1>
                        <p className="text-muted text-sm">{responsable?.nombre_completo}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Columna Izquierda: Selección */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Nueva Fecha</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 border border-blue-100">
                                        <span className="block font-semibold">Egreso Programado Actual:</span>
                                        {new Date(estadia.fecha_egreso_programada).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium block mb-2">Seleccionar Nueva Fecha Salida</label>
                                        <input
                                            type="date"
                                            value={nuevaFecha}
                                            onChange={(e) => setNuevaFecha(e.target.value)}
                                            min={fechaMinima}
                                            className="input text-lg w-full"
                                        />
                                        {calculo?.puedeExtender && (
                                            <p className="text-sm text-green-600 font-medium mt-2">
                                                + {calculo.diasAdicionales} días adicionales
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {calculo?.puedeExtender && (
                            <Card className="border-2 border-primary/20 bg-primary/5">
                                <CardHeader>
                                    <CardTitle>Costo de Extensión</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Días adicionales ({calculo.diasAdicionales}) x Costo Diario</span>
                                            <span>{formatCurrency(calculo.costoExtension)}</span>
                                        </div>
                                        <div className="h-px bg-primary/20 my-2"></div>
                                        <div className="flex justify-between font-bold text-lg text-primary">
                                            <span>Total a Sumar</span>
                                            <span>{formatCurrency(calculo.costoExtension)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Columna Derecha: Pago y Confirmación */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Forma de Pago</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => { setMetodoPago('efectivo'); setMontoAbonar(calculo?.costoExtension || 0); }}
                                        className={cn(
                                            "p-3 border rounded-lg text-sm font-bold transition-all shadow-sm",
                                            metodoPago === 'efectivo'
                                                ? "bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300"
                                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                        )}
                                    >
                                        Efectivo
                                    </button>
                                    <button
                                        onClick={() => { setMetodoPago('transferencia'); setMontoAbonar(calculo?.costoExtension || 0); }}
                                        className={cn(
                                            "p-3 border rounded-lg text-sm font-bold transition-all shadow-sm",
                                            metodoPago === 'transferencia'
                                                ? "bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300"
                                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                        )}
                                    >
                                        Transfer
                                    </button>
                                    <button
                                        onClick={() => { setMetodoPago('cuenta'); setMontoAbonar(0); }}
                                        className={cn(
                                            "p-3 border rounded-lg text-sm font-bold transition-all shadow-sm",
                                            metodoPago === 'cuenta'
                                                ? "bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300"
                                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                        )}
                                    >
                                        A Cuenta
                                    </button>
                                </div>

                                {metodoPago !== 'cuenta' && (
                                    <div className="pt-2 animate-in slide-in-from-top-2">
                                        <label className="text-sm font-medium block mb-2">Monto a Abonar Ahora</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="number"
                                                value={montoAbonar}
                                                onChange={(e) => setMontoAbonar(Number(e.target.value))}
                                                className="input pl-9"
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Resumen Financiero</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between text-muted">
                                    <span>Saldo Pendiente Actual</span>
                                    <span>{formatCurrency(saldoActual)}</span>
                                </div>
                                <div className="flex justify-between text-primary font-medium">
                                    <span>+ Costo Extensión</span>
                                    <span>{formatCurrency(calculo?.costoExtension || 0)}</span>
                                </div>
                                {metodoPago !== 'cuenta' && (
                                    <div className="flex justify-between text-green-600 font-medium">
                                        <span>- Pago Inmediato</span>
                                        <span>{formatCurrency(montoAbonar)}</span>
                                    </div>
                                )}
                                <div className="h-px bg-gray-100 my-2"></div>
                                <div className={cn("flex justify-between font-bold text-lg", nuevoSaldoTotal > 0 ? "text-red-500" : "text-green-600")}>
                                    <span>Nuevo Saldo Final</span>
                                    <span>{formatCurrency(nuevoSaldoTotal)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Button
                            className="w-full h-12 text-lg"
                            disabled={saving || !calculo?.puedeExtender}
                            onClick={handleConfirmar}
                        >
                            <Save className="w-5 h-5 mr-2" />
                            {saving ? 'Procesando...' : 'Confirmar Extensión'}
                        </Button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function cn(...classes: (string | undefined | null | boolean)[]) {
    return classes.filter(Boolean).join(' ');
}
