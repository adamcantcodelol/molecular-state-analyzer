/**
 * 1D Gaussian-emission Hidden Markov Model.
 *
 * Algorithms:
 * - Baum–Welch (EM) with scaled forward–backward (Rabiner scaling)
 * - Viterbi decoding for the most likely state path
 *
 * Emissions: independent univariate Normal(μ_i, σ²_i) per latent state i.
 * Not a biophysical model — latent states are unsupervised clusters with Markov dynamics.
 */
import { logGaussian, logSumExp, mean, populationVariance } from './mathUtil'
import { mulberry32 } from './rng'
import {
  normalizeSettings,
  type HmmFitResult,
  type HmmModel,
  type HmmSettings,
} from './types'

function emptyModel(n: number): HmmModel {
  return {
    nStates: n,
    startProb: Array.from({ length: n }, () => 1 / n),
    transProb: Array.from({ length: n }, () =>
      Array.from({ length: n }, () => 1 / n),
    ),
    means: Array.from({ length: n }, () => 0),
    variances: Array.from({ length: n }, () => 1),
  }
}

/**
 * Seeded initialization:
 * - means at observation quantiles with tiny Mulberry32 jitter
 * - variances = max(globalVar / K, minVariance)
 * - sticky-ish transitions (0.8 self, rest uniform) — deterministic
 * - uniform start
 */
export function initializeModel(
  observations: number[],
  settings: Required<HmmSettings>,
): HmmModel {
  const { nStates, seed, minVariance } = settings
  const rng = mulberry32(seed)
  const model = emptyModel(nStates)
  const sorted = [...observations].sort((a, b) => a - b)
  const globalMu = mean(observations)
  const globalVar = Math.max(populationVariance(observations, globalMu), minVariance)

  for (let k = 0; k < nStates; k++) {
    const q = (k + 0.5) / nStates
    const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length))
    const jitter = (rng() - 0.5) * 1e-9 * Math.max(1, Math.abs(sorted[idx]!))
    model.means[k] = sorted[idx]! + jitter
    model.variances[k] = Math.max(globalVar / nStates, minVariance)
  }

  const stay = nStates === 1 ? 1 : 0.8
  const leave = nStates === 1 ? 0 : (1 - stay) / (nStates - 1)
  for (let i = 0; i < nStates; i++) {
    model.startProb[i] = 1 / nStates
    for (let j = 0; j < nStates; j++) {
      model.transProb[i]![j] = i === j ? stay : leave
    }
  }

  return model
}

function emissionLogProbs(
  observations: number[],
  model: HmmModel,
): number[][] {
  const T = observations.length
  const K = model.nStates
  const out: number[][] = Array.from({ length: T }, () => Array(K).fill(0))
  for (let t = 0; t < T; t++) {
    const x = observations[t]!
    for (let i = 0; i < K; i++) {
      out[t]![i] = logGaussian(x, model.means[i]!, model.variances[i]!)
    }
  }
  return out
}

/**
 * Scaled forward–backward (Rabiner).
 * Returns gamma[t][i], xiSum[i][j] (sum over t of xi), and average log-likelihood.
 */
function forwardBackward(
  observations: number[],
  model: HmmModel,
): {
  gamma: number[][]
  xiSum: number[][]
  avgLogLikelihood: number
} {
  const T = observations.length
  const K = model.nStates
  const logB = emissionLogProbs(observations, model)

  const logA: number[][] = model.transProb.map((row) =>
    row.map((p) => Math.log(Math.max(p, 1e-300))),
  )
  const logPi = model.startProb.map((p) => Math.log(Math.max(p, 1e-300)))

  // Scaled forward: alpha[t][i] = P(q_t=i | o_1..o_t) * scale factors absorbed
  const alpha: number[][] = Array.from({ length: T }, () => Array(K).fill(0))
  const c: number[] = Array(T).fill(0) // c[t] = 1 / sum_i alpha_hat[t][i]

  // t = 0
  {
    let sum = 0
    for (let i = 0; i < K; i++) {
      const v = Math.exp(logPi[i]! + logB[0]![i]!)
      alpha[0]![i] = v
      sum += v
    }
    c[0] = sum > 0 ? 1 / sum : 1
    for (let i = 0; i < K; i++) alpha[0]![i]! *= c[0]!
  }

  for (let t = 1; t < T; t++) {
    let sum = 0
    for (let j = 0; j < K; j++) {
      let s = 0
      for (let i = 0; i < K; i++) {
        s += alpha[t - 1]![i]! * model.transProb[i]![j]!
      }
      const v = s * Math.exp(logB[t]![j]!)
      alpha[t]![j] = v
      sum += v
    }
    c[t] = sum > 0 ? 1 / sum : 1
    for (let j = 0; j < K; j++) alpha[t]![j]! *= c[t]!
  }

  // Scaled backward
  const beta: number[][] = Array.from({ length: T }, () => Array(K).fill(0))
  for (let i = 0; i < K; i++) beta[T - 1]![i] = c[T - 1]!

  for (let t = T - 2; t >= 0; t--) {
    for (let i = 0; i < K; i++) {
      let s = 0
      for (let j = 0; j < K; j++) {
        s +=
          model.transProb[i]![j]! *
          Math.exp(logB[t + 1]![j]!) *
          beta[t + 1]![j]!
      }
      beta[t]![i] = s * c[t]!
    }
  }

  // gamma
  const gamma: number[][] = Array.from({ length: T }, () => Array(K).fill(0))
  for (let t = 0; t < T; t++) {
    let sum = 0
    for (let i = 0; i < K; i++) {
      gamma[t]![i] = alpha[t]![i]! * beta[t]![i]!
      // undo one scale: alpha*beta has c[t]^2 * true; standard: gamma = alpha*beta / c[t]
      // With Rabiner scaling where beta includes c[t], gamma_i = alpha_i * beta_i / c[t]
      // Actually common formulation: after scaling both with c, gamma = alpha * beta / sum(alpha*beta)
      sum += gamma[t]![i]!
    }
    if (sum > 0) {
      for (let i = 0; i < K; i++) gamma[t]![i]! /= sum
    }
  }

  // xi summed over t (unnormalized then use gamma for denom in M-step)
  const xiSum: number[][] = Array.from({ length: K }, () => Array(K).fill(0))
  for (let t = 0; t < T - 1; t++) {
    const denomParts: number[] = []
    for (let i = 0; i < K; i++) {
      for (let j = 0; j < K; j++) {
        denomParts.push(
          Math.log(Math.max(alpha[t]![i]!, 1e-300)) +
            logA[i]![j]! +
            logB[t + 1]![j]! +
            Math.log(Math.max(beta[t + 1]![j]!, 1e-300)),
        )
      }
    }
    const logDen = logSumExp(denomParts)
    for (let i = 0; i < K; i++) {
      for (let j = 0; j < K; j++) {
        const logXi =
          Math.log(Math.max(alpha[t]![i]!, 1e-300)) +
          logA[i]![j]! +
          logB[t + 1]![j]! +
          Math.log(Math.max(beta[t + 1]![j]!, 1e-300)) -
          logDen
        xiSum[i]![j]! += Math.exp(logXi)
      }
    }
  }

  // log P(O) = -sum log c[t]
  let logLik = 0
  for (let t = 0; t < T; t++) {
    logLik -= Math.log(Math.max(c[t]!, 1e-300))
  }
  const avgLogLikelihood = logLik / T

  return { gamma, xiSum, avgLogLikelihood }
}

function mStep(
  observations: number[],
  gamma: number[][],
  xiSum: number[][],
  minVariance: number,
): HmmModel {
  const T = observations.length
  const K = gamma[0]!.length
  const model = emptyModel(K)

  // π
  for (let i = 0; i < K; i++) {
    model.startProb[i] = gamma[0]![i]!
  }
  // renormalize start
  let piSum = 0
  for (let i = 0; i < K; i++) piSum += model.startProb[i]!
  if (piSum > 0) {
    for (let i = 0; i < K; i++) model.startProb[i]! /= piSum
  } else {
    for (let i = 0; i < K; i++) model.startProb[i] = 1 / K
  }

  // A
  for (let i = 0; i < K; i++) {
    let rowSum = 0
    for (let j = 0; j < K; j++) rowSum += xiSum[i]![j]!
    if (rowSum > 0) {
      for (let j = 0; j < K; j++) {
        model.transProb[i]![j] = xiSum[i]![j]! / rowSum
      }
    } else {
      for (let j = 0; j < K; j++) model.transProb[i]![j] = 1 / K
    }
  }

  // means & variances
  for (let i = 0; i < K; i++) {
    let wSum = 0
    let wx = 0
    for (let t = 0; t < T; t++) {
      const g = gamma[t]![i]!
      wSum += g
      wx += g * observations[t]!
    }
    const mu = wSum > 0 ? wx / wSum : 0
    model.means[i] = mu

    let wVar = 0
    for (let t = 0; t < T; t++) {
      const d = observations[t]! - mu
      wVar += gamma[t]![i]! * d * d
    }
    model.variances[i] = Math.max(wSum > 0 ? wVar / wSum : minVariance, minVariance)
  }

  return model
}

/** Viterbi (log space) — most likely state sequence. */
export function viterbi(observations: number[], model: HmmModel): number[] {
  const T = observations.length
  const K = model.nStates
  if (T === 0) return []

  const logA = model.transProb.map((row) =>
    row.map((p) => Math.log(Math.max(p, 1e-300))),
  )
  const logPi = model.startProb.map((p) => Math.log(Math.max(p, 1e-300)))
  const logB = emissionLogProbs(observations, model)

  const delta: number[][] = Array.from({ length: T }, () => Array(K).fill(-Infinity))
  const psi: number[][] = Array.from({ length: T }, () => Array(K).fill(0))

  for (let i = 0; i < K; i++) {
    delta[0]![i] = logPi[i]! + logB[0]![i]!
  }

  for (let t = 1; t < T; t++) {
    for (let j = 0; j < K; j++) {
      let best = -Infinity
      let bestI = 0
      for (let i = 0; i < K; i++) {
        const v = delta[t - 1]![i]! + logA[i]![j]!
        if (v > best) {
          best = v
          bestI = i
        }
      }
      delta[t]![j] = best + logB[t]![j]!
      psi[t]![j] = bestI
    }
  }

  const path = Array(T).fill(0) as number[]
  let bestLast = -Infinity
  let bestI = 0
  for (let i = 0; i < K; i++) {
    if (delta[T - 1]![i]! > bestLast) {
      bestLast = delta[T - 1]![i]!
      bestI = i
    }
  }
  path[T - 1] = bestI
  for (let t = T - 2; t >= 0; t--) {
    path[t] = psi[t + 1]![path[t + 1]!]!
  }
  return path
}

export type FitProgress = (iteration: number, logLikelihood: number) => void

/**
 * Baum–Welch training then Viterbi decoding.
 * Deterministic given observations + settings.seed and IEEE-754 arithmetic.
 */
export function fitGaussianHmm(
  observations: number[],
  settingsInput: HmmSettings,
  onProgress?: FitProgress,
): HmmFitResult {
  const settings = normalizeSettings(settingsInput)
  if (observations.length === 0) {
    throw new Error('HMM requires at least one finite observation.')
  }
  for (const x of observations) {
    if (!Number.isFinite(x)) {
      throw new Error('HMM observations must all be finite numbers.')
    }
  }
  if (settings.nStates > observations.length) {
    throw new Error(
      `nStates (${settings.nStates}) cannot exceed observation count (${observations.length}).`,
    )
  }

  let model = initializeModel(observations, settings)
  let prevLl = -Infinity
  let iterations = 0
  let converged = false
  let lastLl = -Infinity

  for (let iter = 1; iter <= settings.maxIter; iter++) {
    const { gamma, xiSum, avgLogLikelihood } = forwardBackward(observations, model)
    model = mStep(observations, gamma, xiSum, settings.minVariance)
    iterations = iter
    lastLl = avgLogLikelihood
    onProgress?.(iter, avgLogLikelihood)

    const denom = Math.max(Math.abs(avgLogLikelihood), 1e-12)
    const rel = Math.abs(avgLogLikelihood - prevLl) / denom
    if (iter > 1 && rel < settings.tol) {
      converged = true
      break
    }
    prevLl = avgLogLikelihood
  }

  const statePath = viterbi(observations, model)
  const stateCounts = Array.from({ length: settings.nStates }, () => 0)
  for (const s of statePath) {
    stateCounts[s]! += 1
  }

  return {
    settings,
    model,
    statePath,
    logLikelihood: lastLl,
    iterations,
    converged,
    observationCount: observations.length,
    stateCounts,
  }
}
