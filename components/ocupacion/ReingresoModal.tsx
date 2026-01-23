import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, UserPlus, Calendar, ArrowRight } from 'lucide-react';
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
    const [foundCamper, setFoundCamper] = useState<any | null>(null);

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

    const handleSearch = async () => {
        if (!celular) return;
        setLoading(true);
        try {
            // Find most recent camper with this phone
            const { data, error } = await supabase
                .from('acampantes')
                .select('*')
                .eq('celular', celular)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                console.error("Search error:", error);
                // PGRST116 = JSON object requested, multiple (or no) rows returned
                if (error.code === 'PGRST116') {
                    toast.error('No se encontró acampante con ese celular');
                } else {
                    toast.error(`Error de búsqueda: ${error.message}`);
                }
                setFoundCamper(null);
            } else if (data) {
                setFoundCamper(data);
                setFormData({
                    nombre_completo: data.nombre_completo || '',
                    dni: data.dni || '',
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
            }
        } catch (e) {
            console.error(e);
            toast.error('Error en la búsqueda');
        } finally {
            setLoading(false);
        }
    };

    // Reset loading state when step changes to ensure button is enabled
    React.useEffect(() => {
        setLoading(false);
    }, [step]);

    const handleSubmit = async () => {
        console.log("Submit presionado", { fechaEgreso, foundCamper });

        if (!fechaEgreso) {
            toast.error('Ingrese fecha de egreso');
            return;
        }
        if (!foundCamper || !foundCamper.id) {
            toast.error('Error: No se ha seleccionado un acampante válido');
            return;
        }

        setLoading(true);
        try {
            // Calcular noches
            const fIn = new Date(fechaIngreso + 'T12:00:00');
            const fOut = new Date(fechaEgreso + 'T12:00:00');
            const diff = fOut.getTime() - fIn.getTime();
            const noches = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));

            // 1. Crear Nueva Estadía (Payload Completo)
            const { data: estadia, error: estError } = await supabase
                .from('estadias')
                .insert({
                    celular_responsable: foundCamper.celular,
                    fecha_ingreso: fIn.toISOString(),
                    fecha_egreso_programada: fOut.toISOString(),
                    cant_personas_total: cantPersonas || 1,
                    acumulado_noches_persona: noches * (cantPersonas || 1), // Calculamos inicial
                    cant_parcelas_total: 1, // Default 1 parcela
                    cant_sillas_total: 0,
                    cant_mesas_total: 0,
                    tipo_vehiculo: 'ninguno', // Default
                    estado_estadia: 'activa',
                    ingreso_confirmado: false,
                    observaciones: `Reingreso: ${foundCamper.nombre_completo}`
                })
                .select()
                .single();

            if (estError) throw new Error(`Error creando estadía: ${estError.message}`);
            if (!estadia) throw new Error("No se pudo crear la estadía");

            // 2. Vincular Acampante Existente CONCRETO a la nueva Estadía
            // IMPORTANTE: Usamos el ID del acampante encontrado en la búsqueda, no solo el celular
            const { error: updateError } = await supabase
                .from('acampantes')
                .update({
                    estadia_id: estadia.id,
                    es_responsable_pago: true,
                    // Actualizamos datos básicos
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
                .eq('id', foundCamper.id); // <--- CLAVE: Actualizamos SOLO este registro

            if (updateError) {
                // Si falla, borramos la estadía huérfana
                await supabase.from('estadias').delete().eq('id', estadia.id);
                throw new Error(`Error vinculando acampante: ${updateError.message}`);
            }

            toast.success('Reingreso completado. Redirigiendo...');

            setTimeout(() => {
                onClose();
                router.push(`/checkin/${estadia.id}`);
            }, 1000);

        } catch (error: any) {
            console.error("[Reingreso] Error:", error);
            toast.error(error.message || 'Error desconocido al procesar reingreso');
            setLoading(false); // Ensure loading is reset on error
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
                        <p className="text-sm text-muted">Ingrese el celular del acampante antiguo para buscar sus datos.</p>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Celular (ej: 115555...)"
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
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                                <UserPlus className="w-4 h-4" />
                                {formData.nombre_completo}
                            </h4>
                            <p className="text-sm text-muted">Datos recuperados del historial.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Fecha Ingreso"
                                type="date"
                                value={fechaIngreso}
                                onChange={(e) => setFechaIngreso(e.target.value)}
                            />
                            <Input
                                label="Fecha Egreso"
                                type="date"
                                value={fechaEgreso}
                                onChange={(e) => setFechaEgreso(e.target.value)}
                            />
                        </div>

                        <Input
                            label="Cantidad Personas Total"
                            type="number"
                            min={1}
                            value={cantPersonas}
                            onChange={(e) => setCantPersonas(parseInt(e.target.value) || 1)}
                        />

                        {/* Editables if needed */}
                        <Input
                            label="Nombre Completo (Editable)"
                            value={formData.nombre_completo}
                            onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                        />

                        <div className="flex justify-between gap-3 pt-2">
                            <Button variant="outline" onClick={() => setStep('search')}>Atrás</Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-[#E67E22] hover:bg-[#ca6f1e] text-white font-bold border-none"
                            >
                                {loading ? 'Procesando...' : 'Crear Estadía e Ir a Check-in'} <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
