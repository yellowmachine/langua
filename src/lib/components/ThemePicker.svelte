<script lang="ts">
	import { themeStore, THEMES, type ThemeId } from '$lib/theme.svelte';

	let {
		onPersist
	}: { onPersist?: (state: { theme: ThemeId; dark: boolean; highContrast: boolean }) => void } =
		$props();

	function persist() {
		onPersist?.({
			theme: themeStore.id,
			dark: themeStore.dark,
			highContrast: themeStore.highContrast
		});
	}

	function selectTheme(id: ThemeId, dark: boolean) {
		themeStore.set(id);
		themeStore.setDark(dark);
		persist();
	}

	function toggleHighContrast() {
		themeStore.setHighContrast(!themeStore.highContrast);
		persist();
	}

	function isActive(id: ThemeId, dark: boolean) {
		return themeStore.id === id && themeStore.dark === dark;
	}
</script>

<div class="grid grid-cols-4 gap-3">
	{#each THEMES as theme (theme.id)}
		<div class="flex flex-col gap-1">
			<div class="flex overflow-hidden rounded-md border" style:border-color="var(--color-border)">
				<button
					type="button"
					title="{theme.label} · claro"
					aria-pressed={isActive(theme.id, false)}
					onclick={() => selectTheme(theme.id, false)}
					class="relative h-9 w-1/2 border-r"
					style:border-color="var(--color-border)"
					style:background-color={theme.light.bg}
					style:outline={isActive(theme.id, false) ? `2px solid ${theme.light.accent}` : 'none'}
					style:outline-offset="-2px"
				>
					<span
						class="absolute right-1 bottom-1 h-2 w-2 rounded-full"
						style:background-color={theme.light.accent}
					></span>
				</button>
				<button
					type="button"
					title="{theme.label} · oscuro"
					aria-pressed={isActive(theme.id, true)}
					onclick={() => selectTheme(theme.id, true)}
					class="relative h-9 w-1/2"
					style:background-color={theme.dark.bg}
					style:outline={isActive(theme.id, true) ? `2px solid ${theme.dark.accent}` : 'none'}
					style:outline-offset="-2px"
				>
					<span
						class="absolute right-1 bottom-1 h-2 w-2 rounded-full"
						style:background-color={theme.dark.accent}
					></span>
				</button>
			</div>
			<p class="text-center text-xs" style:color="var(--color-ink-muted)">{theme.label}</p>
		</div>
	{/each}
</div>

<div
	class="mt-4 flex items-center justify-between border-t pt-3"
	style:border-color="var(--color-border)"
>
	<span class="text-sm">Alto contraste</span>
	<button
		type="button"
		role="switch"
		aria-checked={themeStore.highContrast}
		aria-label="Alto contraste"
		onclick={toggleHighContrast}
		class="relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors"
		style:border-color="var(--color-border)"
		style:background-color={themeStore.highContrast ? 'var(--color-accent)' : 'var(--color-ui)'}
	>
		<span
			class="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform"
			class:translate-x-4={themeStore.highContrast}
			class:translate-x-0.5={!themeStore.highContrast}
		></span>
	</button>
</div>
