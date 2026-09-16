/**
 * Phase 14 — lab notebook, project versioning, research report export.
 * Stored under project.state only; never mutates dataset originalText.
 *
 * Epistemic kinds stay distinct: observation ≠ inference ≠ user hypothesis.
 * User hypotheses for reports come from project.state.hypotheses (kind:
 * user_hypothesis), never silently merged into Observations / Inferences.
 */

/** Author classification for a notebook revision (not a scientific claim). */
export type NotebookEpistemicKind = 'observation' | 'inference' | 'note'

/**
 * One immutable revision of a notebook entry.
 * Past versions are never rewritten; edits append a new version.
 */
export type NotebookEntryVersion = {
  version: number
  createdAt: string
  title: string
  body: string
  epistemicKind: NotebookEpistemicKind
}

/**
 * Append-only notebook entry with version history.
 * `versions` grows on edit; prior entries in the array are immutable.
 */
export type NotebookEntry = {
  id: string
  createdAt: string
  /** Timestamp of the latest appended version. */
  updatedAt: string
  /** Append-only; never rewrite prior versions in place. */
  versions: NotebookEntryVersion[]
  datasetIds: string[]
  conditionIds: string[]
  /** Links to user hypotheses (still labeled user_hypothesis — not evidence). */
  hypothesisIds: string[]
  /** Soft-hide from default lists; history retained. */
  archived?: boolean
}

/** Dataset metadata captured in a project version (never originalText). */
export type DatasetMetaSnapshot = {
  id: string
  fileName: string
  format: string
  importedAt: string
  byteLength: number
  synthetic?: boolean
  warningCount: number
  summaryKind: string
}

/** Counts / keys present in project.state at snapshot time (no bulky payloads). */
export type ProjectStateSummary = {
  keys: string[]
  hmmRunCount: number
  hmmComparisonCount: number
  hmmBootstrapCount: number
  smfretHmmRunCount: number
  conditionCount: number
  hypothesisCount: number
  multimodalLinkCount: number
  experimentPlanCount: number
  notebookEntryCount: number
  projectVersionCount: number
}

/**
 * Immutable snapshot of key project state + dataset metadata.
 * Append-only under project.state.projectVersions.
 */
export type ProjectVersionSnapshot = {
  id: string
  createdAt: string
  label: string
  notes: string
  projectName: string
  projectUpdatedAt: string
  datasetMeta: DatasetMetaSnapshot[]
  stateSummary: ProjectStateSummary
  /** Lightweight fingerprint of summary counts + dataset keys (not a content hash of originals). */
  stateFingerprint: string
}

export const NOTEBOOK_EPISTEMIC_KINDS: NotebookEpistemicKind[] = [
  'observation',
  'inference',
  'note',
]

export const EPISTEMIC_KIND_LABELS: Record<NotebookEpistemicKind, string> = {
  observation: 'Observation',
  inference: 'Inference',
  note: 'Note (unclassified)',
}

export const NOTEBOOK_DISCLAIMER =
  'Lab notebook entries are append-only (edits create new versions). ' +
  'Observation, inference, and user-hypothesis sections stay separate in exports — ' +
  'the app never conflates them or promotes notes to evidence.'

export const VERSIONING_DISCLAIMER =
  'Project versions snapshot dataset metadata and state summaries with timestamps. ' +
  'They do not copy originalText and do not rewrite imported datasets.'
