<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import type { CanvasNode, Side } from '$lib/types/canvas';
	import { resolveColor } from '$lib/types/canvas';
	import { calculateAlignments } from '$lib/utils/alignment';
	import { detectEdgeSnap, type SnapResult } from '$lib/utils/geometry';

	// Props
	let {
		node,
		children,
		onEdit,
		isGhost = false
	}: {
		node: CanvasNode;
		children?: import('svelte').Snippet;
		onEdit?: (id: string) => void;
		isGhost?: boolean;
	} = $props();

	// Local state
	let isDragging = $state(false);
	let dragStart = $state({ x: 0, y: 0 });
	let nodeStart = $state({ x: 0, y: 0 });
	let isResizing = $state(false);
	let resizeStart = $state({ x: 0, y: 0, width: 0, height: 0 });
	let currentSnap = $state<SnapResult | null>(null);
	let hasUnlockedDuringDrag = $state(false); // Track if we unlocked via Option+drag
	const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
	const MIN_WIDTH = 120;
	const MIN_HEIGHT = 80;
	const SNAP_THRESHOLD = 8;

	// Derived state - access selection directly for proper Svelte 5 reactivity
	let isSelected = $derived(canvasStore.selection.includes(node.id));
	let nodeColor = $derived(resolveColor(node.color));
	let hasColor = $derived(nodeColor !== undefined);

	// Link mode derived state
	let isLinkMode = $derived(canvasStore.isLinkMode);
	let isLinkSource = $derived(canvasStore.linkSource === node.id);

	// Lock-related derived state
	let lockedCluster = $derived(canvasStore.getLockedCluster(node.id));
	let isInLockedCluster = $derived(lockedCluster.length > 1);

	// Check if any node in this cluster is selected (for cluster glow)
	let isClusterSelected = $derived(
		isInLockedCluster && lockedCluster.some((id) => canvasStore.selection.includes(id))
	);

	// Pending lock highlight (which edge will lock on release)
	let pendingLockSide = $derived(currentSnap?.draggedSide ?? null);

	// Check if this node is the target of a pending snap (from another node being dragged)
	let isSnapTarget = $derived(canvasStore.pendingSnapTarget?.nodeId === node.id);
	let snapTargetSide = $derived(
		isSnapTarget ? canvasStore.pendingSnapTarget?.side ?? null : null
	);

	// Handle click in link mode
	function handleLinkModeClick(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();

		if (!canvasStore.linkSource) {
			// Set this node as source
			canvasStore.setLinkSource(node.id);
		} else if (canvasStore.linkSource !== node.id) {
			// Create link to this node
			canvasStore.createLinkFromSource(node.id);
		}
	}

	// Handle mouse down for selection and drag start
	function handleMouseDown(e: MouseEvent) {
		// Only handle left click
		if (e.button !== 0) return;

		// In link mode, handle click differently (don't drag)
		if (isLinkMode) {
			handleLinkModeClick(e);
			return;
		}

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

		// Add document listeners for drag
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
		document.body.classList.add('dragging');
	}

	// Handle drag
	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;

		// Option/Alt + drag = unlock from neighbors permanently
		if (e.altKey && isInLockedCluster && !hasUnlockedDuringDrag) {
			canvasStore.removeLocksForNode(node.id);
			hasUnlockedDuringDrag = true;
		}

		const zoom = canvasStore.viewport.zoom;
		const dx = (e.clientX - dragStart.x) / zoom;
		const dy = (e.clientY - dragStart.y) / zoom;

		// Multi-select drag
		if (isSelected && canvasStore.selection.length > 1) {
			canvasStore.moveSelectedNodes(dx, dy);
			canvasStore.clearAlignmentGuides();
			currentSnap = null;
			dragStart = { x: e.clientX, y: e.clientY };
			return;
		}

		// Locked cluster drag (if still in a cluster after potential unlock)
		if (isInLockedCluster && !hasUnlockedDuringDrag) {
			// Move entire locked cluster
			for (const nodeId of lockedCluster) {
				const n = canvasStore.nodes.find((nd) => nd.id === nodeId);
				if (n) {
					canvasStore.updateNode(nodeId, { x: n.x + dx, y: n.y + dy });
				}
			}
			canvasStore.clearAlignmentGuides();
			currentSnap = null;
			dragStart = { x: e.clientX, y: e.clientY };
			return;
		}

		// Single node drag with alignment guides and edge snapping
		let newX = nodeStart.x + dx;
		let newY = nodeStart.y + dy;

		// Get other nodes for snap detection
		const otherNodes = canvasStore.nodes.filter((n) => n.id !== node.id);

		// Step 1: Calculate alignment guides (always, for visual feedback)
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

		// Step 2: Check for edge snap (lock) on the aligned position
		const tempNode = { ...node, x: newX, y: newY };
		const snap = detectEdgeSnap(tempNode, otherNodes, SNAP_THRESHOLD);

		if (snap) {
			// Apply edge snap position (overrides alignment for the snapping axis)
			newX = snap.snapX;
			newY = snap.snapY;
			currentSnap = snap;
			// Set pending snap target for visual feedback on the target node
			canvasStore.setPendingSnapTarget(snap.targetNode.id, snap.targetSide);
		} else {
			currentSnap = null;
			canvasStore.clearPendingSnapTarget();
		}

		// Move the node
		canvasStore.moveNode(node.id, newX, newY);
	}

	// Handle drag end
	function handleMouseUp(e: MouseEvent) {
		// Create lock if we're snapped to another node
		if (currentSnap) {
			canvasStore.addLock(
				node.id,
				currentSnap.draggedSide,
				currentSnap.targetNode.id,
				currentSnap.targetSide
			);
		}

		isDragging = false;
		currentSnap = null;
		hasUnlockedDuringDrag = false;
		canvasStore.clearPendingSnapTarget();
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
	class:ghost={isGhost}
	class:link-mode-active={isLinkMode}
	class:link-source={isLinkSource}
	class:cluster-selected={isClusterSelected}
	class:snap-left={pendingLockSide === 'left'}
	class:snap-right={pendingLockSide === 'right'}
	class:snap-top={pendingLockSide === 'top'}
	class:snap-bottom={pendingLockSide === 'bottom'}
	class:snap-target-left={snapTargetSide === 'left'}
	class:snap-target-right={snapTargetSide === 'right'}
	class:snap-target-top={snapTargetSide === 'top'}
	class:snap-target-bottom={snapTargetSide === 'bottom'}
	style:left="{node.x}px"
	style:top="{node.y}px"
	style:width="{node.width}px"
	style:height="{node.height}px"
	style:overflow={isSelected ? 'visible' : 'hidden'}
	style:--node-color={nodeColor}
	data-node-id={node.id}
	onmousedown={handleMouseDown}
	ondblclick={handleDblClick}
>
	<div class="object-content">
		{#if children}
			{@render children()}
		{/if}
	</div>

	{#if isSelected}
		<div class="selection-indicator"></div>

		<!-- Resize handle - positioned outside bottom-right corner -->
		<!-- Hidden when node is part of a locked cluster to prevent visual desync -->
		{#if !isInLockedCluster}
			<div
				class="resize-handle"
				onmousedown={handleResizeMouseDown}
				aria-label="Resize"
				title="Resize"
			></div>
		{/if}
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

	/* Ghost nodes - hidden by filter but locked to visible nodes */
	.canvas-object.ghost {
		opacity: 0.35;
		border-style: dashed;
		pointer-events: none;
	}

	.canvas-object.ghost .object-content {
		pointer-events: none;
	}

	.canvas-object.selected {
		border-color: var(--selection);
		box-shadow: 0 0 0 2px var(--selection-bg);
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
		border-radius: calc(var(--radius-md) + 2px);
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
		border-radius: 4px;
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
		transform: scale(1.25);
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		inset: 3px;
		border-bottom: 2px solid var(--border-strong);
		border-right: 2px solid var(--border-strong);
		transform: rotate(0deg);
	}

	/* Link mode styles */
	.canvas-object.link-mode-active {
		cursor: pointer;
		transition:
			border-color var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	/* Hover state for non-source nodes (weaker outline) */
	.canvas-object.link-mode-active:not(.link-source):hover {
		border-color: var(--accent-muted);
		box-shadow: 0 0 0 1px var(--accent-muted);
	}

	/* Source node (strong outline) */
	.canvas-object.link-source {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-muted);
	}

	.canvas-object.link-source::before {
		content: 'Source';
		position: absolute;
		top: -24px;
		left: 50%;
		transform: translateX(-50%);
		padding: 2px 8px;
		background: var(--accent);
		color: white;
		font-size: 11px;
		font-weight: 500;
		border-radius: var(--radius-sm);
		white-space: nowrap;
		z-index: 10;
	}

	/* Snap-lock preview - thicker border on snapped edge (dragged node) */
	.canvas-object.snap-left {
		border-left-width: 3px;
		border-left-color: var(--accent);
	}

	.canvas-object.snap-right {
		border-right-width: 3px;
		border-right-color: var(--accent);
	}

	.canvas-object.snap-top {
		border-top-width: 3px;
		border-top-color: var(--accent);
	}

	.canvas-object.snap-bottom {
		border-bottom-width: 3px;
		border-bottom-color: var(--accent);
	}

	/* Snap-lock preview - target node (node being snapped TO) */
	.canvas-object.snap-target-left {
		border-left-width: 3px;
		border-left-color: var(--accent);
	}

	.canvas-object.snap-target-right {
		border-right-width: 3px;
		border-right-color: var(--accent);
	}

	.canvas-object.snap-target-top {
		border-top-width: 3px;
		border-top-color: var(--accent);
	}

	.canvas-object.snap-target-bottom {
		border-bottom-width: 3px;
		border-bottom-color: var(--accent);
	}

	/* Locked cluster visual - glow when any node in cluster is selected */
	/* Uses node color if present, otherwise selection color */
	.canvas-object.cluster-selected {
		--cluster-glow: var(--node-color, var(--selection));
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--cluster-glow) 30%, transparent),
			0 0 12px 4px color-mix(in srgb, var(--cluster-glow) 25%, transparent);
	}

	.canvas-object.cluster-selected.selected {
		box-shadow:
			0 0 0 2px var(--selection-bg),
			0 0 16px 6px color-mix(in srgb, var(--cluster-glow, var(--selection)) 30%, transparent);
	}
</style>
