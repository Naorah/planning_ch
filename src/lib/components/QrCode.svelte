<script lang="ts">
	import { encode } from 'uqr';

	let { value }: { value: string } = $props();

	const code = $derived(encode(value, { ecc: 'M', border: 2 }));
</script>

<svg
	class="size-48 bg-card text-ink"
	viewBox="0 0 {code.size} {code.size}"
	shape-rendering="crispEdges"
	role="img"
	aria-label="Code de la page de connexion"
>
	{#each code.data as row, y (y)}
		{#each row as cell, x (x)}
			{#if cell}
				<rect {x} {y} width="1" height="1" fill="currentColor" />
			{/if}
		{/each}
	{/each}
</svg>
