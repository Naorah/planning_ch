import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	RESEND_API_KEY: {
		description: 'Resend API key for access emails.',
		schema: (value) => value ?? ''
	},
	RESEND_FROM: {
		description: 'Verified Resend sender address.',
		schema: (value) => value ?? ''
	}
});
