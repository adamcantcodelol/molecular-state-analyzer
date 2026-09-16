import { useMemo, useState } from 'react'
import {
  getConditions,
  getHypotheses,
  newHypothesisId,
  removeHypothesis,
  upsertHypothesis,
} from '../conditions/persist'
import {
  HYPOTHESIS_DISCLAIMER,
  HYPOTHESIS_KIND,
  HYPOTHESIS_UI_LABEL,
  type UserHypothesis,
} from '../types/conditions'
import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'

type Props = {
  project: Project
  datasets: ImportedDataset[]
  onPersist: (next: Project) => Promise<void>
  persisting?: boolean
}

type Draft = {
  id: string | null
  title: string
  idea: string
  ligandName: string
  stateNotes: string
  conditionIds: string[]
  datasetIds: string[]
}

function emptyDraft(): Draft {
  return {
    id: null,
    title: '',
    idea: '',
    ligandName: '',
    stateNotes: '',
    conditionIds: [],
    datasetIds: [],
  }
}

function fromRecord(h: UserHypothesis): Draft {
  return {
    id: h.id,
    title: h.title,
    idea: h.idea,
    ligandName: h.ligandName,
    stateNotes: h.stateNotes,
    conditionIds: [...h.conditionIds],
    datasetIds: [...h.datasetIds],
  }
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function HypothesesPanel({
  project,
  datasets,
  onPersist,
  persisting = false,
}: Props) {
  const conditions = getConditions(project)
  const saved = getHypotheses(project)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = draft.id !== null

  const conditionOptions = useMemo(
    () =>
      conditions.map((c) => ({
        id: c.id,
        label:
          c.label.trim() ||
          (c.ligandName.trim()
            ? `Ligand ${c.ligandName.trim()}`
            : `Condition ${c.id.slice(0, 8)}`),
      })),
    [conditions],
  )

  function resetDraft() {
    setDraft(emptyDraft())
    setError(null)
  }

  async function handleSave() {
    setError(null)
    setStatus(null)
    if (!draft.title.trim() && !draft.idea.trim()) {
      setError('Enter a title or idea text for this user hypothesis.')
      return
    }
    const now = new Date().toISOString()
    const id = draft.id ?? newHypothesisId()
    const prev = draft.id
      ? saved.find((h) => h.id === draft.id)
      : undefined
    const record: UserHypothesis = {
      id,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      kind: HYPOTHESIS_KIND,
      title: draft.title.trim(),
      idea: draft.idea.trim(),
      ligandName: draft.ligandName.trim(),
      stateNotes: draft.stateNotes.trim(),
      conditionIds: draft.conditionIds,
      datasetIds: draft.datasetIds,
    }

    setBusy(true)
    try {
      await onPersist(upsertHypothesis(project, record))
      setStatus(
        editing
          ? 'User hypothesis updated (still not evidence).'
          : 'User hypothesis saved (not evidence / not proven).',
      )
      resetDraft()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save hypothesis.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    const target = saved.find((h) => h.id === id)
    if (!target) return
    const ok = window.confirm(
      `Remove user hypothesis “${target.title || target.id}”? Stored only under project.state — originalText is untouched.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await onPersist(removeHypothesis(project, id))
      if (draft.id === id) resetDraft()
      setStatus('User hypothesis removed.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove hypothesis.',
      )
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || persisting

  return (
    <section
      className="panel hypotheses-panel"
      aria-labelledby="hypotheses-heading"
    >
      <div className="panel-head">
        <h2 id="hypotheses-heading" className="panel-title">
          Ligand / state hypotheses
        </h2>
        <span className="pill pill-hypothesis" title={HYPOTHESIS_DISCLAIMER}>
          {HYPOTHESIS_UI_LABEL}
        </span>
      </div>

      <div className="warn-box hypothesis-disclaimer" role="note">
        <strong>{HYPOTHESIS_UI_LABEL}.</strong> {HYPOTHESIS_DISCLAIMER} These
        records are notebook annotations linking ligands or conditions to ideas
        about states — they are <em>not</em> HMM output, not statistical
        evidence, and never auto-promoted to a scientific conclusion.
      </div>

      <p className="muted">
        Create hypotheses that connect ligands/conditions to ideas about
        latent states. Persisted under <code>project.state.hypotheses</code>{' '}
        only.
      </p>

      <h3 className="subheading">
        {editing ? 'Edit user hypothesis' : 'New user hypothesis'}
      </h3>

      <div className="explore-controls">
        <label className="field">
          <span className="field-label">Title</span>
          <input
            className="input"
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            disabled={disabled}
            placeholder="e.g. Hypothesis: ligand-bound ≈ high-FRET latent state? (not proven)"
          />
        </label>
        <label className="field">
          <span className="field-label">Ligand name (optional)</span>
          <input
            className="input"
            type="text"
            value={draft.ligandName}
            onChange={(e) =>
              setDraft((d) => ({ ...d, ligandName: e.target.value }))
            }
            disabled={disabled}
            placeholder="e.g. ATP"
          />
        </label>
      </div>

      <label className="field" style={{ marginTop: '0.75rem' }}>
        <span className="field-label">Idea (user speculation)</span>
        <textarea
          className="input"
          rows={3}
          value={draft.idea}
          onChange={(e) => setDraft((d) => ({ ...d, idea: e.target.value }))}
          disabled={disabled}
          placeholder="Describe your hypothesis about how ligand/conditions relate to states…"
        />
      </label>

      <label className="field" style={{ marginTop: '0.75rem' }}>
        <span className="field-label">
          State notes (optional — still a user hypothesis)
        </span>
        <textarea
          className="input"
          rows={2}
          value={draft.stateNotes}
          onChange={(e) =>
            setDraft((d) => ({ ...d, stateNotes: e.target.value }))
          }
          disabled={disabled}
          placeholder='e.g. “Maybe state 0 ≈ unbound, state 1 ≈ bound” — not proven'
        />
      </label>

      <div className="link-block">
        <h3 className="subheading">Link conditions (optional)</h3>
        {conditionOptions.length === 0 ? (
          <p className="muted small">
            No saved conditions yet — add some in Experimental conditions.
          </p>
        ) : (
          <ul className="check-list">
            {conditionOptions.map((c) => (
              <li key={c.id}>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={draft.conditionIds.includes(c.id)}
                    disabled={disabled}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        conditionIds: toggleId(d.conditionIds, c.id),
                      }))
                    }
                  />
                  <span>{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="link-block">
        <h3 className="subheading">Link datasets (optional)</h3>
        {datasets.length === 0 ? (
          <p className="muted small">No datasets in this project.</p>
        ) : (
          <ul className="check-list">
            {datasets.map((ds) => (
              <li key={ds.id}>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={draft.datasetIds.includes(ds.id)}
                    disabled={disabled}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        datasetIds: toggleId(d.datasetIds, ds.id),
                      }))
                    }
                  />
                  <span>
                    {ds.fileName}
                    {ds.synthetic ? (
                      <span className="pill pill-synthetic"> SYNTHETIC</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="row actions hmm-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          onClick={() => void handleSave()}
        >
          {busy
            ? 'Saving…'
            : editing
              ? 'Update user hypothesis'
              : 'Save user hypothesis'}
        </button>
        {editing && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={disabled}
            onClick={resetDraft}
          >
            Cancel edit
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="muted small" role="status">
          {status}
        </p>
      )}

      <h3 className="subheading">Saved user hypotheses</h3>
      {saved.length === 0 ? (
        <p className="muted">No user hypotheses yet.</p>
      ) : (
        <ul className="hypothesis-list">
          {saved.map((h) => (
            <li key={h.id} className="hypothesis-card">
              <div className="hypothesis-card-head">
                <div>
                  <div className="dataset-name">
                    {h.title.trim() || 'Untitled idea'}
                    <span
                      className="pill pill-hypothesis"
                      title={HYPOTHESIS_DISCLAIMER}
                    >
                      {' '}
                      {HYPOTHESIS_UI_LABEL}
                    </span>
                  </div>
                  <div className="muted small">
                    kind=<code>{h.kind}</code>
                    {' · '}
                    updated {new Date(h.updatedAt).toLocaleString()}
                    {h.ligandName.trim()
                      ? ` · ligand=${h.ligandName.trim()}`
                      : ''}
                  </div>
                  {h.idea.trim() ? (
                    <p className="small" style={{ margin: '0.35rem 0 0' }}>
                      {h.idea}
                    </p>
                  ) : null}
                  {h.stateNotes.trim() ? (
                    <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
                      State notes (user speculation): {h.stateNotes}
                    </p>
                  ) : null}
                  {(h.conditionIds.length > 0 || h.datasetIds.length > 0) && (
                    <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
                      Links: {h.conditionIds.length} condition
                      {h.conditionIds.length === 1 ? '' : 's'},{' '}
                      {h.datasetIds.length} dataset
                      {h.datasetIds.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                <div className="row actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={disabled}
                    onClick={() => {
                      setDraft(fromRecord(h))
                      setError(null)
                      setStatus(null)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={disabled}
                    onClick={() => void handleRemove(h.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
