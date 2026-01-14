'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useRouter } from 'next/navigation';
import { Acampante, VistaEstadiaConTotales } from '@/lib/supabase';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardItem {
    persona: Acampante;
    estadia: VistaEstadiaConTotales;
}

interface CheckoutControlModalProps {
    isOpen: boolean;
    onClose: () => void;
    overdueItems: DashboardItem[];
}

export function CheckoutControlModal({ isOpen, onClose, overdueItems }: CheckoutControlModalProps) {
    const router = useRouter();

    if (!isOpen) return null;

    // Group by Estadia to avoid showing multiple rows for the same family/group if desired, 
    // OR list everyone as requested by user ("nombres de las personas").
    // User asked "un listado con los nombres de las personas". 
    // Let's sort by date descending (most overdue first? or oldest overdue first?)
    // Oldest overdue first (need to clear them out).

    const sortedItems = [...overdueItems].sort((a, b) => {
        const dateA = new Date(a.estadia.fecha_egreso_programada).getTime();
        const dateB = new Date(b.estadia.fecha_egreso_programada).getTime();
        return dateA - dateB; // Ascending: Oldest dates first
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-700">
                        <Clock className="w-5 h-5" />
                        Control de Salidas Vencidas
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Las siguientes personas tienen fecha de egreso pasada y su estadía figura como 'Activa'.
                        Por favor, regularice su situación realizando el Check-Out o extendiendo su estadía.
                    </p>

                    {sortedItems.length === 0 ? (
                        <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed text-gray-400">
                            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                            No hay estadías vencidas pendientes. ¡Todo al día!
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                    <tr>
                                        <th className="p-3">Nombre</th>
                                        <th className="p-3">Parcela</th>
                                        <th className="p-3">Fecha Egreso</th>
                                        <th className="p-3">Estado</th>
                                        <th className="p-3 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedItems.map((item, idx) => {
                                        const fechaEgreso = new Date(item.estadia.fecha_egreso_programada);
                                        const isResponsable = item.persona.es_responsable_pago;

                                        return (
                                            <tr key={item.persona.id || idx} className="hover:bg-gray-50/50">
                                                <td className="p-3 font-medium text-gray-900">
                                                    {item.persona.nombre_completo}
                                                    {isResponsable && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Resp</span>}
                                                </td>
                                                <td className="p-3 text-gray-600">
                                                    {item.estadia.parcela_asignada || <span className="text-amber-500 italic">Sin Asignar</span>}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-red-600">
                                                            {format(fechaEgreso, "dd 'de' MMM", { locale: es })}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {format(fechaEgreso, "yyyy")}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-200">
                                                        Vencida
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        className="h-8 gap-1.5"
                                                        onClick={() => {
                                                            onClose();
                                                            router.push(`/checkout/${item.estadia.id}`);
                                                        }}
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                        Check Out
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
