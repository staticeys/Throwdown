<script lang="ts">
	import { untrack } from 'svelte';
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { loadFileFromOPFS } from '$lib/platform/fs-opfs';
	import type { GroupNode } from '$lib/types/canvas';

	// Props
	let { node }: { node: GroupNode } = $props();

	// Local state
	let isEditing = $state(false);
	// svelte-ignore non_reactive_update
	let inputEl: HTMLInputElement;

	// Background image state — derived key isolates background from x/y/size changes
	let bgObjectUrl = $state<string | null>(null);
	let backgroundKey = $derived(node.background);

	// Load background image from OPFS — only re-runs when background filename changes
	$effect(() => {
		const background = backgroundKey;
		if (!background) {
			bgObjectUrl = null;
			return;
		}

		let cancelled = false;
		const nodeId = untrack(() => node.id);

		async function loadBg() {
			try {
				const file = await loadFileFromOPFS(
					canvasStore.activeCanvasId,
					nodeId,
					background
				);
				if (cancelled) return;
				if (file) {
					bgObjectUrl = URL.createObjectURL(file);
				}
			} catch {
				if (!cancelled) bgObjectUrl = null;
			}
		}

		loadBg();

		return () => {
			cancelled = true;
			if (bgObjectUrl) {
				URL.revokeObjectURL(bgObjectUrl);
				bgObjectUrl = null;
			}
		};
	});

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
	{#if bgObjectUrl}
		{#if node.backgroundStyle === 'repeat'}
			<div
				class="group-bg-repeat"
				style:background-image="url({bgObjectUrl})"
			></div>
		{:else}
			<img
				src={bgObjectUrl}
				alt=""
				class="group-bg-image"
				class:bg-cover={node.backgroundStyle !== 'ratio'}
				class:bg-ratio={node.backgroundStyle === 'ratio'}
			/>
		{/if}
	{/if}

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

	.group-bg-image {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.group-bg-image.bg-cover {
		object-fit: cover;
	}

	.group-bg-image.bg-ratio {
		object-fit: contain;
	}

	.group-bg-repeat {
		position: absolute;
		inset: 0;
		background-repeat: repeat;
		background-size: auto;
		pointer-events: none;
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
