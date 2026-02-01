<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { icons } from '$lib/components/icons';
	import type { GroupNode } from '$lib/types/canvas';

	// Props
	let { node }: { node: GroupNode } = $props();

	// Local state
	let isEditing = $state(false);
	// svelte-ignore non_reactive_update
	let inputEl: HTMLInputElement;

	// Start editing label
	export function startEdit() {
		isEditing = true;
		requestAnimationFrame(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	// Stop editing
	function stopEdit() {
		isEditing = false;
	}

	// Handle input change
	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		canvasStore.updateNode(node.id, { label: target.value });
	}

	// Handle keydown
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' || e.key === 'Enter') {
			e.preventDefault();
			stopEdit();
		}
		e.stopPropagation();
	}

	// Handle blur
	function handleBlur() {
		stopEdit();
	}

	// Navigate to linked canvas (if any)
	function navigateToCanvas(e: MouseEvent) {
		e.stopPropagation();
		// For now, groups don't navigate anywhere
		// This would be extended to support nested canvases
	}

	// Handle click in edit mode
	function handleClick(e: MouseEvent) {
		if (isEditing) {
			e.stopPropagation();
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="canvas-ref" class:editing={isEditing} onclick={handleClick}>
	<div class="ref-icon">{icons.canvas}</div>

	{#if isEditing}
		<input
			type="text"
			class="ref-input"
			bind:this={inputEl}
			value={node.label ?? ''}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			onblur={handleBlur}
			placeholder="Group label..."
		/>
	{:else}
		<div class="ref-content">
			<div class="ref-label">{node.label || 'Untitled Group'}</div>
			<div class="ref-hint">Group</div>
		</div>
	{/if}
</div>

<style>
	.canvas-ref {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		height: 100%;
		padding: var(--space-2);
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--text-primary);
		background: linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%);
		overflow: hidden;
	}

	.ref-icon {
		flex-shrink: 0;
		font-size: 20px;
		color: var(--text-secondary);
	}

	.ref-content {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.ref-label {
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ref-hint {
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.ref-input {
		flex: 1;
		min-width: 0;
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--text-primary);
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
	}

	.ref-input:focus {
		border-color: var(--accent);
	}
</style>
