import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Formatea un número como moneda argentina
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(amount);
}

/**
 * Obtiene la fecha/hora actual al mediodía en zona horaria Argentina
 * Esto asegura consistencia en todos los registros de fecha
 */
export function getNoonTimestamp(dateInput?: Date): string {
    const now = dateInput || new Date();
    const argentinaTime = toZonedTime(now, 'America/Argentina/Buenos_Aires');

    // Establecer a las 12:00:00
    argentinaTime.setHours(12, 0, 0, 0);

    return argentinaTime.toISOString();
}

/**
 * Reemplaza marcadores {{variable}} en un string con valores de un objeto
 */
export const replaceTemplate = (template: string, variables: Record<string, string>) => {
    let message = template;
    Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return message;
};

/**
 * Envía una notificación de WhatsApp a través del webhook de n8n
 */
export async function sendWhatsAppNotification(params: {
    telefonos: string[];
    mensaje: string;
    tipo_mensaje: string;
    delay?: boolean;
    tiempo?: number;
}): Promise<boolean> {
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    // Limpieza de números (remover todo lo que no sea dígito, EXCEPTO si es el grupo)
    const telefonosLimpios = params.telefonos
        .map(t => {
            // Si es el grupo específico, dejarlo tal cual
            if (t.toLowerCase() === 'grupo campamento 2026') return t;
            // Si no, limpiar
            return t.replace(/\D/g, '');
        })
        .filter(t => t.length > 0);

    if (!webhookUrl) {
        console.error('ERROR: Webhook n8n no configurado. Faltan variables de entorno.');
        return false;
    }

    if (telefonosLimpios.length === 0) {
        console.warn('⚠️ No hay destinatarios válidos (lista vacía).');
        return false;
    }



    try {
        const payload = {
            telefonos: telefonosLimpios,
            mensaje: params.mensaje,
            tipo: params.tipo_mensaje, // "general", "bienvenida", "pago", etc.
            timestamp: new Date().toISOString(),
            delay: params.delay || false,
            tiempo: params.tiempo || 0
        };

        // Re-executing fetch with correct payload object construction logic
        const finalResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!finalResponse.ok) {
            const errorText = await finalResponse.text();
            console.error(`❌ Webhook Error [${finalResponse.status}]: ${errorText}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error enviando notificación WhatsApp:', error);
        return false;
    }
}

/**
 * Utilidad para combinar clases CSS (similar a clsx)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ');
}
