<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head>
	<title>Mot de passe — Planning</title>
</svelte:head>

<div class="col-span-full grid min-h-0 grid-rows-[1fr_auto_1fr] overflow-auto">
	{#if !data.valid}
		<div
			class="row-start-2 grid w-full max-w-[420px] justify-self-center gap-3 rounded-xl bg-card p-6 shadow-sm"
		>
			<h1 class="text-title font-bold text-ink">Lien invalide</h1>
			<p class="text-body text-muted">
				Ce lien d’accès a expiré ou a déjà été utilisé. Demandez un nouvel envoi à un administrateur.
			</p>
			<a class="text-body font-bold text-accent no-underline" href="/login">Retour à la connexion</a>
		</div>
	{:else}
		<form
			class="row-start-2 grid w-full max-w-[420px] justify-self-center gap-3 rounded-xl bg-card p-6 shadow-sm"
			method="POST"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					pending = false;
					await update();
				};
			}}
		>
			<div class="grid gap-1">
				<h1 class="text-title font-bold text-ink">Mot de passe</h1>
				<p class="text-label text-muted">
					{data.displayName} · choisissez un mot de passe pour accéder au planning
				</p>
			</div>

			{#if form?.error}
				<p class="rounded-lg bg-alert/10 px-3 py-2 text-body text-alert">{form.error}</p>
			{/if}

			<input type="hidden" name="token" value={data.token} />

			<label class="grid gap-1">
				<span class="text-label text-muted">Nouveau mot de passe</span>
				<input
					class="h-11 rounded-lg border border-line bg-card px-3 text-ink"
					name="password"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					maxlength="200"
				/>
			</label>

			<label class="grid gap-1">
				<span class="text-label text-muted">Confirmation</span>
				<input
					class="h-11 rounded-lg border border-line bg-card px-3 text-ink"
					name="confirm"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					maxlength="200"
				/>
			</label>

			<button
				class="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-accent px-3 text-body font-bold text-card hover:bg-ink disabled:cursor-wait"
				type="submit"
				disabled={pending}
			>
				{pending ? 'Enregistrement…' : 'Enregistrer'}
			</button>
		</form>
	{/if}
</div>
