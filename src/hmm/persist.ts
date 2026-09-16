import type { Project } from '../types/project'
import type { PersistedHmmBootstrap, PersistedHmmComparison, PersistedHmmRun } from './types'

const KEY = 'hmmRuns'
const CMP_KEY = 'hmmComparisons'
const MAX_RUNS = 20
const MAX_CMP = 20

/** Read HMM runs from project.state without touching datasets. */
export function getHmmRuns(project: Project): PersistedHmmRun[] {
  const state = project.state ?? {}
  const raw = state[KEY]
  if (!Array.isArray(raw)) return []
  return raw as PersistedHmmRun[]
}

/**
 * Return a new project with the run prepended under state.hmmRuns.
 * Datasets / originalText are copied by reference unchanged.
 */
export function withHmmRun(project: Project, run: PersistedHmmRun): Project {
  const prev = getHmmRuns(project)
  const hmmRuns = [run, ...prev].slice(0, MAX_RUNS)
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [KEY]: hmmRuns,
    },
  }
}

export function getHmmComparisons(project: Project): PersistedHmmComparison[] {
  const state = project.state ?? {}
  const raw = state[CMP_KEY]
  if (!Array.isArray(raw)) return []
  return raw as PersistedHmmComparison[]
}

export function withHmmComparison(
  project: Project,
  cmp: PersistedHmmComparison,
): Project {
  const prev = getHmmComparisons(project)
  const hmmComparisons = [cmp, ...prev].slice(0, MAX_CMP)
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [CMP_KEY]: hmmComparisons,
    },
  }
}

const BOOT_KEY = 'hmmBootstraps'
const MAX_BOOT = 20

export function getHmmBootstraps(project: Project): PersistedHmmBootstrap[] {
  const state = project.state ?? {}
  const raw = state[BOOT_KEY]
  if (!Array.isArray(raw)) return []
  return raw as PersistedHmmBootstrap[]
}

export function withHmmBootstrap(
  project: Project,
  run: PersistedHmmBootstrap,
): Project {
  const prev = getHmmBootstraps(project)
  const hmmBootstraps = [run, ...prev].slice(0, MAX_BOOT)
  return {
    ...project,
    datasets: project.datasets,
    state: {
      ...(project.state ?? {}),
      [BOOT_KEY]: hmmBootstraps,
    },
  }
}
