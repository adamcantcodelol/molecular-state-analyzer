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

## What Phase 10 includes

- **smFRET panel** — committed CSV/JSON with Time+Value mapping; Value treated
  as **E_FRET** and plotted vs time (`TimeSeriesChart`).
- **Optional HMM on E_FRET** — same Gaussian HMM Web Worker; latent states
  labeled as **statistical** indices on E_FRET only (never structural
  conformations / distances).
- **Persistence** — `project.state.smfretHmmRuns` with `source: "smfret"` and
  `observationKind: "E_FRET"`; `originalText` never mutated.
- **Fixture docs** — `fixtures/smfret_efret.csv`, `fixtures/README-smfret.md`.

## What Phase 9 includes

- **Experimental conditions** — attach temperature, ligand, concentration,
  buffer, notes, plus free-form key–value metadata to the project and/or a
  dataset; stored under `project.state.conditions`.
- **User hypotheses** — ligand/condition ↔ state ideas clearly labeled
  **User hypothesis** (not evidence / not proven); `kind: "user_hypothesis"`;
  never auto-promoted. Stored under `project.state.hypotheses`.
- **Honesty** — UI disclaimer on every hypothesis panel/card; `originalText`
  never mutated.
- **Fixture docs** — `fixtures/README-conditions.md`.

## What Phase 8 includes

- **3D structure viewer (Mol\*)** — display-only PDB/mmCIF panel; loads a copy
  of `originalText` into Mol*; Full / Reduced (CPU-safe) / Summary modes.
- **WebGL fallback** — if WebGL or Mol* init fails, honest summary UI (no fake 3D).
- **Fixture docs** — `fixtures/README-viewer.md` with `sample.pdb` / `sample.cif`.

## What Phase 7 includes

- **Seeded synthetic HMM generator** — Mulberry32 + Box–Muller Gaussian HMM
  path/emissions with sticky `stayProb`; CSV/JSON include `true_state`.
- **UI** — Synthetic generator panel (seed, length, K, means, variances,
  stayProb); preview; download; add to project as **SYNTHETIC** (never
  experimental).
- **Badge** — DatasetList shows a clear SYNTHETIC pill when `ds.synthetic`.
- **Fixture / verify** — `fixtures/README-synthetic.md`, `npm run verify:synthetic`.

```bash
npm run verify:synthetic
```

## What Phase 6 includes

- **Moving-block bootstrap** — nonparametric resampling of the 1D observation
  sequence (default block length ⌊√T⌋); refit Gaussian HMM on each replicate.
- **Uncertainty summaries** — mean ± SD and percentile intervals for emission
  means, Viterbi occupancy fractions, and transition probabilities.
- **Label-switching** — states aligned by sorting means ascending before
  aggregating across bootstraps.
- **Web Worker** — bootstrap loop stays off the main thread.
- **Persistence** — `project.state.hmmBootstraps` only; `originalText` untouched.
- **Fixture / verify** — `fixtures/README-bootstrap.md`, `npm run verify:bootstrap`.

```bash
npm run verify:bootstrap
```

## Phase 5 (model comparison)

- K=2 vs K=3 AIC/BIC on the same seed/settings; UI warns when a fit hits maxIter
  so IC “prefer” is not over-read. See `fixtures/README-aic.md`.

```bash
npm run verify:aic
```

## Phase 4 (Gaussian HMM)

- Baum–Welch + Viterbi in a Web Worker; Mulberry32-seeded init.
- Persists under `project.state.hmmRuns`. See `fixtures/README-hmm.md`.

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
- [Mol*](https://molstar.org/) for display-only PDB/mmCIF 3D viewing
- Custom Gaussian HMM (Baum–Welch + Viterbi) + moving-block bootstrap in a Vite Web Worker
