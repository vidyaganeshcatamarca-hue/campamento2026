'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, User } from 'lucide-react';
import Cookies from 'js-cookie';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Validate against Database
            const { data, error: dbError } = await supabase
                .from('usuarios_sistema')
                .select('*')
                .eq('username', username)
                .single();

            if (dbError || !data) {
                throw new Error('Usuario no encontrado');
            }

            // 2. Validate Password (Simple text for MVP as requested)
            if (data.password !== password) {
                throw new Error('Contraseña incorrecta');
            }

            // 3. Set Session Cookie (Expires in 1 day)
            // Using logic compatible with middleware
            Cookies.set('camp_session', JSON.stringify({ user: username, role: data.role }), { expires: 1 });

            // 4. Redirect
            router.push('/dashboard');
            router.refresh(); // Force middleware re-eval

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl border-0">
                <CardHeader className="text-center pb-2">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-800">Campamento Vrindavan</CardTitle>
                    <p className="text-muted text-sm">Sistema de Gestión Integral</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Usuario</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="admin"
                                    className="pl-9"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    type="password"
                                    placeholder="••••••"
                                    className="pl-9"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <span className="font-bold">Error:</span> {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2 mt-4 transition-all"
                            disabled={loading || !username || !password}
                        >
                            {loading ? 'Verificando...' : 'Iniciar Sesión'}
                        </Button>

                        <div className="text-center pt-2">
                            <p className="text-xs text-gray-400">Acceso restringido a personal autorizado</p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
