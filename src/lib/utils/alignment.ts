// Alignment guide calculation utilities

import type { CanvasNode } from '$lib/types/canvas';

export interface AlignmentGuides {
	vertical: number[];   // x-positions for vertical guide lines
	horizontal: number[]; // y-positions for horizontal guide lines
}

export interface AlignmentResult {
	guides: AlignmentGuides;
	snapX: number | null;  // x-position to snap to (null if no snap)
	snapY: number | null;  // y-position to snap to (null if no snap)
}

interface NodeBounds {
	left: number;
	right: number;
	top: number;
	bottom: number;
	centerX: number;
	centerY: number;
}

// Get bounds for a node
function getNodeBounds(node: { x: number; y: number; width: number; height: number }): NodeBounds {
	return {
		left: node.x,
		right: node.x + node.width,
		top: node.y,
		bottom: node.y + node.height,
		centerX: node.x + node.width / 2,
		centerY: node.y + node.height / 2
	};
}

// Calculate alignments between a dragging node and other nodes
export function calculateAlignments(
	draggingNode: { x: number; y: number; width: number; height: number },
	otherNodes: CanvasNode[],
	threshold = 8
): AlignmentResult {
	const result: AlignmentResult = {
		guides: { vertical: [], horizontal: [] },
		snapX: null,
		snapY: null
	};

	if (otherNodes.length === 0) {
		return result;
	}

	const dragging = getNodeBounds(draggingNode);

	// Track closest snap distances
	let closestSnapDistX = threshold + 1;
	let closestSnapDistY = threshold + 1;

	for (const other of otherNodes) {
		const target = getNodeBounds(other);

		// Vertical alignments (x-axis) - creates vertical guide lines
		// Left edge to left edge
		checkAlignment(
			dragging.left, target.left, threshold,
			(dist) => {
				if (dist < closestSnapDistX) {
					closestSnapDistX = dist;
					result.snapX = target.left;
				}
				if (dist <= threshold && !result.guides.vertical.includes(target.left)) {
					result.guides.vertical.push(target.left);
				}
			}
		);

		// Right edge to right edge
		checkAlignment(
			dragging.right, target.right, threshold,
			(dist) => {
				if (dist < closestSnapDistX) {
					closestSnapDistX = dist;
					result.snapX = target.right - draggingNode.width;
				}
				if (dist <= threshold && !result.guides.vertical.includes(target.right)) {
					result.guides.vertical.push(target.right);
				}
			}
		);

		// Left edge to right edge
		checkAlignment(
			dragging.left, target.right, threshold,
			(dist) => {
				if (dist < closestSnapDistX) {
					closestSnapDistX = dist;
					result.snapX = target.right;
				}
				if (dist <= threshold && !result.guides.vertical.includes(target.right)) {
					result.guides.vertical.push(target.right);
				}
			}
		);

		// Right edge to left edge
		checkAlignment(
			dragging.right, target.left, threshold,
			(dist) => {
				if (dist < closestSnapDistX) {
					closestSnapDistX = dist;
					result.snapX = target.left - draggingNode.width;
				}
				if (dist <= threshold && !result.guides.vertical.includes(target.left)) {
					result.guides.vertical.push(target.left);
				}
			}
		);

		// Center to center (horizontal)
		checkAlignment(
			dragging.centerX, target.centerX, threshold,
			(dist) => {
				if (dist < closestSnapDistX) {
					closestSnapDistX = dist;
					result.snapX = target.centerX - draggingNode.width / 2;
				}
				if (dist <= threshold && !result.guides.vertical.includes(target.centerX)) {
					result.guides.vertical.push(target.centerX);
				}
			}
		);

		// Horizontal alignments (y-axis) - creates horizontal guide lines
		// Top edge to top edge
		checkAlignment(
			dragging.top, target.top, threshold,
			(dist) => {
				if (dist < closestSnapDistY) {
					closestSnapDistY = dist;
					result.snapY = target.top;
				}
				if (dist <= threshold && !result.guides.horizontal.includes(target.top)) {
					result.guides.horizontal.push(target.top);
				}
			}
		);

		// Bottom edge to bottom edge
		checkAlignment(
			dragging.bottom, target.bottom, threshold,
			(dist) => {
				if (dist < closestSnapDistY) {
					closestSnapDistY = dist;
					result.snapY = target.bottom - draggingNode.height;
				}
				if (dist <= threshold && !result.guides.horizontal.includes(target.bottom)) {
					result.guides.horizontal.push(target.bottom);
				}
			}
		);

		// Top edge to bottom edge
		checkAlignment(
			dragging.top, target.bottom, threshold,
			(dist) => {
				if (dist < closestSnapDistY) {
					closestSnapDistY = dist;
					result.snapY = target.bottom;
				}
				if (dist <= threshold && !result.guides.horizontal.includes(target.bottom)) {
					result.guides.horizontal.push(target.bottom);
				}
			}
		);

		// Bottom edge to top edge
		checkAlignment(
			dragging.bottom, target.top, threshold,
			(dist) => {
				if (dist < closestSnapDistY) {
					closestSnapDistY = dist;
					result.snapY = target.top - draggingNode.height;
				}
				if (dist <= threshold && !result.guides.horizontal.includes(target.top)) {
					result.guides.horizontal.push(target.top);
				}
			}
		);

		// Center to center (vertical)
		checkAlignment(
			dragging.centerY, target.centerY, threshold,
			(dist) => {
				if (dist < closestSnapDistY) {
					closestSnapDistY = dist;
					result.snapY = target.centerY - draggingNode.height / 2;
				}
				if (dist <= threshold && !result.guides.horizontal.includes(target.centerY)) {
					result.guides.horizontal.push(target.centerY);
				}
			}
		);
	}

	return result;
}

// Helper to check alignment and call callback if within threshold
function checkAlignment(
	value1: number,
	value2: number,
	threshold: number,
	onMatch: (distance: number) => void
): void {
	const distance = Math.abs(value1 - value2);
	if (distance <= threshold) {
		onMatch(distance);
	}
}
