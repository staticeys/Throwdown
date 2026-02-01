<script lang="ts">
	// Props
	let {
		start,
		end
	}: {
		start: { x: number; y: number } | null;
		end: { x: number; y: number } | null;
	} = $props();

	// Calculate box dimensions
	let box = $derived.by(() => {
		if (!start || !end) return null;

		const x = Math.min(start.x, end.x);
		const y = Math.min(start.y, end.y);
		const width = Math.abs(end.x - start.x);
		const height = Math.abs(end.y - start.y);

		return { x, y, width, height };
	});
</script>

{#if box}
	<div
		class="selection-box"
		style:left="{box.x}px"
		style:top="{box.y}px"
		style:width="{box.width}px"
		style:height="{box.height}px"
	></div>
{/if}

<style>
	.selection-box {
		position: absolute;
		border: 2px dashed var(--selection);
		background-color: var(--selection-bg);
		opacity: 0.3;
		pointer-events: none;
		z-index: 1000;
	}
</style>
