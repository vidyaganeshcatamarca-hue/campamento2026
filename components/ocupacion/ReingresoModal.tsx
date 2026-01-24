import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, UserPlus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ReingresoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ReingresoModal({ isOpen, onClose }: ReingresoModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<'search' | 'confirm'>('search');
    const [loading, setLoading] = useState(false);

    // Search State
    const [celular, setCelular] = useState('');
    const [foundCamper, setFoundCamper] = useState<any>(null);

    // New Stay State
    const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split('T')[0]);
    const [fechaEgreso, setFechaEgreso] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [cantPersonas, setCantPersonas] = useState(1);

    // Form Data (Pre-filled from search)
    const [formData, setFormData] = useState({
        nombre_completo: '',
        dni: '',
        es_persona_riesgo: false,
        enfermedades: '',
        medicacion: ''
    });

    // State for historical stay
    const [lastStay, setLastStay] = useState<any>(null);

    // Reset loading state safely
    useEffect(() => {
        setLoading(false);
        if (!isOpen) {
            setStep('search');
            setFoundCamper(null);
            setLastStay(null);
            setCelular('');
        }
    }, [isOpen]);

    const handleSearch = async () => {
        if (!celular || loading) return;
        setLoading(true);
        try {
            // 1. Fetch Camper
            const { data: camper, error: camperError } = await supabase
                .from('acampantes')
                .select('*')
                .eq('celular', celular.trim())
                .limit(1)
                .single();

            if (camperError) {
                if (camperError.code === 'PGRST116') {
                    toast.error('No se encontró acampante con ese celular');
                } else {
                    toast.error(`Error: ${camperError.message}`);
                }
                setFoundCamper(null);
                return;
            }

            if (camper) {
                setFoundCamper(camper);
                setFormData({
                    nombre_completo: camper.nombre_completo || '',
                    dni: camper.dni_pasaporte || '',
                    es_persona_riesgo: camper.es_persona_riesgo || false,
                    enfermedades: camper.enfermedades || '',
                    medicacion: camper.medicacion || ''
                });

                // 2. Fetch Last Stay to inherit resources
                const { data: stays, error: staysError } = await supabase
                    .from('estadias')
                    .select('*')
                    .eq('celular_responsable', camper.celular)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (!staysError && stays && stays.length > 0) {
                    setLastStay(stays[0]);
                    setCantPersonas(stays[0].cant_personas_total || 1);
                    console.log('Estadía previa recuperada:', stays[0]);
                }

                setStep('confirm');
                toast.success('Datos recuperados correctamente');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error en la búsqueda');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('🚀 [DEBUG] handleSubmit iniciado');
        if (loading) {
            console.log('⚠️ [DEBUG] Ya está cargando, abortando');
            return;
        }

        if (!foundCamper || !foundCamper.celular) {
            console.error('❌ [DEBUG] Camper no encontrado o sin celular');
            toast.error('Error: No se detectó el celular del acampante');
            return;
        }

        if (!fechaEgreso) {
            console.error('❌ [DEBUG] Fecha egreso no definida');
            toast.error('Por favor, selecciona una fecha de egreso');
            return;
        }

        setLoading(true);
        const tid = toast.loading('Registrando reingreso y creando estadía...');

        try {
            const fIn = new Date(fechaIngreso + 'T12:00:00');
            const fOut = new Date(fechaEgreso + 'T12:00:00');
            const diff = fOut.getTime() - fIn.getTime();
            const noches = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));

            const newStayData = {
                celular_responsable: foundCamper.celular,
                fecha_ingreso: fIn.toISOString(),
                fecha_egreso_programada: fOut.toISOString(),
                cant_personas_total: cantPersonas || 1,
                acumulado_noches_persona: noches * (cantPersonas || 1),
                cant_parcelas_total: lastStay?.cant_parcelas_total || 1,
                cant_sillas_total: lastStay?.cant_sillas_total || 0,
                cant_mesas_total: lastStay?.cant_mesas_total || 0,
                tipo_vehiculo: lastStay?.tipo_vehiculo || 'Ninguno',
                estado_estadia: 'activa',
                ingreso_confirmado: false,
                observaciones: `Reingreso: ${formData.nombre_completo} (Herencia de data histórica)`
            };

            console.log('📡 [DEBUG] Intentando insertar estadía:', newStayData);

            // 1. Create New Stay inheriting historical values
            const { data: estadia, error: estError, status, statusText } = await supabase
                .from('estadias')
                .insert(newStayData)
                .select()
                .single();

            console.log('📥 [DEBUG] Respuesta Supabase Estadia:', { estadia, estError, status, statusText });

            if (estError) {
                console.error('❌ [DEBUG] Error al insertar estadía:', estError);
                toast.error(`Error Supabase: ${estError.message} (${estError.code})`);
                alert(`ERROR SUPABASE (estadias): ${estError.message}\nCódigo: ${estError.code}\nStatus: ${status}`);
                throw estError;
            }

            if (!estadia) {
                console.error('❌ [DEBUG] Estadía creada pero retornó null');
                toast.error('Error: La estadía se creó pero no devolvió datos');
                throw new Error('Estadía retornó null');
            }

            console.log('✅ [DEBUG] Estadía creada exitosamente con ID:', estadia.id);

            // 2. Update Camper with the NEW stay ID
            console.log('📡 [DEBUG] Intentando actualizar acampante:', foundCamper.celular, 'con estadia_id:', estadia.id);
            const { error: updateError, status: uStatus } = await supabase
                .from('acampantes')
                .update({
                    estadia_id: estadia.id,
                    es_responsable_pago: true,
                    nombre_completo: formData.nombre_completo,
                    dni_pasaporte: formData.dni,
                    es_persona_riesgo: formData.es_persona_riesgo,
                    enfermedades: formData.enfermedades,
                    medicacion: formData.medicacion
                })
                .eq('celular', foundCamper.celular);

            console.log('📥 [DEBUG] Respuesta Supabase Update Acampante:', { updateError, uStatus });

            if (updateError) {
                console.error('❌ [DEBUG] Error al actualizar acampante:', updateError);
                toast.error(`Error al vincular acampante: ${updateError.message}`);
                alert(`ERROR SUPABASE (update acampantes): ${updateError.message}\nStatus: ${uStatus}`);
                // Cleanup stay if update fails
                console.log('🧹 [DEBUG] Limpiando estadía huérfana...');
                await supabase.from('estadias').delete().eq('id', estadia.id);
                throw updateError;
            }

            console.log('🎉 [DEBUG] Todo completado con éxito');
            toast.dismiss(tid);
            toast.success('¡Reingreso exitoso!');

            setTimeout(() => {
                onClose();
                router.push(`/checkin/${estadia.id}`);
            }, 500);

        } catch (error: any) {
            console.error("❌ [DEBUG] Error general en catch:", error);
            toast.dismiss(tid);
            toast.error(`Error crítico: ${error.message || 'Error desconocido'}`);
            alert(`ERROR CRÍTICO: ${error.message}\n${JSON.stringify(error)}`);
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Reingreso de Acampante</DialogTitle>
                </DialogHeader>

                {step === 'search' ? (
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted">Ingresa el celular para recuperar datos históricos.</p>
                        <div className="flex gap-2">
                            <Input
                                placeholder="3834..."
                                value={celular}
                                onChange={(e) => setCelular(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <Button onClick={handleSearch} disabled={!celular || loading}>
                                {loading ? '...' : <Search className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[75vh] overflow-y-auto px-1">
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                            <div className="flex items-center gap-3">
                                <UserPlus className="w-5 h-5 text-primary" />
                                <div>
                                    <h4 className="font-bold text-primary leading-none">{formData.nombre_completo || 'Acampante'}</h4>
                                    <p className="text-xs text-muted mt-1">Socio / Cliente frecuente</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Fecha Ingreso"
                                type="date"
                                value={fechaIngreso}
                                onChange={(e) => setFechaIngreso(e.target.value)}
                                required
                            />
                            <Input
                                label="Fecha Egreso"
                                type="date"
                                value={fechaEgreso}
                                onChange={(e) => setFechaEgreso(e.target.value)}
                                required
                            />
                        </div>

                        <Input
                            label="Integrantes del grupo"
                            type="number"
                            min={1}
                            value={cantPersonas}
                            onChange={(e) => setCantPersonas(parseInt(e.target.value) || 1)}
                            required
                        />

                        <Input
                            label="Confirmar Nombre"
                            value={formData.nombre_completo}
                            onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                            required
                        />

                        <div className="flex gap-3 pt-6 sticky bottom-0 bg-white">
                            <Button type="button" variant="outline" onClick={() => setStep('search')} className="flex-1">
                                Atrás
                            </Button>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`flex-[2] h-11 rounded-lg font-bold text-white transition-all
                                    ${loading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-[#E67E22] hover:bg-[#D35400] active:scale-95 shadow-md shadow-orange-200'
                                    }
                                `}
                            >
                                {loading ? 'Enviando...' : 'Crear Estadía'}
                            </button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
