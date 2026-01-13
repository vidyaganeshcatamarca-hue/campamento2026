'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Home,
    UserCheck,
    Users,
    DollarSign,
    MessageSquare,
    LogOut,
    BarChart3,
    UserCog,
    ShoppingBag,
    Shield,
    MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
    children: React.ReactNode;
}

const navigation = [
    { name: 'Recepción', href: '/recepcion', icon: UserCheck },
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Visitantes', href: '/visitantes', icon: Users },
    { name: 'Kiosco', href: '/kiosco', icon: ShoppingBag },
    { name: 'Auditoría Kiosco', href: '/kiosco-auditoria', icon: BarChart3 },
    { name: 'Caja', href: '/caja', icon: DollarSign },
    { name: 'Ocupación', href: '/ocupacion', icon: MapPin },
    { name: 'Deudores', href: '/deudores', icon: UserCog },
    { name: 'Mensajería', href: '/mensajeria', icon: MessageSquare },
];

import Cookies from 'js-cookie';

export function Layout({ children }: LayoutProps) {
    const pathname = usePathname();
    const [role, setRole] = React.useState<string>('invitado');

    React.useEffect(() => {
        const session = Cookies.get('camp_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                setRole(parsed.role || 'invitado');
            } catch (e) {
                console.error("Error parsing session", e);
            }
        }
    }, []);

    // Definición de Permisos por Rol
    const getAllowedRoutes = (role: string) => {
        const common = [];
        switch (role) {
            case 'admin':
                return navigation; // Todo
            case 'recepcion':
                return navigation.filter(i => ['Recepción', 'Dashboard', 'Visitantes', 'Kiosco', 'Ocupación', 'Mensajería'].includes(i.name));
            case 'seguridad':
                return navigation.filter(i => ['Ocupación', 'Visitantes'].includes(i.name));
            case 'kiosco':
                return navigation.filter(i => ['Kiosco', 'Auditoría Kiosco'].includes(i.name));
            case 'medico':
                return navigation.filter(i => ['Dashboard'].includes(i.name));
            case 'servicio':
                return navigation.filter(i => ['Ocupación', 'Dashboard'].includes(i.name));
            default:
                return [];
        }
    };

    const router = useRouter();

    const handleLogout = () => {
        Cookies.remove('camp_session');
        router.push('/login');
        router.refresh();
    };

    const filteredNavigation = getAllowedRoutes(role);

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
                                <p className="text-xs text-secondary-light">Sistema de Gestión | {role.toUpperCase()}</p>
                            </div>
                        </div>
                        <div className="text-xs bg-white/10 px-2 py-1 rounded">
                            {role === 'admin' ? 'SUPERUSER' : 'Usuario Limitado'}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-col md:flex-row">
                {/* Sidebar - Desktop */}
                <aside className="hidden md:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-72px)]">
                    <nav className="p-4 space-y-1">
                        {filteredNavigation.map((item) => {
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
                                            : 'text-foreground hover:bg-secondary-light hover:text-primary'
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            );
                        })}

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors mt-4"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">Cerrar Sesión</span>
                        </button>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
                    <div className="container mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation - Horizontal Scroll */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                <div className="flex overflow-x-auto p-2 gap-2 no-scrollbar">
                    {filteredNavigation.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'flex flex-col items-center justify-center min-w-[70px] px-2 py-2 rounded-lg transition-colors shrink-0',
                                    isActive
                                        ? 'bg-primary text-white'
                                        : 'text-muted hover:bg-gray-50'
                                )}
                            >
                                <Icon className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium leading-none text-center truncate w-full">{item.name}</span>
                            </Link>
                        );
                    })}

                    {/* Mobile Logout */}
                    <button
                        onClick={handleLogout}
                        className="flex flex-col items-center justify-center min-w-[70px] px-2 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                        <LogOut className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium leading-none text-center">Salir</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}
