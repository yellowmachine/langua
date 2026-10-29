<script lang="ts">
	import type { Component } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import Headphones from '@lucide/svelte/icons/headphones';
	import Languages from '@lucide/svelte/icons/languages';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Mic from '@lucide/svelte/icons/mic';
	import SpellCheck from '@lucide/svelte/icons/spell-check';

	let { user }: { user: { name: string } } = $props();

	type NavLink = {
		href: ReturnType<typeof resolve>;
		label: string;
		icon: Component<{ class?: string }>;
	};

	const links: NavLink[] = [
		{ href: resolve('/chat'), label: 'Chat', icon: MessageCircle },
		{ href: resolve('/listen'), label: 'Escuchar', icon: Headphones },
		{ href: resolve('/clips'), label: 'Clips', icon: Clapperboard },
		{ href: resolve('/study'), label: 'Estudio', icon: BookOpen },
		{ href: resolve('/translate'), label: 'Traducir', icon: Languages },
		{ href: resolve('/correct'), label: 'Corregir', icon: SpellCheck },
		{ href: resolve('/speak'), label: 'Hablar', icon: Mic },
		{ href: resolve('/progress'), label: 'Progreso', icon: ChartLine },
		{ href: resolve('/account'), label: 'Mi cuenta', icon: CircleUser }
	];

	let menuOpen = $state(false);

	function isActive(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	// On wide screens the menu is icons only, so the account link is also
	// where the user's name shows up (it used to be plain text next to it).
	function tooltipFor(link: NavLink) {
		return link.href === resolve('/account') ? `${link.label} (${user.name})` : link.label;
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

		<nav class="hidden flex-1 items-center gap-1 sm:flex">
			{#each links as link (link.href)}
				<a
					href={link.href}
					aria-label={tooltipFor(link)}
					aria-current={isActive(link.href) ? 'page' : undefined}
					class="group relative flex h-9 w-9 items-center justify-center rounded-md"
					style:background-color={isActive(link.href) ? 'var(--color-background)' : 'transparent'}
					style:color={isActive(link.href) ? 'var(--color-accent)' : 'var(--color-ink)'}
				>
					<link.icon class="h-5 w-5" />
					{@render tooltip(tooltipFor(link), 'center')}
				</a>
			{/each}
		</nav>

		<form method="POST" action="/logout" class="hidden sm:block">
			<button
				type="submit"
				aria-label="Cerrar sesión"
				class="group relative flex h-9 w-9 items-center justify-center rounded-md border"
				style:border-color="var(--color-border)"
			>
				<LogOut class="h-5 w-5" />
				{@render tooltip('Cerrar sesión', 'end')}
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
					aria-current={isActive(link.href) ? 'page' : undefined}
					class="flex items-center gap-3 rounded-md px-2.5 py-2"
					style:background-color={isActive(link.href) ? 'var(--color-background)' : 'transparent'}
					style:font-weight={isActive(link.href) ? '600' : '400'}
					onclick={() => (menuOpen = false)}
				>
					<link.icon class="h-4 w-4" />
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
						class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
						style:border-color="var(--color-border)"
					>
						<LogOut class="h-4 w-4" />
						Cerrar sesión
					</button>
				</form>
			</div>
		</nav>
	{/if}
</header>

<!-- Shown on hover and on keyboard focus; screen readers get the aria-label instead. -->
{#snippet tooltip(text: string, align: 'center' | 'end')}
	<span
		aria-hidden="true"
		class={[
			'pointer-events-none absolute top-full z-20 mt-1.5 rounded-md px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
			align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'
		]}
		style:background-color="var(--color-ink)"
		style:color="var(--color-surface)"
	>
		{text}
	</span>
{/snippet}
