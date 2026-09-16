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

/** Shared seed/settings; always fits nStates 2 and 3. */
export type HmmCompareRequest = {
  type: 'compare'
  requestId: string
  observations: number[]
  settings: Omit<HmmSettings, 'nStates'> & { nStates?: number }
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

export type HmmCompareProgress = {
  type: 'compare-progress'
  requestId: string
  nStates: number
  iteration: number
  logLikelihood: number
}

export type HmmCompareResultMsg = {
  type: 'compare-result'
  requestId: string
  /** Serializable comparison (fits included for means/LL). */
  comparison: {
    shared: {
      seed: number
      maxIter: number
      tol: number
      minVariance: number
      observationCount: number
    }
    models: Array<{
      nStates: number
      freeParams: number
      observationCount: number
      avgLogLikelihood: number
      totalLogLikelihood: number
      aic: number
      bic: number
      iterations: number
      converged: boolean
      means: number[]
    }>
    preferAic: 2 | 3
    preferBic: 2 | 3
    freeParamFormula: string
  }
}


/**
 * Persisted 2-vs-3 comparison (Phase 5). Never written into dataset.originalText.
 */
export type PersistedHmmComparison = {
  id: string
  createdAt: string
  datasetId: string
  datasetFileName: string
  valueColumn: string
  seriesFilter: string | null
  shared: {
    seed: number
    maxIter: number
    tol: number
    minVariance: number
    observationCount: number
  }
  models: Array<{
    nStates: number
    freeParams: number
    avgLogLikelihood: number
    totalLogLikelihood: number
    aic: number
    bic: number
    iterations: number
    converged: boolean
    means: number[]
  }>
  preferAic: 2 | 3
  preferBic: 2 | 3
  freeParamFormula: string
}

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

/** Settings for Phase 6 moving-block bootstrap. */
export type BootstrapSettings = HmmSettings & {
  /** Number of bootstrap replicates (≥ 1). */
  nBoot: number
  /**
   * Block length for moving-block bootstrap.
   * Omit or 0 → max(1, floor(sqrt(T))) at run time.
   */
  blockLength?: number
}

export type ScalarSummary = {
  mean: number
  sd: number
  p2_5: number
  p50: number
  p97_5: number
}

export type BootstrapSummary = {
  method: 'moving-block'
  methodDoc: string
  settings: Required<BootstrapSettings>
  observationCount: number
  blockLength: number
  nBoot: number
  labelAlign: 'sort-means-asc'
  seedScheme: string
  pointEstimate: {
    means: number[]
    variances: number[]
    startProb: number[]
    transProb: number[][]
    occupancies: number[]
    logLikelihood: number
    iterations: number
    converged: boolean
  }
  means: ScalarSummary[]
  occupancies: ScalarSummary[]
  transitions: ScalarSummary[][]
  convergedCount: number
  replicateConvergedFraction: number
}

export type HmmBootstrapRequest = {
  type: 'bootstrap'
  requestId: string
  observations: number[]
  settings: BootstrapSettings
}

export type HmmBootstrapProgress = {
  type: 'bootstrap-progress'
  requestId: string
  done: number
  total: number
  iteration?: number
  logLikelihood?: number
}

export type HmmBootstrapResultMsg = {
  type: 'bootstrap-result'
  requestId: string
  summary: BootstrapSummary
}

/**
 * Persisted bootstrap run (Phase 6). Never written into dataset.originalText.
 */
export type PersistedHmmBootstrap = {
  id: string
  createdAt: string
  datasetId: string
  datasetFileName: string
  valueColumn: string
  seriesFilter: string | null
  summary: BootstrapSummary
}

export const DEFAULT_BOOTSTRAP_SETTINGS: Required<BootstrapSettings> = {
  ...DEFAULT_HMM_SETTINGS,
  nBoot: 20,
  blockLength: 0,
}

export type HmmWorkerResponse =
  | HmmWorkerProgress
  | HmmWorkerResult
  | HmmWorkerError
  | HmmCompareProgress
  | HmmCompareResultMsg
  | HmmBootstrapProgress
  | HmmBootstrapResultMsg
