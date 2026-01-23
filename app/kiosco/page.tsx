'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Layout } from '@/components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Plus, Minus, Trash2, DollarSign, Shield } from 'lucide-react';
import { formatCurrency, getNoonTimestamp } from '@/lib/utils';

interface Producto {
    id: string;
    nombre: string;
    precio: number;
    activo: boolean;
}

interface ItemCarrito {
    id: string; // Unique ID for each cart item
    producto: Producto;
    cantidad: number;
    precioEditado?: number; // For 'Otros' product
    editando?: boolean; // Controls input visibility vs text
}

export default function KioscoPage() {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
    const [role, setRole] = useState<string>('invitado'); // Auth state

    useEffect(() => {
        // Load Role
        const session = document.cookie.split('; ').find(row => row.startsWith('camp_session='));
        if (session) {
            try {
                const val = session.split('=')[1];
                const parsed = JSON.parse(decodeURIComponent(val));
                setRole(parsed.role || 'invitado');
            } catch (e) {
                console.error("Error parsing session", e);
            }
        }
    }, []);
    const [loading, setLoading] = useState(true);
    const [procesando, setProcesando] = useState(false);
    const [mensajeExito, setMensajeExito] = useState(false);

    useEffect(() => {
        cargarProductos();
    }, []);

    const cargarProductos = async () => {
        try {
            const { data, error } = await supabase
                .from('productos_kiosco')
                .select('*')
                .eq('activo', true)
                .order('nombre');

            if (error) throw error;
            setProductos(data || []);
        } catch (error) {
            console.error('Error cargando productos:', error);
        } finally {
            setLoading(false);
        }
    };

    const agregarAlCarrito = (producto: Producto) => {
        setCarrito(prev => {
            // Tratamiento especial para 'Otros': siempre crea nueva instancia
            // Tratamiento especial para 'Otros' y productos 'Prod ...'
            const esEspecial = producto.nombre.toLowerCase().includes('otros') ||
                producto.nombre.toLowerCase().startsWith('prod ') ||
                producto.nombre.toLowerCase().includes('maestro');

            if (esEspecial) {
                return [...prev, {
                    id: crypto.randomUUID(),
                    producto,
                    cantidad: 1,
                    precioEditado: 0, // Start at 0 to induce typing
                    editando: true
                }];
            }

            // Para otros productos: acumular cantidad
            const existe = prev.find(item => item.producto.id === producto.id);
            if (existe) {
                return prev.map(item =>
                    item.producto.id === producto.id
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item
                );
            }
            return [...prev, { id: crypto.randomUUID(), producto, cantidad: 1 }];
        });
    };

    const cambiarCantidad = (itemId: string, delta: number) => {
        setCarrito(prev => {
            return prev.map(item => {
                if (item.id === itemId) {
                    const nuevaCantidad = item.cantidad + delta;
                    return { ...item, cantidad: Math.max(0, nuevaCantidad) };
                }
                return item;
            }).filter(item => item.cantidad > 0);
        });
    };

    const eliminarDelCarrito = (itemId: string) => {
        setCarrito(prev => prev.filter(item => item.id !== itemId));
    };

    const cambiarPrecio = (itemId: string, nuevoPrecio: number) => {
        setCarrito(prev => prev.map(item =>
            item.id === itemId ? { ...item, precioEditado: nuevoPrecio } : item
        ));
    };

    const toggleEdit = (itemId: string, estado: boolean) => {
        setCarrito(prev => prev.map(item =>
            item.id === itemId ? { ...item, editando: estado } : item
        ));
    };

    const calcularTotal = () => {
        return carrito.reduce((total, item) => {
            const precio = item.precioEditado ?? item.producto.precio;
            return total + (precio * item.cantidad);
        }, 0);
    };

    const finalizarVenta = async () => {
        if (carrito.length === 0) return;

        setProcesando(true);

        try {
            const fechaVenta = getNoonTimestamp();

            // Registrar cada item en la venta (usando precio editado si existe)
            const ventas = carrito.map(item => {
                const precioFinal = item.precioEditado ?? item.producto.precio;
                return {
                    producto_id: item.producto.id,
                    cantidad: item.cantidad,
                    precio_unitario: precioFinal,
                    monto_total: precioFinal * item.cantidad,
                    fecha_venta: fechaVenta,
                };
            });

            const { error } = await supabase
                .from('kiosco_ventas')
                .insert(ventas);

            if (error) throw error;

            // Mostrar mensaje de éxito
            setMensajeExito(true);
            setTimeout(() => setMensajeExito(false), 3000);

            // Limpiar carrito
            setCarrito([]);

        } catch (error) {
            console.error('Error al procesar venta:', error);
        } finally {
            setProcesando(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <p className="text-muted">Cargando productos...</p>
                </div>
            </Layout>
        );
    }

    const total = calcularTotal();

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">
                        Punto de Venta - Kiosco
                    </h1>
                    <p className="text-muted mt-1">
                        Registro rápido de ventas
                    </p>
                </div>

                {/* Mensaje de éxito */}
                {mensajeExito && (
                    <div className="bg-success/10 border-2 border-success rounded-lg p-4 flex items-center gap-3">
                        <DollarSign className="w-6 h-6 text-success" />
                        <div>
                            <p className="font-medium text-success">¡Venta registrada exitosamente!</p>
                            <p className="text-sm text-muted">El carrito ha sido limpiado.</p>
                        </div>
                    </div>
                )}

                <div className="grid lg:grid-cols-3 gap-6 relative">
                    {/* Auditor Overlay */}
                    {role === 'auditor' && (
                        <div className="absolute inset-0 z-50 bg-white/50 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 text-center">
                                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <h3 className="text-xl font-bold text-gray-800">Modo Auditoría</h3>
                                <p className="text-muted">La venta está deshabilitada en este modo.</p>
                            </div>
                        </div>
                    )}
                    {/* Productos */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Productos Disponibles</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {/* Productos Estándar */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Generales</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {productos.filter(p => !p.nombre.toLowerCase().startsWith('prod ')).map(producto => (
                                                <button
                                                    key={producto.id}
                                                    onClick={() => agregarAlCarrito(producto)}
                                                    className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-left"
                                                >
                                                    <p className="font-semibold text-foreground">{producto.nombre}</p>
                                                    <p className="text-lg text-primary font-bold mt-2">
                                                        {formatCurrency(producto.precio)}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Productos Especiales (Prod ...) */}
                                    {productos.some(p => p.nombre.toLowerCase().startsWith('prod ')) && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="h-px flex-1 bg-gray-200"></div>
                                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Productos Especiales</h3>
                                                <div className="h-px flex-1 bg-gray-200"></div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {productos.filter(p => p.nombre.toLowerCase().startsWith('prod ')).map(producto => (
                                                    <button
                                                        key={producto.id}
                                                        onClick={() => agregarAlCarrito(producto)}
                                                        className="p-4 bg-purple-50 border-2 border-purple-100 rounded-lg hover:border-purple-400 hover:shadow-md transition-all text-left"
                                                    >
                                                        <p className="font-semibold text-purple-900">{producto.nombre}</p>
                                                        <p className="text-lg text-purple-700 font-bold mt-2">
                                                            {formatCurrency(producto.precio)}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Carrito */}
                    <div>
                        <Card className="sticky top-4">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5" />
                                    Carrito ({carrito.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {carrito.length === 0 ? (
                                    <p className="text-muted text-center py-8">
                                        Carrito vacío
                                    </p>
                                ) : (
                                    <>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                            {carrito.map(item => {
                                                const precio = item.precioEditado ?? item.producto.precio;
                                                const esEspecial = item.producto.nombre.toLowerCase().includes('otros') ||
                                                    item.producto.nombre.toLowerCase().startsWith('prod ') ||
                                                    item.producto.nombre.toLowerCase().includes('maestro');

                                                return (
                                                    <div key={item.id} className="border-b border-gray-200 pb-3">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <p className="font-medium text-sm">{item.producto.nombre}</p>
                                                            <button
                                                                onClick={() => eliminarDelCarrito(item.id)}
                                                                className="text-danger hover:text-danger/80"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        {/* Precio editable para 'Otros' y Especiales */}
                                                        {esEspecial && (
                                                            <div className="mb-2">
                                                                <label className="text-xs text-muted">Precio:</label>
                                                                {item.editando ? (
                                                                    <input
                                                                        type="number"
                                                                        autoFocus
                                                                        onFocus={(e) => e.target.select()} // Auto-select to replace number
                                                                        value={item.precioEditado || ''}
                                                                        onChange={(e) => cambiarPrecio(item.id, parseFloat(e.target.value) || 0)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                toggleEdit(item.id, false);
                                                                            }
                                                                        }}
                                                                        onBlur={() => toggleEdit(item.id, false)}
                                                                        className="w-full px-2 py-1 text-sm border border-primary ring-2 ring-primary/20 rounded font-bold"
                                                                        min="0"
                                                                        step="100"
                                                                        placeholder="0"
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        onClick={() => toggleEdit(item.id, true)}
                                                                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-gray-50 cursor-pointer hover:bg-gray-100 flex justify-between items-center group"
                                                                    >
                                                                        <span className="font-bold">{formatCurrency(item.precioEditado || 0)}</span>
                                                                        <span className="text-xs text-muted group-hover:text-primary">(Editar)</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => cambiarCantidad(item.id, -1)}
                                                                    className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <span className="w-8 text-center font-semibold">
                                                                    {item.cantidad}
                                                                </span>
                                                                <button
                                                                    onClick={() => cambiarCantidad(item.id, 1)}
                                                                    className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <p className="font-semibold text-primary">
                                                                {formatCurrency(precio * item.cantidad)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Total */}
                                        <div className="border-t-2 border-gray-300 pt-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-lg font-bold">Total:</span>
                                                <span className="text-2xl font-bold text-primary">
                                                    {formatCurrency(total)}
                                                </span>
                                            </div>

                                            <Button
                                                onClick={finalizarVenta}
                                                disabled={procesando}
                                                variant="primary"
                                                className="w-full"
                                            >
                                                <DollarSign className="w-5 h-5 mr-2" />
                                                {procesando ? 'Procesando...' : 'Finalizar Venta'}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
