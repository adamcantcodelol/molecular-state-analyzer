import { useRef, useState } from 'react'
import type {
  ColumnMapping,
  DataFormat,
  DatasetSummary,
  ImportedDataset,
  ParseResult,
} from '../types/dataset'
import { acceptAttribute } from '../import/detectFormat'
import { newDatasetId } from '../import/ids'
import { needsColumnMapping, parseImportFile } from '../import/parseFile'
import { parseCsv } from '../import/parseCsv'
import { readFileAsText, utf8ByteLength } from '../import/readFileAsText'
import {
  initialMapping,
  validateTimeSeriesMapping,
} from '../import/columnMapping'
import {
  buildDerivedFrameIndexCsv,
  DERIVED_FRAME_INDEX,
  derivedFrameIndexWarning,
  tryParseSingleNumericRow,
} from '../import/pasteTabular'
import { ColumnMapper } from './ColumnMapper'

type PendingImport = {
  fileName: string
  format: DataFormat
  originalText: string
  byteLength: number
  warnings: string[]
  summary: DatasetSummary
  mapping: ColumnMapping[] | null
  /** Paste path only: offer opt-in derived frame index. */
  singleNumericRowOffer?: boolean
  useDerivedFrameIndex?: boolean
  derivedTabular?: ImportedDataset['derivedTabular']
  source: 'file' | 'paste'
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
  const [pasteText, setPasteText] = useState('')
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  function buildPendingFromTabularText(
    fileName: string,
    originalText: string,
    source: 'file' | 'paste',
    opts: {
      formatOverride?: DataFormat
      softSizeBytes?: number
      useDerivedFrameIndex?: boolean
    } = {},
  ): PendingImport | { error: string } {
    const single = tryParseSingleNumericRow(originalText)
    const offerDerived = source === 'paste' && single !== null
    const useDerived = Boolean(opts.useDerivedFrameIndex && offerDerived && single)

    let format: DataFormat
    let parse: ParseResult<DatasetSummary>
    let warnings: string[]

    if (useDerived && single) {
      const derivedCsv = buildDerivedFrameIndexCsv(single.values)
      parse = parseCsv(derivedCsv, { delimiter: ',' })
      format = 'csv'
      warnings = [
        ...parse.warnings,
        derivedFrameIndexWarning(single.values.length),
      ]
    } else {
      const result = parseImportFile(
        fileName,
        originalText,
        opts.formatOverride,
      )
      if ('error' in result) return { error: result.error }
      format = result.format
      parse = result.parse
      warnings = [...result.parse.warnings]
    }

    if (opts.softSizeBytes !== undefined && opts.softSizeBytes > SOFT_SIZE_WARN) {
      warnings.unshift(
        `Large file (${formatBytes(opts.softSizeBytes)}). Stored as-is in IndexedDB; keep an eye on browser quota.`,
      )
    }

    const byteLength = utf8ByteLength(originalText)
    if (
      opts.softSizeBytes !== undefined &&
      byteLength !== opts.softSizeBytes
    ) {
      warnings.push(
        `Decoded UTF-8 length (${byteLength} bytes) differs from File.size (${opts.softSizeBytes}). Binary content may not round-trip; original text is what was decoded.`,
      )
    }

    const mapping =
      needsColumnMapping(format) &&
      (parse.summary.kind === 'csv' || parse.summary.kind === 'json')
        ? initialMapping(parse.summary.columnNames)
        : null

    if (
      needsColumnMapping(format) &&
      (parse.summary.kind === 'csv' || parse.summary.kind === 'json') &&
      parse.summary.columnNames.length === 0
    ) {
      return {
        error: 'No columns found to map. Check that the file is tabular.',
      }
    }

    return {
      fileName,
      format,
      originalText,
      byteLength,
      warnings,
      summary: parse.summary,
      mapping,
      singleNumericRowOffer: offerDerived || undefined,
      useDerivedFrameIndex: useDerived || undefined,
      derivedTabular: useDerived ? { ...DERIVED_FRAME_INDEX } : undefined,
      source,
    }
  }

  async function handleFiles(files: FileList | null) {
    setError(null)
    setMappingError(null)
    setPending(null)
    const file = files?.[0]
    if (!file) return

    setReading(true)
    try {
      const originalText = await readFileAsText(file)
      const built = buildPendingFromTabularText(file.name, originalText, 'file', {
        formatOverride: formatOverride || undefined,
        softSizeBytes: file.size,
      })
      if ('error' in built) {
        setError(built.error)
        return
      }
      setPending(built)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file.')
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleParsePaste() {
    setError(null)
    setMappingError(null)
    setPending(null)
    const text = pasteText
    if (!text.trim()) {
      setError('Paste tab- or comma-separated cells before parsing.')
      return
    }

    const delimGuess = text.includes('\t')
      ? 'tsv'
      : text.includes(';')
        ? 'csv'
        : 'csv'
    const fileName = `clipboard-paste.${delimGuess === 'tsv' ? 'tsv' : 'csv'}`

    setReading(true)
    try {
      // Paste is always treated as CSV/TSV (same parser path as file import).
      const built = buildPendingFromTabularText(fileName, text, 'paste', {
        formatOverride: 'csv',
        useDerivedFrameIndex: false,
      })
      if ('error' in built) {
        setError(built.error)
        return
      }
      setPending(built)
    } finally {
      setReading(false)
    }
  }

  function handleToggleDerivedFrameIndex(checked: boolean) {
    if (!pending || pending.source !== 'paste') return
    setMappingError(null)
    const built = buildPendingFromTabularText(
      pending.fileName,
      pending.originalText,
      'paste',
      {
        formatOverride: 'csv',
        useDerivedFrameIndex: checked,
      },
    )
    if ('error' in built) {
      setError(built.error)
      return
    }
    setPending(built)
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
      ...(pending.derivedTabular
        ? { derivedTabular: pending.derivedTabular }
        : {}),
    }

    await onCommit(dataset)
    setPending(null)
    setMappingError(null)
    setPasteText('')
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
        Client-side only. Files and Excel pastes are parsed in your browser;
        originals are stored unchanged in this project. CSV/JSON require an
        explicit column mapping before commit — nothing is silently rewritten.
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

      <div className="import-paste">
        <label className="field" htmlFor="excel-paste">
          <span className="field-label">Paste from Excel</span>
          <textarea
            id="excel-paste"
            className="input paste-textarea"
            rows={5}
            placeholder={
              'Paste tab- or comma-separated cells here (Excel copy).\nExample:\ntime\trmsd\n0\t1.2\n1\t1.1'
            }
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            disabled={reading || busy || !!pending}
            spellCheck={false}
          />
        </label>
        <div className="row actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleParsePaste}
            disabled={reading || busy || !!pending || !pasteText.trim()}
          >
            Parse paste
          </button>
        </div>
        <p className="muted small">
          Uses the same CSV/TSV parser as file import. Review → map columns →
          Commit. A single row of numbers can optionally use a{' '}
          <strong>derived</strong> frame index (1..N) as Time — never invented
          silently.
        </p>
      </div>

      {reading && <p className="muted">Reading…</p>}
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
              <dt>{pending.source === 'paste' ? 'Source' : 'File'}</dt>
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

          {pending.singleNumericRowOffer && (
            <div className="derived-offer warn-box" role="group" aria-label="Derived frame index">
              <strong>Single row of numbers detected</strong>
              <p className="small" style={{ margin: '0.4rem 0 0.6rem' }}>
                No Time column in the paste. You may opt in to a{' '}
                <strong>derived</strong> frame index (1..N) as the Time column
                and treat each cell as a Value. This does not rewrite the pasted
                text stored as <code>originalText</code>.
              </p>
              <label className="derived-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(pending.useDerivedFrameIndex)}
                  onChange={(e) =>
                    handleToggleDerivedFrameIndex(e.target.checked)
                  }
                  disabled={busy}
                />
                <span>
                  Use <strong>derived</strong> frame index 1..N as Time column
                </span>
              </label>
            </div>
          )}

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

          {pending.useDerivedFrameIndex && (
            <p className="muted small">
              Column <code>frame</code> is <strong>derived</strong> (1..N), not
              present in the paste.
            </p>
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
