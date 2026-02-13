<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';

	// Local state - defaults to off, no persistence
	let showTips = $state(false);

	// Platform detection for modifier key display
	let isMac = $derived(
		typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
	);
	let modKey = $derived(isMac ? '⌘' : 'Ctrl');

	// Derive current state from store
	let selectionCount = $derived(canvasStore.selection.length);
	let isEditing = $derived(canvasStore.isEditingText);

	// Determine which tips to show based on state
	type TipState = 'none' | 'single' | 'multi' | 'editing';
	let tipState = $derived.by<TipState>(() => {
		if (isEditing) return 'editing';
		if (selectionCount === 0) return 'none';
		if (selectionCount === 1) return 'single';
		return 'multi';
	});

	// Tips content for each state
	interface Tip {
		text: string;
	}

	let tips = $derived.by<Tip[]>(() => {
		switch (tipState) {
			case 'none':
				return [
					{ text: 'Double-click to create text node' },
					{ text: 'Right-click for link/group nodes' },
					{ text: canvasStore.inputMode === 'trackpad'
						? 'Scroll to pan, pinch to zoom'
						: 'Scroll to zoom, right-drag to pan' },
					{ text: 'Drag empty space to box select' },
					{ text: `${modKey}+V to paste text node` }
				];
			case 'single':
				return [
					{ text: 'Backspace to delete' },
					{ text: `${modKey}+click to multi-select` },
					{ text: 'Drag corner to resize' },
					{ text: `${modKey}+C to copy contents` },
					{ text: '1-6 to set color, 0 to clear' }
				];
			case 'multi':
				return [
					{ text: 'L to link selected nodes' },
					{ text: `${modKey}+G to group nodes` },
					{ text: '1-6 to set color, 0 to clear' }
				];
			case 'editing':
				return [{ text: 'Format with Markdown (see ? for help)' }];
			default:
				return [];
		}
	});
</script>

<div class="tips-container">
	{#if showTips && tips.length > 0}
		<div class="tips-card">
			{#each tips as tip}
				<div class="tip">{tip.text}</div>
			{/each}
		</div>
	{/if}

	<label class="tips-toggle">
		<input type="checkbox" bind:checked={showTips} />
		<span class="toggle-label">Tips</span>
	</label>
</div>

<style>
	.tips-container {
		position: fixed;
		bottom: 20px;
		left: 20px;
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.tips-card {
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-3);
		box-shadow: var(--shadow-xs);
		max-width: 280px;
		opacity: var(--panel-opacity);
	}

	.tip {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--text-secondary);
		padding: var(--space-1) 0;
		line-height: 1.4;
	}

	.tip:not(:last-child) {
		border-bottom: 1px solid var(--border);
	}

	.tips-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		user-select: none;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-2);
		transition: background-color var(--transition-fast);
	}

	.tips-toggle:hover {
		background: var(--bg-elevated);
	}

	.tips-toggle input {
		margin: 0;
		cursor: pointer;
	}

	.toggle-label {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--text-secondary);
	}
</style>
