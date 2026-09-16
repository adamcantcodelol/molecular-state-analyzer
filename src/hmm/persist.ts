import type { Project } from '../types/project'
import type { PersistedHmmRun } from './types'

const KEY = 'hmmRuns'
const MAX_RUNS = 20

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
