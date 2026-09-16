import { useMemo, useState } from 'react'
import { getConditions, getHypotheses } from '../conditions/persist'
import {
  generateDraftPlan,
  rebuildMatrix,
} from '../planner/draftPlan'
import {
  getExperimentPlans,
  removeExperimentPlan,
  upsertExperimentPlan,
} from '../planner/persist'
import {
  ALL_MEASUREMENT_KINDS,
  MEASUREMENT_KIND_LABELS,
  PLAN_DISCLAIMER,
  PLAN_KIND,
  PLAN_UI_LABEL,
  roughSampleSizeHeuristic,
  type ExperimentPlan,
  type PlannedMeasurementKind,
} from '../types/planner'
import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'

type Props = {
  project: Project
  datasets: ImportedDataset[]
  onPersist: (next: Project) => Promise<void>
  persisting?: boolean
}

type FormState = {
  title: string
  goal: string
  numConditions: number
  replicatesPerCondition: number
  measurementKinds: PlannedMeasurementKind[]
  linkedConditionIds: string[]
  linkedHypothesisIds: string[]
  notes: string
  /** When editing a saved plan, keep its id/createdAt across regenerate/save. */
  editingId: string | null
  editingCreatedAt: string | null
  /** Live editable draft after generate (or load for edit). */
  draft: ExperimentPlan | null
}

function defaultForm(): FormState {
  return {
    title: '',
    goal: '',
    numConditions: 2,
    replicatesPerCondition: 3,
    measurementKinds: ['smFRET', 'structure'],
    linkedConditionIds: [],
    linkedHypothesisIds: [],
    notes: '',
    editingId: null,
    editingCreatedAt: null,
    draft: null,
  }
}

function formFromPlan(plan: ExperimentPlan): FormState {
  return {
    title: plan.title,
    goal: plan.goal,
    numConditions: plan.numConditions,
    replicatesPerCondition: plan.replicatesPerCondition,
    measurementKinds: plan.measurements.map((m) => m.kind),
    linkedConditionIds: [...plan.linkedConditionIds],
    linkedHypothesisIds: [...plan.linkedHypothesisIds],
    notes: plan.notes,
    editingId: plan.id,
    editingCreatedAt: plan.createdAt,
    draft: { ...plan, kind: PLAN_KIND },
  }
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function toggleKind(
  list: PlannedMeasurementKind[],
  kind: PlannedMeasurementKind,
): PlannedMeasurementKind[] {
  return list.includes(kind)
    ? list.filter((k) => k !== kind)
    : [...list, kind]
}

export function ExperimentPlannerPanel({
  project,
  datasets: _datasets,
  onPersist,
  persisting = false,
}: Props) {
  const saved = getExperimentPlans(project)
  const conditions = getConditions(project)
  const hypotheses = getHypotheses(project)

  const [form, setForm] = useState<FormState>(() => defaultForm())
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = form.editingId !== null
  const disabled = busy || persisting

  const matrixPreview = useMemo(() => {
    const draft = form.draft
    if (!draft) return []
    const condById = new Map(draft.conditions.map((c) => [c.id, c]))
    const measById = new Map(draft.measurements.map((m) => [m.id, m]))
    return draft.matrix.map((cell) => ({
      ...cell,
      conditionLabel: condById.get(cell.conditionId)?.label ?? cell.conditionId,
      measurementLabel:
        measById.get(cell.measurementId)?.label ?? cell.measurementId,
    }))
  }, [form.draft])

  function resetForm() {
    setForm(defaultForm())
    setError(null)
  }

  function handleGenerate() {
    setError(null)
    setStatus(null)
    if (!form.goal.trim() && !form.title.trim()) {
      setError('Describe a goal or title before generating a draft suggestion.')
      return
    }
    if (form.measurementKinds.length === 0) {
      setError('Select at least one measurement type.')
      return
    }
    const draft = generateDraftPlan({
      title: form.title,
      goal: form.goal,
      numConditions: form.numConditions,
      replicatesPerCondition: form.replicatesPerCondition,
      measurementKinds: form.measurementKinds,
      linkedConditionIds: form.linkedConditionIds,
      linkedHypothesisIds: form.linkedHypothesisIds,
      notes: form.notes,
      existing:
        form.editingId && form.editingCreatedAt
          ? { id: form.editingId, createdAt: form.editingCreatedAt }
          : null,
    })
    setForm((f) => ({
      ...f,
      draft,
      title: draft.title,
      numConditions: draft.numConditions,
      replicatesPerCondition: draft.replicatesPerCondition,
    }))
    setStatus(
      'Draft suggestion generated — review and edit before saving. Not a prescription.',
    )
  }

  function patchDraft(mutator: (d: ExperimentPlan) => ExperimentPlan) {
    setForm((f) => {
      if (!f.draft) return f
      const next = mutator({ ...f.draft, kind: PLAN_KIND })
      next.sampleSizeHeuristicNote = roughSampleSizeHeuristic(
        next.conditions.length || next.numConditions,
        next.replicatesPerCondition,
      )
      next.numConditions = next.conditions.length
      next.matrix = rebuildMatrix(next)
      return { ...f, draft: next }
    })
  }

  async function handleSave() {
    setError(null)
    setStatus(null)
    if (!form.draft) {
      setError('Generate a draft suggestion first, or load a saved plan to edit.')
      return
    }
    const now = new Date().toISOString()
    const plan: ExperimentPlan = {
      ...form.draft,
      kind: PLAN_KIND,
      title: form.title.trim() || form.draft.title,
      goal: form.goal.trim() || form.draft.goal,
      notes: form.notes.trim(),
      linkedConditionIds: [...form.linkedConditionIds],
      linkedHypothesisIds: [...form.linkedHypothesisIds],
      updatedAt: now,
      sampleSizeHeuristicNote: roughSampleSizeHeuristic(
        form.draft.conditions.length || form.draft.numConditions,
        form.draft.replicatesPerCondition,
      ),
    }
    setBusy(true)
    try {
      await onPersist(upsertExperimentPlan(project, plan))
      setStatus(
        editing
          ? 'Draft plan updated under project.state.experimentPlans.'
          : 'Draft plan saved under project.state.experimentPlans.',
      )
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    const target = saved.find((p) => p.id === id)
    if (!target) return
    const ok = window.confirm(
      `Remove draft plan “${target.title || target.id}”? This only updates project.state.experimentPlans — imported originalText is untouched.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await onPersist(removeExperimentPlan(project, id))
      if (form.editingId === id) resetForm()
      setStatus('Draft plan removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove plan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="panel planner-panel"
      aria-labelledby="planner-heading"
    >
      <div className="panel-head">
        <h2 id="planner-heading" className="panel-title">
          Experimental design planner
        </h2>
        <span className="pill pill-planner" title={PLAN_DISCLAIMER}>
          {PLAN_UI_LABEL}
        </span>
      </div>

      <div className="warn-box planner-disclaimer" role="note">
        <strong>{PLAN_UI_LABEL}.</strong> {PLAN_DISCLAIMER} This panel helps
        you sketch conditions × replicates × measurements as a notebook draft.
        It does <em>not</em> run power analysis as truth, prescribe required
        sample sizes, or promote linked user hypotheses to evidence.
      </div>

      <p className="muted">
        Describe a goal (e.g. compare ligands, smFRET vs structure), pick how
        many conditions / replicates / measurement types, then generate a
        structured suggestion. Edit and save under{' '}
        <code>project.state.experimentPlans</code> only.
      </p>

      <h3 className="subheading">
        {editing ? 'Edit draft plan' : 'New draft suggestion'}
      </h3>

      <div className="explore-controls">
        <label className="field">
          <span className="field-label">Title</span>
          <input
            className="input"
            type="text"
            value={form.title}
            onChange={(e) =>
              setForm((f) => ({ ...f, title: e.target.value }))
            }
            disabled={disabled}
            placeholder="e.g. Ligand screen — smFRET vs crystal"
          />
        </label>
        <label className="field">
          <span className="field-label"># conditions</span>
          <input
            className="input"
            type="number"
            min={1}
            max={24}
            value={form.numConditions}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                numConditions: Math.max(1, Number(e.target.value) || 1),
              }))
            }
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span className="field-label">Replicates / condition</span>
          <input
            className="input"
            type="number"
            min={1}
            max={50}
            value={form.replicatesPerCondition}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                replicatesPerCondition: Math.max(
                  1,
                  Number(e.target.value) || 1,
                ),
              }))
            }
            disabled={disabled}
          />
        </label>
      </div>

      <label className="field" style={{ marginTop: '0.75rem' }}>
        <span className="field-label">Goal</span>
        <textarea
          className="input"
          rows={2}
          value={form.goal}
          onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
          disabled={disabled}
          placeholder="e.g. Compare two ligands with smFRET and optional structure snapshots — exploratory only"
        />
      </label>

      <div className="link-block">
        <h3 className="subheading">Measurement types</h3>
        <ul className="check-list">
          {ALL_MEASUREMENT_KINDS.map((kind) => (
            <li key={kind}>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={form.measurementKinds.includes(kind)}
                  onChange={() =>
                    setForm((f) => ({
                      ...f,
                      measurementKinds: toggleKind(f.measurementKinds, kind),
                    }))
                  }
                  disabled={disabled}
                />
                {MEASUREMENT_KIND_LABELS[kind]}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="link-block">
        <h3 className="subheading">
          Link existing conditions (optional — organizational only)
        </h3>
        {conditions.length === 0 ? (
          <p className="muted small">
            No saved conditions yet — add some in Experimental conditions.
          </p>
        ) : (
          <ul className="check-list">
            {conditions.map((c) => (
              <li key={c.id}>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={form.linkedConditionIds.includes(c.id)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        linkedConditionIds: toggleId(
                          f.linkedConditionIds,
                          c.id,
                        ),
                      }))
                    }
                    disabled={disabled}
                  />
                  {c.label || c.ligandName || c.id.slice(0, 8)}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="link-block">
        <h3 className="subheading">
          Link user hypotheses (optional — stays a user hypothesis, not
          evidence)
        </h3>
        {hypotheses.length === 0 ? (
          <p className="muted small">
            No user hypotheses yet — add some in Ligand / state hypotheses.
          </p>
        ) : (
          <ul className="check-list">
            {hypotheses.map((h) => (
              <li key={h.id}>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={form.linkedHypothesisIds.includes(h.id)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        linkedHypothesisIds: toggleId(
                          f.linkedHypothesisIds,
                          h.id,
                        ),
                      }))
                    }
                    disabled={disabled}
                  />
                  {h.title || h.id.slice(0, 8)}{' '}
                  <span className="pill pill-hypothesis">User hypothesis</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="field" style={{ marginTop: '0.75rem' }}>
        <span className="field-label">Notes (optional)</span>
        <textarea
          className="input"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          disabled={disabled}
          placeholder="Notebook notes for this draft…"
        />
      </label>

      <div className="row actions hmm-actions" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={disabled}
        >
          Generate draft suggestion
        </button>
        {form.draft && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={disabled}
          >
            {editing ? 'Save edits' : 'Save draft plan'}
          </button>
        )}
        {(editing || form.draft) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={resetForm}
            disabled={disabled}
          >
            Cancel
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

      {form.draft && (
        <div className="planner-draft" aria-label="Draft suggestion preview">
          <div className="planner-draft-head">
            <h3 className="subheading">
              Structured draft —{' '}
              <span className="pill pill-planner">{PLAN_UI_LABEL}</span>
            </h3>
            <p className="muted small">
              kind=<code>{PLAN_KIND}</code> ·{' '}
              {form.draft.conditions.length} conditions ×{' '}
              {form.draft.replicatesPerCondition} replicates ×{' '}
              {form.draft.measurements.length} measurements ={' '}
              {form.draft.matrix.length} cells
            </p>
          </div>

          <div className="warn-box" role="note">
            <strong>Rough heuristic only (not a power analysis):</strong>{' '}
            {form.draft.sampleSizeHeuristicNote}
          </div>

          <h4 className="planner-section-title">Suggested conditions</h4>
          <ul className="planner-condition-list">
            {form.draft.conditions.map((c, i) => (
              <li key={c.id} className="planner-condition-row">
                <input
                  className="input"
                  type="text"
                  value={c.label}
                  disabled={disabled}
                  aria-label={`Condition ${i + 1} label`}
                  onChange={(e) => {
                    const label = e.target.value
                    patchDraft((d) => ({
                      ...d,
                      conditions: d.conditions.map((row) =>
                        row.id === c.id ? { ...row, label } : row,
                      ),
                    }))
                  }}
                />
                <input
                  className="input"
                  type="text"
                  value={c.notes}
                  disabled={disabled}
                  placeholder="notes"
                  aria-label={`Condition ${i + 1} notes`}
                  onChange={(e) => {
                    const notes = e.target.value
                    patchDraft((d) => ({
                      ...d,
                      conditions: d.conditions.map((row) =>
                        row.id === c.id ? { ...row, notes } : row,
                      ),
                    }))
                  }}
                />
              </li>
            ))}
          </ul>

          <h4 className="planner-section-title">Suggested measurements</h4>
          <ul className="check-list">
            {form.draft.measurements.map((m) => (
              <li key={m.id}>
                <span className="pill pill-planner-meas">{m.label}</span>
                <span className="muted small"> ({m.kind})</span>
              </li>
            ))}
          </ul>

          <h4 className="planner-section-title">
            Matrix (conditions × replicates × measurements)
          </h4>
          <div className="planner-matrix-wrap">
            <table className="planner-matrix">
              <thead>
                <tr>
                  <th scope="col">Condition</th>
                  <th scope="col">Replicate</th>
                  <th scope="col">Measurement</th>
                  <th scope="col">Cell note</th>
                </tr>
              </thead>
              <tbody>
                {matrixPreview.map((cell) => (
                  <tr
                    key={`${cell.conditionId}-${cell.replicateIndex}-${cell.measurementId}`}
                  >
                    <td>{cell.conditionLabel}</td>
                    <td>R{cell.replicateIndex}</td>
                    <td>{cell.measurementLabel}</td>
                    <td>
                      <input
                        className="input input-compact"
                        type="text"
                        value={cell.note}
                        disabled={disabled}
                        aria-label="Cell note"
                        onChange={(e) => {
                          const note = e.target.value
                          patchDraft((d) => ({
                            ...d,
                            matrix: d.matrix.map((row) =>
                              row.conditionId === cell.conditionId &&
                              row.replicateIndex === cell.replicateIndex &&
                              row.measurementId === cell.measurementId
                                ? { ...row, note }
                                : row,
                            ),
                          }))
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h3 className="subheading" style={{ marginTop: '1.25rem' }}>
        Saved draft plans ({saved.length})
      </h3>
      {saved.length === 0 ? (
        <p className="muted small">
          No saved plans yet. Generate a suggestion and save it — stored only
          under <code>project.state.experimentPlans</code>.
        </p>
      ) : (
        <ul className="planner-plan-list">
          {saved.map((plan) => (
            <li key={plan.id} className="planner-plan-card">
              <div className="planner-plan-card-head">
                <div>
                  <strong>{plan.title || '(untitled)'}</strong>{' '}
                  <span className="pill pill-planner">{PLAN_UI_LABEL}</span>
                  <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
                    {plan.goal || '(no goal text)'}
                  </p>
                  <p className="muted small">
                    {plan.conditions.length}×{plan.replicatesPerCondition}×
                    {plan.measurements.length} · kind=
                    <code>{plan.kind}</code> · updated{' '}
                    {new Date(plan.updatedAt).toLocaleString()}
                  </p>
                  {(plan.linkedHypothesisIds.length > 0 ||
                    plan.linkedConditionIds.length > 0) && (
                    <p className="muted small">
                      Links: {plan.linkedConditionIds.length} condition(s),{' '}
                      {plan.linkedHypothesisIds.length} user hypothesis(es)
                      — organizational only; hypotheses stay user hypotheses.
                    </p>
                  )}
                </div>
                <div className="row actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={disabled}
                    onClick={() => {
                      setForm(formFromPlan(plan))
                      setError(null)
                      setStatus('Loaded draft for editing.')
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={disabled}
                    onClick={() => void handleRemove(plan.id)}
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
