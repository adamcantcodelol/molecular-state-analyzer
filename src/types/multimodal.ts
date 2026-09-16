/**
 * Phase 11 — multimodal dataset linking and comparison.
 * Bundles group compatible evidence sources without forcing a joint narrative.
 * Stored under project.state.multimodalLinks only; never mutates originalText.
 */

/** Distinct evidence modality — kept separate in UI; never fused into one story. */
export type ModalityKind =
  | 'structure'
  | 'sequence'
  | 'time_series'
  | 'tabular'
  | 'conditions'
  | 'user_hypothesis'
  | 'other'

export const MODALITY_LABELS: Record<ModalityKind, string> = {
  structure: 'Structure (PDB/mmCIF)',
  sequence: 'Sequence (FASTA)',
  time_series: 'Time-series / tabular mapped',
  tabular: 'Tabular (unmapped)',
  conditions: 'Experimental conditions',
  user_hypothesis: 'User hypothesis',
  other: 'Other',
}

/**
 * One member of a multimodal bundle: a dataset, condition, or (separately
 * labeled) user hypothesis. Modality is recorded at link time for display.
 */
export type MultimodalMember =
  | {
      kind: 'dataset'
      datasetId: string
      /** Snapshot of inferred modality for honest labeling in the bundle. */
      modality: ModalityKind
    }
  | {
      kind: 'condition'
      conditionId: string
      modality: 'conditions'
    }
  | {
      kind: 'hypothesis'
      hypothesisId: string
      /** Always user_hypothesis — never promoted to evidence by linking. */
      modality: 'user_hypothesis'
    }

/**
 * A user-defined multimodal bundle linking datasets (and optionally
 * conditions / hypotheses) for side-by-side or tabbed comparison.
 *
 * Linking ≠ joint inference. The app does not invent a single scientific
 * narrative across modalities.
 */
export type MultimodalLink = {
  id: string
  createdAt: string
  updatedAt: string
  /** Short label for lists. */
  label: string
  /** Optional free-text notes (user notebook only — not analysis claims). */
  notes: string
  members: MultimodalMember[]
}

export const MULTIMODAL_DISCLAIMER =
  'Linking datasets into a bundle does not perform joint inference or merge modalities into one scientific narrative. Each evidence type stays labeled separately. User hypotheses remain user hypotheses — not evidence.'

export const MULTIMODAL_UI_LABEL = 'Multimodal link'
