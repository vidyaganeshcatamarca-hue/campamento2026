import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary' | 'outline';
    className?: string;
}

export function Badge({ children, variant = 'info', className }: BadgeProps) {
    const variants = {
        success: 'badge-success',
        warning: 'badge-warning',
        danger: 'badge-danger',
        info: 'badge-info',
        primary: 'bg-primary/10 text-primary border border-primary/20',
        secondary: 'bg-gray-100 text-gray-800 border border-gray-200',
        outline: 'bg-transparent border border-gray-300 text-gray-700',
    };

    return (
        <span className={cn('badge', variants[variant], className)}>
            {children}
        </span>
    );
}
