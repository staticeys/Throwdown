/**
 * Map URL Parsers
 * Specialized parsers for extracting location metadata from map service URLs
 */

import type { UrlContext } from './url-context-types';

/**
 * Google Maps: Extract place name or search query
 */
export function extractGoogleMaps(url: URL): UrlContext | null {
	const pathname = url.pathname;

	// Pattern: /maps/place/{Place+Name}@... or /maps/place/{Place+Name}/...
	const placeMatch = pathname.match(/\/maps\/place\/([^/@]+)/);
	if (placeMatch && placeMatch[1]) {
		let placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));

		// Check if this is coordinates (contains degree symbols or looks like coords)
		if (placeName.includes('°') || placeName.includes('"') || /^[-\d.]+\s*[NS,]\s*[-\d.]+\s*[EW]/.test(placeName)) {
			return {
				icon: '📍',
				label: 'Coordinates',
			};
		}

		return {
			icon: '📍',
			label: placeName,
		};
	}

	// Pattern: /maps?q={query}
	const query = url.searchParams.get('q');
	if (query) {
		return {
			icon: '📍',
			label: decodeURIComponent(query),
		};
	}

	// Pattern: /maps/@{coords} (direct coordinate links)
	const coordMatch = pathname.match(/\/maps\/@([-\d.]+),([-\d.]+)/);
	if (coordMatch) {
		return {
			icon: '📍',
			label: 'Coordinates',
		};
	}

	// Just a maps link without specific place
	return {
		icon: '🗺️',
		label: 'Google Maps',
	};
}

/**
 * Apple Maps: Extract address or search query
 */
export function extractAppleMaps(url: URL): UrlContext | null {
	const pathname = url.pathname;

	// Short link pattern: /p/{hash}
	if (pathname.startsWith('/p/')) {
		return {
			icon: '📍',
			label: 'Apple Maps',
		};
	}

	// Get name parameter first (more specific than address)
	const name = url.searchParams.get('name');
	if (name) {
		const decodedName = decodeURIComponent(name);
		// Skip generic "Dropped Pin" - fall through to address
		if (decodedName !== 'Dropped Pin') {
			return {
				icon: '📍',
				label: decodedName,
			};
		}
	}

	// Get address parameter
	const address = url.searchParams.get('address');
	if (address) {
		return {
			icon: '📍',
			label: decodeURIComponent(address),
		};
	}

	// Get search query
	const query = url.searchParams.get('q');
	if (query) {
		return {
			icon: '📍',
			label: decodeURIComponent(query),
		};
	}

	return {
		icon: '🗺️',
		label: 'Apple Maps',
	};
}

/**
 * OpenStreetMap: Extract search or coordinates
 */
export function extractOpenStreetMap(url: URL): UrlContext | null {
	const pathname = url.pathname;

	// OSM has various URL patterns:
	// - /way/123456 (specific OSM object)
	// - /search?query=... (search query)
	// - /#map=zoom/lat/lon (map view with coordinates)

	// Pattern: /way/{id}, /node/{id}, /relation/{id}
	const osmObjectMatch = pathname.match(/\/(way|node|relation)\/(\d+)/);
	if (osmObjectMatch) {
		const [, type, id] = osmObjectMatch;
		const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
		return {
			icon: '🗺️',
			label: `${typeLabel} ${id}`,
		};
	}

	const query = url.searchParams.get('query');
	if (query) {
		return {
			icon: '🗺️',
			label: decodeURIComponent(query),
		};
	}

	// Check hash for coordinates: #map=zoom/lat/lon
	const hash = url.hash;
	const mapMatch = hash.match(/#map=(\d+)\/([-\d.]+)\/([-\d.]+)/);
	if (mapMatch) {
		const [, , lat, lon] = mapMatch;
		return {
			icon: '🗺️',
			label: `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`,
		};
	}

	return {
		icon: '🗺️',
		label: 'OpenStreetMap',
	};
}

/**
 * Waze: Extract location or search query
 */
export function extractWaze(url: URL): UrlContext | null {
	const params = url.searchParams;

	// Check for q parameter (search query or place name)
	const query = params.get('q');
	if (query) {
		return {
			icon: '🗺️',
			label: decodeURIComponent(query),
		};
	}

	// Check for navigate parameter
	const navigate = params.get('navigate');
	if (navigate) {
		return {
			icon: '🗺️',
			label: 'Navigation',
		};
	}

	// Check for ll parameter (lat/lon coordinates)
	const ll = params.get('ll');
	if (ll) {
		return {
			icon: '🗺️',
			label: 'Location',
		};
	}

	return {
		icon: '🗺️',
		label: 'Waze',
	};
}
