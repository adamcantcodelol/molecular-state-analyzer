import type { Project } from '../types/project'
import type { PersistedSmfretHmmRun } from './types'
import { SMFRET_OBSERVATION_KIND, SMFRET_SOURCE } from './types'

const KEY = 'smfretHmmRuns'
const MAX_RUNS = 20

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asNumberArray(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null
  const out: number[] = []
  for (const x of v) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return null
    out.push(x)
  }
  return out
}

function asNumberMatrix(v: unknown): number[][] | null {
  if (!Array.isArray(v)) return null
  const out: number[][] = []
  for (const row of v) {
    const r = asNumberArray(row)
    if (!r) return null
    out.push(r)
  }
  return out
}

/** Best-effort normalize of a persisted smFRET HMM run. */
function normalizeRun(raw: unknown): PersistedSmfretHmmRun | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' ? raw.id : ''
  if (!id) return null
  const settings = raw.settings
  if (!isRecord(settings)) return null
  const means = asNumberArray(raw.means)
  const variances = asNumberArray(raw.variances)
  const startProb = asNumberArray(raw.startProb)
  const transProb = asNumberMatrix(raw.transProb)
  const statePath = asNumberArray(raw.statePath)
  const stateCounts = asNumberArray(raw.stateCounts)
  if (
    !means ||
    !variances ||
    !startProb ||
    !transProb ||
    !statePath ||
    !stateCounts
  ) {
    return null
  }
  const nStates =
    typeof settings.nStates === 'number' ? Math.floor(settings.nStates) : 0
  if (nStates < 1) return null
  return {
    id,
    createdAt:
      typeof raw.createdAt === 'string'
        ? raw.createdAt
        : new Date().toISOString(),
    source: SMFRET_SOURCE,
    observationKind: SMFRET_OBSERVATION_KIND,
    datasetId: typeof raw.datasetId === 'string' ? raw.datasetId : '',
    datasetFileName:
      typeof raw.datasetFileName === 'string' ? raw.datasetFileName : '',
    valueColumn: typeof raw.valueColumn === 'string' ? raw.valueColumn : '',
    seriesFilter:
      typeof raw.seriesFilter === 'string'
        ? raw.seriesFilter
        : raw.seriesFilter === null
          ? null
          : null,
    settings: {
      nStates,
      maxIter:
        typeof settings.maxIter === 'number'
          ? Math.floor(settings.maxIter)
          : 100,
      tol: typeof settings.tol === 'number' ? settings.tol : 1e-6,
      seed: typeof settings.seed === 'number' ? Math.floor(settings.seed) : 42,
      minVariance:
        typeof settings.minVariance === 'number' ? settings.minVariance : 1e-6,
    },
    means,
    variances,
    startProb,
    transProb,
    statePath: statePath.map((s) => Math.floor(s)),
    stateCounts: stateCounts.map((c) => Math.floor(c)),
    logLikelihood:
      typeof raw.logLikelihood === 'number' ? raw.logLikelihood : NaN,
    iterations: typeof raw.iterations === 'number' ? raw.iterations : 0,
    converged: Boolean(raw.converged),
    observationCount:
      typeof raw.observationCount === 'number' ? raw.observationCount : 0,
  }
}

/** Read smFRET HMM runs from project.state without touching datasets. */
export function getSmfretHmmRuns(project: Project): PersistedSmfretHmmRun[] {
  const state = project.state ?? {}
  const raw = state[KEY]
  if (!Array.isArray(raw)) return []
  const out: PersistedSmfretHmmRun[] = []
  for (const item of raw) {
    const r = normalizeRun(item)
    if (r) out.push(r)
  }
  return out
}

/**
 * Return a new project with the run prepended under state.smfretHmmRuns.
 * Datasets / originalText are copied by reference unchanged.
 */
export function withSmfretHmmRun(
  project: Project,
  run: PersistedSmfretHmmRun,
): Project {
  const locked: PersistedSmfretHmmRun = {
    ...run,
    source: SMFRET_SOURCE,
    observationKind: SMFRET_OBSERVATION_KIND,
  }
  const prev = getSmfretHmmRuns(project)
  const smfretHmmRuns = [locked, ...prev].slice(0, MAX_RUNS)
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [KEY]: smfretHmmRuns,
    },
  }
}

export function newSmfretRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `smfret_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
