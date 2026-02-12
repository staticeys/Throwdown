<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { isTextNode, isLinkNode, isGroupNode, createFileNode, type NodeColor } from '$lib/types/canvas';
	import { isOPFSSupported, saveFileToOPFS, canSaveFile } from '$lib/platform/fs-opfs';
	import EdgeRenderer from './edge-renderer.svelte';
	import AlignmentGuides from './alignment-guides.svelte';
	import SelectionBox from './selection-box.svelte';
	import CanvasMinimap from './canvas-minimap.svelte';

	// Props
	let {
		children,
		onedgecontextmenu
	} = $props<{
		children?: import('svelte').Snippet;
		onedgecontextmenu?: (e: MouseEvent, edgeId: string) => void;
	}>();

	// Edge renderer reference
	let edgeRendererRef: EdgeRenderer;

	// Local state for drag interactions
	let isPanning = $state(false);
	let isSpacePressed = $state(false);
	let lastMousePos = $state({ x: 0, y: 0 });
	let didPan = $state(false);

	// Selection box state
	let isSelecting = $state(false);
	let selectionStart = $state<{ x: number; y: number } | null>(null);
	let selectionEnd = $state<{ x: number; y: number } | null>(null);

	// File drag-drop state
	let isDraggingFile = $state(false);

	// Element reference
	let containerEl: HTMLDivElement;

	// Container dimensions for minimap viewport indicator
	let containerWidth = $state(0);
	let containerHeight = $state(0);

	// Derived viewport values
	let viewport = $derived(canvasStore.viewport);
	let transform = $derived(
		`translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
	);

	// Convert screen coordinates to canvas coordinates
	export function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
		const rect = containerEl?.getBoundingClientRect();
		if (!rect) return { x: screenX, y: screenY };

		return {
			x: (screenX - rect.left - viewport.x) / viewport.zoom,
			y: (screenY - rect.top - viewport.y) / viewport.zoom
		};
	}

	// Convert canvas coordinates to screen coordinates
	export function canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
		const rect = containerEl?.getBoundingClientRect();
		if (!rect) return { x: canvasX, y: canvasY };

		return {
			x: canvasX * viewport.zoom + viewport.x + rect.left,
			y: canvasY * viewport.zoom + viewport.y + rect.top
		};
	}

	// Start editing an edge label
	export function startEditingEdge(edgeId: string): void {
		const edge = canvasStore.getEdge(edgeId);
		if (edge) {
			edgeRendererRef?.startEditing(edge);
		}
	}

	// Handle mouse down - start panning or box selection
	function handleMouseDown(e: MouseEvent) {
		const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
		const isMultiSelect = isMac ? e.metaKey : e.ctrlKey;

		// Cmd/Ctrl + left click starts box selection
		if (e.button === 0 && isMultiSelect && !isSpacePressed) {
			isSelecting = true;
			const canvasCoords = screenToCanvas(e.clientX, e.clientY);
			selectionStart = canvasCoords;
			selectionEnd = canvasCoords;
			return;
		}

		// Left click on empty space pans; nodes stop propagation so this won't fire when clicking a node
		if (e.button === 0 && !isSpacePressed) {
			isPanning = true;
			didPan = false;
			lastMousePos = { x: e.clientX, y: e.clientY };
			containerEl.style.cursor = 'grabbing';
			return;
		}

		// Middle mouse button or space+left click
		if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
			e.preventDefault();
			isPanning = true;
			didPan = false;
			lastMousePos = { x: e.clientX, y: e.clientY };
			containerEl.style.cursor = 'grabbing';
		}
	}

	// Handle mouse move - pan or update selection box
	function handleMouseMove(e: MouseEvent) {
		if (isSelecting) {
			const canvasCoords = screenToCanvas(e.clientX, e.clientY);
			selectionEnd = canvasCoords;
			return;
		}

		if (isPanning) {
			const dx = e.clientX - lastMousePos.x;
			const dy = e.clientY - lastMousePos.y;
			canvasStore.pan(dx, dy);
			lastMousePos = { x: e.clientX, y: e.clientY };
			didPan = true;
		}
	}

	// Handle mouse up - stop panning or finalize selection
	function handleMouseUp(e: MouseEvent) {
		if (isSelecting && selectionStart && selectionEnd) {
			// Calculate selection box bounds
			const x1 = Math.min(selectionStart.x, selectionEnd.x);
			const y1 = Math.min(selectionStart.y, selectionEnd.y);
			const x2 = Math.max(selectionStart.x, selectionEnd.x);
			const y2 = Math.max(selectionStart.y, selectionEnd.y);

			console.log('[BoxSelect] Box bounds:', { x1, y1, x2, y2 });
			console.log('[BoxSelect] Nodes to check:', canvasStore.nodes.length);

			// Find nodes that intersect with selection box
			const selectedIds: string[] = [];
			for (const node of canvasStore.nodes) {
				const nodeX2 = node.x + node.width;
				const nodeY2 = node.y + node.height;

				console.log('[BoxSelect] Checking node:', node.id, { x: node.x, y: node.y, x2: nodeX2, y2: nodeY2 });

				// Check if boxes overlap (partial intersection)
				if (!(x2 < node.x || x1 > nodeX2 || y2 < node.y || y1 > nodeY2)) {
					console.log('[BoxSelect] Node intersects:', node.id);
					selectedIds.push(node.id);
				}
			}

			console.log('[BoxSelect] Selected IDs:', selectedIds);

			// Update selection using setSelection for proper Svelte 5 reactivity
			if (selectedIds.length > 0) {
				canvasStore.setSelection(selectedIds);
			}

			// Reset selection box
			isSelecting = false;
			selectionStart = null;
			selectionEnd = null;

			// Prevent click after box selection so canvas click handlers don't clear the selection
			const preventClick = (event: MouseEvent) => {
				event.stopPropagation();
				event.preventDefault();
				containerEl.removeEventListener('click', preventClick, true);
			};
			containerEl.addEventListener('click', preventClick, true);
			return;
		}

		if (isPanning) {
			isPanning = false;
			containerEl.style.cursor = isSpacePressed ? 'grab' : 'default';

			// Prevent click after a pan so canvas click handlers don't misfire
			if (didPan) {
				const preventClick = (event: MouseEvent) => {
					event.stopPropagation();
					event.preventDefault();
					containerEl.removeEventListener('click', preventClick, true);
				};
				containerEl.addEventListener('click', preventClick, true);
			}
		}
	}

	// Check if an element or its ancestors has scrollable content
	function hasScrollableContent(element: HTMLElement): boolean {
		let el: HTMLElement | null = element;

		while (el && el !== containerEl) {
			const style = getComputedStyle(el);
			const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';

			if (isScrollable && el.scrollHeight > el.clientHeight) {
				return true;
			}
			el = el.parentElement;
		}
		return false;
	}

	// Find the node ID from an element by walking up to find data-node-id attribute
	function getNodeIdFromElement(element: HTMLElement): string | null {
		let el: HTMLElement | null = element;

		while (el && el !== containerEl) {
			const nodeId = el.dataset.nodeId;
			if (nodeId) {
				return nodeId;
			}
			el = el.parentElement;
		}
		return null;
	}

	// Handle wheel - zoom (unless over selected/editing node with scrollable content)
	function handleWheel(e: WheelEvent) {
		// Only allow scrolling within a node if it's selected or being edited
		const nodeId = getNodeIdFromElement(e.target as HTMLElement);
		const isNodeSelected = nodeId && canvasStore.selection.includes(nodeId);
		const isEditing = canvasStore.isEditingText;

		if ((isNodeSelected || isEditing) && hasScrollableContent(e.target as HTMLElement)) {
			return;
		}

		e.preventDefault();

		const rect = containerEl.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Use deltaY magnitude for smoother zoom (works better with trackpads)
		// Dampening factor: smaller = less sensitive, larger = more sensitive
		const zoomIntensity = 0.002;
		const delta = 1 - e.deltaY * zoomIntensity;

		// Zoom toward mouse position
		const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * delta));
		const scale = newZoom / viewport.zoom;

		canvasStore.setViewport({
			x: mouseX - (mouseX - viewport.x) * scale,
			y: mouseY - (mouseY - viewport.y) * scale,
			zoom: newZoom
		});
	}

	// Handle keyboard events
	function handleKeyDown(e: KeyboardEvent) {
		// Ignore if typing in an input
		const target = e.target as HTMLElement;
		const isTyping = target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable;

		// Space for panning
		if (e.code === 'Space' && !isSpacePressed && !isTyping) {
			e.preventDefault();
			isSpacePressed = true;
			if (containerEl && !isPanning) {
				containerEl.style.cursor = 'grab';
			}
			return;
		}

		// Skip other shortcuts if typing
		if (isTyping) return;

		// Cmd/Ctrl + Z — Undo
		if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
			e.preventDefault();
			canvasStore.undo();
			return;
		}

		// Cmd/Ctrl + Y or Cmd/Ctrl + Shift + Z — Redo
		if ((e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) ||
			(e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
			e.preventDefault();
			canvasStore.redo();
			return;
		}

		// L (without modifiers) - Link selected nodes
		if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey) {
			e.preventDefault();
			canvasStore.linkSelectedNodes();
			return;
		}

		// Delete or Backspace - Delete selected nodes
		if (e.code === 'Delete' || e.code === 'Backspace') {
			e.preventDefault();
			canvasStore.deleteSelectedNodes();
			return;
		}

		// Escape - Clear selection
		if (e.code === 'Escape') {
			e.preventDefault();
			canvasStore.clearSelection();
			return;
		}

		// Ctrl/Cmd + A - Select all
		if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			canvasStore.selectAll();
			return;
		}

		// Cmd/Ctrl + C - Copy selected node contents
		if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey) && canvasStore.selection.length > 0) {
			e.preventDefault();
			const contents: string[] = [];
			for (const id of canvasStore.selection) {
				const node = canvasStore.nodes.find((n) => n.id === id);
				if (!node) continue;
				if (isTextNode(node)) {
					contents.push(node.text);
				} else if (isLinkNode(node)) {
					contents.push(node.url);
				} else if (isGroupNode(node) && node.label) {
					contents.push(node.label);
				}
			}
			if (contents.length > 0) {
				navigator.clipboard.writeText(contents.join('\n'));
			}
			return;
		}

		// Cmd/Ctrl + G - Create group from selection
		if (e.code === 'KeyG' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
			e.preventDefault();
			if (canvasStore.selection.length > 0) {
				canvasStore.createGroupFromSelection();
			}
			return;
		}

		// Number keys 1-6 - Set node color (only if nodes are selected)
		if (canvasStore.selection.length > 0) {
			const colorMap: Record<string, NodeColor> = {
				'Digit1': '1',
				'Digit2': '2',
				'Digit3': '3',
				'Digit4': '4',
				'Digit5': '5',
				'Digit6': '6'
			};
			if (e.code in colorMap) {
				e.preventDefault();
				canvasStore.setSelectedNodesColor(colorMap[e.code]);
				return;
			}

			// 0 - Clear node color
			if (e.code === 'Digit0') {
				e.preventDefault();
				canvasStore.setSelectedNodesColor(undefined);
				return;
			}
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (e.code === 'Space') {
			isSpacePressed = false;
			if (containerEl && !isPanning) {
				containerEl.style.cursor = 'default';
			}
		}
	}

	// Prevent context menu on middle click
	function handleContextMenu(e: MouseEvent) {
		if (e.button === 1) {
			e.preventDefault();
		}
	}

	// Set up global keyboard listeners
	$effect(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	});

	// Track container dimensions for minimap
	$effect(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			containerWidth = entry.contentRect.width;
			containerHeight = entry.contentRect.height;
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	// Handle mouse leave - stop panning or selection if mouse leaves window
	function handleMouseLeave(e: MouseEvent) {
		if (isSelecting) {
			isSelecting = false;
			selectionStart = null;
			selectionEnd = null;
		}

		if (isPanning) {
			isPanning = false;
			containerEl.style.cursor = isSpacePressed ? 'grab' : 'default';
		}
	}

	// File drag-drop handlers
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer?.types.includes('Files')) {
			e.dataTransfer.dropEffect = 'copy';
			isDraggingFile = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		if (e.currentTarget === e.target) {
			isDraggingFile = false;
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDraggingFile = false;

		if (!isOPFSSupported()) return;

		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const dropPos = screenToCanvas(e.clientX, e.clientY);
		const x = dropPos.x - 100;
		const y = dropPos.y - 50;
		const STACK_OFFSET = 20;

		canvasStore.beginTransaction();

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			const hasSpace = await canSaveFile(file.size);
			if (!hasSpace) {
				console.error('Insufficient storage quota for file:', file.name);
				continue;
			}

			try {
				// Create node to get its ID, save file to OPFS first, then add node to store
				const node = createFileNode(
					x + (i * STACK_OFFSET),
					y + (i * STACK_OFFSET),
					file.name,
					file.type || 'application/octet-stream',
					file.size
				);

				await saveFileToOPFS(file, canvasStore.activeCanvasId, node.id);
				canvasStore.addNode(node);

				if (i === 0) {
					canvasStore.selectOnly(node.id);
				} else {
					canvasStore.select(node.id);
				}
			} catch (error) {
				console.error('Failed to save file:', file.name, error);
			}
		}

		canvasStore.endTransaction();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="canvas-container"
	bind:this={containerEl}
	onmousedown={handleMouseDown}
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
	onmouseleave={handleMouseLeave}
	onwheel={handleWheel}
	oncontextmenu={handleContextMenu}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="application"
	aria-label="Canvas workspace"
	tabindex="0"
>
	<!-- Canvas content layer -->
	<div class="canvas-content" style:transform>
		<!-- Edges rendered below nodes -->
		<EdgeRenderer
			bind:this={edgeRendererRef}
			oncontextmenu={onedgecontextmenu}
		/>

		<!-- Nodes -->
		{#if children}
			{@render children()}
		{/if}

		<!-- Alignment guides rendered on top -->
		<AlignmentGuides />

		<!-- Selection box -->
		{#if isSelecting}
			<SelectionBox start={selectionStart} end={selectionEnd} />
		{/if}
	</div>

	<!-- Minimap + zoom controls -->
	<CanvasMinimap {containerWidth} {containerHeight} />

	<!-- File drop zone overlay -->
	{#if isDraggingFile}
		<div class="drop-zone">
			<div class="drop-zone-content">
				<div class="drop-zone-text">Drop files here</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.canvas-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background-color: var(--bg-canvas);
		outline: none;
	}

	.canvas-content {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 0 0;
	}

	.drop-zone {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		border: 3px dashed var(--accent);
		z-index: 1000;
		pointer-events: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.drop-zone-content {
		padding: var(--space-4) var(--space-6);
		background: var(--bg-surface);
		box-shadow: var(--shadow-lg);
	}

	.drop-zone-text {
		font-family: var(--font-sans);
		font-size: var(--font-size-md);
		font-weight: 500;
		color: var(--accent);
	}
</style>
