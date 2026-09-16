/**
 * Read-only helpers that turn persisted analysis runs into dashboard rows.
 * Never mutate project.state or dataset originals.
 */
import {
  getHmmBootstraps,
  getHmmComparisons,
  getHmmRuns,
} from '../hmm/persist'
import type {
  PersistedHmmBootstrap,
  PersistedHmmComparison,
  PersistedHmmRun,
  ScalarSummary,
} from '../hmm/types'
import { getSmfretHmmRuns } from '../smfret/persist'
import type { PersistedSmfretHmmRun } from '../smfret/types'
import type { Project } from '../types/project'

export type StatsSourceModule =
  | 'HMM'
  | 'AIC/BIC'
  | 'Bootstrap'
  | 'smFRET HMM'

export type StatsRowKind =
  | 'hmmRun'
  | 'hmmComparison'
  | 'hmmBootstrap'
  | 'smfretHmmRun'

/** Unified, display-oriented row for the statistics dashboard. */
export type StatsSummaryRow = {
  id: string
  kind: StatsRowKind
  sourceModule: StatsSourceModule
  createdAt: string
  datasetName: string
  datasetId: string
  /** Human-readable settings snippet (seed, K, …). */
  settingsSnippet: string
  /** Key numeric metrics without biophysical claims. */
  metricsSnippet: string
  /** Extra provenance notes (value column, series filter, observation kind). */
  provenanceNotes: string
}

function fmt(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return String(n)
  return n.toPrecision(digits)
}

function fmtMeanSd(s: ScalarSummary, digits = 4): string {
  return `${fmt(s.mean, digits)}±${fmt(s.sd, digits)}`
}

function seriesNote(seriesFilter: string | null): string {
  if (seriesFilter == null) return 'series: all / none'
  return `series: ${seriesFilter}`
}

function hmmRunRow(r: PersistedHmmRun): StatsSummaryRow {
  const s = r.settings
  return {
    id: r.id,
    kind: 'hmmRun',
    sourceModule: 'HMM',
    createdAt: r.createdAt,
    datasetName: r.datasetFileName || '(unnamed)',
    datasetId: r.datasetId,
    settingsSnippet: `K=${s.nStates}, seed=${s.seed}, maxIter=${s.maxIter}, tol=${s.tol}`,
    metricsSnippet: `avg LL=${fmt(r.logLikelihood, 6)}; means=[${r.means.map((m) => fmt(m, 4)).join(', ')}]; iters=${r.iterations}${r.converged ? '' : ' (maxIter*)'}; n=${r.observationCount}`,
    provenanceNotes: `value=${r.valueColumn || '—'}; ${seriesNote(r.seriesFilter)}; state=project.state.hmmRuns`,
  }
}

function comparisonRow(c: PersistedHmmComparison): StatsSummaryRow {
  const sh = c.shared
  const anyNonConv = c.models.some((m) => !m.converged)
  return {
    id: c.id,
    kind: 'hmmComparison',
    sourceModule: 'AIC/BIC',
    createdAt: c.createdAt,
    datasetName: c.datasetFileName || '(unnamed)',
    datasetId: c.datasetId,
    settingsSnippet: `K∈{2,3}, seed=${sh.seed}, maxIter=${sh.maxIter}, tol=${sh.tol}`,
    metricsSnippet: `prefer AIC→K=${c.preferAic}, BIC→K=${c.preferBic}${anyNonConv ? ' (provisional: non-converged fit)' : ''}; n=${sh.observationCount}`,
    provenanceNotes: `value=${c.valueColumn || '—'}; ${seriesNote(c.seriesFilter)}; state=project.state.hmmComparisons — IC “prefer” ≠ biophysical truth`,
  }
}

function bootstrapRow(b: PersistedHmmBootstrap): StatsSummaryRow {
  const sum = b.summary
  const s = sum.settings
  const meanSnips = sum.means
    .slice(0, 4)
    .map((m, i) => `μ${i}=${fmtMeanSd(m)}`)
    .join(', ')
  const more =
    sum.means.length > 4 ? ` (+${sum.means.length - 4} states)` : ''
  return {
    id: b.id,
    kind: 'hmmBootstrap',
    sourceModule: 'Bootstrap',
    createdAt: b.createdAt,
    datasetName: b.datasetFileName || '(unnamed)',
    datasetId: b.datasetId,
    settingsSnippet: `K=${s.nStates}, seed=${s.seed}, B=${sum.nBoot}, L=${sum.blockLength}, method=${sum.method}`,
    metricsSnippet: `means mean±SD: ${meanSnips || '—'}${more}; conv ${sum.convergedCount}/${sum.nBoot}; n=${sum.observationCount}`,
    provenanceNotes: `value=${b.valueColumn || '—'}; ${seriesNote(b.seriesFilter)}; labelAlign=${sum.labelAlign}; state=project.state.hmmBootstraps`,
  }
}

function smfretRow(r: PersistedSmfretHmmRun): StatsSummaryRow {
  const s = r.settings
  return {
    id: r.id,
    kind: 'smfretHmmRun',
    sourceModule: 'smFRET HMM',
    createdAt: r.createdAt,
    datasetName: r.datasetFileName || '(unnamed)',
    datasetId: r.datasetId,
    settingsSnippet: `K=${s.nStates}, seed=${s.seed}, maxIter=${s.maxIter}, obs=${r.observationKind}`,
    metricsSnippet: `E_FRET HMM means=[${r.means.map((m) => fmt(m, 4)).join(', ')}]; avg LL=${fmt(r.logLikelihood, 6)}; iters=${r.iterations}${r.converged ? '' : ' (maxIter*)'}; n=${r.observationCount}`,
    provenanceNotes: `source=${r.source}; value=${r.valueColumn || '—'}; ${seriesNote(r.seriesFilter)}; state=project.state.smfretHmmRuns — means are statistical on E_FRET, not structural`,
  }
}

export type StatsDashboardSummary = {
  hmmRuns: StatsSummaryRow[]
  hmmComparisons: StatsSummaryRow[]
  hmmBootstraps: StatsSummaryRow[]
  smfretHmmRuns: StatsSummaryRow[]
  /** All rows newest-first by createdAt (stable within ties by id). */
  allRows: StatsSummaryRow[]
  totalCount: number
}

function byNewest(a: StatsSummaryRow, b: StatsSummaryRow): number {
  const ta = Date.parse(a.createdAt)
  const tb = Date.parse(b.createdAt)
  if (Number.isFinite(tb) && Number.isFinite(ta) && tb !== ta) return tb - ta
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

/**
 * Build a read-only summary of persisted analysis runs from project.state.
 * Does not clone or mutate the project.
 */
export function summarizeProjectStats(project: Project): StatsDashboardSummary {
  const hmmRuns = getHmmRuns(project).map(hmmRunRow)
  const hmmComparisons = getHmmComparisons(project).map(comparisonRow)
  const hmmBootstraps = getHmmBootstraps(project).map(bootstrapRow)
  const smfretHmmRuns = getSmfretHmmRuns(project).map(smfretRow)
  const allRows = [
    ...hmmRuns,
    ...hmmComparisons,
    ...hmmBootstraps,
    ...smfretHmmRuns,
  ].sort(byNewest)
  return {
    hmmRuns,
    hmmComparisons,
    hmmBootstraps,
    smfretHmmRuns,
    allRows,
    totalCount: allRows.length,
  }
}
