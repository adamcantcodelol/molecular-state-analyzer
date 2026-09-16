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

## What Phase 3 includes

- **Data quality checker** — inspects committed datasets and surfaces explicit
  warnings (missing values, duplicates, non-numeric mapped columns, ragged rows,
  out-of-order time, etc.). Nothing is silently fixed, deleted, or rewritten.
- **Raw-data visualization** — time-series and distribution plots for mapped
  CSV/JSON with zoom, hover, and filters (series / time range / value column).
  Built with [uPlot](https://github.com/leeoniya/uPlot) (client-side only).
- **Dashboard wiring** — quality + plots live on the open project dashboard for
  committed datasets; import / column-mapping flow is unchanged.

## Earlier phases

- **Phase 1** — project picker, IndexedDB storage, empty analysis shell
- **Phase 2** — FASTA / PDB / mmCIF / CSV / JSON import with explicit column
  mapping for tabular time-series; originals stored unchanged

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
- [uPlot](https://github.com/leeoniya/uPlot) for raw time-series / distribution charts
