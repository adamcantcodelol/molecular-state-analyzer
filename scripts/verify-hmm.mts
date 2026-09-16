import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fitGaussianHmm } from '../src/hmm/gaussianHmm.ts'

const csvPath = resolve('fixtures/hmm_two_state.csv')
const text = readFileSync(csvPath, 'utf8')
const lines = text.trim().split(/\n/).slice(1)
const values = lines.map((l) => Number(l.split(',')[1]))

const settings = { nStates: 2, maxIter: 100, tol: 1e-6, seed: 42 }
const a = fitGaussianHmm(values, settings)
const b = fitGaussianHmm(values, settings)

function fingerprint(r: typeof a) {
  return {
    iterations: r.iterations,
    converged: r.converged,
    ll: r.logLikelihood,
    means: r.model.means,
    variances: r.model.variances,
    startProb: r.model.startProb,
    transProb: r.model.transProb,
    stateCounts: r.stateCounts,
    pathHead: r.statePath.slice(0, 20),
    pathTail: r.statePath.slice(-10),
  }
}

const fa = fingerprint(a)
const fb = fingerprint(b)
const same = JSON.stringify(fa) === JSON.stringify(fb)
console.log(JSON.stringify({ same, result: fa }, null, 2))

const c = fitGaussianHmm(values, { ...settings, seed: 99 })
console.log('seed42_vs_99_means', a.model.means, c.model.means)
console.log('path_equal_same_seed', a.statePath.every((s, i) => s === b.statePath[i]))
console.log('path_equal_diff_seed', a.statePath.every((s, i) => s === c.statePath[i]))
