# Molecular State Analyzer

Free, browser-only, protein-agnostic workspace for molecular analysis projects.
All project and import data stays on the user’s device (IndexedDB). There is no
backend.

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

## What Phase 2 includes

- **Project picker** — create and open projects stored in IndexedDB
- **Data import** — FASTA, PDB, mmCIF, CSV/TSV, JSON
- **Column mapping** — CSV/JSON require an explicit time-series column mapping
  before data is committed to the project
- **No silent mutation** — original file text is stored unchanged; parse notes
  and warnings are shown; commit is always an explicit user action
- **Empty analysis shell** — dashboard does not invent charts or scores
- **System fonts only** — no Google Fonts / CDN font dependency

## Import formats

| Format | Notes |
|--------|--------|
| FASTA (`.fasta`, `.fa`, …) | Counts sequences/residues from headers + sequence lines |
| PDB (`.pdb`, `.ent`) | Counts ATOM/HETATM, models, chains |
| mmCIF (`.cif`, `.mmcif`) | Discovers data blocks, categories, `_atom_site` rows |
| CSV / TSV | Delimiter auto-detected; **column mapping required** |
| JSON | Array of objects or `{ columns, rows }` / `{ data }`; **mapping required** |

## Stack

- Vite + React + TypeScript
- [idb](https://github.com/jakearchibald/idb) for IndexedDB
