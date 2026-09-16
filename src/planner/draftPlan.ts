/**
 * Build a structured suggestion draft from planner form inputs.
 * Output is always kind: suggestion_draft — never a prescription.
 */

import {
  ALL_MEASUREMENT_KINDS,
  MEASUREMENT_KIND_LABELS,
  PLAN_KIND,
  roughSampleSizeHeuristic,
  type ExperimentPlan,
  type PlannedConditionRow,
  type PlannedMeasurement,
  type PlannedMeasurementKind,
  type PlanMatrixCell,
} from '../types/planner'

export type DraftPlanInput = {
  title: string
  goal: string
  numConditions: number
  replicatesPerCondition: number
  measurementKinds: PlannedMeasurementKind[]
  /** Optional pre-seeded condition labels (length may be < numConditions). */
  conditionLabels?: string[]
  linkedConditionIds?: string[]
  linkedHypothesisIds?: string[]
  notes?: string
  /** Preserve id/createdAt when regenerating an existing plan. */
  existing?: Pick<ExperimentPlan, 'id' | 'createdAt'> | null
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function newLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function newPlanId(): string {
  return newLocalId('plan')
}

/**
 * Generate a suggestion draft: conditions × replicates × measurements matrix.
 * Does not perform power analysis or claim significance.
 */
export function generateDraftPlan(input: DraftPlanInput): ExperimentPlan {
  const numConditions = clampInt(input.numConditions, 1, 24)
  const replicatesPerCondition = clampInt(input.replicatesPerCondition, 1, 50)
  const kinds =
    input.measurementKinds.length > 0
      ? input.measurementKinds.filter((k) =>
          (ALL_MEASUREMENT_KINDS as string[]).includes(k),
        )
      : (['time_series'] as PlannedMeasurementKind[])

  const now = new Date().toISOString()
  const labels = input.conditionLabels ?? []

  const conditions: PlannedConditionRow[] = []
  for (let i = 0; i < numConditions; i++) {
    const preset = labels[i]?.trim()
    conditions.push({
      id: newLocalId('pc'),
      label: preset || `Condition ${i + 1}`,
      notes: '',
      linkedConditionId: null,
    })
  }

  const measurements: PlannedMeasurement[] = kinds.map((kind) => ({
    id: newLocalId('pm'),
    kind,
    label: MEASUREMENT_KIND_LABELS[kind],
    notes: '',
  }))

  const matrix: PlanMatrixCell[] = []
  for (const cond of conditions) {
    for (let r = 1; r <= replicatesPerCondition; r++) {
      for (const m of measurements) {
        matrix.push({
          conditionId: cond.id,
          replicateIndex: r,
          measurementId: m.id,
          note: '',
        })
      }
    }
  }

  const linkedConditionIds = (input.linkedConditionIds ?? []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  )
  const linkedHypothesisIds = (input.linkedHypothesisIds ?? []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  )

  return {
    id: input.existing?.id ?? newPlanId(),
    createdAt: input.existing?.createdAt ?? now,
    updatedAt: now,
    kind: PLAN_KIND,
    title: input.title.trim() || 'Untitled draft plan',
    goal: input.goal.trim(),
    numConditions,
    replicatesPerCondition,
    conditions,
    measurements,
    matrix,
    linkedConditionIds,
    linkedHypothesisIds,
    sampleSizeHeuristicNote: roughSampleSizeHeuristic(
      numConditions,
      replicatesPerCondition,
    ),
    notes: (input.notes ?? '').trim(),
  }
}

/** Rebuild matrix from current conditions / measurements / replicate count. */
export function rebuildMatrix(plan: ExperimentPlan): PlanMatrixCell[] {
  const rMax = clampInt(plan.replicatesPerCondition, 1, 50)
  const prev = new Map<string, string>()
  for (const cell of plan.matrix) {
    prev.set(
      `${cell.conditionId}|${cell.replicateIndex}|${cell.measurementId}`,
      cell.note,
    )
  }
  const matrix: PlanMatrixCell[] = []
  for (const cond of plan.conditions) {
    for (let r = 1; r <= rMax; r++) {
      for (const m of plan.measurements) {
        const key = `${cond.id}|${r}|${m.id}`
        matrix.push({
          conditionId: cond.id,
          replicateIndex: r,
          measurementId: m.id,
          note: prev.get(key) ?? '',
        })
      }
    }
  }
  return matrix
}
