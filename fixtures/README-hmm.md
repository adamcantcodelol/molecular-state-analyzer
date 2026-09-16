# Gaussian HMM fixture (Phase 4)

## File

- `hmm_two_state.csv` — 120 rows, columns `time,value,series,true_state`
- Synthetic sticky two-state series: state 0 ≈ N(0, ·), state 1 ≈ N(5, ·)
- Map: `time` → Time, `value` → Value, `series` → Series (optional), ignore `true_state` for training

`true_state` is **only** for Tester comparison — the app does not use it as a label.

## How to exercise in the UI

1. Create/open a project → import `fixtures/hmm_two_state.csv`
2. Column mapping: Time=`time`, Value=`value`, Series=`series` (or leave series unmapped)
3. Open **Gaussian HMM** on the dashboard
4. Settings: `nStates=2`, `maxIter=100`, `tol=1e-6`, `seed=42`
5. Run — compute runs in a **Web Worker**

## Expected behavior (seed=42, settings above)

Same engine as `scripts/verify-hmm.mts` / `npm run verify:hmm`:

| Field | Expected (approx.) |
|--------|---------------------|
| Converged | yes (typically ≤ 10 EM iters; reference run: **4**) |
| Means μ | ≈ **`[0.0025, 4.9975]`** (order is state index, not “low/high” label) |
| State counts (Viterbi) | **`[60, 60]`** |
| Avg log-likelihood / obs | ≈ **`0.1984432044`** |
| Re-run identical seed+settings | **bit-identical** means, variances, path, LL on the same JS engine |

Honest interpretation:

- Latent states are **unsupervised** Gaussian HMM states, not biophysical conformation names.
- State index 0 vs 1 is arbitrary (init can swap labels on other seeds/data); compare **means**, not names.
- On this well-separated fixture, seed 42 vs 99 may still land on the same partition.

## Reproducibility check (CLI)

From repo root (devDependency-free; uses ephemeral esbuild):

```bash
npm run verify:hmm
```

Expect `"same": true` and `path_equal_same_seed true`.

## Storage rule

HMM outputs persist under `project.state.hmmRuns` only. Imported `originalText` must never be rewritten by an HMM run.
