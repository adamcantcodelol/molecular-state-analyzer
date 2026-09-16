# Release v1.0.0 — smoke checklist

Final release packaging for **Molecular State Analyzer** (Phase 19).
No new product features in this phase — documentation, version bump, and
deploy notes only. Accepted baseline: `f669cda` (Phase 18 integrity fix).

## Pre-push / CI smoke

Run from the repo root on Node 18+ (22+ preferred; see QA-P2-2).

| Step | Command / action | Expected |
|------|------------------|----------|
| 1. Install | `npm install` | Completes without fatal errors |
| 2. Production build | `npm run build` | `tsc -b && vite build` exits 0; assets under `dist/` |
| 3. Engine QA chain | `npm run verify:qa` | All six verifies PASS (HMM, AIC, bootstrap, synthetic, notebook, security) |
| 4. Lint (optional) | `npm run lint` | No unexpected regressions |
| 5. Preview | `npm run preview` then open printed URL | App shell loads; project picker visible |

## Browser UI smoke (manual)

Use a modern Chromium/Firefox/Safari with IndexedDB. Prefer a clean profile
or clear site data so persistence behavior is obvious.

| # | Check | Pass criteria |
|---|-------|---------------|
| U1 | Create / open a project | Project appears in picker; data stays after reload |
| U2 | Import fixture CSV (`fixtures/sample.csv` or `hmm_two_state.csv`) | Mapping UI; commit stores `originalText` unchanged |
| U3 | Time-series / quality views | Charts render; quality checker runs without mutating import |
| U4 | Gaussian HMM fit (seeded) | Worker completes; run under `project.state.hmmRuns`; states labeled statistical |
| U5 | AIC/BIC compare K=2 vs K=3 | Prefer markers are information-criteria only; non-converge → provisional |
| U6 | Bootstrap (small N) | Summaries mean±SD / percentiles; `originalText` untouched |
| U7 | Synthetic generator | Download + add to project shows **SYNTHETIC** badge |
| U8 | Structure viewer (`sample.pdb` / `sample.cif`) | Mol* or honest WebGL fallback; display-only |
| U9 | smFRET panel (`smfret_efret.csv`) | E_FRET plot; optional HMM on E_FRET only |
| U10 | Conditions / user hypotheses | Hypotheses labeled **User hypothesis** (not evidence) |
| U11 | Multimodal link | Side-by-side modalities; no fused-evidence claim |
| U12 | Stats dashboard | Read-only provenance rows for persisted runs |
| U13 | Experiment planner | Draft marked suggestion only |
| U14 | Lab notebook + report export | Version history; Observations / Inferences / hypotheses separated |
| U15 | Optional AI panel | Unavailable / non-authoritative stub; no fabricated science |
| U16 | Privacy / local-first | No science backend calls; IndexedDB-only project data |

## Cloudflare Pages deploy smoke

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 18+ (22+ recommended) |

After deploy:

1. Open the Pages URL over HTTPS.
2. Create a throwaway project, import a small fixture, reload — data still local to the browser (not on Cloudflare).
3. Confirm static assets (JS/CSS) load; large Mol* chunk is expected (QA-P2-1).

## Integrity reminders (do not regress)

- Latent HMM / smFRET states = **statistical indices**, not conformations or distances.
- AIC/BIC prefer = information criteria only; provisional if a fit did not converge.
- User hypotheses never auto-promoted to evidence.
- Synthetic datasets must stay labeled **SYNTHETIC**.
- Notebook exports keep Observations, Inferences, and User hypotheses distinct.
- Optional AI never invents results or overwrites `originalText` / engine outputs.
- All project science data remains **local-first** (IndexedDB); no analysis backend.

## Tag / version

- `package.json` version: **1.0.0**
- Git tag: **v1.0.0** on `main` after the Phase 19 commit
- Detail QA table: `fixtures/README-qa.md` (Phase 18)
- Security / privacy notes: `fixtures/README-security.md`

## Sign-off

| Role | Check | Date |
|------|-------|------|
| Builder | Build + verify:qa + this checklist reviewed | |
| Tester | Browser UI smoke U1–U16 (or subset agreed) | |
