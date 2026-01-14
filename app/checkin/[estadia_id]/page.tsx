'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, Acampante, Estadia, Parcela } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { MapaParcelas } from '@/components/ui/MapaParcelas';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Counter } from '@/components/ui/Counter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, Save, CheckCircle, Eye, EyeOff, Users, MapPin } from 'lucide-react';
import { getNoonTimestamp, sendWhatsAppNotification, replaceTemplate } from '@/lib/utils';
import { MJE_BIENVENIDA_PERSONAL, MJE_BIENVENIDA_GENERAL } from '@/lib/mensajes';
import { differenceInDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/Dialog';
import { toast } from 'sonner';
import Cookies from 'js-cookie';

interface ParcelaConInfo extends Parcela {
    responsable_nombre?: string;
    celular_responsable?: string;
    cant_personas?: number;
    pos_x?: number;
    pos_y?: number;
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
    const [inputManual, setInputManual] = useState(''); // BUG K State
    const [showOcupadas, setShowOcupadas] = useState(false);

    // Auditor Role
    const [role, setRole] = useState<string>('invitado');
    const isReadOnly = role === 'auditor' || role === 'acomodacion';

    // Bug P: Custom Dialog State
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingParcela, setPendingParcela] = useState<ParcelaConInfo | null>(null);

    useEffect(() => {
        const session = Cookies.get('camp_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                setRole(parsed.role || 'invitado');
            } catch (e) {
                console.error("Error parsing session", e);
            }
        }
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
                        responsable_nombre: responsable_nombre || (p.cantidad_integrantes > 0 ? `${p.cantidad_integrantes} personas` : undefined),
                        pos_x: p.pos_x,
                        pos_y: p.pos_y
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
        if (isReadOnly) return;

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
                // FIX: 'id' column does not exist. Use estadia_id + responsible flag to identify the row.
                // This allows updating the phone number (celular) safely without losing the row reference.
                .eq('estadia_id', estadiaId)
                .eq('es_responsable_pago', true);

            if (acampanteError) throw acampanteError;

            // 2. Actualizar estadía (sin confirmar ingreso todavía)
            // El ingreso se confirmará en liquidación al finalizar pago

            // Bug F & V: Calcular cantidad de noches (días)
            // Fix: Normalizar a mediodía para evitar problemas de timezone (off-by-one)
            // Si la fecha viene como YYYY-MM-DD, al hacer new Date() puede ser UTC 00:00 que en local es día anterior.
            // Solución: Parsear string manualmente o agregar hora.

            const parseDateToNoon = (dateStr: string | undefined): Date | null => {
                if (!dateStr) return null;
                // Asumimos dateStr es YYYY-MM-DD. Agregamos T12:00:00 para garantizar mediodía local.
                try {
                    const cleanDate = dateStr.split('T')[0];
                    return new Date(`${cleanDate}T12:00:00`);
                } catch { return null; }
            };

            const fechaIngresoDate = parseDateToNoon(estadia.fecha_ingreso) || new Date();
            const fechaEgresoDate = parseDateToNoon(estadia.fecha_egreso_programada) || new Date();

            let diasCalculados = 1;
            try {
                if (!isNaN(fechaIngresoDate.getTime()) && !isNaN(fechaEgresoDate.getTime())) {
                    diasCalculados = differenceInDays(fechaEgresoDate, fechaIngresoDate);
                }
            } catch (e) {
                console.warn('Error calculando días:', e);
            }

            // Si son el mismo día o anterior, cobrar 1 noche mínima
            const cantDiasFinal = Math.max(1, diasCalculados);

            const { error: estadiaError } = await supabase
                .from('estadias')
                .update({
                    // NO marcar ingreso_confirmado aquí, se hace en liquidación
                    // ingreso_confirmado: se mantiene false hasta liquidación
                    fecha_ingreso: fechaIngresoDate ? fechaIngresoDate.toISOString() : estadia.fecha_ingreso,
                    fecha_egreso_programada: fechaEgresoDate ? fechaEgresoDate.toISOString() : estadia.fecha_egreso_programada,
                    // FIX: User confirmed column is 'acumulado_noches_persona', not 'cant_dias'.
                    // We must recalculate it: Days * People
                    acumulado_noches_persona: cantDiasFinal * (estadia.cant_personas_total || 1),
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
        } catch (error: any) {
            console.error('Error al confirmar ingreso:', error);
            setSaving(false);
            const msg = `Error al guardar: ${error.message || 'Error desconocido'}`;
            toast.error(msg);
            alert(msg); // Force visibility
        }
    };

    const confirmParcelaSelection = () => {
        if (pendingParcela) {
            toggleParcela(pendingParcela.id);
            setPendingParcela(null);
            setShowConfirmDialog(false);
            setInputManual('');
            toast.success(`Parcela ${pendingParcela.nombre_parcela} agregada`);
        }
    };

    const toggleParcela = (parcelaId: number) => {
        if (isReadOnly) return;
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
                {isReadOnly && (
                    <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-semibold border border-amber-200">
                        Modo Auditoría (Lectura)
                    </div>
                )}

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
                                disabled={isReadOnly}
                            />
                            <Input
                                label="Celular / WhatsApp"
                                value={acampante.celular}
                                onChange={(e) => setAcampante({ ...acampante, celular: e.target.value })}
                                disabled={isReadOnly}
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
                                disabled={isReadOnly}
                            />
                            <Input
                                label="Grupo Sanguíneo"
                                value={acampante.grupo_sanguineo || ''}
                                onChange={(e) => setAcampante({ ...acampante, grupo_sanguineo: e.target.value })}
                                disabled={isReadOnly}
                            />
                            <Input
                                label="Obra Social"
                                value={acampante.obra_social || ''}
                                onChange={(e) => setAcampante({ ...acampante, obra_social: e.target.value })}
                                disabled={isReadOnly}
                            />
                            <Input
                                label="Contacto de Emergencia"
                                value={acampante.contacto_emergencia || ''}
                                onChange={(e) => setAcampante({ ...acampante, contacto_emergencia: e.target.value })}
                                disabled={isReadOnly}
                            />
                            <Input
                                label="Enfermedades"
                                value={acampante.enfermedades || ''}
                                onChange={(e) => setAcampante({ ...acampante, enfermedades: e.target.value })}
                                className="md:col-span-2"
                                disabled={isReadOnly}
                            />
                            <Input
                                label="Alergias"
                                value={acampante.alergias || ''}
                                onChange={(e) => setAcampante({ ...acampante, alergias: e.target.value })}
                                disabled={isReadOnly}
                            />
                            <Input
                                label="Medicación"
                                value={acampante.medicacion || ''}
                                onChange={(e) => setAcampante({ ...acampante, medicacion: e.target.value })}
                                disabled={isReadOnly}
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
                                disabled={isReadOnly}
                            />
                            <Input
                                type="date"
                                label="Fecha de Egreso"
                                value={estadia.fecha_egreso_programada ? new Date(estadia.fecha_egreso_programada).toISOString().split('T')[0] : ''}
                                onChange={(e) => setEstadia({ ...estadia, fecha_egreso_programada: e.target.value })}
                                disabled={isReadOnly}
                            />
                        </div>
                        <Counter
                            label="Carpas"
                            value={estadia.cant_parcelas_total || 0}
                            onChange={(value) => setEstadia({ ...estadia, cant_parcelas_total: value })}
                            min={0}
                            disabled={isReadOnly}
                        />
                        <Counter
                            label="Sillas"
                            value={estadia.cant_sillas_total || 0}
                            onChange={(value) => setEstadia({ ...estadia, cant_sillas_total: value })}
                            min={0}
                            disabled={isReadOnly}
                        />
                        <Counter
                            label="Mesas"
                            value={estadia.cant_mesas_total || 0}
                            onChange={(value) => setEstadia({ ...estadia, cant_mesas_total: value })}
                            min={0}
                            disabled={isReadOnly}
                        />
                        <Input
                            label="Tipo de Vehículo / Patente"
                            value={estadia.tipo_vehiculo || ''}
                            onChange={(e) => setEstadia({ ...estadia, tipo_vehiculo: e.target.value })}
                            placeholder="Ej: Auto ABC123"
                            disabled={isReadOnly}
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
                        {/* Section: Habitaciones (Camas) */}
                        {parcelasDisponibles.filter(p => p.nombre_parcela.toLowerCase().includes('cama')).length > 0 && (
                            <div className="mb-6 border-b pb-6">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Habitación Compartida
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {parcelasDisponibles
                                        .filter(p => p.nombre_parcela.toLowerCase().includes('cama'))
                                        .map(cama => {
                                            const isSelected = parcelasSeleccionadas.includes(cama.id);
                                            return (
                                                <div
                                                    key={cama.id}
                                                    onClick={() => {
                                                        if (cama.estado === 'ocupada' && !isSelected) {
                                                            setPendingParcela(cama);
                                                            setShowConfirmDialog(true);
                                                        } else {
                                                            toggleParcela(cama.id);
                                                        }
                                                    }}
                                                    className={`
                                                        relative p-3 rounded-lg border cursor-pointer transition-all
                                                        ${isSelected
                                                            ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                                                            : cama.estado === 'ocupada'
                                                                ? 'bg-red-50 border-red-200 hover:border-red-300'
                                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                                        }
                                                    `}
                                                >
                                                    <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${cama.estado === 'ocupada' ? 'bg-red-500' : isSelected ? 'bg-blue-500' : 'bg-green-500'}`} />
                                                    <h4 className={`font-bold text-sm ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>{cama.nombre_parcela}</h4>

                                                    {cama.estado === 'ocupada' ? (
                                                        <p className="text-xs text-red-600 mt-1 truncate">
                                                            {cama.responsable_nombre || 'Ocupada'}
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-green-600 mt-1 font-medium">Disponible</p>
                                                    )}

                                                    {isSelected && (
                                                        <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-0.5">
                                                            <CheckCircle className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {parcelasDisponibles.length === 0 ? (
                            <p className="text-center text-muted py-4">
                                No hay parcelas disponibles en este momento
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {/* BUG K: Manual Input - Solo Enter */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Input
                                            label="Selección Manual (Nombre o Número)"
                                            placeholder="Ej: 10, Cama 1"
                                            value={inputManual}
                                            onChange={(e) => setInputManual(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = inputManual;
                                                    const parcelaFound = parcelasDisponibles.find(p =>
                                                        p.nombre_parcela.toLowerCase() === val.toLowerCase() ||
                                                        p.nombre_parcela === val
                                                    );
                                                    if (parcelaFound) {
                                                        // BUG L: Click logic reuse
                                                        if (parcelaFound.estado === 'ocupada' && !parcelasSeleccionadas.includes(parcelaFound.id)) {
                                                            setPendingParcela(parcelaFound);
                                                            setShowConfirmDialog(true);
                                                        } else if (!parcelasSeleccionadas.includes(parcelaFound.id)) {
                                                            toggleParcela(parcelaFound.id);
                                                            setInputManual('');
                                                            toast.success(`Parcela ${parcelaFound.nombre_parcela} agregada`);
                                                        } else {
                                                            toast.info('Ya está seleccionada');
                                                            setInputManual('');
                                                        }
                                                    } else {
                                                        toast.error('Parcela no encontrada');
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted pb-3">Presiona Enter para agregar</p>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {parcelasSeleccionadas.map(pid => {
                                        const p = parcelasDisponibles.find(pd => pd.id === pid);
                                        return p ? (
                                            <Badge key={pid} variant="secondary" className="flex items-center gap-1">
                                                {p.nombre_parcela}
                                                {p.estado === 'ocupada' && <span className="text-red-500 text-[10px]">(Ocupada)</span>}
                                                <button onClick={() => toggleParcela(pid)} className="ml-1 hover:text-red-600">×</button>
                                            </Badge>
                                        ) : null;
                                    })}
                                </div>

                                <MapaParcelas
                                    // Fix: Use 'parcelas' prop instead of legacy ocupadas/reservadas
                                    parcelas={parcelasDisponibles.map(p => ({
                                        id: parseInt(p.nombre_parcela.replace(/\D/g, '')) || 0,
                                        nombre: p.nombre_parcela,
                                        estado: p.estado as 'ocupada' | 'libre' | 'reservada',
                                        pos_x: p.pos_x,
                                        pos_y: p.pos_y
                                    })).filter(p => p.id > 0)}
                                    seleccionadas={parcelasSeleccionadas.map(pid => {
                                        const p = parcelasDisponibles.find(pd => pd.id === pid);
                                        return p ? parseInt(p.nombre_parcela.replace(/\D/g, '')) : 0;
                                    }).filter(n => n > 0)}
                                    onSelect={(id) => {
                                        // Buscar parcela por ID numérico en el nombre
                                        const parcela = parcelasDisponibles.find(p => parseInt(p.nombre_parcela.replace(/\D/g, '')) === id);
                                        if (parcela) {
                                            // Bug L Fix: Asegurar propagación & Bug P: Custom Dialog
                                            if (parcela.estado === 'ocupada' && !parcelasSeleccionadas.includes(parcela.id)) {
                                                setPendingParcela(parcela);
                                                setShowConfirmDialog(true);
                                            } else {
                                                toggleParcela(parcela.id);
                                            }
                                        }
                                    }}
                                />

                                <div className="text-center text-sm text-muted">
                                    <p>Selecciona las parcelas en el mapa o ingresa el número manualmente.</p>
                                    <p className="text-xs mt-1">💡 Se permite seleccionar parcelas ocupadas para compartir.</p>
                                </div>
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
                    {!isReadOnly ? (
                        <Button
                            variant="primary"
                            onClick={handleConfirmarIngreso}
                            disabled={saving || parcelasSeleccionadas.length === 0}
                            className="flex-1 flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            {saving ? 'Confirmando...' : 'Confirmar Ingreso'}
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            disabled
                            className="flex-1 flex items-center justify-center gap-2 opacity-75 cursor-not-allowed"
                        >
                            <Eye className="w-5 h-5" />
                            Modo Solo Lectura
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                            Parcela Ocupada
                        </DialogTitle>
                        <DialogDescription>
                            Esta parcela ya tiene ocupantes registrados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <p className="font-semibold text-lg">{pendingParcela?.nombre_parcela}</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Ocupada por: <span className="font-medium text-gray-800">{pendingParcela?.responsable_nombre || 'Desconocido'}</span>
                        </p>
                        <p className="text-sm mt-4 bg-amber-50 p-3 rounded text-amber-800">
                            ¿Estás seguro/a que deseas asignar esta parcela de todas formas (compartida)?
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" onClick={confirmParcelaSelection}>
                            Confirmar Compartir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout >
    );
}
