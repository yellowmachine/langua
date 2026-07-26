<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { user }: { user: { name: string; role: string } } = $props();

	const links = $derived([
		{ href: resolve('/chat'), label: 'Chat' },
		{ href: resolve('/listen'), label: 'Escuchar' },
		{ href: resolve('/progress'), label: 'Progreso' },
		...(user.role === 'admin'
			? [
					{ href: resolve('/family'), label: 'Familia' },
					{ href: resolve('/settings'), label: 'Ajustes' }
				]
			: [])
	]);

	function isActive(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<header
	class="sticky top-0 z-10 border-b"
	style:border-color="var(--color-border)"
	style:background-color="var(--color-surface)"
>
	<div class="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-6 py-3">
		<a
			href={resolve('/dashboard')}
			class="text-base font-semibold"
			style:color="var(--color-accent)"
		>
			Langua
		</a>

		<nav class="flex flex-1 flex-wrap items-center gap-1 text-sm">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="rounded-md px-2.5 py-1.5"
					style:background-color={isActive(link.href) ? 'var(--color-background)' : 'transparent'}
					style:font-weight={isActive(link.href) ? '600' : '400'}
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<span class="hidden text-sm sm:inline" style:color="var(--color-ink-muted)">{user.name}</span>

		<form method="POST" action="/logout">
			<button
				type="submit"
				class="rounded-md border px-3 py-1.5 text-sm"
				style:border-color="var(--color-border)"
			>
				Cerrar sesión
			</button>
		</form>
	</div>
</header>
