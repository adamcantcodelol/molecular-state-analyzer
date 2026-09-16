import { useMemo, useState } from 'react'
import { getConditions, getHypotheses } from '../conditions/persist'
import {
  getMultimodalLinks,
  newMultimodalLinkId,
  removeMultimodalLink,
  upsertMultimodalLink,
} from '../multimodal/persist'
import {
  datasetModalityTag,
  inferDatasetModality,
  modalityLabel,
} from '../multimodal/modality'
import {
  HYPOTHESIS_UI_LABEL,
  type ConditionRecord,
  type UserHypothesis,
} from '../types/conditions'
import type { ImportedDataset } from '../types/dataset'
import {
  MULTIMODAL_DISCLAIMER,
  MULTIMODAL_UI_LABEL,
  type ModalityKind,
  type MultimodalLink,
  type MultimodalMember,
} from '../types/multimodal'
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
  notes: string
  datasetIds: string[]
  conditionIds: string[]
  hypothesisIds: string[]
}

type CompareMode = 'side_by_side' | 'tabs'

function emptyDraft(): Draft {
  return {
    id: null,
    label: '',
    notes: '',
    datasetIds: [],
    conditionIds: [],
    hypothesisIds: [],
  }
}

function fromRecord(link: MultimodalLink): Draft {
  return {
    id: link.id,
    label: link.label,
    notes: link.notes,
    datasetIds: link.members
      .filter((m): m is Extract<MultimodalMember, { kind: 'dataset' }> =>
        m.kind === 'dataset',
      )
      .map((m) => m.datasetId),
    conditionIds: link.members
      .filter((m): m is Extract<MultimodalMember, { kind: 'condition' }> =>
        m.kind === 'condition',
      )
      .map((m) => m.conditionId),
    hypothesisIds: link.members
      .filter((m): m is Extract<MultimodalMember, { kind: 'hypothesis' }> =>
        m.kind === 'hypothesis',
      )
      .map((m) => m.hypothesisId),
  }
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function buildMembers(
  draft: Draft,
  datasets: ImportedDataset[],
): MultimodalMember[] {
  const members: MultimodalMember[] = []
  for (const datasetId of draft.datasetIds) {
    const ds = datasets.find((d) => d.id === datasetId)
    members.push({
      kind: 'dataset',
      datasetId,
      modality: ds ? inferDatasetModality(ds) : 'other',
    })
  }
  for (const conditionId of draft.conditionIds) {
    members.push({
      kind: 'condition',
      conditionId,
      modality: 'conditions',
    })
  }
  for (const hypothesisId of draft.hypothesisIds) {
    members.push({
      kind: 'hypothesis',
      hypothesisId,
      modality: 'user_hypothesis',
    })
  }
  return members
}

function modalityPillClass(kind: ModalityKind): string {
  switch (kind) {
    case 'structure':
      return 'pill pill-modality pill-modality-structure'
    case 'sequence':
      return 'pill pill-modality pill-modality-sequence'
    case 'time_series':
      return 'pill pill-modality pill-modality-timeseries'
    case 'tabular':
      return 'pill pill-modality pill-modality-tabular'
    case 'conditions':
      return 'pill pill-modality pill-modality-conditions'
    case 'user_hypothesis':
      return 'pill pill-hypothesis'
    default:
      return 'pill pill-modality'
  }
}

type Pane =
  | {
      key: string
      modality: ModalityKind
      title: string
      subtitle: string
      body: 'dataset' | 'condition' | 'hypothesis'
      dataset?: ImportedDataset
      condition?: ConditionRecord
      hypothesis?: UserHypothesis
    }

function resolvePanes(
  link: MultimodalLink,
  datasets: ImportedDataset[],
  conditions: ConditionRecord[],
  hypotheses: UserHypothesis[],
): Pane[] {
  const panes: Pane[] = []
  for (const m of link.members) {
    if (m.kind === 'dataset') {
      const ds = datasets.find((d) => d.id === m.datasetId)
      const modality = ds ? inferDatasetModality(ds) : m.modality
      panes.push({
        key: `ds:${m.datasetId}`,
        modality,
        title: ds?.fileName ?? `(missing dataset ${m.datasetId.slice(0, 8)})`,
        subtitle: ds
          ? datasetModalityTag(ds)
          : modalityLabel(modality),
        body: 'dataset',
        dataset: ds,
      })
    } else if (m.kind === 'condition') {
      const c = conditions.find((x) => x.id === m.conditionId)
      panes.push({
        key: `cond:${m.conditionId}`,
        modality: 'conditions',
        title:
          c?.label.trim() ||
          (c?.ligandName.trim()
            ? `Ligand ${c.ligandName.trim()}`
            : `Condition ${m.conditionId.slice(0, 8)}`),
        subtitle: modalityLabel('conditions'),
        body: 'condition',
        condition: c,
      })
    } else {
      const h = hypotheses.find((x) => x.id === m.hypothesisId)
      panes.push({
        key: `hyp:${m.hypothesisId}`,
        modality: 'user_hypothesis',
        title: h?.title.trim() || `Hypothesis ${m.hypothesisId.slice(0, 8)}`,
        subtitle: HYPOTHESIS_UI_LABEL,
        body: 'hypothesis',
        hypothesis: h,
      })
    }
  }
  return panes
}

function DatasetPaneBody({ dataset }: { dataset?: ImportedDataset }) {
  if (!dataset) {
    return (
      <p className="muted small">
        Dataset no longer in this project (orphaned link member).
      </p>
    )
  }
  const s = dataset.summary
  const bits: string[] = []
  if (s.kind === 'pdb') {
    bits.push(`${s.atomCount} ATOM`, `${s.chainIds.length} chains`)
    if (s.title) bits.push(s.title)
  } else if (s.kind === 'mmcif') {
    bits.push(
      `${s.dataBlockIds.length} block(s)`,
      s.atomSiteRows != null ? `${s.atomSiteRows} _atom_site rows` : '',
    )
  } else if (s.kind === 'fasta') {
    bits.push(`${s.sequenceCount} seq`, `${s.totalResidues} residues`)
  } else {
    bits.push(`${s.rowCount} rows`, `${s.columnNames.length} columns`)
  }
  return (
    <div>
      <dl className="meta-grid compact">
        <div>
          <dt>Format</dt>
          <dd>
            <code>{dataset.format}</code>
          </dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{dataset.byteLength.toLocaleString()} bytes</dd>
        </div>
        <div>
          <dt>Summary</dt>
          <dd>{bits.filter(Boolean).join(' · ') || '—'}</dd>
        </div>
        {dataset.synthetic ? (
          <div>
            <dt>Origin</dt>
            <dd>
              <span className="pill pill-synthetic">SYNTHETIC</span>
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="muted small">
        originalText preserved ({dataset.originalText.length.toLocaleString()}{' '}
        chars) — not rewritten by linking.
      </p>
      <p className="muted small">
        Open the modality-specific panel (3D viewer, Raw explorer, smFRET,
        HMM, …) for detailed analysis. This pane only labels the linked
        modality type (not a joint scientific claim).
      </p>
    </div>
  )
}

function ConditionPaneBody({ condition }: { condition?: ConditionRecord }) {
  if (!condition) {
    return (
      <p className="muted small">
        Condition no longer saved (orphaned link member).
      </p>
    )
  }
  const bits: string[] = []
  if (condition.ligandName.trim())
    bits.push(`ligand=${condition.ligandName.trim()}`)
  if (condition.temperature.trim())
    bits.push(`T=${condition.temperature.trim()}`)
  if (condition.concentration.trim())
    bits.push(`conc=${condition.concentration.trim()}`)
  if (condition.buffer.trim()) bits.push(`buffer=${condition.buffer.trim()}`)
  for (const e of condition.extra) {
    if (e.key.trim()) bits.push(`${e.key.trim()}=${e.value}`)
  }
  return (
    <div>
      <p className="muted small">
        Scope:{' '}
        {condition.scope.kind === 'project'
          ? 'Entire project'
          : `Dataset ${condition.scope.datasetId.slice(0, 8)}…`}
      </p>
      <p>{bits.length ? bits.join(' · ') : '(no fields set)'}</p>
      {condition.notes.trim() ? (
        <p className="muted small">{condition.notes.trim()}</p>
      ) : null}
    </div>
  )
}

function HypothesisPaneBody({ hypothesis }: { hypothesis?: UserHypothesis }) {
  if (!hypothesis) {
    return (
      <p className="muted small">
        Hypothesis no longer saved (orphaned link member).
      </p>
    )
  }
  return (
    <div>
      <p>
        <span className="pill pill-hypothesis">{HYPOTHESIS_UI_LABEL}</span>
        <span className="muted small"> · kind={hypothesis.kind}</span>
      </p>
      {hypothesis.idea.trim() ? (
        <p style={{ marginTop: '0.5rem' }}>{hypothesis.idea.trim()}</p>
      ) : null}
      {hypothesis.ligandName.trim() ? (
        <p className="muted small">Ligand: {hypothesis.ligandName.trim()}</p>
      ) : null}
      {hypothesis.stateNotes.trim() ? (
        <p className="muted small">
          State notes (user only): {hypothesis.stateNotes.trim()}
        </p>
      ) : null}
      <p className="muted small" style={{ marginTop: '0.5rem' }}>
        Not evidence · not a scientific conclusion · linking does not promote
        this hypothesis.
      </p>
    </div>
  )
}

function ComparisonView({
  panes,
  mode,
  activeTab,
  onTab,
}: {
  panes: Pane[]
  mode: CompareMode
  activeTab: string
  onTab: (key: string) => void
}) {
  if (panes.length === 0) {
    return <p className="muted">This bundle has no members yet.</p>
  }

  if (mode === 'tabs') {
    const active = panes.find((p) => p.key === activeTab) ?? panes[0]!
    return (
      <div className="mm-compare mm-compare-tabs">
        <div className="mm-tablist" role="tablist" aria-label="Modality tabs">
          {panes.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={p.key === active.key}
              className={
                p.key === active.key
                  ? 'btn btn-sm mm-tab is-active'
                  : 'btn btn-ghost btn-sm mm-tab'
              }
              onClick={() => onTab(p.key)}
            >
              <span className={modalityPillClass(p.modality)}>
                {modalityLabel(p.modality)}
              </span>{' '}
              <span className="mm-tab-title">{p.title}</span>
            </button>
          ))}
        </div>
        <article
          className="mm-pane"
          role="tabpanel"
          aria-label={`${modalityLabel(active.modality)}: ${active.title}`}
        >
          <header className="mm-pane-head">
            <span className={modalityPillClass(active.modality)}>
              {modalityLabel(active.modality)}
            </span>
            <strong>{active.title}</strong>
            <span className="muted small">{active.subtitle}</span>
          </header>
          {active.body === 'dataset' && (
            <DatasetPaneBody dataset={active.dataset} />
          )}
          {active.body === 'condition' && (
            <ConditionPaneBody condition={active.condition} />
          )}
          {active.body === 'hypothesis' && (
            <HypothesisPaneBody hypothesis={active.hypothesis} />
          )}
        </article>
      </div>
    )
  }

  return (
    <div className="mm-compare mm-compare-side">
      {panes.map((p) => (
        <article
          key={p.key}
          className="mm-pane"
          aria-label={`${modalityLabel(p.modality)}: ${p.title}`}
        >
          <header className="mm-pane-head">
            <span className={modalityPillClass(p.modality)}>
              {modalityLabel(p.modality)}
            </span>
            <strong>{p.title}</strong>
            <span className="muted small">{p.subtitle}</span>
          </header>
          {p.body === 'dataset' && <DatasetPaneBody dataset={p.dataset} />}
          {p.body === 'condition' && (
            <ConditionPaneBody condition={p.condition} />
          )}
          {p.body === 'hypothesis' && (
            <HypothesisPaneBody hypothesis={p.hypothesis} />
          )}
        </article>
      ))}
    </div>
  )
}

export function MultimodalPanel({
  project,
  datasets,
  onPersist,
  persisting = false,
}: Props) {
  const conditions = getConditions(project)
  const hypotheses = getHypotheses(project)
  const saved = getMultimodalLinks(project)

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [compareId, setCompareId] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState<CompareMode>('side_by_side')
  const [activeTab, setActiveTab] = useState<string>('')

  const editing = draft.id !== null
  const disabled = busy || persisting

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

  const hypothesisOptions = useMemo(
    () =>
      hypotheses.map((h) => ({
        id: h.id,
        label: h.title.trim() || `Hypothesis ${h.id.slice(0, 8)}`,
      })),
    [hypotheses],
  )

  const comparing = useMemo(() => {
    if (!compareId) return null
    return saved.find((l) => l.id === compareId) ?? null
  }, [compareId, saved])

  const panes = useMemo(() => {
    if (!comparing) return []
    return resolvePanes(comparing, datasets, conditions, hypotheses)
  }, [comparing, datasets, conditions, hypotheses])

  function resetDraft() {
    setDraft(emptyDraft())
    setError(null)
  }

  async function handleSave() {
    setError(null)
    setStatus(null)
    if (draft.datasetIds.length === 0 && draft.conditionIds.length === 0) {
      setError(
        'Select at least one dataset (and optionally conditions). A multimodal bundle needs linked evidence sources.',
      )
      return
    }
    if (draft.datasetIds.length === 0) {
      setError(
        'Include at least one dataset. Conditions alone are not a multimodal dataset link.',
      )
      return
    }
    const now = new Date().toISOString()
    const id = draft.id ?? newMultimodalLinkId()
    const prev = draft.id ? saved.find((l) => l.id === draft.id) : undefined
    const record: MultimodalLink = {
      id,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      label: draft.label.trim() || `Bundle ${id.slice(0, 8)}`,
      notes: draft.notes.trim(),
      members: buildMembers(draft, datasets),
    }
    setBusy(true)
    try {
      await onPersist(upsertMultimodalLink(project, record))
      setStatus(editing ? 'Multimodal link updated.' : 'Multimodal link saved.')
      setCompareId(record.id)
      if (record.members[0]) {
        const first = record.members[0]
        if (first.kind === 'dataset') setActiveTab(`ds:${first.datasetId}`)
        else if (first.kind === 'condition')
          setActiveTab(`cond:${first.conditionId}`)
        else setActiveTab(`hyp:${first.hypothesisId}`)
      }
      resetDraft()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save multimodal link.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    const target = saved.find((l) => l.id === id)
    if (!target) return
    const ok = window.confirm(
      `Remove multimodal link “${target.label || target.id}”? This only updates project.state.multimodalLinks — imported originalText is untouched.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await onPersist(removeMultimodalLink(project, id))
      if (draft.id === id) resetDraft()
      if (compareId === id) setCompareId(null)
      setStatus('Multimodal link removed.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to remove multimodal link.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="panel multimodal-panel"
      aria-labelledby="multimodal-heading"
    >
      <div className="panel-head">
        <h2 id="multimodal-heading" className="panel-title">
          Multimodal links
        </h2>
        <span className="pill" title={MULTIMODAL_DISCLAIMER}>
          {MULTIMODAL_UI_LABEL}
        </span>
      </div>

      <div className="warn-box" role="note">
        {MULTIMODAL_DISCLAIMER}
      </div>

      <p className="muted">
        Link compatible datasets (e.g. structure + time-series / smFRET) and
        optionally conditions into a <strong>bundle</strong> for side-by-side
        or tabbed comparison. Each modality keeps its own label — the app
        never merges them into one forced scientific narrative. Persisted under{' '}
        <code>project.state.multimodalLinks</code> only.
      </p>

      <h3 className="subheading">
        {editing ? 'Edit multimodal link' : 'New multimodal link'}
      </h3>

      <div className="explore-controls">
        <label className="field">
          <span className="field-label">Label</span>
          <input
            className="input"
            type="text"
            value={draft.label}
            onChange={(e) =>
              setDraft((d) => ({ ...d, label: e.target.value }))
            }
            disabled={disabled}
            placeholder="e.g. Structure + smFRET (same construct)"
          />
        </label>
      </div>

      <label className="field" style={{ marginTop: '0.75rem' }}>
        <span className="field-label">
          Notes (optional — notebook only, not joint inference)
        </span>
        <textarea
          className="input"
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          disabled={disabled}
          placeholder="Why you linked these — still your notes, not an app conclusion"
        />
      </label>

      <div className="link-block">
        <h3 className="subheading">Datasets (required)</h3>
        {datasets.length === 0 ? (
          <p className="muted small">
            No datasets yet — import PDB/mmCIF, CSV/JSON (time-series), etc.
          </p>
        ) : (
          <ul className="check-list">
            {datasets.map((ds) => {
              const modality = inferDatasetModality(ds)
              return (
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
                      {ds.fileName}{' '}
                      <span className={modalityPillClass(modality)}>
                        {modalityLabel(modality)}
                      </span>
                      {ds.synthetic ? (
                        <span className="pill pill-synthetic"> SYNTHETIC</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="link-block">
        <h3 className="subheading">Conditions (optional)</h3>
        {conditionOptions.length === 0 ? (
          <p className="muted small">
            No saved conditions — add some in Experimental conditions.
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
                  <span>
                    {c.label}{' '}
                    <span className={modalityPillClass('conditions')}>
                      {modalityLabel('conditions')}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="link-block">
        <h3 className="subheading">
          User hypotheses (optional — stay labeled separately)
        </h3>
        {hypothesisOptions.length === 0 ? (
          <p className="muted small">
            No user hypotheses — create some in Ligand / state hypotheses.
          </p>
        ) : (
          <ul className="check-list">
            {hypothesisOptions.map((h) => (
              <li key={h.id}>
                <label className="choice">
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
                  <span>
                    {h.label}{' '}
                    <span className="pill pill-hypothesis">
                      {HYPOTHESIS_UI_LABEL}
                    </span>
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
              ? 'Update multimodal link'
              : 'Save multimodal link'}
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

      <h3 className="subheading">Saved multimodal links</h3>
      {saved.length === 0 ? (
        <p className="muted">No multimodal links yet.</p>
      ) : (
        <ul className="mm-link-list">
          {saved.map((link) => {
            const memberSummary = link.members
              .map((m) => {
                if (m.kind === 'dataset') {
                  const ds = datasets.find((d) => d.id === m.datasetId)
                  return ds
                    ? `${ds.fileName} [${modalityLabel(inferDatasetModality(ds))}]`
                    : `dataset:${m.datasetId.slice(0, 8)}`
                }
                if (m.kind === 'condition') {
                  return `condition [${modalityLabel('conditions')}]`
                }
                return `hypothesis [${HYPOTHESIS_UI_LABEL}]`
              })
              .join(' · ')
            return (
              <li key={link.id} className="mm-link-card">
                <div className="mm-link-card-head">
                  <div>
                    <strong>{link.label || link.id.slice(0, 8)}</strong>
                    <div className="muted small">
                      {link.members.length} member
                      {link.members.length === 1 ? '' : 's'}
                      {' · '}
                      updated {new Date(link.updatedAt).toLocaleString()}
                    </div>
                    <div className="muted small">{memberSummary}</div>
                    {link.notes.trim() ? (
                      <div className="muted small">
                        Notes: {link.notes.trim()}
                      </div>
                    ) : null}
                  </div>
                  <div className="row actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={disabled}
                      onClick={() => {
                        setCompareId(link.id)
                        const first = link.members[0]
                        if (first?.kind === 'dataset')
                          setActiveTab(`ds:${first.datasetId}`)
                        else if (first?.kind === 'condition')
                          setActiveTab(`cond:${first.conditionId}`)
                        else if (first?.kind === 'hypothesis')
                          setActiveTab(`hyp:${first.hypothesisId}`)
                      }}
                    >
                      Compare
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={disabled}
                      onClick={() => setDraft(fromRecord(link))}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={disabled}
                      onClick={() => void handleRemove(link.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {comparing && (
        <div className="mm-compare-section">
          <div className="panel-head">
            <h3 className="subheading" style={{ margin: 0 }}>
              Comparison: {comparing.label || comparing.id.slice(0, 8)}
            </h3>
            <div className="row actions">
              <label className="choice">
                <input
                  type="radio"
                  name="mm-mode"
                  checked={compareMode === 'side_by_side'}
                  onChange={() => setCompareMode('side_by_side')}
                />
                <span>Side-by-side</span>
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="mm-mode"
                  checked={compareMode === 'tabs'}
                  onChange={() => setCompareMode('tabs')}
                />
                <span>Tabs</span>
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCompareId(null)}
              >
                Close
              </button>
            </div>
          </div>
          <p className="muted small">
            Modalities stay distinct — no fused narrative. Linking ≠ joint
            inference.
          </p>
          <ComparisonView
            panes={panes}
            mode={compareMode}
            activeTab={activeTab || panes[0]?.key || ''}
            onTab={setActiveTab}
          />
        </div>
      )}
    </section>
  )
}
