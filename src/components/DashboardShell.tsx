import type { Project } from '../types/project'

type Props = {
  project: Project
  onBack: () => void
  onSave: () => Promise<void>
  saving?: boolean
  saveMessage?: string | null
}

export function DashboardShell({
  project,
  onBack,
  onSave,
  saving = false,
  saveMessage = null,
}: Props) {
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
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save project'}
          </button>
        </div>
      </header>

      <main className="dash-main">
        <section className="panel dash-empty" aria-labelledby="shell-heading">
          <h2 id="shell-heading" className="panel-title">
            Dashboard
          </h2>
          <p className="muted">
            This is an empty shell. Analysis views, structure viewers, and
            charts will land in later phases — nothing here pretends to analyze
            data yet.
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
