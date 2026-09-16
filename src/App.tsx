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
import type { Project } from './types/project'

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'dashboard'; projectId: string }

const OPEN_PROJECT_KEY = 'msa:openProjectId'

export default function App() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [projects, setProjects] = useState<Project[]>([])
  const [openProject, setOpenProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const items = await listProjects()
      setProjects(items)
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
            setOpenProject(project)
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
      const project = await createProject({ name })
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
      setOpenProject(project)
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
      const updated = await saveProject(openProject)
      setOpenProject(updated)
      setSaveMessage(`Saved ${new Date(updated.updatedAt).toLocaleTimeString()}`)
      await refreshList()
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Save failed.',
      )
    } finally {
      setSaving(false)
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
          saving={saving}
          saveMessage={saveMessage}
        />
      )}
    </div>
  )
}
