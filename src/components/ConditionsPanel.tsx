import { useMemo, useState } from 'react'
import {
  getConditions,
  newConditionId,
  removeCondition,
  upsertCondition,
} from '../conditions/persist'
import type { ConditionKv, ConditionRecord } from '../types/conditions'
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
  label: string
  scopeKind: 'project' | 'dataset'
  datasetId: string
  temperature: string
  ligandName: string
  concentration: string
  buffer: string
  notes: string
  extra: ConditionKv[]
}

function emptyDraft(datasets: ImportedDataset[]): Draft {
  return {
    id: null,
    label: '',
    scopeKind: 'project',
    datasetId: datasets[0]?.id ?? '',
    temperature: '',
    ligandName: '',
    concentration: '',
    buffer: '',
    notes: '',
    extra: [],
  }
}

function fromRecord(c: ConditionRecord): Draft {
  return {
    id: c.id,
    label: c.label,
    scopeKind: c.scope.kind,
    datasetId: c.scope.kind === 'dataset' ? c.scope.datasetId : '',
    temperature: c.temperature,
    ligandName: c.ligandName,
    concentration: c.concentration,
    buffer: c.buffer,
    notes: c.notes,
    extra: c.extra.map((e) => ({ ...e })),
  }
}

function scopeLabel(
  c: ConditionRecord,
  datasets: ImportedDataset[],
): string {
  if (c.scope.kind === 'project') return 'Entire project'
  const datasetId = c.scope.datasetId
  const ds = datasets.find((d) => d.id === datasetId)
  return ds ? `Dataset: ${ds.fileName}` : `Dataset id: ${datasetId}`
}

function summarize(c: ConditionRecord): string {
  const bits: string[] = []
  if (c.ligandName.trim()) bits.push(`ligand=${c.ligandName.trim()}`)
  if (c.temperature.trim()) bits.push(`T=${c.temperature.trim()}`)
  if (c.concentration.trim()) bits.push(`conc=${c.concentration.trim()}`)
  if (c.buffer.trim()) bits.push(`buffer=${c.buffer.trim()}`)
  for (const e of c.extra) {
    if (e.key.trim()) bits.push(`${e.key.trim()}=${e.value}`)
  }
  return bits.length ? bits.join(' · ') : '(no fields set)'
}

export function ConditionsPanel({
  project,
  datasets,
  onPersist,
  persisting = false,
}: Props) {
  const saved = getConditions(project)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(datasets))
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = draft.id !== null

  const datasetOptions = useMemo(
    () => datasets.map((d) => ({ id: d.id, name: d.fileName })),
    [datasets],
  )

  function resetDraft() {
    setDraft(emptyDraft(datasets))
    setError(null)
  }

  function setExtra(i: number, patch: Partial<ConditionKv>) {
    setDraft((d) => ({
      ...d,
      extra: d.extra.map((row, idx) =>
        idx === i ? { ...row, ...patch } : row,
      ),
    }))
  }

  async function handleSave() {
    setError(null)
    setStatus(null)
    if (draft.scopeKind === 'dataset') {
      if (!draft.datasetId || !datasets.some((d) => d.id === draft.datasetId)) {
        setError('Choose a dataset for dataset-scoped conditions.')
        return
      }
    }
    const extra = draft.extra
      .map((e) => ({ key: e.key.trim(), value: e.value }))
      .filter((e) => e.key.length > 0)
    const now = new Date().toISOString()
    const id = draft.id ?? newConditionId()
    const prev = draft.id
      ? saved.find((c) => c.id === draft.id)
      : undefined
    const record: ConditionRecord = {
      id,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      label: draft.label.trim(),
      scope:
        draft.scopeKind === 'dataset'
          ? { kind: 'dataset', datasetId: draft.datasetId }
          : { kind: 'project' },
      temperature: draft.temperature.trim(),
      ligandName: draft.ligandName.trim(),
      concentration: draft.concentration.trim(),
      buffer: draft.buffer.trim(),
      notes: draft.notes.trim(),
      extra,
    }

    setBusy(true)
    try {
      await onPersist(upsertCondition(project, record))
      setStatus(editing ? 'Condition updated.' : 'Condition saved.')
      resetDraft()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save condition.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    const target = saved.find((c) => c.id === id)
    if (!target) return
    const ok = window.confirm(
      `Remove condition “${target.label || target.id}”? This only updates project.state — imported originalText is untouched.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await onPersist(removeCondition(project, id))
      if (draft.id === id) resetDraft()
      setStatus('Condition removed.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove condition.',
      )
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || persisting

  return (
    <section className="panel conditions-panel" aria-labelledby="conditions-heading">
      <div className="panel-head">
        <h2 id="conditions-heading" className="panel-title">
          Experimental conditions
        </h2>
        <span className="muted small">{saved.length} saved</span>
      </div>
      <p className="muted">
        Attach arbitrary condition metadata to the <strong>project</strong> or
        a <strong>dataset</strong> (temperature, ligand, concentration, buffer,
        notes, plus free-form keys). Stored under{' '}
        <code>project.state.conditions</code> only — never mutates{' '}
        <code>originalText</code>.
      </p>

      <h3 className="subheading">
        {editing ? 'Edit condition' : 'Add condition'}
      </h3>

      <div className="explore-controls">
        <label className="field">
          <span className="field-label">Label (optional)</span>
          <input
            className="input"
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            disabled={disabled}
            placeholder="e.g. +ATP 25 °C"
          />
        </label>
        <label className="field">
          <span className="field-label">Scope</span>
          <select
            className="input select"
            value={draft.scopeKind}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                scopeKind: e.target.value as 'project' | 'dataset',
              }))
            }
            disabled={disabled}
          >
            <option value="project">Entire project</option>
            <option value="dataset">Specific dataset</option>
          </select>
        </label>
        {draft.scopeKind === 'dataset' && (
          <label className="field">
            <span className="field-label">Dataset</span>
            <select
              className="input select"
              value={
                draft.datasetId &&
                datasetOptions.some((o) => o.id === draft.datasetId)
                  ? draft.datasetId
                  : (datasetOptions[0]?.id ?? '')
              }
              onChange={(e) =>
                setDraft((d) => ({ ...d, datasetId: e.target.value }))
              }
              disabled={disabled || datasetOptions.length === 0}
            >
              {datasetOptions.length === 0 ? (
                <option value="">No datasets imported</option>
              ) : (
                datasetOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))
              )}
            </select>
          </label>
        )}
        <label className="field">
          <span className="field-label">Temperature</span>
          <input
            className="input"
            type="text"
            value={draft.temperature}
            onChange={(e) =>
              setDraft((d) => ({ ...d, temperature: e.target.value }))
            }
            disabled={disabled}
            placeholder="e.g. 25 °C"
          />
        </label>
        <label className="field">
          <span className="field-label">Ligand name</span>
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
        <label className="field">
          <span className="field-label">Concentration</span>
          <input
            className="input"
            type="text"
            value={draft.concentration}
            onChange={(e) =>
              setDraft((d) => ({ ...d, concentration: e.target.value }))
            }
            disabled={disabled}
            placeholder="e.g. 1 mM"
          />
        </label>
        <label className="field">
          <span className="field-label">Buffer</span>
          <input
            className="input"
            type="text"
            value={draft.buffer}
            onChange={(e) => setDraft((d) => ({ ...d, buffer: e.target.value }))}
            disabled={disabled}
            placeholder="e.g. HEPES pH 7.5"
          />
        </label>
      </div>

      <label className="field" style={{ marginTop: '0.75rem' }}>
        <span className="field-label">Notes</span>
        <textarea
          className="input"
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          disabled={disabled}
          placeholder="Free-text experimental notes"
        />
      </label>

      <div className="kv-block">
        <div className="row actions" style={{ justifyContent: 'space-between' }}>
          <h3 className="subheading" style={{ margin: 0 }}>
            Extra key–value fields
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={disabled}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                extra: [...d.extra, { key: '', value: '' }],
              }))
            }
          >
            + Add key
          </button>
        </div>
        {draft.extra.length === 0 ? (
          <p className="muted small">No free-form keys yet.</p>
        ) : (
          <ul className="kv-list">
            {draft.extra.map((row, i) => (
              <li key={i} className="kv-row">
                <input
                  className="input"
                  type="text"
                  value={row.key}
                  onChange={(e) => setExtra(i, { key: e.target.value })}
                  disabled={disabled}
                  placeholder="key"
                  aria-label={`Extra key ${i + 1}`}
                />
                <input
                  className="input"
                  type="text"
                  value={row.value}
                  onChange={(e) => setExtra(i, { value: e.target.value })}
                  disabled={disabled}
                  placeholder="value"
                  aria-label={`Extra value ${i + 1}`}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={disabled}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      extra: d.extra.filter((_, idx) => idx !== i),
                    }))
                  }
                >
                  Remove
                </button>
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
          {busy ? 'Saving…' : editing ? 'Update condition' : 'Save condition'}
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

      <h3 className="subheading">Saved conditions</h3>
      {saved.length === 0 ? (
        <p className="muted">No conditions yet.</p>
      ) : (
        <ul className="condition-list">
          {saved.map((c) => (
            <li key={c.id} className="condition-card">
              <div className="condition-card-head">
                <div>
                  <div className="dataset-name">
                    {c.label.trim() || 'Untitled condition'}
                  </div>
                  <div className="muted small">
                    {scopeLabel(c, datasets)}
                    {' · '}
                    updated {new Date(c.updatedAt).toLocaleString()}
                  </div>
                  <div className="muted small">{summarize(c)}</div>
                  {c.notes.trim() ? (
                    <p className="small" style={{ margin: '0.35rem 0 0' }}>
                      {c.notes}
                    </p>
                  ) : null}
                </div>
                <div className="row actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={disabled}
                    onClick={() => {
                      setDraft(fromRecord(c))
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
                    onClick={() => void handleRemove(c.id)}
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
