import { redirect } from '@sveltejs/kit';
import { deleteSession } from '#lib/server/auth.ts';
import { clearSessionCookie } from '#lib/server/session-cookie.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	redirect(303, '/login');
};

export const actions: Actions = {
	default: async ({ cookies, url }) => {
		const sessionId = cookies.get('session');
		if (sessionId) await deleteSession(sessionId);
		clearSessionCookie(cookies, url);
		redirect(303, '/login');
	}
};
