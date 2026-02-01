// JSON Canvas spec types with extensions

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type EndType = 'none' | 'arrow';
export type NodeColor = 1 | 2 | 3 | 4 | 5 | 6 | string;

// Base node properties (JSON Canvas spec)
export interface CanvasNodeBase {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: NodeColor;
}

// Text node - markdown content
export interface TextNode extends CanvasNodeBase {
	type: 'text';
	text: string;
}

// Link node - URL with optional preview
export interface LinkNode extends CanvasNodeBase {
	type: 'link';
	url: string;
}

// Group node - used for nested canvas references
export interface GroupNode extends CanvasNodeBase {
	type: 'group';
	label?: string;
	background?: string;
	backgroundStyle?: 'cover' | 'ratio' | 'repeat';
}

export type CanvasNode = TextNode | LinkNode | GroupNode;

// Edge connecting two nodes (JSON Canvas spec)
export interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide?: Side;
	toSide?: Side;
	fromEnd?: EndType;
	toEnd?: EndType;
	color?: NodeColor;
	label?: string;
}

// Node lock - connects two node edges together (extension)
export interface NodeLock {
	id: string;
	nodeA: string;
	sideA: Side;
	nodeB: string;
	sideB: Side;
}

// Viewport state (extension)
export interface Viewport {
	x: number;
	y: number;
	zoom: number;
}

// Canvas metadata (extension)
export interface CanvasMetadata {
	name: string;
	created: string;
	modified: string;
}

// Complete canvas file structure
export interface CanvasFile {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	// Extensions prefixed with x- to avoid spec conflicts
	'x-viewport'?: Viewport;
	'x-metadata'?: CanvasMetadata;
	'x-locks'?: NodeLock[];
}

// App-level state for managing multiple canvases
export interface AppState {
	canvases: Record<string, CanvasFile>;
	activeCanvasId: string;
	selection: string[]; // Ordered array of selected node IDs
}

// Default values
export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 100;
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

// Color presets (JSON Canvas spec: 1-6)
export const COLOR_PRESETS: Record<number, string> = {
	1: '#ef4444', // red
	2: '#f97316', // orange
	3: '#eab308', // yellow
	4: '#22c55e', // green
	5: '#06b6d4', // cyan
	6: '#8b5cf6'  // purple
};

// Helper to resolve color value
export function resolveColor(color: NodeColor | undefined): string | undefined {
	if (color === undefined) return undefined;
	if (typeof color === 'string') return color;
	return COLOR_PRESETS[color];
}

// Type guards
export function isTextNode(node: CanvasNode): node is TextNode {
	return node.type === 'text';
}

export function isLinkNode(node: CanvasNode): node is LinkNode {
	return node.type === 'link';
}

export function isGroupNode(node: CanvasNode): node is GroupNode {
	return node.type === 'group';
}

// Generate unique ID
export function generateId(): string {
	return crypto.randomUUID();
}

// Create new canvas with defaults
export function createCanvas(name: string): CanvasFile {
	const now = new Date().toISOString();
	return {
		nodes: [],
		edges: [],
		'x-viewport': { ...DEFAULT_VIEWPORT },
		'x-metadata': {
			name,
			created: now,
			modified: now
		}
	};
}

// Create new text node
export function createTextNode(x: number, y: number, text = ''): TextNode {
	return {
		id: generateId(),
		type: 'text',
		x,
		y,
		width: DEFAULT_NODE_WIDTH,
		height: DEFAULT_NODE_HEIGHT,
		text
	};
}

// Create new link node
export function createLinkNode(x: number, y: number, url: string): LinkNode {
	return {
		id: generateId(),
		type: 'link',
		x,
		y,
		width: DEFAULT_NODE_WIDTH,
		height: DEFAULT_NODE_HEIGHT,
		url
	};
}

// Create new group node (canvas reference)
export function createGroupNode(x: number, y: number, label?: string): GroupNode {
	return {
		id: generateId(),
		type: 'group',
		x,
		y,
		width: DEFAULT_NODE_WIDTH,
		height: DEFAULT_NODE_HEIGHT,
		label
	};
}

// Create edge between nodes
export function createEdge(fromNode: string, toNode: string): CanvasEdge {
	return {
		id: generateId(),
		fromNode,
		toNode,
		toEnd: 'arrow'
	};
}
