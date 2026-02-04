<script lang="ts">
	let { onClose }: { onClose: () => void } = $props();

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	$effect(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay-backdrop" onclick={onClose}>
	<div class="overlay" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Markdown syntax help" tabindex="-1">
		<div class="overlay-header">
			<h2>Markdown Syntax</h2>
			<button class="close-btn" onclick={onClose} title="Close">×</button>
		</div>

		<div class="help-content">
			<section>
				<h3>Hashtags</h3>
				<p class="description">Use hashtags to categorize and filter nodes. Tags are clickable and can be filtered in the search bar.</p>
				<div class="example-row">
					<code>#project</code>
					<code>#todo</code>
					<code>#idea-v2</code>
				</div>
			</section>

			<section>
				<h3>Text Formatting</h3>
				<table><tbody>
					<tr><td><code>**bold**</code></td><td><strong>bold</strong></td></tr>
					<tr><td><code>*italic*</code></td><td><em>italic</em></td></tr>
					<tr><td><code>~~strikethrough~~</code></td><td><del>strikethrough</del></td></tr>
					<tr><td><code>`inline code`</code></td><td><code class="inline">inline code</code></td></tr>
				</tbody></table>
			</section>

			<section>
				<h3>Headers</h3>
				<table><tbody>
					<tr><td><code># Heading 1</code></td><td class="preview-h1">Heading 1</td></tr>
					<tr><td><code>## Heading 2</code></td><td class="preview-h2">Heading 2</td></tr>
					<tr><td><code>### Heading 3</code></td><td class="preview-h3">Heading 3</td></tr>
				</tbody></table>
			</section>

			<section>
				<h3>Links</h3>
				<table><tbody>
					<tr><td><code>[text](url)</code></td><td><span class="example-link">text</span></td></tr>
					<tr><td><code>https://example.com</code></td><td>Auto-linked URL</td></tr>
				</tbody></table>
			</section>

			<section>
				<h3>Lists</h3>
				<div class="side-by-side">
					<div>
						<h4>Unordered</h4>
						<pre>- Item one
- Item two
- Item three</pre>
					</div>
					<div>
						<h4>Ordered</h4>
						<pre>1. First
2. Second
3. Third</pre>
					</div>
				</div>
			</section>

			<section>
				<h3>Task Lists</h3>
				<pre>- [ ] Unchecked task
- [x] Completed task</pre>
			</section>

			<section>
				<h3>Code Blocks</h3>
				<pre>```
code block
```</pre>
			</section>

			<section>
				<h3>Blockquotes</h3>
				<table><tbody>
					<tr><td><code>&gt; quoted text</code></td><td class="preview-quote">quoted text</td></tr>
				</tbody></table>
			</section>

			<section>
				<h3>Tables</h3>
				<pre>| Header | Header |
|--------|--------|
| Cell   | Cell   |</pre>
			</section>

			<section>
				<h3>Horizontal Rule</h3>
				<table><tbody>
					<tr><td><code>---</code></td><td><hr /></td></tr>
				</tbody></table>
			</section>
		</div>
	</div>
</div>

<style>
	.overlay-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--overlay-bg);
		z-index: 1000;
	}

	.overlay {
		max-width: 520px;
		max-height: 85vh;
		overflow-y: auto;
		background-color: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
	}

	.overlay-header {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		background-color: var(--bg-surface);
		border-bottom: 1px solid var(--border);
		z-index: 1;
	}

	.overlay-header h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		font-size: 20px;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.close-btn:hover {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.help-content {
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	section h3 {
		margin: 0 0 var(--space-2) 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
	}

	section h4 {
		margin: 0 0 var(--space-1) 0;
		font-size: 11px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.description {
		margin: 0 0 var(--space-2) 0;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.example-row {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.example-row code {
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent);
		background-color: var(--accent-muted);
		border-radius: var(--radius-sm);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	tr {
		border-bottom: 1px solid var(--border);
	}

	tr:last-child {
		border-bottom: none;
	}

	td {
		padding: var(--space-2);
		font-size: 13px;
		vertical-align: middle;
	}

	td:first-child {
		width: 50%;
		color: var(--text-secondary);
	}

	td:last-child {
		color: var(--text-primary);
	}

	code {
		font-family: var(--font-mono);
		font-size: 12px;
	}

	code.inline {
		padding: 2px 4px;
		background-color: var(--bg-elevated);
		border-radius: var(--radius-sm);
	}

	pre {
		margin: 0;
		padding: var(--space-2);
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-secondary);
		background-color: var(--bg-elevated);
		border-radius: var(--radius-sm);
		overflow-x: auto;
	}

	.side-by-side {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	.preview-h1 {
		font-size: 16px;
		font-weight: 700;
	}

	.preview-h2 {
		font-size: 14px;
		font-weight: 600;
	}

	.preview-h3 {
		font-size: 13px;
		font-weight: 600;
	}

	.preview-quote {
		padding-left: var(--space-2);
		border-left: 3px solid var(--border);
		color: var(--text-secondary);
		font-style: italic;
	}

	hr {
		margin: 0;
		border: none;
		border-top: 1px solid var(--border);
	}

	.example-link {
		color: var(--accent);
		text-decoration: underline;
	}
</style>
