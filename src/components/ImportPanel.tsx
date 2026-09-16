import { useRef, useState } from 'react'
import type {
  ColumnMapping,
  DataFormat,
  DatasetSummary,
  ImportedDataset,
} from '../types/dataset'
import { acceptAttribute } from '../import/detectFormat'
import { newDatasetId } from '../import/ids'
import { needsColumnMapping, parseImportFile } from '../import/parseFile'
import { readFileAsText, utf8ByteLength } from '../import/readFileAsText'
import {
  initialMapping,
  validateTimeSeriesMapping,
} from '../import/columnMapping'
import { ColumnMapper } from './ColumnMapper'

type PendingImport = {
  fileName: string
  format: DataFormat
  originalText: string
  byteLength: number
  warnings: string[]
  summary: DatasetSummary
  mapping: ColumnMapping[] | null
}

type Props = {
  onCommit: (dataset: ImportedDataset) => Promise<void>
  busy?: boolean
}

const FORMAT_OPTIONS: { value: DataFormat | ''; label: string }[] = [
  { value: '', label: 'Auto-detect' },
  { value: 'fasta', label: 'FASTA' },
  { value: 'pdb', label: 'PDB' },
  { value: 'mmcif', label: 'mmCIF' },
  { value: 'csv', label: 'CSV / TSV' },
  { value: 'json', label: 'JSON' },
]

const SOFT_SIZE_WARN = 8 * 1024 * 1024

export function ImportPanel({ onCommit, busy = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [formatOverride, setFormatOverride] = useState<DataFormat | ''>('')
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  async function handleFiles(files: FileList | null) {
    setError(null)
    setMappingError(null)
    setPending(null)
    const file = files?.[0]
    if (!file) return

    setReading(true)
    try {
      if (file.size > SOFT_SIZE_WARN) {
        // Still allow — just surface a warning in pending
      }
      const originalText = await readFileAsText(file)
      const byteLength = utf8ByteLength(originalText)
      const result = parseImportFile(
        file.name,
        originalText,
        formatOverride || undefined,
      )
      if ('error' in result) {
        setError(result.error)
        return
      }

      const warnings = [...result.parse.warnings]
      if (file.size > SOFT_SIZE_WARN) {
        warnings.unshift(
          `Large file (${formatBytes(file.size)}). Stored as-is in IndexedDB; keep an eye on browser quota.`,
        )
      }
      if (byteLength !== file.size) {
        warnings.push(
          `Decoded UTF-8 length (${byteLength} bytes) differs from File.size (${file.size}). Binary content may not round-trip; original text is what was decoded.`,
        )
      }

      const mapping =
        needsColumnMapping(result.format) &&
        (result.parse.summary.kind === 'csv' ||
          result.parse.summary.kind === 'json')
          ? initialMapping(result.parse.summary.columnNames)
          : null

      if (
        needsColumnMapping(result.format) &&
        (result.parse.summary.kind === 'csv' ||
          result.parse.summary.kind === 'json') &&
        result.parse.summary.columnNames.length === 0
      ) {
        setError('No columns found to map. Check that the file is tabular.')
        return
      }

      setPending({
        fileName: file.name,
        format: result.format,
        originalText,
        byteLength,
        warnings,
        summary: result.parse.summary,
        mapping,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file.')
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleCommit() {
    if (!pending) return
    setMappingError(null)

    if (pending.mapping) {
      const invalid = validateTimeSeriesMapping(pending.mapping)
      if (invalid) {
        setMappingError(invalid)
        return
      }
    }

    const dataset: ImportedDataset = {
      id: newDatasetId(),
      fileName: pending.fileName,
      format: pending.format,
      importedAt: new Date().toISOString(),
      originalText: pending.originalText,
      byteLength: pending.byteLength,
      warnings: pending.warnings,
      summary: pending.summary,
      ...(pending.mapping ? { columnMapping: pending.mapping } : {}),
    }

    await onCommit(dataset)
    setPending(null)
    setMappingError(null)
  }

  function handleCancelPending() {
    setPending(null)
    setMappingError(null)
    setError(null)
  }

  return (
    <section className="panel" aria-labelledby="import-heading">
      <div className="panel-head">
        <h2 id="import-heading" className="panel-title">
          Import data
        </h2>
      </div>
      <p className="muted">
        Client-side only. Files are parsed in your browser; originals are stored
        unchanged in this project. CSV/JSON require an explicit column mapping
        before commit — nothing is silently rewritten.
      </p>

      <div className="import-controls">
        <label className="field format-field">
          <span className="field-label">Format</span>
          <select
            className="input select"
            value={formatOverride}
            onChange={(e) =>
              setFormatOverride((e.target.value || '') as DataFormat | '')
            }
            disabled={reading || busy || !!pending}
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field-label">File</span>
          <div className="row actions">
            <input
              ref={inputRef}
              type="file"
              accept={acceptAttribute()}
              disabled={reading || busy || !!pending}
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>
        </div>
      </div>

      {reading && <p className="muted">Reading file…</p>}
      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}

      {pending && (
        <div className="pending-import">
          <h3 className="subheading">Review before commit</h3>
          <dl className="meta-grid compact">
            <div>
              <dt>File</dt>
              <dd>{pending.fileName}</dd>
            </div>
            <div>
              <dt>Detected format</dt>
              <dd>
                <code>{pending.format}</code>
              </dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(pending.byteLength)}</dd>
            </div>
          </dl>

          <PendingSummary summary={pending.summary} />

          {pending.warnings.length > 0 && (
            <div className="warn-box" role="status">
              <strong>Parse notes</strong>
              <ul className="warn-list">
                {pending.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {pending.mapping &&
            (pending.summary.kind === 'csv' ||
              pending.summary.kind === 'json') && (
              <ColumnMapper
                columnNames={pending.summary.columnNames}
                mapping={pending.mapping}
                onChange={(next) =>
                  setPending((p) => (p ? { ...p, mapping: next } : p))
                }
                previewRows={pending.summary.previewRows}
              />
            )}

          {mappingError && (
            <p className="error" role="alert">
              {mappingError}
            </p>
          )}

          <div className="row actions pending-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancelPending}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleCommit()}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Commit to project'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function PendingSummary({ summary }: { summary: DatasetSummary }) {
  switch (summary.kind) {
    case 'fasta':
      return (
        <p className="small">
          {summary.sequenceCount} sequence(s), {summary.totalResidues} residues
          (sum of sequence lines).
        </p>
      )
    case 'pdb':
      return (
        <p className="small">
          {summary.atomCount} ATOM, {summary.hetatmCount} HETATM,{' '}
          {summary.modelCount} model(s), chains:{' '}
          {summary.chainIds.join(', ') || '—'}.
        </p>
      )
    case 'mmcif':
      return (
        <p className="small">
          Blocks: {summary.dataBlockIds.join(', ') || '—'}; _atom_site rows:{' '}
          {summary.atomSiteRows ?? '—'}; categories:{' '}
          {summary.categoryNames.length}.
        </p>
      )
    case 'csv':
    case 'json':
      return (
        <p className="small">
          {summary.rowCount} data row(s), {summary.columnNames.length} column(s).
        </p>
      )
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
