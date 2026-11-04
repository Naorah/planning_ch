import { and, asc, desc, gte, inArray, lte } from 'drizzle-orm';
import {
	daysOfMonth,
	isPeriod,
	isShiftIcon,
	monthLabel,
	normalizeService,
	overlapsMonth,
	parsePreferenceSlots,
	parseRoles,
	shiftMonth,
	type PlanningPerson,
	type PresenceSpan,
	type WeekPreference
} from '#lib/planning.ts';
import { db } from './db/index.ts';
import { planningEntries, preferences, presencePeriods, users } from './db/schema.ts';

export async function loadPlanning(month: string) {
	const days = daysOfMonth(month);
	const start = days[0].date;
	const end = days[days.length - 1].date;

	const roster = await db
		.select({
			id: users.id,
			login: users.login,
			displayName: users.displayName,
			roles: users.roles,
			service: users.service,
			email: users.email,
			blocked: users.blocked,
			activeFrom: users.activeFrom,
			activeUntil: users.activeUntil
		})
		.from(users)
		.orderBy(asc(users.displayName));

	const services = [
		...new Set(
			roster
				.map((person) => normalizeService(person.service ?? ''))
				.filter((value): value is string => !!value)
		)
	].sort((a, b) => a.localeCompare(b, 'fr'));

	const spans =
		roster.length === 0
			? []
			: await db
					.select({
						userId: presencePeriods.userId,
						startsOn: presencePeriods.startsOn,
						endsOn: presencePeriods.endsOn
					})
					.from(presencePeriods)
					.where(
						inArray(
							presencePeriods.userId,
							roster.map((person) => person.id)
						)
					);
	const periodsByUser = new Map<string, PresenceSpan[]>();
	for (const span of spans) {
		const list = periodsByUser.get(span.userId) ?? [];
		list.push({ startsOn: span.startsOn, endsOn: span.endsOn });
		periodsByUser.set(span.userId, list);
	}
	for (const list of periodsByUser.values()) {
		list.sort((a, b) => a.startsOn.localeCompare(b.startsOn));
	}

	const present = roster.filter((person) =>
		overlapsMonth(
			{ ...person, periods: periodsByUser.get(person.id) ?? [] },
			start,
			end
		)
	);

	const assigned = await db
		.select({
			userId: planningEntries.userId,
			date: planningEntries.date,
			period: planningEntries.period,
			icon: planningEntries.icon,
			note: planningEntries.note,
			service: planningEntries.service
		})
		.from(planningEntries)
		.where(and(gte(planningEntries.date, start), lte(planningEntries.date, end)));

	const byUser = new Map<string, PlanningPerson['shifts']>();
	for (const entry of assigned) {
		if (!isPeriod(entry.period)) continue;
		const list = byUser.get(entry.userId) ?? [];
		list.push({
			date: entry.date,
			period: entry.period,
			icon: entry.icon && isShiftIcon(entry.icon) ? entry.icon : null,
			note: entry.note?.trim() ? entry.note.trim() : null,
			service: normalizeService(entry.service ?? '')
		});
		byUser.set(entry.userId, list);
	}

	const saved =
		present.length === 0
			? []
			: await db
					.select({
						id: preferences.id,
						userId: preferences.userId,
						effectiveFrom: preferences.effectiveFrom,
						slots: preferences.slots,
						createdAt: preferences.createdAt
					})
					.from(preferences)
					.where(
						inArray(
							preferences.userId,
							present.map((person) => person.id)
						)
					)
					.orderBy(desc(preferences.effectiveFrom), desc(preferences.createdAt));
	const historyByUser = new Map<string, WeekPreference[]>();
	for (const row of saved) {
		const list = historyByUser.get(row.userId) ?? [];
		list.push({
			id: row.id,
			effectiveFrom: row.effectiveFrom,
			slots: parsePreferenceSlots(row.slots),
			createdAt: row.createdAt
		});
		historyByUser.set(row.userId, list);
	}

	const people: PlanningPerson[] = present.map((person) => {
		const preferenceHistory = historyByUser.get(person.id) ?? [];
		return {
			id: person.id,
			login: person.login,
			displayName: person.displayName,
			roles: parseRoles(person.roles),
			service: normalizeService(person.service ?? ''),
			blocked: !!person.blocked,
			email: person.email ?? null,
			activeFrom: person.activeFrom,
			activeUntil: person.activeUntil,
			periods: periodsByUser.get(person.id) ?? [],
			shifts: byUser.get(person.id) ?? [],
			preference: preferenceHistory[0] ?? null,
			preferenceHistory
		};
	});

	return {
		month,
		label: monthLabel(month),
		prev: shiftMonth(month, -1),
		next: shiftMonth(month, 1),
		days,
		people,
		services
	};
}
