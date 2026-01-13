'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, VistaEstadiaConTotales, Pago, Acampante } from '@/lib/supabase';
import { enviarReciboPago } from '@/lib/whatsapp';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, DollarSign, Receipt, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

export default function SaldoPage() {
    const router = useRouter();
    const params = useParams();
    const estadiaId = params.estadia_id as string;

    const [loading, setLoading] = useState(true);
    const [vistaEstadia, setVistaEstadia] = useState<VistaEstadiaConTotales | null>(null);
    const [pagos, setPagos] = useState<Pago[]>([]);
    const [responsable, setResponsable] = useState<Acampante | null>(null);

    // Estados para lógica grupal
    const [esGrupo, setEsGrupo] = useState(false);
    const [integrantesGrupo, setIntegrantesGrupo] = useState<VistaEstadiaConTotales[]>([]);

    const [montoPago, setMontoPago] = useState(0);
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [fechaPromesa, setFechaPromesa] = useState('');
    const [paying, setPaying] = useState(false);

    useEffect(() => {
        fetchData();
    }, [estadiaId]);

    const fetchData = async () => {
        try {
            // 1. Vista actual
            const { data: vista, error: vistaError } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('id', estadiaId)
                .single();

            if (vistaError) throw vistaError;
            setVistaEstadia(vista);

            // 2. Buscar Grupo (otras estadías con mismo responsable)
            const { data: grupo, error: grupoError } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('celular_responsable', vista.celular_responsable)
                .neq('estado_estadia', 'cancelada'); // Ignorar canceladas

            let pagosQueryId = [estadiaId]; // Por defecto solo busca pagos de esta estadía

            if (grupo && grupo.length > 1) {
                setEsGrupo(true);
                setIntegrantesGrupo(grupo);
                pagosQueryId = grupo.map(g => g.id); // Si es grupo, busca pagos de TODOS
                console.log("Modo Grupo Detectado:", grupo.length, "integrantes");
            }

            // 3. Pagos realizados (del grupo entero si aplica)
            const { data: pagosData, error: pagosError } = await supabase
                .from('pagos')
                .select('*')
                .in('estadia_id', pagosQueryId)
                .order('fecha_pago', { ascending: false });

            if (pagosError) throw pagosError;
            setPagos(pagosData || []);

            // 4. Responsable
            const { data: resp, error: respError } = await supabase
                .from('acampantes')
                .select('*')
                .eq('estadia_id', estadiaId)
                .eq('es_responsable_pago', true)
                .single();

            if (respError) throw respError;
            setResponsable(resp);

        } catch (error) {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar información de la estadía');
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handlePagar = async () => {
        if (montoPago <= 0) return;
        if (!vistaEstadia) return;

        // Recalcular saldo pendiente real antes de validar
        const totalGrupo = esGrupo ? integrantesGrupo.reduce((sum, g) => sum + g.monto_total_final, 0) : vistaEstadia.monto_total_final;
        const totalPagadoGrupo = pagos.reduce((sum, p) => sum + p.monto_abonado, 0);
        const deudaReal = totalGrupo - totalPagadoGrupo;

        if (montoPago > deudaReal + 1000) { // Pequeño margen por redondeo
            alert("El monto supera la deuda pendiente");
            return;
        }

        setPaying(true);
        try {
            const { error } = await supabase
                .from('pagos')
                .insert({
                    estadia_id: estadiaId,
                    monto_abonado: montoPago,
                    metodo_pago: metodoPago,
                });

            if (error) throw error;

            // Actualizar fecha promesa (si aplica cambio de estado, opcional)
            const nuevoSaldo = deudaReal - montoPago;
            if (nuevoSaldo > 0 && fechaPromesa) {
                await supabase
                    .from('estadias')
                    .update({ fecha_promesa_pago: fechaPromesa })
                    .eq('id', estadiaId);
            }

            // Enviar recibo por WhatsApp
            if (responsable && vistaEstadia) {
                const telefono = vistaEstadia.celular_responsable.replace(/\D/g, '');

                // Enviar recibo con la info del contexto (individual o grupal)
                await enviarReciboPago(
                    telefono,
                    responsable.nombre_completo,
                    montoPago,
                    nuevoSaldo,
                    metodoPago
                );
            }

            window.location.reload();

        } catch (error) {
            console.error('Error al registrar pago:', error);
            setPaying(false);
            alert("Error al registrar el pago");
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

    if (!vistaEstadia || !responsable) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <p className="text-danger">Estadía no encontrada</p>
                </div>
            </Layout>
        );
    }

    // --- CÁLCULOS FINALES PARA RENDERIZADO ---

    // 1. Calcular totales (Individual o Grupal)
    const totalFinal = esGrupo
        ? integrantesGrupo.reduce((sum, g) => sum + g.monto_total_final, 0)
        : vistaEstadia.monto_total_final;

    const totalPagado = pagos.reduce((sum, p) => sum + p.monto_abonado, 0);
    const saldoPendiente = totalFinal - totalPagado;

    // A efectos de desglose visual individual (se mantiene para mostrar detalle de ESTA estadía)

    // Helper para fechas (mismo fix que en Liquidación)
    const getNoonDate = (dateStr: string | undefined | null): Date => {
        if (!dateStr) return new Date();
        try {
            const cleanDate = dateStr.split('T')[0];
            return new Date(`${cleanDate}T12:00:00`);
        } catch { return new Date(); }
    };

    const diasEstadiaReal = vistaEstadia ? Math.max(1, differenceInDays(
        getNoonDate(vistaEstadia.fecha_egreso_programada),
        getNoonDate(vistaEstadia.fecha_ingreso)
    )) : 1;

    const totalPersonas = (vistaEstadia.acumulado_noches_persona || 0) * vistaEstadia.p_persona;

    // Usar diasEstadiaReal en lugar de dias_parcela (que viene viciado por la vista)
    const totalCarpas = diasEstadiaReal * (vistaEstadia.cant_parcelas_total || 0) * vistaEstadia.p_parcela;
    const totalSillas = diasEstadiaReal * (vistaEstadia.cant_sillas_total || 0) * vistaEstadia.p_silla;
    const totalMesas = diasEstadiaReal * (vistaEstadia.cant_mesas_total || 0) * vistaEstadia.p_mesa;
    const totalVehiculo = diasEstadiaReal * vistaEstadia.p_vehiculo;

    const subtotalIndividual = totalPersonas + totalCarpas + totalSillas + totalMesas + totalVehiculo;
    const descuentoIndividual = vistaEstadia.descuento_arbitrario || 0;

    return (
        <Layout>
            <div className="space-y-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-primary">
                            Estado de Cuenta {esGrupo && '(Grupal)'}
                        </h1>
                        <p className="text-muted text-sm mt-1">
                            {responsable.nombre_completo} • {vistaEstadia.celular_responsable}
                        </p>
                    </div>
                    <Badge variant={saldoPendiente > 0 ? 'danger' : 'success'} className="text-lg px-4 py-2">
                        {saldoPendiente > 0 ? `ADEUDA ${formatCurrency(saldoPendiente)}` : 'AL DÍA'}
                    </Badge>
                </div>

                {/* Resumen Grupal (Solo si es responsable de grupo) */}
                {esGrupo && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardHeader>
                            <CardTitle className="text-amber-900 flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Resumen del Grupo ({integrantesGrupo.length} estadias)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {integrantesGrupo.map((integ, idx) => (
                                    <div key={integ.id} className="flex justify-between items-center p-2 bg-white rounded border border-amber-100">
                                        <div className="text-sm">
                                            <span className="font-bold text-amber-900">#{idx + 1} </span>
                                            {integ.id === estadiaId ? '(Tú)' : `Estadía ${integ.id.slice(0, 6)}`}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">{formatCurrency(integ.monto_total_final)}</div>
                                        </div>
                                    </div>
                                ))}
                                <div className="border-t border-amber-200 pt-2 mt-2 flex justify-between font-bold text-amber-900">
                                    <span>Total Deuda Grupal:</span>
                                    <span>{formatCurrency(totalFinal)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Desglose de Costos Individual */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="w-5 h-5" />
                            Detalle Individual (Tu Estadía)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Personas */}
                            <div className="border-b pb-3">
                                <p className="font-medium mb-2">Personas</p>
                                <div className="grid grid-cols-2 gap-2 text-sm text-muted">
                                    <span>{vistaEstadia.acumulado_noches_persona} noches × {formatCurrency(vistaEstadia.p_persona)}</span>
                                    <span className="text-right font-medium text-foreground">{formatCurrency(totalPersonas)}</span>
                                </div>
                            </div>

                            {/* Recursos */}
                            <div className="border-b pb-3">
                                <p className="font-medium mb-2">Recursos ({diasEstadiaReal} días)</p >
                                <div className="space-y-1 text-sm">
                                    {(vistaEstadia.cant_parcelas_total || 0) > 0 && (
                                        <div className="grid grid-cols-2 gap-2 text-muted">
                                            <span>Carpas ({vistaEstadia.cant_parcelas_total})</span>
                                            <span className="text-right font-medium text-foreground">{formatCurrency(totalCarpas)}</span>
                                        </div>
                                    )}
                                    {(vistaEstadia.cant_sillas_total || 0) > 0 && (
                                        <div className="grid grid-cols-2 gap-2 text-muted">
                                            <span>Sillas ({vistaEstadia.cant_sillas_total})</span>
                                            <span className="text-right font-medium text-foreground">{formatCurrency(totalSillas)}</span>
                                        </div>
                                    )}
                                    {(vistaEstadia.cant_mesas_total || 0) > 0 && (
                                        <div className="grid grid-cols-2 gap-2 text-muted">
                                            <span>Mesas ({vistaEstadia.cant_mesas_total})</span>
                                            <span className="text-right font-medium text-foreground">{formatCurrency(totalMesas)}</span>
                                        </div>
                                    )}
                                    {vistaEstadia.p_vehiculo > 0 && (
                                        <div className="grid grid-cols-2 gap-2 text-muted">
                                            <span>Vehículo ({vistaEstadia.tipo_vehiculo})</span>
                                            <span className="text-right font-medium text-foreground">{formatCurrency(totalVehiculo)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Totales */}
                            <div className="space-y-2">
                                {/* Personas en camping */}
                                {vistaEstadia.acumulado_noches_persona > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted">
                                            Personas (camping): {vistaEstadia.acumulado_noches_persona} × ${vistaEstadia.p_persona}
                                        </span>
                                        <span>{formatCurrency(vistaEstadia.acumulado_noches_persona * vistaEstadia.p_persona)}</span>
                                    </div>
                                )}

                                {/* Parcelas de camping */}
                                {vistaEstadia.cant_parcelas_camping > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted">
                                            Parcelas: {diasEstadiaReal}d × {vistaEstadia.cant_parcelas_camping} × ${vistaEstadia.p_parcela}
                                        </span>
                                        <span>{formatCurrency(diasEstadiaReal * vistaEstadia.cant_parcelas_camping * vistaEstadia.p_parcela)}</span>
                                    </div>
                                )}

                                {/* Camas */}
                                {vistaEstadia.cant_camas > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted text-accent">
                                            Camas (habitación): {diasEstadiaReal}d × {vistaEstadia.cant_camas} × ${vistaEstadia.p_cama}
                                        </span>
                                        <span className="text-accent font-medium">{formatCurrency(diasEstadiaReal * vistaEstadia.cant_camas * vistaEstadia.p_cama)}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    <span className="text-muted">Subtotal Individual:</span>
                                    <span className="text-right font-medium">{formatCurrency(subtotalIndividual)}</span>
                                </div>
                                {descuentoIndividual > 0 && (
                                    <div className="grid grid-cols-2 gap-2 text-green-600">
                                        <span>Descuento:</span>
                                        <span className="text-right font-medium">-{formatCurrency(descuentoIndividual)}</span>
                                    </div>
                                )}
                                {!esGrupo && (
                                    <div className="grid grid-cols-2 gap-2 text-lg font-bold border-t pt-2">
                                        <span>Total a Pagar:</span>
                                        <span className="text-right text-primary">{formatCurrency(totalFinal)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Historial de Pagos */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Pagos Realizados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pagos.length === 0 ? (
                            <p className="text-muted text-center py-4">No hay pagos registrados</p>
                        ) : (
                            <div className="space-y-3">
                                {pagos.map((pago) => (
                                    <div key={pago.id} className="flex items-center justify-between border-b pb-2">
                                        <div>
                                            <p className="font-medium">{formatCurrency(pago.monto_abonado)}</p>
                                            <p className="text-sm text-muted">
                                                {new Date(pago.fecha_pago || '').toLocaleDateString('es-AR')} • {pago.metodo_pago}
                                            </p>
                                        </div>
                                        <Badge variant="success">Pagado</Badge>
                                    </div>
                                ))}
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t font-semibold">
                                    <span>Total Pagado:</span>
                                    <span className="text-right text-green-600">{formatCurrency(totalPagado)}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Registro de Pago */}
                {saldoPendiente > 0 && (
                    <Card className="border-2 border-primary">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Registrar Pago
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-accent/10 p-4 rounded-lg">
                                <p className="text-sm text-muted">Saldo pendiente:</p>
                                <p className="text-3xl font-bold text-danger">{formatCurrency(saldoPendiente)}</p>
                            </div>

                            <Input
                                label="Monto a Abonar ($)"
                                type="number"
                                value={montoPago || ''}
                                onChange={(e) => {
                                    // Bug Z Fix: Forzar enteros
                                    const val = parseInt(e.target.value) || 0;
                                    setMontoPago(Math.floor(val));
                                }}
                                min={0}
                                max={saldoPendiente}
                                step={1}
                            />

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Método de Pago
                                </label>
                                <select
                                    value={metodoPago}
                                    onChange={(e) => setMetodoPago(e.target.value)}
                                    className="input"
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="Mercado Pago">Mercado Pago</option>
                                </select>
                            </div>

                            {/* Fecha Promesa de Pago - solo si queda saldo después de este pago */}
                            {vistaEstadia && (montoPago > 0 && montoPago < saldoPendiente) && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-sm text-amber-800 mb-2">
                                        ⚠️ Quedará un saldo de <strong>{formatCurrency(saldoPendiente - montoPago)}</strong>
                                    </p>
                                    <Input
                                        label="¿Cuándo promete pagar el resto? (opcional)"
                                        type="date"
                                        value={fechaPromesa}
                                        onChange={(e) => setFechaPromesa(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                    <p className="text-xs text-muted mt-1">
                                        No se enviarán recordatorios antes de esta fecha
                                    </p>
                                </div>
                            )}

                            {montoPago > 0 && (
                                <div className="bg-secondary/10 p-3 rounded text-sm">
                                    <p className="text-muted">Nuevo saldo después del pago:</p>
                                    <p className="text-lg font-semibold">
                                        {formatCurrency(saldoPendiente - montoPago)}
                                    </p>
                                </div>
                            )}

                            <Button
                                variant="primary"
                                onClick={handlePagar}
                                disabled={paying || montoPago <= 0}
                                className="w-full"
                            >
                                {paying ? 'Procesando...' : `Registrar Pago de ${formatCurrency(montoPago)}`}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Botón volver al dashboard */}
                <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
                    Volver al Dashboard
                </Button>
            </div>
        </Layout>
    );
}
