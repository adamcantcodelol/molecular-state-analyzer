# Phase 12 — Statistics dashboard (run provenance)

Read-only panel that **summarizes existing persisted runs** from
`project.state` with clear provenance. It does **not** re-run analyses, mutate
`originalText`, or claim biophysical truth.

## What it summarizes

| `project.state` key | Source module pill | Typical metrics shown |
|-------------------|--------------------|------------------------|
| `hmmRuns` | HMM | avg LL, means, iters / convergence, n |
| `hmmComparisons` | AIC/BIC | prefer AIC→K / BIC→K (provisional if non-converged) |
| `hmmBootstraps` | Bootstrap | means mean±SD snippets, B, L, conv count |
| `smfretHmmRuns` | smFRET HMM | E_FRET HMM means, avg LL (statistical on E_FRET only) |

Each row shows: **dataset name**, **settings** (seed, K, …), **timestamp**,
**source module**, and a **provenance** line naming the state key / value
column / series filter.

## What it does / does not do

- **Does:** list and filter saved runs; show key numeric fit outputs; empty
  state when nothing is persisted; stay read-only.
- **Does not:** invent new runs; rewrite datasets; promote AIC/BIC “prefer”
  or bootstrap intervals to conformation names / mechanisms; treat E_FRET
  HMM means as structural distances.

## Honest labeling

UI disclaimer: metrics are **statistical fit outputs** — not biophysical
truth. AIC/BIC prefer markers remain information-criteria picks (and
provisional when a fit hit maxIter). smFRET means stay labeled as E_FRET
HMM statistics.

## How to test

1. `npm install && npm run build && npm run dev`
2. Create/open a project with no HMM / compare / bootstrap / smFRET runs.
3. Open **Statistics dashboard** near the top of the analysis panels.
   Confirm the empty state and the warn-box disclaimer.
4. Import `fixtures/hmm_two_state.csv` (map time→Time, value→Value) and run:
   - **Gaussian HMM** (save a run)
   - **Model comparison** (AIC/BIC)
   - **Bootstrap** (small B for speed)
5. Optionally import `fixtures/smfret_efret.csv` and run **smFRET** optional HMM.
6. Return to **Statistics dashboard**:
   - Counts for HMM / AIC/BIC / Bootstrap / smFRET HMM update.
   - Each card shows dataset name, settings (seed, K, …), timestamp, metrics,
     and provenance (`project.state.…`).
   - Filters (All / HMM / AIC/BIC / Bootstrap / smFRET HMM) work.
7. Reload / reopen the project — the same summary appears (IndexedDB). Confirm
   file sizes / `originalText` notes are unchanged (panel is read-only).
8. Soft check: wording never claims “true states”, conformational labels, or
   that prefer-K is biophysical truth.

## Build

```bash
npm run build
```

## Limitations

- Summaries are derived from whatever is already in `project.state`; orphaned
  `datasetId`s (removed datasets) still show the stored `datasetFileName`.
- Bootstrap cards show mean±SD snippets for emission means only (not full
  transition tables).
- No export / CSV download in this phase.
