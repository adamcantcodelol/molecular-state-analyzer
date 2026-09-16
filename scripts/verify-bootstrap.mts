/**
 * Phase 6 bootstrap verify — deterministic moving-block bootstrap on fixture.
 *
 * Expectations (seed=42, nBoot=10, nStates=2, maxIter=100, tol=1e-6, auto L):
 * - Two identical runs → same summaries (JSON-equal fingerprints)
 * - States aligned by ascending means (state 0 mean < state 1 mean)
 * - Block length = floor(sqrt(T)) for T=120 → 10
 * - Means near the two-state fixture levels (~0 and ~5)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  alignModelByMeanSort,
  defaultBlockLength,
  meanSortPermutation,
  resampleMovingBlock,
  runHmmBootstrap,
} from '../src/hmm/bootstrap.ts'
import { mulberry32 } from '../src/hmm/rng.ts'

const csvPath = resolve('fixtures/hmm_two_state.csv')
const text = readFileSync(csvPath, 'utf8')
const lines = text.trim().split(/\n/).slice(1)
const values = lines
  .map((l) => Number(l.split(',')[1]))
  .filter((v) => Number.isFinite(v))

const T = values.length
const L = defaultBlockLength(T)
if (L !== Math.floor(Math.sqrt(T))) {
  console.error('defaultBlockLength mismatch', L, Math.floor(Math.sqrt(T)))
  process.exit(10)
}

// Resample determinism
const r1 = resampleMovingBlock(values, L, mulberry32(43))
const r2 = resampleMovingBlock(values, L, mulberry32(43))
if (JSON.stringify(r1) !== JSON.stringify(r2)) {
  console.error('resample not deterministic')
  process.exit(11)
}
if (r1.length !== T) {
  console.error('resample length', r1.length, T)
  process.exit(12)
}

// Label-switch alignment
const perm = meanSortPermutation([5, 1, 3])
if (JSON.stringify(perm) !== JSON.stringify([1, 2, 0])) {
  console.error('meanSortPermutation unexpected', perm)
  process.exit(13)
}
const aligned = alignModelByMeanSort({
  nStates: 2,
  means: [4.9, 0.1],
  variances: [1, 2],
  startProb: [0.2, 0.8],
  transProb: [
    [0.7, 0.3],
    [0.1, 0.9],
  ],
})
if (!(aligned.model.means[0]! < aligned.model.means[1]!)) {
  console.error('align means not sorted', aligned.model.means)
  process.exit(14)
}
if (aligned.model.variances[0] !== 2 || aligned.model.variances[1] !== 1) {
  console.error('align variances not permuted', aligned.model.variances)
  process.exit(15)
}

const settings = {
  nStates: 2,
  nBoot: 10,
  maxIter: 100,
  tol: 1e-6,
  seed: 42,
}

const a = runHmmBootstrap(values, settings)
const b = runHmmBootstrap(values, settings)

function fingerprint(s: typeof a) {
  return {
    method: s.method,
    blockLength: s.blockLength,
    nBoot: s.nBoot,
    labelAlign: s.labelAlign,
    pointMeans: s.pointEstimate.means,
    pointOcc: s.pointEstimate.occupancies,
    means: s.means,
    occupancies: s.occupancies,
    transitions: s.transitions,
    convergedCount: s.convergedCount,
  }
}

const fa = fingerprint(a)
const fb = fingerprint(b)
const same = JSON.stringify(fa) === JSON.stringify(fb)

const meansSorted =
  a.pointEstimate.means[0]! <= a.pointEstimate.means[1]! &&
  a.means[0]!.mean <= a.means[1]!.mean

const meansNearFixture =
  Math.abs(a.means[0]!.mean) < 1.5 && Math.abs(a.means[1]!.mean - 5) < 1.5

console.log(
  JSON.stringify(
    {
      T,
      L: a.blockLength,
      same,
      meansSorted,
      meansNearFixture,
      pointMeans: a.pointEstimate.means,
      bootMeans: a.means.map((m) => ({
        mean: m.mean,
        sd: m.sd,
        p2_5: m.p2_5,
        p97_5: m.p97_5,
      })),
      bootOcc: a.occupancies.map((m) => ({
        mean: m.mean,
        sd: m.sd,
      })),
      convergedCount: a.convergedCount,
      seedScheme: a.seedScheme,
      method: a.method,
    },
    null,
    2,
  ),
)

if (!same) process.exit(1)
if (a.blockLength !== 10) process.exit(2)
if (!meansSorted) process.exit(3)
if (!meansNearFixture) process.exit(4)
if (a.nBoot !== 10) process.exit(5)
