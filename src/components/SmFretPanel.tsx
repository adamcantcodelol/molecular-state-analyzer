import { useEffect, useMemo, useRef, useState } from 'react'
import {
  asFiniteNumber,
  isMissing,
  loadTabularTable,
  roleColumns,
} from '../data/tabular'
import { extractObservations } from '../hmm/extractObservations'
import { runHmmInWorker } from '../hmm/runHmmWorker'
import {
  DEFAULT_HMM_SETTINGS,
  type HmmFitResult,
} from '../hmm/types'
import {
  getSmfretHmmRuns,
  newSmfretRunId,
  withSmfretHmmRun,
} from '../smfret/persist'
import {
  SMFRET_DISCLAIMER,
  SMFRET_OBSERVATION_KIND,
  SMFRET_SOURCE,
  type PersistedSmfretHmmRun,
} from '../smfret/types'
import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'
import { TimeSeriesChart, type SeriesPoints } from './TimeSeriesChart'

type Props = {
  project: Project
  datasets: ImportedDataset[]
  onPersist: (next: Project) => Promise<void>
  persisting?: boolean
}

function fmt(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return String(n)
  return n.toPrecision(digits)
}

/**
 * Phase 10: smFRET dashboard — plot mapped Value as E_FRET vs time,
 * optionally fit a Gaussian HMM on E_FRET only (statistical latent states).
 */
export function SmFretPanel({
  project,
  datasets,
  onPersist,
  persisting = false,
}: Props) {
  const eligible = useMemo(() => {
    return datasets.filter(
      (d) =>
        (d.format === 'csv' || d.format === 'json') &&
        d.columnMapping &&
        d.columnMapping.some((m) => m.role === 'time') &&
        d.columnMapping.some((m) => m.role === 'value'),
    )
  }, [datasets])

  const [datasetId, setDatasetId] = useState('')
  const [valueCol, setValueCol] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('__all__')
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
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeId =
    datasetId && eligible.some((d) => d.id === datasetId)
      ? datasetId
      : (eligible[0]?.id ?? '')
  const dataset = eligible.find((d) => d.id === activeId) ?? null

  const valueCols = roleColumns(dataset?.columnMapping, 'value')
  const timeCol = roleColumns(dataset?.columnMapping, 'time')[0]
  const seriesCol = roleColumns(dataset?.columnMapping, 'series')[0]
  const activeValue =
    valueCol && valueCols.includes(valueCol) ? valueCol : (valueCols[0] ?? '')

  const table = dataset ? loadTabularTable(dataset) : null

  let seriesValues: string[] = []
  if (table && seriesCol) {
    const set = new Set<string>()
    for (const row of table.rows) {
      const v = row[seriesCol]
      if (!isMissing(v)) set.add(String(v))
    }
    seriesValues = [...set].sort()
  }

  const plotSeries: SeriesPoints[] = useMemo(() => {
    if (!table || !timeCol || !activeValue) return []
    const groups = new Map<string, { xs: number[]; ys: (number | null)[] }>()
    for (const row of table.rows) {
      if (seriesCol && seriesFilter !== '__all__') {
        if (String(row[seriesCol] ?? '') !== seriesFilter) continue
      }
      const t = asFiniteNumber(row[timeCol])
      if (t === null) continue
      const yRaw = row[activeValue]
      const y = isMissing(yRaw) ? null : asFiniteNumber(yRaw)
      const key = seriesCol
        ? seriesFilter !== '__all__'
          ? seriesFilter
          : String(row[seriesCol] ?? '(blank)')
        : 'E_FRET'
      const g = groups.get(key) ?? { xs: [], ys: [] }
      g.xs.push(t)
      g.ys.push(y)
      groups.set(key, g)
    }
    const out: SeriesPoints[] = []
    for (const [id, g] of groups) {
      out.push({
        id,
        label: seriesCol ? `E_FRET · ${id}` : 'E_FRET',
        xs: g.xs,
        ys: g.ys,
      })
    }
    return out
  }, [table, timeCol, activeValue, seriesCol, seriesFilter])

  const savedRuns = getSmfretHmmRuns(project)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function handleRunHmm() {
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
        throw new Error('No finite E_FRET observations after filtering.')
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
        notes: [
          ...extracted.notes,
          'Fitted on E_FRET observations only (mapped Value column).',
          'Latent states are statistical indices — not conformations or distances.',
        ],
      })
      setProgress(
        `Done · ${result.iterations} iter · ${result.converged ? 'converged' : 'maxIter'} · n=${result.observationCount}`,
      )

      const run: PersistedSmfretHmmRun = {
        id: newSmfretRunId(),
        createdAt: new Date().toISOString(),
        source: SMFRET_SOURCE,
        observationKind: SMFRET_OBSERVATION_KIND,
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
      const next = withSmfretHmmRun(project, run)
      await onPersist(next)
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
      <section className="panel smfret-panel" aria-labelledby="smfret-heading">
        <h2 id="smfret-heading" className="panel-title">
          smFRET (E_FRET)
        </h2>
        <div className="warn-box" role="note">
          {SMFRET_DISCLAIMER}
        </div>
        <p className="muted">
          Commit a CSV/JSON dataset with <strong>Time</strong> and{' '}
          <strong>Value</strong> columns mapped. This panel treats the Value
          column as <strong>E_FRET</strong> (FRET efficiency) for plotting and
          optional statistical HMM — not as a structural coordinate.
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
    <section className="panel smfret-panel" aria-labelledby="smfret-heading">
      <div className="panel-head">
        <h2 id="smfret-heading" className="panel-title">
          smFRET (E_FRET)
        </h2>
      </div>

      <div className="warn-box" role="note">
        {SMFRET_DISCLAIMER}
      </div>

      <p className="muted">
        Plot mapped Value as <strong>E_FRET</strong> vs time. Optionally run the
        existing Gaussian HMM worker on those observations. Results save under{' '}
        <code>project.state.smfretHmmRuns</code> with{' '}
        <code>source=smfret</code> / <code>observationKind=E_FRET</code>.
        Imported <code>originalText</code> is never rewritten.
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
              setLiveResult(null)
              setLiveMeta(null)
            }}
          >
            {eligible.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fileName}
                {d.synthetic ? ' (SYNTHETIC)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">E_FRET column (Value)</span>
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
      </div>

      <h3 className="hmm-subhead">E_FRET vs time</h3>
      <p className="muted small">
        Y-axis is the mapped Value column treated as FRET efficiency E_FRET.
        This is a raw efficiency trace — not a distance or conformation plot.
      </p>
      <TimeSeriesChart
        series={plotSeries}
        xLabel={timeCol ? `Time (${timeCol})` : 'Time'}
        yLabel="E_FRET"
        height={260}
      />

      <h3 className="hmm-subhead">Optional: Gaussian HMM on E_FRET</h3>
      <p className="muted small">
        Same Baum–Welch + Viterbi worker as the generic HMM panel. Latent
        states here are <strong>statistical</strong> clusters of E_FRET only —
        never labeled as structural conformations or distances.
      </p>

      <div className="explore-controls">
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
          onClick={() => void handleRunHmm()}
        >
          {running ? 'Running…' : 'Run HMM on E_FRET'}
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
          <h3 className="hmm-subhead">
            Latest smFRET HMM run (statistical · E_FRET only)
          </h3>
          <p className="muted small">
            {liveMeta.fileName} · E_FRET column{' '}
            <code>{liveMeta.valueColumn}</code>
            {liveMeta.seriesFilter
              ? ` · series ${liveMeta.seriesFilter}`
              : ''}{' '}
            · seed {display.settings.seed} · nStates {display.settings.nStates}{' '}
            · <code>source=smfret</code>
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

          <h4 className="hmm-subhead">
            Emission means / variances (on E_FRET)
          </h4>
          <p className="muted small">
            Means are in E_FRET units. State index is an arbitrary EM label —
            not “open/closed” or any structural name.
          </p>
          <table className="data-table hmm-table">
            <thead>
              <tr>
                <th>State (index)</th>
                <th>Mean μ (E_FRET)</th>
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
            Most likely latent-state index per E_FRET observation (0…K−1).
            Statistical path only — not a structural trajectory.
          </p>
          <pre className="hmm-pre" tabIndex={0}>
            {pathPreview}
          </pre>
          <StateStrip
            path={display.statePath}
            nStates={display.settings.nStates}
          />
        </div>
      )}

      {savedRuns.length > 0 && (
        <details className="hmm-history">
          <summary>
            Saved smFRET HMM runs in project.state.smfretHmmRuns (
            {savedRuns.length}, newest first)
          </summary>
          <ul className="hmm-history-list">
            {savedRuns.map((r) => (
              <li key={r.id}>
                <code>{new Date(r.createdAt).toLocaleString()}</code> ·{' '}
                {r.datasetFileName} · E_FRET=<code>{r.valueColumn}</code> · K=
                {r.settings.nStates} · seed={r.settings.seed} · LL=
                {fmt(r.logLikelihood, 6)} · means=[
                {r.means.map((m) => fmt(m, 4)).join(', ')}] ·{' '}
                <code>source={r.source}</code>
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
      aria-label={`E_FRET statistical state path strip with ${nStates} states`}
      title="Viterbi state path on E_FRET (color = statistical state index)"
    >
      {path.map((s, i) => (
        <span
          key={i}
          className="hmm-strip-cell"
          style={{ background: colors[s % colors.length] }}
          title={`t=${i} statistical_state=${s}`}
        />
      ))}
    </div>
  )
}
