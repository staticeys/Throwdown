<script lang="ts">
	let { onClose }: { onClose: () => void } = $props();

	// Close on escape
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

	const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
	const mod = isMac ? '⌘' : 'Ctrl';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay-backdrop" onclick={onClose}>
	<div class="overlay" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts" tabindex="-1">
		<div class="overlay-header">
			<h2>Keyboard Shortcuts</h2>
			<button class="close-btn" onclick={onClose} title="Close">×</button>
		</div>

		<div class="shortcuts-grid">
			<section>
				<h3>Navigation</h3>
				<dl>
					<div class="shortcut"><dt><kbd>Space</kbd> + drag</dt><dd>Pan canvas</dd></div>
					<div class="shortcut"><dt>Scroll</dt><dd>Zoom in/out</dd></div>
					<div class="shortcut"><dt><kbd>{mod}</kbd> + drag</dt><dd>Box select</dd></div>
				</dl>
			</section>

			<section>
				<h3>Selection</h3>
				<dl>
					<div class="shortcut"><dt><kbd>{mod}</kbd> + <kbd>A</kbd></dt><dd>Select all</dd></div>
					<div class="shortcut"><dt><kbd>Escape</kbd></dt><dd>Clear selection</dd></div>
					<div class="shortcut"><dt><kbd>Delete</kbd></dt><dd>Delete selected</dd></div>
				</dl>
			</section>

			<section>
				<h3>Clipboard</h3>
				<dl>
					<div class="shortcut"><dt><kbd>{mod}</kbd> + <kbd>C</kbd></dt><dd>Copy contents</dd></div>
					<div class="shortcut"><dt><kbd>{mod}</kbd> + <kbd>V</kbd></dt><dd>Paste</dd></div>
				</dl>
			</section>

			<section>
				<h3>History</h3>
				<dl>
					<div class="shortcut"><dt><kbd>{mod}</kbd> + <kbd>Z</kbd></dt><dd>Undo</dd></div>
					<div class="shortcut"><dt><kbd>{mod}</kbd> + <kbd>Y</kbd></dt><dd>Redo</dd></div>
				</dl>
			</section>

			<section>
				<h3>Nodes</h3>
				<dl>
					<div class="shortcut"><dt><kbd>L</kbd></dt><dd>Link selected nodes</dd></div>
					<div class="shortcut"><dt><kbd>{mod}</kbd> + <kbd>G</kbd></dt><dd>Group selected</dd></div>
				</dl>
			</section>

			<section>
				<h3>Colors</h3>
				<dl>
					<div class="shortcut"><dt><kbd>1</kbd> – <kbd>6</kbd></dt><dd>Set node color</dd></div>
					<div class="shortcut"><dt><kbd>0</kbd></dt><dd>Clear color</dd></div>
				</dl>
			</section>

			<section>
				<h3>Editing</h3>
				<dl>
					<div class="shortcut"><dt>Double-click</dt><dd>Edit node</dd></div>
					<div class="shortcut"><dt><kbd>Escape</kbd></dt><dd>Stop editing</dd></div>
				</dl>
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
		max-width: 560px;
		max-height: 80vh;
		overflow-y: auto;
		background-color: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
	}

	.overlay-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--border);
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

	.shortcuts-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-4);
		padding: var(--space-4);
	}

	section h3 {
		margin: 0 0 var(--space-2) 0;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.shortcut {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	dt {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--font-size-xs);
		color: var(--text-secondary);
	}

	dd {
		margin: 0;
		font-size: 13px;
		color: var(--text-primary);
		text-align: right;
	}

	kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 var(--space-1);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-primary);
		background-color: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	@media (max-width: 500px) {
		.shortcuts-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
