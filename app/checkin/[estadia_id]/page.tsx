'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, Acampante, Estadia, Parcela } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Counter } from '@/components/ui/Counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, Save, CheckCircle } from 'lucide-react';
import { getNoonTimestamp } from '@/lib/utils';

export default function CheckInPage() {
    const router = useRouter();
    const params = useParams();
    const estadiaId = params.estadia_id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [estadia, setEstadia] = useState<Estadia | null>(null);
    const [acampante, setAcampante] = useState<Acampante | null>(null);
    const [parcelasDisponibles, setParcelasDisponibles] = useState<Parcela[]>([]);
    const [parcelasSeleccionadas, setParcelasSeleccionadas] = useState<number[]>([]);

    useEffect(() => {
        fetchData();
    }, [estadiaId]);

    const fetchData = async () => {
        try {
            // Cargar estadía
            const { data: estadiaData, error: estadiaError } = await supabase
                .from('estadias')
                .select('*')
                .eq('id', estadiaId)
                .single();

            if (estadiaError) throw estadiaError;
            setEstadia(estadiaData);

            // Cargar acampante responsable
            const { data: acampanteData, error: acampanteError } = await supabase
                .from('acampantes')
                .select('*')
                .eq('estadia_id', estadiaId)
                .eq('es_responsable_pago', true)
                .single();

            if (acampanteError) throw acampanteError;
            setAcampante(acampanteData);

            // Cargar parcelas disponibles
            const { data: parcelasData, error: parcelasError } = await supabase
                .from('parcelas')
                .select('*')
                .eq('estado', 'libre');

            if (parcelasError) throw parcelasError;
            setParcelasDisponibles(parcelasData || []);

        } catch (error) {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar los datos. Volviendo a recepción.');
            router.push('/recepcion');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmarIngreso = async () => {
        if (!estadia || !acampante) return;

        if (parcelasSeleccionadas.length === 0) {
            alert('Por favor asigna al menos una parcela antes de confirmar.');
            return;
        }

        setSaving(true);

        try {
            // 1. Actualizar datos del acampante
            const { error: acampanteError } = await supabase
                .from('acampantes')
                .update({
                    nombre_completo: acampante.nombre_completo,
                    celular: acampante.celular,
                    edad: acampante.edad,
                    grupo_sanguineo: acampante.grupo_sanguineo,
                    obra_social: acampante.obra_social,
                    enfermedades: acampante.enfermedades,
                    alergias: acampante.alergias,
                    medicacion: acampante.medicacion,
                    tratamiento: acampante.tratamiento,
                    contacto_emergencia: acampante.contacto_emergencia,
                })
                .eq('celular', acampante.celular);

            if (acampanteError) throw acampanteError;

            // 2. Actualizar estadía con confirmación de ingreso
            const { error: estadiaError } = await supabase
                .from('estadias')
                .update({
                    ingreso_confirmado: true,
                    estado_estadia: 'activa',
                    fecha_ingreso: getNoonTimestamp(),
                    cant_parcelas_total: estadia.cant_parcelas_total,
                    cant_sillas_total: estadia.cant_sillas_total,
                    cant_mesas_total: estadia.cant_mesas_total,
                    tipo_vehiculo: estadia.tipo_vehiculo,
                })
                .eq('id', estadiaId);

            if (estadiaError) throw estadiaError;

            // 3. Actualizar parcelas seleccionadas
            for (const parcelaId of parcelasSeleccionadas) {
                await supabase
                    .from('parcelas')
                    .update({
                        estado: 'ocupada',
                        estadia_id: estadiaId,
                    })
                    .eq('id', parcelaId);
            }

            // Navegar a liquidación
            router.push(`/liquidacion/${estadiaId}`);
        } catch (error) {
            console.error('Error al confirmar ingreso:', error);
            alert('Error al confirmar el ingreso. Por favor intente nuevamente.');
            setSaving(false);
        }
    };

    const toggleParcela = (parcelaId: number) => {
        setParcelasSeleccionadas(prev =>
            prev.includes(parcelaId)
                ? prev.filter(id => id !== parcelaId)
                : [...prev, parcelaId]
        );
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

    if (!acampante || !estadia) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <p className="text-danger">No se encontraron los datos solicitados</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6 max-w-4xl mx-auto">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">
                        Validación y Check-in
                    </h1>
                    <p className="text-muted mt-1">
                        Revisa y confirma los datos antes de oficializar el ingreso
                    </p>
                </div>

                {acampante.es_persona_riesgo && (
                    <Card className="border-2 border-danger">
                        <CardContent className="flex items-start gap-3">
                            <AlertTriangle className="w-6 h-6 text-danger flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-bold text-danger text-lg">¡ATENCIÓN: Persona de Riesgo Médico!</h3>
                                <p className="text-sm text-foreground mt-1">
                                    {acampante.enfermedades || 'Revisar condiciones médicas especiales'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Sección 1: Datos del Acampante */}
                <Card>
                    <CardHeader>
                        <CardTitle>Datos Personales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Nombre Completo"
                                value={acampante.nombre_completo}
                                onChange={(e) => setAcampante({ ...acampante, nombre_completo: e.target.value })}
                            />
                            <Input
                                label="Celular / WhatsApp"
                                value={acampante.celular}
                                onChange={(e) => setAcampante({ ...acampante, celular: e.target.value })}
                            />
                            <Input
                                label="Edad"
                                type="number"
                                value={acampante.edad || ''}
                                onChange={(e) => setAcampante({ ...acampante, edad: parseInt(e.target.value) || 0 })}
                            />
                            <Input
                                label="Grupo Sanguíneo"
                                value={acampante.grupo_sanguineo || ''}
                                onChange={(e) => setAcampante({ ...acampante, grupo_sanguineo: e.target.value })}
                            />
                            <Input
                                label="Obra Social"
                                value={acampante.obra_social || ''}
                                onChange={(e) => setAcampante({ ...acampante, obra_social: e.target.value })}
                            />
                            <Input
                                label="Contacto de Emergencia"
                                value={acampante.contacto_emergencia || ''}
                                onChange={(e) => setAcampante({ ...acampante, contacto_emergencia: e.target.value })}
                            />
                            <Input
                                label="Enfermedades"
                                value={acampante.enfermedades || ''}
                                onChange={(e) => setAcampante({ ...acampante, enfermedades: e.target.value })}
                                className="md:col-span-2"
                            />
                            <Input
                                label="Alergias"
                                value={acampante.alergias || ''}
                                onChange={(e) => setAcampante({ ...acampante, alergias: e.target.value })}
                            />
                            <Input
                                label="Medicación"
                                value={acampante.medicacion || ''}
                                onChange={(e) => setAcampante({ ...acampante, medicacion: e.target.value })}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Sección 2: Recursos */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recursos de Estadía</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Counter
                            label="Carpas"
                            value={estadia.cant_parcelas_total || 1}
                            onChange={(value) => setEstadia({ ...estadia, cant_parcelas_total: value })}
                            min={1}
                        />
                        <Counter
                            label="Sillas"
                            value={estadia.cant_sillas_total || 0}
                            onChange={(value) => setEstadia({ ...estadia, cant_sillas_total: value })}
                            min={0}
                        />
                        <Counter
                            label="Mesas"
                            value={estadia.cant_mesas_total || 0}
                            onChange={(value) => setEstadia({ ...estadia, cant_mesas_total: value })}
                            min={0}
                        />
                        <Input
                            label="Tipo de Vehículo / Patente"
                            value={estadia.tipo_vehiculo || ''}
                            onChange={(e) => setEstadia({ ...estadia, tipo_vehiculo: e.target.value })}
                            placeholder="Ej: Auto ABC123"
                        />
                    </CardContent>
                </Card>

                {/* Sección 3: Parcelas */}
                <Card>
                    <CardHeader>
                        <CardTitle>Asignación de Parcelas</CardTitle>
                        <p className="text-sm text-muted mt-1">
                            {parcelasSeleccionadas.length} de {estadia.cant_parcelas_total || 1} parcela(s) asignada(s)
                        </p>
                    </CardHeader>
                    <CardContent>
                        {parcelasDisponibles.length === 0 ? (
                            <p className="text-center text-muted py-4">
                                No hay parcelas disponibles en este momento
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {parcelasDisponibles.map((parcela) => (
                                    <button
                                        key={parcela.id}
                                        onClick={() => toggleParcela(parcela.id)}
                                        className={`p-3 rounded-lg border-2 transition-all ${parcelasSeleccionadas.includes(parcela.id)
                                            ? 'border-primary bg-primary text-white'
                                            : 'border-gray-300 hover:border-secondary'
                                            }`}
                                    >
                                        <span className="font-semibold">{parcela.nombre_parcela}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Botón de Confirmación */}
                <div className="flex gap-3 sticky bottom-4 bg-background p-4 rounded-lg shadow-lg border border-gray-200">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        className="flex-1"
                        disabled={saving}
                    >
                        Volver
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirmarIngreso}
                        disabled={saving || parcelasSeleccionadas.length === 0}
                        className="flex-1 flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-5 h-5" />
                        {saving ? 'Confirmando...' : 'Confirmar Ingreso'}
                    </Button>
                </div>
            </div>
        </Layout>
    );
}
