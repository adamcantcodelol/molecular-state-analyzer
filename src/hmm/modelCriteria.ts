/**
 * Information criteria for comparing Gaussian HMMs.
 *
 * Free-parameter count for a K-state 1D Gaussian HMM:
 *   k = K means + K variances + K(K-1) free transitions + (K-1) free π
 *     = 2K + K(K-1) + (K-1)
 *     = K² + 2K - 1
 *
 * Log-likelihood L is the *total* log-likelihood (sum over observations).
 * Our fit reports average LL per obs, so L = avgLL * N.
 *
 *   AIC = 2k - 2L
 *   BIC = k * ln(N) - 2L
 *
 * Lower AIC/BIC is preferred. States remain statistical indices only.
 */
import { fitGaussianHmm } from './gaussianHmm'
import { normalizeSettings, type HmmFitResult, type HmmSettings } from './types'

export function freeParameterCount(nStates: number): number {
  const K = Math.max(1, Math.floor(nStates))
  return K * K + 2 * K - 1
}

export function totalLogLikelihood(fit: HmmFitResult): number {
  return fit.logLikelihood * fit.observationCount
}

export function aic(k: number, totalLL: number): number {
  return 2 * k - 2 * totalLL
}

export function bic(k: number, n: number, totalLL: number): number {
  return k * Math.log(n) - 2 * totalLL
}

export type ModelScore = {
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
  fit: HmmFitResult
}

export type ModelComparison = {
  settingsBase: Omit<Required<HmmSettings>, 'nStates'> & { nStatesIgnored: true }
  shared: {
    seed: number
    maxIter: number
    tol: number
    minVariance: number
    observationCount: number
  }
  models: [ModelScore, ModelScore] // 2-state, 3-state
  preferAic: 2 | 3
  preferBic: 2 | 3
  freeParamFormula: string
}

function scoreFit(fit: HmmFitResult): ModelScore {
  const k = freeParameterCount(fit.model.nStates)
  const n = fit.observationCount
  const L = totalLogLikelihood(fit)
  return {
    nStates: fit.model.nStates,
    freeParams: k,
    observationCount: n,
    avgLogLikelihood: fit.logLikelihood,
    totalLogLikelihood: L,
    aic: aic(k, L),
    bic: bic(k, n, L),
    iterations: fit.iterations,
    converged: fit.converged,
    means: [...fit.model.means],
    fit,
  }
}

/**
 * Fit K=2 and K=3 on the same observations with the same seed/maxIter/tol/minVariance.
 */
export function compareTwoVsThree(
  observations: number[],
  settings: Omit<HmmSettings, 'nStates'> & { nStates?: number },
  onProgress?: (nStates: number, iteration: number, avgLL: number) => void,
): ModelComparison {
  const base = normalizeSettings({ ...settings, nStates: 2 })
  const shared = {
    seed: base.seed,
    maxIter: base.maxIter,
    tol: base.tol,
    minVariance: base.minVariance,
  }

  const fit2 = fitGaussianHmm(
    observations,
    { ...shared, nStates: 2 },
    (iteration, logLikelihood) => onProgress?.(2, iteration, logLikelihood),
  )
  const fit3 = fitGaussianHmm(
    observations,
    { ...shared, nStates: 3 },
    (iteration, logLikelihood) => onProgress?.(3, iteration, logLikelihood),
  )

  const m2 = scoreFit(fit2)
  const m3 = scoreFit(fit3)

  return {
    settingsBase: { ...shared, nStatesIgnored: true },
    shared: { ...shared, observationCount: fit2.observationCount },
    models: [m2, m3],
    preferAic: m2.aic <= m3.aic ? 2 : 3,
    preferBic: m2.bic <= m3.bic ? 2 : 3,
    freeParamFormula: 'k = K² + 2K - 1  (means + vars + free A + free π)',
  }
}
