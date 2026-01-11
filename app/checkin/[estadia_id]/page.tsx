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
import { AlertTriangle, Save, CheckCircle, Eye, EyeOff, Users } from 'lucide-react';
import { getNoonTimestamp, sendWhatsAppNotification, replaceTemplate } from '@/lib/utils';
import { MJE_BIENVENIDA_PERSONAL, MJE_BIENVENIDA_GENERAL } from '@/lib/mensajes';
import { toast } from 'sonner';

interface ParcelaConInfo extends Parcela {
    responsable_nombre?: string;
    celular_responsable?: string;
    cant_personas?: number;
}

export default function CheckInPage() {
    const router = useRouter();
    const params = useParams();
    const estadiaId = params.estadia_id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [estadia, setEstadia] = useState<Estadia | null>(null);
    const [acampante, setAcampante] = useState<Acampante | null>(null);
    const [parcelasDisponibles, setParcelasDisponibles] = useState<ParcelaConInfo[]>([]);
    const [parcelasSeleccionadas, setParcelasSeleccionadas] = useState<number[]>([]);
    const [showOcupadas, setShowOcupadas] = useState(false);

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

            // 3. Cargar parcelas (libres y ocupadas según cantidad_integrantes)
            const { data: parcelasData, error: parcelasError } = await supabase
                .from('parcelas')
                .select('*')
                .in('estado', ['libre', 'ocupada'])
                .order('nombre_parcela');

            if (parcelasError) throw parcelasError;

            // Formatear parcelas - cargar nombres de personas en parcelas ocupadas
            const parcelasFormateadas: ParcelaConInfo[] = await Promise.all(
                (parcelasData || []).map(async (p: any) => {
                    let responsable_nombre = undefined;

                    // Si está ocupada, obtener nombres de todas las personas en esa parcela
                    if (p.estado === 'ocupada' && p.nombre_parcela) {
                        const { data: estadiasEnParcela } = await supabase
                            .from('estadias')
                            .select('id')
                            .eq('parcela_asignada', p.nombre_parcela)
                            .eq('ingreso_confirmado', true);

                        if (estadiasEnParcela && estadiasEnParcela.length > 0) {
                            const estadiaIds = estadiasEnParcela.map(e => e.id);

                            const { data: acampantes } = await supabase
                                .from('acampantes')
                                .select('nombre_completo')
                                .in('estadia_id', estadiaIds)
                                .limit(3); // Mostrar máximo 3 nombres

                            if (acampantes && acampantes.length > 0) {
                                const nombres = acampantes.map(a => a.nombre_completo.split(' ')[0]); // Solo primer nombre
                                responsable_nombre = nombres.join(', ');
                                if (p.cantidad_integrantes > acampantes.length) {
                                    responsable_nombre += ` +${p.cantidad_integrantes - acampantes.length}`;
                                }
                            }
                        }
                    }

                    return {
                        id: p.id,
                        nombre_parcela: p.nombre_parcela,
                        estado: p.estado,
                        cantidad_integrantes: p.cantidad_integrantes || 0,
                        responsable_nombre: responsable_nombre || (p.cantidad_integrantes > 0 ? `${p.cantidad_integrantes} personas` : undefined)
                    };
                })
            );

            // Ordenar parcelas: camas primero, luego resto numéricamente
            const parcelasOrdenadas = parcelasFormateadas.sort((a, b) => {
                const esCamaA = a.nombre_parcela.toLowerCase().includes('cama');
                const esCamaB = b.nombre_parcela.toLowerCase().includes('cama');

                // Camas primero
                if (esCamaA && !esCamaB) return -1;
                if (!esCamaA && esCamaB) return 1;

                // Dentro de cada grupo, ordenar numéricamente
                const numA = parseInt(a.nombre_parcela.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.nombre_parcela.replace(/\D/g, '')) || 0;
                return numA - numB;
            });

            setParcelasDisponibles(parcelasOrdenadas);

        } catch (error) {
            console.error('Error al cargar datos:', error);
            router.push('/recepcion');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmarIngreso = async () => {
        if (!estadia || !acampante) return;

        if (parcelasSeleccionadas.length === 0) {
            // Requires parcela selection
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
                    es_responsable_pago: acampante.es_responsable_pago,
                })
                .eq('celular', acampante.celular);

            if (acampanteError) throw acampanteError;

            // 2. Actualizar estadía (sin confirmar ingreso todavía)
            // El ingreso se confirmará en liquidación al finalizar pago
            const { error: estadiaError } = await supabase
                .from('estadias')
                .update({
                    // NO marcar ingreso_confirmado aquí, se hace en liquidación
                    // ingreso_confirmado: se mantiene false hasta liquidación
                    fecha_ingreso: estadia.fecha_ingreso,
                    fecha_egreso_programada: estadia.fecha_egreso_programada,
                    cant_parcelas_total: estadia.cant_parcelas_total,
                    cant_sillas_total: estadia.cant_sillas_total,
                    cant_mesas_total: estadia.cant_mesas_total,
                    tipo_vehiculo: estadia.tipo_vehiculo,
                })
                .eq('id', estadiaId);

            if (estadiaError) throw estadiaError;

            // 3. Guardar selección de parcelas en localStorage para usar en liquidación
            localStorage.setItem(`parcelas_${estadiaId}`, JSON.stringify(parcelasSeleccionadas));

            // ------------------------------------------------------------------
            // AUTOMATIZACIÓN MENSAJERÍA MOVIDA A LIQUIDACIÓN
            // ------------------------------------------------------------------

            // Navegar a liquidación
            router.push(`/liquidacion/${estadiaId}`);
        } catch (error) {
            console.error('Error al confirmar ingreso:', error);
            setSaving(false);
            toast.error('Error al guardar datos');
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


                {/* Editor de Recursos */}


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
                            <div className="flex items-center space-x-2 md:col-span-2 bg-secondary/10 p-3 rounded-lg border border-secondary/20">
                                <input
                                    type="checkbox"
                                    id="responsable"
                                    checked={acampante.es_responsable_pago || false}
                                    onChange={(e) => setAcampante({ ...acampante, es_responsable_pago: e.target.checked })}
                                    className="w-5 h-5 text-primary rounded focus:ring-primary"
                                />
                                <label htmlFor="responsable" className="text-sm font-medium cursor-pointer">
                                    Es Responsable de Pago (Titular del Grupo)
                                </label>
                            </div>
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
                        <CardTitle>Datos de Estadía</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                type="date"
                                label="Fecha de Ingreso"
                                value={estadia.fecha_ingreso ? new Date(estadia.fecha_ingreso).toISOString().split('T')[0] : ''}
                                onChange={(e) => setEstadia({ ...estadia, fecha_ingreso: e.target.value })}
                            />
                            <Input
                                type="date"
                                label="Fecha de Egreso"
                                value={estadia.fecha_egreso_programada ? new Date(estadia.fecha_egreso_programada).toISOString().split('T')[0] : ''}
                                onChange={(e) => setEstadia({ ...estadia, fecha_egreso_programada: e.target.value })}
                            />
                        </div>
                        <Counter
                            label="Carpas"
                            value={estadia.cant_parcelas_total || 0}
                            onChange={(value) => setEstadia({ ...estadia, cant_parcelas_total: value })}
                            min={0}
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
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Asignación de Parcelas</CardTitle>
                                <p className="text-sm text-muted mt-1">
                                    {parcelasSeleccionadas.length} de {estadia.cant_parcelas_total || 1} parcela(s) asignada(s)
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setShowOcupadas(!showOcupadas)}
                                className="flex items-center gap-2"
                            >
                                {showOcupadas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                {showOcupadas ? 'Ocultar' : 'Mostrar'} Ocupadas
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {parcelasDisponibles.length === 0 ? (
                            <p className="text-center text-muted py-4">
                                No hay parcelas disponibles en este momento
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {parcelasDisponibles
                                    .filter(p => showOcupadas ? true : p.estado === 'libre')
                                    .map((parcela) => {
                                        const isSelected = parcelasSeleccionadas.includes(parcela.id);
                                        const isOcupada = parcela.estado === 'ocupada';

                                        return (
                                            <button
                                                key={parcela.id}
                                                onClick={() => toggleParcela(parcela.id)}
                                                className={`p-3 rounded-lg border-2 transition-all text-center ${isSelected
                                                    ? 'border-primary bg-primary text-white'
                                                    : isOcupada
                                                        ? 'border-red-500 bg-red-100 text-red-900 cursor-not-allowed opacity-80'
                                                        : 'border-green-500 bg-green-50 text-green-900 hover:bg-green-100'
                                                    }`}
                                            >
                                                <span className="font-semibold block">{parcela.nombre_parcela}</span>
                                                {isOcupada && (parcela as ParcelaConInfo).responsable_nombre && (
                                                    <div className="mt-2 space-y-1">
                                                        <Badge variant="warning" className="text-xs flex items-center justify-center gap-1">
                                                            <Users className="w-3 h-3" />
                                                            {(parcela as ParcelaConInfo).cant_personas || 0}
                                                        </Badge>
                                                        <p className="text-xs text-gray-700 truncate">
                                                            {(parcela as ParcelaConInfo).responsable_nombre}
                                                        </p>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
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
