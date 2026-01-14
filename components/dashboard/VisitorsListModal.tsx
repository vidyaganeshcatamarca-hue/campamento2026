'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase';
import { Users, Filter, Calendar as CalendarIcon, DollarSign, Download, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Visitor {
    id: number;
    nombre_completo: string;
    fecha_visita: string;
    monto_pagado: number;
    observaciones?: string;
}

interface VisitorsListModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function VisitorsListModal({ isOpen, onClose }: VisitorsListModalProps) {
    const [loading, setLoading] = useState(false);
    const [visitors, setVisitors] = useState<Visitor[]>([]);

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchName, setSearchName] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Default to today
            const today = new Date().toISOString().split('T')[0];
            if (!dateFrom) setDateFrom(today);
            if (!dateTo) setDateTo(today);
            fetchVisitors(today, today);
        }
    }, [isOpen]);

    const fetchVisitors = async (from: string, to: string) => {
        setLoading(true);
        try {
            const startStr = new Date(from + 'T00:00:00').toISOString();
            const endStr = new Date(to + 'T23:59:59').toISOString();

            const { data, error } = await supabase
                .from('visitas_diarias')
                .select('*')
                .gte('fecha_visita', startStr)
                .lte('fecha_visita', endStr)
                .order('fecha_visita', { ascending: false });

            if (error) throw error;
            setVisitors(data || []);
        } catch (error) {
            console.error('Error fetching visitors:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = () => {
        if (dateFrom && dateTo) {
            fetchVisitors(dateFrom, dateTo);
        }
    };

    const filteredVisitors = visitors.filter(v =>
        v.nombre_completo.toLowerCase().includes(searchName.toLowerCase())
    );

    const totalAmount = filteredVisitors.reduce((sum, v) => sum + (v.monto_pagado || 0), 0);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-primary text-xl">
                        <Users className="w-6 h-6" />
                        Listado de Visitantes
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-2">
                    {/* Filter Bar */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Desde</label>
                                    <Input
                                        type="date"
                                        value={dateFrom}
                                        onChange={e => setDateFrom(e.target.value)}
                                        className="bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Hasta</label>
                                    <Input
                                        type="date"
                                        value={dateTo}
                                        onChange={e => setDateTo(e.target.value)}
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                            <div className="w-full md:w-auto">
                                <Button onClick={handleFilter} className="w-full md:w-auto gap-2">
                                    <Filter className="w-4 h-4" />
                                    Filtrar
                                </Button>
                            </div>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nombre..."
                                value={searchName}
                                onChange={e => setSearchName(e.target.value)}
                                className="pl-9 bg-white"
                            />
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                            <span className="font-semibold text-gray-700 text-sm">
                                {filteredVisitors.length} Registros
                            </span>
                            <Badge variant="success" className="text-sm px-2 py-0.5">
                                Total: {formatCurrency(totalAmount)}
                            </Badge>
                        </div>

                        <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-gray-500 font-medium sticky top-0 border-b z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Visitante</th>
                                        <th className="px-4 py-3 text-right">Monto</th>
                                        <th className="px-4 py-3">Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-400">
                                                Cargando...
                                            </td>
                                        </tr>
                                    ) : filteredVisitors.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                                                No se encontraron visitantes en este rango.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredVisitors.map((v) => (
                                            <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-3 text-gray-600">
                                                    {format(new Date(v.fecha_visita), "dd/MM/yyyy", { locale: es })}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                    {v.nombre_completo}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-green-700">
                                                    {formatCurrency(v.monto_pagado)}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate" title={v.observaciones}>
                                                    {v.observaciones || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
