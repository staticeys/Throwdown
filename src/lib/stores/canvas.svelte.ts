import type {
	CanvasFile,
	CanvasNode,
	CanvasEdge,
	Viewport,
	TextNode,
	LinkNode,
	GroupNode,
	FileNode,
	NodeColor
} from '$lib/types/canvas';
import type { AlignmentGuides } from '$lib/utils/alignment';
import { calculateBoundingBox, getContainedNodes } from '$lib/utils/geometry';
import {
	createCanvas,
	createTextNode,
	createLinkNode,
	createGroupNode,
	createFileNode,
	createEdge,
	generateId,
	DEFAULT_VIEWPORT,
	isTextNode,
	isLinkNode,
	isFileNode
} from '$lib/types/canvas';
import { deleteFileFromOPFS, deleteCanvasFiles, saveFileToOPFS } from '$lib/platform/fs-opfs';
import { extractHashtags } from '$lib/utils/hashtags';
import {
	loadAppState,
	saveCanvas,
	saveSetting,
	deleteCanvas as deleteCanvasFromDB,
	createAutoSave
} from '$lib/db/indexed-db';

// Undo/redo history types
interface CanvasSnapshot {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

interface CanvasHistory {
	undoStack: CanvasSnapshot[];
	redoStack: CanvasSnapshot[];
}

// Canvas state management using Svelte 5 runes
class CanvasStore {
	// State
	canvases = $state<Record<string, CanvasFile>>({});
	activeCanvasId = $state<string>('');
	selection = $state<string[]>([]);
	isLoading = $state(true);
	alignmentGuides = $state<AlignmentGuides | null>(null);

	// Filter state (transient, not persisted)
	tagFilters = $state<string[]>([]);
	searchTerm = $state('');

	// Text editing state (for contextual UI hints)
	isEditingText = $state(false);

	// Auto-save instance
	private autoSave = createAutoSave(500);

	// Undo/redo history (per-canvas, in-memory only)
	private history: Record<string, CanvasHistory> = {};
	private inTransaction = false;
	private readonly HISTORY_LIMIT = 30;

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
				} else if (!isLinkNode(node) && !isFileNode(node)) {
					// Group nodes are hidden when tag filters are active
					return false;
				}
				// Link and file nodes pass through tag filters (they can't have tags)
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
				} else if (isFileNode(node)) {
					if (!node.filename.toLowerCase().includes(searchLower)) {
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

	// Nodes to render (filtered by tags/search)
	get renderableNodes(): CanvasNode[] {
		return this.visibleNodes;
	}

	// Node IDs hidden by filters (for deselecting when filters change)
	get hiddenNodeIds(): Set<string> {
		const visibleIds = new Set(this.visibleNodes.map((n) => n.id));
		return new Set(this.nodes.filter((n) => !visibleIds.has(n.id)).map((n) => n.id));
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

	// Undo/redo: capture snapshot before mutation
	private pushSnapshot(): void {
		const canvasId = this.activeCanvasId;
		const canvas = this.activeCanvas;
		if (!canvas) return;

		// Skip if inside a transaction (snapshot already captured at transaction start)
		if (this.inTransaction) return;

		// Lazily initialize history for this canvas
		if (!this.history[canvasId]) {
			this.history[canvasId] = { undoStack: [], redoStack: [] };
		}

		const history = this.history[canvasId];

		// Deep clone current state (strips Svelte 5 proxies)
		const snapshot: CanvasSnapshot = JSON.parse(JSON.stringify({
			nodes: canvas.nodes,
			edges: canvas.edges
		}));

		history.undoStack.push(snapshot);

		// Enforce history limit
		if (history.undoStack.length > this.HISTORY_LIMIT) {
			history.undoStack.shift();
		}

		// New action invalidates redo
		history.redoStack = [];
	}

	// Begin a transaction — batches multiple mutations into one undo step
	beginTransaction(): void {
		if (this.inTransaction) return;
		// Push snapshot BEFORE setting flag so pushSnapshot() proceeds
		this.pushSnapshot();
		this.inTransaction = true;
	}

	// End a transaction — removes no-op snapshot if state didn't change
	endTransaction(): void {
		this.inTransaction = false;

		// Remove no-op snapshot if state didn't actually change
		const canvasId = this.activeCanvasId;
		const canvas = this.activeCanvas;
		const history = this.history[canvasId];
		if (canvas && history && history.undoStack.length > 0) {
			const lastSnapshot = history.undoStack[history.undoStack.length - 1];
			const currentState = JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges });
			const snapshotState = JSON.stringify(lastSnapshot);
			if (currentState === snapshotState) {
				history.undoStack.pop();
			}
		}
	}

	// Undo last action
	undo(): void {
		const canvasId = this.activeCanvasId;
		const canvas = this.activeCanvas;
		const history = this.history[canvasId];
		if (!canvas || !history || history.undoStack.length === 0) return;

		// Save current state to redo stack
		const currentSnapshot: CanvasSnapshot = JSON.parse(JSON.stringify({
			nodes: canvas.nodes,
			edges: canvas.edges
		}));
		history.redoStack.push(currentSnapshot);

		// Restore previous state
		const previousSnapshot = history.undoStack.pop()!;
		canvas.nodes = previousSnapshot.nodes;
		canvas.edges = previousSnapshot.edges;

		// Clean up selection (remove IDs that no longer exist)
		const nodeIds = new Set(previousSnapshot.nodes.map(n => n.id));
		this.selection = this.selection.filter(id => nodeIds.has(id));

		this.triggerSave();
	}

	// Redo last undone action
	redo(): void {
		const canvasId = this.activeCanvasId;
		const canvas = this.activeCanvas;
		const history = this.history[canvasId];
		if (!canvas || !history || history.redoStack.length === 0) return;

		// Save current state to undo stack
		const currentSnapshot: CanvasSnapshot = JSON.parse(JSON.stringify({
			nodes: canvas.nodes,
			edges: canvas.edges
		}));
		history.undoStack.push(currentSnapshot);

		// Restore next state
		const nextSnapshot = history.redoStack.pop()!;
		canvas.nodes = nextSnapshot.nodes;
		canvas.edges = nextSnapshot.edges;

		// Clean up selection
		const nodeIds = new Set(nextSnapshot.nodes.map(n => n.id));
		this.selection = this.selection.filter(id => nodeIds.has(id));

		this.triggerSave();
	}

	get canUndo(): boolean {
		const history = this.history[this.activeCanvasId];
		return !!history && history.undoStack.length > 0;
	}

	get canRedo(): boolean {
		const history = this.history[this.activeCanvasId];
		return !!history && history.redoStack.length > 0;
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
		delete this.history[id];
		deleteCanvasFromDB(id);

		// Clean up OPFS files for this canvas
		deleteCanvasFiles(id);

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
			this.pushSnapshot();
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
		// Insert groups at the beginning so they render behind other nodes
		if (this.activeCanvas) {
			this.pushSnapshot();
			this.activeCanvas.nodes.unshift(node);
			this.triggerSave();
		}
		return node;
	}

	addFileNode(x: number, y: number, filename: string, mimeType: string, size: number): FileNode {
		const node = createFileNode(x, y, filename, mimeType, size);
		this.addNode(node);
		return node;
	}

	updateNode(id: string, updates: Partial<CanvasNode>): void {
		if (!this.activeCanvas) return;

		const index = this.activeCanvas.nodes.findIndex(n => n.id === id);
		if (index !== -1) {
			this.pushSnapshot();
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
		const nodesToMove = new Set<string>(this.selection);

		// If a group is selected, include its contained nodes
		for (const id of this.selection) {
			const node = this.nodes.find((n) => n.id === id);
			if (node?.type === 'group') {
				const contained = this.getContainedNodesForGroup(id);
				for (const c of contained) {
					nodesToMove.add(c.id);
				}
			}
		}

		this.beginTransaction();
		for (const id of nodesToMove) {
			const node = this.nodes.find((n) => n.id === id);
			if (node) {
				this.updateNode(id, { x: node.x + dx, y: node.y + dy });
			}
		}
		this.endTransaction();
	}

	// Get nodes contained within a group's bounds
	getContainedNodesForGroup(groupId: string): CanvasNode[] {
		const group = this.nodes.find((n) => n.id === groupId);
		if (!group || group.type !== 'group') return [];
		return getContainedNodes(group, this.nodes);
	}

	resizeNode(id: string, width: number, height: number): void {
		this.updateNode(id, { width, height });
	}

	deleteNode(id: string): void {
		if (!this.activeCanvas) return;

		// Find the node before deletion for OPFS cleanup
		const node = this.activeCanvas.nodes.find(n => n.id === id);

		this.pushSnapshot();

		// Remove node
		this.activeCanvas.nodes = this.activeCanvas.nodes.filter(n => n.id !== id);

		// Remove related edges
		this.activeCanvas.edges = this.activeCanvas.edges.filter(
			e => e.fromNode !== id && e.toNode !== id
		);

		// Remove from selection
		this.selection = this.selection.filter(s => s !== id);

		// Clean up OPFS file if file node
		if (node && isFileNode(node)) {
			deleteFileFromOPFS(this.activeCanvasId, node.id, node.filename);
		}

		this.triggerSave();
	}

	deleteSelectedNodes(): void {
		const toDelete = [...this.selection];
		this.beginTransaction();
		for (const id of toDelete) {
			this.deleteNode(id);
		}
		this.endTransaction();
	}

	// Set color for selected nodes (pass undefined to clear color)
	setSelectedNodesColor(color: NodeColor | undefined): void {
		this.beginTransaction();
		for (const id of this.selection) {
			this.updateNode(id, { color });
		}
		this.endTransaction();
	}

	// Create a group node from the current selection
	createGroupFromSelection(label?: string): GroupNode | null {
		if (!this.activeCanvas || this.selection.length === 0) return null;

		const selectedNodes = this.selectedNodes;
		if (selectedNodes.length === 0) return null;

		this.pushSnapshot();

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
			this.pushSnapshot();
			this.activeCanvas.edges.push(edge);
			this.triggerSave();
		}
		return edge;
	}

	linkSelectedNodes(): void {
		if (this.selection.length < 2) return;

		this.beginTransaction();
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
		this.endTransaction();
	}

	deleteEdge(id: string): void {
		if (this.activeCanvas) {
			this.pushSnapshot();
			this.activeCanvas.edges = this.activeCanvas.edges.filter(e => e.id !== id);
			this.triggerSave();
		}
	}

	updateEdge(id: string, updates: Partial<CanvasEdge>): void {
		if (this.activeCanvas) {
			const edge = this.activeCanvas.edges.find(e => e.id === id);
			if (edge) {
				this.pushSnapshot();
				Object.assign(edge, updates);
				this.triggerSave();
			}
		}
	}

	getEdge(id: string): CanvasEdge | undefined {
		return this.activeCanvas?.edges.find(e => e.id === id);
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

	// Import canvas with files from ZIP
	async importCanvasWithFiles(
		canvas: CanvasFile,
		files: Array<{ nodeId: string; file: File }>,
		name?: string
	): Promise<string> {
		const canvasId = this.importCanvasData(canvas, name);

		for (const { nodeId, file } of files) {
			try {
				await saveFileToOPFS(file, canvasId, nodeId);
			} catch (error) {
				console.error('Failed to restore file:', file.name, error);
			}
		}

		return canvasId;
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
