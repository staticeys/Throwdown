<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { icons } from '$lib/components/icons';

	// Local state for editing canvas name
	let editingId = $state<string | null>(null);
	let editValue = $state('');

	// Start editing canvas name
	function startEdit(id: string, name: string) {
		editingId = id;
		editValue = name;
	}

	// Save edited name
	function saveEdit() {
		if (editingId && editValue.trim()) {
			canvasStore.renameCanvas(editingId, editValue.trim());
		}
		editingId = null;
	}

	// Handle key events in edit mode
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
		} else if (e.key === 'Escape') {
			editingId = null;
		}
	}

</script>

<div class="canvas-tabs">
	<div class="tabs-scroll">
		{#each canvasStore.canvasNames as { id, name } (id)}
			{@const isActive = id === canvasStore.activeCanvasId}
			{@const isEditing = editingId === id}

			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="tab"
				class:active={isActive}
				onclick={() => canvasStore.switchCanvas(id)}
				ondblclick={() => startEdit(id, name)}
			>
				{#if isEditing}
					<input
						type="text"
						class="tab-input"
						bind:value={editValue}
						onblur={saveEdit}
						onkeydown={handleKeyDown}
						onclick={(e) => e.stopPropagation()}
					/>
				{:else}
					<span class="tab-name">{name}</span>
				{/if}

				{#if canvasStore.canvasNames.length > 1}
					<button
						class="tab-close"
						onclick={(e) => {
							e.stopPropagation();
							canvasStore.deleteCanvasById(id);
						}}
						title="Close canvas"
					>
						{icons.close}
					</button>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.canvas-tabs {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background-color: var(--bg-app);
		overflow: hidden;
	}

	.tabs-scroll {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		overflow-x: auto;
		flex: 1;
	}

	.tabs-scroll::-webkit-scrollbar {
		display: none;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		background-color: transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--transition-fast);
	}

	.tab:hover {
		background-color: var(--bg-surface);
	}

	.tab.active {
		color: var(--text-primary);
		background-color: var(--bg-surface);
	}

	.tab-name {
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tab-input {
		width: 100px;
		padding: 0 var(--space-1);
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--text-primary);
		background: var(--bg-elevated);
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		outline: none;
	}

	.tab-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		font-size: 12px;
		color: var(--text-muted);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
	}

	.tab:hover .tab-close {
		opacity: 1;
	}

	.tab-close:hover {
		color: var(--destructive);
		background-color: var(--bg-elevated);
	}

</style>
