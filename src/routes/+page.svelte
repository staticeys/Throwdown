<script lang="ts">
	import { onMount } from 'svelte';
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import CanvasWorkspace from '$lib/components/canvas/canvas-workspace.svelte';
	import CanvasObject from '$lib/components/canvas/canvas-object.svelte';
	import TextBlock from '$lib/components/canvas/text-block.svelte';
	import LinkBlock from '$lib/components/canvas/link-block.svelte';
	import CanvasRef from '$lib/components/canvas/canvas-ref.svelte';
	import ContextMenu from '$lib/components/ui/context-menu.svelte';
	import Toolbar from '$lib/components/ui/toolbar.svelte';
	import ThemeToggle from '$lib/components/ui/theme-toggle.svelte';
	import CanvasTabs from '$lib/components/ui/canvas-tabs.svelte';
	import TipsOverlay from '$lib/components/ui/tips-overlay.svelte';
	import type { ContextMenuItem } from '$lib/components/ui/context-menu.svelte';
	import { isTextNode, isLinkNode, isGroupNode } from '$lib/types/canvas';
	import type { TextNode, LinkNode, GroupNode } from '$lib/types/canvas';
	import { parseClipboard } from '$lib/utils/paste-detection';
	import { icons } from '$lib/components/icons';
	import { cleanTrackingFromUrl } from '$lib/utils/url-cleaner';

	// Component refs for triggering edit mode
	let blockRefs = $state<Record<string, TextBlock | LinkBlock | CanvasRef>>({});

	// Workspace ref for coordinate conversion
	// svelte-ignore non_reactive_update
	let workspaceRef: CanvasWorkspace;

	// Context menu state
	let contextMenu = $state<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

	// Track last mouse position for paste
	let lastMousePos = $state({ x: 0, y: 0 });

	// Initialize stores on mount
	onMount(async () => {
		await Promise.all([
			canvasStore.init(),
			themeStore.init()
		]);
	});

	// Manage link mode body class for cursor styles
	$effect(() => {
		if (canvasStore.isLinkMode) {
			document.body.classList.add('link-mode');
		} else {
			document.body.classList.remove('link-mode');
		}
	});

	// Deselect hidden nodes when filters change
	$effect(() => {
		const hiddenIds = canvasStore.hiddenNodeIds;
		if (hiddenIds.size > 0) {
			const newSelection = canvasStore.selection.filter((id) => !hiddenIds.has(id));
			if (newSelection.length !== canvasStore.selection.length) {
				canvasStore.setSelection(newSelection);
			}
		}
	});

	// Handle double-click on canvas object to start editing
	function handleNodeEdit(id: string) {
		const ref = blockRefs[id];
		if (ref && 'startEdit' in ref) {
			ref.startEdit();
		}
	}

	// Handle double-click on empty canvas to create text node
	function handleCanvasDblClick(e: MouseEvent) {
		// Only if clicking directly on canvas (not on a node)
		const target = e.target as HTMLElement;
		if (target.closest('.canvas-object')) return;

		const canvasPos = workspaceRef?.screenToCanvas(e.clientX, e.clientY);
		if (canvasPos) {
			const node = canvasStore.addTextNode(canvasPos.x - 100, canvasPos.y - 50);
			canvasStore.selectOnly(node.id);
			// Start editing after a tick
			requestAnimationFrame(() => {
				const ref = blockRefs[node.id];
				if (ref && 'startEdit' in ref) {
					ref.startEdit();
				}
			});
		}
	}

	// Handle right-click context menu
	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();

		lastMousePos = { x: e.clientX, y: e.clientY };
		const target = e.target as HTMLElement;
		const nodeEl = target.closest('.canvas-object') as HTMLElement | null;

		if (nodeEl) {
			// Context menu for node - target the clicked node
			const nodeId = nodeEl.dataset.nodeId;
			if (nodeId && !canvasStore.isSelected(nodeId)) {
				canvasStore.selectOnly(nodeId);
			}
			contextMenu = {
				x: e.clientX,
				y: e.clientY,
				items: getNodeMenuItems(nodeId)
			};
		} else {
			// Context menu for empty canvas
			contextMenu = {
				x: e.clientX,
				y: e.clientY,
				items: getCanvasMenuItems()
			};
		}
	}

	// Get menu items for empty canvas
	function getCanvasMenuItems(): ContextMenuItem[] {
		const canvasPos = workspaceRef?.screenToCanvas(lastMousePos.x, lastMousePos.y);
		const x = canvasPos?.x ?? 0;
		const y = canvasPos?.y ?? 0;

		return [
			{
				label: 'Add Text',
				icon: icons.text,
				action: () => {
					const node = canvasStore.addTextNode(x - 100, y - 50);
					canvasStore.selectOnly(node.id);
				}
			},
			{
				label: 'Add Link',
				icon: icons.link,
				action: () => {
					const node = canvasStore.addLinkNode(x - 100, y - 50, 'https://');
					canvasStore.selectOnly(node.id);
					requestAnimationFrame(() => {
						const ref = blockRefs[node.id];
						if (ref && 'startEdit' in ref) {
							ref.startEdit();
						}
					});
				}
			},
			{
				label: 'Add Group',
				icon: icons.canvas,
				action: () => {
					const node = canvasStore.addGroupNode(x - 100, y - 50);
					canvasStore.selectOnly(node.id);
				}
			},
			{ label: '', icon: '', action: () => {}, separator: true },
			{
				label: 'Paste',
				icon: icons.import,
				action: handlePaste
			}
		];
	}

	// Get menu items for selected node(s)
	function getNodeMenuItems(nodeId: string | undefined): ContextMenuItem[] {
		const hasSelection = canvasStore.selection.length > 0;
		const hasMultiple = canvasStore.selection.length > 1;

		// Check if the node is a link node for Clean Tracking option
		const node = nodeId ? canvasStore.activeCanvas?.nodes.find(n => n.id === nodeId) : null;
		const isLink = node && isLinkNode(node);

		const menuItems: ContextMenuItem[] = [
			{
				label: 'Edit',
				icon: icons.edit,
				action: () => {
					if (nodeId) handleNodeEdit(nodeId);
				},
				disabled: !nodeId || hasMultiple
			}
		];

		// Add "Clean Tracking" option for link nodes
		if (isLink && !hasMultiple) {
			menuItems.push({
				label: 'Clean Tracking',
				icon: '🧹',
				action: () => {
					if (nodeId && node && isLinkNode(node)) {
						const cleanedUrl = cleanTrackingFromUrl(node.url);
						if (cleanedUrl !== node.url) {
							canvasStore.updateNode(nodeId, { url: cleanedUrl });
						}
					}
				},
				disabled: false
			});
		}

		menuItems.push(
			{ label: '', icon: '', action: () => {}, separator: true },
			{
				label: hasMultiple ? 'Link Selected' : 'Link',
				icon: icons.arrow,
				action: () => canvasStore.linkSelectedNodes(),
				disabled: !hasMultiple
			},
			{ label: '', icon: '', action: () => {}, separator: true },
			{
				label: hasMultiple ? 'Delete All' : 'Delete',
				icon: icons.trash,
				action: () => canvasStore.deleteSelectedNodes(),
				disabled: !hasSelection
			}
		);

		return menuItems;
	}

	// Handle paste
	async function handlePaste() {
		const clipboard = await parseClipboard();
		if (!clipboard) return;

		const canvasPos = workspaceRef?.screenToCanvas(lastMousePos.x, lastMousePos.y);
		const x = canvasPos?.x ?? 100;
		const y = canvasPos?.y ?? 100;

		if (clipboard.type === 'url') {
			const node = canvasStore.addLinkNode(x - 100, y - 50, clipboard.content);
			canvasStore.selectOnly(node.id);
		} else {
			const node = canvasStore.addTextNode(x - 100, y - 50, clipboard.content);
			canvasStore.selectOnly(node.id);
		}
	}

	// Handle keyboard paste
	function handleKeyDown(e: KeyboardEvent) {
		// Ignore if typing
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		// Ctrl/Cmd + V - Paste
		if (e.code === 'KeyV' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			// Use center of viewport if no recent mouse position
			if (lastMousePos.x === 0 && lastMousePos.y === 0) {
				lastMousePos = {
					x: window.innerWidth / 2,
					y: window.innerHeight / 2
				};
			}
			handlePaste();
		}
	}

	// Track mouse position
	function handleMouseMove(e: MouseEvent) {
		lastMousePos = { x: e.clientX, y: e.clientY };
	}

	// Clear selection when clicking on empty canvas
	function handleCanvasClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.canvas-object')) {
			// In link mode, clicking empty canvas clears source (allows choosing new source)
			if (canvasStore.isLinkMode) {
				canvasStore.clearLinkSource();
			} else {
				canvasStore.clearSelection();
			}
		}
	}

	// Close context menu
	function closeContextMenu() {
		contextMenu = null;
	}

	// Toolbar actions - add nodes at center of viewport
	function addNodeAtCenter(type: 'text' | 'link' | 'group') {
		const centerX = window.innerWidth / 2;
		const centerY = window.innerHeight / 2;
		const canvasPos = workspaceRef?.screenToCanvas(centerX, centerY);
		const x = (canvasPos?.x ?? 0) - 100;
		const y = (canvasPos?.y ?? 0) - 50;

		let node;
		if (type === 'text') {
			node = canvasStore.addTextNode(x, y);
		} else if (type === 'link') {
			node = canvasStore.addLinkNode(x, y, 'https://');
		} else {
			node = canvasStore.addGroupNode(x, y);
		}

		canvasStore.selectOnly(node.id);

		// Start editing for text and link nodes
		if (type !== 'group') {
			requestAnimationFrame(() => {
				const ref = blockRefs[node.id];
				if (ref && 'startEdit' in ref) {
					ref.startEdit();
				}
			});
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<svelte:head>
	<title>Canvas App</title>
</svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="app-container">
	{#if canvasStore.isLoading}
		<div class="loading">Loading...</div>
	{:else}
		<!-- Header with tabs and theme toggle -->
		<header class="app-header">
			<CanvasTabs />
			<div class="header-actions">
				<ThemeToggle />
			</div>
		</header>

		<!-- Toolbar -->
		<Toolbar
			onAddText={() => addNodeAtCenter('text')}
			onAddLink={() => addNodeAtCenter('link')}
			onAddGroup={() => addNodeAtCenter('group')}
		/>

		<!-- Canvas area -->
		<main
			class="canvas-area"
			oncontextmenu={handleContextMenu}
			ondblclick={handleCanvasDblClick}
			onmousemove={handleMouseMove}
			onclick={handleCanvasClick}
		>
			<CanvasWorkspace bind:this={workspaceRef}>
				{#each canvasStore.renderableNodes as node (node.id)}
					<CanvasObject {node} onEdit={handleNodeEdit}>
						{#if isTextNode(node)}
							<TextBlock
								node={node as TextNode}
								bind:this={blockRefs[node.id]}
							/>
						{:else if isLinkNode(node)}
							<LinkBlock
								node={node as LinkNode}
								bind:this={blockRefs[node.id]}
							/>
						{:else if isGroupNode(node)}
							<CanvasRef
								node={node as GroupNode}
								bind:this={blockRefs[node.id]}
							/>
						{/if}
					</CanvasObject>
				{/each}
			</CanvasWorkspace>
		</main>
	{/if}
</div>

{#if contextMenu}
	<ContextMenu
		x={contextMenu.x}
		y={contextMenu.y}
		items={contextMenu.items}
		onClose={closeContextMenu}
	/>
{/if}

{#if canvasStore.isLinkMode}
	<div class="link-mode-overlay">
		<div class="link-mode-status">
			<span class="link-icon">🔗</span>
			Link Mode
			<span class="link-status-divider">•</span>
			{#if canvasStore.linkSource}
				Click destination(s)
			{:else}
				Click source
			{/if}
			<span class="link-status-divider">•</span>
			<kbd>Esc</kbd> to exit • <kbd>⇧⌘L</kbd> to toggle
		</div>
	</div>
{/if}

<TipsOverlay />

<style>
	.app-container {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: var(--bg-app);
		overflow: hidden;
	}

	.app-header {
		display: flex;
		align-items: center;
		background-color: var(--bg-app);
	}

	.app-header :global(.canvas-tabs) {
		flex: 1;
	}

	.header-actions {
		display: flex;
		align-items: center;
		padding: 0 var(--space-2);
	}

	.canvas-area {
		flex: 1;
		overflow: hidden;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-family: var(--font-sans);
		color: var(--text-secondary);
	}

	/* Link mode overlay */
	.link-mode-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 100;
	}

	.link-mode-status {
		position: absolute;
		top: var(--header-height);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: var(--accent);
		color: white;
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: var(--font-size-base);
		font-weight: 500;
		box-shadow: var(--shadow-lg);
		pointer-events: auto;
		user-select: none;
	}

	.link-icon {
		font-size: 16px;
	}

	.link-status-divider {
		opacity: 0.6;
	}

	.link-mode-status kbd {
		padding: 2px 6px;
		background: var(--white-alpha-20);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	/* Global link mode cursor - applied via body class */
	:global(body.link-mode) {
		cursor: crosshair;
	}

	:global(body.link-mode .canvas-object) {
		cursor: pointer;
	}
</style>
