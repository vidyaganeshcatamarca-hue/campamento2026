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
export function getNoonTimestamp(): string {
    const now = new Date();
    const argentinaTime = toZonedTime(now, 'America/Argentina/Buenos_Aires');

    // Establecer a las 12:00:00
    argentinaTime.setHours(12, 0, 0, 0);

    return argentinaTime.toISOString();
}

/**
 * Envía una notificación de WhatsApp a través del webhook de n8n
 */
export async function sendWhatsAppNotification(params: {
    telefonos: string[];
    mensaje: string;
    tipo_mensaje: string;
}): Promise<boolean> {
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl.includes('your-n8n-webhook-url-here')) {
        console.warn('Webhook n8n no configurado. Saltando notificación.');
        return false;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telefonos: params.telefonos,
                mensaje: params.mensaje,
                origen_id: 'whatsapp_recepcion_vrindavan',
                tipo_mensaje: params.tipo_mensaje,
            }),
        });

        return response.ok;
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
