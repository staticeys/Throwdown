<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import type { TextNode } from '$lib/types/canvas';

	// Props
	let { node }: { node: TextNode } = $props();

	// Local state
	let isEditing = $state(false);
	let initialText = $state('');
	let draftText = $state('');
	let editSessionKey = $state(0); // Increment to force new edit session
	// Element refs don't need reactivity
	// svelte-ignore non_reactive_update
	let editableEl: HTMLDivElement;

	// Derived
	let searchTerm = $derived(canvasStore.searchTerm);
	let renderedHtml = $derived(!isEditing ? renderMarkdown(node.text, searchTerm) : '');

	// Start editing
	export function startEdit() {
		// Capture text before entering edit mode and increment session key
		initialText = node.text;
		draftText = node.text;
		editSessionKey++;
		isEditing = true;
		canvasStore.setEditingText(true);
		// Focus after DOM update
		requestAnimationFrame(() => {
			if (editableEl) {
				editableEl.focus();
				// Move cursor to end
				const range = document.createRange();
				const sel = window.getSelection();
				if (editableEl.childNodes.length > 0) {
					range.selectNodeContents(editableEl);
					range.collapse(false);
					sel?.removeAllRanges();
					sel?.addRange(range);
				}
			}
		});
	}

	// Stop editing
	function stopEdit(save = true) {
		if (save && draftText !== node.text) {
			canvasStore.updateNode(node.id, { text: draftText });
		}
		isEditing = false;
		canvasStore.setEditingText(false);
	}

	// Handle input - DO NOT update store while typing to avoid re-renders
	// Text is saved on blur/escape instead
	function handleInput(e: Event) {
		const target = e.target as HTMLDivElement;
		draftText = target.innerText;
	}

	// Handle keydown
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			// Revert changes on escape
			draftText = initialText;
			stopEdit(false);
		}
		// Stop propagation to prevent canvas shortcuts
		e.stopPropagation();
	}

	// Handle blur
	function handleBlur() {
		stopEdit(true);
	}

	// Handle mousedown in edit mode - stop propagation to prevent canvas-object from calling preventDefault
	function handleMouseDown(e: MouseEvent) {
		if (isEditing) {
			e.stopPropagation();
		}
	}

	// Handle click in edit mode
	function handleClick(e: MouseEvent) {
		if (isEditing) {
			e.stopPropagation();
		}
	}

	// Local dblclick fallback to ensure edit mode re-enters reliably
	function handleDblClick(e: MouseEvent) {
		e.stopPropagation();
		if (!isEditing) {
			startEdit();
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="text-block" class:editing={isEditing} onmousedown={handleMouseDown} onclick={handleClick} ondblclick={handleDblClick}>
	{#if isEditing}
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<!-- Use {#key} with editSessionKey to recreate element only when entering edit mode -->
		<!-- This prevents re-renders during typing -->
		{#key editSessionKey}
			<div
				class="text-editor"
				contenteditable="true"
				bind:this={editableEl}
				oninput={handleInput}
				onkeydown={handleKeyDown}
				onblur={handleBlur}
				role="textbox"
				aria-multiline="true"
			>{initialText}</div>
		{/key}
	{:else if node.text}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="text-rendered">{@html renderedHtml}</div>
	{:else}
		<div class="text-rendered text-placeholder">Double-click to edit</div>
	{/if}
</div>

<style>
	.text-block {
		width: 100%;
		height: 100%;
		padding: var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--font-size-base);
		line-height: 1.5;
		color: var(--text-primary);
		overflow: auto;
	}

	.text-editor {
		width: 100%;
		height: 100%;
		outline: none;
		white-space: pre-wrap;
		word-break: break-word;
		user-select: text;
		cursor: text;
	}

	.text-rendered {
		overflow: auto;
		user-select: none;
	}

	.text-placeholder {
		color: var(--text-muted);
	}

	/* Markdown rendered styles */
	.text-rendered :global(h1),
	.text-rendered :global(h2),
	.text-rendered :global(h3) {
		margin: 0 0 0.5em;
		font-weight: 600;
		line-height: 1.3;
	}

	.text-rendered :global(h1) {
		font-size: 1.5em;
	}

	.text-rendered :global(h2) {
		font-size: 1.25em;
	}

	.text-rendered :global(h3) {
		font-size: 1.1em;
	}

	.text-rendered :global(p) {
		margin: 0 0 0.5em;
	}

	.text-rendered :global(p:last-child) {
		margin-bottom: 0;
	}

	.text-rendered :global(strong) {
		font-weight: 600;
	}

	.text-rendered :global(em) {
		font-style: italic;
	}

	.text-rendered :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9em;
		padding: 0.1em 0.3em;
		background: var(--bg-elevated);
		border-radius: var(--radius-sm);
	}

	.text-rendered :global(a) {
		color: var(--accent);
		text-decoration: none;
	}

	.text-rendered :global(a:hover) {
		text-decoration: underline;
	}

	.text-rendered :global(ul),
	.text-rendered :global(ol) {
		margin: 0 0 0.5em;
		padding-left: 1.5em;
	}

	.text-rendered :global(li) {
		margin-bottom: 0.25em;
	}

	.text-rendered :global(blockquote) {
		margin: 0 0 0.5em;
		padding-left: 1em;
		border-left: 3px solid var(--border-strong);
		color: var(--text-secondary);
	}

	.text-rendered :global(hr) {
		border: none;
		border-top: 1px solid var(--border);
		margin: 0.5em 0;
	}

	/* Code blocks (GFM) */
	.text-rendered :global(pre) {
		margin: 0.5em 0;
		padding: var(--space-3);
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: 0.85em;
		line-height: 1.5;
	}

	.text-rendered :global(pre code) {
		background: transparent;
		padding: 0;
		border-radius: 0;
		font-size: inherit;
	}

	/* Tables (GFM) */
	.text-rendered :global(table) {
		margin: 0.5em 0;
		border-collapse: collapse;
		width: 100%;
		font-size: 0.9em;
	}

	.text-rendered :global(th),
	.text-rendered :global(td) {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		text-align: left;
	}

	.text-rendered :global(th) {
		background: var(--bg-elevated);
		font-weight: 600;
		border-bottom: 2px solid var(--border-strong);
	}

	.text-rendered :global(tr:nth-child(even)) {
		background: var(--bg-elevated);
	}

	.text-rendered :global(td[align='center']),
	.text-rendered :global(th[align='center']) {
		text-align: center;
	}

	.text-rendered :global(td[align='right']),
	.text-rendered :global(th[align='right']) {
		text-align: right;
	}

	/* Task lists (GFM) */
	.text-rendered :global(li) :global(input[type='checkbox']) {
		margin-right: var(--space-2);
		cursor: default;
		vertical-align: middle;
	}

	.text-rendered :global(li:has(input[type='checkbox'])) {
		list-style-type: none;
		margin-left: calc(-1.5em);
	}

	/* Hashtags */
	.text-rendered :global(.hashtag) {
		color: var(--hashtag-text, var(--accent));
		background: var(--hashtag-bg, var(--accent-muted));
		padding: 0 var(--space-1);
		border-radius: var(--radius-sm);
	}

	/* Search highlights */
	.text-rendered :global(.search-highlight) {
		background: var(--highlight-bg);
		color: inherit;
		padding: 0 var(--space-0);
		border-radius: var(--radius-sm);
	}
</style>
