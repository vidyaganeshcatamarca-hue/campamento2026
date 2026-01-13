import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // 1. Check for session cookie
    const session = request.cookies.get('camp_session');

    // 2. Define protected paths (Everything except exceptions)
    // We want to block everything by default, unless it is a public asset or login.
    const isLoginPage = request.nextUrl.pathname === '/login';
    const isPublicAsset =
        request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/static') ||
        request.nextUrl.pathname.endsWith('.ico') ||
        request.nextUrl.pathname.endsWith('.png') ||
        request.nextUrl.pathname.endsWith('.jpg');

    const isApi = request.nextUrl.pathname.startsWith('/api'); // Optional: Allow API for now or block it? Let's allow for n8n webhooks if any.

    // 3. RBAC & Redirect Logic
    if (!session && !isLoginPage && !isPublicAsset && !isApi) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (session) {
        if (isLoginPage) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        // Parse Role
        let role = 'invitado';
        try {
            const parsed = JSON.parse(session.value);
            role = parsed.role || 'invitado';
        } catch (e) {
            console.error('Error parsing cookie inside middleware', e);
        }

        const path = request.nextUrl.pathname;

        // RULES
        if (role === 'auditor') {
            // Auditor has full read access to all routes.
            // Explicitly allow, no redirects needed unless we want to block API writes (which are POSTs).
            // For now, simple routing allow.
            return NextResponse.next();
        }

        if (role === 'kiosco') {
            // Kiosco ONLY access /kiosco and /kiosco-auditoria
            if (!path.startsWith('/kiosco')) {
                return NextResponse.redirect(new URL('/kiosco', request.url));
            }
        }

        if (role === 'medico') {
            // Medico ONLY access /dashboard, /visitantes
            // (Allows root dashboard /visitantes/*)
            if (!path.startsWith('/dashboard') && !path.startsWith('/visitantes')) {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
        }

        if (role === 'servicio') {
            // Servicio ONLY access /ocupacion, /dashboard use
            if (!path.startsWith('/ocupacion') && !path.startsWith('/dashboard')) {
                return NextResponse.redirect(new URL('/ocupacion', request.url));
            }
        }

        if (role === 'seguridad') {
            if (!path.startsWith('/ocupacion') && !path.startsWith('/visitantes')) {
                return NextResponse.redirect(new URL('/ocupacion', request.url));
            }
        }

        if (role === 'acomodacion') {
            if (!path.startsWith('/ocupacion') && !path.startsWith('/checkin')) {
                return NextResponse.redirect(new URL('/ocupacion', request.url));
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
