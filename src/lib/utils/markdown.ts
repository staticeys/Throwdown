import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { styleHashtags, highlightSearchTerm } from './hashtags';

// Escape HTML entities for safe attribute values (defense-in-depth)
function escapeAttr(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// Configure marked with GFM and security settings
marked.use({
	gfm: true, // Enable GitHub Flavored Markdown
	breaks: false, // Don't add <br> on single line breaks (standard GFM behavior)
	renderer: {
		// Custom link renderer for security - open all links in new tab
		link({ href, title, text }) {
			const safeHref = escapeAttr(href);
			const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
			return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
		}
	}
});

// Parse markdown to HTML using marked
function parseMarkdownToHtml(markdown: string): string {
	return marked.parse(markdown) as string;
}

// Render markdown to sanitized HTML with optional hashtag styling and search highlighting
export function renderMarkdown(markdown: string, searchTerm?: string): string {
	const html = parseMarkdownToHtml(markdown);

	// Sanitize with DOMPurify - expanded for GFM features
	let sanitized = DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			// Standard markdown tags
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'p',
			'br',
			'hr',
			'strong',
			'em',
			'del',
			'code',
			'ul',
			'ol',
			'li',
			'blockquote',
			'a',
			// GFM tags
			'pre', // Code blocks
			'table', // Tables
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
			'input', // Task list checkboxes
			// Hashtag and search highlight tags
			'span',
			'mark'
		],
		ALLOWED_ATTR: [
			'href',
			'target',
			'rel', // Links
			'type',
			'checked',
			'disabled', // Task list checkboxes
			'align', // Table cell alignment
			'class',
			'data-tag' // Hashtag styling
		],
		// Explicitly allow only safe URI protocols (blocks javascript:, data:, vbscript:, etc.)
		ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
	});

	// Apply hashtag styling
	sanitized = styleHashtags(sanitized);

	// Apply search highlighting if search term provided
	if (searchTerm) {
		sanitized = highlightSearchTerm(sanitized, searchTerm);
	}

	return sanitized;
}

// Check if text contains markdown syntax
export function hasMarkdown(text: string): boolean {
	const patterns = [
		/^#{1,6} /m, // Headers
		/\*\*.+\*\*/, // Bold
		/\*.+\*/, // Italic
		/__.+__/, // Bold alt
		/_.+_/, // Italic alt
		/~~.+~~/, // Strikethrough
		/`.+`/, // Inline code
		/\[.+\]\(.+\)/, // Links
		/^[\*\-] /m, // Unordered list
		/^\d+\. /m, // Ordered list
		/^> /m, // Blockquote
		/^---$/m, // Horizontal rule
		// GFM patterns
		/^```/m, // Code blocks
		/^\|.+\|/m, // Tables
		/^- \[[x ]\]/mi, // Task lists
		/https?:\/\/\S+/ // Autolinks (bare URLs)
	];

	return patterns.some((pattern) => pattern.test(text));
}
