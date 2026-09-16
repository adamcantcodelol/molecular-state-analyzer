import type { ParseResult, TabularSummary } from '../types/dataset'

export type JsonTable = {
  columnNames: string[]
  rows: Record<string, string | number | boolean | null>[]
  notes: string[]
}

/**
 * Load all JSON records as a derived tabular view.
 * Does not rewrite the original JSON text.
 */
export function loadJsonRecords(text: string): JsonTable {
  const notes: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return {
      columnNames: [],
      rows: [],
      notes: [
        `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    }
  }

  let records: Record<string, unknown>[] = []

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      notes.push('JSON array is empty.')
    } else if (
      parsed.every(
        (x) => x !== null && typeof x === 'object' && !Array.isArray(x),
      )
    ) {
      records = parsed as Record<string, unknown>[]
    } else {
      notes.push(
        'Top-level array is not an array of objects. Wrapped each item as { value } for mapping.',
      )
      records = parsed.map((value, index) => ({ index, value }))
    }
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.data) && obj.data.every(isPlainObject)) {
      records = obj.data as Record<string, unknown>[]
      notes.push('Using object.data as the row array.')
    } else if (
      Array.isArray(obj.rows) &&
      Array.isArray(obj.columns) &&
      obj.columns.every((c) => typeof c === 'string')
    ) {
      const columns = obj.columns as string[]
      records = (obj.rows as unknown[]).map((row, index) => {
        const out: Record<string, unknown> = {}
        if (Array.isArray(row)) {
          for (let i = 0; i < columns.length; i++) {
            out[columns[i]!] = row[i] ?? null
          }
        } else {
          notes.push(`Row ${index} is not an array — skipped in derived view.`)
        }
        return out
      })
      notes.push('Using { columns, rows } table shape.')
    } else if (isPlainObject(parsed)) {
      records = [obj]
      notes.push('JSON root is a single object — treated as one row.')
    }
  } else {
    notes.push('Unsupported JSON root type — expected object or array.')
  }

  const keySet = new Set<string>()
  for (const r of records) {
    for (const k of Object.keys(r)) keySet.add(k)
  }
  const columnNames = [...keySet]

  const rows: Record<string, string | number | boolean | null>[] = []
  for (const src of records) {
    const row: Record<string, string | number | boolean | null> = {}
    for (const col of columnNames) {
      row[col] = toPreviewCell(src[col])
    }
    rows.push(row)
  }

  return { columnNames, rows, notes }
}

/**
 * JSON import for tabular / time-series shaped data.
 * Accepts:
 * - Array of objects → columns = union of keys
 * - { columns: string[], rows: (string|number|null)[][] }
 * - { data: object[] }
 * Does not coerce or rewrite the original JSON text.
 */
export function parseJson(text: string): ParseResult<TabularSummary> {
  const loaded = loadJsonRecords(text)
  return {
    summary: {
      kind: 'json',
      columnNames: loaded.columnNames,
      rowCount: loaded.rows.length,
      previewRows: loaded.rows.slice(0, 8),
    },
    warnings: loaded.notes,
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function toPreviewCell(
  v: unknown,
): string | number | boolean | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return v
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
