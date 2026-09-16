# Phase 9 — Experimental conditions & user hypotheses

Arbitrary condition metadata and ligand/state **user hypotheses**, persisted
under `project.state` only.

## What it does / does not do

- **Does:** let you attach structured + free-form condition fields to the
  whole project or a specific dataset; create hypotheses linking ligands /
  conditions / datasets to ideas about states.
- **Does not:** mutate `originalText`, invent experimental facts, or promote
  hypotheses to evidence or scientific conclusions.

## Persistence

| Key | Contents |
|-----|----------|
| `project.state.conditions` | Array of condition records (label, scope, temperature, ligandName, concentration, buffer, notes, `extra[]` key–values) |
| `project.state.hypotheses` | Array of **user hypotheses** (`kind: "user_hypothesis"` always) |

Imported datasets and `originalText` are never rewritten when saving these.

## Honest labeling

Every hypothesis is stored with `kind: "user_hypothesis"` and the UI shows a
**User hypothesis** badge plus a disclaimer: *not evidence, not a scientific
conclusion; never auto-promoted*.

HMM/bootstrap/AIC panels remain separate statistical tools — linking a
hypothesis to a condition or dataset does **not** change fit results.

## How to test

1. `npm install && npm run dev`
2. Create or open a project (optionally import `fixtures/sample.csv` or any
   other fixture so dataset-scoped conditions have a target).
3. Open **Experimental conditions** on the dashboard.
4. Add a project-scoped condition: set temperature / ligand / concentration /
   buffer / notes; add a free-form key (e.g. `salt` → `150 mM NaCl`); **Save
   condition**.
5. Reload the page (or leave and reopen the project) — the condition should
   still be listed (IndexedDB).
6. Edit and remove a condition — confirm `originalText` of imports is
   unchanged (file size / content in Imported datasets unchanged).
7. Open **Ligand / state hypotheses**. Confirm the **User hypothesis** pill
   and warn-box disclaimer are visible.
8. Create a hypothesis with title + idea, optional ligand, link the condition
   and a dataset, save. Card must show **User hypothesis** and
   `kind=user_hypothesis`.
9. Confirm there is **no** UI control that “promotes”, “validates”, or marks a
   hypothesis as proven / evidence.

## Build

```bash
npm run build
```

## Limitations

- Conditions/hypotheses are local notebook metadata, not LIMS or lab book
  sync.
- No automatic binding of conditions to HMM runs (linking is manual via
  hypothesis checkboxes).
- Dataset-scoped conditions reference dataset ids; if you remove a dataset,
  orphaned scope ids may remain until you edit/remove the condition.
