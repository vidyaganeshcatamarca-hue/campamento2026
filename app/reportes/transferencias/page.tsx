'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Download, Search, Filter } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

export default function ReporteTransferenciasPage() {
    const [pagos, setPagos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        setFechaDesde(inicioMes.toISOString().split('T')[0]);
        setFechaHasta(hoy.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if (fechaDesde && fechaHasta) {
            fetchPagos();
        }
    }, [fechaDesde, fechaHasta]);

    const fetchPagos = async () => {
        setLoading(true);
        try {
            // 1. Obtener pagos por transferencia en el rango
            const desde = new Date(fechaDesde + 'T00:00:00').toISOString();
            const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();

            // 2. Fetch Data
            let query = supabase
                .from('pagos')
                .select(`
                    id,
                    monto_abonado,
                    fecha_pago,
                    metodo_pago,
                    estadia_id, 
                    recibo_emitido
                `)
                // Fix: Search for both common casings or use ilike if possible, but distinct values usually 'Transferencia'
                .ilike('metodo_pago', 'transferencia');

            if (fechaDesde) query = query.gte('fecha_pago', fechaDesde + ' 00:00:00');
            if (fechaHasta) query = query.lte('fecha_pago', fechaHasta + ' 23:59:59');

            const { data: pagosData, error: pagosError } = await query;

            if (pagosError) throw pagosError;
            if (!pagosData) {
                setPagos([]);
                return;
            }

            console.log("Pagos fetched:", pagosData.length);

            // Enriquecer con datos del responsable
            const pagosEnriquecidos = await Promise.all(pagosData.map(async (pago) => {
                // Verify pago.estadia_id exists
                if (!pago.estadia_id) {
                    console.warn(`Pago ${pago.id} no tiene estadia_id`);
                    return { ...pago, responsable_nombre: 'Sin Estadía (Huérfano)', responsable_dni: '-', responsable_celular: '-' };
                }

                // 1. Intentar buscar acampantes
                const { data: acampantes, error: errAcamp } = await supabase
                    .from('acampantes')
                    .select('nombre_completo, dni, celular, es_responsable_pago')
                    .eq('estadia_id', pago.estadia_id);

                if (errAcamp) console.error("Error fetching acampantes:", errAcamp);

                let nombre = 'Desconocido';
                let dni = '-';
                let celular = '-';

                if (acampantes && acampantes.length > 0) {
                    const responsable = acampantes.find(a => a.es_responsable_pago);
                    const candidato = responsable || acampantes[0];
                    nombre = candidato.nombre_completo || 'Sin Nombre';
                    dni = candidato.dni || '-';
                    celular = candidato.celular || '-';
                } else {
                    // 2. Fallback: Buscar datos en la estadía misma
                    console.log(`Fallback Estadia para Pago ${pago.id} (Estadia ${pago.estadia_id})`);
                    const { data: estadia } = await supabase
                        .from('estadias')
                        .select('celular_responsable, observaciones')
                        .eq('id', pago.estadia_id)
                        .single();

                    if (estadia) {
                        celular = estadia.celular_responsable || '-';
                        if (estadia.observaciones && estadia.observaciones.includes('Nombre:')) {
                            nombre = estadia.observaciones.split('Nombre:')[1]?.split('\n')[0]?.trim() || 'Desconocido (Obs)';
                        }
                    } else {
                        console.warn(`Estadia ${pago.estadia_id} no encontrada en tabla estadias`);
                    }
                }

                return {
                    ...pago,
                    responsable_nombre: nombre,
                    responsable_dni: dni,
                    responsable_celular: celular,
                    recibo_emitido: pago.recibo_emitido || false
                };
            }));

            setPagos(pagosEnriquecidos);

        } catch (error) {
            console.error('Error cargando reporte:', error);
            toast.error('Error al cargar los pagos');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRecibo = async (id: number, current: boolean) => {
        // Optimistic UI update
        const updatedPagos = pagos.map(p =>
            p.id === id ? { ...p, recibo_emitido: !current } : p
        );
        setPagos(updatedPagos);

        try {
            const { error } = await supabase
                .from('pagos')
                .update({ recibo_emitido: !current })
                .eq('id', id);

            if (error) throw error;
            toast.success('Estado actualizado');
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar estado');
            // Revert on error
            setPagos(pagos);
        }
    };

    const handleExportar = () => {
        // Filter out manual receipts per request
        const pagosExportables = pagos.filter(p => p.recibo_emitido === false);

        if (pagosExportables.length === 0) {
            toast.error('No hay pagos pendientes de recibo para exportar.');
            return;
        }

        // CSV Headers matching request
        const headers = ['Fecha', 'Monto', 'Responsable', 'DNI'];

        const csvContent = [
            headers.join(','),
            ...pagosExportables.map(p => {
                const fecha = new Date(p.fecha_pago).toLocaleDateString('es-AR');
                // Force number format just in case
                const monto = p.monto_abonado;
                // Ensure name/dni match the enriched fields
                const nombre = `"${p.responsable_nombre || 'Desconocido'}"`;
                const dni = `"${p.responsable_dni || '-'}"`; // Quote DNI to prevent scientific notation if long

                return [fecha, monto, nombre, dni].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_transferencias_pendientes_${fechaDesde}_${fechaHasta}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const pagosFiltrados = pagos.filter(p =>
        p.responsable_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.responsable_dni && p.responsable_dni.includes(busqueda))
    );

    const totalPeriodo = pagosFiltrados.reduce((sum, p) => sum + p.monto_abonado, 0);

    return (
        <Layout>
            <div className="space-y-6 max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Reporte de Transferencias</h1>
                        <p className="text-muted">Listado de pagos recibidos vía transferencia bancaria</p>
                    </div>
                    <Button onClick={handleExportar} disabled={pagos.length === 0} variant="outline" className="flex items-center gap-2">
                        <Download className="w-4 h-4" /> Exportar CSV
                    </Button>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <div className="relative">
                                <Search className="absolute left-3 top-9 w-4 h-4 text-muted" />
                                <Input
                                    label="Buscar (Nombre/DNI)"
                                    placeholder="Ej: Juan Perez"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Resultados ({pagosFiltrados.length})</span>
                        <Badge variant="success" className="text-lg px-3 py-1">
                            Total: {formatCurrency(totalPeriodo)}
                        </Badge>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Responsable</th>
                                    <th className="px-4 py-3">DNI</th>
                                    <th className="px-4 py-3">Celular</th>
                                    <th className="px-4 py-3 text-right">Monto</th>
                                    <th className="px-4 py-3 text-center">Recibo Manual</th>
                                    <th className="px-4 py-3 text-center">ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-muted">Cargando datos...</td>
                                    </tr>
                                ) : pagosFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-muted">No se encontraron pagos en este período.</td>
                                    </tr>
                                ) : (
                                    pagosFiltrados.map((pago) => (
                                        <tr key={pago.id} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3 font-medium">
                                                {new Date(pago.fecha_pago).toLocaleDateString('es-AR')}
                                                <span className="text-xs text-muted block">
                                                    {new Date(pago.fecha_pago).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-foreground">{pago.responsable_nombre}</td>
                                            <td className="px-4 py-3 text-muted">{pago.responsable_dni}</td>
                                            <td className="px-4 py-3 text-muted">{pago.responsable_celular}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                                                {formatCurrency(pago.monto_abonado)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={pago.recibo_emitido || false}
                                                    onChange={() => handleToggleRecibo(pago.id, pago.recibo_emitido)}
                                                    className="w-5 h-5 cursor-pointer accent-primary"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge variant="outline" className="text-[10px] bg-gray-50 text-muted">
                                                    {pago.estadia_id.slice(0, 6)}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
