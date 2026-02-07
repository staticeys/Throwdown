/**
 * Self-contained interactive HTML export generator.
 * Produces a single .html file with all CSS/JS inlined — no external dependencies.
 */
import type { CanvasFile, CanvasNode, CanvasEdge } from '$lib/types/canvas';
import { resolveColor, isTextNode, isLinkNode, isGroupNode } from '$lib/types/canvas';
import { calculateBoundingBox } from '$lib/utils/geometry';
import { renderMarkdown } from '$lib/utils/markdown';
import { extractUrlContext } from '$lib/utils/url-context';
import { isValidHttpUrl } from '$lib/utils/paste-detection';
import {
	buildNodeMap,
	getEdgePath,
	getArrowTransform,
	getArrowStartTransform,
	getEdgeMidpoint,
	getEdgeColor,
	hasArrowEnd,
	hasArrowStart
} from './export-shared';

export interface HtmlExportOptions {
	title?: string;
	defaultTheme?: 'light' | 'dark' | 'auto';
	/** When true, omits pan/zoom JS and theme toggle (used for PDF print). */
	forPrint?: boolean;
}

/** Escape HTML special characters for safe attribute/content insertion. */
function esc(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Format URL for display (strip protocol and trailing slash). */
function formatUrl(url: string): string {
	try {
		return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
	} catch {
		return url;
	}
}

/** Extract hostname from URL. */
function getHostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

// ─── Node HTML generation ────────────────────────────────────────────

function generateNodeHtml(node: CanvasNode, renderedMarkdown: Map<string, string>): string {
	const color = resolveColor(node.color);
	const hasColor = color !== undefined;
	const isGroup = node.type === 'group';

	const classes = ['canvas-object'];
	if (hasColor) classes.push('has-color');
	if (isGroup) classes.push('is-group');

	let colorStyle = '';
	if (hasColor) {
		colorStyle = `--node-color:${color};`;
	}

	const style = `left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;${colorStyle}`;

	let content = '';

	if (isTextNode(node)) {
		const html = renderedMarkdown.get(node.id) ?? '';
		if (html) {
			content = `<div class="text-block"><div class="text-rendered">${html}</div></div>`;
		} else {
			content = `<div class="text-block"><div class="text-rendered text-placeholder">Empty</div></div>`;
		}
	} else if (isLinkNode(node)) {
		const ctx = extractUrlContext(node.url);
		const icon = ctx?.icon ?? '§';
		const label = ctx?.label ?? getHostname(node.url);
		const displayUrl = formatUrl(node.url);
		const valid = isValidHttpUrl(node.url);

		if (valid) {
			content = `<div class="link-block">` +
				`<div class="link-icon">${icon}</div>` +
				`<div class="link-content">` +
				`<a href="${esc(node.url)}" class="link-label" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` +
				`<div class="link-url" title="${esc(node.url)}">${esc(displayUrl)}</div>` +
				`</div>` +
				`<a href="${esc(node.url)}" class="link-open" target="_blank" rel="noopener noreferrer">→</a>` +
				`</div>`;
		} else {
			content = `<div class="link-block">` +
				`<div class="link-icon">${icon}</div>` +
				`<div class="link-content">` +
				`<div class="link-label invalid">${esc(label)}</div>` +
				`<div class="link-url" title="${esc(node.url)}">${esc(displayUrl)}</div>` +
				`</div>` +
				`</div>`;
		}
	} else if (isGroupNode(node)) {
		const label = node.label || 'Group';
		content = `<div class="group-container">` +
			`<div class="group-label"><span class="label-text">${esc(label)}</span></div>` +
			`</div>`;
	}

	const overflow = isGroup ? 'visible' : 'hidden';

	return `<div class="${classes.join(' ')}" style="${style}overflow:${overflow};" data-node-id="${node.id}">` +
		`<div class="object-content${isGroup ? ' group-content' : ''}">${content}</div>` +
		`</div>`;
}

// ─── Edge SVG generation ─────────────────────────────────────────────

function generateEdgeSvg(edges: CanvasEdge[], nodes: CanvasNode[]): string {
	const nodeMap = buildNodeMap(nodes);
	const parts: string[] = [];

	for (const edge of edges) {
		const path = getEdgePath(edge, nodeMap);
		if (!path) continue;

		const color = getEdgeColor(edge);

		let arrowEnd = '';
		if (hasArrowEnd(edge)) {
			const t = getArrowTransform(edge, nodeMap);
			if (t) {
				arrowEnd = `<g transform="${t}"><path d="M -8 -4 L 0 0 L -8 4" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
			}
		}

		let arrowStart = '';
		if (hasArrowStart(edge)) {
			const t = getArrowStartTransform(edge, nodeMap);
			if (t) {
				arrowStart = `<g transform="${t}"><path d="M -8 -4 L 0 0 L -8 4" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
			}
		}

		parts.push(
			`<g class="edge-group">` +
			`<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>` +
			arrowEnd + arrowStart +
			`</g>`
		);

		// Label
		if (edge.label) {
			const mid = getEdgeMidpoint(edge, nodeMap);
			if (mid) {
				const labelColor = edge.color ? `color:${color};` : '';
				parts.push(
					`<foreignObject x="${mid.x - 100}" y="${mid.y - 28}" width="200" height="24" class="edge-label-container">` +
					`<div xmlns="http://www.w3.org/1999/xhtml" class="edge-label" style="${labelColor}">${esc(edge.label)}</div>` +
					`</foreignObject>`
				);
			}
		}
	}

	return `<svg class="edge-layer" xmlns="http://www.w3.org/2000/svg">${parts.join('\n')}</svg>`;
}

// ─── CSS ─────────────────────────────────────────────────────────────

function getThemeCSS(): string {
	return `
:root {
	--font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	--font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
	--font-size-xs: 11px;
	--font-size-sm: 13px;
	--font-size-base: 14px;
	--font-size-md: 16px;
	--space-0: 2px;
	--space-1: 4px;
	--space-2: 8px;
	--space-3: 12px;
	--space-4: 16px;
	--radius-sm: 4px;
	--radius-md: 8px;
	--transition-fast: 150ms ease;
	--bg-app: #fafafa;
	--bg-surface: #ffffff;
	--bg-elevated: #ffffff;
	--bg-canvas: #f0f0f0;
	--text-primary: #1a1a1a;
	--text-secondary: #666666;
	--text-muted: #999999;
	--border: #e0e0e0;
	--border-strong: #cccccc;
	--accent: #3b82f6;
	--accent-muted: #dbeafe;
	--destructive: #ef4444;
	--hashtag-bg: #dbeafe;
	--hashtag-text: #3b82f6;
	--highlight-bg: #fef08a;
	--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
	--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
}

[data-theme='dark'] {
	--bg-app: #0a0a0a;
	--bg-surface: #171717;
	--bg-elevated: #262626;
	--bg-canvas: #141414;
	--text-primary: #fafafa;
	--text-secondary: #a3a3a3;
	--text-muted: #737373;
	--border: #262626;
	--border-strong: #404040;
	--accent: #60a5fa;
	--accent-muted: #1e3a5f;
	--destructive: #f87171;
	--hashtag-bg: #1e3a5f;
	--hashtag-text: #60a5fa;
	--highlight-bg: #854d0e;
	--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
	--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
}`;
}

function getComponentCSS(): string {
	return `
/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; font-family: var(--font-sans); }
body { background: var(--bg-canvas); }

/* Canvas container */
.canvas-container {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	cursor: grab;
}
.canvas-container.panning { cursor: grabbing; }

.canvas-content {
	position: absolute;
	top: 0;
	left: 0;
	transform-origin: 0 0;
}

/* Nodes */
.canvas-object {
	position: absolute;
	background-color: var(--bg-surface);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	box-shadow: var(--shadow-sm);
	cursor: default;
	user-select: text;
}
.canvas-object.has-color {
	border-color: var(--node-color);
	background-color: color-mix(in srgb, var(--node-color) 12%, var(--bg-surface));
}
.object-content {
	width: 100%;
	height: 100%;
	overflow: hidden;
}

/* Group nodes */
.canvas-object.is-group {
	background-color: transparent;
	border-style: dashed;
	border-width: 2px;
	border-color: var(--border-strong);
	box-shadow: none;
}
.canvas-object.is-group.has-color {
	background-color: color-mix(in srgb, var(--node-color) 5%, transparent);
	border-color: var(--node-color);
}
.object-content.group-content {
	overflow: visible;
}
.group-container {
	width: 100%;
	height: 100%;
	position: relative;
}
.group-label {
	position: absolute;
	top: -24px;
	left: 0;
	font-size: 12px;
	font-weight: 500;
	color: var(--text-secondary);
}
.label-text {
	padding: var(--space-0) calc(var(--space-1) + var(--space-0));
	background: var(--bg-surface);
	border-radius: var(--radius-sm);
	white-space: nowrap;
	max-width: 200px;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* Text nodes */
.text-block {
	width: 100%;
	height: 100%;
	padding: var(--space-2);
	font-family: var(--font-sans);
	font-size: var(--font-size-base);
	line-height: 1.5;
	color: var(--text-primary);
	overflow: auto;
}
.text-rendered { overflow: auto; }
.text-placeholder { color: var(--text-muted); }

/* Markdown rendered styles */
.text-rendered h1, .text-rendered h2, .text-rendered h3 {
	margin: 0 0 0.5em;
	font-weight: 600;
	line-height: 1.3;
}
.text-rendered h1 { font-size: 1.5em; }
.text-rendered h2 { font-size: 1.25em; }
.text-rendered h3 { font-size: 1.1em; }
.text-rendered p { margin: 0 0 0.5em; }
.text-rendered p:last-child { margin-bottom: 0; }
.text-rendered strong { font-weight: 600; }
.text-rendered em { font-style: italic; }
.text-rendered code {
	font-family: var(--font-mono);
	font-size: 0.9em;
	padding: 0.1em 0.3em;
	background: var(--bg-elevated);
	border-radius: var(--radius-sm);
}
.text-rendered a {
	color: var(--accent);
	text-decoration: none;
}
.text-rendered a:hover { text-decoration: underline; }
.text-rendered ul, .text-rendered ol {
	margin: 0 0 0.5em;
	padding-left: 1.5em;
}
.text-rendered li { margin-bottom: 0.25em; }
.text-rendered blockquote {
	margin: 0 0 0.5em;
	padding-left: 1em;
	border-left: 3px solid var(--border-strong);
	color: var(--text-secondary);
}
.text-rendered hr {
	border: none;
	border-top: 1px solid var(--border);
	margin: 0.5em 0;
}
.text-rendered pre {
	margin: 0.5em 0;
	padding: var(--space-3);
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
	overflow-x: auto;
	font-family: var(--font-mono);
	font-size: 0.85em;
	line-height: 1.5;
}
.text-rendered pre code {
	background: transparent;
	padding: 0;
	border-radius: 0;
	font-size: inherit;
}
.text-rendered table {
	margin: 0.5em 0;
	border-collapse: collapse;
	width: 100%;
	font-size: 0.9em;
}
.text-rendered th, .text-rendered td {
	padding: var(--space-2) var(--space-3);
	border: 1px solid var(--border);
	text-align: left;
}
.text-rendered th {
	background: var(--bg-elevated);
	font-weight: 600;
	border-bottom: 2px solid var(--border-strong);
}
.text-rendered tr:nth-child(even) { background: var(--bg-elevated); }
.text-rendered td[align='center'], .text-rendered th[align='center'] { text-align: center; }
.text-rendered td[align='right'], .text-rendered th[align='right'] { text-align: right; }
.text-rendered li input[type='checkbox'] {
	margin-right: var(--space-2);
	cursor: default;
	vertical-align: middle;
}
.text-rendered li:has(input[type='checkbox']) {
	list-style-type: none;
	margin-left: -1.5em;
}
.text-rendered .hashtag {
	color: var(--hashtag-text, var(--accent));
	background: var(--hashtag-bg, var(--accent-muted));
	padding: 0 var(--space-1);
	border-radius: var(--radius-sm);
}
.text-rendered .search-highlight {
	background: var(--highlight-bg, #fef08a);
	color: inherit;
	padding: 0 var(--space-0);
	border-radius: var(--radius-sm);
}

/* Link nodes */
.link-block {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	width: 100%;
	height: 100%;
	padding: var(--space-2);
	font-family: var(--font-sans);
	font-size: var(--font-size-sm);
	color: var(--text-primary);
	overflow: hidden;
}
.link-icon {
	flex-shrink: 0;
	font-size: 16px;
	color: var(--accent);
}
.link-content {
	flex: 1;
	min-width: 0;
	overflow: hidden;
}
.link-label {
	font-weight: 500;
	color: var(--text-primary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	text-decoration: none;
}
.link-label:hover { text-decoration: underline; }
.link-label.invalid { color: var(--destructive); }
.link-url {
	font-size: var(--font-size-xs);
	color: var(--text-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.link-open {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	font-size: 14px;
	color: var(--text-secondary);
	text-decoration: none;
	border-radius: var(--radius-sm);
	transition: all var(--transition-fast);
}
.link-open:hover {
	color: var(--accent);
	background: var(--accent-muted);
}

/* Edges */
.edge-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 1px;
	height: 1px;
	pointer-events: none;
	overflow: visible;
}
.edge-label-container {
	overflow: visible;
}
.edge-label {
	display: flex;
	justify-content: center;
	padding: var(--space-0) calc(var(--space-1) + var(--space-0));
	background: var(--bg-surface);
	border-radius: var(--radius-sm);
	font-family: var(--font-sans);
	font-size: 12px;
	color: var(--text-secondary);
	white-space: nowrap;
	max-width: 200px;
	overflow: hidden;
	text-overflow: ellipsis;
	width: fit-content;
	margin: 0 auto;
}

/* Theme toggle */
.theme-toggle {
	position: fixed;
	top: 8px;
	right: 8px;
	z-index: 100;
	width: 32px;
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--bg-surface);
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
	cursor: pointer;
	font-size: 16px;
	color: var(--text-secondary);
	transition: all var(--transition-fast);
	padding: 0;
	line-height: 1;
}
.theme-toggle:hover {
	color: var(--text-primary);
	background: var(--bg-elevated);
}
[data-theme='dark'] .sun-icon { display: inline; }
[data-theme='dark'] .moon-icon { display: none; }
:root:not([data-theme='dark']) .sun-icon { display: none; }
:root:not([data-theme='dark']) .moon-icon { display: inline; }`;
}

// ─── JavaScript ──────────────────────────────────────────────────────

function getPanZoomJS(initialX: number, initialY: number, initialZoom: number): string {
	return `(function(){
var c=document.getElementById('canvas-container');
var t=document.getElementById('canvas-content');
var vp={x:${initialX},y:${initialY},z:${initialZoom}};

function up(){t.style.transform='translate('+vp.x+'px,'+vp.y+'px) scale('+vp.z+')';}

// Mouse pan
var pan=false,lx=0,ly=0;
c.addEventListener('mousedown',function(e){
	if(e.target.closest('a'))return;
	if(e.button===0){pan=true;lx=e.clientX;ly=e.clientY;c.classList.add('panning');}
});
document.addEventListener('mousemove',function(e){
	if(!pan)return;
	vp.x+=e.clientX-lx;vp.y+=e.clientY-ly;
	lx=e.clientX;ly=e.clientY;up();
});
document.addEventListener('mouseup',function(){
	pan=false;c.classList.remove('panning');
});

// Scroll zoom toward cursor
c.addEventListener('wheel',function(e){
	e.preventDefault();
	var r=c.getBoundingClientRect();
	var mx=e.clientX-r.left,my=e.clientY-r.top;
	var d=1-e.deltaY*0.002;
	var nz=Math.max(0.1,Math.min(5,vp.z*d));
	var s=nz/vp.z;
	vp.x=mx-(mx-vp.x)*s;
	vp.y=my-(my-vp.y)*s;
	vp.z=nz;up();
},{passive:false});

// Touch pan and pinch-to-zoom
var touches={},lastDist=0;
c.addEventListener('touchstart',function(e){
	if(e.target.closest('a'))return;
	for(var i=0;i<e.changedTouches.length;i++){
		var tt=e.changedTouches[i];
		touches[tt.identifier]={x:tt.clientX,y:tt.clientY};
	}
	if(e.touches.length===2){
		var dx=e.touches[0].clientX-e.touches[1].clientX;
		var dy=e.touches[0].clientY-e.touches[1].clientY;
		lastDist=Math.sqrt(dx*dx+dy*dy);
	}
},{passive:true});
c.addEventListener('touchmove',function(e){
	e.preventDefault();
	if(e.touches.length===1){
		var tt=e.touches[0];
		var prev=touches[tt.identifier];
		if(prev){vp.x+=tt.clientX-prev.x;vp.y+=tt.clientY-prev.y;prev.x=tt.clientX;prev.y=tt.clientY;up();}
	}else if(e.touches.length===2){
		var dx=e.touches[0].clientX-e.touches[1].clientX;
		var dy=e.touches[0].clientY-e.touches[1].clientY;
		var dist=Math.sqrt(dx*dx+dy*dy);
		if(lastDist>0){
			var r=c.getBoundingClientRect();
			var mx=(e.touches[0].clientX+e.touches[1].clientX)/2-r.left;
			var my=(e.touches[0].clientY+e.touches[1].clientY)/2-r.top;
			var d=dist/lastDist;
			var nz=Math.max(0.1,Math.min(5,vp.z*d));
			var s=nz/vp.z;
			vp.x=mx-(mx-vp.x)*s;
			vp.y=my-(my-vp.y)*s;
			vp.z=nz;up();
		}
		lastDist=dist;
		for(var i=0;i<e.touches.length;i++){
			var tt2=e.touches[i];
			touches[tt2.identifier]={x:tt2.clientX,y:tt2.clientY};
		}
	}
},{passive:false});
c.addEventListener('touchend',function(e){
	for(var i=0;i<e.changedTouches.length;i++){delete touches[e.changedTouches[i].identifier];}
	lastDist=0;
},{passive:true});

up();
})();`;
}

// ─── Main export function ────────────────────────────────────────────

export function generateHtml(canvas: CanvasFile, options: HtmlExportOptions = {}): string {
	const { title = 'Canvas Export', defaultTheme = 'auto', forPrint = false } = options;
	const nodes = canvas.nodes;
	const edges = canvas.edges;

	// Calculate bounding box for initial viewport
	const bounds = calculateBoundingBox(nodes);
	const PADDING = 50;

	// Pre-render markdown for text nodes
	const renderedMarkdown = new Map<string, string>();
	for (const node of nodes) {
		if (isTextNode(node)) {
			renderedMarkdown.set(node.id, renderMarkdown(node.text));
		}
	}

	// Generate node HTML
	const nodeHtml = nodes.map(n => generateNodeHtml(n, renderedMarkdown)).join('\n');

	// Generate edge SVG
	const edgeSvg = generateEdgeSvg(edges, nodes);

	// Calculate initial viewport to fit all content
	let vpX = 0;
	let vpY = 0;
	let vpZoom = 1;

	if (!forPrint && bounds) {
		// For interactive: center content with fit-to-view
		// We use a reasonable default viewport size (will be adjusted by JS)
		vpX = -(bounds.x - PADDING);
		vpY = -(bounds.y - PADDING);
		vpZoom = 1;
	}

	// For print mode: offset content to start from origin
	let printTransform = '';
	if (forPrint && bounds) {
		const offsetX = -(bounds.x) + PADDING;
		const offsetY = -(bounds.y) + PADDING;
		printTransform = `transform:translate(${offsetX}px,${offsetY}px);`;
	}

	// Theme initialization
	let themeInit = '';
	if (defaultTheme === 'dark') {
		themeInit = `document.documentElement.setAttribute('data-theme','dark');`;
	} else if (defaultTheme === 'auto') {
		themeInit = `if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark');}`;
	}

	const themeToggleHtml = forPrint ? '' :
		`<button class="theme-toggle" onclick="(function(){var r=document.documentElement;r.setAttribute('data-theme',r.getAttribute('data-theme')==='dark'?'light':'dark');})()" title="Toggle theme">` +
		`<span class="sun-icon">\u2600</span><span class="moon-icon">\u263E</span>` +
		`</button>`;

	const printCSS = forPrint ? `
@page { size: landscape; margin: 0.5in; }
@media print {
	.canvas-container { overflow: visible !important; }
	body { overflow: visible !important; }
}` : '';

	const panZoomScript = forPrint ? '' : getPanZoomJS(vpX, vpY, vpZoom);

	const contentStyle = forPrint
		? `style="${printTransform}"`
		: `style="transform:translate(${vpX}px,${vpY}px) scale(${vpZoom})"`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
${getThemeCSS()}
${getComponentCSS()}
${printCSS}
</style>
</head>
<body>
${themeToggleHtml}
<div id="canvas-container" class="canvas-container">
<div id="canvas-content" class="canvas-content" ${contentStyle}>
${edgeSvg}
${nodeHtml}
</div>
</div>
<script>
${themeInit}
${panZoomScript}
</script>
</body>
</html>`;
}
