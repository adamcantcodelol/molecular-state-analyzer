import { useCallback, useEffect, useState } from 'react'
import { CreateProject } from './components/CreateProject'
import { DashboardShell } from './components/DashboardShell'
import { ProjectList } from './components/ProjectList'
import {
  createProject,
  getProject,
  listProjects,
  saveProject,
} from './db/projects'
import type { ImportedDataset } from './types/dataset'
import type { Project } from './types/project'

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'dashboard'; projectId: string }

const OPEN_PROJECT_KEY = 'msa:openProjectId'

function withDatasets(project: Project): Project {
  return {
    ...project,
    datasets: Array.isArray(project.datasets) ? project.datasets : [],
  }
}

export default function App() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [projects, setProjects] = useState<Project[]>([])
  const [openProject, setOpenProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const items = await listProjects()
      setProjects(items.map(withDatasets))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load projects from IndexedDB.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await refreshList()
      const savedId = sessionStorage.getItem(OPEN_PROJECT_KEY)
      if (savedId) {
        try {
          const project = await getProject(savedId)
          if (project) {
            setOpenProject(withDatasets(project))
            setView({ kind: 'dashboard', projectId: project.id })
          } else {
            sessionStorage.removeItem(OPEN_PROJECT_KEY)
          }
        } catch {
          sessionStorage.removeItem(OPEN_PROJECT_KEY)
        }
      }
    })()
  }, [refreshList])

  async function handleCreate(name: string) {
    setBusy(true)
    setError(null)
    try {
      const project = withDatasets(await createProject({ name }))
      sessionStorage.setItem(OPEN_PROJECT_KEY, project.id)
      setOpenProject(project)
      setView({ kind: 'dashboard', projectId: project.id })
      await refreshList()
    } finally {
      setBusy(false)
    }
  }

  async function handleOpen(id: string) {
    setError(null)
    try {
      const project = await getProject(id)
      if (!project) {
        setError('Project not found.')
        await refreshList()
        return
      }
      sessionStorage.setItem(OPEN_PROJECT_KEY, project.id)
      setOpenProject(withDatasets(project))
      setSaveMessage(null)
      setView({ kind: 'dashboard', projectId: project.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open project.')
    }
  }

  async function handleSave() {
    if (!openProject) return
    setSaving(true)
    setSaveMessage(null)
    try {
      const updated = withDatasets(await saveProject(openProject))
      setOpenProject(updated)
      setSaveMessage(`Saved ${new Date(updated.updatedAt).toLocaleTimeString()}`)
      await refreshList()
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddDataset(dataset: ImportedDataset) {
    if (!openProject) return
    setImporting(true)
    setSaveMessage(null)
    try {
      const next: Project = withDatasets({
        ...openProject,
        datasets: [...(openProject.datasets ?? []), dataset],
      })
      const updated = withDatasets(await saveProject(next))
      setOpenProject(updated)
      setSaveMessage(
        `Imported “${dataset.fileName}” · saved ${new Date(updated.updatedAt).toLocaleTimeString()}`,
      )
      await refreshList()
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Import save failed.',
      )
      throw err
    } finally {
      setImporting(false)
    }
  }

  async function handleRemoveDataset(id: string) {
    if (!openProject) return
    const target = (openProject.datasets ?? []).find((d) => d.id === id)
    if (!target) return
    const ok = window.confirm(
      `Remove “${target.fileName}” from this project? The original file on disk is untouched; only the copy stored in IndexedDB is deleted.`,
    )
    if (!ok) return

    setRemovingId(id)
    setSaveMessage(null)
    try {
      const next: Project = withDatasets({
        ...openProject,
        datasets: (openProject.datasets ?? []).filter((d) => d.id !== id),
      })
      const updated = withDatasets(await saveProject(next))
      setOpenProject(updated)
      setSaveMessage(
        `Removed “${target.fileName}” · saved ${new Date(updated.updatedAt).toLocaleTimeString()}`,
      )
      await refreshList()
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Remove failed.',
      )
    } finally {
      setRemovingId(null)
    }
  }

  function handleBack() {
    sessionStorage.removeItem(OPEN_PROJECT_KEY)
    setOpenProject(null)
    setSaveMessage(null)
    setView({ kind: 'list' })
    void refreshList()
  }

  return (
    <div className="app-shell">
      {view.kind === 'list' && (
        <ProjectList
          projects={projects}
          loading={loading}
          error={error}
          onOpen={(id) => void handleOpen(id)}
          onCreateClick={() => setView({ kind: 'create' })}
          onRefresh={() => void refreshList()}
        />
      )}

      {view.kind === 'create' && (
        <div className="home">
          <header className="home-header">
            <div>
              <p className="eyebrow">Molecular State Analyzer</p>
              <h1 className="app-title">Create project</h1>
            </div>
          </header>
          <CreateProject
            onCreate={handleCreate}
            onCancel={() => setView({ kind: 'list' })}
            busy={busy}
          />
        </div>
      )}

      {view.kind === 'dashboard' && openProject && (
        <DashboardShell
          project={openProject}
          onBack={handleBack}
          onSave={handleSave}
          onAddDataset={handleAddDataset}
          onRemoveDataset={handleRemoveDataset}
          saving={saving}
          importing={importing}
          removingId={removingId}
          saveMessage={saveMessage}
        />
      )}
    </div>
  )
}
