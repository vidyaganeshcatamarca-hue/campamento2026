'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AcampanteReasign } from './helpers';

interface ListaAcampantesProps {
    acampantes: AcampanteReasign[];
    onCambiarACompanero: (acampante: AcampanteReasign) => void;
}

export function ListaAcampantes({ acampantes, onCambiarACompanero }: ListaAcampantesProps) {
    if (acampantes.length <= 1) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Acampantes de esta Estadía</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {acampantes.map(acampante => (
                        <div
                            key={acampante.celular}
                            className="flex items-center justify-between p-3 bg-secondary/5 rounded-lg border border-gray-200"
                        >
                            <div className="flex-1">
                                <p className="font-medium">{acampante.nombre_completo}</p>
                                <p className="text-sm text-muted">{acampante.celular}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {acampante.es_responsable_pago ? (
                                    <>
                                        <Badge variant="success">Responsable de Pago</Badge>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onCambiarACompanero(acampante)}
                                        >
                                            Cambiar a Acompañante
                                        </Button>
                                    </>
                                ) : (
                                    <Badge variant="secondary">Acompañante</Badge>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-muted mt-3">
                    💡 Si dos personas se marcaron como responsables por error, usa "Cambiar a Acompañante"
                    para corregirlo y asignarlas a la estadía correcta.
                </p>
            </CardContent>
        </Card>
    );
}
