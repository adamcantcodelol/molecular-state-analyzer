import { useEffect, useMemo, useRef, useState } from 'react'
import { extractObservations } from '../hmm/extractObservations'
import { getHmmBootstraps, withHmmBootstrap } from '../hmm/persist'
import { runHmmBootstrapInWorker } from '../hmm/runHmmWorker'
import {
  DEFAULT_BOOTSTRAP_SETTINGS,
  type BootstrapSummary,
  type PersistedHmmBootstrap,
  type ScalarSummary,
} from '../hmm/types'
import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'
import { isMissing, loadTabularTable, roleColumns } from '../data/tabular'

type Props = {
  project: Project
  datasets: ImportedDataset[]
  onPersist: (next: Project) => Promise<void>
  persisting?: boolean
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `boot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function fmt(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return String(n)
  return n.toPrecision(digits)
}

function fmtSummary(s: ScalarSummary): string {
  return `${fmt(s.mean)} ± ${fmt(s.sd)}  [${fmt(s.p2_5)}, ${fmt(s.p97_5)}]`
}

export function BootstrapPanel({
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
        d.columnMapping.some((m) => m.role === 'value'),
    )
  }, [datasets])

  const [datasetId, setDatasetId] = useState('')
  const [valueCol, setValueCol] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('__all__')
  const [nStates, setNStates] = useState(String(DEFAULT_BOOTSTRAP_SETTINGS.nStates))
  const [nBoot, setNBoot] = useState(String(DEFAULT_BOOTSTRAP_SETTINGS.nBoot))
  const [maxIter, setMaxIter] = useState(String(DEFAULT_BOOTSTRAP_SETTINGS.maxIter))
  const [tol, setTol] = useState(String(DEFAULT_BOOTSTRAP_SETTINGS.tol))
  const [seed, setSeed] = useState(String(DEFAULT_BOOTSTRAP_SETTINGS.seed))
  const [blockLength, setBlockLength] = useState('') // empty = auto √T
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<BootstrapSummary | null>(null)
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

  const saved = getHmmBootstraps(project)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function handleRun() {
    if (!dataset || !activeValue) return
    setError(null)
    setProgress(null)
    setLive(null)
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

      const blRaw = blockLength.trim()
      const settings = {
        nStates: Number(nStates),
        nBoot: Number(nBoot),
        maxIter: Number(maxIter),
        tol: Number(tol),
        seed: Number(seed),
        ...(blRaw !== '' ? { blockLength: Number(blRaw) } : {}),
      }

      const summary = await runHmmBootstrapInWorker({
        observations: extracted.values,
        settings,
        signal: ac.signal,
        onProgress: (done, total, detail) => {
          if (detail?.iteration != null) {
            setProgress(
              `Bootstrap ${done}/${total} · EM ${detail.iteration}` +
                (detail.logLikelihood != null
                  ? ` · avg LL ${fmt(detail.logLikelihood, 6)}`
                  : ''),
            )
          } else {
            setProgress(`Bootstrap ${done}/${total} complete`)
          }
        },
      })

      setLive(summary)
      setProgress(
        `Done · ${summary.nBoot} replicates · L=${summary.blockLength} · ` +
          `${summary.convergedCount}/${summary.nBoot} converged`,
      )

      const row: PersistedHmmBootstrap = {
        id: newId(),
        createdAt: new Date().toISOString(),
        datasetId: dataset.id,
        datasetFileName: dataset.fileName,
        valueColumn: activeValue,
        seriesFilter: filter,
        summary,
      }
      await onPersist(withHmmBootstrap(project, row))
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

  if (eligible.length === 0) {
    return (
      <section className="panel" aria-labelledby="boot-heading">
        <h2 id="boot-heading" className="panel-title">
          HMM bootstrap uncertainty
        </h2>
        <p className="muted">
          Commit a CSV/JSON with a Value column to run moving-block bootstrap
          uncertainty on Gaussian HMM means, occupancies, and transitions.
        </p>
      </section>
    )
  }

  const display = live

  return (
    <section className="panel" aria-labelledby="boot-heading">
      <h2 id="boot-heading" className="panel-title">
        HMM bootstrap uncertainty
      </h2>
      <p className="muted">
        <strong>Moving-block bootstrap</strong> (nonparametric) of the 1D
        observation sequence: resample contiguous blocks (default L=⌊√T⌋), refit
        a Gaussian HMM with the same K and init seed on each replicate, then
        report mean ± SD and percentile intervals. States are aligned by sorting
        means ascending (label-switching). Latent states remain{' '}
        <strong>statistical indices</strong> — not biophysical conformations.
        Work runs in a Web Worker; results save under{' '}
        <code>project.state.hmmBootstraps</code> only.
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
            <span className="field-label">Series filter</span>
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
          <span className="field-label">nBoot</span>
          <input
            className="input"
            type="number"
            min={1}
            value={nBoot}
            disabled={running}
            onChange={(e) => setNBoot(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">nStates</span>
          <input
            className="input"
            type="number"
            min={1}
            value={nStates}
            disabled={running}
            onChange={(e) => setNStates(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">seed</span>
          <input
            className="input"
            type="number"
            value={seed}
            disabled={running}
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">maxIter</span>
          <input
            className="input"
            type="number"
            min={1}
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
            step="any"
            value={tol}
            disabled={running}
            onChange={(e) => setTol(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">blockLength (blank=√T)</span>
          <input
            className="input"
            type="number"
            min={1}
            placeholder="auto"
            value={blockLength}
            disabled={running}
            onChange={(e) => setBlockLength(e.target.value)}
          />
        </label>
      </div>

      <div className="row actions" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={running || persisting || !activeValue}
          onClick={() => void handleRun()}
        >
          {running ? 'Bootstrapping…' : 'Run bootstrap in Worker'}
        </button>
        {running && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => abortRef.current?.abort()}
          >
            Cancel
          </button>
        )}
      </div>

      {progress && <p className="muted small">{progress}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {display && (
        <div className="hmm-result" style={{ marginTop: '1rem' }}>
          <p className="muted small">
            Method: {display.method} · L={display.blockLength} · n=
            {display.observationCount} · B={display.nBoot} · align=
            {display.labelAlign}. {display.seedScheme}. Point fit:{' '}
            {display.pointEstimate.converged ? 'converged' : 'hit maxIter'} (
            {display.pointEstimate.iterations} iter). Replicates converged:{' '}
            {display.convergedCount}/{display.nBoot}.
          </p>
          <p className="muted small">
            Intervals are bootstrap percentiles across refits — statistical
            uncertainty on latent-state parameters, not physical conformation
            confidence.
          </p>

          <h3 className="hmm-subhead">Emission means (aligned by μ ↑)</h3>
          <table className="data-table hmm-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Point μ</th>
                <th>Boot mean ± SD [2.5%, 97.5%]</th>
              </tr>
            </thead>
            <tbody>
              {display.means.map((s, i) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>
                    <code>{fmt(display.pointEstimate.means[i]!, 6)}</code>
                  </td>
                  <td>
                    <code>{fmtSummary(s)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="hmm-subhead">Occupancies (Viterbi fractions)</h3>
          <table className="data-table hmm-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Point fraction</th>
                <th>Boot mean ± SD [2.5%, 97.5%]</th>
              </tr>
            </thead>
            <tbody>
              {display.occupancies.map((s, i) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>
                    <code>
                      {fmt(display.pointEstimate.occupancies[i]!, 4)}
                    </code>
                  </td>
                  <td>
                    <code>{fmtSummary(s)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="hmm-subhead">Transition probs A[i→j]</h3>
          <table className="data-table hmm-table">
            <thead>
              <tr>
                <th>i→j</th>
                <th>Point</th>
                <th>Boot mean ± SD [2.5%, 97.5%]</th>
              </tr>
            </thead>
            <tbody>
              {display.transitions.flatMap((row, i) =>
                row.map((s, j) => (
                  <tr key={`${i}-${j}`}>
                    <td>
                      {i}→{j}
                    </td>
                    <td>
                      <code>
                        {fmt(display.pointEstimate.transProb[i]![j]!, 4)}
                      </code>
                    </td>
                    <td>
                      <code>{fmtSummary(s)}</code>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>

          <MeanUncertaintyBars summary={display} />
        </div>
      )}

      {saved.length > 0 && (
        <details style={{ marginTop: '1rem' }}>
          <summary className="muted">
            Saved bootstraps ({saved.length})
          </summary>
          <ul className="muted small">
            {saved.slice(0, 5).map((c) => (
              <li key={c.id}>
                {c.datasetFileName} · K={c.summary.settings.nStates} · B=
                {c.summary.nBoot} · L={c.summary.blockLength} · seed{' '}
                {c.summary.settings.seed} · {c.createdAt}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

/** Simple CSS bar chart of mean ± SD — no biophysical labels. */
function MeanUncertaintyBars({ summary }: { summary: BootstrapSummary }) {
  const vals = summary.means
  if (vals.length === 0) return null
  const centers = vals.map((s) => s.mean)
  const spreads = vals.map((s) => s.sd)
  const lo = Math.min(...centers.map((c, i) => c - spreads[i]!))
  const hi = Math.max(...centers.map((c, i) => c + spreads[i]!))
  const span = hi - lo || 1
  return (
    <div className="boot-bars" role="img" aria-label="Mean uncertainty bars">
      <h3 className="hmm-subhead">Mean ± SD (aligned states)</h3>
      {vals.map((s, i) => {
        const left = ((s.mean - s.sd - lo) / span) * 100
        const width = ((2 * s.sd) / span) * 100
        const mid = ((s.mean - lo) / span) * 100
        return (
          <div key={i} className="boot-bar-row">
            <span className="boot-bar-label">S{i}</span>
            <div className="boot-bar-track">
              <span
                className="boot-bar-range"
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                title={`μ=${fmt(s.mean)} ± ${fmt(s.sd)}`}
              />
              <span className="boot-bar-point" style={{ left: `${mid}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
