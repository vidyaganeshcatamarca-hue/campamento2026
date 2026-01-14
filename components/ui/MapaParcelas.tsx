'use client';

import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface ParcelaMapData {
    id: string | number;
    nombre: string;
    estado: string; // 'libre' | 'ocupada' | 'reservada'
    pos_x?: number; // 0-100%
    pos_y?: number; // 0-100%
}

interface MapaParcelasProps {
    parcelas: ParcelaMapData[]; // Replaces simple number arrays
    seleccionadas?: (string | number)[];
    onSelect?: (parcelaId: string | number) => void;
    detalles?: Record<string | number, string>;
    className?: string;

    // Editor Props
    modoEdicion?: boolean;
    onParcelDragEnd?: (id: string | number, x: number, y: number) => void;
    onMapClick?: (x: number, y: number) => void;
}

// Coordenadas aproximadas legacy (Fallback)
const COORDENADAS: Record<number, { top: number; left: number }> = {
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
    48: { top: 50, left: 28 },
    49: { top: 48, left: 35 },
    50: { top: 48, left: 37 },
    51: { top: 45, left: 39 },
    52: { top: 35, left: 42 },
    53: { top: 34, left: 43 },
    54: { top: 33, left: 44 },
    55: { top: 28, left: 45 },
    56: { top: 28, left: 47 },
    57: { top: 29, left: 49 },
    58: { top: 30, left: 51 },
    59: { top: 31, left: 53 },
};

export function MapaParcelas({
    parcelas,
    seleccionadas = [],
    onSelect,
    detalles,
    className,
    modoEdicion = false,
    onParcelDragEnd,
    onMapClick
}: MapaParcelasProps) {
    const [zoom, setZoom] = useState(150);
    const containerRef = useRef<HTMLDivElement>(null);
    const mapContentRef = useRef<HTMLDivElement>(null);

    // Initial Center
    useEffect(() => {
        if (containerRef.current) {
            const container = containerRef.current;
            container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
            container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
        }
    }, []);

    const handleMapClick = (e: React.MouseEvent) => {
        if (!modoEdicion || !onMapClick || !mapContentRef.current) return;

        // Ensure we clicked the background, not a button
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;

        const rect = mapContentRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        onMapClick(parseFloat(x.toFixed(1)), parseFloat(y.toFixed(1)));
    };

    // Simple Drag Logic
    const handleDragEnd = (e: React.DragEvent, id: string | number) => {
        if (!modoEdicion || !onParcelDragEnd || !mapContentRef.current) return;

        // Prevent default ghost image behavior interference if necessary
        e.preventDefault();

        const rect = mapContentRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Limites 0-100
        const safeX = Math.max(0, Math.min(100, x));
        const safeY = Math.max(0, Math.min(100, y));

        onParcelDragEnd(id, parseFloat(safeX.toFixed(1)), parseFloat(safeY.toFixed(1)));
    };

    return (
        <div className={cn("relative w-full aspect-[1.3/1] bg-gray-100 rounded-xl overflow-hidden shadow-lg border border-gray-200 group", className)}>
            <div ref={containerRef} className="w-full h-full overflow-auto scrollbar-hide bg-gray-900/5">
                <div
                    ref={mapContentRef}
                    className="relative w-full h-full transition-all duration-300 ease-in-out origin-top-left cursor-crosshair"
                    style={{ width: `${zoom}%`, height: `${zoom}%` }}
                    onClick={handleMapClick}
                    onDragOver={(e) => e.preventDefault()} // Allow Drop
                >
                    <div
                        className="absolute inset-0 w-full h-full bg-cover bg-center pointer-events-none"
                        style={{ backgroundImage: 'url("/mapa-parcelas.png")' }}
                    />

                    {parcelas.map((p) => {
                        const id = p.id;
                        // Hibrido: Usa DB coords si existen, sino Legacy (fuzzy match number)
                        const legacyId = typeof id === 'string' ? parseInt(id.replace(/\D/g, '')) : id;
                        const coords = p.pos_x && p.pos_y
                            ? { top: p.pos_y, left: p.pos_x }
                            : (legacyId ? COORDENADAS[legacyId] : null);

                        if (!coords) return null; // Skip if no coords found

                        const isSelected = seleccionadas.includes(id);
                        const isOccupied = p.estado === 'ocupada';
                        const isReserved = p.estado === 'reservada';

                        let bgClass = "bg-green-500 border-green-600 text-white hover:bg-green-400 cursor-pointer shadow-sm";
                        if (isSelected) bgClass = "bg-blue-600 border-blue-700 text-white z-20 scale-110 shadow-md";
                        else if (isOccupied) bgClass = "bg-red-500 border-red-600 text-white"; // Allow click now
                        else if (isReserved) bgClass = "bg-yellow-400 border-yellow-500 text-yellow-900";

                        if (modoEdicion) bgClass += " cursor-move ring-2 ring-white";

                        return (
                            <button
                                key={id}
                                type="button"
                                draggable={modoEdicion}
                                onDragEnd={(e) => handleDragEnd(e, id)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect?.(id);
                                }}
                                className={cn(
                                    "absolute w-5 h-5 md:w-6 md:h-6 -ml-2.5 -mt-2.5 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold border rounded shadow-sm transition-all duration-200",
                                    bgClass
                                )}
                                style={{
                                    top: `${coords.top}%`,
                                    left: `${coords.left}%`
                                }}
                                title={detalles?.[id] || `Parcela ${id}`}
                            >
                                {id}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Helper Zoom Controls */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 bg-white/90 p-1 rounded-md shadow border backdrop-blur-sm z-30">
                <button onClick={() => setZoom(z => Math.min(z + 25, 250))} className="p-1 hover:bg-gray-200 rounded font-bold w-6 h-6">+</button>
                <button onClick={() => setZoom(z => Math.max(z - 25, 100))} className="p-1 hover:bg-gray-200 rounded font-bold w-6 h-6">-</button>
            </div>
        </div>
    );
}

