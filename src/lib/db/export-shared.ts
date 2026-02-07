/**
 * Shared edge geometry functions for canvas rendering and export.
 * Pure math — no Svelte dependencies.
 */
import type { CanvasEdge, CanvasNode, Side } from '$lib/types/canvas';
import { resolveColor } from '$lib/types/canvas';

export interface Point {
	x: number;
	y: number;
}

/** Build a lookup map from node array for efficient access. */
export function buildNodeMap(nodes: CanvasNode[]): Map<string, CanvasNode> {
	const map = new Map<string, CanvasNode>();
	for (const node of nodes) {
		map.set(node.id, node);
	}
	return map;
}

/** Calculate connection point on a node's side. */
export function getConnectionPoint(
	node: CanvasNode,
	side: Side | undefined,
	otherNode: CanvasNode
): Point {
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

/** Calculate bezier curve path string for an edge. */
export function getEdgePath(edge: CanvasEdge, nodeMap: Map<string, CanvasNode>): string | null {
	const fromNode = nodeMap.get(edge.fromNode);
	const toNode = nodeMap.get(edge.toNode);

	if (!fromNode || !toNode) return null;

	const from = getConnectionPoint(fromNode, edge.fromSide, toNode);
	const to = getConnectionPoint(toNode, edge.toSide, fromNode);

	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const distance = Math.sqrt(dx * dx + dy * dy);
	const curvature = Math.min(distance * 0.3, 50);

	let cp1x = from.x;
	let cp1y = from.y;
	let cp2x = to.x;
	let cp2y = to.y;

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

/** Calculate arrow transform at the end (toNode) of an edge. */
export function getArrowTransform(edge: CanvasEdge, nodeMap: Map<string, CanvasNode>): string | null {
	const fromNode = nodeMap.get(edge.fromNode);
	const toNode = nodeMap.get(edge.toNode);

	if (!fromNode || !toNode) return null;

	const to = getConnectionPoint(toNode, edge.toSide, fromNode);
	const from = getConnectionPoint(fromNode, edge.fromSide, toNode);

	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const angle = Math.atan2(dy, dx) * (180 / Math.PI);

	return `translate(${to.x}, ${to.y}) rotate(${angle})`;
}

/** Calculate arrow transform at the start (fromNode) of an edge. */
export function getArrowStartTransform(edge: CanvasEdge, nodeMap: Map<string, CanvasNode>): string | null {
	const fromNode = nodeMap.get(edge.fromNode);
	const toNode = nodeMap.get(edge.toNode);

	if (!fromNode || !toNode) return null;

	const from = getConnectionPoint(fromNode, edge.fromSide, toNode);
	const to = getConnectionPoint(toNode, edge.toSide, fromNode);

	const dx = from.x - to.x;
	const dy = from.y - to.y;
	const angle = Math.atan2(dy, dx) * (180 / Math.PI);

	return `translate(${from.x}, ${from.y}) rotate(${angle})`;
}

/** Calculate midpoint of an edge for label positioning. */
export function getEdgeMidpoint(edge: CanvasEdge, nodeMap: Map<string, CanvasNode>): Point | null {
	const fromNode = nodeMap.get(edge.fromNode);
	const toNode = nodeMap.get(edge.toNode);

	if (!fromNode || !toNode) return null;

	const from = getConnectionPoint(fromNode, edge.fromSide, toNode);
	const to = getConnectionPoint(toNode, edge.toSide, fromNode);

	return {
		x: (from.x + to.x) / 2,
		y: (from.y + to.y) / 2
	};
}

/** Resolve edge color to a CSS-usable value. */
export function getEdgeColor(edge: CanvasEdge): string {
	return resolveColor(edge.color) ?? 'var(--text-muted)';
}

/** Check if edge has an arrow at the end (toNode). */
export function hasArrowEnd(edge: CanvasEdge): boolean {
	return edge.toEnd !== 'none';
}

/** Check if edge has an arrow at the start (fromNode). */
export function hasArrowStart(edge: CanvasEdge): boolean {
	return edge.fromEnd === 'arrow';
}
