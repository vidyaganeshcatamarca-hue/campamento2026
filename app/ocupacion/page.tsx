'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Home, Calendar, LogOut, Users } from 'lucide-react';
import { MapaParcelas } from '@/components/ui/MapaParcelas';
import Cookies from 'js-cookie';

interface ParcelaConEstadia {
    nombre_parcela: string;
    estado: string;
    estadia_nombre?: string;
    fecha_egreso?: string;
    estadia_id_ref?: string;
    cantidad_integrantes?: number;
    integrantes_data?: { id: string; nombre: string; parcela_asignada?: string }[];
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

    // Role
    const [role, setRole] = useState<string>('invitado');
    const isReadOnly = role === 'auditor'; // Acomodacion CAN move people now
    const canMovePeople = role === 'admin' || role === 'acomodacion';

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

        // Load Role
        const session = Cookies.get('camp_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                setRole(parsed.role || 'invitado');
            } catch (e) { console.error(e); }
        }

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
            let acampantesMap: Record<string, { id: string; nombre: string; parcela_asignada?: string }[]> = {};

            if (activeIds.length > 0) {
                const { data: acampantesData } = await supabase
                    .from('acampantes')
                    .select('id, estadia_id, nombre_completo, parcela_asignada')
                    .in('estadia_id', activeIds);

                // Group by estadia_id
                if (acampantesData) {
                    acampantesData.forEach((a: any) => {
                        if (!acampantesMap[a.estadia_id]) acampantesMap[a.estadia_id] = [];
                        acampantesMap[a.estadia_id].push({ id: a.id, nombre: a.nombre_completo, parcela_asignada: a.parcela_asignada });
                    });
                }
            }

            // 3. Map Data in Memory
            console.log('[Ocupacion] Mapeando datos...');

            // Pre-calculate occupants per parcel
            const parcelOccupancyMap: Record<string, { id: string; nombre: string; parcela_asignada?: string; estadia_id: string }[]> = {};

            // Helper to add occupant to a parcel slot
            const addToParcel = (parcelName: string, occupant: any) => {
                const normalized = parcelName.trim();
                if (!parcelOccupancyMap[normalized]) parcelOccupancyMap[normalized] = [];
                // Avoid duplicates
                if (!parcelOccupancyMap[normalized].find(x => x.id === occupant.id)) {
                    parcelOccupancyMap[normalized].push(occupant);
                }
            };

            // Distribute Acampantes
            Object.entries(acampantesMap).forEach(([estadiaId, occupants]) => {
                const estadia = estadiasData?.find((e: any) => e.id === estadiaId);
                const defaultParcels = estadia?.parcela_asignada ? estadia.parcela_asignada.split(',') : [];

                occupants.forEach(occ => {
                    if (occ.parcela_asignada) {
                        // Explicit assignment override
                        addToParcel(occ.parcela_asignada, { ...occ, estadia_id: estadiaId });
                    } else if (defaultParcels.length > 0) {
                        // Inherit from Estadia
                        defaultParcels.forEach((pName: string) => {
                            addToParcel(pName.trim(), { ...occ, estadia_id: estadiaId });
                        });
                    }
                });
            });

            const parcelasConInfo: ParcelaConEstadia[] = (parcelasData || []).map((parcela: any) => {
                const occupants = parcelOccupancyMap[parcela.nombre_parcela] || [];

                // Resolve Estadia Reference
                let mainEstadiaId = parcelasData.find((p: any) => p.nombre_parcela === parcela.nombre_parcela)?.estadia_id;

                // If we have occupants, prefer their estadia info for the label
                if (occupants.length > 0) {
                    mainEstadiaId = occupants[0].estadia_id;
                }

                const estadiaRef = estadiasData?.find((e: any) => e.id === mainEstadiaId);
                const estadiaNombre = estadiaRef?.celular_responsable || (occupants.length > 0 ? 'Varios' : undefined);

                return {
                    nombre_parcela: parcela.nombre_parcela,
                    estado: parcela.estado || 'libre',
                    estadia_nombre: estadiaNombre,
                    fecha_egreso: estadiaRef?.fecha_egreso_programada,
                    estadia_id_ref: mainEstadiaId,
                    cantidad_integrantes: parcela.cantidad_integrantes,
                    integrantes_data: occupants
                };
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
            const { data: estadiasData } = await supabase
                .from('estadias')
                .select('id, celular_responsable, fecha_egreso_programada, cant_personas_total, parcela_asignada')
                .eq('estado_estadia', 'activa')
                .eq('ingreso_confirmado', true)
                .gte('fecha_egreso_programada', fechaInicio)
                .lte('fecha_egreso_programada', fechaFin);

            const egresosInfo: EgresoInfo[] = [];

            for (const estadia of estadiasData || []) {
                let nombresParcelas: string[] = [];

                if (estadia.parcela_asignada) {
                    nombresParcelas = estadia.parcela_asignada.split(',').map((s: string) => s.trim());
                } else {
                    const { data: parcelasData } = await supabase
                        .from('parcelas')
                        .select('nombre_parcela')
                        .eq('estadia_id', estadia.id);

                    if (parcelasData) {
                        nombresParcelas = parcelasData.map((p: any) => p.nombre_parcela);
                    }
                }

                const { data: acampanteData } = await supabase
                    .from('acampantes')
                    .select('nombre_completo')
                    .eq('celular', estadia.celular_responsable)
                    .single();

                egresosInfo.push({
                    responsable: estadia.celular_responsable,
                    nombre: acampanteData?.nombre_completo || 'Sin Nombre',
                    celular: estadia.celular_responsable,
                    parcelas: nombresParcelas,
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
        if (isReadOnly) return;
        if (!parcelaSeleccionada || !nuevaParcelaId) return;
        setProcesandoCambio(true);

        try {
            const estadiaId = parcelaSeleccionada.estadia_id_ref;
            if (!estadiaId) {
                alert('Error: No se encontró ID de estadía');
                return;
            }

            // --- 1. GESTIONAR PARCELA ANTERIOR ---
            const { count: ocupantesAnteriores, error: countError } = await supabase
                .from('estadias')
                .select('*', { count: 'exact', head: true })
                .eq('parcela_asignada', parcelaSeleccionada.nombre_parcela)
                .eq('estado_estadia', 'activa')
                .neq('id', estadiaId);

            if (countError) throw countError;

            const restantes = ocupantesAnteriores || 0;

            if (restantes === 0) {
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
                const { error: errorActualizarAnterior } = await supabase
                    .from('parcelas')
                    .update({
                        cantidad_integrantes: restantes
                    })
                    .eq('nombre_parcela', parcelaSeleccionada.nombre_parcela);
                if (errorActualizarAnterior) throw errorActualizarAnterior;
            }

            // --- 2. GESTIONAR NUEVA PARCELA ---
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
                    estadia_id: estadiaId,
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
                await supabase.from('estadias').update({
                    parcela_asignada: nuevaParcelaId,
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

    const handleMudarPersona = async (acampanteId: string, nuevaParcela: string, parcelaActual: string, estadiaId: string) => {
        if (!canMovePeople) return;

        // Check if new parcel is occupied
        const parcelDest = parcelas.find(p => p.nombre_parcela === nuevaParcela);
        const isDestOccupied = parcelDest?.estado === 'ocupada';

        let confirmMsg = `¿Mover esta persona a la parcela ${nuevaParcela}?`;
        if (isDestOccupied) {
            confirmMsg = `⚠️ La parcela ${nuevaParcela} YA ESTÁ OCUPADA.\n\n¿Desea agregar a esta persona a la parcela COMPARTIDA? (Requiere consentimiento del operador)`;
        }

        if (!confirm(confirmMsg)) return;
        setProcesandoCambio(true);

        try {
            // 1. Update Persona Location
            const { error: moveError } = await supabase
                .from('acampantes')
                .update({ parcela_asignada: nuevaParcela })
                .eq('id', acampanteId);

            if (moveError) throw moveError;

            // 2. Decrement Old Parcela
            const { data: oldP } = await supabase.from('parcelas').select('cantidad_integrantes').eq('nombre_parcela', parcelaActual).single();
            if (oldP && oldP.cantidad_integrantes > 0) {
                const newOldCount = oldP.cantidad_integrantes - 1;
                const updatePayload: any = { cantidad_integrantes: newOldCount };
                if (newOldCount === 0) {
                    updatePayload.estado = 'libre';
                    updatePayload.estadia_id = null;
                }
                await supabase.from('parcelas').update(updatePayload).eq('nombre_parcela', parcelaActual);
            }

            // 3. Increment New Parcela
            const { data: newP } = await supabase.from('parcelas').select('cantidad_integrantes, estado, estadia_id').eq('nombre_parcela', nuevaParcela).single();
            const newCount = (newP?.cantidad_integrantes || 0) + 1;

            const updateDestPayload: any = {
                cantidad_integrantes: newCount,
                estado: 'ocupada'
            };

            // CRITICAL: Only overwrite estadia_id if it was NULL (Free). 
            // If it was already occupied (Shared), keep the original owner's ID to avoid hijacking the stay reference.
            if (!newP?.estadia_id) {
                updateDestPayload.estadia_id = estadiaId;
            }

            await supabase.from('parcelas')
                .update(updateDestPayload)
                .eq('nombre_parcela', nuevaParcela);

            console.log('Mudanza individual exitosa');
            await fetchData(); // Refresh to show changes
            alert('Mudanza realizada con éxito.'); // Add feedback since toast was removed
            setParcelaSeleccionada(null); // Close modal to refresh context
        } catch (e: any) {
            console.error(e);
            alert(e.message || 'Error al mudar');
        } finally {
            setProcesandoCambio(false);
        }
    };

    const handleReservarParcela = async (nombre: string) => {
        if (isReadOnly) return;
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
        if (isReadOnly) return;
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

    const getParcelasParaMudanza = () => {
        // Return ALL parcels, sorted by number
        // Maybe sort: Free first, then Occupied? Or just numeric.
        // Let's do numeric for clarity, but label them.
        return [...parcelas].sort((a, b) => {
            const numA = parseInt(a.nombre_parcela.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.nombre_parcela.replace(/\D/g, '')) || 0;
            return numA - numB;
        });
    };

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
            {parcelaSeleccionada && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md bg-white shadow-xl max-h-[80vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle>Mudar Parcela: {parcelaSeleccionada.nombre_parcela}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted">Estadía de: <span className="font-semibold">{parcelaSeleccionada.estadia_nombre}</span></p>

                            <div className="space-y-3">
                                <h4 className="font-medium text-sm">Integrantes en esta parcela:</h4>
                                {parcelaSeleccionada.integrantes_data?.map((integ) => (
                                    <div key={integ.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                        <span className="text-sm">{integ.nombre}</span>
                                        {canMovePeople && (
                                            <div className="flex gap-2">
                                                <select
                                                    className="text-xs p-1 border rounded w-24"
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            handleMudarPersona(integ.id, e.target.value, parcelaSeleccionada.nombre_parcela, parcelaSeleccionada.estadia_id_ref!);
                                                        }
                                                    }}
                                                    value=""
                                                >
                                                    <option value="">Mudar a...</option>
                                                    {getParcelasParaMudanza().map(p => (
                                                        <option key={p.nombre_parcela} value={p.nombre_parcela}>
                                                            {p.nombre_parcela} {p.estado === 'ocupada' ? '(Compartida)' : '(Libre)'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!parcelaSeleccionada.integrantes_data || parcelaSeleccionada.integrantes_data.length === 0) && (
                                    <p className="text-xs text-muted italic">Sin integrantes registrados nominalmente.</p>
                                )}
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h4 className="font-medium text-sm mb-2 text-muted">Mudanza Masiva (Toda la Estadía)</h4>
                                <div className="flex gap-2">
                                    <select
                                        className="w-full p-2 border rounded text-sm"
                                        value={nuevaParcelaId}
                                        onChange={e => setNuevaParcelaId(e.target.value)}
                                        disabled={!canMovePeople}
                                    >
                                        <option value="">-- Mudar TODOS a... --</option>
                                        {getParcelasParaMudanza()
                                            .sort((a, b) => a.nombre_parcela.localeCompare(b.nombre_parcela, undefined, { numeric: true }))
                                            .map(p => (
                                                <option key={p.nombre_parcela} value={p.nombre_parcela}>{p.nombre_parcela}</option>
                                            ))}
                                    </select>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        disabled={!nuevaParcelaId || procesandoCambio || !canMovePeople}
                                        onClick={handleCambiarParcela}
                                    >
                                        Mover Todo
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-4">
                                <Button variant="outline" onClick={() => setParcelaSeleccionada(null)}>Cerrar</Button>
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
                                                {!isReadOnly && (
                                                    <Button variant="outline" size="xs" className="mt-2 w-full text-xs h-7" onClick={() => setParcelaSeleccionada(cama)}>Mudar</Button>
                                                )}
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

                {/* Lista Global de Ocupantes (Visible siempre para facilitar gestión y visualización por Auditor) */}
                <div>
                    <Card>
                        <CardHeader><CardTitle>Ocupantes en Parcelas</CardTitle></CardHeader>
                        <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
                            {parcelas.filter(p => p.estado === 'ocupada').map(p => (
                                <div key={p.nombre_parcela} className="border-b pb-2 last:border-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-lg">{p.nombre_parcela}</span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs text-muted">{p.estadia_nombre}</span>
                                            {/* Badge for occupied/shared state */}
                                            <Badge variant="outline" className={p.cantidad_integrantes && p.cantidad_integrantes > 1 ? "bg-orange-50 text-orange-700 border-orange-200" : ""}>
                                                {p.cantidad_integrantes} Ocupantes
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="pl-2 space-y-2">
                                        {p.integrantes_data?.map(integ => (
                                            <div key={integ.id} className="flex justify-between items-center text-sm bg-gray-50 p-1.5 rounded">
                                                <span>{integ.nombre}</span>
                                                {canMovePeople && (
                                                    <select
                                                        className="text-xs p-1 border rounded w-20"
                                                        onChange={(e) => {
                                                            if (e.target.value && p.estadia_id_ref) {
                                                                handleMudarPersona(integ.id, e.target.value, p.nombre_parcela, p.estadia_id_ref);
                                                            }
                                                        }}
                                                        value=""
                                                    >
                                                        <option value="">Mover...</option>
                                                        {getParcelasParaMudanza().map(dp => (
                                                            <option key={dp.nombre_parcela} value={dp.nombre_parcela}>
                                                                {dp.nombre_parcela} {dp.estado === 'ocupada' ? '*' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

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
                                    if (p.estado === 'ocupada' && p.integrantes_data && p.integrantes_data.length > 0) {
                                        tooltip += '\n' + p.integrantes_data.map((i: any) => i.nombre).join('\n');
                                        tooltip += `\n(Total: ${p.integrantes_data.length})`; // Debug Count
                                    } else if (p.estado === 'ocupada') {
                                        tooltip += '\n(Sin nombres)';
                                    }
                                    acc[id] = tooltip;
                                }
                                return acc;
                            }, {} as Record<number, string>)}
                            onSelect={(id) => {
                                const parcela = parcelas.find(p => parseInt(p.nombre_parcela.replace(/\D/g, '')) === id);
                                if (!parcela) return;

                                if (parcela.estado === 'ocupada') {
                                    setParcelaSeleccionada(parcela); // Always open modal to view details/move
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
