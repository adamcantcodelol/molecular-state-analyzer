import {
  asFiniteNumber,
  isMissing,
  loadTabularTable,
  roleColumns,
} from '../data/tabular'
import type { ImportedDataset } from '../types/dataset'

export type ObservationExtract = {
  /** Finite 1D values in time order (or file order if no time column). */
  values: number[]
  /** Parallel time stamps when a time column exists; otherwise index. */
  times: number[]
  skippedMissing: number
  skippedNonFinite: number
  notes: string[]
}

/**
 * Build a 1D observation sequence from a committed dataset.
 * Does not mutate dataset.originalText — re-parses a derived view only.
 */
export function extractObservations(
  dataset: ImportedDataset,
  valueColumn: string,
  seriesFilter: string | null,
): ObservationExtract {
  const table = loadTabularTable(dataset)
  if (!table) {
    throw new Error('HMM needs a CSV/JSON dataset with a value column.')
  }
  if (!table.columnNames.includes(valueColumn)) {
    throw new Error(`Value column “${valueColumn}” not found in dataset.`)
  }

  const timeCol = roleColumns(dataset.columnMapping, 'time')[0]
  const seriesCol = roleColumns(dataset.columnMapping, 'series')[0]
  const notes: string[] = [
    'Observations are a derived view; originalText is never modified.',
  ]

  type Row = { t: number; v: number; order: number }
  const rows: Row[] = []
  let skippedMissing = 0
  let skippedNonFinite = 0

  table.rows.forEach((row, order) => {
    if (seriesCol && seriesFilter !== null && seriesFilter !== '') {
      if (String(row[seriesCol] ?? '') !== seriesFilter) return
    }
    const raw = row[valueColumn]
    if (isMissing(raw)) {
      skippedMissing += 1
      return
    }
    const v = asFiniteNumber(raw)
    if (v === null) {
      skippedNonFinite += 1
      return
    }
    let t = order
    if (timeCol) {
      const tv = asFiniteNumber(row[timeCol])
      if (tv === null) {
        skippedNonFinite += 1
        return
      }
      t = tv
    }
    rows.push({ t, v, order })
  })

  if (timeCol) {
    rows.sort((a, b) => a.t - b.t || a.order - b.order)
    notes.push(`Sorted by time column “${timeCol}”.`)
  } else {
    notes.push('No time column mapped; using file row order.')
  }

  if (seriesCol && seriesFilter) {
    notes.push(`Filtered series “${seriesCol}” = “${seriesFilter}”.`)
  }

  return {
    values: rows.map((r) => r.v),
    times: rows.map((r) => r.t),
    skippedMissing,
    skippedNonFinite,
    notes,
  }
}
