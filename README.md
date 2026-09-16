# Molecular State Analyzer

**v1.0.0** — free, browser-only, protein-agnostic workspace for molecular
analysis projects. All project and import data stays on the user’s device
(IndexedDB). There is no analysis backend.

## Requirements

- Node.js 18+ (recommended: 22+ / current LTS)
- A modern browser with IndexedDB support

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

Production build and local preview:

```bash
npm run build
npm run preview
```

Output lands in **`dist/`** (static assets only).

## Deploy on Cloudflare Pages

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Framework preset | None / Vite (optional) |
| Node.js version | 18+ (22+ recommended) |

Connect the Git repository, set the values above, and deploy. The hosted site
is a static front-end; **project science data never leaves the user’s browser**
(IndexedDB on that origin). Clearing site data or using another device starts
empty — there is no cloud project sync.

Release smoke steps (build, verifies, UI, Pages): see
[`docs/RELEASE.md`](docs/RELEASE.md).

## Integrity notes

This app is built for honest, local-first scientific workflow tooling. Please
read labels in the UI; they are intentional:

- **HMM / smFRET latent states** are statistical fit indices on the observation
  series (or E_FRET), **not** named conformational states or distances.
- **AIC/BIC “prefer”** markers are information-criteria comparisons only. If a
  fit did not converge, prefer is **provisional** and not reliable model-selection
  evidence.
- **User hypotheses** stay labeled as user hypotheses and are **never**
  auto-promoted to evidence or proof.
- **Synthetic** datasets are generated and must remain marked **SYNTHETIC**
  (never presented as experimental).
- **Lab notebook / reports** keep Observations, Inferences, and User hypotheses
  in separate sections; prefer **Archive** over permanent delete.
- **Optional AI** is non-authoritative. With no free local model configured it
  stays unavailable and does **not** fabricate completions or overwrite engine
  outputs / `originalText`.
- **Multimodal links** compare modalities side-by-side; linking is **not** a
  joint scientific claim or fused evidence.
- **Privacy** — no science network APIs; analysis stays on-device. See
  `fixtures/README-security.md` and the in-app Privacy panel.

Regression / QA table (Phase 18): [`fixtures/README-qa.md`](fixtures/README-qa.md).

```bash
npm run verify:qa
```

## What Phase 19 includes (v1.0.0 release)

- **Final release packaging** — `package.json` version **1.0.0**; no new
  product features.
- **README polish** — run locally, Cloudflare Pages (`npm run build` → `dist`),
  integrity notes.
- **`docs/RELEASE.md`** — smoke checklist (build, verify:qa, browser UI,
  Pages deploy, integrity reminders).
- **Git tag** — `v1.0.0` on `main`.

## What Phase 18 includes

- **Scientific QA pass** — regression on HMM / AIC / bootstrap / synthetic /
  notebook / security verifies; integrity copy audit; known-issue list.
- **Integrity fixes** — AIC/BIC done-status marks provisional prefer when a fit
  did not converge; multimodal “modality” wording; hypothesis placeholders
  clearly not proven; dashboard phase blurb includes performance + privacy.
- **`npm run verify:qa`** — chains all six verify scripts.
- **Fixture doc** — `fixtures/README-qa.md` (results table, P2/P3, residual risks).

## What Phase 15 includes

- **Optional AI assistant** — fully optional panel, separate from HMM / stats /
  smFRET engines; labeled non-authoritative.
- **$0 / free-offline** — no paid cloud LLM bundled; generative status is
  **Unavailable — no free local model configured** (no fabricated completions).
- **Safe local helpers only** — copy-only prompt templates for the user to
  paste into their own tools; format/echo of already-persisted notebook text
  (whitespace normalize, epistemic labels) without new scientific claims.
- **Never invents or overwrites** — does not auto-write into analyses or mutate
  `originalText` / engine outputs under `project.state`.
- **Notebook UX (P3)** — prefer **Archive** over permanent delete in copy.
- **Fixture docs** — `fixtures/README-ai.md`.

## What Phase 14 includes

- **Lab notebook** — append-only entries with immutable version history
  (edits append a new version; prior text is never silently rewritten).
- **Epistemic kinds** — Observation / Inference / Note; exports keep
  Observations, Inferences, and User hypotheses in separate sections.
- **Project versioning** — timestamped snapshots of dataset metadata +
  `project.state` summary counts (never copies `originalText`).
- **Research report export** — Markdown and JSON downloads with clear
  Observations / Inferences / User hypotheses sections (never conflated).
- **Persistence** — `project.state.notebookEntries`,
  `project.state.projectVersions`; `originalText` never mutated.
- **Fixture docs** — `fixtures/README-notebook.md`.

## What Phase 13 includes

- **Experimental design planner** — UI to describe a goal, pick # conditions /
  replicates / measurement types, and generate a structured draft matrix
  (conditions × replicates × measurements).
- **Suggestions only** — every plan is `kind: "suggestion_draft"` and labeled
  **Suggestion / draft — not a prescription; does not guarantee statistical
  power or significance**. Sample-size notes are rough heuristics only.
- **Persistence** — `project.state.experimentPlans`; edit/save/remove; optional
  links to existing conditions / user hypotheses (never promotes hypotheses
  to evidence). `originalText` never mutated.
- **Fixture docs** — `fixtures/README-planner.md`.

## What Phase 12 includes

- **Statistics dashboard** — read-only summary of persisted runs:
  `hmmRuns`, `hmmComparisons` (AIC/BIC), `hmmBootstraps`, `smfretHmmRuns`.
- **Provenance** — dataset name, settings (seed, K, …), timestamps, source
  module, and `project.state` key per row.
- **Honest metrics** — LL, AIC/BIC prefer, bootstrap mean±SD snippets, E_FRET
  HMM means shown as statistical fit outputs (not biophysical truth).
- **Empty state** when no runs; never mutates originals.
- **Fixture docs** — `fixtures/README-stats.md`.

## What Phase 11 includes

- **Multimodal links** — bundle datasets (structure + time-series/smFRET, …)
  and optionally conditions / user hypotheses for comparison.
- **Side-by-side or tabbed comparison** — each pane keeps a distinct modality
  label; linking ≠ joint inference; no forced single-narrative merge.
- **Persistence** — `project.state.multimodalLinks` only; `originalText` never
  mutated. User hypotheses stay labeled as user hypotheses.
- **Fixture docs** — `fixtures/README-multimodal.md`.

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
