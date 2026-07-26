export type ThemeId = 'warm' | 'ocean' | 'forest' | 'slate';

export interface ThemeDef {
	id: ThemeId;
	label: string;
	light: { bg: string; ui: string; accent: string };
	dark: { bg: string; ui: string; accent: string };
}

export const THEMES: ThemeDef[] = [
	{
		id: 'warm',
		label: 'Cálido',
		light: { bg: '#f9f7f4', ui: '#f0ede8', accent: '#7c5c3e' },
		dark: { bg: '#1a1917', ui: '#141311', accent: '#c4996b' }
	},
	{
		id: 'ocean',
		label: 'Océano',
		light: { bg: '#f4f9fb', ui: '#e6f1f5', accent: '#0e7490' },
		dark: { bg: '#0b1a20', ui: '#0f2530', accent: '#22d3ee' }
	},
	{
		id: 'forest',
		label: 'Bosque',
		light: { bg: '#f5f8f3', ui: '#e8f0e3', accent: '#3f7d3a' },
		dark: { bg: '#131a10', ui: '#182219', accent: '#7bc96f' }
	},
	{
		id: 'slate',
		label: 'Pizarra',
		light: { bg: '#f6f7f8', ui: '#eceef1', accent: '#475569' },
		dark: { bg: '#15181c', ui: '#1c2127', accent: '#94a3b8' }
	}
];

const STORAGE_THEME = 'langua-theme';
const STORAGE_DARK = 'langua-dark';
const STORAGE_CONTRAST = 'langua-high-contrast';

function isThemeId(value: string | null): value is ThemeId {
	return THEMES.some((theme) => theme.id === value);
}

function applyToDOM(id: ThemeId, dark: boolean, highContrast: boolean) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.setAttribute('data-theme', id);
	root.classList.toggle('dark', dark);
	root.classList.toggle('high-contrast', highContrast);
}

class ThemeStore {
	id = $state<ThemeId>('warm');
	dark = $state(false);
	highContrast = $state(false);

	/** Call once on mount with values from localStorage / the account. */
	init(id: ThemeId, dark: boolean, highContrast: boolean) {
		this.id = id;
		this.dark = dark;
		this.highContrast = highContrast;
		applyToDOM(id, dark, highContrast);
	}

	/** Reads whatever the anti-flash inline script in app.html already applied. */
	initFromDOM() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		const id = root.getAttribute('data-theme');
		this.id = isThemeId(id) ? id : 'warm';
		this.dark = root.classList.contains('dark');
		this.highContrast = root.classList.contains('high-contrast');
	}

	set(id: ThemeId) {
		this.id = id;
		localStorage.setItem(STORAGE_THEME, id);
		applyToDOM(id, this.dark, this.highContrast);
	}

	setDark(dark: boolean) {
		this.dark = dark;
		localStorage.setItem(STORAGE_DARK, dark ? '1' : '0');
		applyToDOM(this.id, dark, this.highContrast);
	}

	setHighContrast(highContrast: boolean) {
		this.highContrast = highContrast;
		localStorage.setItem(STORAGE_CONTRAST, highContrast ? '1' : '0');
		applyToDOM(this.id, this.dark, highContrast);
	}
}

export const themeStore = new ThemeStore();
