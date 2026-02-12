import type { CanvasFile, AppState } from '$lib/types/canvas';
import { createCanvas } from '$lib/types/canvas';

const DB_NAME = 'canvas-app';
const DB_VERSION = 1;
const CANVASES_STORE = 'canvases';
const SETTINGS_STORE = 'settings';

let db: IDBDatabase | null = null;

// Initialize the database
export async function initDB(): Promise<IDBDatabase> {
	if (db) return db;

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);

		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const database = (event.target as IDBOpenDBRequest).result;

			// Store for canvas files
			if (!database.objectStoreNames.contains(CANVASES_STORE)) {
				database.createObjectStore(CANVASES_STORE, { keyPath: 'id' });
			}

			// Store for app settings (active canvas, preferences)
			if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
				database.createObjectStore(SETTINGS_STORE);
			}
		};
	});
}

// Canvas operations
export async function saveCanvas(id: string, canvas: CanvasFile): Promise<void> {
	const database = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(CANVASES_STORE, 'readwrite');
		const store = transaction.objectStore(CANVASES_STORE);

		// Update modified timestamp
		if (canvas['x-metadata']) {
			canvas['x-metadata'].modified = new Date().toISOString();
		}

		const request = store.put({ id, ...canvas });

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export async function loadCanvas(id: string): Promise<CanvasFile | null> {
	const database = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(CANVASES_STORE, 'readonly');
		const store = transaction.objectStore(CANVASES_STORE);
		const request = store.get(id);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			if (request.result) {
				// Remove the id field we added for storage
				const { id: _id, ...canvas } = request.result;
				resolve(canvas as CanvasFile);
			} else {
				resolve(null);
			}
		};
	});
}

export async function deleteCanvas(id: string): Promise<void> {
	const database = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(CANVASES_STORE, 'readwrite');
		const store = transaction.objectStore(CANVASES_STORE);
		const request = store.delete(id);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export async function getAllCanvasIds(): Promise<string[]> {
	const database = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(CANVASES_STORE, 'readonly');
		const store = transaction.objectStore(CANVASES_STORE);
		const request = store.getAllKeys();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result as string[]);
	});
}

export async function getAllCanvases(): Promise<Record<string, CanvasFile>> {
	const database = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(CANVASES_STORE, 'readonly');
		const store = transaction.objectStore(CANVASES_STORE);
		const request = store.getAll();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const canvases: Record<string, CanvasFile> = {};
			for (const item of request.result) {
				const { id, ...canvas } = item;
				canvases[id] = canvas as CanvasFile;
			}
			resolve(canvases);
		};
	});
}

// Settings operations
export async function saveSetting<T>(key: string, value: T): Promise<void> {
	const database = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(SETTINGS_STORE, 'readwrite');
		const store = transaction.objectStore(SETTINGS_STORE);
		const request = store.put(value, key);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export async function loadSetting<T>(key: string): Promise<T | null> {
	const database = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(SETTINGS_STORE, 'readonly');
		const store = transaction.objectStore(SETTINGS_STORE);
		const request = store.get(key);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result ?? null);
	});
}

// Load full app state
export async function loadAppState(): Promise<AppState> {
	console.log('[IndexedDB] Loading app state...');
	const [canvases, activeCanvasId] = await Promise.all([
		getAllCanvases(),
		loadSetting<string>('activeCanvasId')
	]);

	console.log('[IndexedDB] Loaded', Object.keys(canvases).length, 'canvases, active:', activeCanvasId);
	for (const [id, canvas] of Object.entries(canvases)) {
		console.log('[IndexedDB] Canvas', id, ':', canvas['x-metadata']?.name, 'with', canvas.nodes.length, 'nodes');
	}

	// If no canvases exist, create a default one
	if (Object.keys(canvases).length === 0) {
		console.log('[IndexedDB] No canvases found, creating default');
		const defaultId = crypto.randomUUID();
		const defaultCanvas = createCanvas('Untitled');
		canvases[defaultId] = defaultCanvas;
		await saveCanvas(defaultId, defaultCanvas);
		await saveSetting('activeCanvasId', defaultId);
		return {
			canvases,
			activeCanvasId: defaultId,
			selection: []
		};
	}

	// Use saved active canvas or first available
	const validActiveId = activeCanvasId && canvases[activeCanvasId]
		? activeCanvasId
		: Object.keys(canvases)[0];

	return {
		canvases,
		activeCanvasId: validActiveId,
		selection: []
	};
}

// Persistent Storage API — prevents browser from evicting OPFS/IndexedDB data
export async function requestPersistentStorage(): Promise<boolean> {
	if ('storage' in navigator && 'persist' in navigator.storage) {
		const isPersisted = await navigator.storage.persisted();
		if (!isPersisted) {
			return await navigator.storage.persist();
		}
		return true;
	}
	return false;
}

export async function isPersistentStorage(): Promise<boolean> {
	if ('storage' in navigator && 'persist' in navigator.storage) {
		return await navigator.storage.persisted();
	}
	return false;
}

// Debounced auto-save helper
export function createAutoSave(delayMs = 500) {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (id: string, canvas: CanvasFile) => {
		console.log('[AutoSave] Scheduling save for canvas:', id, 'in', delayMs, 'ms');
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(async () => {
			try {
				console.log('[AutoSave] Executing save for canvas:', id, 'with', canvas.nodes.length, 'nodes');
				await saveCanvas(id, canvas);
				console.log('[AutoSave] Save completed successfully');
			} catch (error) {
				console.error('Auto-save failed:', error);
			}
		}, delayMs);
	};
}
