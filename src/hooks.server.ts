import { dev } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { getUserBySession } from '#lib/server/auth.ts';
import { clearSessionCookie } from '#lib/server/session-cookie.ts';

// CSP : via kit.csp dans vite.config.ts (nonces/hashes pour les scripts inline).
const securityHeaders: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'no-referrer',
	'X-Frame-Options': 'DENY',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'Cross-Origin-Opener-Policy': 'same-origin'
};

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');
	event.locals.user = sessionId ? await getUserBySession(sessionId) : null;
	if (sessionId && !event.locals.user) {
		clearSessionCookie(event.cookies, event.url);
	}

	const response = await resolve(event);
	if (event.route.id) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	if (!dev) {
		for (const [name, value] of Object.entries(securityHeaders)) {
			response.headers.set(name, value);
		}
	}
	return response;
};
