import type { Project } from '../types/project'

type Props = {
  projects: Project[]
  loading: boolean
  error: string | null
  onOpen: (id: string) => void
  onCreateClick: () => void
  onRefresh: () => void
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

export function ProjectList({
  projects,
  loading,
  error,
  onOpen,
  onCreateClick,
  onRefresh,
}: Props) {
  return (
    <div className="home">
      <header className="home-header">
        <div>
          <p className="eyebrow">Browser-only · protein-agnostic</p>
          <h1 className="app-title">Molecular State Analyzer</h1>
          <p className="lede">
            Free local workspace for molecular analysis projects. Phase 1:
            create and reopen projects that persist in your browser.
          </p>
        </div>
        <div className="row actions">
          <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={onCreateClick}>
            New project
          </button>
        </div>
      </header>

      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}

      <section className="panel" aria-labelledby="projects-heading">
        <div className="panel-head">
          <h2 id="projects-heading" className="panel-title">
            Projects
          </h2>
          <span className="muted small">
            {loading ? 'Loading…' : `${projects.length} stored locally`}
          </span>
        </div>

        {!loading && projects.length === 0 && (
          <div className="empty-state">
            <p>No projects yet.</p>
            <p className="muted">Create a project to open the empty dashboard shell.</p>
            <button type="button" className="btn btn-primary" onClick={onCreateClick}>
              Create your first project
            </button>
          </div>
        )}

        {projects.length > 0 && (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="project-card"
                  onClick={() => onOpen(p.id)}
                >
                  <span className="project-name">{p.name}</span>
                  <span className="project-meta muted small">
                    Updated {formatWhen(p.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
