<script lang="ts">
	import Icon from '@iconify/svelte';
	import x from '@iconify-icons/lucide/x';
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		onclose: () => void;
		children: Snippet;
	};

	let { title, onclose, children }: Props = $props();
	let panel = $state<HTMLDivElement | null>(null);

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	$effect(() => {
		panel?.focus();
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={keydown} />

<div class="fixed inset-0 z-[80]" use:portal>
	<button
		class="absolute inset-0 cursor-default border-0 bg-ink/40"
		type="button"
		aria-label="Fermer"
		onclick={onclose}
	></button>
	<div
		bind:this={panel}
		class="absolute inset-x-0 bottom-0 z-10 grid max-h-[min(85dvh,40rem)] gap-4 overflow-y-auto rounded-t-xl bg-card p-4 shadow-sm min-[900px]:inset-auto min-[900px]:top-1/2 min-[900px]:left-1/2 min-[900px]:w-[min(32rem,calc(100%-2rem))] min-[900px]:-translate-x-1/2 min-[900px]:-translate-y-1/2 min-[900px]:rounded-xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="sheet-title"
		tabindex="-1"
	>
		<header class="flex items-start justify-between gap-3">
			<h2 id="sheet-title" class="min-w-0 text-title text-ink">{title}</h2>
			<button
				class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-canvas hover:text-ink"
				type="button"
				aria-label="Fermer"
				onclick={onclose}
			>
				<Icon icon={x} class="size-4" />
			</button>
		</header>
		{@render children()}
	</div>
</div>
