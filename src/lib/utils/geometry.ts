import type { CanvasNode } from '$lib/types/canvas';

export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Check if inner bounds are fully contained within outer bounds.
 * Uses strict containment (all four edges must be inside).
 */
export function isContainedWithin(inner: Bounds, outer: Bounds): boolean {
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.width <= outer.x + outer.width &&
		inner.y + inner.height <= outer.y + outer.height
	);
}

/**
 * Calculate bounding box that encompasses all given nodes.
 * Returns null if nodes array is empty.
 */
export function calculateBoundingBox(nodes: CanvasNode[]): Bounds | null {
	if (nodes.length === 0) return null;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const node of nodes) {
		minX = Math.min(minX, node.x);
		minY = Math.min(minY, node.y);
		maxX = Math.max(maxX, node.x + node.width);
		maxY = Math.max(maxY, node.y + node.height);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
}

/**
 * Find all nodes spatially contained within a group's bounds.
 * Excludes the group itself from results.
 */
export function getContainedNodes(group: CanvasNode, allNodes: CanvasNode[]): CanvasNode[] {
	const groupBounds: Bounds = {
		x: group.x,
		y: group.y,
		width: group.width,
		height: group.height
	};

	return allNodes.filter((node) => {
		// Skip the group itself
		if (node.id === group.id) return false;

		const nodeBounds: Bounds = {
			x: node.x,
			y: node.y,
			width: node.width,
			height: node.height
		};

		return isContainedWithin(nodeBounds, groupBounds);
	});
}

