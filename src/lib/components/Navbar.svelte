<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { user }: { user: { name: string; role: string } } = $props();

	const links = $derived([
		{ href: resolve('/chat'), label: 'Chat' },
		{ href: resolve('/listen'), label: 'Escuchar' },
		{ href: resolve('/study'), label: 'Estudio' },
		{ href: resolve('/translate'), label: 'Traducir' },
		{ href: resolve('/correct'), label: 'Corregir' },
		{ href: resolve('/speak'), label: 'Hablar' },
		{ href: resolve('/progress'), label: 'Progreso' },
		{ href: resolve('/account'), label: 'Mi cuenta' },
		...(user.role === 'admin' ? [{ href: resolve('/settings'), label: 'Ajustes' }] : [])
	]);

	let menuOpen = $state(false);

	function isActive(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<header
	class="sticky top-0 z-10 border-b"
	style:border-color="var(--color-border)"
	style:background-color="var(--color-surface)"
>
	<div class="mx-auto flex max-w-4xl items-center gap-3 px-6 py-3">
		<a
			href={resolve('/dashboard')}
			class="text-base font-semibold"
			style:color="var(--color-accent)"
		>
			Langua
		</a>

		<nav class="hidden flex-1 flex-wrap items-center gap-1 text-sm sm:flex">
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

		<form method="POST" action="/logout" class="hidden sm:block">
			<button
				type="submit"
				class="rounded-md border px-3 py-1.5 text-sm"
				style:border-color="var(--color-border)"
			>
				Cerrar sesión
			</button>
		</form>

		<button
			type="button"
			class="ml-auto flex h-9 w-9 items-center justify-center rounded-md border sm:hidden"
			style:border-color="var(--color-border)"
			aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
			aria-expanded={menuOpen}
			aria-controls="mobile-menu"
			onclick={() => (menuOpen = !menuOpen)}
		>
			<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				{#if menuOpen}
					<path
						stroke-width="2"
						stroke-linecap="round"
						d="M6 6l12 12M18 6L6 18"
						style:color="var(--color-ink)"
					/>
				{:else}
					<path
						stroke-width="2"
						stroke-linecap="round"
						d="M4 7h16M4 12h16M4 17h16"
						style:color="var(--color-ink)"
					/>
				{/if}
			</svg>
		</button>
	</div>

	{#if menuOpen}
		<nav
			id="mobile-menu"
			class="flex flex-col gap-1 border-t px-6 py-3 text-sm sm:hidden"
			style:border-color="var(--color-border)"
		>
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="rounded-md px-2.5 py-2"
					style:background-color={isActive(link.href) ? 'var(--color-background)' : 'transparent'}
					style:font-weight={isActive(link.href) ? '600' : '400'}
					onclick={() => (menuOpen = false)}
				>
					{link.label}
				</a>
			{/each}

			<div
				class="mt-2 flex items-center justify-between border-t pt-3"
				style:border-color="var(--color-border)"
			>
				<span class="text-sm" style:color="var(--color-ink-muted)">{user.name}</span>

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
		</nav>
	{/if}
</header>
