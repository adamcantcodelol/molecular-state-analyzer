import type { HmmSettings } from '../hmm/types'

/**
 * Persisted smFRET HMM run (Phase 10).
 * Stored under project.state.smfretHmmRuns — never written into dataset.originalText.
 *
 * Latent states are unsupervised statistical indices on E_FRET observations only.
 * They are NOT structural conformations, distances, or biophysical names.
 */
export type PersistedSmfretHmmRun = {
  id: string
  createdAt: string
  /** Always 'smfret' so these runs are distinguishable from generic hmmRuns. */
  source: 'smfret'
  /** Observation quantity used for the fit. Always E_FRET for this module. */
  observationKind: 'E_FRET'
  datasetId: string
  datasetFileName: string
  /** Column mapped as Value; treated as E_FRET in this panel. */
  valueColumn: string
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

export const SMFRET_OBSERVATION_KIND = 'E_FRET' as const
export const SMFRET_SOURCE = 'smfret' as const

export const SMFRET_DISCLAIMER =
  'E_FRET is a mapped numeric efficiency time series. Optional HMM latent states ' +
  'are unsupervised statistical indices on E_FRET only — not structural ' +
  'conformations, distances, or biophysical names.'
