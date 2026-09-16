import type { ColumnMapping, ColumnRole } from '../types/dataset'

export function validateTimeSeriesMapping(mapping: ColumnMapping[]): string | null {
  const roles = mapping.map((m) => m.role)
  const timeCount = roles.filter((r) => r === 'time').length
  const valueCount = roles.filter((r) => r === 'value').length
  if (timeCount === 0) {
    return 'Map at least one column to “Time / frame” before committing.'
  }
  if (timeCount > 1) {
    return 'Only one column may be mapped as “Time / frame”.'
  }
  if (valueCount < 1) {
    return 'Map at least one column to “Value (numeric)” before committing.'
  }
  const unmapped = mapping.filter((m) => m.role === 'unmapped')
  if (unmapped.length > 0) {
    return `Assign a role to every column (or set unused ones to “Ignore”). Still unmapped: ${unmapped
      .map((m) => m.column)
      .join(', ')}`
  }
  return null
}

export function initialMapping(columnNames: string[]): ColumnMapping[] {
  return columnNames.map((column) => ({
    column,
    role: guessRole(column),
  }))
}

/** Soft suggestions only — user must still confirm. Never auto-commits. */
function guessRole(name: string): ColumnRole {
  const n = name.trim().toLowerCase()
  if (
    /^(t|time|frame|timestep|step|ns|ps|ms|seconds?|index)$/.test(n) ||
    n.includes('time') ||
    n.includes('frame')
  ) {
    return 'time'
  }
  if (
    /^(series|group|chain|replica|run|condition|label_series)$/.test(n) ||
    n.includes('series')
  ) {
    return 'series'
  }
  if (/^(id|name|label|tag|residue|resname)$/.test(n)) {
    return 'label'
  }
  if (
    /^(value|val|y|rmsd|rmsf|energy|distance|angle|score|signal|intensity)$/.test(
      n,
    ) ||
    n.includes('rmsd') ||
    n.includes('energy')
  ) {
    return 'value'
  }
  return 'unmapped'
}
