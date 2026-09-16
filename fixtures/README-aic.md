# 2 vs 3 state AIC/BIC comparison (Phase 5)

## Formula

Free parameters for a K-state 1D Gaussian HMM:

`k = K² + 2K - 1` = K means + K variances + K(K−1) free transitions + (K−1) free π

- K=2 → k=7
- K=3 → k=14

Total log-likelihood `L = avgLL × N`. Then:

- `AIC = 2k − 2L`
- `BIC = k·ln(N) − 2L`

Lower is better. Prefer markers in the UI are **not** conformation names.

## Fixture

Use `hmm_two_state.csv` (same as Phase 4). Settings: `maxIter=100`, `tol=1e-6`, `seed=42`.

## CLI

```bash
npm run verify:aic
```

Expect `"same": true`, `k2=7`, `k3=14`, and deterministic AIC/BIC for repeated runs.

## UI

Dashboard → **2 vs 3 state comparison** → Compare K=2 vs K=3 (Web Worker).

Persists under `project.state.hmmComparisons` only — never mutates `originalText`.
