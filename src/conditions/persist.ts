import type { ConditionRecord, UserHypothesis } from '../types/conditions'
import { HYPOTHESIS_KIND } from '../types/conditions'
import type { Project } from '../types/project'

const CONDITIONS_KEY = 'conditions'
const HYPOTHESES_KEY = 'hypotheses'
const MAX_CONDITIONS = 100
const MAX_HYPOTHESES = 100

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function normalizeScope(raw: unknown): ConditionRecord['scope'] {
  if (!isRecord(raw)) return { kind: 'project' }
  if (raw.kind === 'dataset' && typeof raw.datasetId === 'string') {
    return { kind: 'dataset', datasetId: raw.datasetId }
  }
  return { kind: 'project' }
}

function normalizeExtra(raw: unknown): ConditionRecord['extra'] {
  if (!Array.isArray(raw)) return []
  const out: ConditionRecord['extra'] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const key = asString(item.key).trim()
    if (!key) continue
    out.push({ key, value: asString(item.value) })
  }
  return out
}

function normalizeCondition(raw: unknown): ConditionRecord | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  const now = new Date().toISOString()
  return {
    id,
    createdAt: asString(raw.createdAt, now),
    updatedAt: asString(raw.updatedAt, now),
    label: asString(raw.label),
    scope: normalizeScope(raw.scope),
    temperature: asString(raw.temperature),
    ligandName: asString(raw.ligandName),
    concentration: asString(raw.concentration),
    buffer: asString(raw.buffer),
    notes: asString(raw.notes),
    extra: normalizeExtra(raw.extra),
  }
}

function normalizeHypothesis(raw: unknown): UserHypothesis | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  const now = new Date().toISOString()
  const conditionIds = Array.isArray(raw.conditionIds)
    ? raw.conditionIds.filter((x): x is string => typeof x === 'string')
    : []
  const datasetIds = Array.isArray(raw.datasetIds)
    ? raw.datasetIds.filter((x): x is string => typeof x === 'string')
    : []
  return {
    id,
    createdAt: asString(raw.createdAt, now),
    updatedAt: asString(raw.updatedAt, now),
    kind: HYPOTHESIS_KIND,
    title: asString(raw.title),
    idea: asString(raw.idea),
    ligandName: asString(raw.ligandName),
    stateNotes: asString(raw.stateNotes),
    conditionIds,
    datasetIds,
  }
}

/** Read condition records from project.state without touching datasets. */
export function getConditions(project: Project): ConditionRecord[] {
  const state = project.state ?? {}
  const raw = state[CONDITIONS_KEY]
  if (!Array.isArray(raw)) return []
  const out: ConditionRecord[] = []
  for (const item of raw) {
    const c = normalizeCondition(item)
    if (c) out.push(c)
  }
  return out
}

/**
 * Replace the full conditions list under state.conditions.
 * Datasets / originalText are left unchanged (same references).
 */
export function withConditions(
  project: Project,
  conditions: ConditionRecord[],
): Project {
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [CONDITIONS_KEY]: conditions.slice(0, MAX_CONDITIONS),
    },
  }
}

export function upsertCondition(
  project: Project,
  record: ConditionRecord,
): Project {
  const prev = getConditions(project)
  const idx = prev.findIndex((c) => c.id === record.id)
  const next =
    idx >= 0
      ? prev.map((c, i) => (i === idx ? record : c))
      : [record, ...prev]
  return withConditions(project, next)
}

export function removeCondition(project: Project, id: string): Project {
  return withConditions(
    project,
    getConditions(project).filter((c) => c.id !== id),
  )
}

/** Read user hypotheses from project.state. */
export function getHypotheses(project: Project): UserHypothesis[] {
  const state = project.state ?? {}
  const raw = state[HYPOTHESES_KEY]
  if (!Array.isArray(raw)) return []
  const out: UserHypothesis[] = []
  for (const item of raw) {
    const h = normalizeHypothesis(item)
    if (h) out.push(h)
  }
  return out
}

/**
 * Replace the full hypotheses list under state.hypotheses.
 * Never promotes a hypothesis to evidence; kind stays user_hypothesis.
 */
export function withHypotheses(
  project: Project,
  hypotheses: UserHypothesis[],
): Project {
  const locked = hypotheses.map((h) => ({
    ...h,
    kind: HYPOTHESIS_KIND,
  }))
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [HYPOTHESES_KEY]: locked.slice(0, MAX_HYPOTHESES),
    },
  }
}

export function upsertHypothesis(
  project: Project,
  record: UserHypothesis,
): Project {
  const prev = getHypotheses(project)
  const locked: UserHypothesis = { ...record, kind: HYPOTHESIS_KIND }
  const idx = prev.findIndex((h) => h.id === locked.id)
  const next =
    idx >= 0
      ? prev.map((h, i) => (i === idx ? locked : h))
      : [locked, ...prev]
  return withHypotheses(project, next)
}

export function removeHypothesis(project: Project, id: string): Project {
  return withHypotheses(
    project,
    getHypotheses(project).filter((h) => h.id !== id),
  )
}

export function newConditionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `cond_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function newHypothesisId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `hyp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
