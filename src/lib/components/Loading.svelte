<script lang="ts">
	import { navigating } from '$app/state';
</script>

{#if navigating.to}
	<div
		class="fixed inset-0 z-[60] grid place-items-center bg-canvas"
		role="status"
		aria-live="polite"
		aria-busy="true"
	>
		<p class="inline-flex items-center gap-3 text-body text-ink">
			<span
				class="size-5 animate-spin rounded-full border-2 border-line border-t-accent"
				aria-hidden="true"
			></span>
			Chargement
		</p>
	</div>
{/if}
