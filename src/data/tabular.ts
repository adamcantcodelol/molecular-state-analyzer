import type { ColumnMapping, ImportedDataset } from '../types/dataset'
import { parseCsvTable } from '../import/parseCsv'
import { loadJsonRecords } from '../import/parseJson'

export type CellValue = string | number | boolean | null

/**
 * Derived tabular view loaded from originalText.
 * Never written back into the dataset; originals stay unchanged.
 */
export type TabularTable = {
  columnNames: string[]
  rows: Record<string, CellValue>[]
  /** Non-mutating notes about how the table was derived. */
  notes: string[]
}

/** Re-parse committed CSV/JSON originalText into a full row table (derived view). */
export function loadTabularTable(dataset: ImportedDataset): TabularTable | null {
  if (dataset.format === 'csv') {
    const table = parseCsvTable(dataset.originalText)
    const rows: Record<string, CellValue>[] = table.dataRows.map((cells) => {
      const obj: Record<string, CellValue> = {}
      for (let c = 0; c < table.columnNames.length; c++) {
        const name = table.columnNames[c]!
        obj[name] = cells[c] ?? ''
      }
      return obj
    })
    return {
      columnNames: table.columnNames,
      rows,
      notes: table.notes,
    }
  }

  if (dataset.format === 'json') {
    const loaded = loadJsonRecords(dataset.originalText)
    return {
      columnNames: loaded.columnNames,
      rows: loaded.rows,
      notes: loaded.notes,
    }
  }

  return null
}

export function roleColumns(
  mapping: ColumnMapping[] | undefined,
  role: ColumnMapping['role'],
): string[] {
  if (!mapping) return []
  return mapping.filter((m) => m.role === role).map((m) => m.column)
}

/** Parse a cell as a finite number when possible; otherwise null. Does not mutate source. */
export function asFiniteNumber(value: CellValue | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'boolean') return value ? 1 : 0
  const s = String(value).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function isMissing(value: CellValue | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  return false
}
