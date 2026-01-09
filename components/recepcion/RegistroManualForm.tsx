'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Counter } from '@/components/ui/Counter';
import { X } from 'lucide-react';

interface RegistroManualFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function RegistroManualForm({ onClose, onSuccess }: RegistroManualFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        // Datos personales
        nombre_completo: '',
        celular: '',
        dni_pasaporte: '',
        edad: 18,
        grupo_sanguineo: '',

        // Fechas (formato YYYY-MM-DD desde input type="date")
        fecha_ingreso: '',
        fecha_salida: '',

        // Responsabilidad
        es_responsable_pago: true,
        celular_responsable: '', // Solo si NO es responsable

        // Inventario (solo si ES responsable)
        cant_parcelas_total: 1,
        cant_sillas_total: 0,
        cant_mesas_total: 0,
        tipo_vehiculo: '',

        // Salud
        es_persona_riesgo: false,
        obra_social: '',
        enfermedades: '',
        alergias: '',
        medicacion: '',
        tratamiento: '',
        contacto_emergencia: '',
    });

    // Función para convertir fecha a ISO con mediodía Argentina
    const obtenerFechaISO = (fechaStr: string): string => {
        if (!fechaStr) return '';
        return `${fechaStr}T12:00:00-03:00`;
    };

    // Calcular noches entre dos fechas
    const calcularNoches = (inicio: string, fin: string): number => {
        const fIn = new Date(inicio);
        const fOut = new Date(fin);
        const diff = fOut.getTime() - fIn.getTime();
        const noches = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
        return noches;
    };

    // Determinar tipo de vehículo
    const obtenerTipoVehiculo = (texto: string): string => {
        const t = texto.toLowerCase();
        if (t.includes('auto')) return 'auto';
        if (t.includes('moto')) return 'moto';
        return 'ninguno';
    };

    // Lógica de riesgo: edad >= 70 O marcó SI O escribió enfermedad != "ninguna"
    const esPersonaRiesgo = (): boolean => {
        if (formData.edad >= 70) return true;
        if (formData.es_persona_riesgo) return true;
        const enf = formData.enfermedades.toLowerCase().trim();
        if (enf && enf !== 'ninguna' && enf !== '') return true;
        return false;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Preparar datos
            const fInISO = obtenerFechaISO(formData.fecha_ingreso);
            const fOutISO = obtenerFechaISO(formData.fecha_salida);
            const nochesPersona = calcularNoches(fInISO, fOutISO);

            const celularPropio = formData.celular.replace(/\s/g, '');
            const celularLider = formData.es_responsable_pago
                ? celularPropio
                : formData.celular_responsable.replace(/\s/g, '');

            const tipoVehiculoFinal = obtenerTipoVehiculo(formData.tipo_vehiculo);
            const esRiesgo = esPersonaRiesgo();

            let estadiaId: string | null = null;

            // --- BUSCAR ESTADÍA EXISTENTE ---
            const { data: estadiasExistentes, error: searchError } = await supabase
                .from('estadias')
                .select('id, acumulado_noches_persona, cant_personas_total, fecha_ingreso, fecha_egreso_programada')
                .eq('celular_responsable', celularLider)
                .eq('estado_estadia', 'activa')
                .limit(1);

            if (searchError) throw searchError;

            if (estadiasExistentes && estadiasExistentes.length > 0) {
                // --- ESTADÍA EXISTENTE: SUMAR PERSONA Y EXPANDIR FECHAS ---
                const est = estadiasExistentes[0];
                estadiaId = est.id;

                // Expandir rango de fechas
                const fInExistente = new Date(est.fecha_ingreso);
                const fOutExistente = new Date(est.fecha_egreso_programada);
                const fInNueva = new Date(fInISO);
                const fOutNueva = new Date(fOutISO);

                const fInFinal = fInNueva < fInExistente ? fInISO : est.fecha_ingreso;
                const fOutFinal = fOutNueva > fOutExistente ? fOutISO : est.fecha_egreso_programada;

                const updatePayload: any = {
                    cant_personas_total: (est.cant_personas_total || 0) + 1,
                    acumulado_noches_persona: (est.acumulado_noches_persona || 0) + nochesPersona,
                    fecha_ingreso: fInFinal,
                    fecha_egreso_programada: fOutFinal,
                };

                // Solo actualizar inventario si esta persona ES el responsable
                if (formData.es_responsable_pago) {
                    updatePayload.tipo_vehiculo = tipoVehiculoFinal;
                    updatePayload.cant_parcelas_total = formData.cant_parcelas_total;
                    updatePayload.cant_sillas_total = formData.cant_sillas_total;
                    updatePayload.cant_mesas_total = formData.cant_mesas_total;
                }

                const { error: updateError } = await supabase
                    .from('estadias')
                    .update(updatePayload)
                    .eq('id', estadiaId);

                if (updateError) throw updateError;

            } else {
                // --- NUEVA ESTADÍA: CREAR ---
                const { data: nuevaEstadia, error: estadiaError } = await supabase
                    .from('estadias')
                    .insert({
                        celular_responsable: celularLider,
                        fecha_ingreso: fInISO,
                        fecha_egreso_programada: fOutISO,
                        acumulado_noches_persona: nochesPersona,
                        cant_personas_total: 1,
                        tipo_vehiculo: tipoVehiculoFinal,
                        cant_parcelas_total: formData.cant_parcelas_total,
                        cant_sillas_total: formData.cant_sillas_total,
                        cant_mesas_total: formData.cant_mesas_total,
                        estado_estadia: 'activa',
                        ingreso_confirmado: false,
                    })
                    .select()
                    .single();

                if (estadiaError) throw estadiaError;
                estadiaId = nuevaEstadia.id;
            }

            // --- REGISTRAR ACAMPANTE ---
            const payloadAcampante: any = {
                celular: celularPropio,
                nombre_completo: formData.nombre_completo,
                dni_pasaporte: formData.dni_pasaporte || null,
                edad: formData.edad,
                es_persona_riesgo: esRiesgo,
                es_responsable_pago: formData.es_responsable_pago,
                celular_responsable: celularLider,
                estadia_id: estadiaId,
                grupo_sanguineo: formData.grupo_sanguineo || 'S/D',
                obra_social: formData.obra_social || 'Ninguna',
                enfermedades: formData.enfermedades || 'Ninguna',
                alergias: formData.alergias || 'Ninguna',
                medicacion: formData.medicacion || 'Ninguna',
                tratamiento: formData.tratamiento || 'No',
                contacto_emergencia: formData.contacto_emergencia,
                fecha_salida_individual: fOutISO,
            };

            let acampanteInsertado = false;
            let intentos = 0;

            while (!acampanteInsertado && intentos < 3) {
                const { error: acampanteError } = await supabase
                    .from('acampantes')
                    .insert(payloadAcampante);

                if (acampanteError) {
                    // Si falla por celular duplicado, agregar sufijo
                    if (acampanteError.code === '23505') { // Unique violation
                        intentos++;
                        payloadAcampante.celular = celularPropio + '-R' + Math.floor(Math.random() * 1000);
                    } else {
                        throw acampanteError;
                    }
                } else {
                    acampanteInsertado = true;
                }
            }

            if (!acampanteInsertado) {
                throw new Error('No se pudo registrar el acampante después de varios intentos');
            }

            alert('¡Registro creado exitosamente!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error al registrar:', error);
            alert('Error al crear el registro. Por favor intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-foreground">Registrar sin Formulario</h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Datos Personales */}
                    <section>
                        <h3 className="font-semibold text-lg mb-4 text-primary">Datos Personales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Nombre y Apellido *"
                                value={formData.nombre_completo}
                                onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                                required
                            />
                            <Input
                                label="WhatsApp *"
                                type="tel"
                                value={formData.celular}
                                onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                                required
                            />
                            <Input
                                label="DNI / Pasaporte"
                                value={formData.dni_pasaporte}
                                onChange={(e) => setFormData({ ...formData, dni_pasaporte: e.target.value })}
                            />
                            <Counter
                                label="Edad"
                                value={formData.edad}
                                onChange={(value) => setFormData({ ...formData, edad: value })}
                                min={1}
                                max={120}
                            />
                            <Input
                                label="Grupo Sanguíneo"
                                value={formData.grupo_sanguineo}
                                onChange={(e) => setFormData({ ...formData, grupo_sanguineo: e.target.value })}
                                placeholder="Ej: O+, A-, AB+"
                            />
                        </div>
                    </section>

                    {/* Fechas de Estadía */}
                    <section>
                        <h3 className="font-semibold text-lg mb-4 text-primary">Fechas de Estadía</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Fecha de Ingreso *"
                                type="date"
                                value={formData.fecha_ingreso}
                                onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                                required
                            />
                            <Input
                                label="Fecha de Salida *"
                                type="date"
                                value={formData.fecha_salida}
                                onChange={(e) => setFormData({ ...formData, fecha_salida: e.target.value })}
                                required
                            />
                        </div>
                    </section>

                    {/* Responsabilidad de Pago */}
                    <section>
                        <h3 className="font-semibold text-lg mb-4 text-primary">Responsabilidad de Pago</h3>
                        <div className="space-y-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.es_responsable_pago}
                                    onChange={(e) => setFormData({ ...formData, es_responsable_pago: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium">Soy el responsable del pago de mi grupo</span>
                            </label>

                            {!formData.es_responsable_pago && (
                                <Input
                                    label="WhatsApp del Responsable *"
                                    type="tel"
                                    value={formData.celular_responsable}
                                    onChange={(e) => setFormData({ ...formData, celular_responsable: e.target.value })}
                                    required={!formData.es_responsable_pago}
                                    placeholder="Celular de quien paga por el grupo"
                                />
                            )}
                        </div>
                    </section>

                    {/* Recursos (solo si ES responsable) */}
                    {formData.es_responsable_pago && (
                        <section>
                            <h3 className="font-semibold text-lg mb-4 text-primary">Recursos del Grupo</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Counter
                                    label="Carpas"
                                    value={formData.cant_parcelas_total}
                                    onChange={(value) => setFormData({ ...formData, cant_parcelas_total: value })}
                                    min={1}
                                />
                                <Counter
                                    label="Sillas"
                                    value={formData.cant_sillas_total}
                                    onChange={(value) => setFormData({ ...formData, cant_sillas_total: value })}
                                />
                                <Counter
                                    label="Mesas"
                                    value={formData.cant_mesas_total}
                                    onChange={(value) => setFormData({ ...formData, cant_mesas_total: value })}
                                />
                                <Input
                                    label="Vehículo / Patente"
                                    value={formData.tipo_vehiculo}
                                    onChange={(e) => setFormData({ ...formData, tipo_vehiculo: e.target.value })}
                                    placeholder="Ej: Auto ABC123, Moto XYZ789"
                                />
                            </div>
                        </section>
                    )}

                    {/* Datos de Salud */}
                    <section>
                        <h3 className="font-semibold text-lg mb-4 text-primary">Información de Salud</h3>
                        <div className="space-y-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.es_persona_riesgo}
                                    onChange={(e) => setFormData({ ...formData, es_persona_riesgo: e.target.checked })}
                                    className="w-4 h-4 text-danger"
                                />
                                <span className="text-sm font-medium">¿Presenta condición de riesgo médico?</span>
                            </label>

                            <Input
                                label="Obra Social"
                                value={formData.obra_social}
                                onChange={(e) => setFormData({ ...formData, obra_social: e.target.value })}
                            />
                            <Input
                                label="Enfermedades"
                                value={formData.enfermedades}
                                onChange={(e) => setFormData({ ...formData, enfermedades: e.target.value })}
                                placeholder="Escriba 'Ninguna' o detalle condiciones"
                            />
                            <Input
                                label="Alergias"
                                value={formData.alergias}
                                onChange={(e) => setFormData({ ...formData, alergias: e.target.value })}
                            />
                            <Input
                                label="Medicación"
                                value={formData.medicacion}
                                onChange={(e) => setFormData({ ...formData, medicacion: e.target.value })}
                            />
                            <Input
                                label="Contacto de Emergencia *"
                                value={formData.contacto_emergencia}
                                onChange={(e) => setFormData({ ...formData, contacto_emergencia: e.target.value })}
                                placeholder="Nombre y teléfono"
                                required
                            />
                        </div>
                    </section>

                    {/* Botones */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" disabled={loading} className="flex-1">
                            {loading ? 'Guardando...' : 'Registrar Pre-Ingreso'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
