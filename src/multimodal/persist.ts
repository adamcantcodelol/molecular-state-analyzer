import type { MultimodalLink, MultimodalMember, ModalityKind } from '../types/multimodal'
import type { Project } from '../types/project'

const KEY = 'multimodalLinks'
const MAX_LINKS = 50

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

const MODALITIES: ModalityKind[] = [
  'structure',
  'sequence',
  'time_series',
  'tabular',
  'conditions',
  'user_hypothesis',
  'other',
]

function asModality(v: unknown, fallback: ModalityKind): ModalityKind {
  if (typeof v === 'string' && (MODALITIES as string[]).includes(v)) {
    return v as ModalityKind
  }
  return fallback
}

function normalizeMember(raw: unknown): MultimodalMember | null {
  if (!isRecord(raw)) return null
  const kind = asString(raw.kind)
  if (kind === 'dataset') {
    const datasetId = asString(raw.datasetId)
    if (!datasetId) return null
    return {
      kind: 'dataset',
      datasetId,
      modality: asModality(raw.modality, 'other'),
    }
  }
  if (kind === 'condition') {
    const conditionId = asString(raw.conditionId)
    if (!conditionId) return null
    return {
      kind: 'condition',
      conditionId,
      modality: 'conditions',
    }
  }
  if (kind === 'hypothesis') {
    const hypothesisId = asString(raw.hypothesisId)
    if (!hypothesisId) return null
    return {
      kind: 'hypothesis',
      hypothesisId,
      modality: 'user_hypothesis',
    }
  }
  return null
}

function normalizeLink(raw: unknown): MultimodalLink | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  const now = new Date().toISOString()
  const members: MultimodalMember[] = []
  if (Array.isArray(raw.members)) {
    for (const item of raw.members) {
      const m = normalizeMember(item)
      if (m) members.push(m)
    }
  }
  return {
    id,
    createdAt: asString(raw.createdAt, now),
    updatedAt: asString(raw.updatedAt, now),
    label: asString(raw.label),
    notes: asString(raw.notes),
    members,
  }
}

/** Read multimodal links from project.state without touching datasets. */
export function getMultimodalLinks(project: Project): MultimodalLink[] {
  const state = project.state ?? {}
  const raw = state[KEY]
  if (!Array.isArray(raw)) return []
  const out: MultimodalLink[] = []
  for (const item of raw) {
    const link = normalizeLink(item)
    if (link) out.push(link)
  }
  return out
}

/**
 * Replace the full multimodalLinks list under state.multimodalLinks.
 * Datasets / originalText are left unchanged (same references).
 */
export function withMultimodalLinks(
  project: Project,
  links: MultimodalLink[],
): Project {
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [KEY]: links.slice(0, MAX_LINKS),
    },
  }
}

export function upsertMultimodalLink(
  project: Project,
  record: MultimodalLink,
): Project {
  const prev = getMultimodalLinks(project)
  const idx = prev.findIndex((c) => c.id === record.id)
  const next =
    idx >= 0
      ? prev.map((c, i) => (i === idx ? record : c))
      : [record, ...prev]
  return withMultimodalLinks(project, next)
}

export function removeMultimodalLink(project: Project, id: string): Project {
  return withMultimodalLinks(
    project,
    getMultimodalLinks(project).filter((c) => c.id !== id),
  )
}

export function newMultimodalLinkId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `mm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
