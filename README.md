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

## What Phase 4 includes

- **Gaussian HMM engine** — real 1D Gaussian-emission HMM in TypeScript:
  Baum–Welch (EM) training + Viterbi decoding (Rabiner scaled forward–backward).
- **Web Worker** — heavy compute runs off the main thread; the UI posts settings /
  observations and displays results.
- **Reproducibility** — Mulberry32-seeded initialization; same seed + settings +
  observations → same model / path on a given JS engine.
- **Dashboard wiring** — pick a committed time-series value column, configure
  `nStates` / `maxIter` / `tol` / `seed`, run, inspect means / variances /
  transition matrix / Viterbi path. Labels are honest (latent states, not
  invented biophysics).
- **Persistence** — runs saved under `project.state.hmmRuns` only; imported
  `originalText` is never mutated.
- **Fixture** — see `fixtures/hmm_two_state.csv` and `fixtures/README-hmm.md`.

```bash
npm run verify:hmm
```

## Earlier phases

- **Phase 3** — data quality checker + raw uPlot time-series / distribution views
- **Phase 2** — FASTA / PDB / mmCIF / CSV / JSON import with explicit column
  mapping for tabular time-series; originals stored unchanged
- **Phase 1** — project picker, IndexedDB storage, empty analysis shell

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
- Custom Gaussian HMM (Baum–Welch + Viterbi) in a Vite Web Worker
