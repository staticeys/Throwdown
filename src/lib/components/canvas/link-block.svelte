<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { icons } from '$lib/components/icons';
	import { isValidHttpUrl } from '$lib/utils/paste-detection';
	import { extractUrlContext } from '$lib/utils/url-context';
	import type { LinkNode } from '$lib/types/canvas';

	// Props
	let { node }: { node: LinkNode } = $props();

	// Local state
	let isEditing = $state(false);
	// svelte-ignore non_reactive_update
	let inputEl: HTMLInputElement;

	// Derived
	let displayUrl = $derived(formatUrl(node.url));
	let hostname = $derived(getHostname(node.url));
	let isValidUrl = $derived(isValidHttpUrl(node.url));
	let urlContext = $derived(extractUrlContext(node.url));

	// Format URL for display
	function formatUrl(url: string): string {
		try {
			return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
		} catch {
			return url;
		}
	}

	// Extract hostname
	function getHostname(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	// Start editing
	export function startEdit() {
		canvasStore.beginTransaction();
		isEditing = true;
		requestAnimationFrame(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	// Stop editing
	function stopEdit() {
		isEditing = false;
		canvasStore.endTransaction();
	}

	// Handle input change
	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		canvasStore.updateNode(node.id, { url: target.value });
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

	// Open link (only if valid http/https URL)
	function openLink(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		if (!isEditing && node.url && isValidHttpUrl(node.url)) {
			window.open(node.url, '_blank', 'noopener,noreferrer');
		}
	}

	// Handle mousedown in edit mode - stop propagation to prevent canvas-object from calling preventDefault
	function handleMouseDown(e: MouseEvent) {
		if (isEditing) {
			e.stopPropagation();
		}
	}

	// Handle click - prevent clicks from bubbling to canvas only when editing
	function handleClick(e: MouseEvent) {
		if (isEditing) {
			e.stopPropagation();
		}
	}

	// Handle double-click on content area to enter edit mode
	function handleDblClick(e: MouseEvent) {
		// Don't interfere if already editing
		if (isEditing) return;

		// Stop propagation so we can manually trigger edit
		e.stopPropagation();
		startEdit();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="link-block" class:editing={isEditing} onmousedown={handleMouseDown} onclick={handleClick}>
	<div class="link-icon">{urlContext?.icon ?? icons.link}</div>

	{#if isEditing}
		<input
			type="url"
			class="link-input"
			bind:this={inputEl}
			value={node.url}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			onblur={handleBlur}
			placeholder="Enter URL..."
		/>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="link-content" ondblclick={handleDblClick}>
			<div class="link-label" class:invalid={!isValidUrl}>
				{urlContext?.label ?? hostname}
			</div>
			<div class="link-url" title={node.url}>{displayUrl}</div>
		</div>
		<button
			class="link-open"
			onclick={openLink}
			title={isValidUrl ? 'Open link' : 'Invalid URL'}
			disabled={!isValidUrl}
		>
			{icons.arrowRight}
		</button>
	{/if}
</div>

<style>
	.link-block {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		height: 100%;
		padding: var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--text-primary);
		overflow: hidden;
	}

	.link-icon {
		flex-shrink: 0;
		font-size: 16px;
		color: var(--accent);
	}

	.link-content {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		user-select: none;
	}

	.link-label {
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.link-url {
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.link-input {
		flex: 1;
		min-width: 0;
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-primary);
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		user-select: text;
		cursor: text;
	}

	.link-input:focus {
		border-color: var(--accent);
	}

	.link-open {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		font-size: 14px;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.link-open:hover:not(:disabled) {
		color: var(--accent);
		background: var(--accent-muted);
	}

	.link-open:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.link-label.invalid {
		color: var(--destructive);
	}
</style>
