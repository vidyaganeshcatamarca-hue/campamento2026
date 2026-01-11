import { sendWhatsAppNotification } from './utils';

interface WhatsAppMessage {
    telefono: string;
    mensaje: string;
    tipo?: 'bienvenida' | 'pago' | 'despedida' | 'general';
}

export const enviarWhatsApp = async (data: WhatsAppMessage): Promise<boolean> => {
    return await sendWhatsAppNotification({
        telefonos: [data.telefono], // Wrap single phone in array
        mensaje: data.mensaje,
        tipo_mensaje: data.tipo || 'general',
    });
};

// Mensajes predefinidos

export const mensajeBienvenida = (nombre: string, parcelas: string[], fechaEgreso: string): string => {
    return `🏕️ ¡Bienvenido/a ${nombre} a Campamento Vrindavan!

Nos alegra recibirte. Aquí están los detalles de tu estadía:

📍 Parcela(s) asignada(s): ${parcelas.join(', ')}
📅 Fecha de egreso programada: ${new Date(fechaEgreso).toLocaleDateString('es-AR')}

Que disfrutes tu estadía con nosotros. 

Para cualquier consulta, no dudes en comunicarte con recepción.

🙏 Hare Krishna`;
};

export const mensajePago = (
    nombre: string,
    montoPagado: number,
    saldoPendiente: number,
    metodoPago: string
): string => {
    const estado = saldoPendiente === 0 ? '✅ PAGADO EN SU TOTALIDAD' : '⚠️ SALDO PENDIENTE';

    return `🧾 RECIBO DE PAGO - Campamento Vrindavan

Hola ${nombre},

Confirmamos la recepción de tu pago:

💵 Monto abonado: $${montoPagado.toFixed(2)}
💳 Método de pago: ${metodoPago}
📊 Saldo pendiente: $${saldoPendiente.toFixed(2)}

${estado}

${saldoPendiente > 0 ? '⚠️ Recuerda que puedes saldar el resto en recepción.' : '¡Gracias por tu pago!'}

🙏 Hare Krishna`;
};

export const mensajeDespedida = (nombre: string): string => {
    return `👋 ¡Hasta pronto ${nombre}!

Esperamos que hayas disfrutado tu estadía en Campamento Vrindavan.

Nos encantaría conocer tu opinión sobre tu experiencia. Por favor, dedica un momento a completar nuestra breve encuesta de satisfacción:

📝 https://forms.gle/LaLRvwRWdXagdpFN9

Tu feedback nos ayuda a mejorar para futuras visitas.

🏕️ ¡Te esperamos pronto de regreso!

🙏 Hare Krishna`;
};

export const enviarBienvenida = async (
    telefono: string,
    nombre: string,
    parcelas: string[],
    fechaEgreso: string
): Promise<boolean> => {
    return await enviarWhatsApp({
        telefono,
        mensaje: mensajeBienvenida(nombre, parcelas, fechaEgreso),
        tipo: 'bienvenida',
    });
};

export const enviarReciboPago = async (
    telefono: string,
    nombre: string,
    montoPagado: number,
    saldoPendiente: number,
    metodoPago: string
): Promise<boolean> => {
    return await enviarWhatsApp({
        telefono,
        mensaje: mensajePago(nombre, montoPagado, saldoPendiente, metodoPago),
        tipo: 'pago',
    });
};

export const enviarDespedida = async (
    telefono: string,
    nombre: string
): Promise<boolean> => {
    return await enviarWhatsApp({
        telefono,
        mensaje: mensajeDespedida(nombre),
        tipo: 'despedida',
    });
};
