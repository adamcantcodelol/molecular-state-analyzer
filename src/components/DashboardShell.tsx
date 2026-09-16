import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'
import { DatasetList } from './DatasetList'
import { ImportPanel } from './ImportPanel'

type Props = {
  project: Project
  onBack: () => void
  onSave: () => Promise<void>
  onAddDataset: (dataset: ImportedDataset) => Promise<void>
  onRemoveDataset: (id: string) => Promise<void>
  saving?: boolean
  importing?: boolean
  removingId?: string | null
  saveMessage?: string | null
}

export function DashboardShell({
  project,
  onBack,
  onSave,
  onAddDataset,
  onRemoveDataset,
  saving = false,
  importing = false,
  removingId = null,
  saveMessage = null,
}: Props) {
  const datasets = project.datasets ?? []

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-brand">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            ← Projects
          </button>
          <div>
            <p className="eyebrow">Molecular State Analyzer</p>
            <h1 className="dash-title">{project.name}</h1>
          </div>
        </div>
        <div className="row actions">
          {saveMessage && <span className="muted small">{saveMessage}</span>}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSave()}
            disabled={saving || importing}
          >
            {saving ? 'Saving…' : 'Save project'}
          </button>
        </div>
      </header>

      <main className="dash-main">
        <ImportPanel onCommit={onAddDataset} busy={importing || saving} />

        <section className="panel" aria-labelledby="datasets-heading">
          <div className="panel-head">
            <h2 id="datasets-heading" className="panel-title">
              Imported datasets
            </h2>
            <span className="muted small">
              {datasets.length} in this project
            </span>
          </div>
          <DatasetList
            datasets={datasets}
            onRemove={(id) => void onRemoveDataset(id)}
            removingId={removingId}
          />
        </section>

        <section className="panel dash-empty" aria-labelledby="shell-heading">
          <h2 id="shell-heading" className="panel-title">
            Dashboard
          </h2>
          <p className="muted">
            Analysis views stay empty until later phases. Import is the Phase 2
            feature — no charts or scores are invented here.
          </p>
          <dl className="meta-grid">
            <div>
              <dt>Project ID</dt>
              <dd>
                <code>{project.id}</code>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(project.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Last saved</dt>
              <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>IndexedDB (this browser)</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  )
}
