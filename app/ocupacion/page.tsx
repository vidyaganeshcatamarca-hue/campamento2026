'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Removed unused View import to avoid confusion
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Home, Calendar, LogOut, Users } from 'lucide-react';
import { MapaParcelas } from '@/components/ui/MapaParcelas';

interface ParcelaConEstadia {
    nombre_parcela: string;
    estado: string;
    estadia_nombre?: string;
    fecha_egreso?: string;
    estadia_id_ref?: string;
    cantidad_integrantes?: number;
    nombres_integrantes?: string[]; // Array of names
}

interface EgresoInfo {
    responsable: string;
    nombre: string;
    celular: string;
    parcelas: string[];
    cant_personas: number;
    fecha_egreso: string;
}

export default function OcupacionPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [parcelas, setParcelas] = useState<ParcelaConEstadia[]>([]);

    // KPIs and Filters
    const [disponiblesHoy, setDisponiblesHoy] = useState(0);
    const [ocupacionPromedio, setOcupacionPromedio] = useState(0);

    // Separar parcelas
    const parcelasCamping = parcelas.filter(p => !p.nombre_parcela.toLowerCase().includes('cama'));
    const camasHabitacion = parcelas.filter(p => p.nombre_parcela.toLowerCase().includes('cama'));
    const camasOcupadas = camasHabitacion.filter(c => c.estado === 'ocupada').length;
    const camasTotales = camasHabitacion.length;

    // Estado para cambio de parcela
    const [parcelaSeleccionada, setParcelaSeleccionada] = useState<ParcelaConEstadia | null>(null);
    const [nuevaParcelaId, setNuevaParcelaId] = useState<string>('');
    const [procesandoCambio, setProcesandoCambio] = useState(false);

    // Egresos
    const [modoFecha, setModoFecha] = useState<'unica' | 'rango'>('unica');
    const [fechaEgreso, setFechaEgreso] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [egresos, setEgresos] = useState<EgresoInfo[]>([]);
    const [totalEgresos, setTotalEgresos] = useState(0);

    useEffect(() => {
        // Set defaults
        const hoy = new Date().toISOString().split('T')[0];
        setFechaEgreso(hoy);
        setFechaDesde(hoy);
        setFechaHasta(hoy);

        fetchData();
    }, []);

    useEffect(() => {
        if (modoFecha === 'unica' && fechaEgreso) {
            fetchEgresos();
        } else if (modoFecha === 'rango' && fechaDesde && fechaHasta) {
            fetchEgresos();
        }
    }, [modoFecha, fechaEgreso, fechaDesde, fechaHasta]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        console.log('[Ocupacion] Iniciando fetchData seguro...');

        try {
            // Helper timeout
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Tiempo de espera agotado (15s). Verifica tu conexión.')), 15000)
            );

            // 1. Fetch Parcelas (Timeboxed)
            console.log('[Ocupacion] Solicitando parcelas...');
            const parcelasPromise = supabase
                .from('parcelas')
                .select('nombre_parcela, estado, estadia_id, cantidad_integrantes')
                .order('nombre_parcela');

            const { data: parcelasData, error: errParcelas } = await Promise.race([
                parcelasPromise,
                timeoutPromise
            ]) as any;

            if (errParcelas) throw new Error(`Error cargando parcelas: ${errParcelas.message}`);

            // 2. Fetch Active Estadias (Timeboxed)
            console.log('[Ocupacion] Solicitando estadías...');
            const estadiasPromise = supabase
                .from('estadias')
                .select('id, celular_responsable, fecha_egreso_programada, parcela_asignada')
                .eq('estado_estadia', 'activa');

            const { data: estadiasData, error: errEstadias } = await Promise.race([
                estadiasPromise,
                timeoutPromise
            ]) as any;

            if (errEstadias) throw new Error(`Error cargando estadías: ${errEstadias.message}`);

            // 2.5 Fetch Acampantes for Active Estadias
            // We need this to show names in tooltip
            const activeIds = estadiasData?.map((e: any) => e.id) || [];
            let acampantesMap: Record<string, string[]> = {};

            if (activeIds.length > 0) {
                const { data: acampantesData } = await supabase
                    .from('acampantes')
                    .select('estadia_id, nombre_completo')
                    .in('estadia_id', activeIds);

                // Group by estadia_id
                if (acampantesData) {
                    acampantesData.forEach((a: any) => {
                        if (!acampantesMap[a.estadia_id]) acampantesMap[a.estadia_id] = [];
                        acampantesMap[a.estadia_id].push(a.nombre_completo);
                    });
                }
            }

            // 3. Map Data in Memory
            console.log('[Ocupacion] Mapeando datos...');
            const parcelasConInfo: ParcelaConEstadia[] = (parcelasData || []).map((parcela: any) => {
                let estadiaCorrespondiente;

                if (parcela.estado === 'ocupada') {
                    // Strategy A: Match by ID (Best)
                    if (parcela.estadia_id) {
                        estadiaCorrespondiente = estadiasData?.find((e: any) => e.id === parcela.estadia_id);
                    }

                    // Strategy B: Match by Name (Fallback)
                    if (!estadiaCorrespondiente) {
                        estadiaCorrespondiente = estadiasData?.find((e: any) => {
                            if (!e.parcela_asignada) return false;

                            // Normalization for robust comparison
                            const pAsignada = String(e.parcela_asignada).toLowerCase().trim();
                            const pActual = String(parcela.nombre_parcela).toLowerCase().trim();

                            // 1. Exact match
                            if (pAsignada === pActual) return true;

                            // 2. Comma separated list (e.g. "10, 11")
                            const asignadas = pAsignada.split(',').map((s: string) => s.trim());
                            if (asignadas.includes(pActual)) return true;

                            return false;
                        });
                    }
                }

                if (estadiaCorrespondiente) {
                    // Get Names for this estadia
                    const names = acampantesMap[estadiaCorrespondiente.id] || [];

                    return {
                        nombre_parcela: parcela.nombre_parcela,
                        estado: parcela.estado || 'libre',
                        estadia_nombre: estadiaCorrespondiente.celular_responsable,
                        fecha_egreso: estadiaCorrespondiente.fecha_egreso_programada,
                        estadia_id_ref: estadiaCorrespondiente.id,
                        cantidad_integrantes: parcela.cantidad_integrantes,
                        nombres_integrantes: names.length > 0 ? names : ([estadiaCorrespondiente.celular_responsable]) // Fallback to phone if no names
                    };
                } else {
                    return {
                        nombre_parcela: parcela.nombre_parcela,
                        estado: parcela.estado || 'libre',
                        estadia_nombre: parcela.estado === 'ocupada' ? 'Ocupada' : undefined,
                        cantidad_integrantes: parcela.cantidad_integrantes,
                        nombres_integrantes: []
                    };
                }
            });

            // 4. Update State
            console.log('[Ocupacion] Actualizando estado...');
            setParcelas(parcelasConInfo.sort((a, b) => {
                const numA = parseInt(a.nombre_parcela.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.nombre_parcela.replace(/\D/g, '')) || 0;
                return numA - numB;
            }));

            setDisponiblesHoy(parcelasConInfo.filter(p => p.estado === 'libre').length);
            const ocupadas = parcelasConInfo.filter(p => p.estado === 'ocupada').length;
            setOcupacionPromedio(parcelasConInfo.length > 0 ? (ocupadas / parcelasConInfo.length) * 100 : 0);

        } catch (error: any) {
            console.error('[Ocupacion] Error CRÍTICO:', error);
            setError(error.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const fetchEgresos = async () => {
        try {
            let fechaInicio: string;
            let fechaFin: string;

            if (modoFecha === 'unica') {
                fechaInicio = new Date(fechaEgreso + 'T00:00:00').toISOString();
                fechaFin = new Date(fechaEgreso + 'T23:59:59').toISOString();
            } else {
                fechaInicio = new Date(fechaDesde + 'T00:00:00').toISOString();
                fechaFin = new Date(fechaHasta + 'T23:59:59').toISOString();
            }

            // Usamos la Vista aquí porque necesitamos agregación y no es Blocking para la UI principal
            // Pero si la vista falla, falla solo esta parte.
            const { data: estadiasData } = await supabase
                .from('estadias') // Cambiado a estadias para seguridad
                .select('id, celular_responsable, fecha_egreso_programada, cant_personas_total') // Campos básicos
                .eq('estado_estadia', 'activa')
                .eq('ingreso_confirmado', true) // Solo mostrar si ya ingresaron efectivamente
                .gte('fecha_egreso_programada', fechaInicio)
                .lte('fecha_egreso_programada', fechaFin);

            const egresosInfo: EgresoInfo[] = [];

            for (const estadia of estadiasData || []) {
                // Fetch Parcels
                const { data: parcelasData } = await supabase
                    .from('parcelas')
                    .select('nombre_parcela')
                    .eq('estadia_id', estadia.id);

                // Fetch Name
                const { data: acampanteData } = await supabase
                    .from('acampantes')
                    .select('nombre_completo')
                    .eq('celular', estadia.celular_responsable)
                    .single();

                egresosInfo.push({
                    responsable: estadia.celular_responsable,
                    nombre: acampanteData?.nombre_completo || 'Sin Nombre',
                    celular: estadia.celular_responsable,
                    parcelas: parcelasData?.map((p: any) => p.nombre_parcela) || [],
                    cant_personas: estadia.cant_personas_total || 0,
                    fecha_egreso: estadia.fecha_egreso_programada
                });
            }

            setEgresos(egresosInfo);
            setTotalEgresos(egresosInfo.length);

        } catch (error) {
            console.error('Error al cargar egresos:', error);
        }
    };

    const handleCambiarParcela = async () => {
        if (!parcelaSeleccionada || !nuevaParcelaId) return;
        setProcesandoCambio(true);

        try {
            const estadiaId = parcelaSeleccionada.estadia_id_ref;
            if (!estadiaId) {
                alert('Error: No se encontró ID de estadía');
                return;
            }

            // --- 1. GESTIONAR PARCELA ANTERIOR ---
            // Obtener ocupantes restantes en la parcela anterior (excluyendo la actual)
            const { count: ocupantesAnteriores, error: countError } = await supabase
                .from('estadias')
                .select('*', { count: 'exact', head: true })
                .eq('parcela_asignada', parcelaSeleccionada.nombre_parcela)
                .eq('estado_estadia', 'activa')
                .neq('id', estadiaId); // Excluir la que se está mudando

            if (countError) throw countError;

            const restantes = ocupantesAnteriores || 0;

            if (restantes === 0) {
                // Si no queda nadie, liberar
                const { error: errorLiberar } = await supabase
                    .from('parcelas')
                    .update({
                        estado: 'libre',
                        estadia_id: null,
                        cantidad_integrantes: 0
                    })
                    .eq('nombre_parcela', parcelaSeleccionada.nombre_parcela);
                if (errorLiberar) throw errorLiberar;
            } else {
                // Si quedan, solo actualizar cantidad
                const { error: errorActualizarAnterior } = await supabase
                    .from('parcelas')
                    .update({
                        cantidad_integrantes: restantes
                    })
                    .eq('nombre_parcela', parcelaSeleccionada.nombre_parcela);
                if (errorActualizarAnterior) throw errorActualizarAnterior;
            }

            // --- 2. GESTIONAR NUEVA PARCELA ---
            // Obtener info actual de la nueva parcela
            const { data: nuevaParcela, error: fetchNuevaError } = await supabase
                .from('parcelas')
                .select('cantidad_integrantes, estado')
                .eq('nombre_parcela', nuevaParcelaId)
                .single();

            if (fetchNuevaError) throw fetchNuevaError;

            const nuevaCantidad = (nuevaParcela.cantidad_integrantes || 0) + 1;

            const { error: errorOcupar } = await supabase
                .from('parcelas')
                .update({
                    estado: 'ocupada',
                    estadia_id: estadiaId, // Asignamos esta estadía como referencia (última ingresada)
                    cantidad_integrantes: nuevaCantidad
                })
                .eq('nombre_parcela', nuevaParcelaId);

            if (errorOcupar) throw errorOcupar;

            // --- 3. ACTUALIZAR ESTADÍA ---
            const { data: estadiaActual } = await supabase
                .from('estadias')
                .select('parcela_asignada, observaciones')
                .eq('id', estadiaId)
                .single();

            if (estadiaActual) {
                // Reemplazar nombre de parcela en el campo parcela_asignada
                // Nota: Si tenía multiples (ej "10, 11"), esto es complejo. Asumimos por ahora mudanza simple de unidad.
                // Si el sistema soporta multiples, deberíamos parsear.
                // Simplificación: Reemplazar el string exacto o actualizar todo.
                // Dado que 'parcelaSeleccionada.nombre_parcela' viene de la selección, usamos ese para buscar/reemplazar o setear directo si es 1-1.

                // Mantenemos lógica simple: Setear a la nueva.
                // Si el usuario tenía multiples, esto podría pisar las otras.
                // Pero el dashboard maneja "parcelaSeleccionada" como UNA unidad.

                await supabase.from('estadias').update({
                    parcela_asignada: nuevaParcelaId, // Asignamos la nueva
                    observaciones: `${estadiaActual.observaciones || ''}\n[Mudanza] De ${parcelaSeleccionada.nombre_parcela} a ${nuevaParcelaId} el ${new Date().toLocaleDateString()}`
                }).eq('id', estadiaId);
            }

            alert('Cambio de parcela exitoso');
            setParcelaSeleccionada(null);
            setNuevaParcelaId('');
            fetchData();

        } catch (error: any) {
            console.error('Error cambio parcela:', error);
            alert(`Error al realizar el cambio: ${error.message}`);
        } finally {
            setProcesandoCambio(false);
        }
    };

    const handleReservarParcela = async (nombre: string) => {
        if (!confirm(`¿Reservar parcela ${nombre}?`)) return;
        try {
            const { error } = await supabase
                .from('parcelas')
                .update({ estado: 'reservada' })
                .eq('nombre_parcela', nombre);

            if (error) throw error;
            fetchData();
        } catch (e) {
            console.error(e);
            alert('Error al reservar');
        }
    };

    const handleLiberarReserva = async (nombre: string) => {
        if (!confirm(`¿Liberar reserva de ${nombre}?`)) return;
        try {
            const { error } = await supabase
                .from('parcelas')
                .update({ estado: 'libre' })
                .eq('nombre_parcela', nombre);

            if (error) throw error;
            fetchData();
        } catch (e) {
            console.error(e);
            alert('Error al liberar');
        }
    };

    const getParcelasDisponibles = () => {
        return parcelas.filter(p => p.estado === 'libre');
    };

    const getColorParcela = (estado: string) => {
        if (estado === 'libre') return 'bg-green-500';
        if (estado === 'ocupada') return 'bg-red-500';
        return 'bg-yellow-500';
    };

    // --- RENDER ---

    if (loading) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-muted">Cargando mapa de ocupación...</p>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center p-8 bg-red-50 rounded-lg m-4 border border-red-200">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-xl font-bold text-red-800">Error al cargar datos</h2>
                    <p className="text-red-600 max-w-md mx-auto">{error}</p>
                    <Button onClick={fetchData} variant="outline" className="mt-4 border-red-300 text-red-700 hover:bg-red-100">
                        Reintentar
                    </Button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            {/* Modal Mudanza */}
            {parcelaSeleccionada && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md bg-white shadow-xl">
                        <CardHeader>
                            <CardTitle>Mudar Parcela: {parcelaSeleccionada.nombre_parcela}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted">Estadía de: <span className="font-semibold">{parcelaSeleccionada.estadia_nombre}</span></p>
                            <div>
                                <label className="block text-sm font-medium mb-1">Nueva Parcela (Libre)</label>
                                <select
                                    className="w-full p-2 border rounded"
                                    value={nuevaParcelaId}
                                    onChange={e => setNuevaParcelaId(e.target.value)}
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {getParcelasDisponibles()
                                        .sort((a, b) => a.nombre_parcela.localeCompare(b.nombre_parcela, undefined, { numeric: true }))
                                        .map(p => (
                                            <option key={p.nombre_parcela} value={p.nombre_parcela}>{p.nombre_parcela}</option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex gap-3 justify-end mt-4">
                                <Button variant="outline" onClick={() => setParcelaSeleccionada(null)}>Cancelar</Button>
                                <Button variant="primary" disabled={!nuevaParcelaId || procesandoCambio} onClick={handleCambiarParcela}>
                                    {procesandoCambio ? 'Procesando...' : 'Confirmar Mudanza'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">
                        Dashboard de Ocupación
                    </h1>
                    <p className="text-muted mt-1">Vista en tiempo real de parcelas y egresos</p>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6 flex items-center gap-3">
                            <Home className="w-6 h-6 text-green-600" />
                            <div>
                                <p className="text-sm text-muted">Disponibles</p>
                                <p className="text-2xl font-bold text-green-600">{disponiblesHoy}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center gap-3">
                            <Home className="w-6 h-6 text-primary" />
                            <div>
                                <p className="text-sm text-muted">Total</p>
                                <p className="text-2xl font-bold">{parcelas.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center gap-3">
                            <Calendar className="w-6 h-6 text-accent" />
                            <div>
                                <p className="text-sm text-muted">Ocupación</p>
                                <p className="text-2xl font-bold text-accent">{ocupacionPromedio.toFixed(0)}%</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center gap-3">
                            <LogOut className="w-6 h-6 text-danger" />
                            <div>
                                <p className="text-sm text-muted">Egresos Hoy</p>
                                <p className="text-2xl font-bold text-danger">{totalEgresos}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Egresos Programados */}
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><LogOut className="w-5 h-5" /> Egresos Programados</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Button variant={modoFecha === 'unica' ? 'primary' : 'outline'} onClick={() => setModoFecha('unica')} size="sm">Fecha Única</Button>
                            <Button variant={modoFecha === 'rango' ? 'primary' : 'outline'} onClick={() => setModoFecha('rango')} size="sm">Rango</Button>
                        </div>
                        {modoFecha === 'unica' ? (
                            <Input type="date" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} />
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                                <Input label="Hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                            </div>
                        )}
                        <div className="space-y-3">
                            {egresos.map((egreso, i) => (
                                <div key={i} className="border rounded-lg p-3 hover:bg-secondary/10 flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-base">{egreso.nombre}</p>
                                            <p className="text-xs text-muted flex items-center gap-1">
                                                <Users className="w-3 h-3" /> {egreso.celular}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                                            {new Date(egreso.fecha_egreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm mt-1">
                                        <div className="flex gap-2">
                                            {egreso.parcelas.map(p => (
                                                <Badge key={p} variant="secondary" className="px-1.5 py-0 text-[10px] h-5">
                                                    {p}
                                                </Badge>
                                            ))}
                                            {egreso.parcelas.length === 0 && <span className="text-muted italic text-xs">Sin parcela</span>}
                                        </div>
                                        <span className="text-xs font-semibold text-muted">
                                            {egreso.cant_personas} pers.
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {egresos.length === 0 && <p className="text-muted text-center text-sm">No hay egresos.</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Habitaciones */}
                {camasTotales > 0 && (
                    <Card>
                        <CardHeader><CardTitle>Habitación Compartida ({camasOcupadas}/{camasTotales})</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {camasHabitacion.map(cama => (
                                    <div key={cama.nombre_parcela} className="p-4 border rounded-lg relative">
                                        <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${cama.estado === 'ocupada' ? 'bg-red-500' : 'bg-green-500'}`} />
                                        <h3 className="font-bold">{cama.nombre_parcela}</h3>
                                        {cama.estado === 'ocupada' ? (
                                            <>
                                                <p className="text-xs text-muted truncate">{cama.estadia_nombre}</p>
                                                <Button variant="outline" size="xs" className="mt-2 w-full text-xs h-7" onClick={() => setParcelaSeleccionada(cama)}>Mudar</Button>
                                            </>
                                        ) : (
                                            <p className="text-xs text-green-600 font-medium mt-1">Disponible</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Mapa Camping */}
                <Card className="overflow-hidden">
                    <CardHeader className="bg-gray-50/50 pb-4">
                        <CardTitle className="flex justify-between items-center">
                            <span>Mapa de Parcelas</span>
                            <div className="flex gap-3 text-sm font-normal">
                                <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Libre</span>
                                <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Ocupada</span>
                                <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-400 rounded-full"></div> Reservada</span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6">
                        <MapaParcelas
                            ocupadas={parcelas.filter(p => p.estado === 'ocupada').map(p => parseInt(p.nombre_parcela.replace(/\D/g, '')))}
                            reservadas={parcelas.filter(p => p.estado === 'reservada').map(p => parseInt(p.nombre_parcela.replace(/\D/g, '')))}
                            detalles={parcelas.reduce((acc, p) => {
                                const id = parseInt(p.nombre_parcela.replace(/\D/g, ''));
                                if (!isNaN(id)) {
                                    // Tooltip: "Parcela X" + "\nNombre 1" + "\nNombre 2"
                                    let tooltip = `Parcela ${id}`;
                                    if (p.estado === 'ocupada' && p.nombres_integrantes && p.nombres_integrantes.length > 0) {
                                        tooltip += '\n' + p.nombres_integrantes.join('\n');
                                    }
                                    acc[id] = tooltip;
                                }
                                return acc;
                            }, {} as Record<number, string>)}
                            onSelect={(id) => {
                                const parcela = parcelas.find(p => parseInt(p.nombre_parcela.replace(/\D/g, '')) === id);
                                if (!parcela) return;

                                if (parcela.estado === 'ocupada') {
                                    setParcelaSeleccionada(parcela);
                                } else if (parcela.estado === 'reservada') {
                                    handleLiberarReserva(parcela.nombre_parcela);
                                } else {
                                    handleReservarParcela(parcela.nombre_parcela);
                                }
                            }}
                        />
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
