import { and, eq, ne } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import {
	currentMonth,
	isActiveOn,
	isIsoDate,
	isMonth,
	isPeriod,
	isPreferenceSlot,
	isShiftIcon,
	normalizeNote,
	normalizeRoles,
	normalizeSlotConfigs,
	type PreferenceSlot
} from '#lib/planning.ts';
import { createCollaborator, createPasswordReset } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { planningEntries, preferences, presencePeriods, sessions, users } from '#lib/server/db/schema.ts';
import { sendAccessMail } from '#lib/server/mail.ts';
import { applyWeekPreference } from '#lib/server/preferences.ts';
import { loadPlanning } from '#lib/server/planning.ts';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	const user = locals.user;
	if (!user) redirect(303, '/login');
	if (!user.admin) return { denied: fail(403, { error: 'Action réservée aux administrateurs.' }) };
	return { user };
}

function normalizeEmail(value: string) {
	return value.trim().toLowerCase();
}

function isEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	if (!locals.user) redirect(303, '/login');
	depends('planning:data');

	const requested = url.searchParams.get('mois') ?? '';
	const month = isMonth(requested) ? requested : currentMonth();
	const requestedDay = url.searchParams.get('jour') ?? '';
	const focusDate =
		isIsoDate(requestedDay) && requestedDay.startsWith(`${month}-`) ? requestedDay : '';
	const planning = await loadPlanning(month);

	return {
		...planning,
		focusDate,
		viewerId: locals.user.id,
		admin: locals.user.admin
	};
};

export const actions: Actions = {
	toggle: async ({ locals, request }) => {
		const access = requireAdmin(locals);
		if ('denied' in access) return access.denied;

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const date = String(form.get('date') ?? '');
		const period = String(form.get('period') ?? '');
		if (!userId || !isIsoDate(date) || !isPeriod(period)) {
			return fail(400, { error: 'Créneau invalide.' });
		}

		const [person] = await db
			.select({
				id: users.id,
				activeFrom: users.activeFrom,
				activeUntil: users.activeUntil
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!person) return fail(400, { error: 'Personne introuvable.' });

		const spans = await db
			.select({ startsOn: presencePeriods.startsOn, endsOn: presencePeriods.endsOn })
			.from(presencePeriods)
			.where(eq(presencePeriods.userId, userId));

		const [existing] = await db
			.select({ id: planningEntries.id })
			.from(planningEntries)
			.where(
				and(
					eq(planningEntries.userId, userId),
					eq(planningEntries.date, date),
					eq(planningEntries.period, period)
				)
			)
			.limit(1);

		if (existing) {
			await db.delete(planningEntries).where(eq(planningEntries.id, existing.id));
			return { error: '' };
		}

		if (!isActiveOn({ ...person, periods: spans }, date)) {
			return fail(400, { error: 'Hors équipe à cette date.' });
		}

		await db.insert(planningEntries).values({
			id: crypto.randomUUID(),
			userId,
			date,
			period,
			icon: null,
			note: null
		});
		return { error: '' };
	},
	cell: async ({ locals, request }) => {
		const access = requireAdmin(locals);
		if ('denied' in access) return access.denied;

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const date = String(form.get('date') ?? '');
		const period = String(form.get('period') ?? '');
		const assigned = form.get('assigned') === 'on';
		const iconRaw = String(form.get('icon') ?? '');
		const icon = iconRaw && isShiftIcon(iconRaw) ? iconRaw : null;
		const note = normalizeNote(String(form.get('note') ?? ''));
		if (!userId || !isIsoDate(date) || !isPeriod(period)) {
			return fail(400, { error: 'Créneau invalide.' });
		}

		const [person] = await db
			.select({
				id: users.id,
				activeFrom: users.activeFrom,
				activeUntil: users.activeUntil
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!person) return fail(400, { error: 'Personne introuvable.' });

		const spans = await db
			.select({ startsOn: presencePeriods.startsOn, endsOn: presencePeriods.endsOn })
			.from(presencePeriods)
			.where(eq(presencePeriods.userId, userId));

		const [existing] = await db
			.select({ id: planningEntries.id })
			.from(planningEntries)
			.where(
				and(
					eq(planningEntries.userId, userId),
					eq(planningEntries.date, date),
					eq(planningEntries.period, period)
				)
			)
			.limit(1);

		if (!assigned) {
			if (existing) await db.delete(planningEntries).where(eq(planningEntries.id, existing.id));
			return { error: '' };
		}

		if (!isActiveOn({ ...person, periods: spans }, date)) {
			return fail(400, { error: 'Hors équipe à cette date.' });
		}

		if (existing) {
			await db
				.update(planningEntries)
				.set({ icon, note })
				.where(eq(planningEntries.id, existing.id));
		} else {
			await db.insert(planningEntries).values({
				id: crypto.randomUUID(),
				userId,
				date,
				period,
				icon,
				note
			});
		}
		return { error: '' };
	},
	add: async ({ locals, request }) => {
		const access = requireAdmin(locals);
		if ('denied' in access) return access.denied;

		const form = await request.formData();
		const month = String(form.get('month') ?? '');
		if (!isMonth(month)) return fail(400, { error: 'Mois invalide.' });

		const result = await createCollaborator(String(form.get('name') ?? ''), `${month}-01`);
		if (result.error) return fail(400, { error: result.error });
		return { error: '' };
	},
	preferences: async ({ locals, request }) => {
		const access = requireAdmin(locals);
		if ('denied' in access) return access.denied;

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const displayName = String(form.get('displayName') ?? '')
			.trim()
			.replace(/\s+/g, ' ');
		const roles = normalizeRoles(form.getAll('roles').map(String));
		const emailRaw = String(form.get('email') ?? '');
		const email = emailRaw.trim() ? normalizeEmail(emailRaw) : null;
		const blocked = form.get('blocked') === 'on';
		const effectiveFrom = String(form.get('effectiveFrom') ?? '');
		const slotCodes = form.getAll('slots').map(String);
		const meta: Partial<Record<PreferenceSlot, { icon?: string; note?: string }>> = {};
		for (const code of slotCodes) {
			if (!isPreferenceSlot(code)) continue;
			meta[code] = {
				icon: String(form.get(`icon-${code}`) ?? ''),
				note: String(form.get(`note-${code}`) ?? '')
			};
		}
		const slots = normalizeSlotConfigs(slotCodes, meta);
		if (!userId || !displayName || displayName.length > 80) {
			return fail(400, { error: 'Indiquez un nom.' });
		}
		if (roles.length === 0) {
			return fail(400, { error: 'Cochez au moins un rôle.' });
		}
		if (email && !isEmail(email)) {
			return fail(400, { error: 'Adresse email invalide.' });
		}
		if (!isIsoDate(effectiveFrom)) return fail(400, { error: 'Préférence invalide.' });
		if (blocked && userId === access.user.id) {
			return fail(400, { error: 'Vous ne pouvez pas bloquer votre propre compte.' });
		}

		const [person] = await db
			.select({
				id: users.id,
				activeFrom: users.activeFrom,
				activeUntil: users.activeUntil
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!person) return fail(400, { error: 'Personne introuvable.' });

		if (email) {
			const [taken] = await db
				.select({ id: users.id })
				.from(users)
				.where(and(eq(users.email, email), ne(users.id, userId)))
				.limit(1);
			if (taken) return fail(400, { error: 'Cette adresse email est déjà utilisée.' });
		}

		const starts = form.getAll('startsOn').map(String);
		const ends = form.getAll('endsOn').map(String);
		const periods: { startsOn: string; endsOn: string }[] = [];
		for (let index = 0; index < Math.max(starts.length, ends.length); index += 1) {
			const startsOn = (starts[index] ?? '').trim();
			const endsOn = (ends[index] ?? '').trim();
			if (!startsOn && !endsOn) continue;
			if (!isIsoDate(startsOn) || !isIsoDate(endsOn) || startsOn > endsOn) {
				return fail(400, { error: 'Indiquez un début et une fin, la fin après le début.' });
			}
			periods.push({ startsOn, endsOn });
		}

		await db
			.update(users)
			.set({ displayName, roles: JSON.stringify(roles), email, blocked })
			.where(eq(users.id, userId));
		if (blocked) {
			await db.delete(sessions).where(eq(sessions.userId, userId));
		}

		await db.insert(preferences).values({
			id: crypto.randomUUID(),
			userId,
			effectiveFrom,
			slots: JSON.stringify(slots),
			createdAt: new Date().toISOString()
		});

		await db.delete(presencePeriods).where(eq(presencePeriods.userId, userId));
		if (periods.length > 0) {
			await db.insert(presencePeriods).values(
				periods.map((span) => ({
					id: crypto.randomUUID(),
					userId,
					startsOn: span.startsOn,
					endsOn: span.endsOn
				}))
			);
		}

		await applyWeekPreference(userId, effectiveFrom, slots, {
			activeFrom: person.activeFrom,
			activeUntil: person.activeUntil,
			periods
		});

		return { error: '' };
	},
	invite: async ({ locals, request, url }) => {
		const access = requireAdmin(locals);
		if ('denied' in access) return access.denied;

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const email = normalizeEmail(String(form.get('email') ?? ''));
		if (!userId) return fail(400, { error: 'Personne introuvable.' });
		if (!isEmail(email)) return fail(400, { error: 'Adresse email invalide.' });

		const [person] = await db
			.select({
				id: users.id,
				displayName: users.displayName,
				blocked: users.blocked
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!person) return fail(400, { error: 'Personne introuvable.' });
		if (person.blocked) {
			return fail(400, { error: 'Compte bloqué : débloquez-le avant d’envoyer un lien.' });
		}

		const [taken] = await db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.email, email), ne(users.id, userId)))
			.limit(1);
		if (taken) return fail(400, { error: 'Cette adresse email est déjà utilisée.' });

		await db.update(users).set({ email }).where(eq(users.id, userId));
		const token = await createPasswordReset(userId);
		const resetUrl = `${url.origin}/reinitialiser?token=${encodeURIComponent(token)}`;
		const mailed = await sendAccessMail({
			to: email,
			displayName: person.displayName,
			resetUrl
		});
		if (mailed.error) return fail(502, { error: mailed.error });
		return { error: '', inviteSent: true };
	},
	remove: async ({ locals, request }) => {
		const access = requireAdmin(locals);
		if ('denied' in access) return access.denied;

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		if (!userId) return fail(400, { error: 'Personne introuvable.' });
		if (userId === access.user.id) {
			return fail(400, { error: 'Vous ne pouvez pas supprimer votre propre compte.' });
		}

		const [person] = await db
			.select({ id: users.id, admin: users.admin })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!person) return fail(400, { error: 'Personne introuvable.' });

		if (person.admin) {
			const admins = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.admin, true));
			if (admins.length <= 1) {
				return fail(400, { error: 'Impossible de supprimer le dernier administrateur.' });
			}
		}

		await db.delete(users).where(eq(users.id, userId));
		return { error: '' };
	}
};
