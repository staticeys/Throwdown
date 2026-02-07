# Throwdown

Open live app [here](https://staticeys.github.io/Throwdown/)

A snappy canvas / whiteboard application for throwing down notes, links, and ideas. Built with Svelte 5 and SvelteKit. Runs client side, so your data stays private. The data is stored within your browser's local storage and can be exported to .canvas plain text files.

## Features

- **Infinite canvas** with pan and zoom
- **Text nodes** with GitHub Flavored Markdown support
- **URL Link nodes** for bookmarks with URL context extraction
- **Group nodes** for organising related content
- **Edges** to connect nodes with arrows and labels
- **Alignment snapping** for lining up nodes
- **Inline hashtags with filtering** and text search
- **Multi-canvas tabs** for separate workspaces
- **Import/export** in JSON Canvas format (compatible with Obsidian)
- **HTML export** — self-contained, interactive read-only files with pan/zoom, embeddable via iframe
- **PDF export** via browser print dialog
- **Light/dark theme** with toggle
- **Keyboard shortcuts** for efficient navigation

## Security

- Runs entirely client-side — no server, no accounts, no tracking
- Data stored in your browser's IndexedDB; never leaves your machine
- Markdown rendered with DOMPurify sanitization (strict tag/attribute allowlists)
- URI protocols restricted to https, http, mailto, tel — blocks javascript: and data: schemes
- Links open with `rel="noopener noreferrer"`

## License

MIT

---
Yes, vibe coded and quickly too. Enjoy.