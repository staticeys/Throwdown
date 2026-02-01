<script lang="ts">
	import { themeStore } from '$lib/stores/theme.svelte';
	import { icons } from '$lib/components/icons';
</script>

<button
	class="theme-toggle"
	onclick={() => themeStore.toggle()}
	title={themeStore.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
	aria-label={themeStore.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
>
	{themeStore.isDark ? icons.sun : icons.moon}
</button>

<style>
	.theme-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		font-size: 16px;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.theme-toggle:hover {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.theme-toggle:active {
		background-color: var(--border);
	}
</style>
