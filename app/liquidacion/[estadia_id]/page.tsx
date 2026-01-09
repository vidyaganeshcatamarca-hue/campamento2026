'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, VistaEstadiaConTotales } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DollarSign, CheckCircle } from 'lucide-react';
import { formatCurrency, sendWhatsAppNotification } from '@/lib/utils';

export default function LiquidacionPage() {
    const router = useRouter();
    const params = useParams();
    const estadiaId = params.estadia_id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [vistaEstadia, setVistaEstadia] = useState<VistaEstadiaConTotales | null>(null);
    const [descuentoEspecial, setDescuentoEspecial] = useState(0);
    const [montoAbonar, setMontoAbonar] = useState(0);
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [responsableNombre, setResponsableNombre] = useState('');

    useEffect(() => {
        fetchData();
    }, [estadiaId]);

    const fetchData = async () => {
        try {
            // Cargar vista calculada
            const { data, error } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('id', estadiaId)
                .single();

            if (error) throw error;
            setVistaEstadia(data);

            // Cargar nombre del responsable
            const { data: acampante } = await supabase
                .from('acampantes')
                .select('nombre_completo')
                .eq('estadia_id', estadiaId)
                .eq('es_responsable_pago', true)
                .single();

            if (acampante) {
                setResponsableNombre(acampante.nombre_completo);
            }

        } catch (error) {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar datos financieros.');
            router.push('/recepcion');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizarIngreso = async () => {
        if (!vistaEstadia) return;

        if (montoAbonar <= 0) {
            alert('Por favor ingresa un monto a abonar.');
            return;
        }

        setSaving(true);

        try {
            // 1. Actualizar descuento en la estadía
            if (descuentoEspecial > 0) {
                await supabase
                    .from('estadias')
                    .update({ descuento_arbitrario: descuentoEspecial })
                    .eq('id', estadiaId);
            }

            // 2. Registrar el pago
            const { error: pagoError } = await supabase
                .from('pagos')
                .insert({
                    estadia_id: estadiaId,
                    monto_abonado: montoAbonar,
                    metodo_pago: metodoPago,
                });

            if (pagoError) throw pagoError;

            // 3. Calcular nuevo saldo
            const nuevoSaldo = (vistaEstadia.monto_total_calculado - descuentoEspecial - montoAbonar);

            // 4. Enviar notificación de WhatsApp
            await sendWhatsAppNotification({
                telefonos: [vistaEstadia.celular_responsable],
                mensaje: `Hola ${responsableNombre}, recibimos tu pago de ${formatCurrency(montoAbonar)}. Tu saldo restante es ${formatCurrency(nuevoSaldo)}. ¡Bienvenido a Campamento Vrindavan!`,
                tipo_mensaje: 'bienvenida',
            });

            // 5. Mostrar confirmación y volver
            alert('¡Check-in completado exitosamente!');
            router.push('/recepcion');

        } catch (error) {
            console.error('Error al procesar pago:', error);
            alert('Error al procesar el pago. Por favor intente nuevamente.');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <p className="text-muted">Cargando liquidación...</p>
                </div>
            </Layout>
        );
    }

    if (!vistaEstadia) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <p className="text-danger">No se encontraron datos de la estadía</p>
                </div>
            </Layout>
        );
    }

    const subtotal = vistaEstadia.monto_total_calculado;
    const totalConDescuento = subtotal - descuentoEspecial;
    const nuevoSaldo = totalConDescuento - montoAbonar;

    return (
        <Layout>
            <div className="space-y-6 max-w-3xl mx-auto">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">
                        Liquidación y Cobro
                    </h1>
                    <p className="text-muted mt-1">
                        Resumen financiero y registro de pago inicial
                    </p>
                </div>

                {/* Resumen Financiero */}
                <Card>
                    <CardHeader>
                        <CardTitle>Resumen de Costos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Desglose */}
                        <div className="grid grid-cols-2 gap-2 pb-3 border-b border-gray-200">
                            <span className="text-muted">Total por personas:</span>
                            <span className="text-right font-medium">
                                {formatCurrency(vistaEstadia.acumulado_noches_persona * vistaEstadia.p_persona)}
                            </span>

                            <span className="text-muted">Total por carpas ({vistaEstadia.dias_parcela_total} días):</span>
                            <span className="text-right font-medium">
                                {formatCurrency(vistaEstadia.dias_parcela_total * vistaEstadia.cant_parcelas_total * vistaEstadia.p_parcela)}
                            </span>

                            {vistaEstadia.cant_sillas_total > 0 && (
                                <>
                                    <span className="text-muted">Sillas ({vistaEstadia.cant_sillas_total}):</span>
                                    <span className="text-right font-medium">
                                        {formatCurrency(vistaEstadia.dias_parcela_total * vistaEstadia.cant_sillas_total * vistaEstadia.p_silla)}
                                    </span>
                                </>
                            )}

                            {vistaEstadia.cant_mesas_total > 0 && (
                                <>
                                    <span className="text-muted">Mesas ({vistaEstadia.cant_mesas_total}):</span>
                                    <span className="text-right font-medium">
                                        {formatCurrency(vistaEstadia.dias_parcela_total * vistaEstadia.cant_mesas_total * vistaEstadia.p_mesa)}
                                    </span>
                                </>
                            )}

                            {vistaEstadia.p_vehiculo > 0 && (
                                <>
                                    <span className="text-muted">Vehículo:</span>
                                    <span className="text-right font-medium">
                                        {formatCurrency(vistaEstadia.dias_parcela_total * vistaEstadia.p_vehiculo)}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Subtotal */}
                        <div className="grid grid-cols-2 gap-2 text-lg font-semibold">
                            <span>Subtotal:</span>
                            <span className="text-right">{formatCurrency(subtotal)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Descuento y Pago */}
                <Card>
                    <CardHeader>
                        <CardTitle>Ajuste y Cobro</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Descuento */}
                        <Input
                            label="Descuento Especial ($)"
                            type="number"
                            value={descuentoEspecial || ''}
                            onChange={(e) => setDescuentoEspecial(parseFloat(e.target.value) || 0)}
                            min={0}
                            step={0.01}
                        />

                        {/* Total con descuento */}
                        {descuentoEspecial > 0 && (
                            <div className="grid grid-cols-2 gap-2 py-2 border-t border-b border-gray-200">
                                <span className="font-medium">Total con descuento:</span>
                                <span className="text-right font-semibold text-accent">
                                    {formatCurrency(totalConDescuento)}
                                </span>
                            </div>
                        )}

                        {/* Monto a abonar */}
                        <Input
                            label="Monto a Abonar ($) *"
                            type="number"
                            value={montoAbonar || ''}
                            onChange={(e) => setMontoAbonar(parseFloat(e.target.value) || 0)}
                            min={0}
                            step={0.01}
                            required
                        />

                        {/* Método de pago */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Método de Pago *
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

                        {/* Saldo pendiente */}
                        <div className="grid grid-cols-2 gap-2 p-4 bg-secondary-light/10 rounded-lg">
                            <span className="font-bold text-lg">Saldo Restante:</span>
                            <span className={`text-right font-bold text-xl ${nuevoSaldo > 0 ? 'text-danger' : 'text-green-600'}`}>
                                {formatCurrency(nuevoSaldo)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Botones */}
                <div className="flex gap-3 sticky bottom-4 bg-background p-4 rounded-lg shadow-lg border border-gray-200">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={saving}
                        className="flex-1"
                    >
                        Volver
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleFinalizarIngreso}
                        disabled={saving || montoAbonar <= 0}
                        className="flex-1 flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-5 h-5" />
                        {saving ? 'Procesando...' : 'Finalizar Ingreso y Enviar Comprobante'}
                    </Button>
                </div>
            </div>
        </Layout>
    );
}
