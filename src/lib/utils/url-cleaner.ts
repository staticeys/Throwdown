/**
 * URL Cleaner Utility
 * Removes tracking parameters from URLs while preserving functional parameters.
 */

/**
 * Clean tracking parameters from a URL
 * Returns the cleaned URL string, or the original if cleaning fails
 */
export function cleanTrackingFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const hostname = parsed.hostname.toLowerCase();

		// Platform-specific cleaning
		if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
			cleanYouTube(parsed);
		} else if (hostname.includes('amazon.')) {
			cleanAmazon(parsed);
		} else if (hostname === 'twitter.com' || hostname === 'x.com') {
			cleanTwitter(parsed);
		} else if (hostname.includes('google.')) {
			cleanGoogle(parsed);
		}

		// Global tracking parameter removal (works for all domains)
		removeGlobalTrackingParams(parsed);

		return parsed.toString();
	} catch {
		// If URL parsing fails, return original
		return url;
	}
}

/**
 * Remove global tracking parameters that appear across many platforms
 */
function removeGlobalTrackingParams(url: URL): void {
	const trackingParams = [
		// Google Analytics
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_term',
		'utm_content',
		'utm_id',
		'_ga',
		'_gl',
		'gclid',
		'gclsrc',

		// Facebook
		'fbclid',
		'fb_action_ids',
		'fb_action_types',
		'fb_source',
		'fb_ref',

		// Mailchimp
		'mc_cid',
		'mc_eid',

		// Adobe Marketing
		'adobe_mc',

		// Marketo
		'mkt_tok',

		// HubSpot
		'_hsenc',
		'_hsmi',

		// Generic tracking
		'ref',
		'ref_src',
		'ref_url',
		'source',
		'campaign',
		'medium',
		'tracking',
		'track',
	];

	for (const param of trackingParams) {
		url.searchParams.delete(param);
	}
}

/**
 * Clean YouTube URLs - keep only essential parameters
 */
function cleanYouTube(url: URL): void {
	const essential = ['v', 'list', 't', 'start', 'end'];
	const paramsToKeep = new URLSearchParams();

	for (const key of essential) {
		const value = url.searchParams.get(key);
		if (value) {
			paramsToKeep.set(key, value);
		}
	}

	// Replace all params with just the essential ones
	url.search = paramsToKeep.toString();
}

/**
 * Clean Amazon URLs - keep only product identifier
 */
function cleanAmazon(url: URL): void {
	const pathname = url.pathname;

	// Extract ASIN or product ID from path
	const asinMatch = pathname.match(/\/([A-Z0-9]{10})(\/|$)/);
	const dpMatch = pathname.match(/\/dp\/([A-Z0-9]{10})(\/|$)/);
	const gpMatch = pathname.match(/\/gp\/product\/([A-Z0-9]{10})(\/|$)/);

	// Clear all query parameters (Amazon tracking is extensive)
	url.search = '';

	// If we found a product ID, simplify the path
	if (dpMatch || gpMatch || asinMatch) {
		const productId = (dpMatch || gpMatch || asinMatch)![1];
		url.pathname = `/dp/${productId}`;
	}
}

/**
 * Clean Twitter/X URLs
 */
function cleanTwitter(url: URL): void {
	const essential = ['s']; // 's' is sometimes used for thread position
	const paramsToKeep = new URLSearchParams();

	for (const key of essential) {
		const value = url.searchParams.get(key);
		if (value) {
			paramsToKeep.set(key, value);
		}
	}

	url.search = paramsToKeep.toString();
}

/**
 * Clean Google URLs (Search, etc.)
 */
function cleanGoogle(url: URL): void {
	const pathname = url.pathname;

	// Google Search - keep only the query
	if (pathname.includes('/search')) {
		const essential = ['q', 'tbm']; // q = query, tbm = search type (images, etc.)
		const paramsToKeep = new URLSearchParams();

		for (const key of essential) {
			const value = url.searchParams.get(key);
			if (value) {
				paramsToKeep.set(key, value);
			}
		}

		url.search = paramsToKeep.toString();
		return;
	}

	// Google Maps is handled separately, so just remove common tracking
	if (pathname.includes('/maps')) {
		const toRemove = ['entry', 'g_ep', 'g_st'];
		for (const param of toRemove) {
			url.searchParams.delete(param);
		}
	}
}
