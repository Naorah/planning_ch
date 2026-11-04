<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import Loading from '#lib/components/Loading.svelte';
	import ShareSite from '#lib/components/ShareSite.svelte';
	import Icon from '@iconify/svelte';
	import logOut from '@iconify-icons/lucide/log-out';
	import type { LayoutProps } from './$types';
	import '../app.css';

	let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Planning</title>
</svelte:head>

<Loading />

<div
	class="grid w-full grid-cols-4 gap-3 p-3 min-[900px]:grid-cols-12 min-[900px]:px-6 {data.user
		? 'min-h-dvh content-start'
		: 'h-dvh grid-rows-[auto_minmax(0,1fr)] content-stretch'}"
>
	<header class="col-span-full flex h-12 items-center gap-3 border-b border-line">
		<ShareSite />
		<a class="text-body font-bold text-ink no-underline" href={data.user ? '/planning' : '/login'}
			>Planning</a
		>
		{#if data.user}
			<p class="min-w-0 truncate text-label text-muted">{data.user.displayName}</p>
			<form class="ml-auto" method="POST" action="/logout">
				<button
					class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 text-label whitespace-nowrap text-ink hover:bg-canvas"
					type="submit"
				>
					<Icon icon={logOut} class="size-4" />
					Déconnexion
				</button>
			</form>
		{/if}
	</header>
	{@render children()}
</div>
