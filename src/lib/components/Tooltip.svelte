<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		text: string;
		children: Snippet;
	};

	let { text, children }: Props = $props();
</script>

{#if text.trim()}
	<span class="group relative inline-flex max-w-full">
		{@render children()}
		<span
			role="tooltip"
			class="pointer-events-none absolute bottom-full left-1/2 z-[70] mb-1 hidden w-max max-w-[14rem] -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-left text-[11px] leading-snug text-card shadow-sm group-hover:block"
		>
			{text.trim()}
		</span>
	</span>
{:else}
	{@render children()}
{/if}
