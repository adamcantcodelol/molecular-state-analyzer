# Phase 10 — smFRET E_FRET plot & optional HMM

Plot mapped Value as **E_FRET** (FRET efficiency) vs time, with an optional
Gaussian HMM on those observations. Latent states stay **statistical** —
never structural conformations or distances.

## Fixture

- `smfret_efret.csv` — 140 rows, columns `time,E_FRET,series`
- Two synthetic traces (`trace1` 100 pts, `trace2` 40 pts)
- Sticky two-level efficiencies ≈ 0.22 and ≈ 0.78 (typical low/high E_FRET)
- Map: `time` → Time, `E_FRET` → Value, `series` → Series (optional)

This file is a **synthetic demo** for UI/testing — not experimental smFRET
data from a lab instrument.

## What it does / does not do

- **Does:** plot E_FRET vs time via `TimeSeriesChart`; optionally run the
  existing Gaussian HMM Web Worker on E_FRET observations; persist under
  `project.state.smfretHmmRuns` with `source: "smfret"` and
  `observationKind: "E_FRET"`.
- **Does not:** mutate `originalText`; invent distances or conformations;
  rename HMM states as biophysical labels; claim E_FRET equals structure.

## Persistence

| Key | Contents |
|-----|----------|
| `project.state.smfretHmmRuns` | Array of smFRET HMM runs (`source=smfret`, `observationKind=E_FRET`) |

Generic `project.state.hmmRuns` (Phase 4) is unchanged. smFRET runs are stored
separately so Testers can tell statistical E_FRET fits apart from generic
value-column HMM runs.

## Honest labeling

UI disclaimer on the panel: latent states are unsupervised statistical
indices on **E_FRET only** — not structural conformations, distances, or
biophysical names. Emission means are reported in E_FRET units.

## How to test

1. `npm install && npm run build` (must pass)
2. `npm run dev`
3. Create/open a project → import `fixtures/smfret_efret.csv`
4. Column mapping: Time=`time`, Value=`E_FRET`, Series=`series`
5. Open **smFRET (E_FRET)** on the dashboard
6. Confirm disclaimer warn-box is visible
7. Confirm **E_FRET vs time** chart shows the efficiency trace(s)
8. Optionally filter series to `trace1`
9. Settings: `nStates=2`, `maxIter=100`, `tol=1e-6`, `seed=42` → **Run HMM on E_FRET**
10. Confirm result copy says statistical / E_FRET only (not conformation/distance)
11. Reload project — run should appear under saved `smfretHmmRuns`
12. Confirm Imported datasets / `originalText` size unchanged after the HMM run

## Build

```bash
npm run build
```

## Limitations

- Treats the mapped Value column as E_FRET by convention in this panel; it
  does not validate that values lie in [0, 1].
- No Förster-radius / distance conversion (intentionally omitted — that would
  blur the statistical vs structural distinction).
- Optional HMM is the same 1D Gaussian engine as Phase 4; it does not model
  donor/acceptor photophysics beyond the efficiency time series.
