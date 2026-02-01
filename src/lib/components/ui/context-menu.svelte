<script lang="ts">
	import { icons } from '$lib/components/icons';

	// Props
	let {
		x,
		y,
		items,
		onClose
	}: {
		x: number;
		y: number;
		items: ContextMenuItem[];
		onClose: () => void;
	} = $props();

	export interface ContextMenuItem {
		label: string;
		icon?: string;
		action: () => void;
		disabled?: boolean;
		separator?: boolean;
	}

	// Adjust position to keep menu in viewport
	let menuEl: HTMLDivElement;
	let menuRect = $state<DOMRect | null>(null);

	// Compute adjusted positions reactively
	let adjustedX = $derived.by(() => {
		if (!menuRect) return x;
		const viewportWidth = window.innerWidth;
		if (x + menuRect.width > viewportWidth - 10) {
			return viewportWidth - menuRect.width - 10;
		}
		return x;
	});

	let adjustedY = $derived.by(() => {
		if (!menuRect) return y;
		const viewportHeight = window.innerHeight;
		if (y + menuRect.height > viewportHeight - 10) {
			return viewportHeight - menuRect.height - 10;
		}
		return y;
	});

	$effect(() => {
		if (menuEl) {
			menuRect = menuEl.getBoundingClientRect();
		}
	});

	// Handle item click
	function handleItemClick(item: ContextMenuItem) {
		if (item.disabled) return;
		item.action();
		onClose();
	}

	// Handle backdrop click
	function handleBackdropClick() {
		onClose();
	}

	// Handle escape key
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	// Set up keyboard listener
	$effect(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="context-menu-backdrop" onclick={handleBackdropClick}>
	<div
		class="context-menu"
		bind:this={menuEl}
		style:left="{adjustedX}px"
		style:top="{adjustedY}px"
		onclick={(e) => e.stopPropagation()}
		role="menu"
		tabindex="-1"
	>
		{#each items as item}
			{#if item.separator}
				<div class="separator"></div>
			{:else}
				<button
					class="menu-item"
					class:disabled={item.disabled}
					onclick={() => handleItemClick(item)}
					disabled={item.disabled}
					role="menuitem"
				>
					{#if item.icon}
						<span class="item-icon">{item.icon}</span>
					{/if}
					<span class="item-label">{item.label}</span>
				</button>
			{/if}
		{/each}
	</div>
</div>

<style>
	.context-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
	}

	.context-menu {
		position: fixed;
		min-width: 160px;
		padding: var(--space-1);
		background-color: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 1001;
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
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		transition: background-color var(--transition-fast);
	}

	.menu-item:hover:not(.disabled) {
		background-color: var(--accent-muted);
	}

	.menu-item.disabled {
		color: var(--text-muted);
		cursor: not-allowed;
	}

	.item-icon {
		flex-shrink: 0;
		width: 16px;
		text-align: center;
	}

	.item-label {
		flex: 1;
	}

	.separator {
		height: 1px;
		margin: var(--space-1) var(--space-2);
		background-color: var(--border);
	}
</style>
