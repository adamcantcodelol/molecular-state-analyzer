import { useMemo, useState } from 'react'
import { getConditions, getHypotheses } from '../conditions/persist'
import {
  archiveNotebookEntry,
  appendNotebookEntry,
  captureProjectVersion,
  currentVersion,
  getNotebookEntries,
  getProjectVersions,
  removeNotebookEntry,
  removeProjectVersion,
} from '../notebook/persist'
import {
  buildResearchReport,
  researchReportToJson,
  researchReportToMarkdown,
} from '../notebook/exportReport'
import {
  EPISTEMIC_KIND_LABELS,
  NOTEBOOK_DISCLAIMER,
  NOTEBOOK_EPISTEMIC_KINDS,
  VERSIONING_DISCLAIMER,
  type NotebookEpistemicKind,
} from '../types/notebook'
import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'

type Props = {
  project: Project
  datasets: ImportedDataset[]
  onPersist: (next: Project) => Promise<void>
  persisting?: boolean
}

type Draft = {
  /** When set, save appends a new version to this entry. */
  editingId: string | null
  title: string
  body: string
  epistemicKind: NotebookEpistemicKind
  datasetIds: string[]
  conditionIds: string[]
  hypothesisIds: string[]
}

function emptyDraft(): Draft {
  return {
    editingId: null,
    title: '',
    body: '',
    epistemicKind: 'observation',
    datasetIds: [],
    conditionIds: [],
    hypothesisIds: [],
  }
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatWhen(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso || '—'
  return new Date(t).toLocaleString()
}

function safeFileSlug(name: string): string {
  const s = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48)
  return s || 'project'
}

export function NotebookPanel({
  project,
  datasets,
  onPersist,
  persisting = false,
}: Props) {
  const entries = getNotebookEntries(project)
  const versions = getProjectVersions(project)
  const conditions = getConditions(project)
  const hypotheses = getHypotheses(project)

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [showArchived, setShowArchived] = useState(false)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [versionLabel, setVersionLabel] = useState('')
  const [versionNotes, setVersionNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const visibleEntries = useMemo(
    () =>
      entries.filter((e) => (showArchived ? true : !e.archived)),
    [entries, showArchived],
  )

  const historyEntry = useMemo(
    () => (historyId ? entries.find((e) => e.id === historyId) ?? null : null),
    [entries, historyId],
  )

  const editing = draft.editingId !== null
  const disabled = busy || persisting

  function resetDraft() {
    setDraft(emptyDraft())
    setError(null)
  }

  async function handleSaveEntry() {
    setError(null)
    setStatus(null)
    if (!draft.title.trim() && !draft.body.trim()) {
      setError('Enter a title or body for this notebook entry.')
      return
    }
    setBusy(true)
    try {
      await onPersist(
        appendNotebookEntry(project, {
          id: draft.editingId ?? undefined,
          title: draft.title.trim(),
          body: draft.body.trim(),
          epistemicKind: draft.epistemicKind,
          datasetIds: draft.datasetIds,
          conditionIds: draft.conditionIds,
          hypothesisIds: draft.hypothesisIds,
        }),
      )
      setStatus(
        editing
          ? 'Appended new immutable version (prior versions kept).'
          : 'Notebook entry saved (version 1).',
      )
      resetDraft()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(entryId: string) {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return
    const cur = currentVersion(entry)
    setDraft({
      editingId: entry.id,
      title: cur.title,
      body: cur.body,
      epistemicKind: cur.epistemicKind,
      datasetIds: [...entry.datasetIds],
      conditionIds: [...entry.conditionIds],
      hypothesisIds: [...entry.hypothesisIds],
    })
    setError(null)
    setStatus(
      'Editing creates a new version — prior text stays in history.',
    )
  }

  async function handleArchive(id: string) {
    const target = entries.find((e) => e.id === id)
    if (!target) return
    const cur = currentVersion(target)
    const ok = window.confirm(
      `Archive notebook entry “${cur.title || target.id}”? History is retained; originalText untouched.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await onPersist(archiveNotebookEntry(project, id))
      if (draft.editingId === id) resetDraft()
      if (historyId === id) setHistoryId(null)
      setStatus('Entry archived (versions retained).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    const target = entries.find((e) => e.id === id)
    if (!target) return
    const cur = currentVersion(target)
    const ok = window.confirm(
      `Permanently remove notebook entry “${cur.title || target.id}” and all versions? Prefer Archive to keep history. originalText untouched.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await onPersist(removeNotebookEntry(project, id))
      if (draft.editingId === id) resetDraft()
      if (historyId === id) setHistoryId(null)
      setStatus('Entry removed from project.state.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCaptureVersion() {
    setError(null)
    setStatus(null)
    setBusy(true)
    try {
      await onPersist(
        captureProjectVersion(project, {
          label: versionLabel,
          notes: versionNotes,
        }),
      )
      setVersionLabel('')
      setVersionNotes('')
      setStatus('Project version snapshot saved (metadata only; no originalText).')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to capture version.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveVersion(id: string) {
    const target = versions.find((v) => v.id === id)
    if (!target) return
    const ok = window.confirm(
      `Remove project version “${target.label || target.id}”? Snapshots are otherwise immutable.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await onPersist(removeProjectVersion(project, id))
      setStatus('Project version removed.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove version.',
      )
    } finally {
      setBusy(false)
    }
  }

  function handleExportMarkdown() {
    const report = buildResearchReport(project)
    const md = researchReportToMarkdown(report)
    downloadBlob(
      `msa-report-${safeFileSlug(project.name)}.md`,
      md,
      'text/markdown;charset=utf-8',
    )
    setStatus('Downloaded Markdown report (Observations / Inferences / User hypotheses separated).')
  }

  function handleExportJson() {
    const report = buildResearchReport(project)
    const json = researchReportToJson(report)
    downloadBlob(
      `msa-report-${safeFileSlug(project.name)}.json`,
      json,
      'application/json;charset=utf-8',
    )
    setStatus('Downloaded JSON report (sections never conflated).')
  }

  const reportPreview = useMemo(() => buildResearchReport(project), [project])

  return (
    <section
      className="panel notebook-panel"
      aria-labelledby="notebook-heading"
    >
      <div className="panel-head">
        <h2 id="notebook-heading" className="panel-title">
          Lab notebook &amp; reports
        </h2>
        <span className="pill pill-notebook" title={NOTEBOOK_DISCLAIMER}>
          Append-only
        </span>
      </div>

      <div className="warn-box notebook-disclaimer" role="note">
        <strong>Lab notebook.</strong> {NOTEBOOK_DISCLAIMER}{' '}
        {VERSIONING_DISCLAIMER} Persisted under{' '}
        <code>project.state.notebookEntries</code> and{' '}
        <code>project.state.projectVersions</code> only.
      </div>

      {/* —— Entry form —— */}
      <h3 className="subheading">
        {editing
          ? 'Append new version (prior versions kept)'
          : 'New notebook entry'}
      </h3>
      <p className="muted small">
        Classify as <strong>Observation</strong> or <strong>Inference</strong>{' '}
        so exports keep them apart. User hypotheses live in the Hypotheses
        panel and appear only under that section in reports — never merged
        here as evidence.
      </p>

      <div className="explore-controls">
        <label className="field">
          <span className="field-label">Epistemic kind</span>
          <select
            className="input"
            value={draft.epistemicKind}
            disabled={disabled}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                epistemicKind: e.target.value as NotebookEpistemicKind,
              }))
            }
          >
            {NOTEBOOK_EPISTEMIC_KINDS.map((k) => (
              <option key={k} value={k}>
                {EPISTEMIC_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="field field-grow">
          <span className="field-label">Title</span>
          <input
            className="input"
            type="text"
            value={draft.title}
            disabled={disabled}
            placeholder="Short label"
            onChange={(e) =>
              setDraft((d) => ({ ...d, title: e.target.value }))
            }
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Body</span>
        <textarea
          className="input"
          rows={4}
          value={draft.body}
          disabled={disabled}
          placeholder="What you observed or inferred — keep kinds honest"
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
        />
      </label>

      {datasets.length > 0 && (
        <div className="link-block">
          <span className="field-label">Link datasets (optional)</span>
          <div className="chip-row">
            {datasets.map((ds) => (
              <label key={ds.id} className="chip-check">
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
                  {ds.synthetic ? ' (SYNTHETIC)' : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {conditions.length > 0 && (
        <div className="link-block">
          <span className="field-label">Link conditions (optional)</span>
          <div className="chip-row">
            {conditions.map((c) => (
              <label key={c.id} className="chip-check">
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
                <span>
                  {c.label.trim() ||
                    c.ligandName.trim() ||
                    c.id.slice(0, 8)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {hypotheses.length > 0 && (
        <div className="link-block">
          <span className="field-label">
            Link user hypotheses (optional — still not evidence)
          </span>
          <div className="chip-row">
            {hypotheses.map((h) => (
              <label key={h.id} className="chip-check">
                <input
                  type="checkbox"
                  checked={draft.hypothesisIds.includes(h.id)}
                  disabled={disabled}
                  onChange={() =>
                    setDraft((d) => ({
                      ...d,
                      hypothesisIds: toggleId(d.hypothesisIds, h.id),
                    }))
                  }
                />
                <span>{h.title.trim() || h.id.slice(0, 8)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="row actions" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          onClick={() => void handleSaveEntry()}
        >
          {editing ? 'Append version' : 'Save entry'}
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

      {/* —— Entry list —— */}
      <div className="panel-head" style={{ marginTop: '1.25rem' }}>
        <h3 className="subheading" style={{ margin: 0 }}>
          Entries ({visibleEntries.length}
          {!showArchived && entries.some((e) => e.archived)
            ? ` · ${entries.filter((e) => e.archived).length} archived hidden`
            : ''}
          )
        </h3>
        <label className="chip-check">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <span className="small">Show archived</span>
        </label>
      </div>

      {visibleEntries.length === 0 ? (
        <div className="empty-state">
          <p>No notebook entries yet.</p>
          <p className="muted">
            Add observations and inferences above. They persist under{' '}
            <code>project.state.notebookEntries</code> with immutable version
            history.
          </p>
        </div>
      ) : (
        <ul className="notebook-list">
          {visibleEntries.map((entry) => {
            const cur = currentVersion(entry)
            return (
              <li
                key={entry.id}
                className={`notebook-card${entry.archived ? ' is-archived' : ''}`}
              >
                <div className="notebook-card-head">
                  <strong>{cur.title.trim() || '(untitled)'}</strong>
                  <span
                    className={`pill pill-epistemic pill-epistemic-${cur.epistemicKind}`}
                  >
                    {EPISTEMIC_KIND_LABELS[cur.epistemicKind]}
                  </span>
                  {entry.archived && (
                    <span className="pill">Archived</span>
                  )}
                </div>
                <p className="muted small">
                  v{cur.version}/{entry.versions.length} · updated{' '}
                  {formatWhen(entry.updatedAt)} · id{' '}
                  <code>{entry.id.slice(0, 8)}</code>
                </p>
                <p className="notebook-body-preview">
                  {cur.body.trim() || '_(empty)_'}
                </p>
                <div className="row actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={disabled || Boolean(entry.archived)}
                    onClick={() => startEdit(entry.id)}
                  >
                    Edit (new version)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setHistoryId(
                        historyId === entry.id ? null : entry.id,
                      )
                    }
                  >
                    {historyId === entry.id ? 'Hide history' : 'History'}
                  </button>
                  {!entry.archived && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={disabled}
                      onClick={() => void handleArchive(entry.id)}
                    >
                      Archive
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={disabled}
                    onClick={() => void handleRemove(entry.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {historyEntry && (
        <div className="notebook-history" role="region" aria-label="Version history">
          <h4 className="planner-section-title">
            Version history — {currentVersion(historyEntry).title || historyEntry.id}
          </h4>
          <p className="muted small">
            Immutable revisions (newest last). Edits never rewrite prior versions.
          </p>
          <ol className="notebook-version-list">
            {historyEntry.versions.map((v) => (
              <li key={v.version}>
                <div className="notebook-card-head">
                  <strong>
                    v{v.version}: {v.title.trim() || '(untitled)'}
                  </strong>
                  <span
                    className={`pill pill-epistemic pill-epistemic-${v.epistemicKind}`}
                  >
                    {EPISTEMIC_KIND_LABELS[v.epistemicKind]}
                  </span>
                </div>
                <p className="muted small">{formatWhen(v.createdAt)}</p>
                <pre className="notebook-version-body">{v.body || '_(empty)_'}</pre>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* —— Project versioning —— */}
      <h3 className="subheading" style={{ marginTop: '1.5rem' }}>
        Project versioning
      </h3>
      <p className="muted">
        Capture a timestamped snapshot of dataset metadata and{' '}
        <code>project.state</code> summary counts. Does not copy{' '}
        <code>originalText</code>.
      </p>
      <div className="explore-controls">
        <label className="field field-grow">
          <span className="field-label">Label</span>
          <input
            className="input"
            type="text"
            value={versionLabel}
            disabled={disabled}
            placeholder="e.g. Before ligand series"
            onChange={(e) => setVersionLabel(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Notes</span>
        <textarea
          className="input"
          rows={2}
          value={versionNotes}
          disabled={disabled}
          placeholder="Optional context for this snapshot"
          onChange={(e) => setVersionNotes(e.target.value)}
        />
      </label>
      <div className="row actions" style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          onClick={() => void handleCaptureVersion()}
        >
          Capture version snapshot
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          No project versions yet.
        </p>
      ) : (
        <ul className="notebook-list" style={{ marginTop: '0.75rem' }}>
          {versions.map((v) => (
            <li key={v.id} className="notebook-card">
              <div className="notebook-card-head">
                <strong>{v.label || '(unlabeled)'}</strong>
                <span className="pill pill-version">Snapshot</span>
              </div>
              <p className="muted small">
                {formatWhen(v.createdAt)} · {v.datasetMeta.length} dataset
                {v.datasetMeta.length === 1 ? '' : 's'} · hmm=
                {v.stateSummary.hmmRunCount}, hyp=
                {v.stateSummary.hypothesisCount}, nb=
                {v.stateSummary.notebookEntryCount}
              </p>
              {v.notes.trim() && <p>{v.notes}</p>}
              <p className="muted small">
                Fingerprint: <code>{v.stateFingerprint.slice(0, 64)}…</code>
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={disabled}
                onClick={() => void handleRemoveVersion(v.id)}
              >
                Remove snapshot
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* —— Export —— */}
      <h3 className="subheading" style={{ marginTop: '1.5rem' }}>
        Research report export
      </h3>
      <p className="muted">
        Exports Markdown and/or JSON with separate sections:{' '}
        <strong>Observations</strong> / <strong>Inferences</strong> /{' '}
        <strong>User hypotheses</strong>. Counts below reflect the current
        project (read-only build; originals not included).
      </p>
      <div className="stats-count-row" aria-label="Report section counts">
        <span className="stats-count">
          <span className="pill pill-epistemic pill-epistemic-observation">
            Observations
          </span>{' '}
          {reportPreview.sections.observations.length}
        </span>
        <span className="stats-count">
          <span className="pill pill-epistemic pill-epistemic-inference">
            Inferences
          </span>{' '}
          {reportPreview.sections.inferences.length}
        </span>
        <span className="stats-count">
          <span className="pill pill-hypothesis">User hypotheses</span>{' '}
          {reportPreview.sections.userHypotheses.length}
        </span>
        {reportPreview.sections.otherNotes.length > 0 && (
          <span className="stats-count">
            <span className="pill pill-epistemic pill-epistemic-note">
              Other notes
            </span>{' '}
            {reportPreview.sections.otherNotes.length}
          </span>
        )}
      </div>
      <div className="row actions" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          onClick={handleExportMarkdown}
        >
          Download Markdown
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={disabled}
          onClick={handleExportJson}
        >
          Download JSON
        </button>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="muted small" role="status">
          {status}
        </p>
      )}
    </section>
  )
}
