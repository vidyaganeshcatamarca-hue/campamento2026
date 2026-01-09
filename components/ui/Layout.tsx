'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    UserCheck,
    Users,
    DollarSign,
    MessageSquare,
    LogOut,
    BarChart3,
    UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
    children: React.ReactNode;
}

const navigation = [
    { name: 'Recepción', href: '/recepcion', icon: UserCheck },
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Visitantes', href: '/visitantes', icon: Users },
    { name: 'Check-out', href: '/checkout', icon: LogOut },
    { name: 'Caja', href: '/caja', icon: DollarSign },
    { name: 'Ocupación', href: '/ocupacion', icon: BarChart3 },
    { name: 'Deudores', href: '/deudores', icon: UserCog },
    { name: 'Mensajería', href: '/mensajeria', icon: MessageSquare },
];

export function Layout({ children }: LayoutProps) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-background">
            {/* Header - Desktop and Mobile */}
            <header className="bg-primary text-white shadow-lg">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                                <span className="text-xl font-bold">V</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Campamento Vrindavan</h1>
                                <p className="text-xs text-secondary-light">Sistema de Gestión</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-col md:flex-row">
                {/* Sidebar - Desktop */}
                <aside className="hidden md:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-72px)]">
                    <nav className="p-4 space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                                        isActive
                                            ? 'bg-primary text-white'
                                            : 'text-foreground hover:bg-secondary-light hover:text-white'
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
                    <div className="container mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
                <div className="grid grid-cols-4 gap-1 p-2">
                    {navigation.slice(0, 4).map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors',
                                    isActive
                                        ? 'bg-primary text-white'
                                        : 'text-muted'
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-xs font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
