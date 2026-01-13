'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface MapaParcelasProps {
    ocupadas: number[];
    reservadas: number[];
    seleccionadas?: number[];
    onSelect?: (parcelaId: number) => void;
    detalles?: Record<number, string>;
    className?: string;
}

// Coordenadas aproximadas en porcentaje (top, left)
// Ajustadas visualmente basándose en el mapa provisto
const COORDENADAS: Record<number, { top: number; left: number }> = {
    // ZONA A (Derecha Arriba) - 1 al 11
    1: { top: 40, left: 86 },
    2: { top: 43, left: 84 },
    3: { top: 46, left: 82 },
    4: { top: 49, left: 80 },
    5: { top: 51, left: 78 },
    6: { top: 50, left: 74 },
    7: { top: 49, left: 72 },
    8: { top: 51, left: 70 },
    9: { top: 48, left: 71 },
    10: { top: 47, left: 69 },
    11: { top: 48, left: 67 },

    // ZONA B (Vertical Derecha) - 12 al 29
    12: { top: 53, left: 54 },
    13: { top: 56, left: 54 },
    14: { top: 55, left: 51 },
    15: { top: 55, left: 49 },
    16: { top: 59, left: 50 },
    17: { top: 58, left: 55 },
    18: { top: 60, left: 55 },
    19: { top: 62, left: 55 },
    20: { top: 64, left: 55 },
    21: { top: 66, left: 55 },
    22: { top: 67, left: 53 },
    23: { top: 69, left: 54 },
    24: { top: 68, left: 57 },
    25: { top: 70, left: 57 },
    26: { top: 72, left: 59 },
    27: { top: 68, left: 59 },
    28: { top: 67, left: 61 },
    29: { top: 79, left: 59 },

    // ZONA C (Abajo Centro) - 30 al 47
    30: { top: 68, left: 49 },
    31: { top: 66, left: 48 },
    32: { top: 64, left: 46 },
    33: { top: 63, left: 45 },
    34: { top: 61, left: 44 },
    35: { top: 60, left: 43 },
    36: { top: 60, left: 41 },
    37: { top: 59, left: 40 },
    38: { top: 58, left: 39 },
    39: { top: 58, left: 37 },
    40: { top: 58, left: 35 },
    41: { top: 57, left: 34 },
    42: { top: 56, left: 33 },
    43: { top: 59, left: 30 },
    44: { top: 60, left: 29 },
    45: { top: 62, left: 28 },
    46: { top: 63, left: 27 },
    47: { top: 71, left: 31 },

    // ZONA D (Izquierda Centro) - 48 al 51
    48: { top: 50, left: 28 },
    49: { top: 48, left: 35 },
    50: { top: 48, left: 37 },
    51: { top: 45, left: 39 },

    // ZONA E (Arriba Centro - Zona 55) - 52 al 59
    52: { top: 35, left: 42 },
    53: { top: 34, left: 43 },
    54: { top: 33, left: 44 },
    55: { top: 28, left: 45 }, // Zona marcada
    56: { top: 28, left: 47 },
    57: { top: 29, left: 49 },
    58: { top: 30, left: 51 },
    59: { top: 31, left: 53 },
};

export function MapaParcelas({
    ocupadas,
    reservadas,
    seleccionadas = [],
    onSelect,
    className
}: MapaParcelasProps) {
    const [zoom, setZoom] = React.useState(150); // Default to 150%
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Initial Centering
    React.useEffect(() => {
        if (containerRef.current) {
            const container = containerRef.current;
            const scrollWidth = container.scrollWidth;
            const scrollHeight = container.scrollHeight;
            const clientWidth = container.clientWidth;
            const clientHeight = container.clientHeight;

            // Center: (ContentSize - ViewportSize) / 2
            container.scrollLeft = (scrollWidth - clientWidth) / 2;
            container.scrollTop = (scrollHeight - clientHeight) / 2;
        }
    }, []); // Run once on mount

    // Keyboard Zoom
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '+' || e.key === '=') { // + or = (unshifted +)
                setZoom(z => Math.min(z + 25, 250));
            } else if (e.key === '-') {
                setZoom(z => Math.max(z - 25, 100));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className={cn("relative w-full aspect-[1.3/1] bg-gray-100 rounded-xl overflow-hidden shadow-lg border border-gray-200 group", className)}>
            {/* Scroll Container */}
            <div ref={containerRef} className="w-full h-full overflow-auto scrollbar-hide">
                <div
                    className="relative w-full h-full transition-all duration-300 ease-in-out origin-top-left"
                    style={{ width: `${zoom}%`, height: `${zoom}%` }}
                >
                    {/* Imagen de Fondo */}
                    <div
                        className="absolute inset-0 w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: 'url("/mapa-parcelas.png")' }}
                    />

                    {/* Parcelas */}
                    {Object.entries(COORDENADAS).map(([idStr, coords]) => {
                        const id = parseInt(idStr);
                        const isOccupied = ocupadas.includes(id);
                        const isReserved = reservadas.includes(id);
                        const isSelected = seleccionadas.includes(id);

                        let bgClass = "bg-white hover:bg-gray-50 border-gray-400 text-gray-700";

                        if (isSelected) {
                            bgClass = "bg-blue-600 border-blue-700 text-white z-20 scale-110 shadow-md";
                        } else if (isOccupied) {
                            bgClass = "bg-red-500 border-red-600 text-white cursor-not-allowed";
                        } else if (isReserved) {
                            bgClass = "bg-yellow-400 border-yellow-500 text-yellow-900";
                        } else {
                            bgClass = "bg-green-500 border-green-600 text-white hover:bg-green-400 cursor-pointer shadow-sm";
                        }

                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => !isOccupied && onSelect?.(id)}
                                // Slightly smaller markers to reduce overlap (w-5 h-5 / w-7 h-7)
                                className={cn(
                                    "absolute w-5 h-5 md:w-6 md:h-6 -ml-2.5 -mt-2.5 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold border rounded shadow-sm transition-all duration-200",
                                    bgClass
                                )}
                                style={{
                                    top: `${coords.top}%`,
                                    left: `${coords.left}%`
                                }}
                                title={`Parcela ${id}`}
                            >
                                {id}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Controles de Zoom */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 bg-white/90 p-1 rounded-md shadow border backdrop-blur-sm z-30">
                <button
                    onClick={() => setZoom(z => Math.min(z + 25, 250))}
                    className="p-1 hover:bg-gray-200 rounded text-gray-700 font-bold w-6 h-6 flex items-center justify-center"
                    title="Zoom In (+)"
                >
                    +
                </button>
                <button
                    onClick={() => setZoom(z => Math.max(z - 25, 100))}
                    className="p-1 hover:bg-gray-200 rounded text-gray-700 font-bold w-6 h-6 flex items-center justify-center"
                    title="Zoom Out (-)"
                >
                    -
                </button>
            </div>

            {/* Referencias / Leyenda */}
            <div className="absolute bottom-2 left-2 bg-white/90 p-2 rounded-lg text-xs flex gap-3 shadow-sm backdrop-blur-sm z-30 border border-gray-200/50">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500 border border-green-600"></div>
                    <span>Libre</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500 border border-red-600"></div>
                    <span>Ocupada</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-500"></div>
                    <span>Reservada</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-600 border border-blue-700"></div>
                    <span>Selección</span>
                </div>
            </div>
        </div>
    );
}

