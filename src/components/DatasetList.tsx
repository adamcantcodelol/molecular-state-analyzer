import type { ImportedDataset } from '../types/dataset'

type Props = {
  datasets: ImportedDataset[]
  onRemove: (id: string) => void
  removingId?: string | null
}

export function DatasetList({ datasets, onRemove, removingId = null }: Props) {
  if (datasets.length === 0) {
    return (
      <div className="empty-state">
        <p>No datasets imported yet.</p>
        <p className="muted">
          Import FASTA, PDB, mmCIF, CSV, or JSON. The dashboard stays empty of
          analysis until you add real files.
        </p>
      </div>
    )
  }

  return (
    <ul className="dataset-list">
      {datasets.map((ds) => (
        <li key={ds.id} className="dataset-card">
          <div className="dataset-card-head">
            <div>
              <div className="dataset-name">{ds.fileName}</div>
              <div className="muted small">
                <span className="pill">{ds.format.toUpperCase()}</span>
                {' · '}
                {formatBytes(ds.byteLength)}
                {' · '}
                imported {formatWhen(ds.importedAt)}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onRemove(ds.id)}
              disabled={removingId === ds.id}
            >
              {removingId === ds.id ? 'Removing…' : 'Remove'}
            </button>
          </div>

          <DatasetSummaryView dataset={ds} />

          {ds.warnings.length > 0 && (
            <details className="warn-details">
              <summary>
                {ds.warnings.length} parse note
                {ds.warnings.length === 1 ? '' : 's'}
              </summary>
              <ul className="warn-list">
                {ds.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}

          {ds.columnMapping && (
            <details className="map-details">
              <summary>Column mapping</summary>
              <ul className="map-list">
                {ds.columnMapping.map((m) => (
                  <li key={m.column}>
                    <code>{m.column}</code>
                    <span className="muted"> → {m.role}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="muted small original-note">
            Original file text preserved in project storage (
            {ds.originalText.length.toLocaleString()} characters). Not rewritten.
          </p>
        </li>
      ))}
    </ul>
  )
}

function DatasetSummaryView({ dataset }: { dataset: ImportedDataset }) {
  const s = dataset.summary
  switch (s.kind) {
    case 'fasta':
      return (
        <dl className="meta-grid compact">
          <div>
            <dt>Sequences</dt>
            <dd>{s.sequenceCount}</dd>
          </div>
          <div>
            <dt>Residues (sum)</dt>
            <dd>{s.totalResidues}</dd>
          </div>
          <div>
            <dt>Headers (up to 50)</dt>
            <dd className="small">{s.headers.slice(0, 3).join(' · ') || '—'}</dd>
          </div>
        </dl>
      )
    case 'pdb':
      return (
        <dl className="meta-grid compact">
          <div>
            <dt>ATOM</dt>
            <dd>{s.atomCount}</dd>
          </div>
          <div>
            <dt>HETATM</dt>
            <dd>{s.hetatmCount}</dd>
          </div>
          <div>
            <dt>Models</dt>
            <dd>{s.modelCount}</dd>
          </div>
          <div>
            <dt>Chains</dt>
            <dd>{s.chainIds.join(', ') || '—'}</dd>
          </div>
          {s.title && (
            <div>
              <dt>Title</dt>
              <dd className="small">{s.title}</dd>
            </div>
          )}
        </dl>
      )
    case 'mmcif':
      return (
        <dl className="meta-grid compact">
          <div>
            <dt>Data blocks</dt>
            <dd>{s.dataBlockIds.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt>Entry ID</dt>
            <dd>{s.entryId ?? '—'}</dd>
          </div>
          <div>
            <dt>_atom_site rows</dt>
            <dd>{s.atomSiteRows ?? '—'}</dd>
          </div>
          <div>
            <dt>Categories</dt>
            <dd className="small">
              {s.categoryNames.slice(0, 8).join(', ')}
              {s.categoryNames.length > 8 ? '…' : ''}
            </dd>
          </div>
        </dl>
      )
    case 'csv':
    case 'json':
      return (
        <dl className="meta-grid compact">
          <div>
            <dt>Rows</dt>
            <dd>{s.rowCount}</dd>
          </div>
          <div>
            <dt>Columns</dt>
            <dd>{s.columnNames.length}</dd>
          </div>
          <div>
            <dt>Names</dt>
            <dd className="small">{s.columnNames.join(', ') || '—'}</dd>
          </div>
        </dl>
      )
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
