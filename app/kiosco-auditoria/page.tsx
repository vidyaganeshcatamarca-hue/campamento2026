'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BarChart3, DollarSign, ShoppingBag, TrendingUp } from 'lucide-react';
import { formatCurrency, sendWhatsAppNotification } from '@/lib/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';

interface VentaDiaria {
    fecha: string;
    producto: string;
    cantidad_vendida: number;
    total_ventas: number;
}

interface ProductoRanking {
    producto: string;
    total_cantidad: number;
    total_monto: number;
    num_transacciones: number;
}

export default function KioscoAuditoriaPage() {
    const [loading, setLoading] = useState(true);
    const [fechaDesde, setFechaDesde] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [fechaHasta, setFechaHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [ventasDelDia, setVentasDelDia] = useState<VentaDiaria[]>([]);
    const [ventasPeriodo, setVentasPeriodo] = useState<VentaDiaria[]>([]);
    const [rendicionesPeriodo, setRendicionesPeriodo] = useState<any[]>([]); // Restored missing state
    const [ranking, setRanking] = useState<ProductoRanking[]>([]);
    const [totalDia, setTotalDia] = useState(0);
    const [transaccionesDia, setTransaccionesDia] = useState(0);
    const [rendicionPendienteGlobal, setRendicionPendienteGlobal] = useState(0);

    // Modal state
    const [showModalRendicion, setShowModalRendicion] = useState(false);
    const [montoRendicion, setMontoRendicion] = useState('');
    const [procesandoRendicion, setProcesandoRendicion] = useState(false);

    useEffect(() => {
        cargarDatos();
    }, [fechaDesde, fechaHasta]);

    useEffect(() => {
        cargarTotalesHistoricos();
    }, []);

    const cargarDatos = async () => {
        await Promise.all([
            cargarVentasHoy(),
            cargarVentasPeriodo(),
            cargarRendicionesPeriodo()
        ]);
        setLoading(false);
    };

    const cargarTotalesHistoricos = async () => {
        try {
            // 1. Total Ventas de vista diaria agregada (menos costoso que raw sales)
            const { data: ventas, error: vError } = await supabase
                .from('vista_ventas_kiosco_diarias')
                .select('producto, total_ventas');

            if (vError) throw vError;

            const totalVentas = (ventas || []).reduce((sum, v) => sum + v.total_ventas, 0);
            const totalEspeciales = (ventas || [])
                .filter(v => v.producto.toLowerCase().startsWith('prod'))
                .reduce((sum, v) => sum + v.total_ventas, 0);

            const totalCamping = totalVentas - totalEspeciales;

            // 2. Total Rendido
            const { data: rendiciones, error: rError } = await supabase
                .from('kiosco_rendiciones')
                .select('monto');

            if (rError) throw rError;

            const totalRendido = (rendiciones || []).reduce((sum, r) => sum + r.monto, 0);

            // 3. Pendiente = Camping - Rendido
            setRendicionPendienteGlobal(totalCamping - totalRendido);

        } catch (error) {
            console.error('Error cargando históricos:', error);
        }
    };

    // ... (rest of methods) ...

    const cargarVentasHoy = async () => {
        try {
            const hoy = format(new Date(), 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('vista_ventas_kiosco_diarias')
                .select('*')
                .eq('fecha', hoy);

            if (error) throw error;

            setVentasDelDia(data || []);

            const total = (data || []).reduce((sum, v) => sum + v.total_ventas, 0);
            const transacciones = (data || []).reduce((sum, v) => sum + v.cantidad_vendida, 0);

            setTotalDia(total);
            setTransaccionesDia(transacciones);

        } catch (error) {
            console.error('Error cargando ventas del día:', error);
        }
    };

    const cargarVentasPeriodo = async () => {
        try {
            const { data, error } = await supabase
                .from('vista_ventas_kiosco_diarias')
                .select('*')
                .gte('fecha', fechaDesde)
                .lte('fecha', fechaHasta)
                .order('fecha', { ascending: false });

            if (error) throw error;
            setVentasPeriodo(data || []);

        } catch (error) {
            console.error('Error cargando ventas del período:', error);
        }
    };

    const cargarRendicionesPeriodo = async () => {
        try {
            // Ajustar fechas para incluir todo el día de forma robusta
            const desde = new Date(`${fechaDesde}T00:00:00`);
            const hasta = new Date(`${fechaHasta}T23:59:59`);

            const { data, error } = await supabase
                .from('kiosco_rendiciones')
                .select('*')
                .gte('fecha_rendicion', desde.toISOString())
                .lte('fecha_rendicion', hasta.toISOString())
                .order('fecha_rendicion', { ascending: false });

            if (error) throw error;
            setRendicionesPeriodo(data || []);
        } catch (error) {
            console.error('Error cargando rendiciones:', error);
        }
    };

    // Calcular ranking basado en ventas del periodo (Client-side aggregation)
    useEffect(() => {
        if (ventasPeriodo.length === 0) {
            setRanking([]);
            return;
        }

        const stats: Record<string, ProductoRanking> = {};

        ventasPeriodo.forEach(v => {
            if (!stats[v.producto]) {
                stats[v.producto] = {
                    producto: v.producto,
                    total_cantidad: 0,
                    total_monto: 0,
                    num_transacciones: 0
                };
            }
            stats[v.producto].total_cantidad += v.cantidad_vendida;
            stats[v.producto].total_monto += v.total_ventas;
            stats[v.producto].num_transacciones += 1;
        });

        const sorted = Object.values(stats)
            .sort((a, b) => b.total_cantidad - a.total_cantidad)
            .slice(0, 3); // Top 3

        setRanking(sorted);
    }, [ventasPeriodo]);

    // Calcular metricas
    const totalVentasPeriodo = ventasPeriodo.reduce((sum, v) => sum + Number(v.total_ventas), 0);

    const totalEspeciales = ventasPeriodo
        .filter(v => v.producto.toLowerCase().startsWith('prod'))
        .reduce((sum, v) => sum + Number(v.total_ventas), 0);

    // Rendición Camping = (Ventas Totales - Productos Especiales)
    const rendicionCamping = totalVentasPeriodo - totalEspeciales;

    // FIX: Asegurar que monto se trate como numero (Supabase puede devolver string para numeric)
    const totalRendidoManual = rendicionesPeriodo.reduce((sum, r) => sum + Number(r.monto), 0);

    // Merge lists for Detail View (Timeline)
    const cronologiaCombinada = [
        ...ventasPeriodo.map(v => ({
            ...v,
            tipo: 'venta',
            fecha_display: v.fecha // from view (text YYYY-MM-DD)
        })),
        ...rendicionesPeriodo.map(r => ({
            fecha: format(new Date(r.fecha_rendicion), 'yyyy-MM-dd'),
            producto: r.concepto || 'Rendición',
            cantidad_vendida: 1,
            total_ventas: r.monto,
            tipo: 'rendicion',
            fecha_display: format(new Date(r.fecha_rendicion), 'yyyy-MM-dd')
        }))
    ].sort((a, b) => {
        // Sort by date descending
        return new Date(b.fecha_display).getTime() - new Date(a.fecha_display).getTime();
    });

    const handleAbrirModalRendicion = () => {
        setMontoRendicion('');
        setShowModalRendicion(true);
    };

    const handleConfirmarRendicion = async () => {
        const monto = parseFloat(montoRendicion);
        if (!monto || monto <= 0) {
            alert('Ingrese un monto válido');
            return;
        }

        setProcesandoRendicion(true);
        try {
            const fechaRendicion = new Date();
            fechaRendicion.setHours(12, 0, 0, 0); // Noon

            const { error } = await supabase
                .from('kiosco_rendiciones')
                .insert({
                    fecha_rendicion: fechaRendicion.toISOString(),
                    monto: monto,
                    concepto: 'Rendición Manual de Efectivo'
                });

            if (error) throw error;

            setShowModalRendicion(false);
            cargarRendicionesPeriodo(); // Reload
        } catch (error) {
            console.error(error);
            alert('Error al registrar rendición: ' + (error as any).message);
        } finally {
            setProcesandoRendicion(false);
        }
    };

    const cerrarCaja = async () => {
        const mensaje = `
🏪 *CIERRE DE CAJA KIOSCO*
📅 Fecha: ${format(new Date(), 'dd/MM/yyyy')}

💰 Total del día: ${formatCurrency(totalDia)}
🛒 Transacciones: ${transaccionesDia}

📊 Desglose por producto:
${ventasDelDia.map(v => `• ${v.producto}: ${v.cantidad_vendida} unidades - ${formatCurrency(v.total_ventas)}`).join('\n')}
        `.trim();

        await sendWhatsAppNotification({
            telefonos: ['5491234567890'], // Configurar número del administrador
            mensaje,
            tipo_mensaje: 'cierre_caja'
        });
    };

    if (loading) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <p className="text-muted">Cargando datos...</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-primary">
                            Auditoría de Kiosco
                        </h1>
                        <p className="text-muted mt-1">
                            Reportes financieros y cierre de caja
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleAbrirModalRendicion} variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                            <DollarSign className="w-4 h-4 mr-2" />
                            Rendir Dinero
                        </Button>
                        <Button onClick={cerrarCaja} variant="primary">
                            <DollarSign className="w-4 h-4 mr-2" />
                            Cerrar Caja
                        </Button>
                    </div>
                </div>

                {/* Resumen del día */}
                <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Total del Día</p>
                                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalDia)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                                    <ShoppingBag className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Transacciones</p>
                                    <p className="text-2xl font-bold">{transaccionesDia}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6 text-success" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted">Producto Top</p>
                                    <p className="text-lg font-bold">
                                        {ventasDelDia.length > 0
                                            ? ventasDelDia.reduce((max, v) => v.total_ventas > max.total_ventas ? v : max).producto
                                            : '-'
                                        }
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* REPORTE FINANCIERO */}
                    <Card className="border-l-4 border-l-blue-500">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Reporte Financiero
                            </CardTitle>
                            <p className="text-xs text-muted">Periodo: {format(new Date(fechaDesde + 'T12:00:00'), 'dd/MM/yyyy')} - {format(new Date(fechaHasta + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Total General */}
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <span className="font-medium">Total Productos Vendidos (Periodo)</span>
                                    <span className="text-xl font-bold text-primary">{formatCurrency(totalVentasPeriodo)}</span>
                                </div>

                                {/* Desglose */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 border rounded-lg">
                                        <p className="text-xs text-muted uppercase font-semibold">Productos Especiales</p>
                                        <p className="text-lg font-bold text-purple-700">{formatCurrency(totalEspeciales)}</p>
                                        <p className="text-xs text-muted mt-1">(Prod ...)</p>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                                        <p className="text-xs text-green-800 uppercase font-semibold">Rendición Camping</p>
                                        <p className="text-lg font-bold text-green-700">{formatCurrency(rendicionCamping)}</p>
                                        <p className="text-xs text-green-600 mt-1">(Total - Esp)</p>
                                    </div>
                                </div>

                                <div className="border-t pt-3 mt-2 grid md:grid-cols-2 gap-4">
                                    <div className="flex flex-col justify-center p-3 bg-gray-50 rounded border border-gray-200">
                                        <span className="font-medium text-gray-600 text-xs uppercase mb-1">Dinero Rendido (Periodo)</span>
                                        <span className="text-lg font-bold text-gray-800">{formatCurrency(totalRendidoManual)}</span>
                                    </div>

                                    {/* NEW METRIC: Rendición Pendiente Global */}
                                    <div className={`flex flex-col justify-center p-3 rounded border ${rendicionPendienteGlobal > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-medium text-xs uppercase mb-1 ${rendicionPendienteGlobal > 0 ? 'text-red-800' : 'text-green-800'}`}>
                                                Rendición Pendiente (Total)
                                            </span>
                                        </div>
                                        <span className={`text-xl font-bold ${rendicionPendienteGlobal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency(rendicionPendienteGlobal)}
                                        </span>
                                        <span className="text-[10px] text-gray-500">
                                            (Histórico Camping - Histórico Rendido)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ventas del día */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Ventas de Hoy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {ventasDelDia.length === 0 ? (
                                <p className="text-muted text-center py-8">No hay ventas registradas hoy</p>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                    {ventasDelDia.map(venta => (
                                        <div key={venta.producto} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                                            <div>
                                                <p className="font-medium">{venta.producto}</p>
                                                <p className="text-sm text-muted">{venta.cantidad_vendida} unidades</p>
                                            </div>
                                            <p className="font-semibold text-primary">
                                                {formatCurrency(venta.total_ventas)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Reporte por rango de fechas (Combinado) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Detalle del Período</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <Input
                                label="Fecha Desde"
                                type="date"
                                value={fechaDesde}
                                onChange={(e) => setFechaDesde(e.target.value)}
                            />
                            <Input
                                label="Fecha Hasta"
                                type="date"
                                value={fechaHasta}
                                onChange={(e) => setFechaHasta(e.target.value)}
                            />
                        </div>

                        {cronologiaCombinada.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left p-2">Fecha</th>
                                            <th className="text-left p-2">Producto / Concepto</th>
                                            <th className="text-right p-2">Cantidad</th>
                                            <th className="text-right p-2">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cronologiaCombinada.map((item, i) => (
                                            <tr key={i} className={`border-b border-gray-100 ${item.tipo === 'rendicion' ? 'bg-yellow-50/50' : ''}`}>
                                                <td className="p-2">{format(new Date(item.fecha + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                                                <td className="p-2">
                                                    {item.producto}
                                                    {item.tipo === 'rendicion' && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1 rounded">Rendición</span>}
                                                </td>
                                                <td className="p-2 text-right">{item.cantidad_vendida}</td>
                                                <td className="p-2 text-right font-semibold">{formatCurrency(item.total_ventas)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Modal de Rendición */}
                <Dialog open={showModalRendicion} onOpenChange={setShowModalRendicion}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle>Nueva Rendición de Efectivo</DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <p className="text-sm text-gray-500">
                                Ingrese el monto total del dinero que está entregando/rindiendo en la fecha de hoy.
                            </p>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Monto a Rendir</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        value={montoRendicion}
                                        onChange={(e) => setMontoRendicion(e.target.value)}
                                        className="w-full pl-8 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent text-lg font-bold"
                                        placeholder="0"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowModalRendicion(false)}
                                disabled={procesandoRendicion}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleConfirmarRendicion}
                                disabled={procesandoRendicion || !montoRendicion}
                                variant="primary"
                            >
                                {procesandoRendicion ? 'Guardando...' : 'Confirmar Rendición'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </Layout>
    );
}
