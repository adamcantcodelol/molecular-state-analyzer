/**
 * Seeded synthetic 1D Gaussian-HMM time series with known ground-truth path.
 * For testing / verification only — outputs must be labeled SYNTHETIC in the UI.
 * Never present as experimental or real data.
 */
import { mulberry32 } from '../hmm/rng'

export type SynthHmmParams = {
  seed: number
  length: number
  nStates: number
  means: number[]
  variances: number[]
  /** Self-transition probability (sticky); off-diagonal share the remainder equally. */
  stayProb: number
}

export type SynthHmmSeries = {
  time: number[]
  value: number[]
  trueState: number[]
  series: string
  params: Required<SynthHmmParams>
  csv: string
  json: string
}

/** Box–Muller transform using two Mulberry32 draws → N(0,1). */
function gaussian(rng: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * Sticky transition: P(stay) = stayProb; remaining mass split uniformly
 * across the other states. Reuses the stay draw residual so one RNG call
 * covers both stay vs leave and which leave target.
 */
function nextState(
  rng: () => number,
  state: number,
  nStates: number,
  stayProb: number,
): number {
  if (nStates <= 1) return 0
  const u = rng()
  if (u < stayProb) return state
  const denom = 1 - stayProb
  const r = denom > 0 ? (u - stayProb) / denom : 0
  const others: number[] = []
  for (let j = 0; j < nStates; j++) {
    if (j !== state) others.push(j)
  }
  const idx = Math.min(others.length - 1, Math.floor(r * others.length))
  return others[idx]!
}

export function normalizeParams(p: SynthHmmParams): Required<SynthHmmParams> {
  const nStates = Math.max(1, Math.floor(p.nStates))
  const length = Math.max(2, Math.floor(p.length))
  const seed = Number.isFinite(p.seed) ? Math.floor(p.seed) >>> 0 : 42
  const stayProb =
    Number.isFinite(p.stayProb) && p.stayProb >= 0 && p.stayProb <= 1
      ? p.stayProb
      : 0.9
  const means = Array.from({ length: nStates }, (_, i) =>
    Number.isFinite(p.means[i]!) ? p.means[i]! : i * 5,
  )
  const variances = Array.from({ length: nStates }, (_, i) => {
    const v = p.variances[i]
    return Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0.25
  })
  return { seed, length, nStates, means, variances, stayProb }
}

export function generateHmmSeries(params: SynthHmmParams): SynthHmmSeries {
  const p = normalizeParams(params)
  const rng = mulberry32(p.seed)

  // Start state from uniform draw over [0, K)
  let state = Math.min(p.nStates - 1, Math.floor(rng() * p.nStates))
  const time: number[] = []
  const value: number[] = []
  const trueState: number[] = []

  for (let t = 0; t < p.length; t++) {
    const mu = p.means[state]!
    const sd = Math.sqrt(p.variances[state]!)
    const y = mu + sd * gaussian(rng)
    time.push(t)
    value.push(y)
    trueState.push(state)
    state = nextState(rng, state, p.nStates, p.stayProb)
  }

  const series = 'synthetic'
  const header = 'time,value,series,true_state'
  const rows = time.map(
    (t, i) => `${t},${value[i]},${series},${trueState[i]}`,
  )
  const csv = [header, ...rows].join('\n') + '\n'
  const json = JSON.stringify(
    {
      synthetic: true,
      warning:
        'SYNTHETIC data with known ground-truth true_state — not experimental.',
      params: p,
      records: time.map((t, i) => ({
        time: t,
        value: value[i],
        series,
        true_state: trueState[i],
      })),
    },
    null,
    2,
  )

  return { time, value, trueState, series, params: p, csv, json }
}

export function defaultSynthParams(): SynthHmmParams {
  return {
    seed: 42,
    length: 120,
    nStates: 2,
    means: [0, 5],
    variances: [0.25, 0.25],
    stayProb: 0.9,
  }
}
