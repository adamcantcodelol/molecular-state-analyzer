# Phase 13 — Experimental design planner (suggestions only)

Helps sketch **conditions × replicates × measurements** as a notebook draft.
Plans are **suggestions / drafts**, not prescriptions. The app never claims
guaranteed statistical power, significance, or mandated sample sizes.

## What it does / does not do

- **Does:** let you describe a goal, choose # conditions / replicates /
  measurement types, generate a structured draft matrix, edit cells /
  condition labels, optionally link existing conditions or **user
  hypotheses**, and save under `project.state.experimentPlans`.
- **Does not:** mutate `originalText`, run power analysis as truth, prescribe
  required sample sizes, guarantee significance, or promote linked hypotheses
  to evidence / scientific conclusions.

## Persistence

| Key | Contents |
|-----|----------|
| `project.state.experimentPlans` | Array of draft plans (`kind: "suggestion_draft"` always) |

Each plan stores: title, goal, condition rows, measurement types, a flattened
matrix (condition × replicate × measurement), optional
`linkedConditionIds` / `linkedHypothesisIds`, notes, and an optional
`sampleSizeHeuristicNote` (rough heuristic text only).

Imported datasets and `originalText` are never rewritten when saving plans.

## Honest labeling

Every plan is stored with `kind: "suggestion_draft"`. The UI shows a
**Suggestion / draft** pill and a disclaimer:

> Suggestion / draft — not a prescription; does not guarantee statistical
> power or significance. Sample-size notes (if shown) are rough heuristics
> only, not power analyses or scientific mandates.

Linking a user hypothesis into a plan does **not** change its
`kind: "user_hypothesis"` or promote it to evidence.

## How to test

1. `npm install && npm run build && npm run dev`
2. Create or open a project. Optionally add a condition (Experimental
   conditions) and a user hypothesis (Ligand / state hypotheses) so optional
   links have targets.
3. Open **Experimental design planner** on the dashboard.
4. Confirm the **Suggestion / draft** pill and warn-box disclaimer are visible.
5. Enter a title/goal (e.g. “Compare two ligands with smFRET vs structure”),
   set conditions = 2, replicates = 3, check measurement types **smFRET** and
   **Structure**, optionally link a condition and a hypothesis.
6. Click **Generate draft suggestion**. Confirm:
   - Structured matrix with 2×3×2 = 12 cells
   - Rough heuristic note labeled as heuristic only (not power analysis)
   - `kind=suggestion_draft` shown in the draft header
7. Edit a condition label and a cell note; **Save draft plan**.
8. Reload / reopen the project — the plan is listed under Saved draft plans
   (IndexedDB). Confirm imported file sizes / `originalText` unchanged.
9. Edit / remove a plan. Soft check: no UI claims “guaranteed significance”,
   “required n”, or that linked hypotheses are proven.

## Build

```bash
npm run build
```

## Limitations

- Drafts are local planning notes, not LIMS / protocol execution.
- Sample-size text is a fixed rough heuristic string derived from
  conditions × replicates — not a statistical power calculation.
- Linked condition / hypothesis ids may become orphaned if those records are
  removed later; the plan keeps the ids until you edit it.
