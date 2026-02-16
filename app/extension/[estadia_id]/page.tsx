'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, VistaEstadiaConTotales, Acampante } from '@/lib/supabase';
import { enviarReciboPago } from '@/lib/whatsapp';
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

    // Group Extension State
    const [isGroupExtension, setIsGroupExtension] = useState(false);
    const [groupMembers, setGroupMembers] = useState<VistaEstadiaConTotales[]>([]);

    // Estados de Formulario
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cuenta'>('cuenta');
    const [montoAbonar, setMontoAbonar] = useState<number>(0);

    useEffect(() => {
        fetchData();
    }, [estadiaId]);

    const fetchData = async () => {
        try {
            // 1. Fetch Current Stay
            const { data: vista, error: vistaError } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('id', estadiaId)
                .single();

            if (vistaError) throw vistaError;
            setEstadia(vista);

            // 2. Fetch Responsible
            const { data: resp, error: respError } = await supabase
                .from('acampantes')
                .select('*')
                .eq('estadia_id', estadiaId)
                .eq('es_responsable_pago', true)
                .single();

            if (respError) throw respError;
            setResponsable(resp);

            // 3. Fetch Group Members (Same Responsible, Active)
            if (vista.celular_responsable) {
                const { data: groupData, error: groupError } = await supabase
                    .from('vista_estadias_con_totales')
                    .select('*')
                    .eq('celular_responsable', vista.celular_responsable)
                    .neq('estado_estadia', 'cancelada');

                if (!groupError && groupData && groupData.length > 1) {
                    setGroupMembers(groupData);
                    // Optional: Auto-check if user prefers
                    // setIsGroupExtension(true); 
                }
            }

            // Fix: Ensure we use the exact date string from DB
            const fechaEgreso = new Date(vista.fecha_egreso_programada);
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

    const calculateSingleCost = (stay: VistaEstadiaConTotales, newDateStr: string) => {
        const fechaEgresoNueva = new Date(newDateStr + 'T12:00:00');
        const fechaEgresoActual = new Date(stay.fecha_egreso_programada);
        const diffTime = fechaEgresoNueva.getTime() - fechaEgresoActual.getTime();
        const diasAdicionales = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diasAdicionales <= 0) return { dias: 0, cost: 0, daily: 0 };

        const assignedName = (stay.parcela_asignada || '').toLowerCase();
        const isHabitacionName = assignedName.includes('cama') || assignedName.includes('habitacion') || assignedName.includes('habitación');
        const isHabitacion = stay.cant_camas > 0 || (stay as any).es_habitacion || isHabitacionName;

        const costoPersonaDiario = isHabitacion
            ? (stay.cant_personas_total || 0) * stay.p_cama
            : (stay.cant_personas_total || 0) * stay.p_persona;

        const costoParcelaDiario = isHabitacion
            ? 0
            : (stay.cant_parcelas_total || 0) * stay.p_parcela;

        const hasVehicle = stay.tipo_vehiculo && stay.tipo_vehiculo.toLowerCase() !== 'ninguno';
        const vehiclePrice = stay.tipo_vehiculo?.toLowerCase().includes('moto')
            ? (stay.p_moto || 0)
            : (stay.p_vehiculo || 0);

        const costoExtrasDiario =
            (stay.cant_sillas_total || 0) * stay.p_silla +
            (stay.cant_mesas_total || 0) * stay.p_mesa +
            (hasVehicle ? vehiclePrice : 0);

        const dailyTotal = costoPersonaDiario + costoParcelaDiario + costoExtrasDiario;
        return {
            dias: diasAdicionales,
            cost: diasAdicionales * dailyTotal,
            daily: dailyTotal
        };
    };

    const calcularCostoExtension = () => {
        if (!estadia || !nuevaFecha) return null;

        let totalCost = 0;
        let mainDias = 0;

        // If Group Mode
        if (isGroupExtension && groupMembers.length > 0) {
            groupMembers.forEach(member => {
                const calc = calculateSingleCost(member, nuevaFecha);
                totalCost += calc.cost;
                if (member.id === estadiaId) mainDias = calc.dias; // Capture main stay days
            });
            // If main stay hasn't changed days (only others might), ensure we trigger
            const mainCalc = calculateSingleCost(estadia, nuevaFecha);
            mainDias = mainCalc.dias;
        } else {
            // Single Mode
            const calc = calculateSingleCost(estadia, nuevaFecha);
            totalCost = calc.cost;
            mainDias = calc.dias;
        }

        // Validation: Ensure at least the main stay is extending forward
        // (Or allow updating just other group members? For simplicity, we require the date > current main stay date)
        if (mainDias <= 0) return { diasAdicionales: 0, costoExtension: 0, puedeExtender: false };

        return {
            diasAdicionales: mainDias,
            costoExtension: totalCost,
            puedeExtender: true
        };
    };

    const handleConfirmar = async () => {
        if (!estadia || !nuevaFecha) return;
        const year = parseInt(nuevaFecha.split('-')[0]);
        if (year < 2024) {
            toast.error(`Fecha inválida: ${year}`);
            return;
        }

        const calculo = calcularCostoExtension();
        if (!calculo || !calculo.puedeExtender) return;

        setSaving(true);
        try {
            const targets = (isGroupExtension && groupMembers.length > 0) ? groupMembers : [estadia];
            console.log(`Extending ${targets.length} stays...`);

            // 1. Update ALL targets in parallel
            await Promise.all(targets.map(async (target) => {
                const targetCalc = calculateSingleCost(target, nuevaFecha);

                // Only update if days > 0 (or allow date change even if same day? Let's assume extension > 0)
                // Actually user might want to sync dates even if some stay was already longer?
                // Logic: Set ALL to new Release Date. Recalculate 'acumulado_noches' adding ONLY the diff.
                if (targetCalc.dias > 0) {
                    await supabase
                        .from('estadias')
                        .update({
                            fecha_egreso_programada: getNoonTimestamp(new Date(nuevaFecha + 'T12:00:00')),
                            acumulado_noches_persona: target.acumulado_noches_persona + targetCalc.dias
                        })
                        .eq('id', target.id);
                }
            }));


            // 2. Register Single Unified Payment
            // Linked to the Responsible's Stay (usually the current one, since we are in it)
            if (metodoPago !== 'cuenta' && montoAbonar > 0) {
                const { error: pagoError } = await supabase
                    .from('pagos')
                    .insert({
                        estadia_id: estadiaId, // Always link to the main responsible stay we are editing
                        monto_abonado: montoAbonar,
                        metodo_pago: metodoPago,
                        fecha_pago: new Date().toISOString()
                    });

                if (pagoError) throw pagoError;

                // 3. WhatsApp Receipt for Unified Amount
                if (responsable) {
                    const telefono = responsable.celular.replace(/\D/g, '');

                    // Recalculate Total Debt for Group if needed, or just current stay logic?
                    // Ideally we show the REAL total debt. 
                    // Let's approximate: Current Debt of Group + Extension Cost - Payment
                    let totalDeudaGrupo = 0;
                    targets.forEach(t => totalDeudaGrupo += t.saldo_pendiente); // This is OLD pending

                    // Add new extension cost
                    totalDeudaGrupo += calculo.costoExtension;

                    // Subtract Payment
                    const nuevoSaldo = totalDeudaGrupo - montoAbonar;

                    try {
                        await enviarReciboPago(
                            telefono,
                            responsable.nombre_completo,
                            montoAbonar,
                            nuevoSaldo,
                            metodoPago,
                            nuevaFecha // Pass new date
                        );
                        toast.success('Recibo enviado por WhatsApp');
                    } catch (waError) {
                        console.error('Error WA:', waError);
                    }
                }
            }

            toast.success(`Estadía${targets.length > 1 ? 's grupales' : ''} extendida correctamente`);
            router.push('/dashboard');

        } catch (error) {
            console.error('Error extending:', error);
            toast.error('Error al guardar cambios');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Layout><div className="text-center py-12">Cargando...</div></Layout>;
    if (!estadia) return <Layout><div className="text-center py-12">No encontrado</div></Layout>;

    const calculo = calcularCostoExtension();
    const fechaMinima = new Date(estadia.fecha_egreso_programada).toISOString().split('T')[0];
    const saldoActual = isGroupExtension
        ? groupMembers.reduce((acc, m) => acc + m.saldo_pendiente, 0)
        : estadia.saldo_pendiente;

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
                                    {/* Group Extension Checkbox */}
                                    {groupMembers.length > 1 && (
                                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                id="groupCheck"
                                                checked={isGroupExtension}
                                                onChange={(e) => setIsGroupExtension(e.target.checked)}
                                                className="mt-1 w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                                            />
                                            <label htmlFor="groupCheck" className="text-sm cursor-pointer">
                                                <span className="font-bold text-amber-900 block">Extender a todo el grupo</span>
                                                <span className="text-amber-700">Aplica a {groupMembers.length} estadías vinculadas</span>
                                            </label>
                                        </div>
                                    )}

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
                                                + {calculo.diasAdicionales} días adicionales (Base)
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
                                        {isGroupExtension && (
                                            <div className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">
                                                Aplicando a {groupMembers.length} Personas
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span>
                                                {isGroupExtension ? 'Costo Total Grupo' : `Días adicionales (${calculo.diasAdicionales}) x Costo Diario`}
                                            </span>
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
