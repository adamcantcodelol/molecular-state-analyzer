/**
 * Moving-block bootstrap for 1D Gaussian HMM fits (Phase 6).
 *
 * Method (nonparametric moving block bootstrap, MBB):
 * - Observations are a time-ordered sequence of length T.
 * - Block length L defaults to max(1, floor(sqrt(T))) — preserves short-range
 *   dependence better than i.i.d. resampling; does not assume the fitted HMM
 *   is the true data-generating process (unlike parametric simulation).
 * - For each replicate b, draw starting indices uniformly with replacement,
 *   concatenate contiguous blocks of length L, truncate to T.
 *
 * Seeds (reproducible across engines with IEEE-754 + Mulberry32):
 * - User `seed` is the base.
 * - Resample RNG for replicate b (0-based): Mulberry32(seed + b + 1).
 * - HMM fit on every resample uses the *same* init seed = `seed` (identical
 *   Phase-4 initializeModel scheme). Variability is from the resampled series,
 *   not from different EM starts.
 *
 * Label-switching: before aggregating, permute each fit so means are sorted
 * ascending (state 0 = lowest μ). Transition rows/cols, π, variances, and
 * Viterbi occupancy fractions follow the same permutation.
 *
 * Outputs are statistical uncertainty summaries — not biophysical conformations.
 */
import { fitGaussianHmm } from './gaussianHmm'
import { mulberry32 } from './rng'
import {
  normalizeSettings,
  type BootstrapSettings,
  type BootstrapSummary,
  type HmmFitResult,
  type HmmModel,
  type HmmSettings,
  type ScalarSummary,
} from './types'

export const BOOTSTRAP_METHOD_ID = 'moving-block' as const

export const BOOTSTRAP_METHOD_DOC =
  'Moving block bootstrap (nonparametric): resample contiguous blocks of length L=max(1,⌊√T⌋) (or user L) with replacement; concatenate and truncate to T. Fit Gaussian HMM (same K, same init seed) on each resample. Align states by sorting means ascending before aggregating.'

export function defaultBlockLength(T: number): number {
  const t = Math.max(0, Math.floor(T))
  if (t <= 1) return 1
  return Math.max(1, Math.floor(Math.sqrt(t)))
}

export function normalizeBootstrapSettings(
  s: BootstrapSettings,
): Required<BootstrapSettings> {
  const hmm = normalizeSettings(s)
  const nBoot = Math.max(1, Math.floor(s.nBoot))
  const blockLength =
    s.blockLength !== undefined && Number.isFinite(s.blockLength) && s.blockLength >= 1
      ? Math.floor(s.blockLength)
      : 0 // 0 → compute from T at run time
  return { ...hmm, nBoot, blockLength }
}

/** Draw one MBB resample of length T. */
export function resampleMovingBlock(
  observations: number[],
  blockLength: number,
  rng: () => number,
): number[] {
  const T = observations.length
  const L = Math.max(1, Math.min(Math.floor(blockLength), T))
  if (T === 0) return []
  if (L >= T) {
    // Single-block case: still allow wrapping? Standard MBB uses circular or
    // only starts in [0, T-L]. We use non-circular starts in [0, T-L].
    const start = Math.floor(rng() * 1) // always 0 when L===T
    void start
    return observations.slice()
  }
  const maxStart = T - L
  const out: number[] = []
  while (out.length < T) {
    const start = Math.floor(rng() * (maxStart + 1))
    for (let i = 0; i < L && out.length < T; i++) {
      out.push(observations[start + i]!)
    }
  }
  return out
}

/**
 * Permutation that sorts means ascending (stable on ties by original index).
 */
export function meanSortPermutation(means: number[]): number[] {
  return means
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (a.m === b.m ? a.i - b.i : a.m - b.m))
    .map((x) => x.i)
}

export function alignModelByMeanSort(model: HmmModel): {
  model: HmmModel
  permutation: number[]
} {
  const perm = meanSortPermutation(model.means)
  const K = model.nStates
  const means = perm.map((i) => model.means[i]!)
  const variances = perm.map((i) => model.variances[i]!)
  const startProb = perm.map((i) => model.startProb[i]!)
  const transProb: number[][] = Array.from({ length: K }, (_, ii) =>
    Array.from({ length: K }, (_, jj) => model.transProb[perm[ii]!]![perm[jj]!]!),
  )
  return {
    model: { nStates: K, means, variances, startProb, transProb },
    permutation: perm,
  }
}

export function alignedOccupancies(
  stateCounts: number[],
  permutation: number[],
  n: number,
): number[] {
  const denom = n > 0 ? n : 1
  return permutation.map((i) => (stateCounts[i] ?? 0) / denom)
}

function summarize(values: number[]): ScalarSummary {
  const n = values.length
  if (n === 0) {
    return { mean: NaN, sd: NaN, p2_5: NaN, p50: NaN, p97_5: NaN }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((s, x) => s + x, 0) / n
  let varSum = 0
  for (const x of values) {
    const d = x - mean
    varSum += d * d
  }
  const sd = n > 1 ? Math.sqrt(varSum / (n - 1)) : 0
  const quantile = (p: number) => {
    if (n === 1) return sorted[0]!
    const idx = (n - 1) * p
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    if (lo === hi) return sorted[lo]!
    const w = idx - lo
    return sorted[lo]! * (1 - w) + sorted[hi]! * w
  }
  return {
    mean,
    sd,
    p2_5: quantile(0.025),
    p50: quantile(0.5),
    p97_5: quantile(0.975),
  }
}

export type BootstrapProgress = (
  done: number,
  total: number,
  detail?: { iteration?: number; logLikelihood?: number },
) => void

/**
 * Point fit on original data + B bootstrap refits with MBB resamples.
 */
export function runHmmBootstrap(
  observations: number[],
  settingsInput: BootstrapSettings,
  onProgress?: BootstrapProgress,
): BootstrapSummary {
  if (observations.length === 0) {
    throw new Error('Bootstrap requires at least one finite observation.')
  }
  for (const x of observations) {
    if (!Number.isFinite(x)) {
      throw new Error('Bootstrap observations must all be finite numbers.')
    }
  }

  const settings = normalizeBootstrapSettings(settingsInput)
  const T = observations.length
  const blockLength =
    settings.blockLength > 0 ? Math.min(settings.blockLength, T) : defaultBlockLength(T)
  const K = settings.nStates
  const hmmSettings: HmmSettings = {
    nStates: K,
    maxIter: settings.maxIter,
    tol: settings.tol,
    seed: settings.seed,
    minVariance: settings.minVariance,
  }

  const pointFit = fitGaussianHmm(observations, hmmSettings)
  const pointAligned = alignModelByMeanSort(pointFit.model)
  const pointOcc = alignedOccupancies(
    pointFit.stateCounts,
    pointAligned.permutation,
    pointFit.observationCount,
  )

  const meansBoot: number[][] = Array.from({ length: K }, () => [])
  const occBoot: number[][] = Array.from({ length: K }, () => [])
  const transBoot: number[][][] = Array.from({ length: K }, () =>
    Array.from({ length: K }, () => [] as number[]),
  )
  let convergedCount = 0

  for (let b = 0; b < settings.nBoot; b++) {
    const rng = mulberry32((settings.seed + b + 1) >>> 0)
    const sample = resampleMovingBlock(observations, blockLength, rng)
    const fit = fitGaussianHmm(sample, hmmSettings, (iteration, logLikelihood) => {
      onProgress?.(b, settings.nBoot, { iteration, logLikelihood })
    })
    if (fit.converged) convergedCount += 1

    const { model, permutation } = alignModelByMeanSort(fit.model)
    const occ = alignedOccupancies(fit.stateCounts, permutation, fit.observationCount)

    for (let i = 0; i < K; i++) {
      meansBoot[i]!.push(model.means[i]!)
      occBoot[i]!.push(occ[i]!)
      for (let j = 0; j < K; j++) {
        transBoot[i]![j]!.push(model.transProb[i]![j]!)
      }
    }
    onProgress?.(b + 1, settings.nBoot)
  }

  return {
    method: BOOTSTRAP_METHOD_ID,
    methodDoc: BOOTSTRAP_METHOD_DOC,
    settings: { ...settings, blockLength },
    observationCount: T,
    blockLength,
    nBoot: settings.nBoot,
    labelAlign: 'sort-means-asc',
    seedScheme:
      'resample RNG = Mulberry32(seed+b+1); HMM init seed = seed (fixed across replicates)',
    pointEstimate: {
      means: pointAligned.model.means,
      variances: pointAligned.model.variances,
      startProb: pointAligned.model.startProb,
      transProb: pointAligned.model.transProb,
      occupancies: pointOcc,
      logLikelihood: pointFit.logLikelihood,
      iterations: pointFit.iterations,
      converged: pointFit.converged,
    },
    means: meansBoot.map(summarize),
    occupancies: occBoot.map(summarize),
    transitions: transBoot.map((row) => row.map(summarize)),
    convergedCount,
    replicateConvergedFraction: convergedCount / settings.nBoot,
  }
}

/** Expose point-fit alignment helper for tests. */
export function alignFitByMeanSort(fit: HmmFitResult): {
  means: number[]
  occupancies: number[]
  transProb: number[][]
} {
  const { model, permutation } = alignModelByMeanSort(fit.model)
  return {
    means: model.means,
    occupancies: alignedOccupancies(
      fit.stateCounts,
      permutation,
      fit.observationCount,
    ),
    transProb: model.transProb,
  }
}
