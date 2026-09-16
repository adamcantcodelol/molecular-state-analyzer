import { useState, type FormEvent } from 'react'

type Props = {
  onCreate: (name: string) => Promise<void>
  onCancel: () => void
  busy?: boolean
}

export function CreateProject({ onCreate, onCancel, busy = false }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a project name.')
      return
    }
    try {
      await onCreate(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project.')
    }
  }

  return (
    <div className="panel create-panel">
      <h2 className="panel-title">New project</h2>
      <p className="muted">
        Projects are stored in this browser only (IndexedDB). No data leaves your
        machine.
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Binding assay workspace"
            autoFocus
            disabled={busy}
            maxLength={120}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  )
}
