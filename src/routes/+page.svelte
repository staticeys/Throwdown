<script lang="ts">
	import { onMount } from 'svelte';
	import { canvasStore } from '$lib/stores/canvas.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import CanvasWorkspace from '$lib/components/canvas/canvas-workspace.svelte';
	import CanvasObject from '$lib/components/canvas/canvas-object.svelte';
	import TextBlock from '$lib/components/canvas/text-block.svelte';
	import LinkBlock from '$lib/components/canvas/link-block.svelte';
	import CanvasRef from '$lib/components/canvas/canvas-ref.svelte';
	import FileBlock from '$lib/components/canvas/file-block.svelte';
	import ContextMenu from '$lib/components/ui/context-menu.svelte';
	import CanvasToolbar from '$lib/components/ui/canvas-toolbar.svelte';
	import HelpDropdown from '$lib/components/ui/help-dropdown.svelte';
	import ThemeToggle from '$lib/components/ui/theme-toggle.svelte';
	import CanvasTabs from '$lib/components/ui/canvas-tabs.svelte';
	import TipsOverlay from '$lib/components/ui/tips-overlay.svelte';
	import { downloadCanvas, downloadHtml, downloadCanvasWithFiles, importCanvas, importCanvasFromZip, exportPdf } from '$lib/db/canvas-io';
	import type { ContextMenuItem } from '$lib/components/ui/context-menu.svelte';
	import { isTextNode, isLinkNode, isGroupNode, isFileNode, COLOR_PRESETS } from '$lib/types/canvas';
	import type { TextNode, LinkNode, GroupNode, FileNode } from '$lib/types/canvas';
	import { parseClipboard } from '$lib/utils/paste-detection';
	import { icons } from '$lib/components/icons';
	import { cleanTrackingFromUrl } from '$lib/utils/url-cleaner';
	import { isOPFSSupported, saveFileToOPFS, canSaveFile } from '$lib/platform/fs-opfs';
	import { requestPersistentStorage } from '$lib/db/indexed-db';

	// Component refs for triggering edit mode
	let blockRefs = $state<Record<string, TextBlock | LinkBlock | CanvasRef>>({});

	// Workspace ref for coordinate conversion
	// svelte-ignore non_reactive_update
	let workspaceRef: CanvasWorkspace;

	// Context menu state
	let contextMenu = $state<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

	// Track last mouse position for paste
	let lastMousePos = $state({ x: 0, y: 0 });

	// Header export dropdown state
	let showExportMenu = $state(false);

	// Import canvas file (.canvas, .json, or .zip with files)
	async function handleImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.canvas,.json,.zip';

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;

			try {
				if (file.name.endsWith('.zip')) {
					const { canvas, files } = await importCanvasFromZip(file);
					await canvasStore.importCanvasWithFiles(canvas, files);
				} else {
					const text = await file.text();
					const canvas = importCanvas(text);
					canvasStore.importCanvasData(canvas);
				}
			} catch (error) {
				console.error('Failed to import:', error);
			}
		};

		input.click();
	}

	// Export canvas
	async function handleExport(type: 'canvas' | 'canvas-zip' | 'html' | 'pdf') {
		showExportMenu = false;
		const canvas = canvasStore.activeCanvas;
		if (!canvas) return;

		switch (type) {
			case 'canvas':
				downloadCanvas(canvas);
				break;
			case 'canvas-zip':
				await downloadCanvasWithFiles(canvas, canvasStore.activeCanvasId);
				break;
			case 'html':
				downloadHtml(canvas);
				break;
			case 'pdf':
				exportPdf(canvas, canvas['x-metadata']?.name);
				break;
		}
	}

	// Initialize stores on mount
	onMount(async () => {
		await Promise.all([
			canvasStore.init(),
			themeStore.init()
		]);

		// Request persistent storage to prevent browser eviction of OPFS/IndexedDB data
		requestPersistentStorage().catch(() => {});
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
			...(isOPFSSupported() ? [{
				label: 'Add File',
				icon: icons.file,
				action: () => openFilePicker(x, y)
			}] : []),
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

		// Determine active color: highlight only if all selected nodes share the same color
		const selectedNodes = canvasStore.selectedNodes;
		const firstColor = selectedNodes[0]?.color;
		const sharedColor = selectedNodes.every(n => n.color === firstColor) ? firstColor : null;
		const nodeColorItems = Object.entries(COLOR_PRESETS).map(([key, hex]) => ({
			hex,
			value: key as string | undefined,
			active: sharedColor === key
		}));
		nodeColorItems.unshift({ hex: '', value: undefined, active: sharedColor === undefined });

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
				label: 'Color',
				icon: '',
				action: () => {},
				colors: nodeColorItems,
				onColorSelect: (value: string | undefined) => {
					canvasStore.setSelectedNodesColor(value);
				}
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

	// Get menu items for edge context menu
	function getEdgeMenuItems(edgeId: string): ContextMenuItem[] {
		const edge = canvasStore.getEdge(edgeId);
		if (!edge) return [];

		// Build color row with 6 presets + default
		const currentColor = edge.color;
		const colorItems = Object.entries(COLOR_PRESETS).map(([key, hex]) => ({
			hex,
			value: key as string | undefined,
			active: currentColor === key
		}));
		colorItems.unshift({ hex: '', value: undefined, active: currentColor === undefined });

		return [
			{
				label: 'Edit Label',
				icon: icons.edit,
				action: () => {
					workspaceRef?.startEditingEdge(edgeId);
				}
			},
			{ label: '', icon: '', action: () => {}, separator: true },
			{
				label: '←',
				action: () => {
					canvasStore.updateEdge(edgeId, {
						fromEnd: edge.fromEnd === 'arrow' ? 'none' : 'arrow'
					});
				},
				checked: edge.fromEnd === 'arrow'
			},
			{
				label: '→',
				action: () => {
					canvasStore.updateEdge(edgeId, {
						toEnd: edge.toEnd === 'none' ? 'arrow' : 'none'
					});
				},
				checked: edge.toEnd !== 'none'
			},
			{ label: '', icon: '', action: () => {}, separator: true },
			{
				label: 'Color',
				icon: '',
				action: () => {},
				colors: colorItems,
				onColorSelect: (value: string | undefined) => {
					canvasStore.updateEdge(edgeId, { color: value });
				}
			},
			{ label: '', icon: '', action: () => {}, separator: true },
			{
				label: 'Delete',
				icon: icons.trash,
				action: () => canvasStore.deleteEdge(edgeId)
			}
		];
	}

	// Handle edge context menu
	function handleEdgeContextMenu(e: MouseEvent, edgeId: string) {
		contextMenu = {
			x: e.clientX,
			y: e.clientY,
			items: getEdgeMenuItems(edgeId)
		};
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
			canvasStore.clearSelection();
		}
	}

	// Close context menu
	function closeContextMenu() {
		contextMenu = null;
	}

	// Open file picker and create file nodes at given canvas position
	async function openFilePicker(x: number, y: number) {
		if (!isOPFSSupported()) return;

		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;

		input.onchange = async () => {
			const files = input.files;
			if (!files || files.length === 0) return;

			const STACK_OFFSET = 20;

			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const fits = await canSaveFile(file.size);
				if (!fits) continue;

				try {
					const node = canvasStore.addFileNode(
						x + (i * STACK_OFFSET) - 100,
						y + (i * STACK_OFFSET) - 50,
						file.name,
						file.type || 'application/octet-stream',
						file.size
					);
					await saveFileToOPFS(file, canvasStore.activeCanvasId, node.id);
					if (i === 0) canvasStore.selectOnly(node.id);
					else canvasStore.select(node.id);
				} catch (error) {
					console.error('Failed to save file:', file.name, error);
				}
			}
		};

		input.click();
	}

	// Toolbar actions - add nodes at center of viewport
	function addNodeAtCenter(type: 'text' | 'link' | 'group' | 'file') {
		const centerX = window.innerWidth / 2;
		const centerY = window.innerHeight / 2;
		const canvasPos = workspaceRef?.screenToCanvas(centerX, centerY);
		const x = (canvasPos?.x ?? 0) - 100;
		const y = (canvasPos?.y ?? 0) - 50;

		if (type === 'file') {
			openFilePicker(x + 100, y + 50);
			return;
		}

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
		<!-- Header -->
		<header class="app-header">
			<button
				class="header-btn"
				onclick={() => canvasStore.createNewCanvas('Untitled')}
				title="New Canvas"
			>
				{icons.add}
			</button>

			<CanvasTabs />

			<button class="header-btn" onclick={handleImport} title="Import Canvas">
				{icons.import}
			</button>

			<div class="header-dropdown">
				<button
					class="header-btn"
					class:active={showExportMenu}
					onclick={() => (showExportMenu = !showExportMenu)}
					title="Export Canvas"
				>
					{icons.export}
				</button>
				{#if showExportMenu}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="dropdown-backdrop" onclick={() => (showExportMenu = false)}></div>
					<div class="dropdown-menu">
						<button class="dropdown-item" onclick={() => handleExport('canvas')}>
							<span class="dropdown-icon">◇</span>
							<span>Canvas</span>
						</button>
						<button class="dropdown-item" onclick={() => handleExport('canvas-zip')}>
							<span class="dropdown-icon">▨</span>
							<span>Canvas + Files</span>
						</button>
						<button class="dropdown-item" onclick={() => handleExport('html')}>
							<span class="dropdown-icon">⧉</span>
							<span>HTML</span>
						</button>
						<button class="dropdown-item" onclick={() => handleExport('pdf')}>
							<span class="dropdown-icon">▤</span>
							<span>PDF</span>
						</button>
					</div>
				{/if}
			</div>

			<HelpDropdown />

			<div class="header-actions">
				<ThemeToggle />
			</div>
		</header>

		<!-- Canvas area -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<main
			class="canvas-area"
			oncontextmenu={handleContextMenu}
			ondblclick={handleCanvasDblClick}
			onmousemove={handleMouseMove}
			onclick={handleCanvasClick}
		>
			<CanvasToolbar
				onAddText={() => addNodeAtCenter('text')}
				onAddLink={() => addNodeAtCenter('link')}
				onAddGroup={() => addNodeAtCenter('group')}
				onAddFile={isOPFSSupported() ? () => addNodeAtCenter('file') : undefined}
			/>
			<CanvasWorkspace bind:this={workspaceRef} onedgecontextmenu={handleEdgeContextMenu}>
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
						{:else if isFileNode(node)}
							<FileBlock
								node={node as FileNode}
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
		gap: var(--space-1);
		padding: 0 var(--space-2);
		background-color: var(--bg-app);
		border-bottom: 1px solid var(--border);
	}

	.app-header :global(.canvas-tabs) {
		flex: 1;
	}

	.header-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		font-size: var(--font-size-md);
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		flex-shrink: 0;
		transition: all var(--transition-fast);
	}

	.header-btn:hover {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.header-btn.active {
		color: var(--text-primary);
		background-color: var(--bg-elevated);
	}

	.header-dropdown {
		position: relative;
	}

	.dropdown-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: var(--space-1);
		min-width: 160px;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		z-index: 100;
		overflow: hidden;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--text-primary);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color var(--transition-fast);
	}

	.dropdown-item:hover {
		background-color: var(--bg-elevated);
	}

	.dropdown-icon {
		width: 16px;
		text-align: center;
		color: var(--text-secondary);
	}

	.header-actions {
		display: flex;
		align-items: center;
		padding: 0 var(--space-1);
	}

	.canvas-area {
		flex: 1;
		position: relative;
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

</style>
