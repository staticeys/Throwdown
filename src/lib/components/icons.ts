export const icons = {
	// Actions
	add: '+',
	close: '×',
	check: '✓',
	edit: '✎',
	trash: '⌫',

	// Navigation
	menu: '☰',
	more: '⋮',
	arrowLeft: '←',
	arrowRight: '→',
	arrowUp: '↑',
	arrowDown: '↓',

	// Objects
	text: '¶',
	link: '§',
	canvas: '◫',

	// URL context types
	map: '📍',
	globe: '🗺️',
	video: '▶️',
	code: '📦',
	social: '🐦',
	book: '📖',
	search: '🔍',
	document: '📄',
	message: '💬',
	news: '📰',
	docs: '📚',
	product: '🛍️',

	// Theme
	sun: '☀',
	moon: '☾',

	// File operations
	export: '↓',
	import: '↑',
	save: '◇',

	// Canvas controls
	zoomIn: '+',
	zoomOut: '−',
	fitView: '⊡',

	// Selection/linking
	arrow: '↔',
	unlink: '⊘',
	group: '⬚',
	duplicate: '⧉',

	// Help
	keyboard: '⌨',
	help: '?'
} as const;

export type IconName = keyof typeof icons;
