import type { ParseResult, TabularSummary } from '../types/dataset'

export type CsvParseOptions = {
  /** Override delimiter; default auto-detects comma vs tab from header line. */
  delimiter?: ',' | '\t' | ';'
}

/**
 * CSV/TSV parser that preserves cell strings as read (no type coercion).
 * Numbers stay as strings in the original file; preview may show strings only.
 */
export function parseCsv(
  text: string,
  options: CsvParseOptions = {},
): ParseResult<TabularSummary> {
  const warnings: string[] = []
  if (!text.trim()) {
    return {
      summary: {
        kind: 'csv',
        columnNames: [],
        rowCount: 0,
        previewRows: [],
      },
      warnings: ['File is empty.'],
    }
  }

  const delimiter = options.delimiter ?? detectDelimiter(text)
  if (!options.delimiter) {
    warnings.push(
      `Delimiter auto-detected as ${delimiter === '\t' ? 'tab' : delimiter === ';' ? 'semicolon' : 'comma'}. Original file unchanged.`,
    )
  }

  const rows = parseDelimited(text, delimiter)
  if (rows.length === 0) {
    return {
      summary: { kind: 'csv', columnNames: [], rowCount: 0, previewRows: [] },
      warnings: [...warnings, 'No rows parsed.'],
    }
  }

  const header = rows[0]!.map((h, i) => h.trim() || `column_${i + 1}`)
  const seen = new Map<string, number>()
  const columnNames = header.map((name) => {
    const n = seen.get(name) ?? 0
    seen.set(name, n + 1)
    return n === 0 ? name : `${name}__${n + 1}`
  })
  if (columnNames.some((c, i) => c !== header[i])) {
    warnings.push(
      'Duplicate header names were disambiguated in the summary only (e.g. name__2). Original header row is unchanged.',
    )
  }

  const dataRows = rows.slice(1)
  let ragged = 0
  const previewRows: Record<string, string | number | boolean | null>[] = []

  for (let r = 0; r < dataRows.length; r++) {
    const cells = dataRows[r]!
    if (cells.length !== columnNames.length) ragged += 1
    if (previewRows.length < 8) {
      const obj: Record<string, string | number | boolean | null> = {}
      for (let c = 0; c < columnNames.length; c++) {
        obj[columnNames[c]!] = cells[c] ?? ''
      }
      previewRows.push(obj)
    }
  }
  if (ragged > 0) {
    warnings.push(
      `${ragged} row(s) have a different field count than the header — shown padded/truncated in preview only.`,
    )
  }

  return {
    summary: {
      kind: 'csv',
      columnNames,
      rowCount: dataRows.length,
      previewRows,
    },
    warnings,
  }
}

function detectDelimiter(text: string): ',' | '\t' | ';' {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const commas = (first.match(/,/g) ?? []).length
  const tabs = (first.match(/\t/g) ?? []).length
  const semis = (first.match(/;/g) ?? []).length
  if (tabs > commas && tabs > semis) return '\t'
  if (semis > commas && semis > tabs) return ';'
  return ','
}

/** RFC 4180-ish row parser. */
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
      // skip trailing empty line at EOF
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
