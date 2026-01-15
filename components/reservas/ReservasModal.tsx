import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { checkAvailability, Reserva } from '@/lib/reservas';
import { Trash2, Calendar, User, Phone } from 'lucide-react';
import { format } from 'date-fns';

interface ReservasModalProps {
    isOpen: boolean;
    onClose: () => void;
    parcelaId: number;
    parcelaNombre: string;
}

export function ReservasModal({ isOpen, onClose, parcelaId, parcelaNombre }: ReservasModalProps) {
    const [reservas, setReservas] = useState<Reserva[]>([]);
    const [loading, setLoading] = useState(false);

    // New Reservation Form
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [nombre, setNombre] = useState('');
    const [celular, setCelular] = useState('');
    const [conflict, setConflict] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && parcelaId) {
            fetchReservas();
            // Reset form
            setFechaInicio('');
            setFechaFin('');
            setNombre('');
            setCelular('');
            setConflict(null);
        }
    }, [isOpen, parcelaId]);

    const fetchReservas = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('reservas')
                .select('*')
                .eq('parcela_id', parcelaId)
                .neq('estado', 'cancelada')
                .gte('fecha_fin', new Date().toISOString().split('T')[0]) // Only future/current
                .order('fecha_inicio', { ascending: true });

            if (error) throw error;
            setReservas(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar reservas');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckAvailability = async () => {
        if (!fechaInicio || !fechaFin) return;
        setConflict(null);
        try {
            const result = await checkAvailability(parcelaId, fechaInicio, fechaFin);
            if (!result.available) {
                setConflict(`Conflicto: ${result.reason} ${result.conflict ? `(${new Date(result.conflict.fecha_inicio).toLocaleDateString()} - ${new Date(result.conflict.fecha_fin).toLocaleDateString()})` : ''}`);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async () => {
        if (!fechaInicio || !fechaFin || !nombre) {
            toast.error('Complete todos los campos obligatorios');
            return;
        }

        const result = await checkAvailability(parcelaId, fechaInicio, fechaFin);
        if (!result.available) {
            toast.error(`Conflicto: ${result.reason}`);
            setConflict(result.reason || 'No disponible');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('reservas')
                .insert({
                    parcela_id: parcelaId,
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin,
                    nombre_responsable: nombre,
                    celular: celular,
                    estado: 'confirmada'
                });

            if (error) throw error;

            toast.success('Reserva creada exitosamente');
            fetchReservas();

            // Clear form
            setNombre('');
            setCelular('');
            setConflict(null);

        } catch (error: any) {
            console.error(error);
            toast.error('Error al crear reserva: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('¿Seguro que desea cancelar esta reserva?')) return;

        try {
            const { error } = await supabase
                .from('reservas')
                .update({ estado: 'cancelada' })
                .eq('id', id);

            if (error) throw error;
            toast.success('Reserva cancelada');
            fetchReservas();
        } catch (error) {
            console.error(error);
            toast.error('Error al cancelar');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Reservas: {parcelaNombre}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* List List */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm text-muted mb-2 uppercase">Próximas Reservas</h3>
                        {loading && reservas.length === 0 ? (
                            <p className="text-sm text-muted">Cargando...</p>
                        ) : reservas.length === 0 ? (
                            <div className="p-4 bg-gray-50 rounded text-center text-muted text-sm border border-dashed">
                                No hay reservas futuras.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {reservas.map(res => (
                                    <div key={res.id} className="p-3 border rounded-lg bg-white shadow-sm flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-sm">{res.nombre_responsable}</p>
                                            <div className="flex items-center gap-1 text-xs text-muted mt-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(res.fecha_inicio).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} - {new Date(res.fecha_fin).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                            </div>
                                            {res.celular && (
                                                <div className="flex items-center gap-1 text-xs text-muted">
                                                    <Phone className="w-3 h-3" /> {res.celular}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 h-6 px-2"
                                            onClick={() => handleCancel(res.id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* New Reservation Form */}
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
                        <h3 className="font-semibold text-primary mb-2">Nueva Reserva</h3>

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Inicio"
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                onBlur={handleCheckAvailability}
                            />
                            <Input
                                label="Fin"
                                type="date"
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                onBlur={handleCheckAvailability}
                            />
                        </div>

                        {conflict && (
                            <div className="bg-red-50 text-red-700 text-xs p-2 rounded border border-red-200 flex items-center gap-2">
                                <span className="font-bold">⚠ {conflict}</span>
                            </div>
                        )}

                        <Input
                            label="Nombre Responsable"
                            placeholder="Ej: Juan Perez"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                        />

                        <Input
                            label="Celular (Opcional)"
                            placeholder="Ej: 11555..."
                            value={celular}
                            onChange={(e) => setCelular(e.target.value)}
                        />

                        <Button
                            className="w-full mt-2"
                            onClick={handleSubmit}
                            disabled={loading || !!conflict || !fechaInicio || !fechaFin || !nombre}
                        >
                            {loading ? 'Guardando...' : 'Confirmar Reserva'}
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
