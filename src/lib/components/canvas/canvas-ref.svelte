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
		top: -36px;
		left: 0;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-size: 21px;
		font-weight: 600;
		line-height: 1.3;
		color: var(--text-secondary);
		cursor: text;
		user-select: none;
		z-index: 1;
	}

	.label-text {
		white-space: nowrap;
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.label-input {
		min-width: 80px;
		max-width: 300px;
		padding: 0;
		font-family: var(--font-sans);
		font-size: inherit;
		font-weight: inherit;
		line-height: inherit;
		color: var(--text-primary);
		background: transparent;
		border: none;
		border-radius: 0;
		outline: none;
	}

	.label-input:focus {
		outline: none;
	}
</style>
