import adapter from '@sveltejs/adapter-static';

// TODO: Set your GitHub repo name here for GitHub Pages deployment
const REPO_NAME = 'Throwdown';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		paths: {
			base: process.env.NODE_ENV === 'production' && REPO_NAME ? `/${REPO_NAME}` : ''
		},
		prerender: {
			entries: ['/']
		}
	}
};

export default config;
