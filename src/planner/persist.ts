import type { Project } from '../types/project'
import {
  ALL_MEASUREMENT_KINDS,
  PLAN_KIND,
  type ExperimentPlan,
  type PlannedConditionRow,
  type PlannedMeasurement,
  type PlannedMeasurementKind,
  type PlanMatrixCell,
} from '../types/planner'

const KEY = 'experimentPlans'
const MAX_PLANS = 50

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asInt(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v)
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return Math.floor(n)
  }
  return fallback
}

function normalizeConditionRow(raw: unknown): PlannedConditionRow | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  const linked =
    typeof raw.linkedConditionId === 'string' && raw.linkedConditionId
      ? raw.linkedConditionId
      : null
  return {
    id,
    label: asString(raw.label),
    notes: asString(raw.notes),
    linkedConditionId: linked,
  }
}

function normalizeMeasurement(raw: unknown): PlannedMeasurement | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  const kindRaw = asString(raw.kind, 'other')
  const kind: PlannedMeasurementKind = (
    ALL_MEASUREMENT_KINDS as string[]
  ).includes(kindRaw)
    ? (kindRaw as PlannedMeasurementKind)
    : 'other'
  return {
    id,
    kind,
    label: asString(raw.label),
    notes: asString(raw.notes),
  }
}

function normalizeCell(raw: unknown): PlanMatrixCell | null {
  if (!isRecord(raw)) return null
  const conditionId = asString(raw.conditionId)
  const measurementId = asString(raw.measurementId)
  if (!conditionId || !measurementId) return null
  return {
    conditionId,
    replicateIndex: Math.max(1, asInt(raw.replicateIndex, 1)),
    measurementId,
    note: asString(raw.note),
  }
}

function normalizePlan(raw: unknown): ExperimentPlan | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  const now = new Date().toISOString()

  const conditions: PlannedConditionRow[] = []
  if (Array.isArray(raw.conditions)) {
    for (const item of raw.conditions) {
      const c = normalizeConditionRow(item)
      if (c) conditions.push(c)
    }
  }

  const measurements: PlannedMeasurement[] = []
  if (Array.isArray(raw.measurements)) {
    for (const item of raw.measurements) {
      const m = normalizeMeasurement(item)
      if (m) measurements.push(m)
    }
  }

  const matrix: PlanMatrixCell[] = []
  if (Array.isArray(raw.matrix)) {
    for (const item of raw.matrix) {
      const cell = normalizeCell(item)
      if (cell) matrix.push(cell)
    }
  }

  const linkedConditionIds = Array.isArray(raw.linkedConditionIds)
    ? raw.linkedConditionIds.filter((x): x is string => typeof x === 'string')
    : []
  const linkedHypothesisIds = Array.isArray(raw.linkedHypothesisIds)
    ? raw.linkedHypothesisIds.filter((x): x is string => typeof x === 'string')
    : []

  return {
    id,
    createdAt: asString(raw.createdAt, now),
    updatedAt: asString(raw.updatedAt, now),
    kind: PLAN_KIND,
    title: asString(raw.title),
    goal: asString(raw.goal),
    numConditions: Math.max(1, asInt(raw.numConditions, conditions.length || 1)),
    replicatesPerCondition: Math.max(
      1,
      asInt(raw.replicatesPerCondition, 1),
    ),
    conditions,
    measurements,
    matrix,
    linkedConditionIds,
    linkedHypothesisIds,
    sampleSizeHeuristicNote: asString(raw.sampleSizeHeuristicNote),
    notes: asString(raw.notes),
  }
}

/** Read experiment plans from project.state without touching datasets. */
export function getExperimentPlans(project: Project): ExperimentPlan[] {
  const state = project.state ?? {}
  const raw = state[KEY]
  if (!Array.isArray(raw)) return []
  const out: ExperimentPlan[] = []
  for (const item of raw) {
    const p = normalizePlan(item)
    if (p) out.push(p)
  }
  return out
}

/**
 * Replace the full experimentPlans list under state.experimentPlans.
 * Datasets / originalText are left unchanged (same references).
 * kind is always forced to suggestion_draft.
 */
export function withExperimentPlans(
  project: Project,
  plans: ExperimentPlan[],
): Project {
  const locked = plans.map((p) => ({ ...p, kind: PLAN_KIND }))
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [KEY]: locked.slice(0, MAX_PLANS),
    },
  }
}

export function upsertExperimentPlan(
  project: Project,
  plan: ExperimentPlan,
): Project {
  const locked: ExperimentPlan = { ...plan, kind: PLAN_KIND }
  const prev = getExperimentPlans(project)
  const idx = prev.findIndex((p) => p.id === locked.id)
  const next =
    idx >= 0
      ? prev.map((p, i) => (i === idx ? locked : p))
      : [locked, ...prev]
  return withExperimentPlans(project, next)
}

export function removeExperimentPlan(project: Project, id: string): Project {
  return withExperimentPlans(
    project,
    getExperimentPlans(project).filter((p) => p.id !== id),
  )
}

export { KEY as EXPERIMENT_PLANS_KEY }
