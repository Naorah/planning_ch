import type { Cookies } from '@sveltejs/kit';

const NAME = 'session';

function options(url: URL) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:'
	};
}

export function setSessionCookie(cookies: Cookies, url: URL, id: string, maxAge: number) {
	cookies.set(NAME, id, { ...options(url), maxAge });
}

export function clearSessionCookie(cookies: Cookies, url: URL) {
	cookies.delete(NAME, options(url));
}
