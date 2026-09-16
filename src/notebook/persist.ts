import type { ImportedDataset } from '../types/dataset'
import type {
  DatasetMetaSnapshot,
  NotebookEntry,
  NotebookEntryVersion,
  NotebookEpistemicKind,
  ProjectStateSummary,
  ProjectVersionSnapshot,
} from '../types/notebook'
import { NOTEBOOK_EPISTEMIC_KINDS } from '../types/notebook'
import type { Project } from '../types/project'

const NOTEBOOK_KEY = 'notebookEntries'
const VERSIONS_KEY = 'projectVersions'
const MAX_ENTRIES = 200
const MAX_VERSIONS_PER_ENTRY = 100
const MAX_PROJECT_VERSIONS = 100

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

function asStringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string')
}

function normalizeEpistemicKind(raw: unknown): NotebookEpistemicKind {
  const s = asString(raw, 'note')
  return (NOTEBOOK_EPISTEMIC_KINDS as string[]).includes(s)
    ? (s as NotebookEpistemicKind)
    : 'note'
}

function normalizeEntryVersion(raw: unknown): NotebookEntryVersion | null {
  if (!isRecord(raw)) return null
  const version = Math.max(1, asInt(raw.version, 1))
  const createdAt = asString(raw.createdAt)
  if (!createdAt) return null
  return {
    version,
    createdAt,
    title: asString(raw.title),
    body: asString(raw.body),
    epistemicKind: normalizeEpistemicKind(raw.epistemicKind),
  }
}

function normalizeEntry(raw: unknown): NotebookEntry | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  const now = new Date().toISOString()
  const versions: NotebookEntryVersion[] = []
  if (Array.isArray(raw.versions)) {
    for (const item of raw.versions) {
      const v = normalizeEntryVersion(item)
      if (v) versions.push(v)
    }
  }
  // Legacy / corrupt: synthesize a single version from flat fields if needed.
  if (versions.length === 0) {
    const title = asString(raw.title)
    const body = asString(raw.body)
    if (!title && !body) return null
    versions.push({
      version: 1,
      createdAt: asString(raw.createdAt, now),
      title,
      body,
      epistemicKind: normalizeEpistemicKind(raw.epistemicKind),
    })
  }
  versions.sort((a, b) => a.version - b.version)
  return {
    id,
    createdAt: asString(raw.createdAt, versions[0]?.createdAt ?? now),
    updatedAt: asString(
      raw.updatedAt,
      versions[versions.length - 1]?.createdAt ?? now,
    ),
    versions: versions.slice(0, MAX_VERSIONS_PER_ENTRY),
    datasetIds: asStringIds(raw.datasetIds),
    conditionIds: asStringIds(raw.conditionIds),
    hypothesisIds: asStringIds(raw.hypothesisIds),
    archived: Boolean(raw.archived),
  }
}

function arrayLen(state: Record<string, unknown>, key: string): number {
  const raw = state[key]
  return Array.isArray(raw) ? raw.length : 0
}

function snapshotDatasetMeta(ds: ImportedDataset): DatasetMetaSnapshot {
  return {
    id: ds.id,
    fileName: ds.fileName,
    format: ds.format,
    importedAt: ds.importedAt,
    byteLength: ds.byteLength,
    synthetic: ds.synthetic === true ? true : undefined,
    warningCount: Array.isArray(ds.warnings) ? ds.warnings.length : 0,
    summaryKind: ds.summary?.kind ?? 'unknown',
  }
}

function buildStateSummary(
  project: Project,
  notebookCount: number,
  versionCount: number,
): ProjectStateSummary {
  const state = project.state ?? {}
  const keys = Object.keys(state).sort()
  return {
    keys,
    hmmRunCount: arrayLen(state, 'hmmRuns'),
    hmmComparisonCount: arrayLen(state, 'hmmComparisons'),
    hmmBootstrapCount: arrayLen(state, 'hmmBootstraps'),
    smfretHmmRunCount: arrayLen(state, 'smfretHmmRuns'),
    conditionCount: arrayLen(state, 'conditions'),
    hypothesisCount: arrayLen(state, 'hypotheses'),
    multimodalLinkCount: arrayLen(state, 'multimodalLinks'),
    experimentPlanCount: arrayLen(state, 'experimentPlans'),
    notebookEntryCount: notebookCount,
    projectVersionCount: versionCount,
  }
}

function fingerprint(summary: ProjectStateSummary, datasetMeta: DatasetMetaSnapshot[]): string {
  const dsPart = datasetMeta
    .map((d) => `${d.id}:${d.byteLength}:${d.fileName}`)
    .join('|')
  const counts = [
    summary.hmmRunCount,
    summary.hmmComparisonCount,
    summary.hmmBootstrapCount,
    summary.smfretHmmRunCount,
    summary.conditionCount,
    summary.hypothesisCount,
    summary.multimodalLinkCount,
    summary.experimentPlanCount,
    summary.notebookEntryCount,
    datasetMeta.length,
  ].join(',')
  return `v1:${summary.keys.join('+')}#${counts}#${dsPart}`
}

function normalizeDatasetMeta(raw: unknown): DatasetMetaSnapshot | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  return {
    id,
    fileName: asString(raw.fileName),
    format: asString(raw.format),
    importedAt: asString(raw.importedAt),
    byteLength: Math.max(0, asInt(raw.byteLength, 0)),
    synthetic: raw.synthetic === true ? true : undefined,
    warningCount: Math.max(0, asInt(raw.warningCount, 0)),
    summaryKind: asString(raw.summaryKind, 'unknown'),
  }
}

function normalizeStateSummary(raw: unknown): ProjectStateSummary {
  if (!isRecord(raw)) {
    return {
      keys: [],
      hmmRunCount: 0,
      hmmComparisonCount: 0,
      hmmBootstrapCount: 0,
      smfretHmmRunCount: 0,
      conditionCount: 0,
      hypothesisCount: 0,
      multimodalLinkCount: 0,
      experimentPlanCount: 0,
      notebookEntryCount: 0,
      projectVersionCount: 0,
    }
  }
  const keys = Array.isArray(raw.keys)
    ? raw.keys.filter((x): x is string => typeof x === 'string')
    : []
  return {
    keys,
    hmmRunCount: Math.max(0, asInt(raw.hmmRunCount, 0)),
    hmmComparisonCount: Math.max(0, asInt(raw.hmmComparisonCount, 0)),
    hmmBootstrapCount: Math.max(0, asInt(raw.hmmBootstrapCount, 0)),
    smfretHmmRunCount: Math.max(0, asInt(raw.smfretHmmRunCount, 0)),
    conditionCount: Math.max(0, asInt(raw.conditionCount, 0)),
    hypothesisCount: Math.max(0, asInt(raw.hypothesisCount, 0)),
    multimodalLinkCount: Math.max(0, asInt(raw.multimodalLinkCount, 0)),
    experimentPlanCount: Math.max(0, asInt(raw.experimentPlanCount, 0)),
    notebookEntryCount: Math.max(0, asInt(raw.notebookEntryCount, 0)),
    projectVersionCount: Math.max(0, asInt(raw.projectVersionCount, 0)),
  }
}

function normalizeProjectVersion(raw: unknown): ProjectVersionSnapshot | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)
  if (!id) return null
  const now = new Date().toISOString()
  const datasetMeta: DatasetMetaSnapshot[] = []
  if (Array.isArray(raw.datasetMeta)) {
    for (const item of raw.datasetMeta) {
      const m = normalizeDatasetMeta(item)
      if (m) datasetMeta.push(m)
    }
  }
  return {
    id,
    createdAt: asString(raw.createdAt, now),
    label: asString(raw.label),
    notes: asString(raw.notes),
    projectName: asString(raw.projectName),
    projectUpdatedAt: asString(raw.projectUpdatedAt, now),
    datasetMeta,
    stateSummary: normalizeStateSummary(raw.stateSummary),
    stateFingerprint: asString(raw.stateFingerprint),
  }
}

/** Current (latest) revision of an entry. */
export function currentVersion(entry: NotebookEntry): NotebookEntryVersion {
  return entry.versions[entry.versions.length - 1]!
}

/** Read notebook entries from project.state without touching datasets. */
export function getNotebookEntries(project: Project): NotebookEntry[] {
  const state = project.state ?? {}
  const raw = state[NOTEBOOK_KEY]
  if (!Array.isArray(raw)) return []
  const out: NotebookEntry[] = []
  for (const item of raw) {
    const e = normalizeEntry(item)
    if (e) out.push(e)
  }
  return out
}

/**
 * Replace the full notebookEntries list under state.notebookEntries.
 * Datasets / originalText are left unchanged (same references).
 */
export function withNotebookEntries(
  project: Project,
  entries: NotebookEntry[],
): Project {
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [NOTEBOOK_KEY]: entries.slice(0, MAX_ENTRIES),
    },
  }
}

/**
 * Create a new entry (version 1) or append a new immutable version when editing.
 * Never rewrites prior versions in place.
 */
export function appendNotebookEntry(
  project: Project,
  input: {
    /** Existing id → append version; omit → create new entry. */
    id?: string
    title: string
    body: string
    epistemicKind: NotebookEpistemicKind
    datasetIds?: string[]
    conditionIds?: string[]
    hypothesisIds?: string[]
  },
): Project {
  const now = new Date().toISOString()
  const prev = getNotebookEntries(project)
  const existing = input.id ? prev.find((e) => e.id === input.id) : undefined

  if (existing) {
    const last = currentVersion(existing)
    const nextVersion: NotebookEntryVersion = {
      version: last.version + 1,
      createdAt: now,
      title: input.title,
      body: input.body,
      epistemicKind: input.epistemicKind,
    }
    const updated: NotebookEntry = {
      ...existing,
      updatedAt: now,
      versions: [...existing.versions, nextVersion].slice(
        0,
        MAX_VERSIONS_PER_ENTRY,
      ),
      datasetIds: input.datasetIds ?? existing.datasetIds,
      conditionIds: input.conditionIds ?? existing.conditionIds,
      hypothesisIds: input.hypothesisIds ?? existing.hypothesisIds,
    }
    const next = prev.map((e) => (e.id === updated.id ? updated : e))
    return withNotebookEntries(project, next)
  }

  const id = newNotebookEntryId()
  const v1: NotebookEntryVersion = {
    version: 1,
    createdAt: now,
    title: input.title,
    body: input.body,
    epistemicKind: input.epistemicKind,
  }
  const entry: NotebookEntry = {
    id,
    createdAt: now,
    updatedAt: now,
    versions: [v1],
    datasetIds: input.datasetIds ?? [],
    conditionIds: input.conditionIds ?? [],
    hypothesisIds: input.hypothesisIds ?? [],
  }
  return withNotebookEntries(project, [entry, ...prev])
}

/** Soft-archive (history retained). Does not delete version history. */
export function archiveNotebookEntry(project: Project, id: string): Project {
  const prev = getNotebookEntries(project)
  const next = prev.map((e) =>
    e.id === id ? { ...e, archived: true, updatedAt: new Date().toISOString() } : e,
  )
  return withNotebookEntries(project, next)
}

/** Remove entry entirely from the list (destructive). Prefer archive for immutability. */
export function removeNotebookEntry(project: Project, id: string): Project {
  return withNotebookEntries(
    project,
    getNotebookEntries(project).filter((e) => e.id !== id),
  )
}

/** Read project version snapshots from project.state. */
export function getProjectVersions(project: Project): ProjectVersionSnapshot[] {
  const state = project.state ?? {}
  const raw = state[VERSIONS_KEY]
  if (!Array.isArray(raw)) return []
  const out: ProjectVersionSnapshot[] = []
  for (const item of raw) {
    const v = normalizeProjectVersion(item)
    if (v) out.push(v)
  }
  return out
}

export function withProjectVersions(
  project: Project,
  versions: ProjectVersionSnapshot[],
): Project {
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [VERSIONS_KEY]: versions.slice(0, MAX_PROJECT_VERSIONS),
    },
  }
}

/**
 * Append an immutable project version snapshot (metadata only — no originalText).
 */
export function captureProjectVersion(
  project: Project,
  input: { label?: string; notes?: string },
): Project {
  const now = new Date().toISOString()
  const prevVersions = getProjectVersions(project)
  const notebookCount = getNotebookEntries(project).length
  const datasetMeta = (project.datasets ?? []).map(snapshotDatasetMeta)
  // Count after this capture would include the new version.
  const summary = buildStateSummary(
    project,
    notebookCount,
    prevVersions.length + 1,
  )
  const snap: ProjectVersionSnapshot = {
    id: newProjectVersionId(),
    createdAt: now,
    label: (input.label ?? '').trim() || `Version ${prevVersions.length + 1}`,
    notes: (input.notes ?? '').trim(),
    projectName: project.name,
    projectUpdatedAt: project.updatedAt,
    datasetMeta,
    stateSummary: summary,
    stateFingerprint: fingerprint(summary, datasetMeta),
  }
  return withProjectVersions(project, [snap, ...prevVersions])
}

export function removeProjectVersion(project: Project, id: string): Project {
  return withProjectVersions(
    project,
    getProjectVersions(project).filter((v) => v.id !== id),
  )
}

export function newNotebookEntryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `nb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function newProjectVersionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `pv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export { NOTEBOOK_KEY, VERSIONS_KEY }
