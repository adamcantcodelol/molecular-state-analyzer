/** User-configurable Gaussian HMM settings (reproducible with seed). */
export type HmmSettings = {
  /** Number of latent states K (≥ 1). */
  nStates: number
  /** Maximum Baum–Welch EM iterations. */
  maxIter: number
  /** Stop when |Δ log-likelihood| / |ll| < tol (relative). */
  tol: number
  /** Seed for Mulberry32 PRNG used in initialization. */
  seed: number
  /** Floor on emission variance to avoid zero / underflow. Default 1e-6. */
  minVariance?: number
}

export type HmmModel = {
  nStates: number
  /** Initial state distribution π[i]. */
  startProb: number[]
  /** Transition matrix A[i][j] = P(q_{t+1}=j | q_t=i). */
  transProb: number[][]
  /** Gaussian means μ[i]. */
  means: number[]
  /** Gaussian variances σ²[i]. */
  variances: number[]
}

/** Result of training + Viterbi on one 1D observation sequence. */
export type HmmFitResult = {
  settings: Required<HmmSettings>
  model: HmmModel
  /** Most likely state index per observation (Viterbi). */
  statePath: number[]
  /** Final average log-likelihood per observation (natural log). */
  logLikelihood: number
  /** EM iterations actually performed. */
  iterations: number
  converged: boolean
  observationCount: number
  /** Count of observations assigned to each state by Viterbi. */
  stateCounts: number[]
}

export type HmmWorkerRequest = {
  type: 'run'
  requestId: string
  observations: number[]
  settings: HmmSettings
}

export type HmmWorkerProgress = {
  type: 'progress'
  requestId: string
  iteration: number
  logLikelihood: number
}

export type HmmWorkerResult = {
  type: 'result'
  requestId: string
  result: HmmFitResult
}

export type HmmWorkerError = {
  type: 'error'
  requestId: string
  message: string
}

export type HmmWorkerResponse =
  | HmmWorkerProgress
  | HmmWorkerResult
  | HmmWorkerError

/**
 * Persisted HMM run metadata + outputs.
 * Stored under project.state.hmmRuns — never written into dataset.originalText.
 */
export type PersistedHmmRun = {
  id: string
  createdAt: string
  datasetId: string
  datasetFileName: string
  valueColumn: string
  /** Series filter used, or null if all / no series column. */
  seriesFilter: string | null
  settings: Required<HmmSettings>
  means: number[]
  variances: number[]
  startProb: number[]
  transProb: number[][]
  statePath: number[]
  stateCounts: number[]
  logLikelihood: number
  iterations: number
  converged: boolean
  observationCount: number
}

export const DEFAULT_HMM_SETTINGS: Required<HmmSettings> = {
  nStates: 2,
  maxIter: 100,
  tol: 1e-6,
  seed: 42,
  minVariance: 1e-6,
}

export function normalizeSettings(s: HmmSettings): Required<HmmSettings> {
  const nStates = Math.max(1, Math.floor(s.nStates))
  const maxIter = Math.max(1, Math.floor(s.maxIter))
  const tol = Number.isFinite(s.tol) && s.tol > 0 ? s.tol : DEFAULT_HMM_SETTINGS.tol
  const seed = Number.isFinite(s.seed) ? Math.floor(s.seed) >>> 0 : DEFAULT_HMM_SETTINGS.seed
  const minVariance =
    s.minVariance !== undefined && Number.isFinite(s.minVariance) && s.minVariance > 0
      ? s.minVariance
      : DEFAULT_HMM_SETTINGS.minVariance
  return { nStates, maxIter, tol, seed, minVariance }
}
