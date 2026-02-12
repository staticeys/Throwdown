// OPFS (Origin Private File System) storage layer for file nodes
// Directory structure: /canvas-{canvasId}/{nodeId}-{filename}

export function isOPFSSupported(): boolean {
	return typeof navigator !== 'undefined' &&
		'storage' in navigator &&
		'getDirectory' in navigator.storage;
}

async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
	return navigator.storage.getDirectory();
}

async function getCanvasDir(canvasId: string, create = false): Promise<FileSystemDirectoryHandle> {
	const root = await getOPFSRoot();
	return root.getDirectoryHandle(`canvas-${canvasId}`, { create });
}

function buildFileName(nodeId: string, filename: string): string {
	return `${nodeId}-${filename}`;
}

export async function saveFileToOPFS(
	file: File,
	canvasId: string,
	nodeId: string
): Promise<void> {
	const canvasDir = await getCanvasDir(canvasId, true);
	const fileName = buildFileName(nodeId, file.name);
	const fileHandle = await canvasDir.getFileHandle(fileName, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(file);
	await writable.close();
}

export async function loadFileFromOPFS(
	canvasId: string,
	nodeId: string,
	filename: string
): Promise<File | null> {
	try {
		const canvasDir = await getCanvasDir(canvasId);
		const fileName = buildFileName(nodeId, filename);
		const fileHandle = await canvasDir.getFileHandle(fileName);
		return await fileHandle.getFile();
	} catch {
		return null;
	}
}

export async function deleteFileFromOPFS(
	canvasId: string,
	nodeId: string,
	filename: string
): Promise<void> {
	try {
		const canvasDir = await getCanvasDir(canvasId);
		const fileName = buildFileName(nodeId, filename);
		await canvasDir.removeEntry(fileName);
	} catch (error) {
		console.warn('Failed to delete file from OPFS:', error);
	}
}

export async function deleteCanvasFiles(canvasId: string): Promise<void> {
	try {
		const root = await getOPFSRoot();
		await root.removeEntry(`canvas-${canvasId}`, { recursive: true });
	} catch (error) {
		console.warn('Failed to delete canvas files:', error);
	}
}

export async function getAllFilesForCanvas(canvasId: string): Promise<string[]> {
	try {
		const canvasDir = await getCanvasDir(canvasId);
		const files: string[] = [];
		// Cast needed — TS doesn't include async iterable on FileSystemDirectoryHandle
		for await (const entry of (canvasDir as any).values()) {
			if (entry.kind === 'file') {
				files.push(entry.name);
			}
		}
		return files;
	} catch {
		return [];
	}
}

export async function getStorageQuota(): Promise<{
	usage: number;
	quota: number;
	available: number;
}> {
	if ('storage' in navigator && 'estimate' in navigator.storage) {
		const estimate = await navigator.storage.estimate();
		return {
			usage: estimate.usage ?? 0,
			quota: estimate.quota ?? 0,
			available: (estimate.quota ?? 0) - (estimate.usage ?? 0)
		};
	}
	return { usage: 0, quota: 0, available: 0 };
}

export async function canSaveFile(fileSize: number): Promise<boolean> {
	const quota = await getStorageQuota();
	return quota.available > fileSize;
}
