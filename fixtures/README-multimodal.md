# Phase 11 — Multimodal dataset linking & comparison

Link compatible datasets (and optionally conditions / user hypotheses) into a
**multimodal bundle** for side-by-side or tabbed comparison. Modalities stay
distinct — linking is **not** joint inference and does **not** invent a single
scientific narrative.

## Suggested fixtures to combine

| Fixture | Typical modality |
|---------|------------------|
| `sample.pdb` / `sample.cif` | Structure (PDB/mmCIF) |
| `sample.csv` / `messy_timeseries.csv` | Time-series (after Time+Value mapping) |
| `smfret_efret.csv` | Time-series / smFRET E_FRET (map Time+Value) |
| `sample.fasta` | Sequence |
| Conditions from Phase 9 UI | Experimental conditions |
| Hypotheses from Phase 9 UI | **User hypothesis** (never evidence) |

Import at least one structure file and one mapped CSV, then open **Multimodal
links** on the dashboard.

## What it does / does not do

- **Does:** let you pick datasets (+ optional conditions / hypotheses) into a
  labeled bundle; compare members **side-by-side** or via **tabs**, each pane
  showing its modality pill (Structure, Time-series, Conditions, User
  hypothesis, …).
- **Does not:** mutate `originalText`; fuse modalities into one story; run
  joint statistical inference across linked files; promote linked hypotheses
  to evidence or conclusions.

## Persistence

| Key | Contents |
|-----|----------|
| `project.state.multimodalLinks` | Array of bundles (`label`, `notes`, `members[]`) |

Each member is one of:

- `{ kind: "dataset", datasetId, modality }`
- `{ kind: "condition", conditionId, modality: "conditions" }`
- `{ kind: "hypothesis", hypothesisId, modality: "user_hypothesis" }`

Imported datasets and `originalText` are never rewritten when saving links.

## Honest labeling

UI disclaimer: *Linking ≠ joint inference; modalities stay separate; user
hypotheses remain user hypotheses.* Comparison panes keep modality labels
visible at all times — there is no “merged narrative” view.

## How to test

1. `npm install && npm run build && npm run dev`
2. Create/open a project; import `fixtures/sample.pdb` and
   `fixtures/smfret_efret.csv` (map `time`→Time, `E_FRET`→Value,
   `series`→Series). Optionally add a Phase 9 condition and a user hypothesis.
3. Open **Multimodal links**. Confirm the warn-box disclaimer.
4. Check both datasets (and optional condition/hypothesis); set a label; **Save
   multimodal link**.
5. Click **Compare** — toggle **Side-by-side** and **Tabs**. Each pane must
   show a distinct modality pill (e.g. Structure vs Time-series). Hypotheses
   must show the **User hypothesis** pill.
6. Reload / reopen the project — the link remains (IndexedDB
   `project.state.multimodalLinks`). Confirm imported file sizes / originalText
   notes are unchanged.
7. Edit and remove a link — originals stay intact.

## Build

```bash
npm run build
```

## Limitations

- Comparison panes summarize linked members; detailed analysis still lives in
  modality-specific panels (Mol* viewer, Raw explorer, smFRET, HMM, …).
- No automatic cross-modality alignment, registration, or joint HMM.
- Orphaned dataset/condition/hypothesis ids may remain if you remove the
  underlying record until you edit/remove the link.
