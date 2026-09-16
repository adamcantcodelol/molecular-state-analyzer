import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'
import { DatasetList } from './DatasetList'
import { HmmPanel } from './HmmPanel'
import { BootstrapPanel } from './BootstrapPanel'
import { ModelComparePanel } from './ModelComparePanel'
import { ImportPanel } from './ImportPanel'
import { RawDataExplorer } from './RawDataExplorer'

type Props = {
  project: Project
  onBack: () => void
  onSave: () => Promise<void>
  onAddDataset: (dataset: ImportedDataset) => Promise<void>
  onRemoveDataset: (id: string) => Promise<void>
  /** Persist project (e.g. HMM runs under state) without inventing analysis claims. */
  onPersistProject: (project: Project) => Promise<void>
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
  onPersistProject,
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

        <RawDataExplorer datasets={datasets} />

        <HmmPanel
          project={project}
          datasets={datasets}
          onPersistRun={onPersistProject}
          persisting={saving}
        />

        <ModelComparePanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <BootstrapPanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <section className="panel dash-meta" aria-labelledby="shell-heading">
          <h2 id="shell-heading" className="panel-title">
            Project details
          </h2>
          <p className="muted">
            Phases 4–6: Gaussian HMM (Baum–Welch + Viterbi) in a Web Worker,
            K=2 vs K=3 AIC/BIC comparison, and moving-block bootstrap
            uncertainty. Latent states are unsupervised statistical indices —
            not biophysical names. Imported <code>originalText</code> is never
            mutated; runs/comparisons/bootstraps live under{' '}
            <code>project.state</code>.
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
