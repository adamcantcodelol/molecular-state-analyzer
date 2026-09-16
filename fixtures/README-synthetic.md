# Synthetic Gaussian HMM generator (Phase 7)

## Purpose

In-app **SYNTHETIC** 1D Gaussian-HMM series with known ground-truth
`true_state`, for testing HMM / AIC / bootstrap pipelines. Outputs must always
be labeled **SYNTHETIC** in the UI and must never be presented as experimental
or laboratory data.

## Method

1. **RNG:** Mulberry32(`seed`) — same seed → identical sequence on IEEE-754 JS engines.
2. **Start state:** uniform draw over `{0 … K−1}`.
3. **Emission:** `y_t = μ_s + σ_s · Z` where `Z ~ N(0,1)` via **Box–Muller** (two RNG draws).
4. **Transition (sticky):** with probability `stayProb` remain in `s`; otherwise choose uniformly among the other `K−1` states (residual of the stay draw).
5. Emit CSV columns `time,value,series,true_state` and JSON marked `"synthetic": true`.

### Default params

| Field | Default |
|-------|---------|
| seed | 42 |
| length | 120 |
| nStates (K) | 2 |
| means | `[0, 5]` |
| variances | `[0.25, 0.25]` |
| stayProb | 0.9 |

## Expected behavior

| Check | Expectation |
|--------|-------------|
| Reproducibility | Same seed + params → bit-identical CSV, JSON, path, values |
| Different seed | Different path and/or values |
| Stickiness | Consecutive stay fraction ≳ 0.7 at stayProb=0.9 |
| Emissions | Per-state sample means near ground-truth μ (± ~1.5 on defaults) |
| Labeling | JSON has `synthetic: true` + SYNTHETIC warning; CSV has `true_state` |
| UI | DatasetList shows **SYNTHETIC** badge; warnings note ground-truth |

## CLI

```bash
npm run verify:synthetic
```

Expect `"ok": true` and `verify:synthetic PASSED`.

## UI (Tester notes)

1. Open a project → **Synthetic HMM generator**.
2. Leave defaults (seed=42, length=120, K=2, means `0, 5`, variances `0.25, 0.25`, stayProb=0.9).
3. **Generate preview** — confirm table shows time / value / true_state.
4. Generate again with the same params — preview values must match exactly.
5. Change seed to 99 — preview must change.
6. **Download CSV / JSON** — filenames like `synthetic_hmm_seed42.csv`; JSON must say synthetic.
7. **Add to project as SYNTHETIC** — dataset appears with SYNTHETIC badge; column mapping time/value/series + true_state as label; warnings mention SYNTHETIC ground-truth.
8. Confirm HMM / explore panels still work on the synthetic dataset (value column only; do not treat true_state as experimental).

## What this does *not* claim

- Synthetic series are not real trajectories or experimental measurements.
- Ground-truth `true_state` is for verification only, not a biophysical label.
