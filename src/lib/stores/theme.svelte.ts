import { saveSetting, loadSetting } from '$lib/db/indexed-db';

type Theme = 'light' | 'dark';

class ThemeStore {
	theme = $state<Theme>('light');
	isLoaded = $state(false);

	get isDark(): boolean {
		return this.theme === 'dark';
	}

	async init(): Promise<void> {
		// Try to load saved preference
		const saved = await loadSetting<Theme>('theme');

		if (saved) {
			this.theme = saved;
		} else {
			// Check system preference
			if (typeof window !== 'undefined') {
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				this.theme = prefersDark ? 'dark' : 'light';
			}
		}

		this.applyTheme();
		this.isLoaded = true;
	}

	private applyTheme(): void {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', this.theme);
		}
	}

	toggle(): void {
		this.theme = this.theme === 'light' ? 'dark' : 'light';
		this.applyTheme();
		saveSetting('theme', this.theme);
	}

	setTheme(theme: Theme): void {
		this.theme = theme;
		this.applyTheme();
		saveSetting('theme', this.theme);
	}
}

export const themeStore = new ThemeStore();
