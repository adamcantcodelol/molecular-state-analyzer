import { useEffect, useMemo, useRef, useState } from 'react'
import { extractObservations } from '../hmm/extractObservations'
import { getHmmRuns, withHmmRun } from '../hmm/persist'
import { runHmmInWorker } from '../hmm/runHmmWorker'
import { guardObservationCount } from '../perf/limits'
import {
  DEFAULT_HMM_SETTINGS,
  type HmmFitResult,
  type PersistedHmmRun,
} from '../hmm/types'
import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'
import { roleColumns } from '../data/tabular'
import { isMissing, loadTabularTable } from '../data/tabular'

type Props = {
  project: Project
  datasets: ImportedDataset[]
  /** Persist run into project.state.hmmRuns (does not touch originalText). */
  onPersistRun: (next: Project) => Promise<void>
  persisting?: boolean
}

function newRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `hmm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function fmt(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return String(n)
  return n.toPrecision(digits)
}

export function HmmPanel({
  project,
  datasets,
  onPersistRun,
  persisting = false,
}: Props) {
  const eligible = useMemo(() => {
    return datasets.filter(
      (d) =>
        (d.format === 'csv' || d.format === 'json') &&
        d.columnMapping &&
        d.columnMapping.some((m) => m.role === 'value'),
    )
  }, [datasets])

  const [datasetId, setDatasetId] = useState<string>('')
  const [valueCol, setValueCol] = useState('')
  const [seriesFilter, setSeriesFilter] = useState<string>('__all__')
  const [nStates, setNStates] = useState(String(DEFAULT_HMM_SETTINGS.nStates))
  const [maxIter, setMaxIter] = useState(String(DEFAULT_HMM_SETTINGS.maxIter))
  const [tol, setTol] = useState(String(DEFAULT_HMM_SETTINGS.tol))
  const [seed, setSeed] = useState(String(DEFAULT_HMM_SETTINGS.seed))
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [liveResult, setLiveResult] = useState<HmmFitResult | null>(null)
  const [liveMeta, setLiveMeta] = useState<{
    datasetId: string
    fileName: string
    valueColumn: string
    seriesFilter: string | null
    notes: string[]
    times: number[]
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeId =
    datasetId && eligible.some((d) => d.id === datasetId)
      ? datasetId
      : (eligible[0]?.id ?? '')
  const dataset = eligible.find((d) => d.id === activeId) ?? null

  const valueCols = roleColumns(dataset?.columnMapping, 'value')
  const seriesCol = roleColumns(dataset?.columnMapping, 'series')[0]
  const activeValue =
    valueCol && valueCols.includes(valueCol) ? valueCol : (valueCols[0] ?? '')

  let seriesValues: string[] = []
  if (dataset && seriesCol) {
    const table = loadTabularTable(dataset)
    if (table) {
      const set = new Set<string>()
      for (const row of table.rows) {
        const v = row[seriesCol]
        if (!isMissing(v)) set.add(String(v))
      }
      seriesValues = [...set].sort()
    }
  }

  const savedRuns = getHmmRuns(project)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function handleRun() {
    if (!dataset || !activeValue) return
    setError(null)
    setProgress(null)
    setLiveResult(null)
    setLiveMeta(null)
    setRunning(true)

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    try {
      const filter =
        seriesCol && seriesFilter !== '__all__' ? seriesFilter : null
      const extracted = extractObservations(dataset, activeValue, filter)
      if (extracted.values.length === 0) {
        throw new Error('No finite observations after filtering.')
      }

      const guard = guardObservationCount(extracted.values.length, 'fit')
      if (!guard.ok) {
        throw new Error(guard.message)
      }
      if (guard.level === 'warn' && guard.message) {
        setProgress(guard.message)
      }

      const settings = {
        nStates: Number(nStates),
        maxIter: Number(maxIter),
        tol: Number(tol),
        seed: Number(seed),
      }

      const result = await runHmmInWorker({
        observations: extracted.values,
        settings,
        signal: ac.signal,
        onProgress: (iteration, logLikelihood) => {
          setProgress(
            `EM iter ${iteration} · avg log-likelihood ${fmt(logLikelihood, 8)}`,
          )
        },
      })

      setLiveResult(result)
      setLiveMeta({
        datasetId: dataset.id,
        fileName: dataset.fileName,
        valueColumn: activeValue,
        seriesFilter: filter,
        notes: extracted.notes,
        times: extracted.times,
      })
      setProgress(
        `Done · ${result.iterations} iter · ${result.converged ? 'converged' : 'maxIter'} · n=${result.observationCount}`,
      )

      const run: PersistedHmmRun = {
        id: newRunId(),
        createdAt: new Date().toISOString(),
        datasetId: dataset.id,
        datasetFileName: dataset.fileName,
        valueColumn: activeValue,
        seriesFilter: filter,
        settings: result.settings,
        means: result.model.means,
        variances: result.model.variances,
        startProb: result.model.startProb,
        transProb: result.model.transProb,
        statePath: result.statePath,
        stateCounts: result.stateCounts,
        logLikelihood: result.logLikelihood,
        iterations: result.iterations,
        converged: result.converged,
        observationCount: result.observationCount,
      }
      const next = withHmmRun(project, run)
      await onPersistRun(next)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setProgress('Cancelled')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setRunning(false)
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
  }

  if (eligible.length === 0) {
    return (
      <section className="panel" aria-labelledby="hmm-heading">
        <h2 id="hmm-heading" className="panel-title">
          Gaussian HMM
        </h2>
        <p className="muted">
          Commit a CSV/JSON dataset with at least one Value column mapped to run
          a real Gaussian HMM (Baum–Welch + Viterbi) in a Web Worker.
        </p>
      </section>
    )
  }

  const display = liveResult
  const pathPreview = display
    ? display.statePath.length <= 40
      ? display.statePath.join(' ')
      : `${display.statePath.slice(0, 20).join(' ')} … ${display.statePath
          .slice(-10)
          .join(' ')}`
    : null

  return (
    <section className="panel hmm-panel" aria-labelledby="hmm-heading">
      <div className="panel-head">
        <h2 id="hmm-heading" className="panel-title">
          Gaussian HMM
        </h2>
      </div>
      <p className="muted">
        Unsupervised 1D Gaussian-emission HMM. Latent states are{' '}
        <strong>not</strong> biophysical labels — they are EM-fitted clusters
        with Markov transitions. Heavy work runs in a Web Worker; originals are
        never rewritten (runs save under <code>project.state.hmmRuns</code>).
      </p>

      <div className="explore-controls">
        <label className="field">
          <span className="field-label">Dataset</span>
          <select
            className="input select"
            value={activeId}
            disabled={running}
            onChange={(e) => {
              setDatasetId(e.target.value)
              setValueCol('')
              setSeriesFilter('__all__')
            }}
          >
            {eligible.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fileName}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Value column</span>
          <select
            className="input select"
            value={activeValue}
            disabled={running}
            onChange={(e) => setValueCol(e.target.value)}
          >
            {valueCols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {seriesCol && (
          <label className="field">
            <span className="field-label">Series filter ({seriesCol})</span>
            <select
              className="input select"
              value={seriesFilter}
              disabled={running}
              onChange={(e) => setSeriesFilter(e.target.value)}
            >
              <option value="__all__">All series</option>
              {seriesValues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span className="field-label">nStates</span>
          <input
            className="input"
            type="number"
            min={1}
            step={1}
            value={nStates}
            disabled={running}
            onChange={(e) => setNStates(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">maxIter</span>
          <input
            className="input"
            type="number"
            min={1}
            step={1}
            value={maxIter}
            disabled={running}
            onChange={(e) => setMaxIter(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">tol</span>
          <input
            className="input"
            type="number"
            min={0}
            step="any"
            value={tol}
            disabled={running}
            onChange={(e) => setTol(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">seed</span>
          <input
            className="input"
            type="number"
            step={1}
            value={seed}
            disabled={running}
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>
      </div>

      <div className="row actions hmm-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={running || persisting || !activeValue}
          onClick={() => void handleRun()}
        >
          {running ? 'Running…' : 'Run HMM in Worker'}
        </button>
        {running && (
          <button type="button" className="btn btn-ghost" onClick={handleCancel}>
            Cancel
          </button>
        )}
      </div>

      {progress && <p className="muted small hmm-progress">{progress}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {display && liveMeta && (
        <div className="hmm-result">
          <h3 className="hmm-subhead">Latest run (this session)</h3>
          <p className="muted small">
            {liveMeta.fileName} · value <code>{liveMeta.valueColumn}</code>
            {liveMeta.seriesFilter
              ? ` · series ${liveMeta.seriesFilter}`
              : ''}{' '}
            · seed {display.settings.seed} · nStates {display.settings.nStates}
          </p>
          <ul className="muted small hmm-notes">
            {liveMeta.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <dl className="meta-grid hmm-meta">
            <div>
              <dt>Avg log-likelihood / obs</dt>
              <dd>
                <code>{fmt(display.logLikelihood, 10)}</code>
              </dd>
            </div>
            <div>
              <dt>Iterations</dt>
              <dd>
                {display.iterations}
                {display.converged ? ' (converged)' : ' (hit maxIter)'}
              </dd>
            </div>
            <div>
              <dt>Observations</dt>
              <dd>{display.observationCount}</dd>
            </div>
          </dl>

          <h4 className="hmm-subhead">Emission means / variances</h4>
          <table className="data-table hmm-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Mean μ</th>
                <th>Variance σ²</th>
                <th>Viterbi count</th>
                <th>π</th>
              </tr>
            </thead>
            <tbody>
              {display.model.means.map((mu, i) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>
                    <code>{fmt(mu)}</code>
                  </td>
                  <td>
                    <code>{fmt(display.model.variances[i]!)}</code>
                  </td>
                  <td>{display.stateCounts[i]}</td>
                  <td>
                    <code>{fmt(display.model.startProb[i]!, 4)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="hmm-subhead">Transition matrix A</h4>
          <pre className="hmm-pre" tabIndex={0}>
            {display.model.transProb
              .map((row, i) => `S${i}: [${row.map((p) => fmt(p, 4)).join(', ')}]`)
              .join('\n')}
          </pre>

          <h4 className="hmm-subhead">Viterbi state path</h4>
          <p className="muted small">
            Most likely latent-state index per observation (0…K−1). Not a
            molecular conformation label.
          </p>
          <pre className="hmm-pre" tabIndex={0}>
            {pathPreview}
          </pre>
          <StateStrip path={display.statePath} nStates={display.settings.nStates} />
        </div>
      )}

      {savedRuns.length > 0 && (
        <details className="hmm-history">
          <summary>
            Saved runs in project.state ({savedRuns.length}, newest first)
          </summary>
          <ul className="hmm-history-list">
            {savedRuns.map((r) => (
              <li key={r.id}>
                <code>{new Date(r.createdAt).toLocaleString()}</code> ·{' '}
                {r.datasetFileName} · {r.valueColumn} · K={r.settings.nStates} ·
                seed={r.settings.seed} · LL={fmt(r.logLikelihood, 6)} · means=
                [{r.means.map((m) => fmt(m, 4)).join(', ')}]
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function StateStrip({ path, nStates }: { path: number[]; nStates: number }) {
  if (path.length === 0) return null
  const colors = [
    '#0b6e6e',
    '#b35c00',
    '#3b5bdb',
    '#8a3b8a',
    '#2f9e44',
    '#c92a2a',
  ]
  return (
    <div
      className="hmm-strip"
      role="img"
      aria-label={`State path strip with ${nStates} states`}
      title="Viterbi state path (color = state index)"
    >
      {path.map((s, i) => (
        <span
          key={i}
          className="hmm-strip-cell"
          style={{ background: colors[s % colors.length] }}
          title={`t=${i} state=${s}`}
        />
      ))}
    </div>
  )
}
