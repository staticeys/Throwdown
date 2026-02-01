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

	// Derived state
	let hasSelection = $derived(canvasStore.selection.length > 0);
	let hasMultipleSelected = $derived(canvasStore.selection.length > 1);

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
	<!-- Add tools -->
	<div class="toolbar-group">
		<button
			class="toolbar-btn"
			onclick={onAddText}
			title="Add Text (double-click canvas)"
		>
			{icons.text}
		</button>
		<button
			class="toolbar-btn"
			onclick={onAddLink}
			title="Add Link"
		>
			{icons.link}
		</button>
		<button
			class="toolbar-btn"
			onclick={onAddGroup}
			title="Add Group"
		>
			{icons.canvas}
		</button>
	</div>

	<div class="toolbar-divider"></div>

	<!-- Selection actions -->
	<div class="toolbar-group">
		<button
			class="toolbar-btn"
			onclick={() => canvasStore.linkSelectedNodes()}
			disabled={!hasMultipleSelected}
			title="Link Selected (L)"
		>
			{icons.arrow}
		</button>
		<button
			class="toolbar-btn destructive"
			onclick={() => canvasStore.deleteSelectedNodes()}
			disabled={!hasSelection}
			title="Delete Selected (Delete)"
		>
			{icons.trash}
		</button>
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

	.toolbar-btn.destructive:hover:not(:disabled) {
		color: var(--destructive);
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
</style>
