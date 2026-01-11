'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Acampante, supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface EditCamperModalProps {
    isOpen: boolean;
    onClose: () => void;
    acampante: Acampante | null;
}

export function EditCamperModal({ isOpen, onClose, acampante }: EditCamperModalProps) {
    const [formData, setFormData] = useState<Partial<Acampante>>({});
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (acampante) {
            setFormData({
                nombre_completo: acampante.nombre_completo,
                celular: acampante.celular,
                edad: acampante.edad,
                grupo_sanguineo: acampante.grupo_sanguineo,
                obra_social: acampante.obra_social,
                contacto_emergencia: acampante.contacto_emergencia,
                enfermedades: acampante.enfermedades,
                alergias: acampante.alergias,
                medicacion: acampante.medicacion
            });
        }
    }, [acampante]);

    const handleSave = async () => {
        if (!acampante) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('acampantes')
                .update(formData)
                .eq('id', acampante.id);

            if (error) throw error;

            toast.success('Acampante actualizado correctamente');
            onClose();
        } catch (error) {
            console.error('Error updating camper:', error);
            toast.error('Error al actualizar datos');
        } finally {
            setLoading(false);
        }
    };

    if (!acampante) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar Acampante</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <Input
                        label="Nombre Completo"
                        value={formData.nombre_completo || ''}
                        onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                    />
                    <Input
                        label="Celular"
                        value={formData.celular || ''}
                        onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    />
                    <Input
                        label="Edad"
                        type="number"
                        value={formData.edad || ''}
                        onChange={(e) => setFormData({ ...formData, edad: parseInt(e.target.value) || 0 })}
                    />
                    <Input
                        label="Grupo Sanguíneo"
                        value={formData.grupo_sanguineo || ''}
                        onChange={(e) => setFormData({ ...formData, grupo_sanguineo: e.target.value })}
                    />
                    <Input
                        label="Obra Social"
                        value={formData.obra_social || ''}
                        onChange={(e) => setFormData({ ...formData, obra_social: e.target.value })}
                    />
                    <Input
                        label="Contacto Emergencia"
                        value={formData.contacto_emergencia || ''}
                        onChange={(e) => setFormData({ ...formData, contacto_emergencia: e.target.value })}
                    />
                    <div className="md:col-span-2 space-y-4 pt-2 border-t">
                        <h4 className="font-medium text-sm text-muted-foreground">Información Médica</h4>
                        <Input
                            label="Enfermedades / Condiciones"
                            value={formData.enfermedades || ''}
                            onChange={(e) => setFormData({ ...formData, enfermedades: e.target.value })}
                        />
                        <Input
                            label="Alergias"
                            value={formData.alergias || ''}
                            onChange={(e) => setFormData({ ...formData, alergias: e.target.value })}
                        />
                        <Input
                            label="Medicación Actual"
                            value={formData.medicacion || ''}
                            onChange={(e) => setFormData({ ...formData, medicacion: e.target.value })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
