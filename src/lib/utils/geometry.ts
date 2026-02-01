import type { CanvasNode, Side } from '$lib/types/canvas';

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

/**
 * Result of edge snap detection
 */
export interface SnapResult {
	targetNode: CanvasNode;
	draggedSide: Side;
	targetSide: Side;
	snapX: number;
	snapY: number;
	distance: number;
}

/**
 * Get the edge position for a given side of a node
 */
function getEdgePosition(node: CanvasNode, side: Side): number {
	switch (side) {
		case 'left':
			return node.x;
		case 'right':
			return node.x + node.width;
		case 'top':
			return node.y;
		case 'bottom':
			return node.y + node.height;
	}
}

/**
 * Check if two nodes have overlapping ranges on an axis
 * For horizontal snaps (left/right), check vertical overlap
 * For vertical snaps (top/bottom), check horizontal overlap
 */
function hasOverlap(
	dragged: CanvasNode,
	target: CanvasNode,
	axis: 'horizontal' | 'vertical'
): boolean {
	if (axis === 'vertical') {
		// Check if nodes overlap vertically (for left/right snaps)
		const draggedTop = dragged.y;
		const draggedBottom = dragged.y + dragged.height;
		const targetTop = target.y;
		const targetBottom = target.y + target.height;
		return draggedBottom > targetTop && draggedTop < targetBottom;
	} else {
		// Check if nodes overlap horizontally (for top/bottom snaps)
		const draggedLeft = dragged.x;
		const draggedRight = dragged.x + dragged.width;
		const targetLeft = target.x;
		const targetRight = target.x + target.width;
		return draggedRight > targetLeft && draggedLeft < targetRight;
	}
}

/**
 * Opposite sides for locking
 */
const OPPOSITE_SIDES: Record<Side, Side> = {
	left: 'right',
	right: 'left',
	top: 'bottom',
	bottom: 'top'
};

/**
 * Detect if a dragged node's edge is within snap threshold of another node's parallel edge.
 * Returns the closest snap result, or null if no snap is within threshold.
 */
export function detectEdgeSnap(
	dragged: CanvasNode,
	others: CanvasNode[],
	threshold: number = 8
): SnapResult | null {
	let closestSnap: SnapResult | null = null;

	for (const target of others) {
		if (target.id === dragged.id) continue;

		// Check all four edge pairs
		const edgePairs: Array<{ draggedSide: Side; targetSide: Side; axis: 'horizontal' | 'vertical' }> =
			[
				{ draggedSide: 'right', targetSide: 'left', axis: 'vertical' },
				{ draggedSide: 'left', targetSide: 'right', axis: 'vertical' },
				{ draggedSide: 'bottom', targetSide: 'top', axis: 'horizontal' },
				{ draggedSide: 'top', targetSide: 'bottom', axis: 'horizontal' }
			];

		for (const { draggedSide, targetSide, axis } of edgePairs) {
			// Check if nodes have overlap on the perpendicular axis
			if (!hasOverlap(dragged, target, axis)) continue;

			const draggedEdge = getEdgePosition(dragged, draggedSide);
			const targetEdge = getEdgePosition(target, targetSide);
			const distance = Math.abs(draggedEdge - targetEdge);

			if (distance <= threshold) {
				// Calculate snap position
				let snapX = dragged.x;
				let snapY = dragged.y;

				if (draggedSide === 'right') {
					// Snap dragged's right edge to target's left edge
					snapX = targetEdge - dragged.width;
				} else if (draggedSide === 'left') {
					// Snap dragged's left edge to target's right edge
					snapX = targetEdge;
				} else if (draggedSide === 'bottom') {
					// Snap dragged's bottom edge to target's top edge
					snapY = targetEdge - dragged.height;
				} else if (draggedSide === 'top') {
					// Snap dragged's top edge to target's bottom edge
					snapY = targetEdge;
				}

				// Keep the closest snap
				if (!closestSnap || distance < closestSnap.distance) {
					closestSnap = {
						targetNode: target,
						draggedSide,
						targetSide,
						snapX,
						snapY,
						distance
					};
				}
			}
		}
	}

	return closestSnap;
}
