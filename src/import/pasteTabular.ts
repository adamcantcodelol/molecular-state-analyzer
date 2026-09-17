/**
 * Paste-from-Excel helpers (CSV/TSV clipboard text).
 * Derived frame index is never applied unless the caller opts in explicitly.
 */

export type Delimiter = ',' | '\t' | ';'

export type SingleNumericRow = {
  values: string[]
  delimiter: Delimiter
}

const FRAME_COL = 'frame'
const VALUE_COL = 'value'

/** Canonical column names for the opt-in derived frame-index layout. */
export const DERIVED_FRAME_INDEX = {
  kind: 'single_row_frame_index' as const,
  timeColumn: FRAME_COL,
  valueColumn: VALUE_COL,
}

/**
 * True when the paste is exactly one non-empty row of numeric cells
 * (typical Excel single-row copy with no header / no time column).
 */
export function tryParseSingleNumericRow(text: string): SingleNumericRow | null {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return null

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length !== 1) return null

  const delimiter = detectDelimiter(lines[0]!)
  const rows = parseDelimited(trimmed, delimiter)
  if (rows.length !== 1) return null

  const cells = rows[0]!.map((c) => c.trim())
  if (cells.length === 0) return null
  if (!cells.every((c) => c !== '' && isNumericCell(c))) return null

  return { values: cells, delimiter }
}

/**
 * Build a derived CSV (header + N rows) for preview/mapping only.
 * Does not replace the user's original pasted text.
 */
export function buildDerivedFrameIndexCsv(values: string[]): string {
  const lines = [`${FRAME_COL},${VALUE_COL}`]
  for (let i = 0; i < values.length; i++) {
    lines.push(`${i + 1},${escapeCsvField(values[i]!)}`)
  }
  return lines.join('\n')
}

export function derivedFrameIndexWarning(n: number): string {
  return (
    `Derived time column “${FRAME_COL}” is frame index 1..${n} ` +
    `(explicit opt-in). It is not present in the pasted text; originalText stays unmodified.`
  )
}

function isNumericCell(s: string): boolean {
  // Allow plain decimals / scientific; reject bare empty.
  const n = Number(s)
  return Number.isFinite(n)
}

function detectDelimiter(firstLine: string): Delimiter {
  const commas = (firstLine.match(/,/g) ?? []).length
  const tabs = (firstLine.match(/\t/g) ?? []).length
  const semis = (firstLine.match(/;/g) ?? []).length
  if (tabs > commas && tabs > semis) return '\t'
  if (semis > commas && semis > tabs) return ';'
  return ','
}

function escapeCsvField(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** RFC 4180-ish row parser (local copy so paste helpers stay free of parseCsv internals). */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  const n = text.length

  while (i < n) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === delimiter) {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && i + 1 < n && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '' || i + 1 < n) {
        rows.push(row)
      }
      row = []
      i += 1
      continue
    }
    field += c
    i += 1
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
