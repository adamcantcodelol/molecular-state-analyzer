import type { ParseResult, TabularSummary } from '../types/dataset'

/**
 * JSON import for tabular / time-series shaped data.
 * Accepts:
 * - Array of objects → columns = union of keys
 * - { columns: string[], rows: (string|number|null)[][] }
 * - { data: object[] }
 * Does not coerce or rewrite the original JSON text.
 */
export function parseJson(text: string): ParseResult<TabularSummary> {
  const warnings: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return {
      summary: {
        kind: 'json',
        columnNames: [],
        rowCount: 0,
        previewRows: [],
      },
      warnings: [
        `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    }
  }

  let records: Record<string, unknown>[] = []

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      warnings.push('JSON array is empty.')
    } else if (parsed.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x))) {
      records = parsed as Record<string, unknown>[]
    } else {
      warnings.push(
        'Top-level array is not an array of objects. Wrapped each item as { value } for mapping.',
      )
      records = parsed.map((value, index) => ({ index, value }))
    }
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.data) && obj.data.every(isPlainObject)) {
      records = obj.data as Record<string, unknown>[]
      warnings.push('Using object.data as the row array.')
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
          warnings.push(`Row ${index} is not an array — skipped in summary.`)
        }
        return out
      })
      warnings.push('Using { columns, rows } table shape.')
    } else if (isPlainObject(parsed)) {
      // Single object → one row
      records = [obj]
      warnings.push('JSON root is a single object — treated as one row.')
    }
  } else {
    warnings.push('Unsupported JSON root type — expected object or array.')
  }

  const keySet = new Set<string>()
  for (const r of records) {
    for (const k of Object.keys(r)) keySet.add(k)
  }
  const columnNames = [...keySet]

  const previewRows: Record<string, string | number | boolean | null>[] = []
  for (let i = 0; i < Math.min(8, records.length); i++) {
    const src = records[i]!
    const row: Record<string, string | number | boolean | null> = {}
    for (const col of columnNames) {
      row[col] = toPreviewCell(src[col])
    }
    previewRows.push(row)
  }

  return {
    summary: {
      kind: 'json',
      columnNames,
      rowCount: records.length,
      previewRows,
    },
    warnings,
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
