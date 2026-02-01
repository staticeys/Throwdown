/**
 * URL Context Types
 * Shared type definitions for URL context extraction
 */

export interface UrlContext {
	icon: string;
	label?: string; // Optional: only for extracted contexts (maps with place names, etc.)
}
