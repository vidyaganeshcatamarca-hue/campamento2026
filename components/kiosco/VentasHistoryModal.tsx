import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Search, Save, X, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface VentasHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onVentaUpdated: () => void; // Callback to refresh parent data
}

export function VentasHistoryModal({ isOpen, onClose, onVentaUpdated }: VentasHistoryModalProps) {
    const [fechaDesde, setFechaDesde] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [fechaHasta, setFechaHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [busqueda, setBusqueda] = useState('');
    const [ventas, setVentas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ cantidad: 0, total: 0 });

    useEffect(() => {
        if (isOpen) {
            fetchVentas();
        }
    }, [isOpen, fechaDesde, fechaHasta]);

    const fetchVentas = async () => {
        setLoading(true);
        try {
            const desde = new Date(fechaDesde + 'T00:00:00').toISOString();
            const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();

            let query = supabase
                .from('kiosco_ventas')
                .select('*')
                .gte('fecha', desde)
                .lte('fecha', hasta)
                .order('fecha', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            setVentas(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando historial');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (venta: any) => {
        setEditingId(venta.id);
        setEditForm({
            cantidad: venta.cantidad,
            total: venta.total
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    const handleSaveEdit = async (id: number) => {
        try {
            const { error } = await supabase
                .from('kiosco_ventas')
                .update({
                    cantidad: editForm.cantidad,
                    total: editForm.total
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('Venta actualizada');
            setEditingId(null);
            fetchVentas(); // Refresh local list
            onVentaUpdated(); // Refresh parent stats
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar venta');
        }
    };

    const filteredVentas = ventas.filter(v =>
        v.producto_nombre?.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Historial Detallado de Ventas</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 my-4">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-end bg-gray-50 p-3 rounded-lg">
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
                        <div className="flex-1 w-full">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-muted" />
                                <Input
                                    label="Buscar Producto"
                                    placeholder="..."
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-3 text-left">Fecha</th>
                                    <th className="p-3 text-left">Producto</th>
                                    <th className="p-3 text-right">Cant.</th>
                                    <th className="p-3 text-right">Total</th>
                                    <th className="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-muted">Cargando...</td></tr>
                                ) : filteredVentas.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-muted">No se encontraron ventas.</td></tr>
                                ) : (
                                    filteredVentas.map(venta => (
                                        <tr key={venta.id} className="hover:bg-gray-50">
                                            <td className="p-3">
                                                {format(new Date(venta.fecha), 'dd/MM/yyyy HH:mm')}
                                            </td>
                                            <td className="p-3 font-medium text-gray-800">
                                                {venta.producto_nombre}
                                            </td>

                                            {/* Editable Fields */}
                                            {editingId === venta.id ? (
                                                <>
                                                    <td className="p-3 text-right">
                                                        <input
                                                            type="number"
                                                            className="w-16 border rounded p-1 text-right"
                                                            value={editForm.cantidad}
                                                            onChange={(e) => setEditForm({ ...editForm, cantidad: parseFloat(e.target.value) || 0 })}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <input
                                                            type="number"
                                                            className="w-24 border rounded p-1 text-right"
                                                            value={editForm.total}
                                                            onChange={(e) => setEditForm({ ...editForm, total: parseFloat(e.target.value) || 0 })}
                                                        />
                                                    </td>
                                                    <td className="p-3 flex justify-center gap-2">
                                                        <Button size="sm" variant="primary" onClick={() => handleSaveEdit(venta.id)}>
                                                            <Save className="w-4 h-4" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-3 text-right">{venta.cantidad}</td>
                                                    <td className="p-3 text-right font-medium text-primary">
                                                        {formatCurrency(venta.total)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditClick(venta)}>
                                                            <Edit2 className="w-4 h-4 text-gray-500 hover:text-primary" />
                                                        </Button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
