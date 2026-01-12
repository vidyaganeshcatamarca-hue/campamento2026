import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all animate-in fade-in zoom-in-95 duration-200 p-4">
            <div className="fixed inset-0" onClick={() => onOpenChange(false)}></div>
            {children}
        </div>
    );
}

export function DialogContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`relative z-50 w-full bg-white rounded-lg shadow-xl border border-gray-200 p-6 animate-in slide-in-from-bottom-5 duration-300 ${className}`}>
            {children}
        </div>
    );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">{children}</div>;
}

export function DialogTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h2>;
}

export function DialogDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <p className={`text-sm text-muted-foreground ${className}`}>{children}</p>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6">{children}</div>;
}
