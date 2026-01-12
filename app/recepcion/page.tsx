'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Acampante, Estadia } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ArriboCard } from '@/components/recepcion/ArriboCard';
import { RegistroManualForm } from '@/components/recepcion/RegistroManualForm';
import { RefreshCw, UserPlus, Search } from 'lucide-react';

interface ArriboWithEstadia extends Acampante {
    estadia?: Estadia;
}

export default function RecepcionPage() {
    const router = useRouter();
    const [arribos, setArribos] = useState<ArriboWithEstadia[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showRegistroManual, setShowRegistroManual] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchArribos = async () => {
        try {
            setRefreshing(true);

            // Obtener estadías pendientes de confirmación
            const { data: estadiasData, error: estadiasError } = await supabase
                .from('estadias')
                .select('*')
                .eq('ingreso_confirmado', false)
                .eq('estado_estadia', 'activa');

            if (estadiasError) throw estadiasError;

            if (!estadiasData || estadiasData.length === 0) {
                setArribos([]);
                return;
            }

            // Obtener acampantes correspondientes
            const estadiaIds = estadiasData.map(e => e.id);
            const { data: acampantesData, error: acampantesError } = await supabase
                .from('acampantes')
                .select('*')
                .in('estadia_id', estadiaIds)
                .in('estadia_id', estadiaIds);

            if (acampantesError) throw acampantesError;

            // Combinar datos
            const arribosCombinados = (acampantesData || []).map(acampante => ({
                ...acampante,
                estadia: estadiasData.find(e => e.id === acampante.estadia_id),
            }));

            setArribos(arribosCombinados);
        } catch (error) {
            console.error('Error al cargar arribos:', error);
            console.log('Error al cargar datos:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchArribos();
    }, []);

    // Filtrado en tiempo real
    const arribosFiltrados = useMemo(() => {
        if (!searchQuery.trim()) return arribos;

        const query = searchQuery.toLowerCase();
        return arribos.filter(arribo =>
            arribo.nombre_completo.toLowerCase().includes(query) ||
            arribo.celular.includes(query)
        );
    }, [arribos, searchQuery]);

    const handleArriboClick = (arribo: ArriboWithEstadia) => {
        if (arribo.estadia?.id) {
            router.push(`/checkin/${arribo.estadia.id}`);
        }
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-primary">
                            Recepción de Arribos
                        </h1>
                        <p className="text-muted mt-1">
                            {arribosFiltrados.length} {arribosFiltrados.length === 1 ? 'persona pendiente' : 'personas pendientes'} de check-in
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={fetchArribos}
                            disabled={refreshing}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden md:inline">Actualizar</span>
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => setShowRegistroManual(true)}
                            className="flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            Registrar sin Formulario
                        </Button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o celular..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    />
                </div>

                {/* Lista de Arribos */}
                {loading ? (
                    <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-muted">Cargando arribos...</p>
                    </div>
                ) : arribosFiltrados.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg">
                        <UserPlus className="w-12 h-12 text-muted mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            {searchQuery ? 'No se encontraron resultados' : 'No hay arribos pendientes'}
                        </h3>
                        <p className="text-muted mb-4">
                            {searchQuery
                                ? 'Intenta con otro término de búsqueda'
                                : 'Los acampantes pre-registrados aparecerán aquí'
                            }
                        </p>
                        {!searchQuery && (
                            <Button
                                variant="primary"
                                onClick={() => setShowRegistroManual(true)}
                            >
                                Registrar Manualmente
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {arribosFiltrados.map((arribo) => (
                            <ArriboCard
                                key={arribo.celular}
                                acampante={arribo}
                                onClick={() => handleArriboClick(arribo)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Registro Manual */}
            {showRegistroManual && (
                <RegistroManualForm
                    onClose={() => setShowRegistroManual(false)}
                    onSuccess={() => {
                        fetchArribos(); // Recargar lista
                    }}
                />
            )}
        </Layout>
    );
}
