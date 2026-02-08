<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { icons } from '$lib/components/icons';

	// Local state
	let searchInput = $state('');
	let showSuggestions = $state(false);
	// svelte-ignore non_reactive_update
	let inputEl: HTMLInputElement;

	// Derived state
	let activeTagFilters = $derived(canvasStore.tagFilters);
	let currentSearchTerm = $derived(canvasStore.searchTerm);
	let availableTags = $derived(canvasStore.allHashtags);
	let hasFilters = $derived(activeTagFilters.length > 0 || currentSearchTerm.length > 0);

	// Filter suggestions based on input
	let suggestions = $derived.by(() => {
		if (!searchInput.startsWith('#')) return [];
		const partial = searchInput.slice(1).toLowerCase();
		return availableTags
			.filter((tag) => tag.includes(partial) && !activeTagFilters.includes(tag))
			.slice(0, 5);
	});

	function handleInput(e: Event) {
		searchInput = (e.target as HTMLInputElement).value;
		if (searchInput.startsWith('#')) {
			showSuggestions = true;
			// Don't update search term when typing a tag
		} else {
			showSuggestions = false;
			canvasStore.setSearchTerm(searchInput);
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === ' ' && searchInput.startsWith('#')) {
			e.preventDefault();
			const tag = searchInput.slice(1).toLowerCase().trim();
			if (tag) {
				canvasStore.addTagFilter(tag);
				searchInput = '';
				showSuggestions = false;
			}
		} else if (e.key === 'Backspace' && !searchInput && activeTagFilters.length > 0) {
			// Remove last tag on backspace in empty input
			canvasStore.removeTagFilter(activeTagFilters[activeTagFilters.length - 1]);
		} else if (e.key === 'Escape') {
			showSuggestions = false;
			inputEl?.blur();
		}
	}

	function addTag(tag: string) {
		canvasStore.addTagFilter(tag);
		searchInput = '';
		showSuggestions = false;
		inputEl?.focus();
	}

	function removeTag(tag: string) {
		canvasStore.removeTagFilter(tag);
	}

	function clearAll() {
		canvasStore.clearFilters();
		searchInput = '';
	}

	function handleBlur(e: FocusEvent) {
		const relatedTarget = e.relatedTarget as HTMLElement | null;
		if (relatedTarget?.closest('.filter-bar') || relatedTarget?.closest('.canvas-toolbar')) {
			return;
		}
		showSuggestions = false;
	}
</script>

<div class="filter-bar">
	<div class="filter-content">
		<!-- Tag chips -->
		{#each activeTagFilters as tag}
			<span class="tag-chip">
				#{tag}
				<button class="chip-remove" onclick={() => removeTag(tag)} title="Remove filter">
					{icons.close}
				</button>
			</span>
		{/each}

		<!-- Search input -->
		<input
			type="text"
			class="filter-input"
			bind:this={inputEl}
			bind:value={searchInput}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			onblur={handleBlur}
			placeholder={activeTagFilters.length ? 'Add #tag or search...' : '#tag or search...'}
		/>

		<!-- Clear button -->
		{#if hasFilters || searchInput}
			<button class="clear-btn" onclick={clearAll} title="Clear filters">
				{icons.close}
			</button>
		{/if}
	</div>

	<!-- Tag suggestions dropdown -->
	{#if showSuggestions && suggestions.length > 0}
		<div class="suggestions">
			{#each suggestions as tag}
				<button class="suggestion-item" onmousedown={() => addTag(tag)}>
					#{tag}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.filter-bar {
		position: relative;
		display: flex;
		align-items: center;
	}

	.filter-content {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1);
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		min-width: 200px;
		max-width: 400px;
	}

	.tag-chip {
		display: flex;
		align-items: center;
		gap: var(--space-0);
		padding: var(--space-0) var(--space-2);
		background: var(--accent-muted);
		color: var(--accent);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: 500;
		white-space: nowrap;
	}

	.chip-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-full);
		color: var(--accent);
		cursor: pointer;
		font-size: 10px;
		transition: all var(--transition-fast);
	}

	.chip-remove:hover {
		background: var(--accent);
		color: white;
	}

	.filter-input {
		flex: 1;
		min-width: 100px;
		padding: var(--space-1);
		background: transparent;
		border: none;
		outline: none;
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--text-primary);
	}

	.filter-input::placeholder {
		color: var(--text-muted);
	}

	.clear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 50%;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 12px;
		transition: all var(--transition-fast);
	}

	.clear-btn:hover {
		color: var(--text-primary);
		background: var(--bg-surface);
	}

	.suggestions {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: var(--space-1);
		padding: var(--space-1);
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		z-index: 100;
	}

	.suggestion-item {
		display: block;
		width: 100%;
		padding: var(--space-2);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		text-align: left;
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--accent);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.suggestion-item:hover {
		background: var(--accent-muted);
	}
</style>
