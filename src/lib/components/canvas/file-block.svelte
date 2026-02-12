<script lang="ts">
	import { untrack } from 'svelte';
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { loadFileFromOPFS } from '$lib/platform/fs-opfs';
	import type { FileNode } from '$lib/types/canvas';

	// Props
	let { node }: { node: FileNode } = $props();

	// Local state
	let objectUrl = $state<string | null>(null);
	let loadError = $state(false);
	let isLoading = $state(true);

	// Derived
	let fileType = $derived(getFileType(node.mimeType));
	let formattedSize = $derived(formatBytes(node.size));

	// Load file from OPFS on mount — untrack to avoid re-running on position/size changes
	$effect(() => {
		let cancelled = false;
		const nodeId = untrack(() => node.id);
		const filename = untrack(() => node.filename);

		async function loadFile() {
			try {
				const file = await loadFileFromOPFS(
					canvasStore.activeCanvasId,
					nodeId,
					filename
				);
				if (cancelled) return;
				if (file) {
					objectUrl = URL.createObjectURL(file);
					loadError = false;
				} else {
					loadError = true;
				}
			} catch {
				if (!cancelled) loadError = true;
			} finally {
				if (!cancelled) isLoading = false;
			}
		}

		loadFile();

		return () => {
			cancelled = true;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
				objectUrl = null;
			}
		};
	});

	function getFileType(mimeType: string): string {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType === 'application/pdf') return 'pdf';
		return 'generic';
	}

	function getFileIcon(type: string): string {
		switch (type) {
			case 'image': return '\u{1F5BC}\u{FE0F}';
			case 'video': return '\u{1F3AC}';
			case 'audio': return '\u{1F3B5}';
			case 'pdf': return '\u{1F4C4}';
			default: return '\u{1F4CE}';
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}

	function downloadFile(e: MouseEvent) {
		e.stopPropagation();
		if (!objectUrl) return;
		const a = document.createElement('a');
		a.href = objectUrl;
		a.download = node.filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function openFile(e: MouseEvent) {
		e.stopPropagation();
		if (!objectUrl) return;
		window.open(objectUrl, '_blank', 'noopener,noreferrer');
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="file-block">
	{#if isLoading}
		<div class="file-placeholder">
			<div class="loading-spinner"></div>
			<div class="file-name">{node.filename}</div>
		</div>
	{:else if loadError}
		<div class="file-placeholder">
			<div class="file-icon-large error-icon">{getFileIcon(fileType)}</div>
			<div class="file-name">{node.filename}</div>
			<div class="file-meta error-text">File not found</div>
		</div>
	{:else if fileType === 'image' && objectUrl}
		<div class="file-preview">
			<img src={objectUrl} alt={node.filename} class="preview-image" />
			<div class="file-info">
				<span class="file-name" title={node.filename}>{node.filename}</span>
				<span class="file-meta">{formattedSize}</span>
			</div>
		</div>
	{:else if fileType === 'video' && objectUrl}
		<div class="file-preview">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video src={objectUrl} controls class="preview-video"></video>
			<div class="file-info">
				<span class="file-name" title={node.filename}>{node.filename}</span>
				<span class="file-meta">{formattedSize}</span>
			</div>
		</div>
	{:else if fileType === 'audio' && objectUrl}
		<div class="file-placeholder">
			<div class="file-icon-large">{getFileIcon('audio')}</div>
			<div class="file-name" title={node.filename}>{node.filename}</div>
			<div class="file-meta">{formattedSize}</div>
			<audio src={objectUrl} controls class="audio-player"></audio>
		</div>
	{:else}
		<div class="file-placeholder">
			<div class="file-icon-large">{getFileIcon(fileType)}</div>
			<div class="file-name" title={node.filename}>{node.filename}</div>
			<div class="file-meta">{formattedSize}</div>
			<div class="file-actions">
				{#if fileType === 'pdf'}
					<button class="file-btn" onclick={openFile} title="Open">Open</button>
				{/if}
				<button class="file-btn" onclick={downloadFile} title="Download">Download</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.file-block {
		width: 100%;
		height: 100%;
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--text-primary);
		overflow: hidden;
	}

	.file-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-3);
		height: 100%;
		text-align: center;
	}

	.file-preview {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.preview-image {
		flex: 1;
		width: 100%;
		object-fit: cover;
		min-height: 0;
	}

	.preview-video {
		flex: 1;
		width: 100%;
		min-height: 0;
		background: var(--bg-canvas);
	}

	.audio-player {
		width: 100%;
		max-width: 260px;
		margin-top: var(--space-2);
	}

	.file-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		background: var(--bg-elevated);
		border-top: 1px solid var(--border);
	}

	.file-icon-large {
		font-size: 32px;
		line-height: 1;
	}

	.file-name {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.file-meta {
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.error-icon {
		opacity: 0.4;
	}

	.error-text {
		color: var(--destructive);
	}

	.file-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.file-btn {
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--font-size-xs);
		color: var(--text-secondary);
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.file-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-muted);
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: var(--radius-full);
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
