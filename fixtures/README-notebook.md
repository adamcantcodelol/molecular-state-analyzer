# Phase 14 — Lab notebook, research reports, and project versioning

Append-only lab notes, timestamped project snapshots, and research report
export that **never conflates** Observations, Inferences, and User hypotheses.

## What it does / does not do

- **Does:** let you write notebook entries classified as Observation,
  Inference, or Note; editing **appends a new immutable version** (history
  kept); capture project version snapshots (dataset metadata +
  `project.state` summary counts); export Markdown and JSON reports with
  separate sections for Observations / Inferences / User hypotheses.
- **Does not:** mutate `originalText`, silently edit past note versions
  in place, merge user hypotheses into Observations or Inferences, or
  promote hypotheses to evidence / scientific conclusions.

## Persistence

| Key | Contents |
|-----|----------|
| `project.state.notebookEntries` | Append-only entries; each has `versions[]` |
| `project.state.projectVersions` | Immutable metadata snapshots |

Each notebook entry stores: id, createdAt/updatedAt, `versions` (each with
version number, timestamp, title, body, `epistemicKind`), optional links to
datasets / conditions / user hypotheses, and optional `archived`.

Each project version stores: label, notes, timestamps, `datasetMeta`
(id, fileName, format, byteLength, … — **never** `originalText`), and a
`stateSummary` / `stateFingerprint`.

Imported datasets and `originalText` are never rewritten when saving notes
or snapshots.

## Epistemic honesty

| Section | Source |
|---------|--------|
| **Observations** | Notebook entries whose *current* version has `epistemicKind: "observation"` |
| **Inferences** | Notebook entries with `epistemicKind: "inference"` |
| **User hypotheses** | `project.state.hypotheses` (`kind: "user_hypothesis"`) only |
| Other notes | `epistemicKind: "note"` — exported separately, not merged into the three |

Exports include a disclaimer that user hypotheses are not evidence.

## How to test

1. `npm install && npm run build && npm run dev`
2. Create or open a project. Optionally add a condition, a user hypothesis,
   and import a small CSV so links have targets.
3. Open **Lab notebook & reports** on the dashboard.
4. Confirm the **Append-only** pill and warn-box disclaimer are visible.
5. Add an entry classified as **Observation** (title + body). Save.
6. Click **Edit (new version)**, change the body, choose **Inference**, click
   **Append version**. Open **History** — version 1 (observation) and
   version 2 (inference) both present; prior text unchanged.
7. **Capture version snapshot** with a label. Confirm it lists dataset
   counts / state summary (no originalText).
8. **Download Markdown** and **Download JSON**. Confirm sections:
   - `## Observations` / `sections.observations`
   - `## Inferences` / `sections.inferences`
   - `## User hypotheses` / `sections.userHypotheses` with
     `kind: "user_hypothesis"`
   - Sections are not merged; disclaimer present.
9. Reload the project — notes and versions still in IndexedDB.
   Confirm imported file sizes / `originalText` unchanged.

## Build

```bash
npm run build
```

## Limitations

- Soft **Archive** hides entries but keeps history; **Remove** deletes the
  entry from `project.state` (prefer archive for immutability).
- Project versions are metadata summaries, not full deep clones of every
  HMM payload.
- Linked hypothesis / condition / dataset ids may become orphaned if those
  records are removed later; the notebook keeps the ids until you edit.
