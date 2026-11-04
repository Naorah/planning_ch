<script lang="ts">
	import { page } from '$app/state';
	import share from '@iconify-icons/lucide/share-2';
	import Icon from '@iconify/svelte';
	import QrCode from '#lib/components/QrCode.svelte';
	import Sheet from '#lib/components/Sheet.svelte';

	let open = $state(false);
	const loginUrl = $derived(new URL('/login', page.url.href).href);
</script>

<button
	class="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 text-label whitespace-nowrap text-ink hover:bg-canvas"
	type="button"
	aria-haspopup="dialog"
	aria-expanded={open}
	onclick={() => (open = true)}
>
	<Icon icon={share} class="size-4" />
	Partager
</button>

{#if open}
	<Sheet title="Partager" onclose={() => (open = false)}>
		<p class="text-label text-muted">Page de connexion</p>
		<QrCode value={loginUrl} />
		<p class="break-all text-body text-ink">{loginUrl}</p>
	</Sheet>
{/if}
