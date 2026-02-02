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
            // 1. Obtener candidatos (gente con deuda en alguna estadía)
            let query = supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('ingreso_confirmado', true)
                .neq('estado_estadia', 'cancelada')
                .neq('estado_estadia', 'reservada')
                .gt('saldo_pendiente', 10);

            if (filtro === 'activos') query = query.eq('estado_estadia', 'activa');
            else if (filtro === 'finalizados') query = query.eq('estado_estadia', 'finalizada');

            const { data: candidatos, error } = await query;
            if (error) throw error;

            if (!candidatos || candidatos.length === 0) {
                setDeudores([]);
                setTotalAdeudado(0);
                return;
            }

            // 2. Obtener TODAS las estadías relacionadas a estos responsables para neto grupal
            const telefonos = [...new Set(candidatos.map(c => c.celular_responsable))];

            const { data: gruposCompleto, error: grupoError } = await supabase
                .from('vista_estadias_con_totales')
                .select('id, celular_responsable, saldo_pendiente, estadia_id:id') // Seleccionamos lo necesario
                .in('celular_responsable', telefonos)
                .neq('estado_estadia', 'cancelada');

            if (grupoError) throw grupoError;

            // 3. Calcular balances netos por responsable
            const balancePorResponsable: Record<string, number> = {};
            gruposCompleto?.forEach(g => {
                const tel = g.celular_responsable || 'unknown';
                balancePorResponsable[tel] = (balancePorResponsable[tel] || 0) + (g.saldo_pendiente || 0);
            });

            // 4. Filtrar y construir lista final
            const deudoresInfo: DeudorInfo[] = [];
            let totalGeneral = 0;
            const procesados = new Set<string>(); // Para evitar duplicados si un responsable tiene 2 estadías con deuda

            for (const item of candidatos) {
                const tel = item.celular_responsable || 'unknown';
                const saldoNeto = balancePorResponsable[tel] || 0;

                // Solo si el SALDO NETO del grupo es deuda (> 100 por margen)
                // Y no hemos procesado a este responsable ya (se muestra una vez por grupo o por estadía?)
                // Si mostramos por estadía, mostramos solo si el grupo debe.
                // Pero si el grupo debe, ¿qué estadía mostramos? ¿La que tiene deuda?

                if (saldoNeto > 100) {
                    // Obtener datos del responsable (cachear si es posible, pero son pocos)
                    const { data: responsable } = await supabase
                        .from('acampantes')
                        .select('*')
                        .eq('estadia_id', item.id)
                        .eq('es_responsable_pago', true)
                        .single();

                    if (responsable) {
                        // Modificar el objeto estadía para reflejar el saldo neto? 
                        // Ojo: Si modificamos saldo_pendiente visualmente, puede confundir con el real.
                        // Mejor mostrar la estadía deudora, pero saber que es deuda legítima.

                        deudoresInfo.push({
                            estadia: item,
                            responsable: responsable,
                        });
                        totalGeneral += (item.saldo_pendiente || 0); // Sumamos lo que debe ESTA estadía al total general listado
                    }
                }
            }

            // Ordenar por deuda
            deudoresInfo.sort((a, b) => b.estadia.saldo_pendiente - a.estadia.saldo_pendiente);

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
