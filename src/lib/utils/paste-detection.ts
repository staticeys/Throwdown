// Detect content type from clipboard or pasted text

export type PasteType = 'url' | 'text';

// URL regex pattern
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

// Check if a string is a URL
export function isUrl(text: string): boolean {
	return URL_PATTERN.test(text.trim());
}

// Validate URL is safe to open (only http/https, no javascript: or data: schemes)
export function isValidHttpUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

// Detect paste type from text
export function detectPasteType(text: string): PasteType {
	return isUrl(text) ? 'url' : 'text';
}

// Get clipboard text (async)
export async function getClipboardText(): Promise<string | null> {
	try {
		return await navigator.clipboard.readText();
	} catch {
		return null;
	}
}

// Parse clipboard and determine type
export async function parseClipboard(): Promise<{ type: PasteType; content: string } | null> {
	const text = await getClipboardText();
	if (!text) return null;

	return {
		type: detectPasteType(text),
		content: text.trim()
	};
}
