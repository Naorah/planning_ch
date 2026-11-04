<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import calendarCheck from '@iconify-icons/lucide/calendar-check';
	import calendarDays from '@iconify-icons/lucide/calendar-days';
	import chevronLeft from '@iconify-icons/lucide/chevron-left';
	import chevronRight from '@iconify-icons/lucide/chevron-right';
	import check from '@iconify-icons/lucide/check';
	import layoutGrid from '@iconify-icons/lucide/layout-grid';
	import plus from '@iconify-icons/lucide/plus';
	import rotateCcw from '@iconify-icons/lucide/rotate-ccw';
	import sunset from '@iconify-icons/lucide/sunset';
	import sunrise from '@iconify-icons/lucide/sunrise';
	import userRound from '@iconify-icons/lucide/user-round';
	import { untrack } from 'svelte';
	import PreferencesForm from '#lib/components/PreferencesForm.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Tooltip from '#lib/components/Tooltip.svelte';
	import {
		addDays,
		certifDoctorCount,
		formatLong,
		formatRoles,
		formatShiftTooltip,
		formatWeekday,
		hasRole,
		isActiveOn,
		isoDate,
		mondayOf,
		PERIOD_LABELS,
		PERIODS,
		ROLE_OPTIONS,
		SHIFT_ICONS,
		weekdayOf,
		type Period,
		type PlanningDay,
		type PlanningPerson,
		type RoleCode,
		type ShiftIcon
	} from '#lib/planning.ts';
	import { SHIFT_ICON_MAP } from '#lib/shift-icons.ts';

	type Props = {
		month: string;
		label: string;
		prev: string;
		next: string;
		days: PlanningDay[];
		people: PlanningPerson[];
		services: string[];
		viewerId: string;
		focusDate: string;
		admin: boolean;
		notice: string;
	};

	type View = 'jour' | 'personne' | 'mois';

	let {
		month,
		label,
		prev,
		next,
		days,
		people: serverPeople,
		services: serverServices,
		viewerId,
		focusDate,
		admin,
		notice
	}: Props = $props();

	function clonePeople(list: PlanningPerson[]): PlanningPerson[] {
		return list.map((person) => ({
			...person,
			roles: [...person.roles],
			shifts: person.shifts.map((shift) => ({ ...shift })),
			periods: person.periods.map((span) => ({ ...span })),
			preference: person.preference
				? {
						...person.preference,
						slots: person.preference.slots.map((slot) => ({ ...slot }))
					}
				: null,
			preferenceHistory: person.preferenceHistory.map((version) => ({
				...version,
				slots: version.slots.map((slot) => ({ ...slot }))
			}))
		}));
	}

	const initialDate = untrack(() => {
		if (focusDate && days.some((day) => day.date === focusDate)) return focusDate;
		return days.find((day) => day.isToday)?.date ?? days[0]?.date ?? '';
	});

	let people = $state(untrack(() => clonePeople(serverPeople)));
	let services = $state(untrack(() => [...serverServices]));
	let query = $state('');
	let role = $state('tous');
	let period = $state<'tous' | Period>('tous');
	let coverage = $state<'tous' | 'manquants' | 'couverts'>('tous');
	let onlyMine = $state(false);
	let focusId = $state('toutes');
	let view = $state<View>('jour');
	let sortKey = $state('name');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let selectedDate = $state(initialDate);
	let pendingKey = $state('');
	let adding = $state(false);
	let preferenceId = $state<string | null>(null);
	let slotFocus = $state<{ date: string; slot: Period } | null>(null);
	let cellFocus = $state<{
		userId: string;
		date: string;
		slot: Period;
	} | null>(null);

	const preferencePerson = $derived(
		preferenceId ? (people.find((person) => person.id === preferenceId) ?? null) : null
	);
	const cellPerson = $derived(
		cellFocus ? (people.find((person) => person.id === cellFocus?.userId) ?? null) : null
	);
	const cellShift = $derived.by(() => {
		const focus = cellFocus;
		if (!focus || !cellPerson) return null;
		return (
			cellPerson.shifts.find(
				(shift) => shift.date === focus.date && shift.period === focus.slot
			) ?? null
		);
	});

	$effect(() => {
		people = clonePeople(serverPeople);
		services = [...serverServices];
	});

	const serviceChoices = $derived.by(() => {
		const set = new Set(services);
		for (const person of people) {
			if (person.service) set.add(person.service);
			for (const shift of person.shifts) {
				if (shift.service) set.add(shift.service);
			}
		}
		return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
	});

	$effect(() => {
		const timer = setInterval(() => {
			if (document.hidden || pendingKey) return;
			void invalidate('planning:data');
		}, 5000);
		return () => clearInterval(timer);
	});

	const field =
		'h-10 w-full min-w-0 rounded-lg border border-line bg-canvas px-3 text-left text-body text-ink';
	const command =
		'inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 text-left text-label whitespace-nowrap text-ink hover:bg-canvas disabled:cursor-wait aria-pressed:bg-accent aria-pressed:text-card';
	const pill =
		'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-label text-muted aria-pressed:bg-accent aria-pressed:text-card';
	const monthLink =
		'inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-canvas text-ink no-underline hover:bg-card';
	const panel = 'rounded-xl bg-card p-4 shadow-sm';
	const sortButton =
		'block h-8 w-full cursor-pointer border-0 bg-transparent px-2 text-left text-label text-inherit';

	$effect(() => {
		if (role !== 'tous' && !ROLE_OPTIONS.some((item) => item.code === role)) role = 'tous';
	});
	const showMatin = $derived(period !== 'apres_midi');
	const showApres = $derived(period !== 'matin');
	const periods = $derived(period === 'tous' ? PERIODS : ([period] as const));
	const today = $derived(days.find((day) => day.isToday)?.date ?? '');

	function hasShift(person: PlanningPerson, date: string, slot: Period) {
		return person.shifts.some((shift) => shift.date === date && shift.period === slot);
	}

	function getShift(person: PlanningPerson, date: string, slot: Period) {
		return person.shifts.find((shift) => shift.date === date && shift.period === slot) ?? null;
	}

	const submitCell: SubmitFunction = ({ formData }) => {
		const userId = String(formData.get('userId') ?? '');
		const date = String(formData.get('date') ?? '');
		const period = String(formData.get('period') ?? '') as Period;
		const assigned = formData.get('assigned') === 'on';
		const iconRaw = String(formData.get('icon') ?? '');
		const icon = (SHIFT_ICONS.some((item) => item.code === iconRaw) ? iconRaw : null) as
			| ShiftIcon
			| null;
		const note = String(formData.get('note') ?? '')
			.trim()
			.replace(/\s+/g, ' ')
			.slice(0, 200);
		const serviceRaw = String(formData.get('service') ?? '')
			.trim()
			.replace(/\s+/g, ' ')
			.slice(0, 80);
		const key = `${userId}|${date}|${period}`;
		pendingKey = key;
		const snapshot = clonePeople(people);
		const baseService = people.find((person) => person.id === userId)?.service ?? null;
		people = people.map((person) => {
			if (person.id !== userId) return person;
			const rest = person.shifts.filter(
				(shift) => !(shift.date === date && shift.period === period)
			);
			return {
				...person,
				shifts: assigned
					? [
							...rest,
							{
								date,
								period,
								icon,
								note: note || null,
								service: serviceRaw || baseService
							}
						]
					: rest
			};
		});
		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					await update({ invalidateAll: false });
					cellFocus = null;
					return;
				}
				people = snapshot;
				await update({ invalidateAll: result.type === 'failure' ? false : true });
			} finally {
				pendingKey = '';
			}
		};
	};

	function covered(date: string, slot: Period) {
		return people.some((person) => isActiveOn(person, date) && hasShift(person, date, slot));
	}

	function dutyCount(date: string, slot: Period) {
		return sorted.filter((person) => isActiveOn(person, date) && hasShift(person, date, slot)).length;
	}

	function dutySum(slot: 'tous' | Period) {
		return sorted.reduce((total, person) => total + count(person, slot, visibleDays), 0);
	}

	function count(person: PlanningPerson, slot: 'tous' | Period, scope: PlanningDay[]) {
		return scope.reduce((total, day) => {
			if (!isActiveOn(person, day.date)) return total;
			if (slot === 'tous') {
				const matin = hasShift(person, day.date, 'matin') ? 1 : 0;
				const apres = hasShift(person, day.date, 'apres_midi') ? 1 : 0;
				return total + matin + apres;
			}
			return total + (hasShift(person, day.date, slot) ? 1 : 0);
		}, 0);
	}

	function lowCertif(date: string) {
		return certifDoctorCount(people, date) < 2;
	}

	function score(person: PlanningPerson, key: string) {
		if (key.startsWith('day:')) {
			const date = key.slice(4);
			const matin = hasShift(person, date, 'matin') ? 1 : 0;
			const apres = hasShift(person, date, 'apres_midi') ? 1 : 0;
			if (period === 'matin') return matin;
			if (period === 'apres_midi') return apres;
			return matin + apres * 2;
		}
		if (key.startsWith('matin:')) return hasShift(person, key.slice(6), 'matin') ? 1 : 0;
		if (key.startsWith('apres_midi:')) return hasShift(person, key.slice(11), 'apres_midi') ? 1 : 0;
		if (key === 'matin') return count(person, 'matin', visibleDays);
		if (key === 'apres_midi') return count(person, 'apres_midi', visibleDays);
		if (key === 'total') return count(person, period, visibleDays);
		return 0;
	}

	function mark(key: string) {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? ' ASC' : ' DESC';
	}

	function toggleSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortKey = key;
		sortDir = key === 'name' || key === 'role' ? 'asc' : 'desc';
	}

	function reset() {
		query = '';
		role = 'tous';
		period = 'tous';
		coverage = 'tous';
		onlyMine = false;
		focusId = 'toutes';
		sortKey = 'name';
		sortDir = 'asc';
	}

	function shiftWeek(delta: number) {
		const target = addDays(selectedDate, delta * 7);
		const targetMonth = target.slice(0, 7);
		if (targetMonth !== month) {
			void goto(`/planning?mois=${targetMonth}&jour=${target}`);
			return;
		}
		selectedDate = target;
	}

	function openDay(date: string) {
		const targetMonth = date.slice(0, 7);
		if (targetMonth !== month) {
			void goto(`/planning?mois=${targetMonth}&jour=${date}`);
			return;
		}
		selectedDate = date;
	}

	function weekTitle(dates: string[]) {
		const inside = dates.filter((date) => days.some((day) => day.date === date));
		if (!inside.length) return '';
		const first = Number(inside[0]?.slice(8));
		const last = Number(inside.at(-1)?.slice(8));
		return `Semaine du ${first} au ${last}`;
	}

	const submitPerson: SubmitFunction = () => {
		adding = true;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				adding = false;
			}
		};
	};

	function toggleLocalShift(userId: string, date: string, period: Period) {
		people = people.map((person) => {
			if (person.id !== userId) return person;
			const taken = person.shifts.some((shift) => shift.date === date && shift.period === period);
			return {
				...person,
				shifts: taken
					? person.shifts.filter((shift) => !(shift.date === date && shift.period === period))
					: [
							...person.shifts,
							{ date, period, icon: null, note: null, service: person.service }
						]
			};
		});
	}

	const submitShift: SubmitFunction = ({ formData }) => {
		const userId = String(formData.get('userId') ?? '');
		const date = String(formData.get('date') ?? '');
		const period = String(formData.get('period') ?? '') as Period;
		const key = `${userId}|${date}|${period}`;
		pendingKey = key;
		const snapshot = clonePeople(people);
		toggleLocalShift(userId, date, period);

		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					await update({ invalidateAll: false });
					return;
				}
				people = snapshot;
				await update({ invalidateAll: result.type === 'failure' ? false : true });
			} finally {
				pendingKey = '';
			}
		};
	};

	const filteredPeople = $derived.by(() => {
		const needle = query.trim().toLocaleLowerCase('fr');
		return people.filter((person) => {
			if (onlyMine && person.id !== viewerId) return false;
			if (role !== 'tous' && !hasRole(person.roles, role as RoleCode)) return false;
			if (!needle) return true;
			return `${person.displayName} ${formatRoles(person.roles)} ${person.login}`
				.toLocaleLowerCase('fr')
				.includes(needle);
		});
	});

	const visibleDays = $derived.by(() =>
		days.filter((day) => {
			if (coverage === 'tous') return true;
			const missing = periods.some((slot) => !covered(day.date, slot));
			return coverage === 'manquants' ? missing : !missing;
		})
	);

	function dayFrame(date: string, slot: Period, last: boolean) {
		const day = visibleDays.find((item) => item.date === date);
		if (!day?.isToday) return '';
		const left = !showMatin || slot === 'matin';
		const right = !showApres || slot === 'apres_midi';
		return [
			left ? 'border-l-2! border-l-accent!' : '',
			right ? 'border-r-2! border-r-accent!' : '',
			last ? 'border-b-2! border-b-accent!' : ''
		].join(' ');
	}

	const shown = $derived.by(() => {
		if (focusId === 'toutes') return filteredPeople;
		return filteredPeople.filter((person) => person.id === focusId);
	});

	const sorted = $derived.by(() => {
		const direction = sortDir === 'asc' ? 1 : -1;
		return [...shown].sort((a, b) => {
			let delta = 0;
			if (sortKey === 'name') delta = a.displayName.localeCompare(b.displayName, 'fr');
			else if (sortKey === 'role')
				delta =
					formatRoles(a.roles).localeCompare(formatRoles(b.roles), 'fr') ||
					a.displayName.localeCompare(b.displayName, 'fr');
			else delta = score(a, sortKey) - score(b, sortKey) || a.displayName.localeCompare(b.displayName, 'fr');
			return delta * direction;
		});
	});

	const gapCount = $derived(
		days.reduce(
			(total, day) => total + periods.filter((slot) => !covered(day.date, slot)).length,
			0
		)
	);

	const selectedDay = $derived(days.find((day) => day.date === selectedDate) ?? days[0]);
	const weekDates = $derived(
		selectedDay
			? Array.from({ length: 7 }, (_, index) => addDays(mondayOf(selectedDay.date), index))
			: []
	);
	const weeks = $derived.by(() => {
		if (!days.length) return [] as string[][];
		const first = mondayOf(days[0].date);
		const last = mondayOf(days[days.length - 1].date);
		const result: string[][] = [];
		for (let cursor = first; cursor <= last; cursor = addDays(cursor, 7)) {
			result.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
		}
		return result;
	});

	$effect(() => {
		if (focusId !== 'toutes' && !filteredPeople.some((person) => person.id === focusId)) {
			focusId = 'toutes';
		}
	});
</script>

<section class="col-span-full grid min-w-0 content-start gap-3">
	<div class="grid gap-4 rounded-xl bg-card p-3 shadow-sm min-[900px]:p-4">
		<div
			class="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 min-[900px]:grid-cols-[11rem_minmax(0,1fr)_11rem]"
		>
			<a class={monthLink} href="/planning?mois={prev}" aria-label="Mois précédent">
				<Icon icon={chevronLeft} class="size-4 shrink-0" />
				<span class="hidden text-label min-[900px]:inline">Mois précédent</span>
			</a>
			<h1 id="month-label" class="truncate text-center text-title font-bold text-ink capitalize">
				{label}
			</h1>
			<a class={monthLink} href="/planning?mois={next}" aria-label="Mois suivant">
				<span class="hidden text-label min-[900px]:inline">Mois suivant</span>
				<Icon icon={chevronRight} class="size-4 shrink-0" />
			</a>
		</div>

		<div class="h-px bg-line"></div>

		<div class="grid grid-cols-3 gap-1 rounded-lg bg-canvas p-1 min-[900px]:hidden!">
			<button class={pill} type="button" aria-pressed={view === 'jour'} onclick={() => (view = 'jour')}>
				<Icon icon={calendarDays} class="size-4" />
				Jour
			</button>
			<button
				class={pill}
				type="button"
				aria-pressed={view === 'personne'}
				onclick={() => (view = 'personne')}
			>
				<Icon icon={userRound} class="size-4" />
				Personne
			</button>
			<button class={pill} type="button" aria-pressed={view === 'mois'} onclick={() => (view = 'mois')}>
				<Icon icon={layoutGrid} class="size-4" />
				Mois
			</button>
		</div>

		<div
			class="grid grid-cols-2 items-end gap-3 min-[1100px]:grid-cols-[minmax(12rem,1.4fr)_repeat(4,minmax(8.5rem,1fr))_auto]"
		>
			<label class="col-span-2 grid min-w-0 gap-1 min-[1100px]:col-span-1">
				<span class="text-label text-muted">Recherche</span>
				<input class={field} bind:value={query} placeholder="Nom, rôle, identifiant" />
			</label>
			<label class="grid min-w-0 gap-1">
				<span class="text-label text-muted">Rôle</span>
				<select class={field} bind:value={role}>
					<option value="tous">Tous</option>
					{#each ROLE_OPTIONS as item (item.code)}
						<option value={item.code}>{item.label}</option>
					{/each}
				</select>
			</label>
			<label class="grid min-w-0 gap-1">
				<span class="text-label text-muted">Période</span>
				<select class={field} bind:value={period}>
					<option value="tous">Matin et après-midi</option>
					<option value="matin">Matin</option>
					<option value="apres_midi">Après-midi</option>
				</select>
			</label>
			<label class="grid min-w-0 gap-1">
				<span class="text-label text-muted">Couverture</span>
				<select class={field} bind:value={coverage}>
					<option value="tous">Tout le mois</option>
					<option value="manquants">Créneaux manquants</option>
					<option value="couverts">Créneaux couverts</option>
				</select>
			</label>
			<label class="grid min-w-0 gap-1">
				<span class="text-label text-muted">Personne</span>
				<select class={field} bind:value={focusId}>
					<option value="toutes">Toutes</option>
					{#each filteredPeople as person (person.id)}
						<option value={person.id}>{person.displayName}</option>
					{/each}
				</select>
			</label>
			<div class="col-span-2 flex flex-wrap gap-2 min-[1100px]:col-span-1">
				<button
					class={command}
					type="button"
					aria-pressed={onlyMine}
					onclick={() => (onlyMine = !onlyMine)}
				>
					<Icon icon={userRound} class="size-4" />
					{onlyMine ? 'Toute l’équipe' : 'Mes gardes'}
				</button>
				<button class={command} type="button" onclick={reset}>
					<Icon icon={rotateCcw} class="size-4" />
					Réinitialiser
				</button>
			</div>
		</div>
	</div>

	{#if notice}
		<p class="rounded-lg bg-alert/10 px-3 py-2 text-label text-alert">{notice}</p>
	{/if}

	<p
		class="rounded-lg px-3 py-2 text-label {gapCount > 0
			? 'bg-alert/10 text-alert'
			: 'text-muted'}"
	>
		{#if gapCount === 0}
			Tous les créneaux du mois sont couverts.
		{:else}
			Non couvert : {gapCount} {gapCount === 1 ? 'plage' : 'plages'}
		{/if}
	</p>

	<div class="grid gap-3 min-[900px]:hidden!">
		{#if view === 'jour'}
		<div class="grid grid-cols-[1fr_auto_1fr] gap-2">
			<button class={command} type="button" onclick={() => shiftWeek(-1)}>
				<Icon icon={chevronLeft} class="size-4" />
				<span class="min-w-0 truncate">Semaine précédente</span>
			</button>
			{#if today}
				<button class="{command} justify-center" type="button" onclick={() => (selectedDate = today)}>
					<Icon icon={calendarCheck} class="size-4" />
					Aujourd’hui
				</button>
			{:else}
				<button
					class="{command} justify-center"
					type="button"
					onclick={() => openDay(isoDate(new Date()))}
				>
					<Icon icon={calendarCheck} class="size-4" />
					Aujourd’hui
				</button>
			{/if}
			<button class="{command} justify-end" type="button" onclick={() => shiftWeek(1)}>
				<span class="min-w-0 truncate">Semaine suivante</span>
				<Icon icon={chevronRight} class="size-4" />
			</button>
		</div>

		<div class="grid grid-cols-7 gap-1">
			{#each weekDates as date (date)}
				{@const day = days.find((item) => item.date === date)}
				{@const shortCertif = !!day && lowCertif(date)}
				<button
					class="grid h-12 place-items-center rounded-lg text-label shadow-sm aria-pressed:bg-accent aria-pressed:text-card {shortCertif
						? 'bg-alert/10 text-alert'
						: day
							? 'bg-card text-muted'
							: 'bg-card text-muted/50'} {day?.isToday && date !== selectedDate
						? 'ring-2 ring-accent/40'
						: ''}"
					type="button"
					aria-pressed={date === selectedDate}
					onclick={() => openDay(date)}
				>
					<span>{day ? day.weekday : weekdayOf(date)}</span>
					<span class="text-body font-bold">{day ? day.day : Number(date.slice(8))}</span>
				</button>
			{/each}
		</div>

		{#if selectedDay}
			<article
				class="{panel} grid gap-2 {lowCertif(selectedDay.date) ? 'bg-alert/10' : ''}"
			>
				<h2 class="text-body font-bold text-ink capitalize">
					{formatWeekday(selectedDay.date)}
					{formatLong(selectedDay.date)}
				</h2>
				{#if lowCertif(selectedDay.date)}
					<p class="text-label text-alert">Moins de 2 médecins certif distincts.</p>
				{/if}
				{#if showMatin}
					{@render duty(selectedDay.date, 'matin')}
				{/if}
				{#if showApres}
					{@render duty(selectedDay.date, 'apres_midi')}
				{/if}
			</article>
		{/if}
		{:else if view === 'personne'}
		{#if sorted.length === 0}
			<p class="text-label text-muted">Aucun membre pour ces filtres.</p>
		{/if}
		{#each sorted as person (person.id)}
			<article class="{panel} grid gap-3">
				{#if admin}
					<button
						class="cursor-pointer border-0 bg-transparent p-0 text-left text-body font-bold text-ink"
						type="button"
						onclick={() => (preferenceId = person.id)}
					>
						{person.displayName}
					</button>
				{:else}
					<p class="text-body font-bold text-ink">{person.displayName}</p>
				{/if}
				<p class="text-label text-muted">{formatRoles(person.roles)}</p>
				{#each weeks as week (week[0])}
					<section class="grid gap-2">
						<h3 class="text-label text-muted">{weekTitle(week)}</h3>
						<ul class="m-0 grid list-none gap-1 p-0">
							{#each week as date (date)}
								{@const day = days.find((item) => item.date === date)}
								{#if day}
									{@const active = isActiveOn(person, date)}
									<li
										class="grid grid-cols-[44px_1fr] items-center gap-1 {active
											? day.isToday
												? 'text-accent'
												: ''
											: 'rounded-lg bg-absent text-muted'}"
									>
										<span class="text-label">{day.day} {day.weekday}</span>
										{#if !active}
											<span class="text-label text-muted">Hors équipe</span>
										{:else}
											<span class="grid grid-cols-2 gap-1">
												{#if showMatin}
													{@render shiftLine(person, date, 'matin')}
												{/if}
												{#if showApres}
													{@render shiftLine(person, date, 'apres_midi')}
												{/if}
											</span>
										{/if}
									</li>
								{/if}
							{/each}
						</ul>
					</section>
				{/each}
			</article>
		{/each}
		{/if}
	</div>

	<div
		class="max-h-[min(70vh,720px)] overflow-x-hidden overflow-y-auto rounded-xl bg-card shadow-sm {view === 'mois'
			? 'block'
			: 'max-[899px]:hidden'} min-[900px]:block"
	>
		{#if sorted.length === 0}
			<p class="p-4 text-label text-muted">Aucun membre pour ces filtres.</p>
		{:else}
			<table class="w-full table-fixed border-collapse text-[11px] leading-none" aria-labelledby="month-label">
				<colgroup>
					<col class="w-28" />
					<col class="w-6" />
					<col class="w-6" />
					<col class="w-6" />
					{#each visibleDays as day (day.date)}
						{#if showMatin}<col />{/if}
						{#if showApres}<col />{/if}
					{/each}
				</colgroup>
				<thead>
					<tr>
						<th
							class="sticky top-0 left-0 z-40 h-14 border-r border-b border-line bg-card p-0 text-left align-middle"
							scope="col"
							rowspan="2"
						>
							<button class="{sortButton} h-6 px-1" type="button" onclick={() => toggleSort('name')}
								>Nom{mark('name')}</button
							>
						</th>
						<th class="sticky top-0 z-20 h-6 border-r border-b border-line bg-card p-0" scope="col" rowspan="2">
							<button
								class="grid h-6 w-full cursor-pointer place-items-center border-0 bg-transparent text-muted"
								type="button"
								aria-label="Matin{mark('matin')}"
								onclick={() => toggleSort('matin')}
							>
								<span class="text-[9px] font-bold min-[900px]:hidden!">M</span>
								<Icon icon={sunrise} class="size-3 max-[899px]:hidden!" />
							</button>
						</th>
						<th class="sticky top-0 z-20 h-6 border-r border-b border-line bg-card p-0" scope="col" rowspan="2">
							<button
								class="grid h-6 w-full cursor-pointer place-items-center border-0 bg-transparent text-muted"
								type="button"
								aria-label="Après-midi{mark('apres_midi')}"
								onclick={() => toggleSort('apres_midi')}
							>
								<span class="text-[9px] font-bold min-[900px]:hidden!">A</span>
								<Icon icon={sunset} class="size-3 max-[899px]:hidden!" />
							</button>
						</th>
						<th class="sticky top-0 z-20 h-6 border-r border-b border-line bg-card p-0" scope="col" rowspan="2">
							<button
								class="grid h-6 w-full cursor-pointer place-items-center border-0 bg-transparent text-[11px] font-bold text-muted"
								type="button"
								aria-label="Total{mark('total')}"
								onclick={() => toggleSort('total')}>Σ</button
							>
						</th>
						{#each visibleDays as day (day.date)}
							<th
								class="sticky top-0 z-20 h-8 border-r border-b border-line bg-card p-0 text-center {day.isToday
									? 'border-t-2! border-x-2! border-t-accent! border-x-accent! text-accent'
									: 'text-muted'}"
								scope="col"
								colspan={periods.length}
							>
								<button
									class="flex h-8 w-full cursor-pointer flex-col items-center justify-center border-0 bg-transparent p-0 leading-none"
									type="button"
									aria-label="{day.weekday} {day.day}{mark(`day:${day.date}`)}"
									onclick={() => toggleSort(`day:${day.date}`)}
								>
									<span class="text-[9px] font-normal">{day.weekday[0]}</span>
									<span class="text-[11px] font-bold">{day.day}</span>
								</button>
							</th>
						{/each}
					</tr>
					<tr>
						{#each visibleDays as day (day.date)}
							{#if showMatin}
								<th
									class="sticky top-8 z-20 h-6 border-r border-b border-line p-0 {dayFrame(day.date, 'matin', false)} {lowCertif(day.date)
										? 'bg-alert/10 text-alert'
										: 'bg-card text-muted'}"
									scope="col"
								>
									<button
										class="grid h-6 w-full cursor-pointer place-items-center border-0 bg-transparent p-0 text-inherit"
										type="button"
										aria-label="{day.weekday} {day.day}, {PERIOD_LABELS.matin}{mark(`matin:${day.date}`)}"
										onclick={() => toggleSort(`matin:${day.date}`)}
									>
										<Icon icon={sunrise} class="size-3 max-[899px]:hidden!" />
									</button>
								</th>
							{/if}
							{#if showApres}
								<th
									class="sticky top-8 z-20 h-6 border-r border-b border-line p-0 {dayFrame(day.date, 'apres_midi', false)} {lowCertif(day.date)
										? 'bg-alert/10 text-alert'
										: 'bg-card text-muted max-[899px]:bg-apres! max-[899px]:text-card!'}"
									scope="col"
								>
									<button
										class="grid h-6 w-full cursor-pointer place-items-center border-0 bg-transparent p-0 text-inherit"
										type="button"
										aria-label="{day.weekday} {day.day}, {PERIOD_LABELS.apres_midi}{mark(`apres_midi:${day.date}`)}"
										onclick={() => toggleSort(`apres_midi:${day.date}`)}
									>
										<Icon icon={sunset} class="size-3 max-[899px]:hidden!" />
									</button>
								</th>
							{/if}
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sorted as person (person.id)}
						<tr>
							<th
								class="sticky left-0 z-30 border-r border-b border-line bg-card px-1 text-left align-middle"
								scope="row"
							>
								{#if admin}
									<button
										class="block w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[11px] font-bold text-ink"
										type="button"
										aria-label="Préférences de {person.displayName}"
										onclick={() => (preferenceId = person.id)}
									>
										{person.displayName}
									</button>
								{:else}
									<span class="block truncate text-[11px] font-bold text-ink">{person.displayName}</span>
								{/if}
							</th>
							<td class="border-r border-b border-line bg-card text-center align-middle font-bold"
								>{count(person, 'matin', visibleDays)}</td
							>
							<td class="border-r border-b border-line bg-card text-center align-middle font-bold"
								>{count(person, 'apres_midi', visibleDays)}</td
							>
							<td class="border-r border-b border-line bg-card text-center align-middle font-bold"
								>{count(person, period, visibleDays)}</td
							>
							{#each visibleDays as day (day.date)}
								{#if showMatin}
									{@render cell(person, day.date, 'matin', false)}
								{/if}
								{#if showApres}
									{@render cell(person, day.date, 'apres_midi', false)}
								{/if}
							{/each}
						</tr>
					{/each}
					{#if admin}
						<tr>
							<th
								class="sticky left-0 z-30 h-6 border-r border-b border-line bg-card p-0 text-left"
								scope="row"
							>
								<form class="flex h-6 items-center" method="POST" action="?/add&mois={month}" use:enhance={submitPerson}>
									<input type="hidden" name="month" value={month} />
									<button
										class="grid size-6 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-accent disabled:cursor-wait"
										type="submit"
										disabled={adding}
										aria-label="Ajouter un collaborateur"
									>
										<Icon icon={plus} class="size-3.5" />
									</button>
									<input
										class="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 text-[11px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted"
										name="name"
										type="text"
										required
										maxlength="80"
										autocomplete="off"
										placeholder="Nom"
										aria-label="Nom du nouveau collaborateur"
										disabled={adding}
									/>
								</form>
							</th>
							<td class="border-r border-b border-line bg-card"></td>
							<td class="border-r border-b border-line bg-card"></td>
							<td class="border-r border-b border-line bg-card"></td>
							{#each visibleDays as day (day.date)}
								{#if showMatin}
									<td class="border-r border-b border-line bg-card {dayFrame(day.date, 'matin', false)}"></td>
								{/if}
								{#if showApres}
									<td class="border-r border-b border-line bg-card {dayFrame(day.date, 'apres_midi', false)}"></td>
								{/if}
							{/each}
						</tr>
					{/if}
					<tr>
						<th
							class="sticky bottom-0 left-0 z-30 h-6 border-r border-b border-line bg-card px-1 text-left text-[11px] font-bold text-muted"
							scope="row"
						>
							Total
						</th>
						<td class="sticky bottom-0 z-20 border-r border-b border-line bg-card text-center font-bold"
							>{dutySum('matin')}</td
						>
						<td class="sticky bottom-0 z-20 border-r border-b border-line bg-card text-center font-bold"
							>{dutySum('apres_midi')}</td
						>
						<td class="sticky bottom-0 z-20 border-r border-b border-line bg-card text-center font-bold"
							>{dutySum(period)}</td
						>
						{#each visibleDays as day (day.date)}
							{#if showMatin}
								{@const total = dutyCount(day.date, 'matin')}
								<td
									class="sticky bottom-0 z-20 h-6 border-r border-b border-line text-center font-bold {dayFrame(day.date, 'matin', true)} {lowCertif(day.date)
										? 'bg-alert/10 text-alert'
										: 'bg-card text-ink'}"
								>
									{total}
								</td>
							{/if}
							{#if showApres}
								{@const total = dutyCount(day.date, 'apres_midi')}
								<td
									class="sticky bottom-0 z-20 h-6 border-r border-b border-line text-center font-bold {dayFrame(day.date, 'apres_midi', true)} {lowCertif(day.date)
										? 'bg-alert/10 text-alert'
										: 'bg-card text-ink'}"
								>
									{total}
								</td>
							{/if}
						{/each}
					</tr>
				</tbody>
			</table>
		{/if}
	</div>
</section>

{#snippet duty(date: string, slot: Period)}
	{@const assigned = people.filter(
		(person) => isActiveOn(person, date) && hasShift(person, date, slot)
	)}
	{@const tone =
		slot === 'apres_midi' && assigned.length > 0
			? 'bg-apres text-card'
			: assigned.length === 0
				? 'bg-alert/10 text-alert'
				: 'bg-canvas text-ink'}
	{#if admin}
		<button
			class="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border-0 px-3 py-3 text-left {tone}"
			type="button"
			aria-label="{PERIOD_LABELS[slot]}, {formatLong(date)}"
			onclick={() => (slotFocus = { date, slot })}
		>
			<Icon icon={slot === 'matin' ? sunrise : sunset} class="size-4" />
			<div class="min-w-0">
				<p class="text-label {assigned.length === 0 ? 'text-alert' : 'opacity-70'}">{PERIOD_LABELS[slot]}</p>
				<p class="text-body font-bold {assigned.length === 0 ? 'text-alert' : ''}">
					{#if assigned.length === 0}
						Non couvert
					{:else}
						{assigned.map((person) => person.displayName).join(', ')}
					{/if}
				</p>
			</div>
		</button>
	{:else}
		<div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl px-3 py-3 {tone}">
			<Icon icon={slot === 'matin' ? sunrise : sunset} class="size-4" />
			<div class="min-w-0">
				<p class="text-label {assigned.length === 0 ? 'text-alert' : 'opacity-70'}">{PERIOD_LABELS[slot]}</p>
				<p class="text-body font-bold {assigned.length === 0 ? 'text-alert' : ''}">
					{#if assigned.length === 0}
						Non couvert
					{:else}
						{assigned.map((person) => person.displayName).join(', ')}
					{/if}
				</p>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet shiftLine(person: PlanningPerson, date: string, slot: Period)}
	{@const taken = hasShift(person, date, slot)}
	{@const open = !covered(date, slot)}
	{@const key = `${person.id}|${date}|${slot}`}
	{#if admin}
		<form method="POST" action="?/toggle&mois={month}" use:enhance={submitShift}>
			<input type="hidden" name="userId" value={person.id} />
			<input type="hidden" name="date" value={date} />
			<input type="hidden" name="period" value={slot} />
			<button
				class="grid h-10 w-full cursor-pointer grid-cols-[52px_minmax(0,1fr)] items-center rounded-lg px-3 text-left text-label disabled:cursor-wait {slot ===
					'apres_midi' && taken
					? 'bg-apres text-card'
					: 'bg-canvas text-ink'} {open ? 'text-alert' : ''}"
				type="submit"
				disabled={pendingKey === key}
				aria-pressed={taken}
				aria-label="{person.displayName}, {formatLong(date)}, {PERIOD_LABELS[slot]}, {taken
					? 'prise'
					: 'libre'}"
			>
				<span>{PERIOD_LABELS[slot]}</span>
				<span>{open ? 'Non couvert' : taken ? 'Prise' : '—'}</span>
			</button>
		</form>
	{:else}
		<div
			class="grid h-10 grid-cols-[52px_minmax(0,1fr)] items-center rounded-lg px-3 text-label {slot ===
				'apres_midi' && taken
				? 'bg-apres text-card'
				: 'bg-canvas text-ink'} {open ? 'text-alert' : ''}"
		>
			<span>{PERIOD_LABELS[slot]}</span>
			<span>{open ? 'Non couvert' : taken ? 'Prise' : '—'}</span>
		</div>
	{/if}
{/snippet}

{#snippet cellMark(taken: boolean, icon: typeof check | null)}
	{#if taken && icon}
		<Icon icon={icon} class="size-3 text-taken max-[899px]:hidden!" />
	{/if}
{/snippet}

{#snippet cell(person: PlanningPerson, date: string, slot: Period, last: boolean)}
	{@const active = isActiveOn(person, date)}
	{@const shift = getShift(person, date, slot)}
	{@const taken = active && !!shift}
	{@const key = `${person.id}|${date}|${slot}`}
	{@const markIcon = shift?.icon ? SHIFT_ICON_MAP[shift.icon] : taken ? check : null}
	{@const tip = formatShiftTooltip(shift)}
	<td
		class="h-6 border-r border-b border-line p-0 align-middle {dayFrame(date, slot, last)} {!active
			? 'bg-absent'
			: lowCertif(date)
				? 'bg-alert/10 text-alert'
				: taken
					? 'bg-taken-soft'
					: slot === 'apres_midi'
						? 'bg-card text-ink max-[899px]:bg-apres!'
						: 'bg-card text-ink'}"
	>
		{#if active && admin}
			<Tooltip text={tip} class="flex h-full w-full">
				<form class="h-full w-full" method="POST" action="?/toggle&mois={month}" use:enhance={submitShift}>
					<input type="hidden" name="userId" value={person.id} />
					<input type="hidden" name="date" value={date} />
					<input type="hidden" name="period" value={slot} />
					<button
						class="grid h-6 w-full cursor-pointer place-items-center border-0 bg-transparent p-0 text-inherit disabled:cursor-wait"
						type="submit"
						disabled={pendingKey === key}
						aria-pressed={taken}
						aria-label="{person.displayName}, {formatLong(date)}, {PERIOD_LABELS[slot]}, {taken
							? 'prise'
							: 'libre'}"
						oncontextmenu={(event) => {
							event.preventDefault();
							cellFocus = { userId: person.id, date, slot };
						}}
					>
						{@render cellMark(taken, markIcon)}
					</button>
				</form>
			</Tooltip>
		{:else if active && taken}
			<Tooltip text={tip} class="flex h-full w-full">
				<span class="grid h-6 w-full place-items-center">
					{@render cellMark(true, markIcon)}
				</span>
			</Tooltip>
		{/if}
	</td>
{/snippet}

{#if admin && slotFocus}
	{@const focus = slotFocus}
	{@const roster = people
		.filter((person) => isActiveOn(person, focus.date))
		.sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'))}
	{@const open = !covered(focus.date, focus.slot)}
	<Sheet
		title="{PERIOD_LABELS[focus.slot]} · {formatLong(focus.date)}"
		onclose={() => (slotFocus = null)}
	>
		{#if open}
			<p class="rounded-lg bg-alert/10 px-3 py-2 text-label text-alert">Non couvert</p>
		{/if}
		{#if lowCertif(focus.date)}
			<p class="rounded-lg bg-alert/10 px-3 py-2 text-label text-alert">
				Moins de 2 médecins certif distincts ce jour-là.
			</p>
		{/if}
		{#if roster.length === 0}
			<p class="text-label text-muted">Personne n’est en équipe à cette date.</p>
		{:else}
			<ul class="m-0 grid list-none gap-1 p-0">
				{#each roster as person (person.id)}
					{@const taken = hasShift(person, focus.date, focus.slot)}
					{@const key = `${person.id}|${focus.date}|${focus.slot}`}
					<li>
						<form method="POST" action="?/toggle&mois={month}" use:enhance={submitShift}>
							<input type="hidden" name="userId" value={person.id} />
							<input type="hidden" name="date" value={focus.date} />
							<input type="hidden" name="period" value={focus.slot} />
							<button
								class="grid h-11 w-full cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-line bg-canvas px-3 text-left text-body text-ink disabled:cursor-wait aria-pressed:border-taken aria-pressed:bg-taken-soft"
								type="submit"
								disabled={pendingKey === key}
								aria-pressed={taken}
								aria-label="{person.displayName}, {focus.slot}, {taken ? 'prise' : 'libre'}"
							>
								<span class="grid size-5 place-items-center">
									{#if taken}<Icon icon={check} class="size-3.5 text-taken" />{/if}
								</span>
								<span class="min-w-0 truncate font-bold">{person.displayName}</span>
								<span class="text-label text-muted">{formatRoles(person.roles)}</span>
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</Sheet>
{/if}

{#if admin && preferencePerson}
	<Sheet title={preferencePerson.displayName} onclose={() => (preferenceId = null)}>
		{#key preferencePerson.id}
			<PreferencesForm
				person={preferencePerson}
				{month}
				{viewerId}
				services={serviceChoices}
				onsaved={() => (preferenceId = null)}
			/>
		{/key}
	</Sheet>
{/if}

{#if admin && cellFocus && cellPerson}
	{@const focus = cellFocus}
	{@const taken = !!cellShift}
	{@const key = `${focus.userId}|${focus.date}|${focus.slot}`}
	<Sheet
		title="{cellPerson.displayName} · {PERIOD_LABELS[focus.slot]}"
		onclose={() => (cellFocus = null)}
	>
		{#key `${focus.userId}|${focus.date}|${focus.slot}|${cellShift?.icon ?? ''}|${cellShift?.note ?? ''}`}
			<form
				class="grid gap-4"
				method="POST"
				action="?/cell&mois={month}"
				use:enhance={submitCell}
			>
				<input type="hidden" name="userId" value={focus.userId} />
				<input type="hidden" name="date" value={focus.date} />
				<input type="hidden" name="period" value={focus.slot} />
				<p class="text-label text-muted capitalize">{formatLong(focus.date)}</p>
				<label class="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-3">
					<input
						class="size-4 cursor-pointer accent-taken"
						type="checkbox"
						name="assigned"
						checked={taken}
					/>
					<span class="text-body font-bold text-ink">Créneau assigné</span>
				</label>
				<label class="grid gap-1">
					<span class="text-label text-muted">Service</span>
					<select
						class="h-10 rounded-lg border border-line bg-card px-3 text-ink"
						name="service"
					>
						<option value="">Sans service</option>
						{#each serviceChoices as item (item)}
							<option
								value={item}
								selected={(cellShift?.service ?? cellPerson.service ?? '') === item}
							>
								{item}
							</option>
						{/each}
					</select>
				</label>
				<fieldset class="grid gap-2 border-0 p-0">
					<legend class="text-body font-bold text-ink">Icône</legend>
					<div class="flex flex-wrap gap-1">
						<label
							class="grid size-9 cursor-pointer place-items-center rounded-lg border border-line bg-canvas text-muted has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-card"
						>
							<input
								class="sr-only"
								type="radio"
								name="icon"
								value=""
								checked={!cellShift?.icon}
							/>
							—
						</label>
						{#each SHIFT_ICONS as icon (icon.code)}
							<label
								class="grid size-9 cursor-pointer place-items-center rounded-lg border border-line bg-canvas text-ink has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-card"
								title={icon.label}
							>
								<input
									class="sr-only"
									type="radio"
									name="icon"
									value={icon.code}
									checked={cellShift?.icon === icon.code}
								/>
								<Icon icon={SHIFT_ICON_MAP[icon.code]} class="size-4" />
							</label>
						{/each}
					</div>
				</fieldset>
				<label class="grid gap-1">
					<span class="text-label text-muted">Commentaire</span>
					<textarea
						class="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-body text-ink"
						name="note"
						maxlength="200"
						placeholder="Visible au survol de la case"
						value={cellShift?.note ?? ''}
					></textarea>
				</label>
				<button
					class="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-accent text-body font-bold text-card disabled:cursor-wait"
					type="submit"
					disabled={pendingKey === key}
				>
					Enregistrer
				</button>
			</form>
		{/key}
	</Sheet>
{/if}
