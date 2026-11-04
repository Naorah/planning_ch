export type Period = 'matin' | 'apres_midi';

export const PERIODS = ['matin', 'apres_midi'] as const;

export const PERIOD_LABELS: Record<Period, string> = {
	matin: 'Matin',
	apres_midi: 'Après-midi'
};

export type RoleCode = 'interne' | 'medecin' | 'medecin_certif';

export const ROLE_OPTIONS: { code: RoleCode; label: string }[] = [
	{ code: 'interne', label: 'Interne' },
	{ code: 'medecin', label: 'Médecin' },
	{ code: 'medecin_certif', label: 'Médecin certif' }
];

export type PlanningDay = {
	date: string;
	day: number;
	weekday: string;
	isToday: boolean;
};

export type ShiftIcon =
	| 'check'
	| 'hospital'
	| 'stethoscope'
	| 'ambulance'
	| 'phone'
	| 'star'
	| 'map-pin'
	| 'clipboard';

export const SHIFT_ICONS: { code: ShiftIcon; label: string }[] = [
	{ code: 'check', label: 'Présent' },
	{ code: 'hospital', label: 'Hôpital' },
	{ code: 'stethoscope', label: 'Consultation' },
	{ code: 'ambulance', label: 'Urgence' },
	{ code: 'phone', label: 'Astreinte' },
	{ code: 'star', label: 'Priorité' },
	{ code: 'map-pin', label: 'Site' },
	{ code: 'clipboard', label: 'Note' }
];

export type PlanningShift = {
	date: string;
	period: Period;
	icon: ShiftIcon | null;
	note: string | null;
};

export const WEEK_PATTERN = [
	{ code: 'lu', label: 'Lundi' },
	{ code: 'ma', label: 'Mardi' },
	{ code: 'me', label: 'Mercredi' },
	{ code: 'je', label: 'Jeudi' },
	{ code: 've', label: 'Vendredi' },
	{ code: 'sa', label: 'Samedi' },
	{ code: 'di', label: 'Dimanche' }
] as const;

export type WeekCode = (typeof WEEK_PATTERN)[number]['code'];
export type PreferenceSlot = `${WeekCode}-${Period}`;

export type PreferenceSlotConfig = {
	slot: PreferenceSlot;
	icon: ShiftIcon | null;
	note: string | null;
};

export type WeekPreference = {
	id: string;
	effectiveFrom: string;
	slots: PreferenceSlotConfig[];
	createdAt: string;
};

export type PresenceSpan = {
	startsOn: string;
	endsOn: string;
};

export type PlanningPerson = {
	id: string;
	login: string;
	displayName: string;
	roles: RoleCode[];
	email: string | null;
	blocked: boolean;
	activeFrom: string;
	activeUntil: string | null;
	periods: PresenceSpan[];
	shifts: PlanningShift[];
	preference: WeekPreference | null;
	preferenceHistory: WeekPreference[];
};

const WEEKDAYS = ['DI', 'LU', 'MA', 'ME', 'JE', 'VE', 'SA'] as const;

export function isoDate(date: Date) {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

export function currentMonth(now = new Date()) {
	const month = String(now.getMonth() + 1).padStart(2, '0');
	return `${now.getFullYear()}-${month}`;
}

export function shiftMonth(month: string, delta: number) {
	const [year, monthNumber] = month.split('-').map(Number);
	const date = new Date(year, monthNumber - 1 + delta, 1);
	return currentMonth(date);
}

export function isMonth(value: string) {
	return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isActiveOn(
	person: { activeFrom: string; activeUntil: string | null; periods?: PresenceSpan[] },
	date: string
) {
	if (person.periods && person.periods.length > 0) {
		return person.periods.some((span) => date >= span.startsOn && date <= span.endsOn);
	}
	if (date < person.activeFrom) return false;
	if (person.activeUntil && date > person.activeUntil) return false;
	return true;
}

export function overlapsMonth(
	person: { activeFrom: string; activeUntil: string | null; periods?: PresenceSpan[] },
	start: string,
	end: string
) {
	if (person.periods && person.periods.length > 0) {
		return person.periods.some((span) => span.startsOn <= end && span.endsOn >= start);
	}
	if (person.activeFrom > end) return false;
	if (person.activeUntil && person.activeUntil < start) return false;
	return true;
}

export function formatWeekday(iso: string) {
	const [year, month, day] = iso.split('-').map(Number);
	return new Date(year, month - 1, day).toLocaleDateString('fr-CH', { weekday: 'long' });
}

export function formatLong(iso: string) {
	const [year, month, day] = iso.split('-').map(Number);
	return new Date(year, month - 1, day).toLocaleDateString('fr-CH', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

export function monthLabel(month: string) {
	const [year, monthNumber] = month.split('-').map(Number);
	return new Date(year, monthNumber - 1, 1).toLocaleDateString('fr-CH', {
		month: 'long',
		year: 'numeric'
	});
}

export function daysOfMonth(month: string, today = isoDate(new Date())): PlanningDay[] {
	const [year, monthNumber] = month.split('-').map(Number);
	const count = new Date(year, monthNumber, 0).getDate();
	return Array.from({ length: count }, (_, index) => {
		const day = index + 1;
		const date = new Date(year, monthNumber - 1, day);
		return {
			date: isoDate(date),
			day,
			weekday: WEEKDAYS[date.getDay()],
			isToday: isoDate(date) === today
		};
	});
}

export function isPeriod(value: string): value is Period {
	return value === 'matin' || value === 'apres_midi';
}

export function isRoleCode(value: string): value is RoleCode {
	return ROLE_OPTIONS.some((role) => role.code === value);
}

export function normalizeRoles(values: string[]): RoleCode[] {
	const chosen = new Set(values.filter(isRoleCode));
	return ROLE_OPTIONS.map((role) => role.code).filter((code) => chosen.has(code));
}

export function parseRoles(value: string): RoleCode[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];
		return normalizeRoles(parsed.filter((item): item is string => typeof item === 'string'));
	} catch {
		return [];
	}
}

export function formatRoles(roles: RoleCode[]) {
	if (roles.length === 0) return 'Sans rôle';
	return roles
		.map((code) => ROLE_OPTIONS.find((role) => role.code === code)?.label ?? code)
		.join(' · ');
}

export function hasRole(roles: RoleCode[], code: RoleCode) {
	return roles.includes(code);
}

export function isPreferenceSlot(value: string): value is PreferenceSlot {
	const normalized = migrateSlotToken(value);
	const dash = normalized.indexOf('-');
	if (dash <= 0) return false;
	const code = normalized.slice(0, dash);
	const period = normalized.slice(dash + 1);
	return WEEK_PATTERN.some((day) => day.code === code) && isPeriod(period);
}

function migrateSlotToken(value: string) {
	return value.replace(/-jour$/, '-matin').replace(/-nuit$/, '-apres_midi');
}

export function isShiftIcon(value: string): value is ShiftIcon {
	return SHIFT_ICONS.some((item) => item.code === value);
}

export function normalizeNote(value: string) {
	const note = value.trim().replace(/\s+/g, ' ');
	if (!note) return null;
	return note.slice(0, 200);
}

export function normalizeSlots(values: string[]) {
	const chosen = new Set(
		values.map(migrateSlotToken).filter((item): item is PreferenceSlot => isPreferenceSlot(item))
	);
	const slots: PreferenceSlot[] = [];
	for (const day of WEEK_PATTERN) {
		for (const period of PERIODS) {
			const slot: PreferenceSlot = `${day.code}-${period}`;
			if (chosen.has(slot)) slots.push(slot);
		}
	}
	return slots;
}

function parseSlotConfigItem(item: unknown): PreferenceSlotConfig | null {
	if (typeof item === 'string') {
		const slot = migrateSlotToken(item);
		if (!isPreferenceSlot(slot)) return null;
		return { slot, icon: null, note: null };
	}
	if (!item || typeof item !== 'object') return null;
	const row = item as { slot?: unknown; icon?: unknown; note?: unknown };
	if (typeof row.slot !== 'string') return null;
	const slot = migrateSlotToken(row.slot);
	if (!isPreferenceSlot(slot)) return null;
	const icon =
		typeof row.icon === 'string' && isShiftIcon(row.icon) ? row.icon : null;
	const note = typeof row.note === 'string' ? normalizeNote(row.note) : null;
	return { slot, icon, note };
}

export function normalizeSlotConfigs(
	values: unknown[],
	meta: Partial<Record<PreferenceSlot, { icon?: string; note?: string }>> = {}
): PreferenceSlotConfig[] {
	const bySlot = new Map<PreferenceSlot, PreferenceSlotConfig>();
	for (const item of values) {
		const parsed = parseSlotConfigItem(item);
		if (!parsed) continue;
		bySlot.set(parsed.slot, parsed);
	}
	for (const [slot, extra] of Object.entries(meta) as [
		PreferenceSlot,
		{ icon?: string; note?: string }
	][]) {
		const current = bySlot.get(slot);
		if (!current) continue;
		bySlot.set(slot, {
			slot,
			icon: extra.icon && isShiftIcon(extra.icon) ? extra.icon : current.icon,
			note: extra.note !== undefined ? normalizeNote(extra.note) : current.note
		});
	}
	const configs: PreferenceSlotConfig[] = [];
	for (const day of WEEK_PATTERN) {
		for (const period of PERIODS) {
			const slot: PreferenceSlot = `${day.code}-${period}`;
			const config = bySlot.get(slot);
			if (config) configs.push(config);
		}
	}
	return configs;
}

export function parsePreferenceSlots(value: string): PreferenceSlotConfig[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];
		return normalizeSlotConfigs(parsed);
	} catch {
		return [];
	}
}

export function slotCodes(configs: PreferenceSlotConfig[]): PreferenceSlot[] {
	return configs.map((item) => item.slot);
}

export function nextMonday(now = new Date()) {
	const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const day = date.getDay();
	const delta = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
	date.setDate(date.getDate() + delta);
	return isoDate(date);
}

export function nextMonthStart(now = new Date()) {
	return isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
}

export function isIsoDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function addDays(iso: string, count: number) {
	const [year, month, day] = iso.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	date.setDate(date.getDate() + count);
	return isoDate(date);
}

export function mondayOf(iso: string) {
	const [year, month, day] = iso.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	const weekday = date.getDay();
	const delta = weekday === 0 ? -6 : 1 - weekday;
	date.setDate(date.getDate() + delta);
	return isoDate(date);
}

export function weekdayOf(iso: string) {
	const [year, month, day] = iso.split('-').map(Number);
	return WEEKDAYS[new Date(year, month - 1, day).getDay()];
}

export function weekCodeOf(iso: string): WeekCode {
	const [year, month, day] = iso.split('-').map(Number);
	const weekday = new Date(year, month - 1, day).getDay();
	return WEEK_PATTERN[(weekday + 6) % 7].code;
}

export function preferenceHorizon(from: string) {
	return daysOfMonth(shiftMonth(from.slice(0, 7), 18)).at(-1)?.date ?? from;
}

export function formatPreferenceSlots(slots: PreferenceSlotConfig[]) {
	if (slots.length === 0) return 'Aucune garde';
	return slots
		.map((config) => {
			const dash = config.slot.indexOf('-');
			const code = config.slot.slice(0, dash) as WeekCode;
			const period = config.slot.slice(dash + 1) as Period;
			const day = WEEK_PATTERN.find((item) => item.code === code)?.label ?? code;
			const bits = [`${day} ${PERIOD_LABELS[period]}`];
			if (config.icon) {
				bits.push(SHIFT_ICONS.find((item) => item.code === config.icon)?.label ?? config.icon);
			}
			if (config.note) bits.push(config.note);
			return bits.join(' — ');
		})
		.join(' · ');
}

/** Créneaux tenus par un médecin certif sur la journée (matin + après-midi). */
export function certifSlotCount(
	people: { roles: RoleCode[]; shifts: PlanningShift[] }[],
	date: string
) {
	let total = 0;
	for (const person of people) {
		if (!hasRole(person.roles, 'medecin_certif')) continue;
		for (const period of PERIODS) {
			if (person.shifts.some((shift) => shift.date === date && shift.period === period)) {
				total += 1;
			}
		}
	}
	return total;
}
