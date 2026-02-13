<script module lang="ts">
	export interface ContextMenuItem {
		label: string;
		icon?: string;
		action: () => void;
		disabled?: boolean;
		separator?: boolean;
		checked?: boolean;
		// Color row: renders a row of color dots instead of a normal item
		colors?: { hex: string; value: string | undefined; active: boolean }[];
		onColorSelect?: (value: string | undefined) => void;
		// Submenu: renders children in a nested panel on hover
		children?: ContextMenuItem[];
	}
</script>

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

	// Adjust position to keep menu in viewport
	let menuEl: HTMLDivElement;
	let menuRect = $state<DOMRect | null>(null);

	// Submenu state
	let activeSubmenuIndex = $state<number | null>(null);
	let submenuTimer = $state<ReturnType<typeof setTimeout> | null>(null);

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

	// Whether the submenu should open to the left (not enough space on the right)
	let submenuFlipLeft = $derived.by(() => {
		if (!menuRect) return false;
		return menuRect.right + 160 > window.innerWidth - 10;
	});

	$effect(() => {
		if (menuEl) {
			menuRect = menuEl.getBoundingClientRect();
		}
	});

	// Handle item click
	function handleItemClick(item: ContextMenuItem) {
		if (item.disabled || item.children) return;
		item.action();
		onClose();
	}

	// Submenu hover handlers
	function handleSubmenuEnter(index: number) {
		if (submenuTimer) clearTimeout(submenuTimer);
		activeSubmenuIndex = index;
	}

	function handleSubmenuLeave() {
		if (submenuTimer) clearTimeout(submenuTimer);
		submenuTimer = setTimeout(() => {
			activeSubmenuIndex = null;
		}, 150);
	}

	function handleSubmenuItemClick(item: ContextMenuItem) {
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
		{#each items as item, i}
			{#if item.colors}
				<div class="color-row" role="menuitem">
					{#each item.colors as c}
						<button
							class="color-dot"
							class:active={c.active}
							class:no-color={c.value === undefined}
							style:background-color={c.value !== undefined ? c.hex : ''}
							onclick={() => { item.onColorSelect?.(c.value); onClose(); }}
							title={c.value !== undefined ? item.label : 'Default'}
						>
							{#if c.value === undefined}
								<svg viewBox="0 0 16 16" width="16" height="16">
									<line x1="3" y1="3" x2="13" y2="13" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" />
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			{:else if item.separator}
				<div class="separator"></div>
			{:else if item.children}
				<!-- Submenu trigger -->
				<div
					class="submenu-wrapper"
					onmouseenter={() => handleSubmenuEnter(i)}
					onmouseleave={handleSubmenuLeave}
				>
					<button
						class="menu-item"
						role="menuitem"
						aria-haspopup="true"
						aria-expanded={activeSubmenuIndex === i}
					>
						{#if item.icon}
							<span class="item-icon">{item.icon}</span>
						{/if}
						<span class="item-label">{item.label}</span>
						<span class="submenu-arrow">▸</span>
					</button>
					{#if activeSubmenuIndex === i}
						<div
							class="context-menu submenu"
							class:flip-left={submenuFlipLeft}
							role="menu"
						>
							{#each item.children as child}
								{#if child.separator}
									<div class="separator"></div>
								{:else}
									<button
										class="menu-item"
										class:disabled={child.disabled}
										onclick={() => handleSubmenuItemClick(child)}
										disabled={child.disabled}
										role="menuitem"
									>
										{#if child.checked !== undefined}
											<span class="item-check">{child.checked ? '✓' : ''}</span>
										{:else if child.icon}
											<span class="item-icon">{child.icon}</span>
										{/if}
										<span class="item-label">{child.label}</span>
									</button>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<button
					class="menu-item"
					class:disabled={item.disabled}
					onclick={() => handleItemClick(item)}
					disabled={item.disabled}
					role="menuitem"
				>
					{#if item.checked !== undefined}
						<span class="item-check">{item.checked ? '✓' : ''}</span>
					{:else if item.icon}
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
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-xl);
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

	.item-icon,
	.item-check {
		flex-shrink: 0;
		width: 16px;
		text-align: center;
	}

	.item-check {
		color: var(--accent);
		font-weight: 600;
	}

	.item-label {
		flex: 1;
	}

	.separator {
		height: 1px;
		margin: var(--space-1) var(--space-2);
		background-color: var(--border);
	}

	.color-row {
		display: flex;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		justify-content: center;
	}

	.color-dot {
		width: 18px;
		height: 18px;
		border-radius: var(--radius-full);
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform var(--transition-fast), border-color var(--transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.color-dot:hover {
		transform: scale(1.2);
	}

	.color-dot.active {
		border-color: var(--text-primary);
	}

	.color-dot.no-color {
		background-color: var(--bg-surface);
		border-color: var(--border-strong);
	}

	.color-dot.no-color.active {
		border-color: var(--text-primary);
	}

	/* Submenu styles */
	.submenu-wrapper {
		position: relative;
	}

	.submenu-arrow {
		flex-shrink: 0;
		font-size: 10px;
		color: var(--text-muted);
		margin-left: auto;
	}

	.submenu {
		position: absolute;
		top: -4px;
		left: 100%;
		margin-left: 2px;
	}

	.submenu.flip-left {
		left: auto;
		right: 100%;
		margin-left: 0;
		margin-right: 2px;
	}
</style>
