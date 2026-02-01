<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import type { CanvasEdge, CanvasNode, Side } from '$lib/types/canvas';
	import { resolveColor } from '$lib/types/canvas';

	// Link mode state
	let isLinkMode = $derived(canvasStore.isLinkMode);

	// Renderable node IDs (visible + ghost nodes)
	let renderableNodeIds = $derived(new Set(canvasStore.renderableNodes.map((n) => n.id)));

	// Only show edges where both nodes are rendered (visible or ghost)
	let visibleEdges = $derived(
		canvasStore.edges.filter(
			(edge) => renderableNodeIds.has(edge.fromNode) && renderableNodeIds.has(edge.toNode)
		)
	);

	// Ghost node IDs for styling edges to ghost nodes
	let ghostNodeIds = $derived(canvasStore.ghostNodeIds);

	// Track hovered edge for delete UI
	let hoveredEdgeId = $state<string | null>(null);

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

	// Calculate midpoint of edge for delete button
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

	// Handle edge click in link mode (delete)
	function handleEdgeClick(edgeId: string, e: MouseEvent) {
		if (isLinkMode) {
			e.stopPropagation();
			canvasStore.deleteEdge(edgeId);
		}
	}
</script>

<svg class="edge-layer" class:link-mode={isLinkMode} xmlns="http://www.w3.org/2000/svg">
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
		{@const isGhostEdge = ghostNodeIds.has(edge.fromNode) || ghostNodeIds.has(edge.toNode)}
		{#if path}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- Edge group for interaction -->
			<g
				class="edge-group"
				class:hovered={isHovered}
				onmouseenter={() => { if (isLinkMode) hoveredEdgeId = edge.id; }}
				onmouseleave={() => { hoveredEdgeId = null; }}
				onclick={(e) => handleEdgeClick(edge.id, e)}
			>
				<!-- Invisible wider path for easier hovering -->
				{#if isLinkMode}
					<path
						d={path}
						fill="none"
						stroke="transparent"
						stroke-width="16"
						stroke-linecap="round"
						class="edge-hitarea"
					/>
				{/if}

				<!-- Edge line -->
				<path
					d={path}
					fill="none"
					stroke={color}
					stroke-width="2"
					stroke-linecap="round"
					stroke-dasharray={isGhostEdge ? '4 4' : 'none'}
					class="edge-path"
					opacity={isGhostEdge ? 0.35 : isLinkMode && !isHovered ? 0.4 : 1}
				/>

				<!-- Arrow at end -->
				{#if hasArrowEnd(edge)}
					{@const transform = getArrowTransform(edge)}
					{#if transform}
						<g {transform} opacity={isGhostEdge ? 0.35 : isLinkMode && !isHovered ? 0.4 : 1}>
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

				<!-- Delete button in link mode -->
				{#if isLinkMode && isHovered && midpoint}
					<circle
						cx={midpoint.x}
						cy={midpoint.y}
						r="12"
						fill="var(--destructive)"
						class="delete-circle"
					/>
					<text
						x={midpoint.x}
						y={midpoint.y}
						text-anchor="middle"
						dominant-baseline="central"
						fill="white"
						font-size="16"
						font-weight="bold"
						class="delete-icon"
					>×</text>
				{/if}
			</g>

			<!-- Label if present (outside group so it doesn't interfere with interaction) -->
			{#if edge.label && midpoint}
				<text
					x={midpoint.x}
					y={midpoint.y - 16}
					text-anchor="middle"
					dominant-baseline="middle"
					class="edge-label"
					fill={color}
					opacity={isLinkMode ? 0.4 : 1}
				>
					{edge.label}
				</text>
			{/if}
		{/if}
	{/each}
</svg>

<style>
	.edge-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}

	.edge-layer.link-mode {
		pointer-events: auto;
	}

	.edge-group {
		cursor: default;
	}

	.edge-layer.link-mode .edge-group {
		cursor: pointer;
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
		opacity: 1 !important;
	}

	.delete-circle {
		cursor: pointer;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
		transition: transform var(--transition-fast);
	}

	.delete-circle:hover {
		transform: scale(1.1);
	}

	.delete-icon {
		pointer-events: none;
		user-select: none;
	}

	.edge-label {
		font-family: var(--font-sans);
		font-size: 12px;
		pointer-events: none;
		user-select: none;
		transition: opacity var(--transition-fast);
	}
</style>
