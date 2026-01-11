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
    const [ranking, setRanking] = useState<ProductoRanking[]>([]);
    const [totalDia, setTotalDia] = useState(0);
    const [transaccionesDia, setTransaccionesDia] = useState(0);

    useEffect(() => {
        cargarDatos();
    }, []);

    useEffect(() => {
        if (!loading) {
            cargarVentasPeriodo();
        }
    }, [fechaDesde, fechaHasta]);

    const cargarDatos = async () => {
        await Promise.all([
            cargarVentasHoy(),
            cargarRanking(),
            cargarVentasPeriodo() // Agregado para cargar período inicial
        ]);
        setLoading(false);
    };

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

    const cargarRanking = async () => {
        try {
            const { data, error } = await supabase
                .from('vista_productos_mas_vendidos')
                .select('*')
                .limit(5);

            if (error) throw error;
            setRanking(data || []);

        } catch (error) {
            console.error('Error cargando ranking:', error);
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

    const totalPeriodo = ventasPeriodo.reduce((sum, v) => sum + v.total_ventas, 0);

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
                            Reportes y cierre de caja diario
                        </p>
                    </div>
                    <Button onClick={cerrarCaja} variant="primary">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Cerrar Caja
                    </Button>
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
                    {/* Ranking de productos */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Top 5 Productos Más Vendidos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {ranking.map((producto, index) => (
                                    <div key={producto.producto} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{producto.producto}</p>
                                            <p className="text-sm text-muted">
                                                {producto.total_cantidad} unidades • {producto.num_transacciones} transacciones
                                            </p>
                                        </div>
                                        <p className="font-bold text-primary">
                                            {formatCurrency(producto.total_monto)}
                                        </p>
                                    </div>
                                ))}
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
                                <div className="space-y-2">
                                    {ventasDelDia.map(venta => (
                                        <div key={venta.producto} className="flex justify-between items-center py-2 border-b border-gray-100">
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

                {/* Reporte por rango de fechas */}
                <Card>
                    <CardHeader>
                        <CardTitle>Reporte por Período</CardTitle>
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

                        <div className="bg-accent/10 p-4 rounded-lg">
                            <p className="text-sm text-muted mb-1">Total del Período</p>
                            <p className="text-3xl font-bold text-primary">{formatCurrency(totalPeriodo)}</p>
                        </div>

                        {ventasPeriodo.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left p-2">Fecha</th>
                                            <th className="text-left p-2">Producto</th>
                                            <th className="text-right p-2">Cantidad</th>
                                            <th className="text-right p-2">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ventasPeriodo.map((venta, i) => (
                                            <tr key={i} className="border-b border-gray-100">
                                                <td className="p-2">{format(new Date(venta.fecha + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                                                <td className="p-2">{venta.producto}</td>
                                                <td className="p-2 text-right">{venta.cantidad_vendida}</td>
                                                <td className="p-2 text-right font-semibold">{formatCurrency(venta.total_ventas)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
