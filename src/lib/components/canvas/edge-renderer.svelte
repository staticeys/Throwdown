<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import type { CanvasEdge, CanvasNode, Side } from '$lib/types/canvas';
	import { resolveColor } from '$lib/types/canvas';

	// Props for dispatching events to parent
	let {
		oncontextmenu
	}: {
		oncontextmenu?: (e: MouseEvent, edgeId: string) => void;
	} = $props();

	// Renderable node IDs (visible + ghost nodes)
	let renderableNodeIds = $derived(new Set(canvasStore.renderableNodes.map((n) => n.id)));

	// Only show edges where both nodes are rendered
	let visibleEdges = $derived(
		canvasStore.edges.filter(
			(edge) => renderableNodeIds.has(edge.fromNode) && renderableNodeIds.has(edge.toNode)
		)
	);

	// Track hovered edge for delete UI
	let hoveredEdgeId = $state<string | null>(null);

	// Track edge being edited for label
	let editingEdgeId = $state<string | null>(null);
	let editingLabel = $state('');
	// svelte-ignore non_reactive_update
	let inputEl: HTMLInputElement;

	// Get node by ID
	function getNode(id: string): CanvasNode | undefined {
		return canvasStore.nodes.find(n => n.id === id);
	}

	// Calculate connection point on a node's side
	function getConnectionPoint(
		node: CanvasNode,
		side: Side | undefined,
		otherNode: CanvasNode
	): { x: number; y: number } {
		const centerX = node.x + node.width / 2;
		const centerY = node.y + node.height / 2;

		// If side is specified, use it
		if (side) {
			switch (side) {
				case 'top':
					return { x: centerX, y: node.y };
				case 'bottom':
					return { x: centerX, y: node.y + node.height };
				case 'left':
					return { x: node.x, y: centerY };
				case 'right':
					return { x: node.x + node.width, y: centerY };
			}
		}

		// Auto-calculate best side based on other node position
		const otherCenterX = otherNode.x + otherNode.width / 2;
		const otherCenterY = otherNode.y + otherNode.height / 2;

		const dx = otherCenterX - centerX;
		const dy = otherCenterY - centerY;

		// Determine which side to connect from
		if (Math.abs(dx) > Math.abs(dy)) {
			// Horizontal connection
			if (dx > 0) {
				return { x: node.x + node.width, y: centerY };
			} else {
				return { x: node.x, y: centerY };
			}
		} else {
			// Vertical connection
			if (dy > 0) {
				return { x: centerX, y: node.y + node.height };
			} else {
				return { x: centerX, y: node.y };
			}
		}
	}

	// Calculate edge path data
	function getEdgePath(edge: CanvasEdge): string | null {
		const fromNode = getNode(edge.fromNode);
		const toNode = getNode(edge.toNode);

		if (!fromNode || !toNode) return null;

		const from = getConnectionPoint(fromNode, edge.fromSide, toNode);
		const to = getConnectionPoint(toNode, edge.toSide, fromNode);

		// Calculate control points for a bezier curve
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const curvature = Math.min(distance * 0.3, 50);

		// Determine curve direction based on connection points
		let cp1x = from.x;
		let cp1y = from.y;
		let cp2x = to.x;
		let cp2y = to.y;

		// Adjust control points based on which sides are connected
		if (Math.abs(dx) > Math.abs(dy)) {
			// Mostly horizontal
			cp1x = from.x + (dx > 0 ? curvature : -curvature);
			cp2x = to.x + (dx > 0 ? -curvature : curvature);
		} else {
			// Mostly vertical
			cp1y = from.y + (dy > 0 ? curvature : -curvature);
			cp2y = to.y + (dy > 0 ? -curvature : curvature);
		}

		return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
	}

	// Calculate arrow marker position and rotation
	function getArrowTransform(edge: CanvasEdge): string | null {
		const fromNode = getNode(edge.fromNode);
		const toNode = getNode(edge.toNode);

		if (!fromNode || !toNode) return null;

		const to = getConnectionPoint(toNode, edge.toSide, fromNode);
		const from = getConnectionPoint(fromNode, edge.fromSide, toNode);

		// Calculate angle for arrow rotation
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const angle = Math.atan2(dy, dx) * (180 / Math.PI);

		return `translate(${to.x}, ${to.y}) rotate(${angle})`;
	}

	// Calculate arrow transform for start arrow (reversed direction)
	function getArrowStartTransform(edge: CanvasEdge): string | null {
		const fromNode = getNode(edge.fromNode);
		const toNode = getNode(edge.toNode);

		if (!fromNode || !toNode) return null;

		const from = getConnectionPoint(fromNode, edge.fromSide, toNode);
		const to = getConnectionPoint(toNode, edge.toSide, fromNode);

		// Calculate angle pointing away from the edge (reversed)
		const dx = from.x - to.x;
		const dy = from.y - to.y;
		const angle = Math.atan2(dy, dx) * (180 / Math.PI);

		return `translate(${from.x}, ${from.y}) rotate(${angle})`;
	}

	// Get edge color
	function getEdgeColor(edge: CanvasEdge): string {
		return resolveColor(edge.color) ?? 'var(--text-muted)';
	}

	// Check if edge should show arrow at end
	function hasArrowEnd(edge: CanvasEdge): boolean {
		return edge.toEnd !== 'none';
	}

	// Check if edge should show arrow at start
	function hasArrowStart(edge: CanvasEdge): boolean {
		return edge.fromEnd === 'arrow';
	}

	// Calculate midpoint of edge for delete button and label
	function getEdgeMidpoint(edge: CanvasEdge): { x: number; y: number } | null {
		const fromNode = getNode(edge.fromNode);
		const toNode = getNode(edge.toNode);

		if (!fromNode || !toNode) return null;

		const from = getConnectionPoint(fromNode, edge.fromSide, toNode);
		const to = getConnectionPoint(toNode, edge.toSide, fromNode);

		return {
			x: (from.x + to.x) / 2,
			y: (from.y + to.y) / 2
		};
	}

	// Handle context menu
	function handleContextMenu(edgeId: string, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		oncontextmenu?.(e, edgeId);
	}

	// Handle double-click for label editing
	function handleDoubleClick(edge: CanvasEdge, e: MouseEvent) {
		e.stopPropagation();
		startEditing(edge);
	}

	// Start editing a label
	export function startEditing(edge: CanvasEdge) {
		editingEdgeId = edge.id;
		editingLabel = edge.label ?? '';
		canvasStore.setEditingText(true);
		requestAnimationFrame(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	// Save label and stop editing
	function saveLabel() {
		if (editingEdgeId) {
			canvasStore.updateEdge(editingEdgeId, { label: editingLabel || undefined });
			editingEdgeId = null;
			editingLabel = '';
			canvasStore.setEditingText(false);
		}
	}

	// Cancel editing
	function cancelEditing() {
		editingEdgeId = null;
		editingLabel = '';
		canvasStore.setEditingText(false);
	}

	// Handle input keydown
	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveLabel();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEditing();
		}
	}
</script>

<svg class="edge-layer" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<!-- Arrow marker definition -->
		<marker
			id="arrowhead"
			markerWidth="10"
			markerHeight="8"
			refX="9"
			refY="4"
			orient="auto"
			markerUnits="strokeWidth"
		>
			<path d="M 0 0 L 10 4 L 0 8 z" fill="var(--text-muted)" />
		</marker>
	</defs>

	{#each visibleEdges as edge (edge.id)}
		{@const path = getEdgePath(edge)}
		{@const color = getEdgeColor(edge)}
		{@const midpoint = getEdgeMidpoint(edge)}
		{@const isHovered = hoveredEdgeId === edge.id}
		{@const isEditing = editingEdgeId === edge.id}
		{#if path}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- Edge group for interaction -->
			<g
				class="edge-group"
				class:hovered={isHovered}
				onmouseenter={() => { hoveredEdgeId = edge.id; }}
				onmouseleave={() => { hoveredEdgeId = null; }}
				oncontextmenu={(e) => handleContextMenu(edge.id, e)}
				ondblclick={(e) => handleDoubleClick(edge, e)}
			>
				<!-- Invisible wider path for easier hovering -->
				<path
					d={path}
					fill="none"
					stroke="transparent"
					stroke-width="16"
					stroke-linecap="round"
					class="edge-hitarea"
				/>

				<!-- Edge line -->
				<path
					d={path}
					fill="none"
					stroke={color}
					stroke-width="2"
					stroke-linecap="round"
					stroke-dasharray="none"
					class="edge-path"
				/>

				<!-- Arrow at end -->
				{#if hasArrowEnd(edge)}
					{@const transform = getArrowTransform(edge)}
					{#if transform}
						<g {transform}>
							<path
								d="M -8 -4 L 0 0 L -8 4"
								fill="none"
								stroke={color}
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</g>
					{/if}
				{/if}

				<!-- Arrow at start -->
				{#if hasArrowStart(edge)}
					{@const transform = getArrowStartTransform(edge)}
					{#if transform}
						<g {transform}>
							<path
								d="M -8 -4 L 0 0 L -8 4"
								fill="none"
								stroke={color}
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</g>
					{/if}
				{/if}

			</g>

			<!-- Label (outside group so it doesn't interfere with interaction) -->
			{#if midpoint}
				{#if isEditing}
					<!-- Label editing input -->
					<foreignObject
						x={midpoint.x - 75}
						y={midpoint.y - 28}
						width="150"
						height="36"
					>
						<input
							type="text"
							class="edge-label-input"
							bind:this={inputEl}
							bind:value={editingLabel}
							onblur={saveLabel}
							onkeydown={handleInputKeydown}
						/>
					</foreignObject>
				{:else if edge.label}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<foreignObject
						x={midpoint.x - 100}
						y={midpoint.y - 28}
						width="200"
						height="24"
						class="edge-label-container"
						ondblclick={(e) => handleDoubleClick(edge, e)}
					>
						<div class="edge-label" style:color={edge.color ? color : ''}>
							{edge.label}
						</div>
					</foreignObject>
				{/if}
			{/if}
		{/if}
	{/each}
</svg>

<style>
	.edge-layer {
		position: absolute;
		top: 0;
		left: 0;
		/* Use explicit dimensions instead of 100% since parent has no size.
		   Chromium won't render SVG content from a 0x0 element even with overflow:visible */
		width: 1px;
		height: 1px;
		pointer-events: none;
		overflow: visible;
	}

	.edge-group {
		cursor: default;
		pointer-events: auto;
	}

	.edge-path {
		transition:
			stroke var(--transition-fast),
			opacity var(--transition-fast);
	}

	.edge-hitarea {
		cursor: pointer;
	}

	.edge-group.hovered .edge-path {
		stroke-width: 3;
	}

	.edge-label-container {
		overflow: visible;
		pointer-events: auto;
		cursor: text;
	}

	.edge-label {
		display: flex;
		justify-content: center;
		padding: var(--space-0) calc(var(--space-1) + var(--space-0));
		background: var(--bg-surface);
		border-radius: var(--radius-sm);
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--text-secondary);
		white-space: nowrap;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		user-select: none;
		width: fit-content;
		margin: 0 auto;
		cursor: text;
	}

	.edge-label-input {
		width: 100%;
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: 12px;
		text-align: center;
		background: var(--bg-surface);
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		outline: none;
		box-shadow: var(--shadow-md);
	}
</style>
