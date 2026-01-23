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
        email: '',
        domicilio: '',
        localidad: '',
        provincia: '',
        pais: '',
        es_persona_riesgo: false,
        enfermedades: '',
        medicacion: ''
    });

    // Reset loading state safely
    useEffect(() => {
        setLoading(false);
        if (!isOpen) {
            setStep('search');
            setFoundCamper(null);
            setCelular('');
        }
    }, [isOpen]);

    const handleSearch = async () => {
        if (!celular || loading) return;
        setLoading(true);
        console.log("Iniciando búsqueda para:", celular);

        try {
            const { data, error } = await supabase
                .from('acampantes')
                .select('*') // Forzando select * por seguridad
                .eq('celular', celular.trim())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                console.error("Search error:", error);
                if (error.code === 'PGRST116') {
                    toast.error('No se encontró acampante con ese celular');
                } else {
                    toast.error(`Error: ${error.message}`);
                }
                setFoundCamper(null);
            } else if (data) {
                console.log("Camper encontrado:", data);

                // --- DEBUG: Forzar ID si por alguna razón no viene en el primer nivel del objeto ---
                if (!data.id && data.uuid) data.id = data.uuid;

                setFoundCamper(data);
                setFormData({
                    nombre_completo: data.nombre_completo || '',
                    dni: data.dni_pasaporte || '',
                    email: data.email || '',
                    domicilio: data.domicilio || '',
                    localidad: data.localidad || '',
                    provincia: data.provincia || '',
                    pais: data.pais || '',
                    es_persona_riesgo: data.es_persona_riesgo || false,
                    enfermedades: data.enfermedades || '',
                    medicacion: data.medicacion || ''
                });
                setStep('confirm');
                toast.success('Datos recuperados correctamente');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error en la búsqueda rápida');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // --- LOGS DE VERSION ---
        const VERSION = "V5_ID_FIX";
        console.log(`[${VERSION}] Submit click detectado`);

        if (loading) return;

        // Intentar detectar el ID en diferentes posibles campos (aunque debería ser 'id')
        const camperId = foundCamper?.id || foundCamper?.ID || foundCamper?.uuid;

        // Validaciones críticas con ALERTAS para depurar en móvil/vercel
        if (!foundCamper) {
            window.alert(`[${VERSION}] ERROR: foundCamper es NULL`);
            return;
        }

        if (!camperId) {
            window.alert(`[${VERSION}] ERROR: No se detecta ID en el camper. Objeto completo: ` + JSON.stringify(foundCamper));
            return;
        }

        if (!fechaEgreso) {
            window.alert(`[${VERSION}] ERROR: Falta fecha de egreso`);
            return;
        }

        window.alert(`[${VERSION}] OK: ID=${camperId}. Iniciando transacción...`);
        setLoading(true);
        const tid = toast.loading('Registrando reingreso...');

        try {
            // Calcular noches
            const fIn = new Date(fechaIngreso + 'T12:00:00');
            const fOut = new Date(fechaEgreso + 'T12:00:00');
            const diff = fOut.getTime() - fIn.getTime();
            const noches = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));

            // 1. Crear Nueva Estadía
            const { data: estadia, error: estError } = await supabase
                .from('estadias')
                .insert({
                    celular_responsable: foundCamper.celular,
                    fecha_ingreso: fIn.toISOString(),
                    fecha_egreso_programada: fOut.toISOString(),
                    cant_personas_total: cantPersonas || 1,
                    acumulado_noches_persona: noches * (cantPersonas || 1),
                    cant_parcelas_total: 1,
                    estado_estadia: 'activa',
                    ingreso_confirmado: false,
                    observaciones: `Reingreso: ${formData.nombre_completo}`
                })
                .select()
                .single();

            if (estError) throw estError;

            // 2. Actualizar Acampante
            const { error: updateError } = await supabase
                .from('acampantes')
                .update({
                    estadia_id: estadia.id,
                    es_responsable_pago: true,
                    nombre_completo: formData.nombre_completo,
                    dni_pasaporte: formData.dni,
                    email: formData.email,
                    domicilio: formData.domicilio,
                    localidad: formData.localidad,
                    provincia: formData.provincia,
                    pais: formData.pais,
                    es_persona_riesgo: formData.es_persona_riesgo,
                    enfermedades: formData.enfermedades,
                    medicacion: formData.medicacion
                })
                .eq('id', camperId); // Usar el ID detectado

            if (updateError) {
                // Rollback si falla el vínculo
                await supabase.from('estadias').delete().eq('id', estadia.id);
                throw updateError;
            }

            toast.dismiss(tid);
            toast.success('¡Reingreso exitoso!');

            window.alert(`[${VERSION}] ¡EXITO! Redirigiendo a Check-in...`);

            setTimeout(() => {
                onClose();
                router.push(`/checkin/${estadia.id}`);
            }, 500);

        } catch (error: any) {
            console.error("Error en proceso:", error);
            toast.dismiss(tid);
            toast.error(`Error: ${error.message}`);
            window.alert(`[${VERSION}] TRANSACTION FAILED: ` + error.message);
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
