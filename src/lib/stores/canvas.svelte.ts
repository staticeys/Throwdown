import type {
	CanvasFile,
	CanvasNode,
	CanvasEdge,
	Viewport,
	TextNode,
	LinkNode,
	GroupNode,
	NodeColor,
	NodeLock,
	Side
} from '$lib/types/canvas';
import type { AlignmentGuides } from '$lib/utils/alignment';
import { calculateBoundingBox } from '$lib/utils/geometry';
import {
	createCanvas,
	createTextNode,
	createLinkNode,
	createGroupNode,
	createEdge,
	generateId,
	DEFAULT_VIEWPORT,
	isTextNode,
	isLinkNode
} from '$lib/types/canvas';
import { extractHashtags } from '$lib/utils/hashtags';
import {
	loadAppState,
	saveCanvas,
	saveSetting,
	deleteCanvas as deleteCanvasFromDB,
	createAutoSave
} from '$lib/db/indexed-db';

// Canvas state management using Svelte 5 runes
class CanvasStore {
	// State
	canvases = $state<Record<string, CanvasFile>>({});
	activeCanvasId = $state<string>('');
	selection = $state<string[]>([]);
	isLoading = $state(true);
	alignmentGuides = $state<AlignmentGuides | null>(null);

	// Link mode state
	isLinkMode = $state(false);
	linkSource = $state<string | null>(null); // Node ID of the source

	// Pending snap target (for visual feedback on target node during drag)
	pendingSnapTarget = $state<{ nodeId: string; side: Side } | null>(null);

	// Filter state (transient, not persisted)
	tagFilters = $state<string[]>([]);
	searchTerm = $state('');

	// Text editing state (for contextual UI hints)
	isEditingText = $state(false);

	// Auto-save instance
	private autoSave = createAutoSave(500);

	// Derived state
	get activeCanvas(): CanvasFile | null {
		return this.canvases[this.activeCanvasId] ?? null;
	}

	get nodes(): CanvasNode[] {
		return this.activeCanvas?.nodes ?? [];
	}

	get edges(): CanvasEdge[] {
		return this.activeCanvas?.edges ?? [];
	}

	get locks(): NodeLock[] {
		return this.activeCanvas?.['x-locks'] ?? [];
	}

	get viewport(): Viewport {
		return this.activeCanvas?.['x-viewport'] ?? DEFAULT_VIEWPORT;
	}

	get selectedNodes(): CanvasNode[] {
		return this.selection
			.map(id => this.nodes.find(n => n.id === id))
			.filter((n): n is CanvasNode => n !== undefined);
	}

	get canvasNames(): { id: string; name: string }[] {
		return Object.entries(this.canvases).map(([id, canvas]) => ({
			id,
			name: canvas['x-metadata']?.name ?? 'Untitled'
		}));
	}

	// All unique hashtags from text nodes in active canvas
	get allHashtags(): string[] {
		const tags = new Set<string>();
		for (const node of this.nodes) {
			if (isTextNode(node)) {
				for (const tag of extractHashtags(node.text)) {
					tags.add(tag);
				}
			}
		}
		return [...tags].sort();
	}

	// Nodes filtered by tag filters and search term
	get visibleNodes(): CanvasNode[] {
		// If no filters active, return all nodes
		if (this.tagFilters.length === 0 && !this.searchTerm) {
			return this.nodes;
		}

		return this.nodes.filter((node) => {
			// Tag filter (AND logic) - only applies to text nodes
			if (this.tagFilters.length > 0) {
				if (isTextNode(node)) {
					const nodeTags = extractHashtags(node.text);
					if (!this.tagFilters.every((tag) => nodeTags.includes(tag))) {
						return false;
					}
				} else if (!isLinkNode(node)) {
					// Group nodes are hidden when tag filters are active
					return false;
				}
				// Link nodes pass through tag filters (they can't have tags)
			}

			// Search term filter
			if (this.searchTerm) {
				const searchLower = this.searchTerm.toLowerCase();
				if (isTextNode(node)) {
					if (!node.text.toLowerCase().includes(searchLower)) {
						return false;
					}
				} else if (isLinkNode(node)) {
					if (!node.url.toLowerCase().includes(searchLower)) {
						return false;
					}
				} else {
					// Group nodes with labels can be searched
					if (!node.label?.toLowerCase().includes(searchLower)) {
						return false;
					}
				}
			}

			return true;
		});
	}

	// Set of hidden node IDs for efficient lookup
	get hiddenNodeIds(): Set<string> {
		const visible = new Set(this.visibleNodes.map((n) => n.id));
		return new Set(this.nodes.filter((n) => !visible.has(n.id)).map((n) => n.id));
	}

	// Ghost nodes: hidden nodes that are locked to visible nodes
	// These should still render (with reduced opacity) so they move with their locked group
	get ghostNodeIds(): Set<string> {
		const validVisibleIds = new Set(this.visibleNodes.map((n) => n.id));
		const hiddenIds = this.hiddenNodeIds;
		const ghostIds = new Set<string>();

		// For each visible node, find any hidden nodes in its lock cluster
		for (const visibleId of validVisibleIds) {
			const cluster = this.getLockedCluster(visibleId);
			for (const nodeId of cluster) {
				if (hiddenIds.has(nodeId)) {
					ghostIds.add(nodeId);
				}
			}
		}

		return ghostIds;
	}

	// Nodes to render: visible + ghost nodes
	get renderableNodes(): CanvasNode[] {
		const validVisibleIds = new Set(this.visibleNodes.map((n) => n.id));
		const ghostIds = this.ghostNodeIds;
		return this.nodes.filter((n) => validVisibleIds.has(n.id) || ghostIds.has(n.id));
	}

	// Initialize from IndexedDB
	async init(): Promise<void> {
		try {
			const state = await loadAppState();
			this.canvases = state.canvases;
			this.activeCanvasId = state.activeCanvasId;
			this.selection = [];
		} catch (error) {
			console.error('Failed to load app state:', error);
			// Create default canvas on error
			const id = generateId();
			this.canvases = { [id]: createCanvas('Untitled') };
			this.activeCanvasId = id;
		} finally {
			this.isLoading = false;
		}
	}

	// Save current canvas (triggers auto-save)
	private triggerSave(): void {
		if (this.activeCanvas) {
			console.log('[Canvas Store] Triggering autosave for canvas:', this.activeCanvasId, 'with', this.activeCanvas.nodes.length, 'nodes');
			// Deep clone to strip Svelte's reactive proxies before saving to IndexedDB
			const plainCanvas = JSON.parse(JSON.stringify(this.activeCanvas)) as CanvasFile;
			this.autoSave(this.activeCanvasId, plainCanvas);
		} else {
			console.warn('[Canvas Store] triggerSave called but activeCanvas is null');
		}
	}

	// Canvas operations
	createNewCanvas(name: string): string {
		const id = generateId();
		const canvas = createCanvas(name);
		this.canvases[id] = canvas;
		this.activeCanvasId = id;
		this.selection = [];
		// Deep clone to strip any reactive proxies
		saveCanvas(id, JSON.parse(JSON.stringify(canvas)));
		saveSetting('activeCanvasId', id);
		return id;
	}

	switchCanvas(id: string): void {
		if (this.canvases[id]) {
			this.activeCanvasId = id;
			this.selection = [];
			saveSetting('activeCanvasId', id);
		}
	}

	renameCanvas(id: string, name: string): void {
		const canvas = this.canvases[id];
		if (canvas && canvas['x-metadata']) {
			canvas['x-metadata'].name = name;
			this.triggerSave();
		}
	}

	deleteCanvasById(id: string): void {
		if (Object.keys(this.canvases).length <= 1) {
			console.warn('Cannot delete the last canvas');
			return;
		}

		delete this.canvases[id];
		deleteCanvasFromDB(id);

		// Switch to another canvas if we deleted the active one
		if (this.activeCanvasId === id) {
			const newActiveId = Object.keys(this.canvases)[0];
			this.switchCanvas(newActiveId);
		}
	}

	// Viewport operations
	setViewport(viewport: Viewport): void {
		if (this.activeCanvas) {
			this.activeCanvas['x-viewport'] = viewport;
			this.triggerSave();
		}
	}

	pan(dx: number, dy: number): void {
		const current = this.viewport;
		this.setViewport({
			...current,
			x: current.x + dx,
			y: current.y + dy
		});
	}

	zoom(factor: number, centerX?: number, centerY?: number): void {
		const current = this.viewport;
		const newZoom = Math.max(0.1, Math.min(5, current.zoom * factor));

		if (centerX !== undefined && centerY !== undefined) {
			// Zoom toward point
			const scale = newZoom / current.zoom;
			this.setViewport({
				x: centerX - (centerX - current.x) * scale,
				y: centerY - (centerY - current.y) * scale,
				zoom: newZoom
			});
		} else {
			this.setViewport({ ...current, zoom: newZoom });
		}
	}

	resetViewport(): void {
		this.setViewport({ ...DEFAULT_VIEWPORT });
	}

	// Node operations
	addNode(node: CanvasNode): void {
		if (this.activeCanvas) {
			this.activeCanvas.nodes.push(node);
			this.triggerSave();
		}
	}

	addTextNode(x: number, y: number, text = ''): TextNode {
		const node = createTextNode(x, y, text);
		this.addNode(node);
		return node;
	}

	addLinkNode(x: number, y: number, url: string): LinkNode {
		const node = createLinkNode(x, y, url);
		this.addNode(node);
		return node;
	}

	addGroupNode(x: number, y: number, label?: string): GroupNode {
		const node = createGroupNode(x, y, label);
		this.addNode(node);
		return node;
	}

	updateNode(id: string, updates: Partial<CanvasNode>): void {
		if (!this.activeCanvas) return;

		const index = this.activeCanvas.nodes.findIndex(n => n.id === id);
		if (index !== -1) {
			// Update node (triggerSave will handle serialization)
			this.activeCanvas.nodes[index] = {
				...this.activeCanvas.nodes[index],
				...updates
			} as CanvasNode;
			this.triggerSave();
		}
	}

	moveNode(id: string, x: number, y: number): void {
		this.updateNode(id, { x, y });
	}

	moveSelectedNodes(dx: number, dy: number): void {
		// Collect all nodes to move: selected nodes + their locked cluster members
		const nodesToMove = new Set<string>();

		for (const id of this.selection) {
			const cluster = this.getLockedCluster(id);
			for (const nodeId of cluster) {
				nodesToMove.add(nodeId);
			}
		}

		for (const id of nodesToMove) {
			const node = this.nodes.find((n) => n.id === id);
			if (node) {
				this.updateNode(id, { x: node.x + dx, y: node.y + dy });
			}
		}
	}

	resizeNode(id: string, width: number, height: number): void {
		this.updateNode(id, { width, height });
	}

	deleteNode(id: string): void {
		if (!this.activeCanvas) return;

		// Remove node
		this.activeCanvas.nodes = this.activeCanvas.nodes.filter(n => n.id !== id);

		// Remove related edges
		this.activeCanvas.edges = this.activeCanvas.edges.filter(
			e => e.fromNode !== id && e.toNode !== id
		);

		// Remove related locks
		if (this.activeCanvas['x-locks']) {
			this.activeCanvas['x-locks'] = this.activeCanvas['x-locks'].filter(
				l => l.nodeA !== id && l.nodeB !== id
			);
		}

		// Remove from selection
		this.selection = this.selection.filter(s => s !== id);

		this.triggerSave();
	}

	deleteSelectedNodes(): void {
		const toDelete = [...this.selection];
		for (const id of toDelete) {
			this.deleteNode(id);
		}
	}

	// Set color for selected nodes (pass undefined to clear color)
	setSelectedNodesColor(color: NodeColor | undefined): void {
		for (const id of this.selection) {
			this.updateNode(id, { color });
		}
	}

	// Create a group node from the current selection
	createGroupFromSelection(label?: string): GroupNode | null {
		if (!this.activeCanvas || this.selection.length === 0) return null;

		const selectedNodes = this.selectedNodes;
		if (selectedNodes.length === 0) return null;

		// Calculate bounding box of selected nodes
		const bounds = calculateBoundingBox(selectedNodes);
		if (!bounds) return null;

		// Add padding around the group
		const PADDING = 20;

		// Create the group node
		const groupNode: GroupNode = {
			id: generateId(),
			type: 'group',
			x: bounds.x - PADDING,
			y: bounds.y - PADDING,
			width: bounds.width + PADDING * 2,
			height: bounds.height + PADDING * 2,
			label: label ?? 'Group'
		};

		// Find the earliest index of selected nodes to insert group before them
		const selectedIds = new Set(this.selection);
		let insertIndex = this.activeCanvas.nodes.length;
		for (let i = 0; i < this.activeCanvas.nodes.length; i++) {
			if (selectedIds.has(this.activeCanvas.nodes[i].id)) {
				insertIndex = i;
				break;
			}
		}

		// Insert group at the correct position (before selected nodes = renders below)
		this.activeCanvas.nodes.splice(insertIndex, 0, groupNode);

		// Select only the new group
		this.selection = [groupNode.id];

		this.triggerSave();
		return groupNode;
	}

	// Edge operations
	addEdge(fromNode: string, toNode: string): CanvasEdge {
		const edge = createEdge(fromNode, toNode);
		if (this.activeCanvas) {
			this.activeCanvas.edges.push(edge);
			this.triggerSave();
		}
		return edge;
	}

	linkSelectedNodes(): void {
		if (this.selection.length < 2) return;

		const [first, ...rest] = this.selection;
		for (const toNode of rest) {
			// Check if edge already exists
			const exists = this.edges.some(
				e => e.fromNode === first && e.toNode === toNode
			);
			if (!exists) {
				this.addEdge(first, toNode);
			}
		}
	}

	deleteEdge(id: string): void {
		if (this.activeCanvas) {
			this.activeCanvas.edges = this.activeCanvas.edges.filter(e => e.id !== id);
			this.triggerSave();
		}
	}

	// Lock operations
	addLock(nodeA: string, sideA: Side, nodeB: string, sideB: Side): NodeLock | null {
		if (!this.activeCanvas) return null;

		// Initialize locks array if needed
		if (!this.activeCanvas['x-locks']) {
			this.activeCanvas['x-locks'] = [];
		}

		// Check if lock already exists
		const exists = this.locks.some(
			(l) =>
				(l.nodeA === nodeA && l.sideA === sideA && l.nodeB === nodeB && l.sideB === sideB) ||
				(l.nodeA === nodeB && l.sideA === sideB && l.nodeB === nodeA && l.sideB === sideA)
		);
		if (exists) return null;

		const lock: NodeLock = {
			id: generateId(),
			nodeA,
			sideA,
			nodeB,
			sideB
		};

		this.activeCanvas['x-locks'].push(lock);
		this.triggerSave();
		return lock;
	}

	removeLock(lockId: string): void {
		if (!this.activeCanvas || !this.activeCanvas['x-locks']) return;

		this.activeCanvas['x-locks'] = this.activeCanvas['x-locks'].filter((l) => l.id !== lockId);
		this.triggerSave();
	}

	removeLocksForNode(nodeId: string): void {
		if (!this.activeCanvas || !this.activeCanvas['x-locks']) return;

		this.activeCanvas['x-locks'] = this.activeCanvas['x-locks'].filter(
			(l) => l.nodeA !== nodeId && l.nodeB !== nodeId
		);
		this.triggerSave();
	}

	// Pending snap target operations (for visual feedback during drag)
	setPendingSnapTarget(nodeId: string, side: Side): void {
		this.pendingSnapTarget = { nodeId, side };
	}

	clearPendingSnapTarget(): void {
		this.pendingSnapTarget = null;
	}

	// Get all nodes transitively connected via locks (BFS)
	getLockedCluster(nodeId: string): string[] {
		const visited = new Set<string>();
		const queue: string[] = [nodeId];

		while (queue.length > 0) {
			const current = queue.shift()!;
			if (visited.has(current)) continue;
			visited.add(current);

			// Find all locks involving this node
			for (const lock of this.locks) {
				if (lock.nodeA === current && !visited.has(lock.nodeB)) {
					queue.push(lock.nodeB);
				}
				if (lock.nodeB === current && !visited.has(lock.nodeA)) {
					queue.push(lock.nodeA);
				}
			}
		}

		return Array.from(visited);
	}

	// Selection operations
	select(id: string): void {
		if (!this.selection.includes(id)) {
			this.selection.push(id);
		}
	}

	deselect(id: string): void {
		this.selection = this.selection.filter(s => s !== id);
	}

	toggleSelection(id: string): void {
		if (this.selection.includes(id)) {
			this.deselect(id);
		} else {
			this.select(id);
		}
	}

	selectOnly(id: string): void {
		this.selection = [id];
	}

	selectAll(): void {
		this.selection = this.nodes.map(n => n.id);
	}

	clearSelection(): void {
		this.selection = [];
	}

	setSelection(ids: string[]): void {
		this.selection = [...ids];
	}

	isSelected(id: string): boolean {
		return this.selection.includes(id);
	}

	// Alignment guide operations
	setAlignmentGuides(guides: AlignmentGuides): void {
		this.alignmentGuides = guides;
	}

	clearAlignmentGuides(): void {
		this.alignmentGuides = null;
	}

	// Import canvas data
	importCanvasData(canvas: CanvasFile, name?: string): string {
		const id = generateId();

		// Ensure metadata exists
		if (!canvas['x-metadata']) {
			const now = new Date().toISOString();
			canvas['x-metadata'] = {
				name: name ?? 'Imported',
				created: now,
				modified: now
			};
		} else if (name) {
			canvas['x-metadata'].name = name;
		}

		this.canvases[id] = canvas;
		this.activeCanvasId = id;
		this.selection = [];
		// Deep clone to strip any reactive proxies
		saveCanvas(id, JSON.parse(JSON.stringify(canvas)));
		saveSetting('activeCanvasId', id);
		return id;
	}

	// Link mode operations
	toggleLinkMode(): void {
		this.isLinkMode = !this.isLinkMode;
		if (this.isLinkMode) {
			// Clear selection when entering link mode
			this.selection = [];
		} else {
			this.linkSource = null;
		}
	}

	exitLinkMode(): void {
		this.isLinkMode = false;
		this.linkSource = null;
	}

	setLinkSource(nodeId: string): void {
		this.linkSource = nodeId;
	}

	clearLinkSource(): void {
		this.linkSource = null;
	}

	createLinkFromSource(targetNodeId: string): void {
		if (!this.linkSource) return;

		// Don't allow self-links
		if (this.linkSource === targetNodeId) {
			return;
		}

		// Check if edge already exists
		const exists = this.edges.some(
			(e) => e.fromNode === this.linkSource && e.toNode === targetNodeId
		);

		if (exists) return;

		// Create the edge
		this.addEdge(this.linkSource, targetNodeId);
	}

	// Filter operations
	addTagFilter(tag: string): void {
		const normalizedTag = tag.toLowerCase();
		if (!this.tagFilters.includes(normalizedTag)) {
			this.tagFilters = [...this.tagFilters, normalizedTag];
		}
	}

	removeTagFilter(tag: string): void {
		this.tagFilters = this.tagFilters.filter((t) => t !== tag.toLowerCase());
	}

	setSearchTerm(term: string): void {
		this.searchTerm = term;
	}

	clearFilters(): void {
		this.tagFilters = [];
		this.searchTerm = '';
	}

	// Text editing state operations
	setEditingText(editing: boolean): void {
		this.isEditingText = editing;
	}
}

// Export singleton instance
export const canvasStore = new CanvasStore();
