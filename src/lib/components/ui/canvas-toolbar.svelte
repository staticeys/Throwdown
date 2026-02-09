<script lang="ts">
	import { icons } from '$lib/components/icons';
	import FilterBar from './filter-bar.svelte';

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
	let showAddMenu = $state(false);

	// Handle add menu item click
	function handleAddMenuItem(action: () => void) {
		action();
		showAddMenu = false;
	}

	// Prevent canvas interactions when clicking the toolbar
	function stopPropagation(e: MouseEvent) {
		e.stopPropagation();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="canvas-toolbar" onmousedown={stopPropagation} onclick={stopPropagation}>
	<!-- Add node dropdown -->
	<div class="add-menu-container">
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
			<div class="menu-backdrop" onclick={() => (showAddMenu = false)}></div>
			<div class="dropdown-menu">
				<button class="menu-item" onclick={() => handleAddMenuItem(onAddText)}>
					<span class="menu-icon">{icons.text}</span>
					<span>Text</span>
				</button>
				<button class="menu-item" onclick={() => handleAddMenuItem(onAddLink)}>
					<span class="menu-icon">{icons.link}</span>
					<span>Link</span>
				</button>
				<button class="menu-item" onclick={() => handleAddMenuItem(onAddGroup)}>
					<span class="menu-icon">{icons.canvas}</span>
					<span>Group</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Search/filter bar -->
	<FilterBar />
</div>

<style>
	.canvas-toolbar {
		position: absolute;
		top: var(--space-3);
		left: var(--space-3);
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1);
		background-color: var(--bg-surface);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		opacity: var(--panel-opacity);
		z-index: 10;
	}

	.toolbar-btn {
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

	.toolbar-btn:hover {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.toolbar-btn.active {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	/* Add node dropdown */
	.add-menu-container {
		position: relative;
	}

	.menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: var(--space-1);
		min-width: 120px;
		background: var(--bg-surface);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 100;
		overflow: hidden;
	}

	.menu-item {
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

	.menu-item:hover {
		background-color: var(--bg-elevated);
	}

	.menu-icon {
		width: 16px;
		text-align: center;
		color: var(--text-secondary);
	}

</style>
