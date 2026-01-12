'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, VistaEstadiaConTotales } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DollarSign, CheckCircle, Send, MessageCircle } from 'lucide-react';
import { formatCurrency, sendWhatsAppNotification, replaceTemplate } from '@/lib/utils';
import { MJE_BIENVENIDA_PERSONAL, MJE_BIENVENIDA_GENERAL } from '@/lib/mensajes';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';

import { cargarAcampantes, cargarEstadiasActivas, reasignarAcampante, procesarPagoInicial } from './helpers';

export default function LiquidacionPage() {
    const router = useRouter();
    const params = useParams();
    const estadiaId = params.estadia_id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [vistaEstadia, setVistaEstadia] = useState<VistaEstadiaConTotales | null>(null);
    const [descuentoEspecial, setDescuentoEspecial] = useState(''); // String to fix precision input
    const [montoAbonar, setMontoAbonar] = useState(''); // Changed to string for input stability (Bug H)
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [responsableNombre, setResponsableNombre] = useState('');
    const [fechaPromesa, setFechaPromesa] = useState('');
    const [acampantes, setAcampantes] = useState<any[]>([]);
    const [estadiasActivas, setEstadiasActivas] = useState<any[]>([]);
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [acompanteToReassign, setAcompanteToReassign] = useState<any>(null);

    // Estados para pago grupal vs individual
    const [tipoCobro, setTipoCobro] = useState<'individual' | 'grupal'>('individual');
    const [estadiasGrupo, setEstadiasGrupo] = useState<(VistaEstadiaConTotales & { responsable_nombre?: string })[]>([]);
    const [totalGrupal, setTotalGrupal] = useState(0);

    useEffect(() => {
        fetchData();
    }, [estadiaId]);

    // Cargar estadías del grupo cuando se selecciona cobro grupal
    useEffect(() => {
        if (tipoCobro === 'grupal' && vistaEstadia) {
            cargarEstadiasGrupo();
        }
    }, [tipoCobro, vistaEstadia]);

    const cargarEstadiasGrupo = async () => {
        if (!vistaEstadia) return;

        try {
            const { data, error } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('celular_responsable', vistaEstadia.celular_responsable)
                .eq('estado_estadia', 'activa');

            if (error) throw error;

            // Cargar nombres de responsables para cada estadía
            const estadiasConNombres = await Promise.all(
                (data || []).map(async (est) => {
                    const { data: acampantes } = await supabase
                        .from('acampantes')
                        .select('nombre_completo')
                        .eq('estadia_id', est.id)
                        .limit(1);

                    return {
                        ...est,
                        responsable_nombre: acampantes && acampantes.length > 0 ? acampantes[0].nombre_completo : 'Desconocido'
                    };
                })
            );

            setEstadiasGrupo(estadiasConNombres);

            // Calcular total grupal
            const total = (data || []).reduce((sum, est) => sum + (est.saldo_pendiente || 0), 0);
            setTotalGrupal(total);

        } catch (error) {
            console.error('Error al cargar estadías del grupo:', error);
        }
    };

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

            // Cargar acampantes
            const acampantesData = await cargarAcampantes(estadiaId);
            setAcampantes(acampantesData);

            // Cargar estadías activas
            const estadiasData = await cargarEstadiasActivas(estadiaId);
            setEstadiasActivas(estadiasData);

        } catch (error) {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar datos financieros.');
            router.push('/recepcion');
        } finally {
            setLoading(false);
        }
    };


    const handleCambiarACompanero = (acampante: any) => {
        setAcompanteToReassign(acampante);
        setShowReassignModal(true);
    };

    const handleReasignarAcampante = async (celularResponsable: string) => {
        if (!acompanteToReassign) return;

        try {
            const estadiaDestino = estadiasActivas.find(e => e.celular_responsable === celularResponsable);
            if (!estadiaDestino) {
                alert('No se encontró la estadía destino');
                return;
            }

            await reasignarAcampante(
                acompanteToReassign.id,
                celularResponsable,
                estadiaDestino.id
            );

            await fetchData();
            setShowReassignModal(false);
            setAcompanteToReassign(null);
            // alert('Acampante reasignado exitosamente'); // Eliminado por solicitud

        } catch (error) {
            console.error('Error reasignando:', error);
            alert('Error al reasignar. Intente nuevamente.');
        }
    };


    const handleFinalizarIngreso = async () => {
        if (!vistaEstadia) return;

        const montoNum = parseFloat(montoAbonar) || 0; // Parse string input

        // PERMITIR MONTO 0 (Genera Deuda)
        if (montoNum < 0) {
            alert('El monto a abonar no puede ser negativo.');
            return;
        }

        setSaving(true);

        try {
            const wasIngresoConfirmado = vistaEstadia.ingreso_confirmado; // Check status BEFORE update (Bug A)

            // 1. Actualizar descuento en la estadía
            const descuentoNum = parseInt(descuentoEspecial) || 0;
            if (descuentoNum > 0) {
                await supabase
                    .from('estadias')
                    .update({ descuento_arbitrario: descuentoNum })
                    .eq('id', estadiaId);
            }

            // 2. Calcular nuevo saldo
            const montoTotal = tipoCobro === 'grupal' ? totalGrupal : vistaEstadia.monto_total_final;
            const nuevoSaldo = montoTotal - descuentoNum - montoNum;

            // 3. Registrar el pago (SOLO SI HAY MONTO > 0)
            if (montoNum > 0) {
                if (tipoCobro === 'grupal') {
                    // PAGO GRUPAL
                    const { error: pagoError } = await supabase
                        .from('pagos')
                        .insert({
                            estadia_id: estadiaId, // Estadía del responsable
                            monto_abonado: montoNum,
                            metodo_pago: metodoPago,
                        });

                    if (pagoError) throw pagoError;
                } else {
                    // PAGO INDIVIDUAL
                    const { error: pagoError } = await supabase
                        .from('pagos')
                        .insert({
                            estadia_id: estadiaId,
                            monto_abonado: montoNum,
                            metodo_pago: metodoPago,
                        });

                    if (pagoError) throw pagoError;
                }
            }

            // Si es pago grupal y SALDA TODO, confirmar a todos
            if (tipoCobro === 'grupal' && nuevoSaldo <= 0) {
                for (const est of estadiasGrupo) {
                    await supabase
                        .from('estadias')
                        .update({
                            ingreso_confirmado: true,
                            estado_estadia: 'activa'
                        })
                        .eq('id', est.id);
                }
            }

            // 4. Asignar parcela a la estadía e incrementar contador (solo individual)
            const parcelasSeleccionadasStr = localStorage.getItem(`parcelas_${estadiaId}`);
            let parcelaNombreFinal = vistaEstadia.parcela_asignada;

            if (parcelasSeleccionadasStr) {
                const parcelasSeleccionadas = JSON.parse(parcelasSeleccionadasStr);

                if (parcelasSeleccionadas.length > 0) {
                    const parcelaId = parcelasSeleccionadas[0]; // Tomar la primera parcela

                    // Obtener datos de la parcela
                    const { data: parcela, error: parcelaError } = await supabase
                        .from('parcelas')
                        .select('nombre_parcela, cantidad_integrantes')
                        .eq('id', parcelaId)
                        .single();

                    if (parcelaError) throw parcelaError;

                    parcelaNombreFinal = parcela.nombre_parcela; // Update for message

                    // Asignar parcela a la estadía
                    const { error: assignError } = await supabase
                        .from('estadias')
                        .update({
                            parcela_asignada: parcela.nombre_parcela,
                            ingreso_confirmado: true,
                            estado_estadia: 'activa',
                            fecha_promesa_pago: nuevoSaldo > 0 && fechaPromesa ? fechaPromesa : null
                        })
                        .eq('id', estadiaId);

                    if (assignError) throw assignError;

                    // Incrementar contador de integrantes en la parcela
                    const nuevaCantidad = (parcela.cantidad_integrantes || 0) + 1;
                    const { error: updateParcelaError } = await supabase
                        .from('parcelas')
                        .update({
                            cantidad_integrantes: nuevaCantidad,
                            estado: 'ocupada'
                        })
                        .eq('id', parcelaId);

                    if (updateParcelaError) throw updateParcelaError;
                }

                localStorage.removeItem(`parcelas_${estadiaId}`);
            } else {
                // Si no hay parcela seleccionada, solo confirmar ingreso
                await supabase
                    .from('estadias')
                    .update({
                        ingreso_confirmado: true,
                        estado_estadia: 'activa',
                        fecha_promesa_pago: nuevoSaldo > 0 && fechaPromesa ? fechaPromesa : null
                    })
                    .eq('id', estadiaId);
            }

            // 5. Enviar Notificaciones WhatsApp (Secuencia Completa)
            try {
                const telefono = vistaEstadia.celular_responsable;
                const nombreParaMensaje = responsableNombre;
                const parcelaParaMensaje = parcelaNombreFinal || 'Sin asignar';

                // Bug A: Solo enviar Bienvenida si es el PRIMER ingreso (ingreso_confirmado era false)
                if (!wasIngresoConfirmado) {
                    // Construcción Mensaje 1: Bienvenida Personal (Delay 120s = 2 min)
                    const mensajePersonal = replaceTemplate(MJE_BIENVENIDA_PERSONAL, {
                        nombre_acampante: nombreParaMensaje,
                        parcela_asignada: parcelaParaMensaje
                    });

                    await sendWhatsAppNotification({
                        telefonos: [telefono],
                        mensaje: mensajePersonal,
                        tipo_mensaje: 'bienvenida',
                        delay: true,
                        tiempo: 120
                    });

                    // Construcción Mensaje 2: Bienvenida General (Delay 600s = 10 min)
                    await sendWhatsAppNotification({
                        telefonos: [telefono],
                        mensaje: MJE_BIENVENIDA_GENERAL,
                        tipo_mensaje: 'general',
                        delay: true,
                        tiempo: 600
                    });
                }

                // Bug A: SIEMPRE enviar Recibo si hubo pago o si es confirmación
                // Construcción Mensaje 3: Recibo de Pago (Delay 240s = 4 min o Inmediato si es re-pago)
                // Si ya estaba confirmado, enviamos recibo con menos delay (ej: 10s) para que llegue rápido.
                const delayRecibo = wasIngresoConfirmado ? 10 : 240;

                const detalleSaldo = nuevoSaldo > 0
                    ? `📉 *Saldo Pendiente:* ${formatCurrency(nuevoSaldo)}\n📅 *Compromiso:* ${fechaPromesa ? new Date(fechaPromesa).toLocaleDateString('es-AR') : 'A definir'}`
                    : '🎉 *¡Estadía completa saldada!*';

                const mensajeRecibo = `Hola ${nombreParaMensaje}, recibimos tu pago correctamente. 🧾\n\n📝 *Resumen:* \n\n📋 *Total Actual:* ${formatCurrency(montoTotal)}\n✅ *Abonaste:* ${formatCurrency(montoNum)} (${metodoPago})\n${detalleSaldo}\n\nGracias por cumplir con el compromiso. ¡Sigan disfrutando!`;

                // Solo enviar recibo si hubo pago > 0 o si se confirmó ingreso (aunque sea saldo 0)
                if (montoNum > 0 || !wasIngresoConfirmado) {
                    await sendWhatsAppNotification({
                        telefonos: [telefono],
                        mensaje: mensajeRecibo,
                        tipo_mensaje: 'recibo_ingreso', // Reusamos tipo
                        delay: true,
                        tiempo: delayRecibo
                    });
                }

                toast.success('Operación exitosa.');

            } catch (msgError) {
                console.error('Error envío WhatsApp:', msgError);
                toast.warning('Guardado, pero hubo error enviando WhatsApp.');
            }

            // 7. Navegar a recepción (sin alert)
            router.push('/recepcion');

        } catch (error: any) {
            console.error('Error al procesar pago:', error);
            alert(`Error al procesar el pago: ${error.message || 'Error desconocido'}`);
            setSaving(false);
        }
    };

    // BUG M FIX: Calcular total en cliente (Safe calculation)
    // Bug U Fix: Calcular días reales de estadía para recursos (no usar dias_parcela de la vista que suma por persona)
    const diasEstadiaReal = vistaEstadia ? Math.max(1, differenceInDays(
        new Date(vistaEstadia.fecha_egreso_programada),
        vistaEstadia.fecha_ingreso ? new Date(vistaEstadia.fecha_ingreso) : new Date()
    )) : 1;

    const calcCamping = vistaEstadia ? (vistaEstadia.acumulado_noches_persona || 0) * vistaEstadia.p_persona : 0;
    const calcParcelas = vistaEstadia ? diasEstadiaReal * (vistaEstadia.cant_parcelas_camping || 0) * vistaEstadia.p_parcela : 0;
    const calcCamas = vistaEstadia ? diasEstadiaReal * (vistaEstadia.cant_camas || 0) * vistaEstadia.p_cama : 0;
    const calcSillas = vistaEstadia ? diasEstadiaReal * (vistaEstadia.cant_sillas_total || 0) * vistaEstadia.p_silla : 0;
    const calcMesas = vistaEstadia ? diasEstadiaReal * (vistaEstadia.cant_mesas_total || 0) * vistaEstadia.p_mesa : 0;
    const calcVehiculo = vistaEstadia ? diasEstadiaReal * vistaEstadia.p_vehiculo : 0;

    const totalCalculado = calcCamping + calcParcelas + calcCamas + calcSillas + calcMesas + calcVehiculo;

    // Usar totalCalculado para Individual, totalGrupal para Grupal
    const subtotal = tipoCobro === 'grupal' ? totalGrupal : totalCalculado;

    // BUG N FIX: Forzar enteros en cálculos finales
    const descuentoNum = parseInt(descuentoEspecial) || 0;
    const totalConDescuento = Math.ceil(subtotal - descuentoNum);
    const montoNumRender = parseInt(montoAbonar) || 0;
    const nuevoSaldo = totalConDescuento - montoNumRender;

    // Hook at top level:
    useEffect(() => {
        if (vistaEstadia) {
            const inicial = tipoCobro === 'grupal' ? totalGrupal : totalCalculado;
            setMontoAbonar(Math.ceil(inicial).toString());
        }
    }, [vistaEstadia, tipoCobro, totalGrupal, totalCalculado]);

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


    // --- DEBUG HANDLERS ---
    const handleDebugPersonal = async () => {
        if (!vistaEstadia) return;
        const nombre = (responsableNombre || 'Acampante'); // Full name
        const parcela = vistaEstadia.parcela_asignada || 'Sin Asignar';
        const telefono = vistaEstadia.celular_responsable;

        const mensaje = replaceTemplate(MJE_BIENVENIDA_PERSONAL, {
            nombre_acampante: nombre,
            parcela_asignada: parcela
        });

        if (confirm(`¿Enviar WhatsApp Personal a ${telefono}?\n\n${mensaje.substring(0, 100)}...`)) {
            try {
                await sendWhatsAppNotification({
                    telefonos: [telefono],
                    mensaje: mensaje,
                    tipo_mensaje: 'debug_personal'
                });
                alert('Mensaje Personal enviado a n8n');
            } catch (e) {
                console.error(e);
                alert('Error enviando mensaje');
            }
        }
    };

    const handleDebugGeneral = async () => {
        if (!vistaEstadia) return;
        const telefono = vistaEstadia.celular_responsable;

        if (confirm(`¿Enviar WhatsApp General a ${telefono}?`)) {
            try {
                await sendWhatsAppNotification({
                    telefonos: [telefono],
                    mensaje: MJE_BIENVENIDA_GENERAL,
                    tipo_mensaje: 'debug_general',
                    delay: true,
                    tiempo: 5000 // 5 seg debug delay
                });
                alert('Mensaje General enviado a n8n (con delay 5s)');
            } catch (e) {
                console.error(e);
                alert('Error enviando mensaje');
            }
        }
    };
    // ----------------------

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

                {/* Selector de Tipo de Cobro */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tipo de Cobro</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    value="individual"
                                    checked={tipoCobro === 'individual'}
                                    onChange={() => setTipoCobro('individual')}
                                    className="w-4 h-4 text-primary"
                                />
                                <div>
                                    <span className="font-medium">Individual</span>
                                    <p className="text-sm text-muted">Solo esta persona</p>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    value="grupal"
                                    checked={tipoCobro === 'grupal'}
                                    onChange={() => setTipoCobro('grupal')}
                                    className="w-4 h-4 text-primary"
                                />
                                <div>
                                    <span className="font-medium">Grupal</span>
                                    <p className="text-sm text-muted">Toda la familia (mismo responsable)</p>
                                </div>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* Desglose Grupal */}
                {tipoCobro === 'grupal' && estadiasGrupo.length > 1 && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardHeader>
                            <CardTitle className="text-amber-900">Integrantes del Grupo</CardTitle>
                            <p className="text-sm text-amber-700">
                                {estadiasGrupo.length} personas con el mismo responsable
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {estadiasGrupo.map((est, idx) => (
                                    <div key={est.id} className="flex justify-between items-center p-2 bg-white rounded border border-amber-200">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={est.id === estadiaId ? 'danger' : 'info'}>
                                                {idx + 1}
                                            </Badge>
                                            <span className="text-sm">
                                                {est.id === estadiaId && <strong>(Responsable) </strong>}
                                                {est.responsable_nombre || `Estadía ${est.id.slice(0, 8)}...`}
                                            </span>
                                        </div>
                                        <span className="font-medium text-sm">
                                            {formatCurrency(est.saldo_pendiente || 0)}
                                        </span>
                                    </div>
                                ))}
                                <div className="border-t-2 border-amber-300 pt-2 mt-3 flex justify-between items-center">
                                    <strong className="text-amber-900">Total Grupal:</strong>
                                    <strong className="text-lg text-amber-900">{formatCurrency(totalGrupal)}</strong>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Resumen Financiero */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {tipoCobro === 'grupal' ? 'Resumen del Responsable' : 'Resumen de Costos'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        {/* Desglose */}

                        {/* Precio unitarios */}
                        <div className="bg-gray-50 p-3 rounded space-y-1 text-xs text-muted">
                            <div>💰 Precio por noche persona: {formatCurrency(vistaEstadia.p_persona)}</div>
                            <div>🏕️ Precio por día parcela: {formatCurrency(vistaEstadia.p_parcela)}</div>
                        </div>

                        {/* Personas en camping */}
                        {(vistaEstadia.acumulado_noches_persona || 0) > 0 && (vistaEstadia.cant_parcelas_camping || 0) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted">
                                    Personas (camping): {vistaEstadia.acumulado_noches_persona} noches × {formatCurrency(vistaEstadia.p_persona)}
                                </span>
                                <span className="font-medium">
                                    {formatCurrency(calcCamping)}
                                </span>
                            </div>
                        )}

                        {/* Parcelas de camping */}
                        {(vistaEstadia.cant_parcelas_camping || 0) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted">
                                    Parcelas: {diasEstadiaReal} días × {vistaEstadia.cant_parcelas_camping} × {formatCurrency(vistaEstadia.p_parcela)}
                                </span>
                                <span className="font-medium">
                                    {formatCurrency(calcParcelas)}
                                </span>
                            </div>
                        )}

                        {/* Camas de habitación */}
                        {(vistaEstadia.cant_camas || 0) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted">
                                    Camas (habitación): {diasEstadiaReal} días × {vistaEstadia.cant_camas} × {formatCurrency(vistaEstadia.p_cama)}
                                </span>
                                <span className="font-medium text-accent">
                                    {formatCurrency(calcCamas)}
                                </span>
                            </div>
                        )}

                        {/* Recursos */}
                        {((vistaEstadia.cant_sillas_total || 0) > 0 || (vistaEstadia.cant_mesas_total || 0) > 0) && (
                            <>
                                {(vistaEstadia.cant_sillas_total || 0) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted">Sillas: {diasEstadiaReal}d × {vistaEstadia.cant_sillas_total}</span>
                                        <span>{formatCurrency(calcSillas)}</span>
                                    </div>
                                )}
                                {(vistaEstadia.cant_mesas_total || 0) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted">Mesas: {diasEstadiaReal}d × {vistaEstadia.cant_mesas_total}</span>
                                        <span>{formatCurrency(calcMesas)}</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Vehículo */}
                        {vistaEstadia.p_vehiculo > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted">Vehículo: {diasEstadiaReal} días</span>
                                <span>{formatCurrency(calcVehiculo)}</span>
                            </div>
                        )}

                        {/* Subtotal */}
                        <div className="flex justify-between text-lg font-semibold mt-4 pt-4 border-t border-gray-200">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(subtotal)}</span>
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
                            value={descuentoEspecial}
                            onChange={(e) => setDescuentoEspecial(e.target.value)}
                            min={0}
                        />

                        {/* Total con descuento */}
                        {parseFloat(descuentoEspecial) > 0 && (
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
                            value={montoAbonar} // Now string
                            onChange={(e) => setMontoAbonar(e.target.value)} // Just update string
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
                                required
                            >
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Mercado Pago">Mercado Pago</option>
                            </select>
                        </div>

                        {/* Fecha Promesa de Pago - solo si queda saldo */}
                        {nuevoSaldo > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800 mb-2">
                                    ⚠️ Quedará un saldo pendiente de <strong>{formatCurrency(nuevoSaldo)}</strong>
                                </p>
                                <Input
                                    label="¿Cuándo se compromete a pagar el resto? (opcional)"
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
                        disabled={saving || montoNumRender < 0}
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
