import { and, eq, gte, lte } from 'drizzle-orm';
import {
	addDays,
	isActiveOn,
	PERIODS,
	preferenceHorizon,
	weekCodeOf,
	type Period,
	type PreferenceSlot,
	type PreferenceSlotConfig,
	type PresenceSpan,
	type ShiftIcon
} from '#lib/planning.ts';
import { db } from '#lib/server/db/index.ts';
import { planningEntries } from '#lib/server/db/schema.ts';

type ActivePerson = {
	activeFrom: string;
	activeUntil: string | null;
	periods: PresenceSpan[];
	service: string | null;
};

export async function applyWeekPreference(
	userId: string,
	effectiveFrom: string,
	slots: PreferenceSlotConfig[],
	person: ActivePerson
) {
	const wanted = new Map(slots.map((item) => [item.slot, item]));
	const end = preferenceHorizon(effectiveFrom);
	const toInsert: {
		id: string;
		userId: string;
		date: string;
		period: Period;
		icon: ShiftIcon | null;
		note: string | null;
		service: string | null;
	}[] = [];

	for (let date = effectiveFrom; date <= end; date = addDays(date, 1)) {
		const code = weekCodeOf(date);
		const active = isActiveOn(person, date);
		for (const period of PERIODS) {
			const slot = `${code}-${period}` as PreferenceSlot;
			const config = wanted.get(slot);
			if (active && config) {
				toInsert.push({
					id: crypto.randomUUID(),
					userId,
					date,
					period,
					icon: config.icon,
					note: config.note,
					service: person.service
				});
			}
		}
	}

	await db
		.delete(planningEntries)
		.where(
			and(
				eq(planningEntries.userId, userId),
				gte(planningEntries.date, effectiveFrom),
				lte(planningEntries.date, end)
			)
		);

	const chunk = 200;
	for (let index = 0; index < toInsert.length; index += chunk) {
		await db.insert(planningEntries).values(toInsert.slice(index, index + chunk));
	}
}
