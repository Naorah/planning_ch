<script lang="ts">
	import PlanningBoard from '#lib/components/PlanningBoard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.label} — Planning</title>
</svelte:head>

{#key data.month}
	<PlanningBoard
		month={data.month}
		label={data.label}
		prev={data.prev}
		next={data.next}
		days={data.days}
		people={data.people}
		services={data.services}
		viewerId={data.viewerId}
		focusDate={data.focusDate}
		admin={data.admin}
		notice={form?.error ?? ''}
	/>
{/key}
