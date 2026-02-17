'use client';

import React, { useState, useEffect } from 'react';
import { supabase, VistaEstadiaConTotales, Acampante } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, DollarSign, Phone, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DeudorInfo {
    estadia: VistaEstadiaConTotales;
    responsable: Acampante;
    dias_desde_salida?: number;
}

export default function DeudoresPage() {
    const [loading, setLoading] = useState(true);
    const [deudores, setDeudores] = useState<DeudorInfo[]>([]);
    const [filtro, setFiltro] = useState<'todos' | 'activos' | 'finalizados'>('todos');
    const [totalAdeudado, setTotalAdeudado] = useState(0);

    useEffect(() => {
        fetchDeudores();
    }, [filtro]);

    // Helper
    const normalizePhone = (phone: string | null | undefined) => {
        if (!phone) return 'unknown';
        return phone.replace(/\D/g, '').trim();
    };

    const fetchDeudores = async () => {
        setLoading(true);
        try {
            // 1. Obtener candidatos (gente cuya deuda GRUPAL es > 10)
            let query = supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('ingreso_confirmado', true)
                .neq('estado_estadia', 'cancelada')
                .neq('estado_estadia', 'reservada')
                // FIX: Usar la nueva columna de deuda grupal para el filtro
                .gt('saldo_pendiente_grupal', 10);

            if (filtro === 'activos') query = query.eq('estado_estadia', 'activa');
            else if (filtro === 'finalizados') query = query.eq('estado_estadia', 'finalizada');

            const { data: candidatos, error } = await query;
            if (error) throw error;

            if (!candidatos || candidatos.length === 0) {
                setDeudores([]);
                setTotalAdeudado(0);
                return;
            }

            // 2. Construir lista final
            // Ya vienen filtrados correctamente por la vista.
            // Solo necesitamos mapear y obtener el responsable (que a veces es el mismo item o hay que buscarlo si la estadía listada no es la del responsable)
            // Estrategia: La vista devuelve estadías. Si una estadía tiene deuda grupal, la mostramos.
            // Pero queremos mostrar al "Responsable" y el monto total.

            // Agrupar por responsable para mostrar una sola tarjeta por grupo?
            // Actualmente el código original mostraba una tarjeta por item filtrado si el grupo debía.
            // Si el grupo debe 50k, y tiene 3 estadías, ¿mostramos 3 tarjetas de 50k? Sería confuso.
            // Mejor mostrar UNA tarjeta por celular_responsable.

            const uniques: Record<string, DeudorInfo> = {};
            let totalGeneral = 0;

            for (const item of candidatos) {
                const tel = item.celular_responsable;
                if (!uniques[tel]) {
                    // Fetch real contact data just in case
                    const { data: responsable } = await supabase
                        .from('acampantes')
                        .select('*')
                        .eq('estadia_id', item.id) // Usamos esta estadía para sacar datos del contacto
                        .eq('es_responsable_pago', true)
                        .single();

                    // Fallback to item data if responsable fetch fails or isn't found (using item as simple object)
                    const acampanteFallback: Acampante = {
                        celular: item.celular_responsable,
                        nombre_completo: `Grupo ${item.celular_responsable}`,
                        estadia_id: item.id
                    };

                    uniques[tel] = {
                        estadia: item,
                        responsable: responsable || acampanteFallback
                    };

                    // El total deuda es la suma de los saldos grupales únicos
                    // OJO: item.saldo_pendiente_grupal es el total del grupo.
                    // Si sumamos los de todos los grupos únicos, tenemos el total general real.
                    totalGeneral += (item.saldo_pendiente_grupal || 0);
                }
            }

            const deudoresInfo = Object.values(uniques);

            // Ordenar por deuda grupal desc
            deudoresInfo.sort((a, b) => (b.estadia.saldo_pendiente_grupal || 0) - (a.estadia.saldo_pendiente_grupal || 0));

            setDeudores(deudoresInfo);
            setTotalAdeudado(totalGeneral);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };


    const handleRegistrarPago = (estadiaId: string) => {
        window.location.href = `/saldo/${estadiaId}`;
    };

    const handleEnviarRecordatorio = (celular: string) => {
        console.log(`Recordatorio enviado a ${celular}`);
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
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">
                        Gestión de Deudores
                    </h1>
                    <p className="text-muted mt-1">
                        Estadías con saldo pendiente
                    </p>
                </div>

                {/* KPI Total Adeudado */}
                <Card className="border-2 border-danger">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-danger/10 rounded-lg">
                                    <AlertTriangle className="w-8 h-8 text-danger" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Total Adeudado</p>
                                    <p className="text-3xl font-bold text-danger">
                                        {formatCurrency(totalAdeudado)}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-muted">Deudores</p>
                                <p className="text-2xl font-bold">{deudores.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex gap-2">
                    <Button
                        variant={filtro === 'todos' ? 'primary' : 'outline'}
                        onClick={() => setFiltro('todos')}
                    >
                        Todos
                    </Button>
                    <Button
                        variant={filtro === 'activos' ? 'primary' : 'outline'}
                        onClick={() => setFiltro('activos')}
                    >
                        Activos
                    </Button>
                    <Button
                        variant={filtro === 'finalizados' ? 'primary' : 'outline'}
                        onClick={() => setFiltro('finalizados')}
                    >
                        Finalizados
                    </Button>
                </div>

                {/* Lista de Deudores */}
                <div className="space-y-3">
                    {deudores.length === 0 ? (
                        <Card>
                            <CardContent className="text-center py-8 text-muted">
                                ✅ No hay deudores en esta categoría
                            </CardContent>
                        </Card>
                    ) : (
                        deudores.map(({ estadia, responsable }) => (
                            <Card key={estadia.id} className="hover:shadow-lg transition-shadow">
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-bold">{responsable.nombre_completo}</h3>
                                                <Badge variant={estadia.estado_estadia === 'activa' ? 'primary' : 'secondary'}>
                                                    {estadia.estado_estadia}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-muted mb-2">
                                                <Phone className="w-4 h-4" />
                                                <span>{estadia.celular_responsable}</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-muted">Ingreso:</span>
                                                    <span className="ml-2 font-medium">
                                                        {new Date(estadia.fecha_ingreso || '').toLocaleDateString('es-AR')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted">Egreso:</span>
                                                    <span className="ml-2 font-medium">
                                                        {new Date(estadia.fecha_egreso_programada).toLocaleDateString('es-AR')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-sm text-muted mb-1">Debe:</p>
                                            <p className="text-2xl font-bold text-danger mb-4">
                                                {formatCurrency(estadia.saldo_pendiente)}
                                            </p>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEnviarRecordatorio(estadia.celular_responsable)}
                                                >
                                                    <Send className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => handleRegistrarPago(estadia.id)}
                                                >
                                                    <DollarSign className="w-4 h-4 mr-1" />
                                                    Pagar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    );
}
