import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compareTwoVsThree, freeParameterCount } from '../src/hmm/modelCriteria.ts'

const csvPath = resolve('fixtures/hmm_two_state.csv')
const text = readFileSync(csvPath, 'utf8')
const lines = text.trim().split(/\n/).slice(1)
const values = lines
  .map((l) => Number(l.split(',')[1]))
  .filter((v) => Number.isFinite(v))

const cmp = compareTwoVsThree(values, { maxIter: 100, tol: 1e-6, seed: 42 })
const cmp2 = compareTwoVsThree(values, { maxIter: 100, tol: 1e-6, seed: 42 })

const same =
  cmp.models[0]!.aic === cmp2.models[0]!.aic &&
  cmp.models[1]!.aic === cmp2.models[1]!.aic &&
  cmp.models[0]!.bic === cmp2.models[0]!.bic &&
  cmp.models[1]!.bic === cmp2.models[1]!.bic &&
  cmp.preferAic === cmp2.preferAic &&
  cmp.preferBic === cmp2.preferBic

console.log(
  JSON.stringify(
    {
      n: values.length,
      k2: freeParameterCount(2),
      k3: freeParameterCount(3),
      formula: cmp.freeParamFormula,
      models: cmp.models.map((m) => ({
        nStates: m.nStates,
        freeParams: m.freeParams,
        avgLL: m.avgLogLikelihood,
        totalLL: m.totalLogLikelihood,
        aic: m.aic,
        bic: m.bic,
        means: m.means,
        converged: m.converged,
        iterations: m.iterations,
      })),
      preferAic: cmp.preferAic,
      preferBic: cmp.preferBic,
      same,
    },
    null,
    2,
  ),
)

if (!same) process.exit(1)
if (freeParameterCount(2) !== 7) process.exit(2)
if (freeParameterCount(3) !== 14) process.exit(3)
