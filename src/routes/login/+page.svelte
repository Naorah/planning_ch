<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '@iconify/svelte';
	import logIn from '@iconify-icons/lucide/log-in';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head>
	<title>Connexion — Planning</title>
</svelte:head>

<div class="col-span-full grid min-h-0 grid-rows-[1fr_auto_1fr] overflow-auto">
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
			<h1 class="text-title font-bold text-ink">Connexion</h1>
			<p class="text-label text-muted">Planning des gardes</p>
		</div>

		{#if form?.error}
			<p class="rounded-lg bg-alert/10 px-3 py-2 text-body text-alert">{form.error}</p>
		{/if}

		<label class="grid gap-1">
			<span class="text-label text-muted">Identifiant</span>
			<input
				class="h-11 rounded-lg border border-line bg-card px-3 text-ink"
				name="login"
				autocomplete="username"
				required
			/>
		</label>

		<label class="grid gap-1">
			<span class="text-label text-muted">Mot de passe</span>
			<input
				class="h-11 rounded-lg border border-line bg-card px-3 text-ink"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</label>

		<button
			class="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-3 text-body font-bold text-card hover:bg-ink disabled:cursor-wait"
			type="submit"
			disabled={pending}
		>
			<Icon icon={logIn} class="size-4" />
			{pending ? 'Connexion…' : 'Se connecter'}
		</button>
	</form>
</div>
