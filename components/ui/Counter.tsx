import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CounterProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    label?: string;
    className?: string;
}

export function Counter({ value, onChange, min = 0, max, label, className }: CounterProps) {
    const handleIncrement = () => {
        if (max === undefined || value < max) {
            onChange(value + 1);
        }
    };

    const handleDecrement = () => {
        if (value > min) {
            onChange(value - 1);
        }
    };

    return (
        <div className={cn('flex items-center gap-3', className)}>
            {label && (
                <span className="text-sm font-medium text-foreground min-w-[100px]">
                    {label}
                </span>
            )}
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 p-1">
                <button
                    onClick={handleDecrement}
                    disabled={value <= min}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrementar"
                >
                    <Minus className="w-4 h-4 text-foreground" />
                </button>
                <span className="min-w-[40px] text-center font-semibold text-foreground">
                    {value}
                </span>
                <button
                    onClick={handleIncrement}
                    disabled={max !== undefined && value >= max}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Incrementar"
                >
                    <Plus className="w-4 h-4 text-foreground" />
                </button>
            </div>
        </div>
    );
}
