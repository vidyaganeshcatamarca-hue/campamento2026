'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { EstadiaActiva } from './helpers';

interface ModalReasignacionProps {
    isOpen: boolean;
    acompante: { nombre_completo: string } | null;
    estadiasActivas: EstadiaActiva[];
    onClose: () => void;
    onReasignar: (celularResponsable: string) => void;
}

export function ModalReasignacion({
    isOpen,
    acompante,
    estadiasActivas,
    onClose,
    onReasignar
}: ModalReasignacionProps) {
    if (!isOpen || !acompante) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold mb-2">Reasignar a otro Responsable</h3>
                <p className="text-sm text-muted mb-4">
                    Selecciona la estadía (responsable) a la que pertenece <strong>{acompante.nombre_completo}</strong>:
                </p>

                {estadiasActivas.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-4">
                        <p className="text-sm text-amber-800">
                            No hay otras estadías activas disponibles para reasignación.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                        {estadiasActivas.map(estadia => (
                            <button
                                key={estadia.id}
                                onClick={() => onReasignar(estadia.celular_responsable)}
                                className="w-full text-left p-3 border border-gray-200 rounded hover:bg-secondary/10 hover:border-primary transition"
                            >
                                <p className="font-medium text-primary">📱 {estadia.celular_responsable}</p>
                                <p className="text-xs text-muted mt-1">Click para asignar a esta estadía</p>
                            </button>
                        ))}
                    </div>
                )}

                <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full"
                >
                    Cancelar
                </Button>
            </div>
        </div>
    );
}
