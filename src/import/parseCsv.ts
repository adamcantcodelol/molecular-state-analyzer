import type { ParseResult, TabularSummary } from '../types/dataset'

export type CsvParseOptions = {
  /** Override delimiter; default auto-detects comma vs tab from header line. */
  delimiter?: ',' | '\t' | ';'
}

export type CsvTable = {
  columnNames: string[]
  /** Data rows as string cells aligned to columnNames (missing cells → ''). */
  dataRows: string[][]
  delimiter: ',' | '\t' | ';'
  raggedCount: number
  notes: string[]
}

/**
 * Full CSV/TSV table load (derived view). Does not rewrite the source text.
 */
export function parseCsvTable(
  text: string,
  options: CsvParseOptions = {},
): CsvTable {
  const notes: string[] = []
  if (!text.trim()) {
    return {
      columnNames: [],
      dataRows: [],
      delimiter: options.delimiter ?? ',',
      raggedCount: 0,
      notes: ['File is empty.'],
    }
  }

  const delimiter = options.delimiter ?? detectDelimiter(text)
  if (!options.delimiter) {
    notes.push(
      `Delimiter auto-detected as ${delimiter === '\t' ? 'tab' : delimiter === ';' ? 'semicolon' : 'comma'}. Original file unchanged.`,
    )
  }

  const rows = parseDelimited(text, delimiter)
  if (rows.length === 0) {
    return {
      columnNames: [],
      dataRows: [],
      delimiter,
      raggedCount: 0,
      notes: [...notes, 'No rows parsed.'],
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
    notes.push(
      'Duplicate header names were disambiguated in the derived view only (e.g. name__2). Original header row is unchanged.',
    )
  }

  const rawData = rows.slice(1)
  let raggedCount = 0
  const dataRows: string[][] = []

  for (const cells of rawData) {
    if (cells.length !== columnNames.length) raggedCount += 1
    const aligned: string[] = []
    for (let c = 0; c < columnNames.length; c++) {
      aligned.push(cells[c] ?? '')
    }
    dataRows.push(aligned)
  }

  if (raggedCount > 0) {
    notes.push(
      `${raggedCount} row(s) have a different field count than the header — padded/truncated in the derived view only.`,
    )
  }

  return { columnNames, dataRows, delimiter, raggedCount, notes }
}

/**
 * CSV/TSV parser that preserves cell strings as read (no type coercion).
 * Numbers stay as strings in the original file; preview may show strings only.
 */
export function parseCsv(
  text: string,
  options: CsvParseOptions = {},
): ParseResult<TabularSummary> {
  const table = parseCsvTable(text, options)
  const previewRows: Record<string, string | number | boolean | null>[] = []

  for (let r = 0; r < Math.min(8, table.dataRows.length); r++) {
    const cells = table.dataRows[r]!
    const obj: Record<string, string | number | boolean | null> = {}
    for (let c = 0; c < table.columnNames.length; c++) {
      obj[table.columnNames[c]!] = cells[c] ?? ''
    }
    previewRows.push(obj)
  }

  return {
    summary: {
      kind: 'csv',
      columnNames: table.columnNames,
      rowCount: table.dataRows.length,
      previewRows,
    },
    warnings: table.notes,
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
