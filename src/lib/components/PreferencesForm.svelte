<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { untrack } from 'svelte';
	import Icon from '@iconify/svelte';
	import plus from '@iconify-icons/lucide/plus';
	import x from '@iconify-icons/lucide/x';
	import {
		formatLong,
		formatPreferenceSlots,
		isoDate,
		nextMonday,
		nextMonthStart,
		PERIOD_LABELS,
		PERIODS,
		ROLE_OPTIONS,
		SHIFT_ICONS,
		WEEK_PATTERN,
		type PlanningPerson,
		type PreferenceSlot,
		type PreferenceSlotConfig,
		type RoleCode,
		type ShiftIcon,
		type WeekPreference
	} from '#lib/planning.ts';
	import { SHIFT_ICON_MAP } from '#lib/shift-icons.ts';

	type Props = {
		person: PlanningPerson;
		month: string;
		viewerId: string;
		onsaved: () => void;
	};

	let { person, month, viewerId, onsaved }: Props = $props();

	const today = isoDate(new Date());
	const monday = nextMonday();
	const comingMonth = nextMonthStart();

	function slotState(selected: PreferenceSlotConfig[]) {
		const value = {} as Record<PreferenceSlot, boolean>;
		for (const day of WEEK_PATTERN) {
			for (const period of PERIODS) {
				const slot: PreferenceSlot = `${day.code}-${period}`;
				value[slot] = selected.some((item) => item.slot === slot);
			}
		}
		return value;
	}

	function slotMetaState(selected: PreferenceSlotConfig[]) {
		const icons = {} as Record<PreferenceSlot, ShiftIcon | ''>;
		const notes = {} as Record<PreferenceSlot, string>;
		for (const day of WEEK_PATTERN) {
			for (const period of PERIODS) {
				const slot: PreferenceSlot = `${day.code}-${period}`;
				icons[slot] = '';
				notes[slot] = '';
			}
		}
		for (const item of selected) {
			icons[item.slot] = item.icon ?? '';
			notes[item.slot] = item.note ?? '';
		}
		return { icons, notes };
	}

	function roleState(selected: RoleCode[]) {
		const value = {} as Record<RoleCode, boolean>;
		for (const role of ROLE_OPTIONS) {
			value[role.code] = selected.includes(role.code);
		}
		return value;
	}

	const initial = untrack(() => person.preference);
	const history = untrack(() => person.preferenceHistory);
	const initialName = untrack(() => person.displayName);
	const initialRoles = untrack(() => person.roles);
	const initialEmail = untrack(() => person.email ?? '');
	const initialBlocked = untrack(() => person.blocked);
	const isSelf = untrack(() => person.id === viewerId);
	const initialPeriods = untrack(() =>
		person.periods.length > 0
			? person.periods.map((span) => ({ ...span, key: crypto.randomUUID() }))
			: person.activeUntil
				? [{ startsOn: person.activeFrom, endsOn: person.activeUntil, key: crypto.randomUUID() }]
				: []
	);
	const initialMeta = untrack(() => slotMetaState(initial?.slots ?? []));
	let displayName = $state(initialName);
	let rolesChecked = $state(roleState(initialRoles));
	let email = $state(initialEmail);
	let blocked = $state(initialBlocked);
	let effectiveFrom = $state(monday);
	let checked = $state(slotState(initial?.slots ?? []));
	let slotIcons = $state(initialMeta.icons);
	let slotNotes = $state(initialMeta.notes);
	let periods = $state(initialPeriods);
	let saving = $state(false);
	let inviting = $state(false);
	let removing = $state(false);
	let error = $state('');
	let inviteMessage = $state('');

	function loadVersion(version: WeekPreference) {
		effectiveFrom = version.effectiveFrom;
		checked = slotState(version.slots);
		const meta = slotMetaState(version.slots);
		slotIcons = meta.icons;
		slotNotes = meta.notes;
	}

	const suggestion =
		'h-9 cursor-pointer rounded-lg bg-canvas px-3 text-label text-ink aria-pressed:bg-accent aria-pressed:text-card';

	const submit: SubmitFunction = ({ action, cancel }) => {
		const isInvite = action.search.includes('invite');
		const isRemove = action.search.includes('remove');
		if (isRemove) {
			const ok = confirm(
				`Supprimer définitivement le compte de ${person.displayName} ? Planning, préférences et accès seront effacés.`
			);
			if (!ok) {
				cancel();
				return;
			}
			removing = true;
		} else if (isInvite) inviting = true;
		else saving = true;
		error = '';
		inviteMessage = '';
		return async ({ result, update }) => {
			saving = false;
			inviting = false;
			removing = false;
			if (result.type === 'success') {
				await update();
				if (isInvite) {
					inviteMessage = 'Lien envoyé. Valable 15 minutes.';
					return;
				}
				onsaved();
				return;
			}
			if (result.type === 'failure') {
				const data = result.data as { error?: string } | undefined;
				error =
					data?.error ||
					(isRemove
						? 'Suppression impossible.'
						: isInvite
							? 'Envoi impossible.'
							: 'Enregistrement impossible.');
			}
		};
	};
</script>

<form class="grid gap-4" method="POST" action="?/preferences&mois={month}" use:enhance={submit}>
	<input type="hidden" name="userId" value={person.id} />
	<label class="grid gap-1">
		<span class="text-label text-muted">Nom</span>
		<input
			class="h-10 rounded-lg border border-line bg-card px-3 text-ink"
			name="displayName"
			type="text"
			required
			maxlength="80"
			autocomplete="off"
			bind:value={displayName}
		/>
	</label>

	<fieldset class="grid gap-2 border-0 p-0">
		<legend class="text-body font-bold text-ink">Rôles</legend>
		{#each ROLE_OPTIONS as role (role.code)}
			<label class="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2">
				<input
					class="size-4 cursor-pointer accent-taken"
					type="checkbox"
					name="roles"
					value={role.code}
					bind:checked={rolesChecked[role.code]}
				/>
				<span class="text-body text-ink">{role.label}</span>
			</label>
		{/each}
	</fieldset>

	<div class="grid gap-2">
		<label class="grid gap-1">
			<span class="text-label text-muted">Email</span>
			<input
				class="h-10 rounded-lg border border-line bg-card px-3 text-ink"
				name="email"
				type="email"
				maxlength="200"
				autocomplete="off"
				bind:value={email}
			/>
		</label>
		<button
			class="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-line bg-card px-3 text-label text-ink hover:bg-canvas disabled:cursor-wait"
			type="submit"
			formaction="?/invite&mois={month}"
			disabled={inviting || saving || removing || !email.trim() || blocked}
		>
			{inviting ? 'Envoi…' : 'Envoyer le lien d’accès'}
		</button>
		<p class="text-label text-muted">
			Même bouton pour une première connexion ou une réinitialisation. Le lien expire en 15 minutes.
		</p>
		{#if inviteMessage}
			<p class="rounded-lg bg-taken-soft px-3 py-2 text-label text-taken">{inviteMessage}</p>
		{/if}
	</div>

	<label
		class="flex items-start gap-3 rounded-lg border border-line bg-canvas px-3 py-3 {isSelf
			? 'opacity-60'
			: ''}"
	>
		<input
			class="mt-0.5 size-4 shrink-0 cursor-pointer accent-alert disabled:cursor-not-allowed"
			type="checkbox"
			name="blocked"
			bind:checked={blocked}
			disabled={isSelf}
		/>
		<span class="grid gap-0.5">
			<span class="text-body font-bold text-ink">Bloquer la connexion</span>
			<span class="text-label text-muted">
				{#if isSelf}
					Vous ne pouvez pas bloquer votre propre compte.
				{:else}
					La personne ne pourra plus se connecter. Les sessions ouvertes sont fermées à
					l’enregistrement.
				{/if}
			</span>
		</span>
	</label>

	<p class="text-label text-muted">Préférences par défaut</p>

	<fieldset class="grid gap-2 border-0 p-0">
		<legend class="text-body font-bold text-ink">Semaine type</legend>
		<div
			class="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-x-2 text-label text-muted"
		>
			<span></span>
			<span class="text-center">{PERIOD_LABELS.matin}</span>
			<span class="text-center">{PERIOD_LABELS.apres_midi}</span>
		</div>
		{#each WEEK_PATTERN as day (day.code)}
			{@const matin = `${day.code}-matin` as PreferenceSlot}
			{@const apres = `${day.code}-apres_midi` as PreferenceSlot}
			<div class="grid gap-2 rounded-lg border border-line bg-canvas p-2">
				<div class="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-x-2">
					<span class="text-body text-ink">{day.label}</span>
					<label class="grid h-9 cursor-pointer place-items-center">
						<input
							class="size-4 cursor-pointer accent-taken"
							type="checkbox"
							name="slots"
							value={matin}
							bind:checked={checked[matin]}
							aria-label="{day.label}, {PERIOD_LABELS.matin}"
						/>
					</label>
					<label class="grid h-9 cursor-pointer place-items-center">
						<input
							class="size-4 cursor-pointer accent-taken"
							type="checkbox"
							name="slots"
							value={apres}
							bind:checked={checked[apres]}
							aria-label="{day.label}, {PERIOD_LABELS.apres_midi}"
						/>
					</label>
				</div>
				{#each [{ slot: matin, label: PERIOD_LABELS.matin }, { slot: apres, label: PERIOD_LABELS.apres_midi }] as item (item.slot)}
					{#if checked[item.slot]}
						<div class="grid gap-2 rounded-lg bg-card p-2">
							<p class="text-label font-bold text-ink">{item.label}</p>
							<div class="flex flex-wrap gap-1">
								<button
									class="grid size-8 place-items-center rounded-lg border border-line bg-canvas text-muted aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-card"
									type="button"
									aria-pressed={slotIcons[item.slot] === ''}
									aria-label="Sans icône"
									onclick={() => (slotIcons[item.slot] = '')}
								>
									—
								</button>
								{#each SHIFT_ICONS as icon (icon.code)}
									<button
										class="grid size-8 place-items-center rounded-lg border border-line bg-canvas text-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-card"
										type="button"
										aria-pressed={slotIcons[item.slot] === icon.code}
										aria-label={icon.label}
										onclick={() => (slotIcons[item.slot] = icon.code)}
									>
										<Icon icon={SHIFT_ICON_MAP[icon.code]} class="size-3.5" />
									</button>
								{/each}
							</div>
							<input type="hidden" name="icon-{item.slot}" value={slotIcons[item.slot]} />
							<label class="grid gap-1">
								<span class="text-label text-muted">Commentaire</span>
								<input
									class="h-9 rounded-lg border border-line bg-card px-3 text-ink"
									type="text"
									name="note-{item.slot}"
									maxlength="200"
									bind:value={slotNotes[item.slot]}
									placeholder="Optionnel"
								/>
							</label>
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</fieldset>

	<div class="grid gap-2">
		<label class="grid gap-1">
			<span class="text-label text-muted">Prise d'effet</span>
			<input
				class="h-10 rounded-lg border border-line bg-card px-3 text-ink"
				type="date"
				name="effectiveFrom"
				bind:value={effectiveFrom}
				required
			/>
		</label>
		<div class="flex flex-wrap gap-2">
			<button
				class={suggestion}
				type="button"
				aria-pressed={effectiveFrom === today}
				onclick={() => (effectiveFrom = today)}>Aujourd'hui</button
			>
			<button
				class={suggestion}
				type="button"
				aria-pressed={effectiveFrom === monday}
				onclick={() => (effectiveFrom = monday)}>Prochain lundi</button
			>
			<button
				class={suggestion}
				type="button"
				aria-pressed={effectiveFrom === comingMonth}
				onclick={() => (effectiveFrom = comingMonth)}>Mois prochain</button
			>
		</div>
		<p class="text-label text-muted">
			À l’enregistrement, les créneaux cochés remplacent le planning à partir de cette date (18 mois,
			hors équipe exclus). Les cases décochées sont retirées.
		</p>
	</div>

	{#if history.length > 0}
		<section class="grid gap-2">
			<h3 class="text-body font-bold text-ink">Historique des semaines types</h3>
			<ul class="m-0 grid list-none gap-1 p-0">
				{#each history as version (version.id)}
					<li>
						<button
							class="grid w-full cursor-pointer gap-0.5 rounded-lg border border-line bg-canvas px-3 py-2 text-left hover:bg-card"
							type="button"
							onclick={() => loadVersion(version)}
						>
							<span class="text-label font-bold text-ink"
								>À partir du {formatLong(version.effectiveFrom)}</span
							>
							<span class="text-label text-muted">{formatPreferenceSlots(version.slots)}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<fieldset class="grid gap-2 border-0 p-0">
		<legend class="text-body font-bold text-ink">Prise de poste</legend>
		<p class="text-label text-muted">
			Plusieurs périodes possibles. En dehors, les cases de la ligne sont grisées. Un mois sans
			période n’affiche pas la personne.
		</p>
		{#each periods as period (period.key)}
			<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-end gap-2">
				<label class="grid gap-1">
					<span class="text-label text-muted">Début</span>
					<input
						class="h-10 rounded-lg border border-line bg-card px-3 text-ink"
						type="date"
						name="startsOn"
						bind:value={period.startsOn}
					/>
				</label>
				<label class="grid gap-1">
					<span class="text-label text-muted">Fin</span>
					<input
						class="h-10 rounded-lg border border-line bg-card px-3 text-ink"
						type="date"
						name="endsOn"
						bind:value={period.endsOn}
					/>
				</label>
				<button
					class="grid size-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-canvas hover:text-ink"
					type="button"
					aria-label="Retirer la période"
					onclick={() => (periods = periods.filter((item) => item.key !== period.key))}
				>
					<Icon icon={x} class="size-4" />
				</button>
			</div>
		{/each}
		<button
			class="inline-flex h-10 cursor-pointer items-center gap-2 justify-self-start rounded-lg px-3 text-label text-accent"
			type="button"
			onclick={() =>
				(periods = [...periods, { startsOn: '', endsOn: '', key: crypto.randomUUID() }])}
		>
			<Icon icon={plus} class="size-4" />
			Ajouter une période
		</button>
	</fieldset>

	{#if error}
		<p class="rounded-lg bg-alert/10 px-3 py-2 text-label text-alert">{error}</p>
	{/if}

	<button
		class="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-accent text-body font-bold text-card disabled:cursor-wait"
		type="submit"
		disabled={saving || inviting || removing}
	>
		Enregistrer
	</button>

	{#if isSelf}
		<p class="text-label text-muted">Vous ne pouvez pas supprimer votre propre compte.</p>
	{:else}
		<button
			class="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-alert bg-transparent text-body font-bold text-alert hover:bg-alert/10 disabled:cursor-wait"
			type="submit"
			formaction="?/remove&mois={month}"
			formnovalidate
			disabled={saving || inviting || removing}
		>
			{removing ? 'Suppression…' : 'Supprimer le compte'}
		</button>
	{/if}
</form>
