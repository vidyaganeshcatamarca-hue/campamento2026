'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, VistaEstadiaConTotales, Acampante } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, CheckCircle, DollarSign, Calendar, AlertTriangle, Eye } from 'lucide-react';
import { formatCurrency, getNoonTimestamp, replaceTemplate, sendWhatsAppNotification } from '@/lib/utils';
import { MJE_DESPEDIDA } from '@/lib/mensajes';
import { enviarReciboPago } from '@/lib/whatsapp';
import { toast } from 'sonner';
import Cookies from 'js-cookie';

export default function CheckoutPage() {
    const router = useRouter();
    const params = useParams();
    const estadiaId = params.estadia_id as string;

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [estadia, setEstadia] = useState<VistaEstadiaConTotales | null>(null);
    const [responsable, setResponsable] = useState<Acampante | null>(null);
    const [parcelas, setParcelas] = useState<string[]>([]);

    // Fecha de salida
    const [fechaSalidaReal, setFechaSalidaReal] = useState('');

    // Ajuste Manual
    const [usarMontoManual, setUsarMontoManual] = useState(false);
    const [montoManual, setMontoManual] = useState(0);

    // Pago final
    const [montoPago, setMontoPago] = useState(0);
    const [metodoPago, setMetodoPago] = useState('Efectivo');

    // Auditor Role
    const [role, setRole] = useState<string>('invitado');
    const isAuditor = role === 'auditor';

    const [totalPagadoReal, setTotalPagadoReal] = useState(0);

    useEffect(() => {
        const session = Cookies.get('camp_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                setRole(parsed.role || 'invitado');
            } catch (e) {
                console.error("Error parsing session", e);
            }
        }
        fetchData();
    }, [estadiaId]);

    const fetchData = async () => {
        try {
            // 1. Estadía
            const { data: vista, error: vistaError } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('id', estadiaId)
                .single();

            if (vistaError) throw vistaError;
            setEstadia(vista);

            // 2. Responsable
            // Try to find marked responsible, otherwise fallback to any adult/first person
            const { data: acampantes, error: acampError } = await supabase
                .from('acampantes')
                .select('*')
                .eq('estadia_id', estadiaId);

            if (acampError) throw acampError;

            const resp = acampantes?.find(a => a.es_responsable_pago) || acampantes?.[0] || null;
            setResponsable(resp);

            // 3. Parcelas asignadas
            const { data: parcelasData } = await supabase
                .from('parcelas')
                .select('nombre_parcela')
                .eq('estadia_id', estadiaId);

            setParcelas(parcelasData?.map(p => p.nombre_parcela) || []);


            // 4. Fetch Pagos explicitly to ensure accuracy
            const { data: pagosData } = await supabase
                .from('pagos')
                .select('monto_abonado')
                .eq('estadia_id', estadiaId);

            const totalPagado = pagosData?.reduce((acc, curr) => acc + curr.monto_abonado, 0) || 0;
            setTotalPagadoReal(totalPagado);

            // Setear fecha de salida por defecto = hoy
            setFechaSalidaReal(new Date().toISOString().split('T')[0]);

        } catch (error) {
            console.error('Error al cargar datos:', error);
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const calcularAjuste = () => {
        if (!estadia || !fechaSalidaReal) return { diasReales: 0, diferenciaDias: 0, ajuste: 0, nuevoTotal: 0, nuevoSaldo: 0 };

        const fechaIngreso = new Date(estadia.fecha_ingreso || '');
        const fechaSalida = new Date(fechaSalidaReal + 'T12:00:00');

        // Días reales de estadía
        const diasReales = Math.max(1, Math.ceil(
            (fechaSalida.getTime() - fechaIngreso.getTime()) / (1000 * 60 * 60 * 24)
        ));

        const diasProgramados = estadia.dias_parcela;
        const diferenciaDias = diasReales - diasProgramados;

        // Ajuste Calculado vs Manual
        let ajuste = 0;

        if (usarMontoManual) {
            ajuste = montoManual;
        }

        // Nuevo total
        const nuevoTotal = estadia.monto_total_final + ajuste;
        const nuevoSaldo = nuevoTotal - totalPagadoReal;

        return {
            diasReales,
            diferenciaDias,
            ajuste,
            nuevoTotal,
            nuevoSaldo // Total - Real Paid Sum
        };
    };

    const handleCheckout = async () => {
        if (!estadia || !fechaSalidaReal) return;
        if (isAuditor) return;

        const calc = calcularAjuste();

        // Allow checkout even with pending balance

        setProcessing(true);
        try {
            const fechaSalidaObj = new Date(fechaSalidaReal);
            fechaSalidaObj.setHours(12, 0, 0, 0);
            const fechaSalidaNoon = fechaSalidaObj.toISOString();

            // 1. Registrar pago si hay monto
            if (montoPago > 0) {
                const { error: pagoError } = await supabase
                    .from('pagos')
                    .insert({
                        estadia_id: estadiaId,
                        monto_abonado: montoPago,
                        metodo_pago: metodoPago,
                    });

                if (pagoError) throw pagoError;
            }

            // Preparar update de estadía
            // IMPORTANTE: Actualizar el monto final con el ajuste
            const updatePayload: any = {
                fecha_egreso_real: fechaSalidaNoon,
                estado_estadia: 'finalizada',
                monto_final_a_pagar: calc.nuevoTotal // Persistir el ajuste en la columna correcta de la tabla
            };

            // Si hubo ajuste manual, dejar nota
            if (usarMontoManual) {
                const obsActual = (estadia as any).observaciones || '';
                updatePayload.observaciones = `${obsActual}\n[Checkout] Ajuste manual: ${formatCurrency(montoManual)}`;
            } else if (calc.ajuste !== 0) {
                const obsActual = (estadia as any).observaciones || '';
                updatePayload.observaciones = `${obsActual}\n[Checkout] Ajuste auto por días (${calc.diferenciaDias}): ${formatCurrency(calc.ajuste)}`;
            }

            // 2. Actualizar estadía
            const { error: estadiaError } = await supabase
                .from('estadias')
                .update(updatePayload)
                .eq('id', estadiaId);

            if (estadiaError) throw estadiaError;

            // 3. Liberar parcelas (Condicionalmente)
            if (estadia.parcela_asignada) {
                // Verificar si hay otras estadías ACTIVAS en esta misma parcela
                const { count: ocupantesResult, error: checkError } = await supabase
                    .from('estadias')
                    .select('*', { count: 'exact', head: true })
                    .eq('parcela_asignada', estadia.parcela_asignada)
                    .eq('estado_estadia', 'activa')
                    .neq('id', estadiaId); // Excluirnos a nosotros mismos

                if (checkError) console.error('Error verificando ocupación de parcela:', checkError);

                const otrosOcupantes = ocupantesResult || 0;

                if (otrosOcupantes === 0) {
                    // Si no hay nadie más, liberar la parcela
                    const { error: parcelasError } = await supabase
                        .from('parcelas')
                        .update({
                            estado: 'libre',
                            estadia_id: null,
                            cantidad_integrantes: 0 // Resetear contador si queda vacía
                        })
                        .eq('nombre_parcela', estadia.parcela_asignada);

                    if (parcelasError) throw parcelasError;
                } else {
                    // BUG B FIX: Si quedan otros, actualizar el contador al número real de ocupantes restantes
                    await supabase
                        .from('parcelas')
                        .update({
                            cantidad_integrantes: otrosOcupantes // Se ajusta al conteo real de activos
                        })
                        .eq('nombre_parcela', estadia.parcela_asignada);

                    console.log(`Parcela ${estadia.parcela_asignada} continúa ocupada por otras ${otrosOcupantes} estadías. Contador actualizado.`);
                }
            } else {
                // Fallback legacy por si no tenía parcela_asignada string pero sí vínculo ID (raro con nueva lógica)
                const { error: parcelasError } = await supabase
                    .from('parcelas')
                    .update({
                        estado: 'libre',
                        estadia_id: null
                    })
                    .eq('estadia_id', estadiaId);

                // Ignorar error si no encuentra, es legacy
                if (parcelasError && parcelasError.code !== 'PGRST116') console.error('Error cleanup legacy parcel:', parcelasError);
            }

            // 4. Enviar mensajes WhatsApp (No bloqueante para la redirección)
            try {
                if (responsable && estadia && estadia.celular_responsable) {
                    const telefono = estadia.celular_responsable.replace(/\D/g, '');

                    // Mensaje de recibo si hubo pago
                    if (montoPago > 0) {
                        await enviarReciboPago(
                            telefono,
                            responsable.nombre_completo,
                            montoPago,
                            calc.nuevoSaldo - montoPago,
                            metodoPago,
                            fechaSalidaReal // Pass actual checkout date
                        );
                    }

                    // Mensaje de despedida AUTOMÁTICO (Demorado 10 min)
                    const mensajeDespedida = replaceTemplate(MJE_DESPEDIDA, {
                        nombre_acampante: responsable.nombre_completo
                    });

                    // delayed 1 hour via n8n
                    await sendWhatsAppNotification({
                        telefonos: [telefono],
                        mensaje: mensajeDespedida,
                        tipo_mensaje: 'despedida',
                        delay: true,
                        tiempo: 3600 // 3600 segundos = 1 hora
                    });

                    toast.success('Check-out procesado. Mensaje de despedida programado.');
                }
            } catch (msgError) {
                console.error('Error enviando mensajes (Ignorado para redirección):', msgError);
                toast.warning('Check-out exitoso, pero falló el envío de mensajes.');
            }

            // Redirigir siempre si la BD se actualizó
            router.push('/dashboard');

        } catch (error: any) {
            console.error('Error en checkout:', error);
            // Mostrar error al usuario
            toast.error(`Error al procesar check-out: ${error.message || 'Error desconocido'}`);
            // No redirigir si falló la actualización de BD
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <p className="text-muted">Cargando...</p>
                </div>
            </Layout>
        );
    }

    if (!estadia || !responsable) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <p className="text-danger">Estadía no encontrada</p>
                </div>
            </Layout>
        );
    }

    const calc = calcularAjuste();
    const fechaMinima = new Date(estadia.fecha_ingreso || '').toISOString().split('T')[0];
    const fechaHoy = new Date().toISOString().split('T')[0];

    return (
        <Layout>
            <div className="space-y-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-primary">
                            Check-out
                        </h1>
                        <p className="text-muted text-sm mt-1">
                            {responsable.nombre_completo}
                        </p>
                    </div>
                    {isAuditor && (
                        <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-semibold border border-amber-200 ml-auto">
                            Modo Auditoría (Lectura)
                        </div>
                    )}
                </div>

                {/* Resumen de Estadía */}
                <Card>
                    <CardHeader>
                        <CardTitle>Resumen de Estadía</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted">Fecha de Ingreso:</p>
                                <p className="font-medium">
                                    {new Date(estadia.fecha_ingreso || '').toLocaleDateString('es-AR')}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted">Salida Programada:</p>
                                <p className="font-medium">
                                    {new Date(estadia.fecha_egreso_programada).toLocaleDateString('es-AR')}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted">Parcelas:</p>
                                <p className="font-medium">{parcelas.join(', ')}</p>
                            </div>
                            <div>
                                <p className="text-muted">Personas:</p>
                                <p className="font-medium">{estadia.cant_personas_total}</p>
                            </div>
                            <div>
                                <p className="text-muted">Días Programados:</p>
                                <p className="font-medium">{estadia.dias_parcela} días</p>
                            </div>
                            <div>
                                <p className="text-muted">Total Original:</p>
                                <p className="font-medium text-primary">{formatCurrency(estadia.monto_total_final)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Fecha Real de Salida */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Fecha Real de Salida
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input
                            label="Fecha de Salida"
                            type="date"
                            value={fechaSalidaReal}
                            onChange={(e) => setFechaSalidaReal(e.target.value)}
                            min={fechaMinima}
                            max={fechaHoy}
                            disabled={isAuditor}
                        />
                        <p className="text-xs text-muted mt-2">
                            Por defecto es hoy. Modifica si salió otro día.
                        </p>
                    </CardContent>
                </Card>

                {/* Ajuste de Costo (Manual o por Días) */}
                <Card className={`border-2 ${usarMontoManual ? 'border-primary' : (calc.ajuste > 0 ? 'border-accent' : (calc.ajuste < 0 ? 'border-green-500' : 'border-gray-200'))}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Ajuste / Devolución
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">

                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={usarMontoManual}
                                    onChange={(e) => {
                                        setUsarMontoManual(e.target.checked);
                                        if (e.target.checked) setMontoManual(calc.ajuste);
                                    }}
                                    className="rounded border-gray-300 w-4 h-4 text-primary focus:ring-primary"
                                    disabled={isAuditor}
                                />
                                Habilitar Ajuste Manual
                            </label>
                            {usarMontoManual && (
                                <Badge variant="info">Manual</Badge>
                            )}
                        </div>

                        {usarMontoManual ? (
                            <div className="bg-primary/5 p-4 rounded-lg space-y-4 border border-primary/20">
                                <Input
                                    label="Monto de Ajuste ($)"
                                    type="number"
                                    value={montoManual}
                                    onChange={(e) => setMontoManual(parseFloat(e.target.value) || 0)}
                                    disabled={isAuditor}
                                />
                                <div className="text-xs text-muted space-y-1">
                                    <p>• Valor <b>negativo</b> (ej: -5000): Devolución / Descuento (Reduce el total).</p>
                                    <p>• Valor <b>positivo</b> (ej: 5000): Cobro extra (Aumenta el total).</p>
                                </div>
                            </div>
                        ) : (
                            calc.diferenciaDias !== 0 ? (
                                <div className="bg-secondary/10 p-4 rounded-lg space-y-2">
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <span className="text-muted">Días reales:</span>
                                        <span className="text-right font-medium">{calc.diasReales} días</span>

                                        <span className="text-muted">Días programados:</span>
                                        <span className="text-right font-medium">{estadia.dias_parcela} días</span>

                                        <span className="text-muted">Diferencia:</span>
                                        <span className={`text-right font-semibold ${calc.diferenciaDias > 0 ? 'text-accent' : 'text-green-600'}`}>
                                            {calc.diferenciaDias > 0 ? '+' : ''}{calc.diferenciaDias} días
                                        </span>

                                        <span className="text-muted">Ajuste calculado:</span>
                                        <span className={`text-right font-semibold ${calc.ajuste > 0 ? 'text-accent' : 'text-green-600'}`}>
                                            {calc.ajuste > 0 ? '+' : ''}{formatCurrency(calc.ajuste)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 text-center text-muted text-sm bg-gray-50 rounded">
                                    No hay diferencias de días ni ajustes automáticos.
                                </div>
                            )
                        )}

                        <div className="border-t pt-3">
                            <div className="grid grid-cols-2 gap-2 text-lg font-bold">
                                <span>Nuevo Total:</span>
                                <span className="text-right text-primary">
                                    {formatCurrency(calc.nuevoTotal)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Saldo Final */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            Liquidación Final
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-accent/10 p-4 rounded-lg">
                            <p className="text-sm text-muted">Saldo Pendiente:</p>
                            <p className={`text-3xl font-bold ${calc.nuevoSaldo > 0 ? 'text-danger' : 'text-green-600'}`}>
                                {formatCurrency(calc.nuevoSaldo)}
                            </p>
                        </div>

                        {calc.nuevoSaldo > 0 && (
                            <div className="space-y-3">
                                <Input
                                    label="Monto a Pagar ($)"
                                    type="number"
                                    value={montoPago || ''}
                                    onChange={(e) => setMontoPago(parseFloat(e.target.value) || 0)}
                                    min={0}
                                    step={0.01}
                                    disabled={isAuditor}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Método de Pago
                                    </label>
                                    <select
                                        value={metodoPago}
                                        onChange={(e) => setMetodoPago(e.target.value)}
                                        className="input"
                                        disabled={isAuditor}
                                    >
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Transferencia">Transferencia</option>
                                        <option value="Mercado Pago">Mercado Pago</option>
                                    </select>
                                </div>

                                {montoPago > 0 && (
                                    <div className="bg-secondary/10 p-3 rounded text-sm">
                                        <p className="text-muted">Saldo restante después del pago:</p>
                                        <p className="text-lg font-semibold">
                                            {formatCurrency(calc.nuevoSaldo - montoPago)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Botón de Checkout */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        className="flex-1"
                    >
                        Cancelar
                    </Button>
                    {!isAuditor ? (
                        <Button
                            variant="primary"
                            onClick={handleCheckout}
                            disabled={processing}
                            className="flex-1"
                        >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            {processing ? 'Procesando...' : 'Confirmar Check-out'}
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            disabled
                            className="flex-1 flex items-center justify-center gap-2 opacity-75 cursor-not-allowed"
                        >
                            <Eye className="w-5 h-5" />
                            Modo Solo Lectura
                        </Button>
                    )}
                </div>

                {/* Advertencia */}
                <Card className="border-2 border-yellow-500 bg-yellow-50">
                    <CardContent className="pt-6">
                        <p className="text-yellow-800 font-medium text-sm">
                            ⚠ El check-out marcará la estadía como finalizada y liberará las parcelas. Esta acción no se puede deshacer fácilmente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
