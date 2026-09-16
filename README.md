# Molecular State Analyzer

Free, browser-only, protein-agnostic workspace for molecular analysis projects.
Phase 1 provides local project persistence via IndexedDB and an empty dashboard
shell — no fake analysis, mock molecular data, or server calls for the core flow.

## Requirements

- Node.js 18+ (recommended: current LTS)
- A modern browser with IndexedDB support

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

## Production build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## What Phase 1 includes

- **Project picker** — create and open projects stored in IndexedDB
- **Persistence** — projects survive page refresh in the same browser
- **Empty dashboard shell** — shown only when a project is open
- **Save** — updates `updatedAt` for the open project

All project data stays on the user’s device. There is no backend in Phase 1.

## Stack

- Vite + React + TypeScript
- [idb](https://github.com/jakearchibald/idb) for IndexedDB
