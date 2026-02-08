<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { resolveColor } from '$lib/types/canvas';
	import { calculateBoundingBox } from '$lib/utils/geometry';

	// Minimap dimensions
	const MINIMAP_WIDTH = 160;
	const MINIMAP_HEIGHT = 100;
	const PADDING = 12;

	// Props: container dimensions for viewport indicator
	let {
		containerWidth = 0,
		containerHeight = 0
	}: {
		containerWidth?: number;
		containerHeight?: number;
	} = $props();

	// Local state
	let collapsed = $state(false);
	let isDragging = $state(false);
	let minimapEl = $state<HTMLDivElement>();

	// All nodes (show full canvas, not just filtered)
	let allNodes = $derived(canvasStore.nodes);
	let viewport = $derived(canvasStore.viewport);

	// Bounding box of all nodes
	let bounds = $derived(calculateBoundingBox(allNodes));

	// Scale and offset to fit all nodes into minimap
	let minimapTransform = $derived.by(() => {
		if (!bounds) {
			return { scale: 1, offsetX: 0, offsetY: 0 };
		}

		// Handle zero-dimension bounds (single node or stacked nodes)
		if (bounds.width === 0 && bounds.height === 0) {
			const node = allNodes[0];
			const defaultScale = 0.2;
			return {
				scale: defaultScale,
				offsetX: MINIMAP_WIDTH / 2 - (node.x + node.width / 2) * defaultScale,
				offsetY: MINIMAP_HEIGHT / 2 - (node.y + node.height / 2) * defaultScale
			};
		}

		const scaleX = (MINIMAP_WIDTH - PADDING * 2) / bounds.width;
		const scaleY = (MINIMAP_HEIGHT - PADDING * 2) / bounds.height;
		const scale = Math.min(scaleX, scaleY);

		// Center content in minimap
		const scaledWidth = bounds.width * scale;
		const scaledHeight = bounds.height * scale;
		const offsetX = (MINIMAP_WIDTH - scaledWidth) / 2 - bounds.x * scale;
		const offsetY = (MINIMAP_HEIGHT - scaledHeight) / 2 - bounds.y * scale;

		return { scale, offsetX, offsetY };
	});

	// Viewport indicator rectangle in minimap space
	let viewportRect = $derived.by(() => {
		const { scale, offsetX, offsetY } = minimapTransform;

		// Visible area in canvas coordinates
		const canvasLeft = -viewport.x / viewport.zoom;
		const canvasTop = -viewport.y / viewport.zoom;
		const canvasW = containerWidth / viewport.zoom;
		const canvasH = containerHeight / viewport.zoom;

		return {
			x: canvasLeft * scale + offsetX,
			y: canvasTop * scale + offsetY,
			width: canvasW * scale,
			height: canvasH * scale
		};
	});

	// Node rectangles in minimap space
	let minimapNodes = $derived(
		allNodes.map(node => {
			const { scale, offsetX, offsetY } = minimapTransform;
			return {
				id: node.id,
				x: node.x * scale + offsetX,
				y: node.y * scale + offsetY,
				width: Math.max(node.width * scale, 2),
				height: Math.max(node.height * scale, 1.5),
				color: resolveColor(node.color) ?? 'var(--text-muted)',
				isGroup: node.type === 'group',
				isSelected: canvasStore.selection.includes(node.id)
			};
		})
	);

	// Convert minimap coordinates back to canvas coordinates
	function minimapToCanvas(minimapX: number, minimapY: number): { x: number; y: number } {
		const { scale, offsetX, offsetY } = minimapTransform;
		return {
			x: (minimapX - offsetX) / scale,
			y: (minimapY - offsetY) / scale
		};
	}

	// Navigate viewport to center on a canvas position
	function navigateTo(minimapX: number, minimapY: number) {
		const canvasPos = minimapToCanvas(minimapX, minimapY);
		canvasStore.setViewport({
			x: -canvasPos.x * viewport.zoom + containerWidth / 2,
			y: -canvasPos.y * viewport.zoom + containerHeight / 2,
			zoom: viewport.zoom
		});
	}

	function handleMouseDown(e: MouseEvent) {
		if (!minimapEl) return;
		e.preventDefault();
		e.stopPropagation();
		isDragging = true;
		const rect = minimapEl.getBoundingClientRect();
		navigateTo(e.clientX - rect.left, e.clientY - rect.top);

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || !minimapEl) return;
		const rect = minimapEl.getBoundingClientRect();
		navigateTo(e.clientX - rect.left, e.clientY - rect.top);
	}

	function handleMouseUp() {
		isDragging = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}
</script>

<div class="minimap-wrapper">
	{#if allNodes.length > 0}
		<button
			class="minimap-toggle"
			onclick={() => { collapsed = !collapsed; }}
			title={collapsed ? 'Show Minimap' : 'Hide Minimap'}
		>◱</button>
	{/if}

	{#if !collapsed && allNodes.length > 0}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="minimap"
			bind:this={minimapEl}
			onmousedown={handleMouseDown}
			style:width="{MINIMAP_WIDTH}px"
			style:height="{MINIMAP_HEIGHT}px"
		>
			<!-- Node rectangles -->
			{#each minimapNodes as node (node.id)}
				<div
					class="minimap-node"
					class:minimap-node-group={node.isGroup}
					class:minimap-node-selected={node.isSelected}
					style:left="{node.x}px"
					style:top="{node.y}px"
					style:width="{node.width}px"
					style:height="{node.height}px"
					style:background-color={node.isGroup ? 'transparent' : node.color}
					style:border-color={node.isGroup ? node.color : 'transparent'}
				></div>
			{/each}

			<!-- Viewport indicator -->
			<div
				class="minimap-viewport"
				style:left="{viewportRect.x}px"
				style:top="{viewportRect.y}px"
				style:width="{viewportRect.width}px"
				style:height="{viewportRect.height}px"
			></div>
		</div>
	{/if}

	<!-- Zoom controls -->
	<div class="zoom-controls">
		<button
			class="zoom-btn"
			onclick={() => canvasStore.zoom(0.8)}
			title="Zoom Out"
		>−</button>
		<span class="zoom-value">{Math.round(viewport.zoom * 100)}%</span>
		<button
			class="zoom-btn"
			onclick={() => canvasStore.zoom(1.2)}
			title="Zoom In"
		>+</button>
	</div>
</div>

<style>
	.minimap-wrapper {
		position: absolute;
		bottom: var(--space-3);
		right: var(--space-3);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-1);
		z-index: 10;
	}

	.minimap-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		font-size: 12px;
		color: var(--text-secondary);
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.minimap-toggle:hover {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.minimap {
		position: relative;
		background-color: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		cursor: crosshair;
		opacity: var(--panel-opacity);
	}

	.minimap-node {
		position: absolute;
		border-radius: 1px;
		opacity: 0.7;
		pointer-events: none;
	}

	.minimap-node-group {
		border: 1px dashed;
		opacity: 0.4;
	}

	.minimap-node-selected {
		opacity: 1;
		box-shadow: 0 0 0 1px var(--selection);
	}

	.minimap-viewport {
		position: absolute;
		border: 1.5px solid var(--accent);
		background-color: color-mix(in srgb, var(--accent) 8%, transparent);
		border-radius: 1px;
		pointer-events: none;
	}

	.zoom-controls {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1);
		background-color: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		user-select: none;
	}

	.zoom-value {
		min-width: 3.5ch;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-secondary);
		text-align: center;
	}

	.zoom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		font-size: 14px;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.zoom-btn:hover {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.zoom-btn:active {
		background-color: var(--border);
	}
</style>
