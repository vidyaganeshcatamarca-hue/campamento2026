'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Counter } from '@/components/ui/Counter';
import { UserPlus, CheckCircle } from 'lucide-react';
import { getNoonTimestamp } from '@/lib/utils';

export default function VisitantesPage() {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nombre_completo: '',
        celular: '',
        patente_vehiculo: '',
        monto_pagado: 0,
        observaciones: '',
    });
    const [celular, setCelular] = useState('');
    const [sillas, setSillas] = useState(0);
    const [mesas, setMesas] = useState(0);
    const [dias, setDias] = useState(1);
    const [fechaIngreso, setFechaIngreso] = useState('');
    const [fechaEgreso, setFechaEgreso] = useState('');
    const [vehiculo, setVehiculo] = useState<'ninguno' | 'auto' | 'moto'>('ninguno');
    const [guardando, setGuardando] = useState(false);
    const [mensajeExito, setMensajeExito] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nombre_completo) {
            // No alert
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase
                .from('visitas_diarias')
                .insert({
                    nombre_completo: formData.nombre_completo,
                    celular: formData.celular || null,
                    patente_vehiculo: formData.patente_vehiculo || null,
                    monto_pagado: formData.monto_pagado,
                    observaciones: formData.observaciones || null,
                    fecha_visita: getNoonTimestamp(),
                });

            if (error) throw error;

            // Success - no alert

            // Mostrar mensaje de éxito
            setMensajeExito(true);
            setTimeout(() => setMensajeExito(false), 3000);

            // Reset form
            setCelular('');
            setSillas(0);
            setMesas(0);
            setDias(1);
            setFechaIngreso('');
            setFechaEgreso('');
            setVehiculo('ninguno');

            // Limpiar formulario
            setFormData({
                nombre_completo: '',
                celular: '',
                patente_vehiculo: '',
                monto_pagado: 0,
                observaciones: '',
            });

        } catch (error) {
            console.error('Error al registrar visita:', error);
            // Error logged
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-2xl mx-auto">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">
                        Carga Express - Visitantes
                    </h1>
                    <p className="text-muted mt-1">
                        Registro rápido de llegadas del día
                    </p>
                </div>

                {/* Mensaje de éxito */}
                {mensajeExito && (
                    <div className="bg-success/10 border-2 border-success rounded-lg p-4 flex items-center gap-3 animate-fade-in">
                        <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="font-medium text-success">¡Visitante registrado exitosamente!</p>
                            <p className="text-sm text-muted">Los datos se guardaron correctamente.</p>
                        </div>
                    </div>
                )}

                {/* Formulario de Carga Rápida */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="w-5 h-5" />
                            Formulario de Visita Diaria
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Autocomplete Name Input */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-foreground mb-1">Nombre y Apellido *</label>
                                <input
                                    type="text"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.nombre_completo}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData({ ...formData, nombre_completo: val });

                                        // Debounce search
                                        if (val.length > 2) {
                                            const timer = setTimeout(async () => {
                                                const { data } = await supabase
                                                    .from('acampantes')
                                                    .select('nombre_completo, celular')
                                                    .ilike('nombre_completo', `%${val}%`)
                                                    .order('nombre_completo')
                                                    .limit(10);

                                                if (data) {
                                                    // Filter unique names
                                                    const unique = Array.from(new Map(data.map(item => [item.nombre_completo, item])).values());
                                                    setSuggestions(unique as any[]);
                                                }
                                            }, 300);
                                        } else {
                                            setSuggestions([]);
                                        }
                                    }}
                                    required
                                    autoFocus
                                    autoComplete="off"
                                />
                                {suggestions.length > 0 && (
                                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                        {suggestions.map((s, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex justify-between items-center"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        nombre_completo: s.nombre_completo,
                                                        celular: s.celular || prev.celular
                                                    }));
                                                    setSuggestions([]);
                                                }}
                                            >
                                                <span className="font-medium">{s.nombre_completo}</span>
                                                {s.celular && (
                                                    <span className="text-xs text-gray-400">{s.celular}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Input
                                label="WhatsApp / Celular"
                                type="tel"
                                value={formData.celular}
                                onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                                placeholder="Opcional"
                            />

                            <Input
                                label="Vehículo / Patente"
                                value={formData.patente_vehiculo}
                                onChange={(e) => setFormData({ ...formData, patente_vehiculo: e.target.value })}
                                placeholder="Ej: ABC123 (opcional)"
                            />

                            <Input
                                label="Monto a Cobrar ($) *"
                                type="number"
                                value={formData.monto_pagado || ''}
                                onChange={(e) => setFormData({ ...formData, monto_pagado: parseFloat(e.target.value) || 0 })}
                                step={0.01}
                                min={0}
                                required
                            />

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Observaciones
                                </label>
                                <textarea
                                    value={formData.observaciones}
                                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                                    className="input min-h-[80px] resize-none"
                                    placeholder="Detalles adicionales sobre el monto cobrado (opcional)"
                                />
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-3 text-lg"
                            >
                                <CheckCircle className="w-5 h-5" />
                                {loading ? 'Guardando...' : 'Registrar Ingreso y Cobro'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Información */}
                <Card className="bg-secondary-light/10">
                    <CardContent className="text-sm text-muted space-y-2">
                        <p>
                            <strong>Nota:</strong> Este registro es para visitantes que NO acampan.
                        </p>
                        <p>
                            Los visitantes diarios quedan registrados en el sistema y se incluyen en los reportes de caja.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
