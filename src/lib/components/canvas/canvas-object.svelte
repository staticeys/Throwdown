<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import type { CanvasNode } from '$lib/types/canvas';
	import { resolveColor } from '$lib/types/canvas';
	import { calculateAlignments } from '$lib/utils/alignment';
	import { getContainedNodes } from '$lib/utils/geometry';

	// Props
	let {
		node,
		children,
		onEdit
	}: {
		node: CanvasNode;
		children?: import('svelte').Snippet;
		onEdit?: (id: string) => void;
	} = $props();

	// Local state
	let isDragging = $state(false);
	let dragStart = $state({ x: 0, y: 0 });
	let nodeStart = $state({ x: 0, y: 0 });
	let isResizing = $state(false);
	let resizeStart = $state({ x: 0, y: 0, width: 0, height: 0 });
	let containedNodesAtDragStart = $state<{ id: string; x: number; y: number }[]>([]); // Snapshot of contained nodes with positions when group drag starts
	const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
	const MIN_WIDTH = 120;
	const MIN_HEIGHT = 80;

	// Derived state - access selection directly for proper Svelte 5 reactivity
	let isSelected = $derived(canvasStore.selection.includes(node.id));
	let nodeColor = $derived(resolveColor(node.color));
	let hasColor = $derived(nodeColor !== undefined);
	let isGroup = $derived(node.type === 'group');

	// Handle mouse down for selection and drag start
	function handleMouseDown(e: MouseEvent) {
		// Only handle left click
		if (e.button !== 0) return;

		e.preventDefault(); // Prevent text selection
		e.stopPropagation();

		const multiSelect = isMac ? e.metaKey : e.ctrlKey;

		// Handle selection
		if (multiSelect) {
			// Cmd/Ctrl + click toggles selection
			canvasStore.toggleSelection(node.id);
		} else if (!isSelected) {
			// Click on unselected node selects only it
			canvasStore.selectOnly(node.id);
		}

		// Start drag
		isDragging = true;
		dragStart = { x: e.clientX, y: e.clientY };
		nodeStart = { x: node.x, y: node.y };

		// If this is a group, capture contained nodes with their positions at drag start (snapshot)
		// This prevents the "vacuum cleaner" effect during drag
		if (isGroup) {
			containedNodesAtDragStart = getContainedNodes(node, canvasStore.nodes).map((n) => ({
				id: n.id,
				x: n.x,
				y: n.y
			}));
		}

		// Add document listeners for drag
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
		document.body.classList.add('dragging');
	}

	// Handle drag
	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;

		const zoom = canvasStore.viewport.zoom;
		const dx = (e.clientX - dragStart.x) / zoom;
		const dy = (e.clientY - dragStart.y) / zoom;

		// Multi-select drag
		if (isSelected && canvasStore.selection.length > 1) {
			canvasStore.moveSelectedNodes(dx, dy);
			canvasStore.clearAlignmentGuides();
			dragStart = { x: e.clientX, y: e.clientY };
			return;
		}

		// Single node drag with alignment guides
		let newX = nodeStart.x + dx;
		let newY = nodeStart.y + dy;

		// Get other nodes for alignment detection
		const otherNodes = canvasStore.nodes.filter((n) => n.id !== node.id);

		// Calculate alignment guides
		const alignment = calculateAlignments(
			{ x: newX, y: newY, width: node.width, height: node.height },
			otherNodes
		);

		// Apply alignment snapping
		if (alignment.snapX !== null) {
			newX = alignment.snapX;
		}
		if (alignment.snapY !== null) {
			newY = alignment.snapY;
		}

		// Show alignment guides
		if (alignment.guides.vertical.length > 0 || alignment.guides.horizontal.length > 0) {
			canvasStore.setAlignmentGuides(alignment.guides);
		} else {
			canvasStore.clearAlignmentGuides();
		}

		// Move the node
		canvasStore.moveNode(node.id, newX, newY);

		// If dragging a group, move its contained nodes along with it
		// Use the stored initial positions to compute new positions (absolute, not incremental)
		if (isGroup && containedNodesAtDragStart.length > 0) {
			for (const contained of containedNodesAtDragStart) {
				canvasStore.updateNode(contained.id, {
					x: contained.x + dx,
					y: contained.y + dy
				});
			}
		}
	}

	// Handle drag end
	function handleMouseUp() {
		isDragging = false;
		containedNodesAtDragStart = []; // Reset contained nodes snapshot
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		document.body.classList.remove('dragging');
		canvasStore.clearAlignmentGuides();
	}

	// Resize start
	function handleResizeMouseDown(e: MouseEvent) {
		// Only handle left click
		if (e.button !== 0) return;

		e.preventDefault(); // Prevent text selection
		e.stopPropagation();
		isResizing = true;
		resizeStart = { x: e.clientX, y: e.clientY, width: node.width, height: node.height };
		document.addEventListener('mousemove', handleResizeMouseMove);
		document.addEventListener('mouseup', handleResizeMouseUp);
		document.body.classList.add('dragging');
	}

	// Resize move
	function handleResizeMouseMove(e: MouseEvent) {
		if (!isResizing) return;

		const zoom = canvasStore.viewport.zoom;
		const dx = (e.clientX - resizeStart.x) / zoom;
		const dy = (e.clientY - resizeStart.y) / zoom;

		const newWidth = Math.max(MIN_WIDTH, resizeStart.width + dx);
		const newHeight = Math.max(MIN_HEIGHT, resizeStart.height + dy);
		canvasStore.resizeNode(node.id, newWidth, newHeight);
	}

	// Resize end
	function handleResizeMouseUp() {
		isResizing = false;
		document.removeEventListener('mousemove', handleResizeMouseMove);
		document.removeEventListener('mouseup', handleResizeMouseUp);
		document.body.classList.remove('dragging');
	}

	// Handle double click (for editing)
	function handleDblClick(e: MouseEvent) {
		e.stopPropagation();
		onEdit?.(node.id);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="canvas-object"
	class:selected={isSelected}
	class:has-color={hasColor}
	class:is-group={isGroup}
	style:left="{node.x}px"
	style:top="{node.y}px"
	style:width="{node.width}px"
	style:height="{node.height}px"
	style:overflow={isSelected || isGroup ? 'visible' : 'hidden'}
	style:--node-color={nodeColor}
	data-node-id={node.id}
	onmousedown={isGroup ? undefined : handleMouseDown}
	ondblclick={isGroup ? undefined : handleDblClick}
>
	{#if isGroup}
		<!-- Border frame for groups - captures clicks on the border only -->
		<div
			class="group-frame"
			onmousedown={handleMouseDown}
			ondblclick={handleDblClick}
		></div>
	{/if}

	<div class="object-content" class:group-content={isGroup}>
		{#if children}
			{@render children()}
		{/if}
	</div>

	{#if isSelected}
		<div class="selection-indicator"></div>

		<!-- Resize handle - positioned outside bottom-right corner -->
		<div
			class="resize-handle"
			onmousedown={handleResizeMouseDown}
			aria-label="Resize"
			title="Resize"
		></div>
	{/if}
</div>

<style>
	.canvas-object {
		position: absolute;
		background-color: var(--bg-surface);
		border: 1px solid var(--node-border-color, var(--border));
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		cursor: grab;
		transition: box-shadow var(--transition-fast);
		/* overflow controlled via inline style - hidden when not selected, visible when selected */
		user-select: none;
		isolation: isolate; /* Creates stacking context so resize handle z-index stays local */
	}

	.canvas-object:hover {
		box-shadow: var(--shadow-md);
	}

	/* Node with color - tinted background and colored border */
	.canvas-object.has-color {
		border-color: var(--node-color);
		background-color: color-mix(in srgb, var(--node-color) 12%, var(--bg-surface));
	}

	.canvas-object.selected {
		border-color: var(--selection);
		box-shadow: var(--shadow-sm), 0 0 0 2px var(--selection-bg);
	}

	/* Colored node when selected - keep the tint, use selection border */
	.canvas-object.selected.has-color {
		background-color: color-mix(in srgb, var(--node-color) 12%, var(--bg-surface));
	}

	.canvas-object:active {
		cursor: grabbing;
	}

	/* Override parent cursor when hovering resize handle */
	.canvas-object:has(.resize-handle:hover) {
		cursor: nwse-resize;
	}

	.object-content {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.selection-indicator {
		position: absolute;
		inset: -2px;
		border: 2px solid var(--selection);
		border-radius: var(--radius-md);
		pointer-events: none;
	}

	.resize-handle {
		position: absolute;
		width: 14px;
		height: 14px;
		right: -7px;  /* Position outside, centered on corner */
		bottom: -7px;
		z-index: 10;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: nwse-resize !important;
		box-shadow: var(--shadow-sm);
		transition:
			background var(--transition-fast),
			border-color var(--transition-fast),
			box-shadow var(--transition-fast),
			transform var(--transition-fast);
	}

	.resize-handle:hover {
		background: var(--bg-surface);
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-muted);
		transform: scale(var(--hover-scale));
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		inset: 3px;
		border-bottom: 2px solid var(--border-strong);
		border-right: 2px solid var(--border-strong);
		transform: rotate(0deg);
	}

	/* Group node styles - transparent frame */
	.canvas-object.is-group {
		background-color: transparent;
		border-style: dashed;
		border-width: 2px;
		border-color: var(--border-strong);
		box-shadow: none;
		pointer-events: none; /* Allow clicks to pass through to nodes below */
	}

	.canvas-object.is-group:hover {
		box-shadow: none;
		border-color: var(--text-muted);
	}

	.canvas-object.is-group.has-color {
		background-color: color-mix(in srgb, var(--node-color) 5%, transparent);
		border-color: var(--node-color);
	}

	.canvas-object.is-group.selected {
		border-color: var(--selection);
		border-style: dashed;
	}

	/* Group frame - captures clicks on the border area */
	.group-frame {
		position: absolute;
		inset: -8px; /* Extend outward to create hit area around border */
		border: 12px solid transparent; /* Wide transparent border for easy clicking */
		pointer-events: auto;
		cursor: grab;
		z-index: 0;
	}

	.group-frame:active {
		cursor: grabbing;
	}

	/* Group content - allows overflow for label, no pointer events */
	.object-content.group-content {
		overflow: visible;
		pointer-events: none;
	}

	/* But allow pointer events on the label itself */
	.object-content.group-content :global(.group-label) {
		pointer-events: auto;
	}

	/* Make resize handle work for groups (which have pointer-events: none) */
	.canvas-object.is-group .resize-handle {
		pointer-events: auto;
	}
</style>
