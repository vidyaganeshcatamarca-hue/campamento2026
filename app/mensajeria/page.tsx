'use client';

import React, { useState, useEffect } from 'react';
import { supabase, VistaEstadiaConTotales } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MessageCircle, Users, Send, History, ChevronDown, ChevronUp } from 'lucide-react';
import { sendWhatsAppNotification } from '@/lib/utils';

interface MensajeHistorial {
    id: string;
    mensaje: string;
    audiencia: string;
    destinatarios: number;
    fecha: string;
}

export default function MensajeriaPage() {
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [estadiasActivas, setEstadiasActivas] = useState<VistaEstadiaConTotales[]>([]);

    const [allAcampantes, setAllAcampantes] = useState<any[]>([]);

    const [audiencia, setAudiencia] = useState<'todos' | 'deudores' | 'grupo'>('todos');
    const [mensaje, setMensaje] = useState('');
    const [destinatarios, setDestinatarios] = useState<string[]>([]);

    // Historial
    const [historial, setHistorial] = useState<MensajeHistorial[]>([]);
    const [mostrarHistorial, setMostrarHistorial] = useState(false);

    useEffect(() => {
        fetchEstadias();
        cargarHistorial();
    }, []);

    useEffect(() => {
        calcularDestinatarios();
    }, [audiencia, estadiasActivas, allAcampantes]);

    const fetchEstadias = async () => {
        try {
            // 1. Cargar Estadías Activas
            const { data: estadiasData, error: estadiasError } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('estado_estadia', 'activa')
                .eq('ingreso_confirmado', true);

            if (estadiasError) throw estadiasError;
            setEstadiasActivas(estadiasData || []);

            // 2. Cargar TODOS los acampantes de esas estadías (para tener celulares de grupo)
            const idsEstadias = estadiasData?.map(e => e.id) || [];
            console.log('🔍 [Fetch] IDs:', idsEstadias);
            if (idsEstadias.length > 0) {
                const { data: acampantesData, error: acampantesError } = await supabase
                    .from('acampantes')
                    .select('celular, estadia_id')
                    .in('estadia_id', idsEstadias);

                if (acampantesError) console.error('Error cargando acampantes:', acampantesError);
                console.log('🔍 [Fetch] Acampantes RAW:', acampantesData);
                setAllAcampantes(acampantesData || []);
            } else {
                setAllAcampantes([]);
            }

        } catch (error) {
            console.error('Error al cargar estadías:', error);
        } finally {
            setLoading(false);
        }
    };

    const calcularDestinatarios = () => {
        let numeros: string[] = [];

        if (audiencia === 'todos') {
            // Todos los integrantes de estadías activas
            numeros = allAcampantes.map(a => a.celular);
        } else if (audiencia === 'deudores') {
            // Solo integrantes de estadías con deuda
            const idsDeudores = new Set(
                estadiasActivas
                    .filter(e => e.saldo_pendiente > 0)
                    .map(e => e.id)
            );
            numeros = allAcampantes
                .filter(a => idsDeudores.has(a.estadia_id))
                .map(a => a.celular)
        } else if (audiencia === 'grupo') {
            // Identificador especial que lib/utils.ts reconoce para no limpiar
            numeros = ['grupo campamento 2026'];
        }

        // Limpiar y Eliminar duplicados
        const unicos = new Set(
            numeros
                .filter(n => n && n.length > 0) // Filtro básico (solo vacío)
                .map(n => {
                    if (n === 'grupo campamento 2026') return n;
                    return n.replace(/\D/g, '');
                })
        );
        setDestinatarios([...unicos]);
    };

    const cargarHistorial = async () => {
        try {
            const response = await fetch('/api/mensajes-historial');
            const data = await response.json();
            console.log('Historial cargado:', data);
            setHistorial(data);
        } catch (error) {
            console.error('Error al cargar historial:', error);
        }
    };

    const guardarEnHistorial = async (mensajeTexto: string, cantDestinatarios: number) => {
        try {
            const nuevoMensaje: MensajeHistorial = {
                id: Date.now().toString(),
                mensaje: mensajeTexto,
                audiencia: audiencia === 'todos' ? 'Todos los activos' : 'Solo deudores',
                destinatarios: cantDestinatarios,
                fecha: new Date().toISOString(),
            };

            console.log('Guardando mensaje en historial:', nuevoMensaje);

            const response = await fetch('/api/mensajes-historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoMensaje),
            });

            const result = await response.json();
            console.log('Resultado de guardar:', result);

            // Recargar historial
            await cargarHistorial();
        } catch (error) {
            console.error('Error al guardar en historial:', error);
        }
    };

    const reutilizarMensaje = (mensajeTexto: string) => {
        setMensaje(mensajeTexto);
        setMostrarHistorial(false);
    };

    const handleEnviar = async () => {
        if (!mensaje.trim()) {
            return;
        }

        if (destinatarios.length === 0) {
            return;
        }

        setSending(true);

        // PRIMERO: Guardar en historial (siempre, incluso si webhook falla)
        try {
            console.log('Intentando guardar en historial...');
            await guardarEnHistorial(mensaje, destinatarios.length);
            console.log('✅ Mensaje guardado en historial');
        } catch (historialError) {
            console.error('Error al guardar historial:', historialError);
        }

        // SEGUNDO: Enviar mensajes (Bulk via n8n)
        try {
            console.log('Enviando lote a n8n:', destinatarios.length, 'destinatarios');

            const resultado = await sendWhatsAppNotification({
                telefonos: destinatarios,
                mensaje: mensaje,
                tipo_mensaje: 'general', // "tipo" en el JSON final
            });

            if (resultado) {
                console.log('✅ Lote enviado exitosamente al webhook');
                alert(`Mensaje enviado al proceso de difusión (${destinatarios.length} destinatarios).`);
            } else {
                console.error('❌ Error al contactar el webhook');
                alert('Error al iniciar el envío masivo. Verifique la conexión.');
            }

        } catch (error) {
            console.error('Error general al enviar mensajes:', error);
            alert('Error inesperado al enviar.');
        }

        // Limpiar mensaje y finalizar
        setMensaje('');
        setSending(false);
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

    return (
        <Layout>
            <div className="space-y-6 max-w-4xl mx-auto">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">
                        Centro de Comunicaciones
                    </h1>
                    <p className="text-muted mt-1">
                        Envío masivo de mensajes WhatsApp
                    </p>
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Estadías Activas</p>
                                    <p className="text-2xl font-bold">{estadiasActivas.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-danger/10 rounded-lg">
                                    <Users className="w-6 h-6 text-danger" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Con Deuda</p>
                                    <p className="text-2xl font-bold text-danger">
                                        {estadiasActivas.filter(e => e.saldo_pendiente > 0).length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-1 col-span-2">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-accent/10 rounded-lg">
                                    <MessageCircle className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Destinatarios</p>
                                    <p className="text-2xl font-bold text-accent">{destinatarios.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Selector de Audiencia */}
                <Card>
                    <CardHeader>
                        <CardTitle>Seleccionar Audiencia</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 hover:bg-secondary/10 transition-colors"
                                style={{ borderColor: audiencia === 'todos' ? 'var(--primary)' : 'transparent' }}>
                                <input
                                    type="radio"
                                    name="audiencia"
                                    value="todos"
                                    checked={audiencia === 'todos'}
                                    onChange={(e) => setAudiencia(e.target.value as any)}
                                    className="w-4 h-4"
                                />
                                <div className="flex-1">
                                    <p className="font-medium">Todos los Activos</p>
                                    <p className="text-sm text-muted">
                                        Enviar a todos los acampantes con estadía activa ({allAcampantes.length} personas, {audiencia === 'todos' ? destinatarios.length : '...'} números únicos)
                                    </p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 hover:bg-secondary/10 transition-colors"
                                style={{ borderColor: audiencia === 'deudores' ? 'var(--primary)' : 'transparent' }}>
                                <input
                                    type="radio"
                                    name="audiencia"
                                    value="deudores"
                                    checked={audiencia === 'deudores'}
                                    onChange={(e) => setAudiencia(e.target.value as any)}
                                    className="w-4 h-4"
                                />
                                <div className="flex-1">
                                    <p className="font-medium">Solo Deudores</p>
                                    <p className="text-sm text-muted">
                                        Enviar solo a quienes tienen saldo pendiente ({estadiasActivas.filter(e => e.saldo_pendiente > 0).length} estadías, {audiencia === 'deudores' ? destinatarios.length : '...'} números únicos)
                                    </p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 hover:bg-secondary/10 transition-colors"
                                style={{ borderColor: audiencia === 'grupo' ? 'var(--accent)' : 'transparent' }}>
                                <input
                                    type="radio"
                                    name="audiencia"
                                    value="grupo"
                                    checked={audiencia === 'grupo'}
                                    onChange={(e) => setAudiencia(e.target.value as any)}
                                    className="w-4 h-4 text-accent focus:ring-accent"
                                />
                                <div className="flex-1">
                                    <p className="font-medium text-accent">Grupo General (WhatsApp)</p>
                                    <p className="text-sm text-muted">
                                        Enviar mensaje al chat grupal <b>"grupo campamento 2026"</b>
                                    </p>
                                </div>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* Mensaje */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Mensaje</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMostrarHistorial(!mostrarHistorial)}
                                className="flex items-center gap-2"
                            >
                                <History className="w-4 h-4" />
                                Historial ({historial.length})
                                {mostrarHistorial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Historial de mensajes */}
                        {mostrarHistorial && (
                            <div className="space-y-2 mb-4 p-4 bg-secondary/10 rounded-lg max-h-60 overflow-y-auto">
                                <p className="text-sm font-medium text-muted mb-2">Últimos mensajes enviados:</p>
                                {historial.length === 0 ? (
                                    <p className="text-sm text-muted italic">No hay mensajes en el historial</p>
                                ) : (
                                    <div className="space-y-2">
                                        {historial.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-3 bg-white rounded border hover:border-primary cursor-pointer transition-colors"
                                                onClick={() => reutilizarMensaje(item.mensaje)}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <p className="text-xs text-muted">
                                                        {new Date(item.fecha).toLocaleDateString('es-AR', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                    <Badge variant="info" className="text-xs">
                                                        {item.audiencia} ({item.destinatarios})
                                                    </Badge>
                                                </div>
                                                <p className="text-sm line-clamp-2">{item.mensaje}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <textarea
                            value={mensaje}
                            onChange={(e) => setMensaje(e.target.value)}
                            placeholder="Escribe tu mensaje aquí..."
                            className="input min-h-[150px] resize-y"
                            maxLength={1000}
                        />
                        <div className="flex justify-between text-sm text-muted">
                            <span>Máximo 1000 caracteres</span>
                            <span>{mensaje.length} / 1000</span>
                        </div>

                        {/* Preview */}
                        {mensaje.trim() && (
                            <div className="bg-secondary/10 p-4 rounded-lg">
                                <p className="text-sm font-medium mb-2">Vista Previa:</p>
                                <p className="text-sm whitespace-pre-wrap">{mensaje}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Botón Enviar */}
                <Button
                    variant="primary"
                    onClick={handleEnviar}
                    disabled={sending || !mensaje.trim() || destinatarios.length === 0}
                    className="w-full"
                    size="lg"
                >
                    <Send className="w-5 h-5 mr-2" />
                    {sending
                        ? 'Enviando...'
                        : `Enviar a ${destinatarios.length} Destinatario${destinatarios.length !== 1 ? 's' : ''}`
                    }
                </Button>

                {/* Advertencia Webhook */}
                {(!process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL.includes('PLACEHOLDER')) && (
                    <Card className="border-2 border-yellow-500 bg-yellow-50">
                        <CardContent className="pt-6">
                            <p className="text-yellow-800 font-medium">
                                ⚠️ Webhook n8n no configurado. Los mensajes se simularán pero no se enviarán realmente.
                            </p>
                            <p className="text-sm text-yellow-700 mt-2">
                                Configura <code>NEXT_PUBLIC_N8N_WEBHOOK_URL</code> en <code>.env.local</code> para envíos reales.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </Layout>
    );
}
