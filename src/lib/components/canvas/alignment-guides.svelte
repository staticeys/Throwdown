<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.svelte';

	// Get alignment guides from store
	let guides = $derived(canvasStore.alignmentGuides);

	// Canvas bounds for extending guide lines
	// We use large values to ensure lines extend beyond visible area
	const EXTENT = 10000;
</script>

{#if guides && (guides.vertical.length > 0 || guides.horizontal.length > 0)}
	<svg
		class="alignment-guides"
		xmlns="http://www.w3.org/2000/svg"
		overflow="visible"
	>
		<!-- Vertical guide lines (for horizontal/x-axis alignment) -->
		{#each guides.vertical as x}
			<line
				x1={x}
				y1={-EXTENT}
				x2={x}
				y2={EXTENT}
				class="guide-line"
			/>
		{/each}

		<!-- Horizontal guide lines (for vertical/y-axis alignment) -->
		{#each guides.horizontal as y}
			<line
				x1={-EXTENT}
				y1={y}
				x2={EXTENT}
				y2={y}
				class="guide-line"
			/>
		{/each}
	</svg>
{/if}

<style>
	.alignment-guides {
		position: absolute;
		top: 0;
		left: 0;
		/* Explicit 1px dimensions for Chromium compatibility */
		width: 1px;
		height: 1px;
		pointer-events: none;
		overflow: visible;
		z-index: 1000;
	}

	.guide-line {
		stroke: var(--accent);
		stroke-width: 1;
		stroke-dasharray: 4 4;
		opacity: 0.8;
	}
</style>
