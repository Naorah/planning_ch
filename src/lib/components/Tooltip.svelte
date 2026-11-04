<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		text: string;
		class?: string;
		children: Snippet;
	};

	let { text, class: className = 'inline-flex max-w-full', children }: Props = $props();
</script>

{#if text.trim()}
	<span class="group relative {className}">
		{@render children()}
		<span
			role="tooltip"
			class="pointer-events-none absolute bottom-full left-1/2 z-[70] mb-1 hidden w-max max-w-[14rem] -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-left text-[11px] leading-snug text-card shadow-sm group-hover:block"
		>
			{text.trim()}
		</span>
	</span>
{:else}
	<span class={className}>{@render children()}</span>
{/if}
