/**
 * Phase 9 — experimental condition metadata and user hypotheses.
 * Stored under project.state only; never mutates dataset originalText.
 */

/** Where a condition record applies. */
export type ConditionScope =
  | { kind: 'project' }
  | { kind: 'dataset'; datasetId: string }

/** Free-form key/value pair for arbitrary condition metadata. */
export type ConditionKv = {
  key: string
  value: string
}

/**
 * One condition / experimental-context record.
 * Common fields are optional convenience slots; `extra` holds anything else.
 */
export type ConditionRecord = {
  id: string
  createdAt: string
  updatedAt: string
  /** Short label for lists (optional). */
  label: string
  scope: ConditionScope
  /** Convenience structured fields (empty string = unset). */
  temperature: string
  ligandName: string
  concentration: string
  buffer: string
  notes: string
  /** Arbitrary additional keys the user defines. */
  extra: ConditionKv[]
}

/**
 * A user-authored idea linking ligands/conditions to possible states.
 * ALWAYS kind === 'user_hypothesis'. Never auto-promoted to evidence or
 * scientific conclusion by the app.
 */
export type UserHypothesis = {
  id: string
  createdAt: string
  updatedAt: string
  /**
   * Discriminator — fixed at creation. UI must label this as a user hypothesis,
   * not evidence / not a proven result.
   */
  kind: 'user_hypothesis'
  title: string
  /** Free-text idea about states / ligands / conditions. */
  idea: string
  /** Optional ligand name (may also appear in linked conditions). */
  ligandName: string
  /** Optional speculation about latent-state meaning (user only). */
  stateNotes: string
  /** Linked condition record ids (from project.state.conditions). */
  conditionIds: string[]
  /** Optional dataset ids this hypothesis concerns. */
  datasetIds: string[]
}

export const HYPOTHESIS_KIND = 'user_hypothesis' as const

export const HYPOTHESIS_UI_LABEL = 'User hypothesis'
export const HYPOTHESIS_DISCLAIMER =
  'User hypothesis — not evidence, not a scientific conclusion. The app never auto-promotes hypotheses to proven results.'
