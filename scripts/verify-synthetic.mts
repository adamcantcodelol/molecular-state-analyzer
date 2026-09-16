/**
 * Phase 7: verify seeded synthetic HMM generator reproducibility.
 * Same seed + params → bit-identical CSV / path / emissions.
 */
import {
  defaultSynthParams,
  generateHmmSeries,
} from '../src/synth/generateHmmSeries.ts'

const params = defaultSynthParams()
const a = generateHmmSeries(params)
const b = generateHmmSeries(params)
const c = generateHmmSeries({ ...params, seed: 99 })

const sameCsv = a.csv === b.csv
const sameJson = a.json === b.json
const samePath = a.trueState.every((s, i) => s === b.trueState[i])
const sameValues = a.value.every((v, i) => Object.is(v, b.value[i]))
const diffSeedDiffers =
  a.csv !== c.csv &&
  !a.trueState.every((s, i) => s === c.trueState[i])

// Sticky transitions: fraction of consecutive equal states should be high
let stays = 0
for (let i = 1; i < a.trueState.length; i++) {
  if (a.trueState[i] === a.trueState[i - 1]) stays++
}
const stayFrac = stays / (a.trueState.length - 1)

// Emissions near ground-truth means within each state
const byState: number[][] = Array.from({ length: params.nStates }, () => [])
for (let i = 0; i < a.value.length; i++) {
  byState[a.trueState[i]!]!.push(a.value[i]!)
}
const meanOk = byState.every((vals, k) => {
  if (vals.length === 0) return false
  const m = vals.reduce((s, x) => s + x, 0) / vals.length
  return Math.abs(m - params.means[k]!) < 1.5
})

const markedSynthetic =
  a.json.includes('"synthetic": true') &&
  a.json.includes('SYNTHETIC') &&
  a.csv.startsWith('time,value,series,true_state')

const fingerprint = {
  length: a.params.length,
  nStates: a.params.nStates,
  seed: a.params.seed,
  pathHead: a.trueState.slice(0, 20),
  valueHead: a.value.slice(0, 5),
  stayFrac,
}

const ok =
  sameCsv &&
  sameJson &&
  samePath &&
  sameValues &&
  diffSeedDiffers &&
  stayFrac > 0.7 &&
  meanOk &&
  markedSynthetic

console.log(
  JSON.stringify(
    {
      ok,
      sameCsv,
      sameJson,
      samePath,
      sameValues,
      diffSeedDiffers,
      stayFrac,
      meanOk,
      markedSynthetic,
      fingerprint,
    },
    null,
    2,
  ),
)

if (!ok) {
  console.error('verify:synthetic FAILED')
  process.exit(1)
}
console.log('verify:synthetic PASSED')
