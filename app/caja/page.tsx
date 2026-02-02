'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DollarSign, TrendingUp, Users, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function CajaPage() {
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes' | 'custom'>('hoy');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    const [totalCobrado, setTotalCobrado] = useState(0);
    const [totalAdeudado, setTotalAdeudado] = useState(0);
    const [pagosPorMetodo, setPagosPorMetodo] = useState<{ [key: string]: number }>({});
    const [promedioEstadia, setPromedioEstadia] = useState(0);

    // Estadísticas de kiosco
    const [totalKiosco, setTotalKiosco] = useState(0);
    const [ventasKiosco, setVentasKiosco] = useState<any[]>([]);

    const [totalVisitas, setTotalVisitas] = useState(0);

    useEffect(() => {
        fetchEstadisticas();
    }, [periodo, fechaDesde, fechaHasta]);

    const fetchEstadisticas = async () => {
        setLoading(true);
        try {
            const { fechaInicio, fechaFin } = calcularRangoFechas();

            // 1. Total cobrado camping (Pagos)
            const { data: pagosData } = await supabase
                .from('pagos')
                .select('monto_abonado, metodo_pago, estadia_id')
                .gte('fecha_pago', fechaInicio)
                .lte('fecha_pago', fechaFin);

            const totalPagosCamping = pagosData?.reduce((sum, p) => sum + p.monto_abonado, 0) || 0;

            // 2. Total Visitas Diarias
            // Usamos fecha_visita como referencia (corregido)
            const { data: visitasData } = await supabase
                .from('visitas_diarias')
                .select('monto_pagado') // Corrected column name based on user schema
                .gte('fecha_visita', fechaInicio)
                .lte('fecha_visita', fechaFin);

            const totalVisitas = visitasData?.reduce((sum, v) => sum + (v.monto_pagado || 0), 0) || 0;
            setTotalVisitas(totalVisitas);

            // Total Cobrado = Camping + Visitas
            setTotalCobrado(totalPagosCamping + totalVisitas);

            // Pagos por método (Solo aplica a pagos de camping por ahora)
            const metodosMap: { [key: string]: number } = {};
            pagosData?.forEach(p => {
                metodosMap[p.metodo_pago] = (metodosMap[p.metodo_pago] || 0) + p.monto_abonado;
            });

            setPagosPorMetodo(metodosMap);

            // Total adeudado (personas ingresadas con saldo pendiente)
            // FIX: Coincidir con Dashboard y Deudores (Solo Activas, Saldo Neto Grupal)
            const { data: estadiasData } = await supabase
                .from('vista_estadias_con_totales')
                .select('saldo_pendiente, celular_responsable')
                .eq('ingreso_confirmado', true)
                .eq('estado_estadia', 'activa');

            // Calcular deuda neta por responsable
            const balancePorResponsable: Record<string, number> = {};
            estadiasData?.forEach(e => {
                const tel = e.celular_responsable || 'unknown';
                balancePorResponsable[tel] = (balancePorResponsable[tel] || 0) + (e.saldo_pendiente || 0);
            });

            // Solo sumar si el saldo NETO del grupo es deuda
            const deuda = Object.values(balancePorResponsable).reduce((sum, netBalance) => {
                return sum + (netBalance > 10 ? netBalance : 0);
            }, 0);

            setTotalAdeudado(deuda);

            // Promedio por estadía
            if (pagosData && pagosData.length > 0) {
                const estadiasUnicas = new Set(pagosData.map((p: any) => p.estadia_id)).size;
                setPromedioEstadia(estadiasUnicas > 0 ? totalPagosCamping / estadiasUnicas : 0);
            }

            // Ventas de kiosco AGREGADAS
            const { data: kioscoData } = await supabase
                .from('vista_ventas_kiosco_diarias')
                .select('*')
                .gte('fecha', fechaInicio.split('T')[0])
                .lte('fecha', fechaFin.split('T')[0]);

            const totalK = kioscoData?.reduce((sum, v) => sum + v.total_ventas, 0) || 0;
            setTotalKiosco(totalK);

            // Agrupar por Producto
            const kioscoAgrupado: Record<string, any> = {};
            kioscoData?.forEach(v => {
                if (!kioscoAgrupado[v.producto]) {
                    kioscoAgrupado[v.producto] = {
                        producto: v.producto,
                        cantidad_vendida: 0,
                        total_ventas: 0
                    };
                }
                kioscoAgrupado[v.producto].cantidad_vendida += v.cantidad_vendida;
                kioscoAgrupado[v.producto].total_ventas += v.total_ventas;
            });

            setVentasKiosco(Object.values(kioscoAgrupado));

        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const calcularRangoFechas = () => {
        const ahora = new Date();
        let fechaInicio = new Date();

        if (periodo === 'custom') {
            if (fechaDesde && fechaHasta) {
                return {
                    fechaInicio: new Date(fechaDesde + 'T00:00:00').toISOString(),
                    fechaFin: new Date(fechaHasta + 'T23:59:59').toISOString(),
                };
            }
        }

        if (periodo === 'hoy') {
            fechaInicio.setHours(0, 0, 0, 0);
        } else if (periodo === 'semana') {
            fechaInicio.setDate(ahora.getDate() - 7);
        } else if (periodo === 'mes') {
            fechaInicio.setMonth(ahora.getMonth() - 1);
        }

        return {
            fechaInicio: fechaInicio.toISOString(),
            fechaFin: ahora.toISOString(),
        };
    };

    const handleExport = () => {
        // 1. Prepare CSV Content
        const rows = [
            ['Reporte de Caja', `Generado el: ${new Date().toLocaleString()}`],
            [''],
            ['Resumen Financiero'],
            ['Concepto', 'Monto'],
            ['Total Facturado (Camping)', totalCobrado - totalVisitas],
            ['Total Visitas', totalVisitas],
            ['Total Facturado (General)', totalCobrado],
            ['Total Kiosco', totalKiosco],
            ['Total General', totalCobrado + totalKiosco],
            ['Total Adeudado', totalAdeudado],
            [''],
            ['Desglose por Metodo de Pago'],
            ['Metodo', 'Monto']
        ];

        // Add Payment Methods
        Object.entries(pagosPorMetodo).forEach(([metodo, monto]) => {
            rows.push([metodo, monto]);
        });

        rows.push(['']);
        rows.push(['Ventas Kiosco']);
        rows.push(['Producto', 'Cantidad', 'Total']);

        // Add Kiosk Sales
        ventasKiosco.forEach(v => {
            rows.push([v.producto, v.cantidad_vendida, v.total_ventas]);
        });

        // 2. Convert to CSV String
        const csvContent = rows.map(e => e.join(",")).join("\n");

        // 3. Trigger Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `cierre_caja_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                        Cierre de Caja
                    </h1>
                    <p className="text-muted mt-1">
                        Estadísticas financieras y reportes
                    </p>
                </div>

                {/* Selector de Período */}
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <Button
                            variant={periodo === 'hoy' ? 'primary' : 'outline'}
                            onClick={() => setPeriodo('hoy')}
                        >
                            Hoy
                        </Button>
                        <Button
                            variant={periodo === 'semana' ? 'primary' : 'outline'}
                            onClick={() => setPeriodo('semana')}
                        >
                            Esta Semana
                        </Button>
                        <Button
                            variant={periodo === 'mes' ? 'primary' : 'outline'}
                            onClick={() => setPeriodo('mes')}
                        >
                            Este Mes
                        </Button>
                        <Button
                            variant={periodo === 'custom' ? 'primary' : 'outline'}
                            onClick={() => setPeriodo('custom')}
                        >
                            Personalizado
                        </Button>
                    </div>

                    {periodo === 'custom' && (
                        <div className="flex gap-3 items-end">
                            <Input
                                label="Desde"
                                type="date"
                                value={fechaDesde}
                                onChange={(e) => setFechaDesde(e.target.value)}
                            />
                            <Input
                                label="Hasta"
                                type="date"
                                value={fechaHasta}
                                onChange={(e) => setFechaHasta(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* KPIs Financieros */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-green-100 rounded-lg">
                                    <DollarSign className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Total Facturado</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {formatCurrency(totalCobrado)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-danger/10 rounded-lg">
                                    <DollarSign className="w-6 h-6 text-danger" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Total Adeudado</p>
                                    <p className="text-2xl font-bold text-danger">
                                        {formatCurrency(totalAdeudado)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-100 rounded-lg">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Ingresos Visitas</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {formatCurrency(totalVisitas)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-accent/10 rounded-lg">
                                    <TrendingUp className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Promedio/Estadía</p>
                                    <p className="text-2xl font-bold text-accent">
                                        {formatCurrency(promedioEstadia)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Ingresos por Método */}
                <Card>
                    <CardHeader>
                        <CardTitle>Ingresos por Método de Pago</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {Object.keys(pagosPorMetodo).length === 0 ? (
                            <p className="text-muted text-center py-4">No hay pagos en este período</p>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(pagosPorMetodo).map(([metodo, monto]) => (
                                    <div key={metodo} className="flex items-center justify-between p-3 bg-secondary/10 rounded">
                                        <span className="font-medium">{metodo}</span>
                                        <span className="text-lg font-bold text-primary">
                                            {formatCurrency(monto)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Facturación Kiosco */}
                <Card>
                    <CardHeader>
                        <CardTitle>Facturación Kios co</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-accent/10 rounded-lg">
                                <span className="font-semibold">Total Kiosco:</span>
                                <span className="text-2xl font-bold text-accent">
                                    {formatCurrency(totalKiosco)}
                                </span>
                            </div>

                            {ventasKiosco.length > 0 && (
                                <div>
                                    <p className="text-sm text-muted mb-2">Desglose por producto:</p>
                                    <div className="space-y-2">
                                        {ventasKiosco.map((venta, i) => (
                                            <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100">
                                                <span>{venta.producto} ({venta.cantidad_vendida})</span>
                                                <span className="font-semibold">{formatCurrency(venta.total_ventas)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Total General */}
                <Card className="bg-primary/5 border-2 border-primary">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-muted">Facturación Total (Camping + Kiosco)</p>
                                <p className="text-3xl font-bold text-primary mt-1">
                                    {formatCurrency(totalCobrado + totalKiosco)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Botón Exportar */}
                <Button variant="outline" className="w-full md:w-auto" onClick={handleExport}>
                    <Download className="w-5 h-5 mr-2" />
                    Exportar Reporte (CSV)
                </Button>
            </div>
        </Layout>
    );
}
