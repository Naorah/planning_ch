import { fail, redirect } from '@sveltejs/kit';
import { consumePasswordReset, getPasswordReset } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	const reset = await getPasswordReset(token);
	return {
		token,
		valid: !!reset,
		displayName: reset?.displayName ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const token = String(form.get('token') ?? '');
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		if (!token) return fail(400, { error: 'Lien invalide ou expiré.' });
		if (password !== confirm) return fail(400, { error: 'Les mots de passe ne correspondent pas.' });

		const result = await consumePasswordReset(token, password);
		if (result.error) return fail(400, { error: result.error });
		redirect(303, '/login');
	}
};
