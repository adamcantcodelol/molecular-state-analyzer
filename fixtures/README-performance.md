# Performance (Phase 16)

## Architecture
- **CPU science:** Gaussian HMM fit, 2-vs-3 AIC/BIC compare, and moving-block bootstrap run in **Web Workers** (`src/hmm/hmmWorker.ts`).
- **GPU:** Mol* WebGL is **display-only**. Analysis never requires a GPU.

## Limits (see `src/perf/limits.ts`)
| Guard | Value | Behavior |
|-------|-------|----------|
| Soft warn observations | 20,000 | Warning; work continues in Worker |
| Fit max observations | 100,000 | Fit/bootstrap/compare blocked with clear error |
| Plot max points | 5,000 | Stride downsample for **display only** (labeled); stored data unchanged |
| File size soft warn | 8 MiB | Import warning (existing) |
| Bootstrap work warn | obs×B ≥ 2e6 | Warning about long Worker run |

## Tester checks
1. Confirm HMM / compare / bootstrap UI still says Worker / CPU.
2. Import a normal fixture — no false limit errors.
3. Open **Performance notes** panel — limits match this table.
4. Confirm README states GPU is not required for science.
