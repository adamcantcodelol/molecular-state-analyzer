/**
 * Phase 13 — experimental design planner (suggestions / drafts only).
 * Stored under project.state.experimentPlans; never mutates originalText.
 * Never claims guaranteed significance, power, or mandated sample sizes.
 */

/** Suggested measurement modality for a draft plan cell. */
export type PlannedMeasurementKind =
  | 'smFRET'
  | 'structure'
  | 'time_series'
  | 'tabular'
  | 'HMM_analysis'
  | 'other'

export const MEASUREMENT_KIND_LABELS: Record<PlannedMeasurementKind, string> = {
  smFRET: 'smFRET (E_FRET)',
  structure: 'Structure (PDB/mmCIF)',
  time_series: 'Time-series',
  tabular: 'Tabular / other assay',
  HMM_analysis: 'HMM / statistical latent-state analysis',
  other: 'Other',
}

export const ALL_MEASUREMENT_KINDS: PlannedMeasurementKind[] = [
  'smFRET',
  'structure',
  'time_series',
  'tabular',
  'HMM_analysis',
  'other',
]

/** One suggested condition row in a draft plan. */
export type PlannedConditionRow = {
  id: string
  /** Suggested label (user-editable). */
  label: string
  notes: string
  /**
   * Optional link to an existing ConditionRecord id.
   * Linking is organizational only — does not invent experimental facts.
   */
  linkedConditionId: string | null
}

/** One suggested measurement type in the draft. */
export type PlannedMeasurement = {
  id: string
  kind: PlannedMeasurementKind
  label: string
  notes: string
}

/**
 * One cell in the suggested matrix: condition × replicate × measurement.
 * Purely organizational for planning notes.
 */
export type PlanMatrixCell = {
  conditionId: string
  replicateIndex: number
  measurementId: string
  /** Optional free note for this cell. */
  note: string
}

/**
 * A user-editable experimental design draft.
 * ALWAYS kind === 'suggestion_draft'. Never a prescription or power analysis.
 */
export type ExperimentPlan = {
  id: string
  createdAt: string
  updatedAt: string
  /**
   * Discriminator — fixed. UI must label as Suggestion / draft.
   */
  kind: 'suggestion_draft'
  title: string
  /** User-described goal (e.g. compare ligands, smFRET vs structure). */
  goal: string
  /** How many condition rows the draft was built with. */
  numConditions: number
  /** Suggested replicates per condition (user-editable integer ≥ 1). */
  replicatesPerCondition: number
  conditions: PlannedConditionRow[]
  measurements: PlannedMeasurement[]
  /** Flattened suggested matrix (conditions × replicates × measurements). */
  matrix: PlanMatrixCell[]
  /**
   * Optional links to existing condition / hypothesis ids.
   * Linking never promotes hypotheses to evidence.
   */
  linkedConditionIds: string[]
  linkedHypothesisIds: string[]
  /**
   * Optional rough sample-size heuristic text.
   * MUST be treated / labeled as a rough heuristic only — not a power
   * analysis, not a guarantee of significance, not a scientific mandate.
   */
  sampleSizeHeuristicNote: string
  notes: string
}

export const PLAN_KIND = 'suggestion_draft' as const

export const PLAN_UI_LABEL = 'Suggestion / draft'

export const PLAN_DISCLAIMER =
  'Suggestion / draft — not a prescription; does not guarantee statistical power or significance. Sample-size notes (if shown) are rough heuristics only, not power analyses or scientific mandates.'

/**
 * Build a rough heuristic note from replicates / conditions.
 * Explicitly non-authoritative — for display with PLAN_DISCLAIMER only.
 */
export function roughSampleSizeHeuristic(
  numConditions: number,
  replicatesPerCondition: number,
): string {
  const n = Math.max(1, Math.floor(numConditions))
  const r = Math.max(1, Math.floor(replicatesPerCondition))
  const total = n * r
  return (
    `Rough heuristic only (not a power analysis): this draft sketches ${n} ` +
    `condition(s) × ${r} replicate(s) ≈ ${total} observational unit(s). ` +
    `A common exploratory rule of thumb is ≥3 biological replicates per ` +
    `condition — that is a heuristic, not a required sample size, and it ` +
    `does not guarantee statistical power or significance. Choose n based ` +
    `on your assay variance, effect size, and institutional guidance.`
  )
}
