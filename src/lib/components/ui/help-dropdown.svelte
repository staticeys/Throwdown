<script lang="ts">
	import { icons } from '$lib/components/icons';
	import HotkeysOverlay from './hotkeys-overlay.svelte';
	import MarkdownHelpOverlay from './markdown-help-overlay.svelte';

	let showMenu = $state(false);
	let showHotkeys = $state(false);
	let showMarkdownHelp = $state(false);
</script>

<div class="help-container">
	<button
		class="header-btn"
		class:active={showMenu}
		onclick={() => (showMenu = !showMenu)}
		title="Help"
	>
		{icons.help}
	</button>
	{#if showMenu}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="help-backdrop" onclick={() => (showMenu = false)}></div>
		<div class="help-menu">
			<button
				class="help-menu-item"
				onclick={() => { showMenu = false; showMarkdownHelp = true; }}
			>
				<span class="help-menu-icon">{icons.help}</span>
				<span>Markdown Syntax</span>
			</button>
			<button
				class="help-menu-item"
				onclick={() => { showMenu = false; showHotkeys = true; }}
			>
				<span class="help-menu-icon">{icons.keyboard}</span>
				<span>Keyboard Shortcuts</span>
			</button>
		</div>
	{/if}
</div>

{#if showHotkeys}
	<HotkeysOverlay onClose={() => (showHotkeys = false)} />
{/if}

{#if showMarkdownHelp}
	<MarkdownHelpOverlay onClose={() => (showMarkdownHelp = false)} />
{/if}

<style>
	.help-container {
		position: relative;
	}

	.header-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		font-size: var(--font-size-md);
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		flex-shrink: 0;
		transition: all var(--transition-fast);
	}

	.header-btn:hover {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.header-btn.active {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.help-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	.help-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: var(--space-1);
		min-width: 180px;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		z-index: 100;
		overflow: hidden;
	}

	.help-menu-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--text-primary);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color var(--transition-fast);
	}

	.help-menu-item:hover {
		background-color: var(--bg-elevated);
	}

	.help-menu-icon {
		width: 16px;
		text-align: center;
		color: var(--text-secondary);
	}
</style>
