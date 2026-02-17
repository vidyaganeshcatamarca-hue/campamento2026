'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Acampante, VistaEstadiaConTotales } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EditCamperModal } from '@/components/EditCamperModal';
import { CheckoutControlModal } from '@/components/dashboard/CheckoutControlModal';
import { VisitorsListModal } from '@/components/dashboard/VisitorsListModal';
import { Users, AlertTriangle, CheckCircle, Search, DollarSign, Tent, Sun, CalendarPlus, Wallet, Phone, LayoutGrid, List as ListIcon, MoreHorizontal, Clock, ClipboardCheck, UserCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Cookies from 'js-cookie';

// Combined type for the dashboard view
interface DashboardItem {
    persona: Acampante;
    estadia: VistaEstadiaConTotales;
}

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<DashboardItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRiesgo, setFilterRiesgo] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [overdueStays, setOverdueStays] = useState<VistaEstadiaConTotales[]>([]);
    const [role, setRole] = useState<string>('invitado');

    // Estado para edición
    const [editingPersona, setEditingPersona] = useState<Acampante | null>(null);
    const [showCheckoutControl, setShowCheckoutControl] = useState(false);

    // KPIs
    const [stats, setStats] = useState({
        totalPersonas: 0,
        totalDeuda: 0,
        personasRiesgo: 0,
        ocupacionParcelas: 0,
        visitantesHoy: 0
    });

    const [showVisitorsList, setShowVisitorsList] = useState(false);

    useEffect(() => {
        // Load Role
        const session = Cookies.get('camp_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                setRole(parsed.role || 'invitado');

                // Medico: Force List View
                if (parsed.role === 'medico') {
                    setViewMode('list');
                }
            } catch (e) {
                console.error("Error parsing session", e);
            }
        }

        fetchData();
        // Recuperar preferencia de vista (Solo si NO es médico)
        const savedView = localStorage.getItem('dashboardViewMode');
        if (savedView === 'list' || savedView === 'grid') {
            const session = Cookies.get('camp_session');
            let isMedico = false;
            if (session) {
                try { isMedico = JSON.parse(session).role === 'medico'; } catch { }
            }

            if (!isMedico) {
                setViewMode(savedView);
            }
        }
    }, [role]);
    // Actually, to keep it clean: logic above handles strict order.

    // Simplification for reliability:
    // We can rely on the setRole triggering a re-render or just set it based on cookie immediately.
    // Let's stick to the previous effect but refine it.

    const toggleView = (mode: 'grid' | 'list') => {
        setViewMode(mode);
        localStorage.setItem('dashboardViewMode', mode);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Active Stays (Confirmed)
            const { data: estadias, error: estadiasError } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('estado_estadia', 'activa')
                .eq('ingreso_confirmado', true);

            if (estadiasError) throw estadiasError;

            // 2. Fetch All Campers for these stays
            const estadiaIds = estadias?.map(e => e.id) || [];

            if (estadiaIds.length === 0) {
                setItems([]);
                setLoading(false);
                return;
            }

            const { data: acampantes, error: acampantesError } = await supabase
                .from('acampantes')
                .select('*')
                .in('estadia_id', estadiaIds);

            if (acampantesError) throw acampantesError;

            // 3. Combine Data
            const combinedItems: DashboardItem[] = (acampantes || []).map(persona => {
                const estadia = estadias?.find(e => e.id === persona.estadia_id);
                return {
                    persona,
                    estadia: estadia!
                };
            }).filter(item => item.estadia);

            setItems(combinedItems);

            // 4. Calculate Stats
            // FIX: Sumar solo DEUDAS REALES (Netas por Grupo)
            const balancePorResponsable: Record<string, number> = {};

            // Agrupar saldos por responsable
            estadias?.forEach(e => {
                const tel = e.celular_responsable || 'unknown';
                balancePorResponsable[tel] = (balancePorResponsable[tel] || 0) + (e.saldo_pendiente || 0);
            });

            // Sumar solo los balances netos positivos
            const totalDeuda = Object.values(balancePorResponsable).reduce((acc, netBalance) => {
                return acc + (netBalance > 10 ? netBalance : 0); // Margen de $10 por redondeo
            }, 0);

            const personasRiesgo = acampantes?.filter(p => p.es_persona_riesgo).length || 0;
            const ocupacion = estadias?.filter(e => e.parcela_asignada).length || 0;

            setStats({
                totalPersonas: acampantes?.length || 0,
                totalDeuda,
                personasRiesgo,
                ocupacionParcelas: ocupacion,
                visitantesHoy: 0
            });

            // Feat W: Check for overdue stays
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Midnight local

            const expired = estadias?.filter(e => {
                // Parse date safely (assuming YYYY-MM-DD)
                if (!e.fecha_egreso_programada) return false;
                // Add T12:00:00 to ensure we compare against noon of that day (avoiding timezone shift)
                const egressDate = new Date(`${e.fecha_egreso_programada}T12:00:00`);
                return egressDate < today; // If egress was yesterday (or before), it's overdue
            }) || [];

            setOverdueStays(expired);

            // Fetch Visitors Today
            const { count: visitorsCount, error: visitorsError } = await supabase
                .from('visitas_diarias')
                .select('*', { count: 'exact', head: true })
                .gte('fecha_visita', today.toISOString());

            setStats({
                totalPersonas: acampantes?.length || 0,
                totalDeuda,
                personasRiesgo,
                ocupacionParcelas: ocupacion,
                visitantesHoy: visitorsCount || 0
            });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to handle card click
    const handleCardClick = (e: React.MouseEvent, persona: Acampante) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setEditingPersona(persona);
    };

    // Filter Logic
    const personasFiltradas = items.filter(item => {
        const matchesSearch =
            item.persona.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.persona.dni_pasaporte?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.estadia.parcela_asignada?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRiesgo = filterRiesgo ? item.persona.es_persona_riesgo : true;

        return matchesSearch && matchesRiesgo;
    });

    return (
        <Layout>
            <div className="space-y-6">

                {/* Overdue Alert Banner (Feat W) */}
                {overdueStays.length > 0 && (
                    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 rounded-r shadow-sm animate-pulse-slow">
                        <div className="flex items-center gap-3">
                            <Clock className="w-6 h-6 text-amber-600" />
                            <div>
                                <p className="font-bold text-lg">¡Atención!</p>
                                <p>Hay <span className="font-bold text-amber-700">{overdueStays.length} estadía(s) vencida(s)</span> que requieren Check-out inmediato.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header & Stats Banner */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-white/60 backdrop-blur-sm border-blue-200">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="p-2 bg-blue-100/50 rounded-full mb-2">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-800">{stats.totalPersonas}</p>
                            <p className="text-xs text-muted font-medium uppercase tracking-wide">Personas</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/60 backdrop-blur-sm border-emerald-200">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="p-2 bg-emerald-100/50 rounded-full mb-2">
                                <DollarSign className="w-5 h-5 text-emerald-600" />
                            </div>
                            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(stats.totalDeuda)}</p>
                            <p className="text-xs text-muted font-medium uppercase tracking-wide">Deuda Total</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/60 backdrop-blur-sm border-red-200">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="p-2 bg-red-100/50 rounded-full mb-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <p className="text-2xl font-bold text-red-600">{stats.personasRiesgo}</p>
                            <p className="text-xs text-muted font-medium uppercase tracking-wide">Grupo Riesgo</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/60 backdrop-blur-sm border-indigo-200">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="p-2 bg-indigo-100/50 rounded-full mb-2">
                                <Tent className="w-5 h-5 text-indigo-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-800">{stats.ocupacionParcelas}</p>
                            <p className="text-xs text-muted font-medium uppercase tracking-wide">Parcelas</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/60 backdrop-blur-sm border-purple-200 cursor-pointer hover:bg-white/80 transition-colors" onClick={() => setShowVisitorsList(true)}>
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="p-2 bg-purple-100/50 rounded-full mb-2">
                                <UserCheck className="w-5 h-5 text-purple-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-800">{stats.visitantesHoy}</p>
                            <div className="flex items-center gap-1">
                                <p className="text-xs text-muted font-medium uppercase tracking-wide">Visitantes Hoy</p>
                                <ListIcon className="w-3 h-3 text-purple-400" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Toolbar: Filters & View Toggle */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Buscar acampante, DNI o parcela..."
                            className="pl-9 border-gray-200 focus:border-primary/50 transition-all bg-gray-50 focus:bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            className="hidden md:flex items-center gap-2"
                            onClick={() => router.push('/reportes/transferencias')}
                        >
                            <DollarSign className="w-4 h-4 text-green-600" />
                            Transferencias
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "flex items-center gap-2 border-amber-200 hover:bg-amber-50 text-amber-900",
                                overdueStays.length > 0 ? "animate-pulse border-amber-400" : ""
                            )}
                            onClick={() => setShowCheckoutControl(true)}
                        >
                            <ClipboardCheck className="w-4 h-4 text-amber-600" />
                            Checkout Control
                            {overdueStays.length > 0 && (
                                <Badge className="ml-1 bg-amber-500 hover:bg-amber-600 text-[10px] h-5 px-1.5">
                                    {overdueStays.length}
                                </Badge>
                            )}
                        </Button>

                        <label className={cn(
                            "flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg border transition-all",
                            filterRiesgo ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        )}>
                            <input
                                type="checkbox"
                                checked={filterRiesgo}
                                onChange={(e) => setFilterRiesgo(e.target.checked)}
                                className="w-4 h-4 text-red-500 rounded focus:ring-red-500 accent-red-500"
                            />
                            <span className="text-sm font-medium">Solo Riesgo</span>
                        </label>

                        <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button
                                onClick={() => toggleView('grid')}
                                className={cn(
                                    "p-1.5 rounded-md transition-all",
                                    viewMode === 'grid' ? "bg-white shadow-sm text-primary" : "text-gray-400 hover:text-gray-600"
                                )}
                                title="Vista Tarjetas"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => toggleView('list')}
                                className={cn(
                                    "p-1.5 rounded-md transition-all",
                                    viewMode === 'list' ? "bg-white shadow-sm text-primary" : "text-gray-400 hover:text-gray-600"
                                )}
                                title="Vista Lista"
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-muted text-sm animate-pulse">Cargando base de datos...</p>
                    </div>
                ) : (
                    <>
                        {/* VIEW MODE: GRID */}
                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {personasFiltradas.map((item, idx) => {
                                    const hasDebt = (item.estadia.saldo_pendiente_grupal || 0) > 10 || (item.estadia.saldo_pendiente || 0) > 10;
                                    const isRisk = item.persona.es_persona_riesgo;
                                    const isResponsible = item.persona.es_responsable_pago;
                                    const isOverdue = overdueStays.some(o => o.id === item.estadia.id);

                                    return (
                                        <Card
                                            key={item.persona.celular || idx}
                                            className={cn(
                                                "hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden border-t-4",
                                                isOverdue ? "border-t-amber-500 bg-amber-50" : (isRisk ? "border-t-red-500" : "border-t-primary")
                                            )}
                                            onClick={(e) => handleCardClick(e, item.persona)}
                                        >
                                            <CardContent className="p-0">
                                                {/* Header */}
                                                <div className="p-5 pb-3">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex flex-col">
                                                            <h3 className="font-bold text-xl text-gray-900 truncate max-w-[200px]" title={item.persona.nombre_completo}>
                                                                {item.persona.nombre_completo}
                                                            </h3>
                                                            <span className="text-sm text-gray-500 font-medium mt-1">
                                                                {item.estadia.parcela_asignada ? `Parcela: ${item.estadia.parcela_asignada}` : <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sin Parcela</span>}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            {isResponsible && (
                                                                <Badge variant={hasDebt ? "danger" : "success"} className="text-xs px-2 py-1 shadow-sm">
                                                                    {hasDebt ? "DEUDA" : "AL DÍA"}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Indicators */}
                                                    <div className="flex items-center justify-between mt-2 min-h-[24px]">
                                                        {isRisk ? (
                                                            <Badge variant="danger" className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 hover:bg-red-200 border-red-200">
                                                                <AlertTriangle className="w-3 h-3 mr-1" /> Riesgo
                                                            </Badge>
                                                        ) : <span></span>}

                                                        {isOverdue && (
                                                            <Badge variant="warning" className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border-amber-200">
                                                                <Clock className="w-3 h-3 mr-1" /> Vencida
                                                            </Badge>
                                                        )}

                                                        {hasDebt && isResponsible && (
                                                            <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                                                {formatCurrency(item.estadia.saldo_pendiente)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Body */}
                                                <div className="bg-gray-50/50 px-5 py-3 border-t border-b border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                                                    <CalendarPlus className="w-4 h-4 text-gray-400" />
                                                    <span>
                                                        Salida: {new Date(item.estadia.fecha_egreso_programada).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>

                                                {/* Actions Grid */}
                                                <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-100">
                                                    {role !== 'medico' && role !== 'auditor' && (
                                                        <>
                                                            <button
                                                                onClick={() => router.push(`/recursos/${item.estadia.id}`)}
                                                                className="flex items-center justify-center gap-2 py-4 bg-white hover:bg-orange-50 transition-colors group/btn"
                                                            >
                                                                <Sun className="w-5 h-5 text-orange-500" />
                                                                <span className="font-semibold text-gray-700 group-hover/btn:text-orange-700">RECURSOS</span>
                                                            </button>
                                                            <button
                                                                onClick={() => router.push(`/extension/${item.estadia.id}`)}
                                                                className="flex items-center justify-center gap-2 py-4 bg-white hover:bg-blue-50 transition-colors group/btn"
                                                            >
                                                                <CalendarPlus className="w-5 h-5 text-blue-500" />
                                                                <span className="font-semibold text-gray-700 group-hover/btn:text-blue-700">EXTENDER</span>
                                                            </button>
                                                            <button
                                                                onClick={() => router.push(`/saldo/${item.estadia.id}`)}
                                                                className="flex items-center justify-center gap-2 py-4 bg-white hover:bg-green-50 transition-colors group/btn"
                                                            >
                                                                <Wallet className="w-5 h-5 text-green-600" />
                                                                <span className="font-semibold text-gray-700 group-hover/btn:text-green-700">SALDO</span>
                                                            </button>
                                                            <button
                                                                onClick={() => router.push(`/checkout/${item.estadia.id}`)}
                                                                className="flex items-center justify-center gap-2 py-4 bg-white hover:bg-red-50 transition-colors group/btn"
                                                            >
                                                                <CheckCircle className="w-5 h-5 text-red-600" />
                                                                <span className="font-semibold text-gray-700 group-hover/btn:text-red-700">CHECK OUT</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Hover Overlay */}
                                                <div className="absolute inset-x-0 bottom-0 top-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                                                    <Badge className="bg-white/90 text-black shadow-lg translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                                        Click para Editar
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}

                        {/* VIEW MODE: LIST */}
                        {viewMode === 'list' && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="grid grid-cols-1 divide-y divide-gray-100">
                                    {personasFiltradas.map((item) => {
                                        const hasDebt = (item.estadia.saldo_pendiente_grupal || 0) > 10 || (item.estadia.saldo_pendiente || 0) > 10;
                                        const isRisk = item.persona.es_persona_riesgo;
                                        const isResponsible = item.persona.es_responsable_pago;
                                        const isOverdue = overdueStays.some(o => o.id === item.estadia.id);

                                        return (
                                            <div
                                                key={item.persona.celular}
                                                className="p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                                            >
                                                {/* Person Info */}
                                                <div
                                                    className="flex items-center gap-4 flex-1 cursor-pointer"
                                                    onClick={(e) => handleCardClick(e, item.persona)}
                                                >
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm",
                                                        isRisk ? "bg-red-500" : "bg-primary"
                                                    )}>
                                                        {item.persona.nombre_completo.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-gray-900">{item.persona.nombre_completo}</h4>
                                                            {isRisk && <Badge variant="danger" className="text-[9px] px-1 py-0">RIESGO</Badge>}
                                                            {isOverdue && <Badge variant="warning" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800">VENCIDA</Badge>}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                                            <span className="flex items-center gap-1"><Tent className="w-3 h-3" /> {item.estadia.parcela_asignada ? `Parcela: ${item.estadia.parcela_asignada}` : 'Sin parcela'}</span>
                                                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {item.persona.celular}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Status & Actions */}
                                                <div className="flex items-center gap-4 justify-between md:justify-end w-full md:w-auto">
                                                    {isResponsible && (
                                                        <div className="text-right mr-4">
                                                            <div className={cn("text-xs font-bold px-2 py-0.5 rounded-full inline-block", hasDebt ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>
                                                                {hasDebt ? "DEUDA" : "AL DÍA"}
                                                            </div>
                                                            {hasDebt && (
                                                                <p className="text-xs font-bold text-red-600 mt-0.5">
                                                                    {formatCurrency(item.estadia.saldo_pendiente)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-1">
                                                        {role !== 'medico' && role !== 'auditor' && (
                                                            <>
                                                                <Button variant="ghost" size="icon" onClick={() => router.push(`/recursos/${item.estadia.id}`)} title="Recursos">
                                                                    <Sun className="w-4 h-4 text-orange-500" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => router.push(`/extension/${item.estadia.id}`)} title="Extender">
                                                                    <CalendarPlus className="w-4 h-4 text-blue-500" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => router.push(`/saldo/${item.estadia.id}`)} title="Saldo">
                                                                    <Wallet className="w-4 h-4 text-green-600" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => router.push(`/checkout/${item.estadia.id}`)} title="Check Out">
                                                                    <CheckCircle className="w-4 h-4 text-red-600" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingPersona(item.persona); }}>
                                                            <MoreHorizontal className="w-4 h-4 text-gray-400" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Modal de Edición */}
                <EditCamperModal
                    isOpen={!!editingPersona}
                    onClose={() => {
                        setEditingPersona(null);
                        fetchData(); // Refresh on close
                    }}
                    acampante={editingPersona}
                />

                <CheckoutControlModal
                    isOpen={showCheckoutControl}
                    onClose={() => setShowCheckoutControl(false)}
                    overdueItems={items.filter(item => overdueStays.some(o => o.id === item.estadia.id))}
                />

                <VisitorsListModal
                    isOpen={showVisitorsList}
                    onClose={() => setShowVisitorsList(false)}
                />
            </div>
        </Layout>
    );
}
