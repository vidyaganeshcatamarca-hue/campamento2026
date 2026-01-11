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
            // 1. Obtener estadías visibles (confirmadas) y con saldo > 0 según vista (filtro inicial)
            // Nota: El filtro de saldo > 0 aquí es solo una optimización inicial, 
            // pero la verdad es que alguien podría tener saldo 0 en SU estadía y DEUDA en otras.
            // Para ser estrictos y ver "Todos los deudores", deberíamos traer todas las activas confirmadas
            // y luego filtrar por deuda real global.
            let query = supabase
                .from('vista_estadias_con_totales')
                .select('*')
                // .gt('saldo_pendiente', 0) // REMOVED: Filtraremos después por saldo real
                .eq('ingreso_confirmado', true); // IMPORTANTE: Solo ingresados

            if (filtro === 'activos') {
                query = query.eq('estado_estadia', 'activa');
            } else if (filtro === 'finalizados') {
                query = query.eq('estado_estadia', 'finalizada');
            }

            const { data: estadiasData, error } = await query;
            if (error) throw error;

            // 2. Lógica de Agrupación Profunda (Idéntica al Dashboard)
            const responsablesVisibles = new Set<string>();
            (estadiasData || []).forEach(e => {
                if (e.celular_responsable) {
                    responsablesVisibles.add(normalizePhone(e.celular_responsable));
                }
            });

            const saldosPorResponsable = new Map<string, number>();
            const pagosPorResponsable = new Map<string, number>();

            if (responsablesVisibles.size > 0) {
                // Traer TODAS las estadías del sistema para estos responsables (incluso no confirmadas)
                // para sumar su deuda total real.
                const { data: grupoData } = await supabase
                    .from('vista_estadias_con_totales')
                    .select('id, celular_responsable, monto_total_final')
                    .neq('estado_estadia', 'cancelada');

                const grupoRelevante = (grupoData || []).filter(g =>
                    responsablesVisibles.has(normalizePhone(g.celular_responsable))
                );

                // Sumar Deudas
                grupoRelevante.forEach(g => {
                    const key = normalizePhone(g.celular_responsable);
                    const actual = saldosPorResponsable.get(key) || 0;
                    saldosPorResponsable.set(key, actual + (g.monto_total_final || 0));
                });

                // Traer Pagos
                const idsGrupo = grupoRelevante.map(g => g.id);
                if (idsGrupo.length > 0) {
                    const { data: pagosGrupo } = await supabase
                        .from('pagos')
                        .select('monto_abonado, estadia_id')
                        .in('estadia_id', idsGrupo);

                    const mapIdCelular = new Map<string, string>();
                    grupoRelevante.forEach(g => mapIdCelular.set(g.id, normalizePhone(g.celular_responsable)));

                    pagosGrupo?.forEach(p => {
                        if (p.estadia_id && mapIdCelular.has(p.estadia_id)) {
                            const key = mapIdCelular.get(p.estadia_id)!;
                            const pagado = pagosPorResponsable.get(key) || 0;
                            pagosPorResponsable.set(key, pagado + p.monto_abonado);
                        }
                    });
                }
            }

            // 3. Construir lista final
            const deudoresInfo: DeudorInfo[] = [];
            let total = 0;

            // Para evitar duplicados en la lista (si el mismo responsable tiene 2 estadías activas),
            // ¿deberíamos mostrarlo una sola vez o listar cada estadía?
            // El usuario pidió "los que tienen saldo negativo". Generalmente se lista por Estadía o por Responsable.
            // Mantendremos el enfoque por Estadía pero mostrando el saldo real global.
            // Ojo: Si mostramos cada estadía y sumamos el saldo global al total, duplicaremos el "Total Adeudado" KPI.

            // Mejor estrategia: Set de responsables ya procesados para el KPI de Total.
            const responsablesProcesados = new Set<string>();

            for (const estadia of estadiasData || []) {
                const normKey = normalizePhone(estadia.celular_responsable);
                const safeKey = normKey === 'unknown' ? `id_${estadia.id}` : normKey;

                const deudaTotal = saldosPorResponsable.get(safeKey) ?? estadia.monto_total_final ?? 0;
                const pagosTotal = pagosPorResponsable.get(safeKey) ?? 0;
                const saldoReal = deudaTotal - pagosTotal;

                if (saldoReal > 100) { // Umbral mínimo para considerar deuda (evita 0.00001)
                    const { data: responsable } = await supabase
                        .from('acampantes')
                        .select('*')
                        .eq('estadia_id', estadia.id)
                        .eq('es_responsable_pago', true)
                        .single();

                    if (responsable) {
                        // Modificamos el objeto estadia visualmente para mostrar el saldo real
                        // (Hack: sobrescribimos saldo_pendiente en el objeto local)
                        const estadiaVisual = { ...estadia, saldo_pendiente: saldoReal };

                        deudoresInfo.push({
                            estadia: estadiaVisual,
                            responsable,
                        });

                        // Sumar al total general SOLO si no sumamos ya a este responsable (para no duplicar deuda de grupo)
                        if (!responsablesProcesados.has(safeKey)) {
                            total += saldoReal;
                            responsablesProcesados.add(safeKey);
                        }
                    }
                }
            }

            // Ordenar por deuda
            deudoresInfo.sort((a, b) => b.estadia.saldo_pendiente - a.estadia.saldo_pendiente);

            setDeudores(deudoresInfo);
            setTotalAdeudado(total);

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
