import { fail, redirect } from '@sveltejs/kit';
import { authenticate, createSession } from '#lib/server/auth.ts';
import {
	clearLoginFailures,
	clientAddress,
	loginBlocked,
	recordLoginFailure
} from '#lib/server/login-throttle.ts';
import { setSessionCookie } from '#lib/server/session-cookie.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/planning');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const address = clientAddress(getClientAddress);
		if (loginBlocked(address)) {
			return fail(429, { error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
		}

		const form = await request.formData();
		const login = String(form.get('login') ?? '');
		const password = String(form.get('password') ?? '');
		const user = await authenticate(login, password);

		if (!user) {
			recordLoginFailure(address);
			return fail(401, { error: 'Identifiant ou mot de passe incorrect.' });
		}

		clearLoginFailures(address);
		const session = await createSession(user.id);
		setSessionCookie(cookies, url, session.id, session.maxAge);
		redirect(303, '/planning');
	}
};
