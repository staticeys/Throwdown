<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import type { GroupNode } from '$lib/types/canvas';

	// Props
	let { node }: { node: GroupNode } = $props();

	// Local state
	let isEditing = $state(false);
	// svelte-ignore non_reactive_update
	let inputEl: HTMLInputElement;

	// Start editing label
	export function startEdit() {
		canvasStore.beginTransaction();
		isEditing = true;
		canvasStore.setEditingText(true);
		requestAnimationFrame(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	// Stop editing
	function stopEdit() {
		isEditing = false;
		canvasStore.setEditingText(false);
		canvasStore.endTransaction();
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

	// Handle double-click on label to start editing
	function handleLabelDblClick(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		startEdit();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="group-container">
	<!-- Label positioned outside, above the group -->
	<div class="group-label" ondblclick={handleLabelDblClick}>
		{#if isEditing}
			<input
				type="text"
				class="label-input"
				bind:this={inputEl}
				value={node.label ?? ''}
				oninput={handleInput}
				onkeydown={handleKeyDown}
				onblur={handleBlur}
				placeholder="Group label..."
			/>
		{:else}
			<span class="label-text">{node.label || 'Group'}</span>
		{/if}
	</div>
</div>

<style>
	.group-container {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.group-label {
		position: absolute;
		top: -24px;
		left: 0;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary);
		cursor: text;
		user-select: none;
		z-index: 1;
	}

	.label-text {
		padding: var(--space-0) calc(var(--space-1) + var(--space-0));
		background: var(--bg-surface);
		border-radius: var(--radius-sm);
		white-space: nowrap;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.label-input {
		min-width: 80px;
		max-width: 200px;
		padding: var(--space-0) calc(var(--space-1) + var(--space-0));
		font-family: var(--font-sans);
		font-size: var(--font-size-xs);
		font-weight: 500;
		color: var(--text-primary);
		background: var(--bg-surface);
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		outline: none;
	}

	.label-input:focus {
		box-shadow: 0 0 0 2px var(--accent-muted);
	}
</style>
