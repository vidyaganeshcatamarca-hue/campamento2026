import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const HISTORIAL_FILE = path.join(process.cwd(), 'data', 'mensajes-historial.json');

interface MensajeHistorial {
    id: string;
    mensaje: string;
    audiencia: string;
    destinatarios: number;
    fecha: string;
}

// Asegurar que existe el directorio y archivo
function ensureFile() {
    const dir = path.dirname(HISTORIAL_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(HISTORIAL_FILE)) {
        fs.writeFileSync(HISTORIAL_FILE, JSON.stringify([], null, 2));
    }
}

// GET - Obtener historial
export async function GET() {
    try {
        ensureFile();
        const data = fs.readFileSync(HISTORIAL_FILE, 'utf-8');
        const historial: MensajeHistorial[] = JSON.parse(data);

        // Devolver últimos 10
        const ultimos10 = historial.slice(-10).reverse();

        return NextResponse.json(ultimos10);
    } catch (error) {
        console.error('Error al leer historial:', error);
        return NextResponse.json([], { status: 500 });
    }
}

// POST - Guardar nuevo mensaje
export async function POST(request: Request) {
    try {
        ensureFile();

        const nuevoMensaje: MensajeHistorial = await request.json();

        const data = fs.readFileSync(HISTORIAL_FILE, 'utf-8');
        const historial: MensajeHistorial[] = JSON.parse(data);

        // Agregar nuevo mensaje
        historial.push(nuevoMensaje);

        // Mantener solo los últimos 50 (para no crecer indefinidamente)
        const historialLimitado = historial.slice(-50);

        // Guardar
        fs.writeFileSync(HISTORIAL_FILE, JSON.stringify(historialLimitado, null, 2));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error al guardar mensaje:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
