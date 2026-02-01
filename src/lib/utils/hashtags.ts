/**
 * Hashtag parsing and styling utilities
 */

/**
 * Extract unique hashtags from text content.
 * Hashtags must start with a letter to avoid matching hex colors (#fff).
 * Returns lowercase, deduplicated tags without the # prefix.
 */
export function extractHashtags(text: string): string[] {
	const regex = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;
	const tags: string[] = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		tags.push(match[1].toLowerCase());
	}
	return [...new Set(tags)];
}

/**
 * Style hashtags in HTML by wrapping them in spans.
 * Avoids styling hashtags inside <code> or <pre> elements.
 */
export function styleHashtags(html: string): string {
	// Split HTML into segments: code blocks vs regular content
	// This prevents styling hashtags inside code blocks
	const codeBlockPattern = /(<code[^>]*>[\s\S]*?<\/code>|<pre[^>]*>[\s\S]*?<\/pre>)/gi;
	const segments = html.split(codeBlockPattern);

	return segments
		.map((segment) => {
			// If this segment is a code block, leave it unchanged
			if (segment.match(/^<(code|pre)/i)) {
				return segment;
			}
			// Otherwise, style hashtags
			return segment.replace(
				/#([a-zA-Z][a-zA-Z0-9_-]*)/g,
				'<span class="hashtag" data-tag="$1">#$1</span>'
			);
		})
		.join('');
}

/**
 * Highlight search term in HTML by wrapping matches in <mark> elements.
 * Avoids highlighting inside HTML tags and code blocks.
 */
export function highlightSearchTerm(html: string, term: string): string {
	if (!term.trim()) return html;

	// Escape regex special characters
	const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const regex = new RegExp(`(${escaped})`, 'gi');

	// Split HTML into segments: tags, code blocks, and text
	const tagPattern = /(<[^>]+>|<code[^>]*>[\s\S]*?<\/code>|<pre[^>]*>[\s\S]*?<\/pre>)/gi;
	const segments = html.split(tagPattern);

	return segments
		.map((segment) => {
			// If this segment is an HTML tag or code block, leave it unchanged
			if (segment.startsWith('<')) {
				return segment;
			}
			// Otherwise, highlight matches
			return segment.replace(regex, '<mark class="search-highlight">$1</mark>');
		})
		.join('');
}
