# HMM bootstrap uncertainty (Phase 6)

## Method

**Moving-block bootstrap (nonparametric)** on the 1D observation sequence:

1. Let T = sequence length. Block length L defaults to `max(1, ⌊√T⌋)` (override in UI).
2. For each replicate b = 0 … B−1, draw starting indices uniformly in `[0, T−L]` with Mulberry32(`seed + b + 1`), concatenate contiguous blocks of length L, truncate to T.
3. Refit the Phase-4 Gaussian HMM (same K, `maxIter`, `tol`, **same init seed = `seed`**) on the resample.
4. **Label-switching:** permute each fit so emission means are sorted ascending before aggregating. Occupancies (Viterbi fractions) and transition matrix rows/cols follow the same permutation.
5. Report per-parameter **mean ± SD** and **[2.5%, 97.5%]** percentiles across replicates.

This is honest for short-range temporal dependence without assuming the fitted HMM is the true DGP (unlike parametric simulation from the point estimate). It is **statistical** uncertainty on latent-state parameters — not physical conformation confidence intervals.

### Seed scheme

| Role | Value |
|------|--------|
| Resample RNG for replicate `b` | `Mulberry32(seed + b + 1)` |
| HMM initialization on every replicate | `seed` (identical Phase-4 scheme) |

Same settings + observations → bit-identical summaries on a given JS engine (`npm run verify:bootstrap`).

## Fixture

`hmm_two_state.csv` (T=120). Default L = ⌊√120⌋ = **10**.

Suggested UI / CLI settings: `nStates=2`, `nBoot=10` (CLI) or `20` (UI default), `maxIter=100`, `tol=1e-6`, `seed=42`, blank blockLength (auto).

## Expected behavior

| Check | Expectation |
|--------|-------------|
| Reproducibility | Two runs → identical fingerprints |
| Alignment | Point and bootstrap mean for state 0 ≤ state 1 |
| Means | Boot mean ≈ 0 and ≈ 5 (± ~1.5 on this fixture with B=10) |
| Occupancies | Near 0.5 / 0.5 on the balanced fixture |
| Storage | `project.state.hmmBootstraps` only — never mutates `originalText` |

## CLI

```bash
npm run verify:bootstrap
```

Expect `"same": true`, `"meansSorted": true`, `"meansNearFixture": true`, `L: 10`.

## UI (Tester notes)

1. Import `fixtures/hmm_two_state.csv` → map Time=`time`, Value=`value`.
2. Dashboard → **HMM bootstrap uncertainty**.
3. Set nBoot=10–20, nStates=2, seed=42; leave blockLength blank.
4. Run — progress updates while the **Web Worker** loops; UI stays responsive.
5. Confirm tables show means / occupancies / transitions with ± SD and percentile bands.
6. Confirm copy never calls states “open/closed” or other biophysical names.
7. Confirm a saved entry appears under project state history (newest first).
8. (P3) On **2 vs 3 state comparison**, force a tiny `maxIter` (e.g. 1) and confirm a **non-convergence** warning appears and prefer language is marked provisional.

## What this does *not* claim

- Bootstrap intervals are not posterior credible intervals.
- Sorted state indices are not conformation labels.
- MBB with L=⌊√T⌋ is a default heuristic, not an optimal block-length estimator.
