'use client';

import React from 'react';
import { Acampante, Estadia } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Phone, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArriboWithEstadia extends Acampante {
    estadia?: Estadia;
}

interface ArriboCardProps {
    acampante: ArriboWithEstadia;
    onClick: () => void;
}

export function ArriboCard({ acampante, onClick }: ArriboCardProps) {
    const esRiesgo = acampante.es_persona_riesgo;

    return (
        <Card
            hover
            onClick={onClick}
            className={cn(
                'transition-all',
                esRiesgo && 'border-2 border-danger shadow-lg'
            )}
        >
            <CardContent>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h4 className="font-semibold text-foreground text-lg">
                            {acampante.nombre_completo}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-muted">
                            <Phone className="w-4 h-4" />
                            <span className="text-sm">{acampante.celular}</span>
                        </div>

                        {acampante.edad && (
                            <p className="text-sm text-muted mt-1">
                                Edad: {acampante.edad} años
                            </p>
                        )}
                    </div>

                    {esRiesgo && (
                        <div className="flex flex-col items-end gap-2">
                            <Badge variant="danger" className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                RIESGO MÉDICO
                            </Badge>
                        </div>
                    )}
                </div>

                {esRiesgo && acampante.enfermedades && (
                    <div className="mt-3 pt-3 border-t border-danger/20">
                        <p className="text-xs text-danger font-medium">
                            Condición: {acampante.enfermedades}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
