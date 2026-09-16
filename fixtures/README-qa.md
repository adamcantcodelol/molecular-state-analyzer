# Phase 18 — Scientific QA pass (integrity + regression)

Release-oriented QA for Molecular State Analyzer after Phase 17 (`bccce8b`).
This document records verify outcomes, integrity copy audit findings, known
issues (P2/P3), and residual risks for the Tester.

## Verify results (2026-09-16, America/New_York)

| Check | Command | Outcome | Notes |
|-------|---------|---------|-------|
| Production build | `npm run build` | **PASS** | `tsc -b && vite build` OK. Vite warns on large Mol* chunk (>3500 kB) and Node externalization inside `h264-mp4-encoder` (display-only dependency path). |
| HMM regression | `npm run verify:hmm` | **PASS** | Fixture seed=42 bit-stable; `same: true`; same-seed path equal. |
| AIC/BIC regression | `npm run verify:aic` | **PASS** | Prefer AIC/BIC → K=2 on two-state fixture; K=3 may hit maxIter (expected on this series). |
| Bootstrap regression | `npm run verify:bootstrap` | **PASS** | Moving-block; means sorted / near fixture; `same: true`. |
| Synthetic generator | `npm run verify:synthetic` | **PASS** | Deterministic CSV/JSON/path; `markedSynthetic: true`. |
| Notebook / reports | `npm run verify:notebook` | **PASS** | Versioning + report sections smoke OK. |
| Security strip | `npm run verify:security` | **PASS** | `stripSensitiveKeys` drops secret-like keys. |
| Chained QA | `npm run verify:qa` | **PASS** (script added Phase 18) | Runs the six verifies above in order. |

Skipped: none — all listed verify scripts exist.

## Integrity copy audit

Grep / panel review for overclaims (conformation names as fact, guaranteed
significance, AI as evidence, promoting hypotheses, etc.).

### Fixed in Phase 18 (P1 / integrity)

1. **ModelComparePanel status line** — After a compare finishes, the progress
   string now labels prefer markers as **information-criteria only** (not
   conformation names). If any K fit is non-converged, the status explicitly
   says **provisional** and that prefer is **not reliable model-selection
   evidence** (matches the in-panel warn box).
2. **MultimodalPaneBody** — “linked evidence type” → “linked modality type
   (not a joint scientific claim)” so linking is not read as fused evidence.
3. **HypothesesPanel title placeholder** — Softened so the example is clearly
   a **hypothesis / not proven**, not a conformation fact.
4. **DashboardShell project blurb** — Phase range updated to **4–18**; mentions
   performance notes, privacy/local-first, and that Phase 18 is QA/integrity.

### Audit findings — no further P0/P1

| Area | Status |
|------|--------|
| HMM / bootstrap / smFRET latent-state copy | Explicit “statistical indices / not conformations / not distances” |
| AIC/BIC prefer markers | Labeled information-criteria; provisional on non-convergence |
| Planner | Suggestion/draft; no guaranteed power/significance |
| Hypotheses / conditions | `user_hypothesis`; never auto-promoted |
| Notebook / export | Observations / Inferences / hypotheses kept distinct; prefer Archive |
| Optional AI | Stub unavailable; non-authoritative; no fabricated completions |
| Synthetic | SYNTHETIC labeling required |
| Privacy | Local-first IndexedDB; no science network APIs |

## Known issues (P2 / P3) — not blocking release

| ID | Severity | Issue | Mitigation / note |
|----|----------|-------|-------------------|
| QA-P2-1 | P2 | Production bundle includes large Mol* chunk (~4.8 MB JS) | Documented Vite warning; science does not require GPU; consider future code-split. |
| QA-P2-2 | P2 | `molstar` declares Node `>=22`; CI/box may run Node 20 | Builds succeed on Node 20; engine warning only. Prefer Node 22+ when available. |
| QA-P2-3 | P2 | Stats dashboard does not export CSV of summarized runs | Documented in `README-stats.md`; read-only UI is intentional for Phase 12. |
| QA-P2-4 | P2 | Orphaned `datasetId`s still show stored file names in stats / multimodal | Provenance-preserving; user can remove stale runs manually. |
| QA-P3-1 | P3 | Notebook permanent delete still available (Archive preferred) | Copy and confirm dialog steer users to Archive (Phase 14 P3). |
| QA-P3-2 | P3 | Bootstrap UI shows mean±SD / percentile snippets, not full transition heatmaps | Sufficient for uncertainty summary; full tables remain in persisted state. |
| QA-P3-3 | P3 | No automated browser E2E; verifies are Node/engine smokes | Tester still exercises UI panels per per-feature fixture READMEs. |

## Residual risks

1. **Label switching** — Unsupervised HMM state indices can swap across seeds
   or initializations; UI warns to compare means, not names. Misreading indices
   as biophysical labels remains a user-interpretation risk.
2. **AIC/BIC ≠ truth** — Prefer-K is an information-criterion pick. On poorly
   separated or short series, K=3 may fail to converge; provisional language
   must be heeded.
3. **Bootstrap coverage** — Percentile intervals assume the moving-block /
   refit model; they are not physical conformation confidence and can be
   miscalibrated for short T or bad L.
4. **smFRET** — Optional HMM is on **E_FRET only**; distances / structural
   names are never computed. Users might still over-interpret high/low E_FRET.
5. **AI / external tools** — Prompt templates are copy-only. If users paste
   invented external-LLM output into notebook Inferences, the app cannot stop
   them; disclaimers and epistemic kinds are the control.
6. **Local-only storage** — Clearing site data destroys projects; no cloud
   backup by design (Phase 17).
7. **WebGL / Mol*** — Display-only; Reduced/Summary modes exist, but exotic
   GPUs may still fail — panel falls back to Summary.

## Tester checklist (release)

1. `npm install && npm run build && npm run verify:qa`
2. Spot-check UI copy on HMM, Model comparison (force tiny maxIter → provisional
   status), Bootstrap, smFRET, Planner, Hypotheses, Optional AI, Privacy,
   Performance notes.
3. Confirm no panel presents conformation names, guaranteed significance, or
   AI output as scientific evidence.
4. Export a research report; confirm hypotheses stay labeled and `originalText`
   payloads are absent.
5. Re-read this file for residual risks before sign-off.

## Related fixture docs

- `README-hmm.md`, `README-aic.md`, `README-bootstrap.md`, `README-synthetic.md`
- `README-smfret.md`, `README-stats.md`, `README-planner.md`, `README-notebook.md`
- `README-ai.md`, `README-performance.md`, `README-security.md`
