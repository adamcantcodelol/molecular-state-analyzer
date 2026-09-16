import {
  asFiniteNumber,
  isMissing,
  loadTabularTable,
  roleColumns,
  type CellValue,
} from '../data/tabular'
import type { ImportedDataset } from '../types/dataset'
import type { QualityIssue, QualityReport } from './types'

/**
 * Inspect an imported dataset and return explicit quality warnings.
 * Never mutates, deletes, or "fixes" user data — report only.
 */
export function checkDataset(dataset: ImportedDataset): QualityReport {
  const issues: QualityIssue[] = []
  const checkedAt = new Date().toISOString()

  if (!dataset.originalText || dataset.originalText.length === 0) {
    issues.push({
      id: 'empty-original',
      severity: 'warn',
      code: 'empty_file',
      message: 'Original file text is empty.',
    })
  }

  // Surface parse notes from import as quality context (not re-parsing mutations).
  for (let i = 0; i < dataset.warnings.length; i++) {
    const w = dataset.warnings[i]!
    issues.push({
      id: `parse-note-${i}`,
      severity: 'info',
      code: 'parse_note',
      message: w,
    })
  }

  if (dataset.format === 'csv' || dataset.format === 'json') {
    issues.push(...checkTabular(dataset))
  } else {
    issues.push(...checkStructureSummary(dataset))
  }

  const hasWarnings = issues.some((x) => x.severity === 'warn')
  return {
    datasetId: dataset.id,
    checkedAt,
    issues,
    hasWarnings,
  }
}

function checkTabular(dataset: ImportedDataset): QualityIssue[] {
  const issues: QualityIssue[] = []
  const table = loadTabularTable(dataset)
  if (!table) {
    issues.push({
      id: 'no-table',
      severity: 'warn',
      code: 'load_failed',
      message: 'Could not derive a tabular view from original text.',
    })
    return issues
  }

  if (table.rows.length === 0) {
    issues.push({
      id: 'no-rows',
      severity: 'warn',
      code: 'no_rows',
      message: 'No data rows found in the derived table.',
    })
    return issues
  }

  const mapping = dataset.columnMapping
  if (!mapping || mapping.length === 0) {
    issues.push({
      id: 'no-mapping',
      severity: 'warn',
      code: 'no_mapping',
      message:
        'No column mapping on this dataset — time-series quality checks and plots need a committed mapping.',
    })
  }

  // Ragged rows (CSV notes already mention; also count from derived loader notes)
  const raggedNote = table.notes.find((n) => n.includes('different field count'))
  if (raggedNote) {
    issues.push({
      id: 'ragged-rows',
      severity: 'warn',
      code: 'ragged_rows',
      message: raggedNote,
    })
  }

  const timeCols = roleColumns(mapping, 'time')
  const valueCols = roleColumns(mapping, 'value')
  const seriesCols = roleColumns(mapping, 'series')
  const checkedCols = [
    ...new Set([...timeCols, ...valueCols, ...seriesCols, ...roleColumns(mapping, 'label')]),
  ]

  // Missing values in mapped columns
  for (const col of checkedCols) {
    let missing = 0
    const examples: number[] = []
    for (let i = 0; i < table.rows.length; i++) {
      if (isMissing(table.rows[i]![col])) {
        missing += 1
        if (examples.length < 5) examples.push(i + 1)
      }
    }
    if (missing > 0) {
      issues.push({
        id: `missing-${col}`,
        severity: 'warn',
        code: 'missing_values',
        message: `Column “${col}” has ${missing} missing/empty value(s) (of ${table.rows.length} rows). Data was not filled or removed.`,
        detail: examples.length
          ? `Example data row numbers (1-based): ${examples.join(', ')}`
          : undefined,
      })
    }
  }

  // Non-numeric where time/value expected
  for (const col of [...timeCols, ...valueCols]) {
    let bad = 0
    const examples: string[] = []
    for (let i = 0; i < table.rows.length; i++) {
      const cell = table.rows[i]![col]
      if (isMissing(cell)) continue
      if (asFiniteNumber(cell) === null) {
        bad += 1
        if (examples.length < 3) {
          examples.push(`row ${i + 1}: ${formatCell(cell)}`)
        }
      }
    }
    if (bad > 0) {
      const role = timeCols.includes(col) ? 'time' : 'value'
      issues.push({
        id: `non-numeric-${col}`,
        severity: 'warn',
        code: 'non_numeric',
        message: `Column “${col}” is mapped as ${role} but has ${bad} non-numeric value(s). Values were not coerced.`,
        detail: examples.length ? `Examples: ${examples.join('; ')}` : undefined,
      })
    }
  }

  // Duplicate full rows (exact cell equality on all columns)
  const dupFull = countDuplicateKeys(
    table.rows.map((r) => table.columnNames.map((c) => stringifyCell(r[c])).join('\u0001')),
  )
  if (dupFull.duplicateGroups > 0) {
    issues.push({
      id: 'dup-rows',
      severity: 'warn',
      code: 'duplicate_rows',
      message: `Found ${dupFull.extraRowCount} duplicate full row(s) across ${dupFull.duplicateGroups} group(s). Duplicates were not removed.`,
    })
  }

  // Duplicate time (+ series) keys
  if (timeCols.length === 1) {
    const timeCol = timeCols[0]!
    const seriesCol = seriesCols[0]
    const keys = table.rows.map((r) => {
      const t = stringifyCell(r[timeCol])
      const s = seriesCol ? stringifyCell(r[seriesCol]) : ''
      return `${s}\u0001${t}`
    })
    const dupKeys = countDuplicateKeys(keys)
    if (dupKeys.duplicateGroups > 0) {
      issues.push({
        id: 'dup-time-keys',
        severity: 'warn',
        code: 'duplicate_time_keys',
        message: seriesCol
          ? `Found ${dupKeys.extraRowCount} repeated time+series key(s) using “${timeCol}” + “${seriesCol}”. Keys were not collapsed.`
          : `Found ${dupKeys.extraRowCount} repeated time value(s) in “${timeCol}”. Duplicates were not removed.`,
      })
    }

    // Out-of-order time within each series
    const groups = new Map<string, { rowIndex: number; t: number }[]>()
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i]!
      const t = asFiniteNumber(row[timeCol])
      if (t === null) continue
      const g = seriesCol ? stringifyCell(row[seriesCol]) : '(all)'
      const list = groups.get(g) ?? []
      list.push({ rowIndex: i, t })
      groups.set(g, list)
    }

    let disorderGroups = 0
    let disorderSteps = 0
    const examples: string[] = []
    for (const [g, points] of groups) {
      let local = 0
      for (let i = 1; i < points.length; i++) {
        if (points[i]!.t < points[i - 1]!.t) {
          local += 1
          if (examples.length < 4) {
            examples.push(
              `${g}: row ${points[i - 1]!.rowIndex + 1} (t=${points[i - 1]!.t}) → row ${points[i]!.rowIndex + 1} (t=${points[i]!.t})`,
            )
          }
        }
      }
      if (local > 0) {
        disorderGroups += 1
        disorderSteps += local
      }
    }
    if (disorderSteps > 0) {
      issues.push({
        id: 'time-order',
        severity: 'warn',
        code: 'time_out_of_order',
        message: `Time column “${timeCol}” decreases ${disorderSteps} time(s) across ${disorderGroups} series/group(s) in file order. Rows were not re-sorted.`,
        detail: examples.length ? `Examples: ${examples.join('; ')}` : undefined,
      })
    }
  }

  return issues
}

function checkStructureSummary(dataset: ImportedDataset): QualityIssue[] {
  const issues: QualityIssue[] = []
  const s = dataset.summary
  switch (s.kind) {
    case 'fasta':
      if (s.sequenceCount === 0) {
        issues.push({
          id: 'fasta-empty',
          severity: 'warn',
          code: 'no_sequences',
          message: 'FASTA summary reports zero sequences.',
        })
      }
      break
    case 'pdb':
      if (s.atomCount + s.hetatmCount === 0) {
        issues.push({
          id: 'pdb-empty',
          severity: 'warn',
          code: 'no_atoms',
          message: 'PDB summary reports zero ATOM/HETATM records.',
        })
      }
      break
    case 'mmcif':
      if ((s.atomSiteRows ?? 0) === 0 && s.categoryNames.length === 0) {
        issues.push({
          id: 'mmcif-empty',
          severity: 'warn',
          code: 'no_categories',
          message: 'mmCIF summary reports no categories / atom_site rows.',
        })
      }
      break
  }
  return issues
}

function countDuplicateKeys(keys: string[]): {
  duplicateGroups: number
  extraRowCount: number
} {
  const counts = new Map<string, number>()
  for (const k of keys) {
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let duplicateGroups = 0
  let extraRowCount = 0
  for (const n of counts.values()) {
    if (n > 1) {
      duplicateGroups += 1
      extraRowCount += n - 1
    }
  }
  return { duplicateGroups, extraRowCount }
}

function stringifyCell(v: CellValue | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function formatCell(v: CellValue | undefined): string {
  if (v === null || v === undefined) return '∅'
  const s = String(v)
  return s.length > 40 ? `${s.slice(0, 40)}…` : s
}
