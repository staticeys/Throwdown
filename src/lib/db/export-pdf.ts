/**
 * PDF export via browser print dialog.
 * Generates a print-optimized HTML document and opens the native print dialog.
 */
import type { CanvasFile } from '$lib/types/canvas';
import { generateHtml } from './export-html';

export function exportPdf(canvas: CanvasFile, title?: string): void {
	const html = generateHtml(canvas, {
		title: title ?? 'Canvas Export',
		defaultTheme: 'light',
		forPrint: true
	});

	const printWindow = window.open('', '_blank');
	if (!printWindow) {
		alert('Please allow popups to export PDF');
		return;
	}

	printWindow.document.write(html);
	printWindow.document.close();

	printWindow.addEventListener('load', () => {
		// Brief delay to ensure rendering is complete
		setTimeout(() => printWindow.print(), 200);
	});
}
