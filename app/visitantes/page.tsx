'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nombre_completo) {
            alert('Por favor ingresa el nombre del visitante.');
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

            alert('¡Registro guardado exitosamente!');

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
            alert('Error al guardar el registro. Por favor intente nuevamente.');
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
                        Visitantes del Día
                    </h1>
                    <p className="text-muted mt-1">
                        Registro rápido para personas que no acampan (menos de 30 segundos)
                    </p>
                </div>

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
                            <Input
                                label="Nombre y Apellido *"
                                value={formData.nombre_completo}
                                onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                                required
                                autoFocus
                            />

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
