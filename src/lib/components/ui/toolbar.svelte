<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { icons } from '$lib/components/icons';
	import { downloadCanvas, openCanvasFile } from '$lib/db/canvas-io';
	import FilterBar from './filter-bar.svelte';
	import HotkeysOverlay from './hotkeys-overlay.svelte';
	import MarkdownHelpOverlay from './markdown-help-overlay.svelte';

	// Props
	let {
		onAddText,
		onAddLink,
		onAddGroup
	}: {
		onAddText: () => void;
		onAddLink: () => void;
		onAddGroup: () => void;
	} = $props();

	// Local state
	let showHotkeys = $state(false);
	let showMarkdownHelp = $state(false);
	let showAddMenu = $state(false);

	// Handle add menu item click
	function handleAddMenuItem(action: () => void) {
		action();
		showAddMenu = false;
	}

	// Handle export
	function handleExport() {
		const canvas = canvasStore.activeCanvas;
		if (canvas) {
			downloadCanvas(canvas);
		}
	}

	// Handle import
	async function handleImport() {
		const canvas = await openCanvasFile();
		if (canvas) {
			canvasStore.importCanvasData(canvas);
		}
	}
</script>

<div class="toolbar">
	<!-- Add dropdown -->
	<div class="toolbar-group add-menu-container">
		<button
			class="toolbar-btn"
			class:active={showAddMenu}
			onclick={() => (showAddMenu = !showAddMenu)}
			title="Add Node"
		>
			{icons.add}
		</button>
		{#if showAddMenu}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="add-menu-backdrop" onclick={() => (showAddMenu = false)}></div>
			<div class="add-menu">
				<button class="add-menu-item" onclick={() => handleAddMenuItem(onAddText)}>
					<span class="add-menu-icon">{icons.text}</span>
					<span>Text</span>
				</button>
				<button class="add-menu-item" onclick={() => handleAddMenuItem(onAddLink)}>
					<span class="add-menu-icon">{icons.link}</span>
					<span>Link</span>
				</button>
				<button class="add-menu-item" onclick={() => handleAddMenuItem(onAddGroup)}>
					<span class="add-menu-icon">{icons.canvas}</span>
					<span>Group</span>
				</button>
			</div>
		{/if}
	</div>

	<div class="toolbar-divider"></div>

	<!-- Filter/Search -->
	<FilterBar />

	<div class="toolbar-spacer"></div>

	<!-- File operations -->
	<div class="toolbar-group">
		<button
			class="toolbar-btn"
			onclick={handleImport}
			title="Import Canvas"
		>
			{icons.import}
		</button>
		<button
			class="toolbar-btn"
			onclick={handleExport}
			title="Export Canvas"
		>
			{icons.export}
		</button>
	</div>

	<div class="toolbar-divider"></div>

	<!-- Help -->
	<div class="toolbar-group">
		<button
			class="toolbar-btn"
			onclick={() => (showMarkdownHelp = true)}
			title="Markdown Syntax"
		>
			{icons.help}
		</button>
		<button
			class="toolbar-btn"
			onclick={() => (showHotkeys = true)}
			title="Keyboard Shortcuts"
		>
			{icons.keyboard}
		</button>
	</div>
</div>

{#if showHotkeys}
	<HotkeysOverlay onClose={() => (showHotkeys = false)} />
{/if}

{#if showMarkdownHelp}
	<MarkdownHelpOverlay onClose={() => (showMarkdownHelp = false)} />
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2);
		background-color: var(--bg-surface);
		border-bottom: 1px solid var(--border);
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.toolbar-btn {
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

	.toolbar-btn:hover:not(:disabled) {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.toolbar-btn:active:not(:disabled) {
		background-color: var(--border);
	}

	.toolbar-btn:disabled {
		color: var(--text-muted);
		cursor: not-allowed;
		opacity: 0.5;
	}

	.toolbar-divider {
		width: 1px;
		height: 20px;
		margin: 0 var(--space-1);
		background-color: var(--border);
	}

	.toolbar-spacer {
		flex: 1;
	}

	/* Add menu dropdown */
	.add-menu-container {
		position: relative;
	}

	.toolbar-btn.active {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.add-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	.add-menu {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: var(--space-1);
		min-width: 120px;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		z-index: 100;
		overflow: hidden;
	}

	.add-menu-item {
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

	.add-menu-item:hover {
		background-color: var(--bg-elevated);
	}

	.add-menu-icon {
		width: 16px;
		text-align: center;
		color: var(--text-secondary);
	}
</style>
