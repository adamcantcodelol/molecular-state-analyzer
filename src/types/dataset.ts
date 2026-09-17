/** Supported import formats for Phase 2. */
export type DataFormat = 'fasta' | 'pdb' | 'mmcif' | 'csv' | 'json'

/** Roles a user can assign to CSV/JSON columns for time-series. */
export type ColumnRole =
  | 'unmapped'
  | 'time'
  | 'value'
  | 'series'
  | 'label'
  | 'ignore'

export interface ColumnMapping {
  column: string
  role: ColumnRole
}

export type FastaSummary = {
  kind: 'fasta'
  sequenceCount: number
  totalResidues: number
  headers: string[]
}

export type PdbSummary = {
  kind: 'pdb'
  atomCount: number
  hetatmCount: number
  modelCount: number
  chainIds: string[]
  title?: string
}

export type MmcifSummary = {
  kind: 'mmcif'
  dataBlockIds: string[]
  categoryNames: string[]
  atomSiteRows?: number
  entryId?: string
}

export type TabularSummary = {
  kind: 'csv' | 'json'
  columnNames: string[]
  rowCount: number
  /** First few rows for preview only — not a substitute for originalText. */
  previewRows: Record<string, string | number | boolean | null>[]
}

export type DatasetSummary =
  | FastaSummary
  | PdbSummary
  | MmcifSummary
  | TabularSummary

/**
 * One imported file stored inside a project.
 * `originalText` is the exact bytes decoded as UTF-8 text — never rewritten.
 * Parsed fields are derived views; they do not replace the original.
 */
export interface ImportedDataset {
  id: string
  fileName: string
  format: DataFormat
  importedAt: string
  /** Exact file contents as read from disk (UTF-8). Never mutated after import. */
  originalText: string
  byteLength: number
  /** Non-fatal parse notes shown to the user. */
  warnings: string[]
  summary: DatasetSummary
  /** Present only after the user explicitly confirms column mapping (CSV/JSON). */
  columnMapping?: ColumnMapping[]
  /**
   * True when this dataset was generated in-app (Phase 7).
   * Must be treated as SYNTHETIC — never presented as experimental/real data.
   */
  synthetic?: boolean
  /** Optional generation metadata for synthetic datasets (ground-truth params). */
  syntheticMeta?: {
    seed: number
    nStates: number
    length: number
    means: number[]
    variances: number[]
    stayProb: number
  }
  /**
   * Explicit opt-in derived tabular layout (e.g. paste single numeric row → frame index).
   * Never applied silently. originalText remains the unmodified paste/file text;
   * loaders rebuild the derived view from this flag + originalText.
   */
  derivedTabular?: {
    kind: 'single_row_frame_index'
    /** Derived 1..N time column name (labeled derived in UI). */
    timeColumn: string
    /** Column holding the pasted numeric cells as values. */
    valueColumn: string
  }
}

export type ParseResult<T extends DatasetSummary = DatasetSummary> = {
  summary: T
  warnings: string[]
}

export const COLUMN_ROLE_OPTIONS: { value: ColumnRole; label: string }[] = [
  { value: 'unmapped', label: '— not mapped —' },
  { value: 'time', label: 'Time / frame' },
  { value: 'value', label: 'Value (numeric)' },
  { value: 'series', label: 'Series / group' },
  { value: 'label', label: 'Label / ID' },
  { value: 'ignore', label: 'Ignore' },
]
