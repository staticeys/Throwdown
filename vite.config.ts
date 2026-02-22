import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

const BASE = process.env.NODE_ENV === 'production' ? '/Throwdown' : '';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			srcDir: 'src',
			scope: `${BASE}/`,
			base: `${BASE}/`,
			strategies: 'generateSW',
			manifest: {
				name: 'Throwdown',
				short_name: 'Throwdown',
				description: 'Canvas node editor',
				start_url: `${BASE}/`,
				scope: `${BASE}/`,
				display: 'standalone',
				background_color: '#0e0e0e',
				theme_color: '#0e0e0e',
				icons: [
					{
						src: `${BASE}/td192.png`,
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: `${BASE}/td512.png`,
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: `${BASE}/td512.png`,
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}']
			},
			kit: {
				includeVersionFile: true
			},
			devOptions: {
				enabled: false
			}
		})
	],
	build: {
		target: 'esnext'
	},
	server: {
		hmr: {
			overlay: false
		}
	}
});
