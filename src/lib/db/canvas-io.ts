import type { CanvasFile, CanvasNode, CanvasEdge } from '$lib/types/canvas';

// Validate that an object is a valid CanvasFile
function validateCanvasFile(data: unknown): data is CanvasFile {
	if (typeof data !== 'object' || data === null) return false;

	const obj = data as Record<string, unknown>;

	// nodes and edges are optional per spec, default to empty arrays
	if (obj.nodes === undefined) obj.nodes = [];
	if (obj.edges === undefined) obj.edges = [];
	if (!Array.isArray(obj.nodes)) return false;
	if (!Array.isArray(obj.edges)) return false;

	// Validate each node has required properties
	for (const node of obj.nodes) {
		if (typeof node !== 'object' || node === null) return false;
		const n = node as Record<string, unknown>;
		if (typeof n.id !== 'string') return false;
		if (typeof n.type !== 'string') return false;
		if (typeof n.x !== 'number') return false;
		if (typeof n.y !== 'number') return false;
		if (typeof n.width !== 'number') return false;
		if (typeof n.height !== 'number') return false;
	}

	// Validate each edge has required properties
	for (const edge of obj.edges) {
		if (typeof edge !== 'object' || edge === null) return false;
		const e = edge as Record<string, unknown>;
		if (typeof e.id !== 'string') return false;
		if (typeof e.fromNode !== 'string') return false;
		if (typeof e.toNode !== 'string') return false;
	}

	return true;
}

// Sanitize nodes/edges for spec-compliant export:
// - Round x, y, width, height to integers (spec requires integer)
// - Coerce numeric color values to strings (spec requires string)
function sanitizeForExport(canvas: CanvasFile): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
	const nodes = canvas.nodes.map(node => {
		const sanitized = { ...node };
		sanitized.x = Math.round(sanitized.x);
		sanitized.y = Math.round(sanitized.y);
		sanitized.width = Math.round(sanitized.width);
		sanitized.height = Math.round(sanitized.height);
		if (sanitized.color !== undefined) {
			sanitized.color = String(sanitized.color);
		}
		return sanitized;
	});
	const edges = canvas.edges.map(edge => {
		if (edge.color === undefined) return edge;
		return { ...edge, color: String(edge.color) };
	});
	return { nodes, edges };
}

// Export canvas to JSON Canvas format
export function exportCanvas(canvas: CanvasFile): string {
	const { nodes, edges } = sanitizeForExport(canvas);
	const exported: CanvasFile = { nodes, edges };

	// Include extensions if present
	if (canvas['x-viewport']) {
		exported['x-viewport'] = canvas['x-viewport'];
	}
	if (canvas['x-metadata']) {
		exported['x-metadata'] = canvas['x-metadata'];
	}

	return JSON.stringify(exported, null, '\t');
}

// Export canvas to standard JSON Canvas (without extensions)
export function exportCanvasStandard(canvas: CanvasFile): string {
	const { nodes, edges } = sanitizeForExport(canvas);
	return JSON.stringify({ nodes, edges }, null, '\t');
}

// Import canvas from JSON string
export function importCanvas(json: string): CanvasFile {
	let data: unknown;

	try {
		data = JSON.parse(json);
	} catch {
		throw new Error('Invalid JSON format');
	}

	if (!validateCanvasFile(data)) {
		throw new Error('Invalid canvas file format');
	}

	// Filter out unsupported node types (e.g. 'file') and their orphaned edges
	const supportedTypes = new Set(['text', 'link', 'group']);
	const droppedIds = new Set(
		data.nodes.filter(n => !supportedTypes.has(n.type)).map(n => n.id)
	);
	if (droppedIds.size > 0) {
		data.nodes = data.nodes.filter(n => supportedTypes.has(n.type));
		data.edges = data.edges.filter(e => !droppedIds.has(e.fromNode) && !droppedIds.has(e.toNode));
	}

	return data;
}

// Download canvas as .canvas file
export function downloadCanvas(canvas: CanvasFile, filename?: string): void {
	const name = filename ?? canvas['x-metadata']?.name ?? 'canvas';
	const safeName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
	const json = exportCanvas(canvas);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = `${safeName}.canvas`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// Read canvas from File object
export async function readCanvasFile(file: File): Promise<CanvasFile> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => {
			try {
				const canvas = importCanvas(reader.result as string);
				resolve(canvas);
			} catch (error) {
				reject(error);
			}
		};

		reader.onerror = () => reject(reader.error);
		reader.readAsText(file);
	});
}

// Open file picker and import canvas
export async function openCanvasFile(): Promise<CanvasFile | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.canvas,.json';

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}

			try {
				const canvas = await readCanvasFile(file);
				resolve(canvas);
			} catch (error) {
				console.error('Failed to import canvas:', error);
				resolve(null);
			}
		};

		input.oncancel = () => resolve(null);
		input.click();
	});
}

// Export all canvases as a single JSON backup
export function exportAllCanvases(canvases: Record<string, CanvasFile>): string {
	return JSON.stringify({
		version: 1,
		exportedAt: new Date().toISOString(),
		canvases
	}, null, 2);
}

// Download all canvases as backup
export function downloadBackup(canvases: Record<string, CanvasFile>): void {
	const json = exportAllCanvases(canvases);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const date = new Date().toISOString().split('T')[0];

	const a = document.createElement('a');
	a.href = url;
	a.download = `canvas-backup-${date}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
