import { useEffect, useMemo, useRef, useState } from 'react'
import { extractObservations } from '../hmm/extractObservations'
import { getHmmComparisons, withHmmComparison } from '../hmm/persist'
import { runHmmCompareInWorker } from '../hmm/runHmmWorker'
import {
  DEFAULT_HMM_SETTINGS,
  type HmmCompareResultMsg,
  type PersistedHmmComparison,
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
  return `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function fmt(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return String(n)
  return n.toPrecision(digits)
}

type Comparison = HmmCompareResultMsg['comparison']

export function ModelComparePanel({
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
  const [maxIter, setMaxIter] = useState(String(DEFAULT_HMM_SETTINGS.maxIter))
  const [tol, setTol] = useState(String(DEFAULT_HMM_SETTINGS.tol))
  const [seed, setSeed] = useState(String(DEFAULT_HMM_SETTINGS.seed))
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<Comparison | null>(null)
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

  const saved = getHmmComparisons(project)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function handleCompare() {
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

      const comparison = await runHmmCompareInWorker({
        observations: extracted.values,
        settings: {
          maxIter: Number(maxIter),
          tol: Number(tol),
          seed: Number(seed),
        },
        signal: ac.signal,
        onProgress: (nStates, iteration, logLikelihood) => {
          setProgress(
            `Fitting K=${nStates} · EM ${iteration} · avg LL ${fmt(logLikelihood, 8)}`,
          )
        },
      })

      setLive(comparison)
      setProgress(
        `Done · prefer AIC: K=${comparison.preferAic} · prefer BIC: K=${comparison.preferBic}`,
      )

      const row: PersistedHmmComparison = {
        id: newId(),
        createdAt: new Date().toISOString(),
        datasetId: dataset.id,
        datasetFileName: dataset.fileName,
        valueColumn: activeValue,
        seriesFilter: filter,
        shared: comparison.shared,
        models: comparison.models.map((m) => ({
          nStates: m.nStates,
          freeParams: m.freeParams,
          avgLogLikelihood: m.avgLogLikelihood,
          totalLogLikelihood: m.totalLogLikelihood,
          aic: m.aic,
          bic: m.bic,
          iterations: m.iterations,
          converged: m.converged,
          means: m.means,
        })),
        preferAic: comparison.preferAic,
        preferBic: comparison.preferBic,
        freeParamFormula: comparison.freeParamFormula,
      }
      await onPersist(withHmmComparison(project, row))
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
      <section className="panel" aria-labelledby="cmp-heading">
        <h2 id="cmp-heading" className="panel-title">
          2 vs 3 state comparison
        </h2>
        <p className="muted">
          Commit a CSV/JSON with a Value column to compare K=2 vs K=3 Gaussian
          HMMs using AIC/BIC (statistical labels only).
        </p>
      </section>
    )
  }

  const display = live

  return (
    <section className="panel" aria-labelledby="cmp-heading">
      <h2 id="cmp-heading" className="panel-title">
        2 vs 3 state comparison
      </h2>
      <p className="muted">
        Fits two Gaussian HMMs (K=2 and K=3) with the <strong>same</strong> seed
        and EM settings, then reports log-likelihood, AIC, and BIC. Latent
        states stay statistical indices — this does <strong>not</strong> name
        conformations. Lower AIC/BIC is preferred. Work runs in a Web Worker;
        originals are untouched (<code>project.state.hmmComparisons</code>).
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
          <span className="field-label">seed</span>
          <input
            className="input"
            type="number"
            value={seed}
            disabled={running}
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>
      </div>

      <div className="row actions" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={running || persisting || !activeValue}
          onClick={() => void handleCompare()}
        >
          {running ? 'Comparing…' : 'Compare K=2 vs K=3'}
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
      {error && <p className="error">{error}</p>}

      {display && (
        <div className="hmm-result" style={{ marginTop: '1rem' }}>
          <p className="muted small">
            Free params: {display.freeParamFormula}. n=
            {display.shared.observationCount}, seed={display.shared.seed}.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>K</th>
                <th>k (free)</th>
                <th>avg LL</th>
                <th>total LL</th>
                <th>AIC</th>
                <th>BIC</th>
                <th>iters</th>
                <th>means (stat. indices)</th>
              </tr>
            </thead>
            <tbody>
              {display.models.map((m) => (
                <tr key={m.nStates}>
                  <td>{m.nStates}</td>
                  <td>{m.freeParams}</td>
                  <td>{fmt(m.avgLogLikelihood, 8)}</td>
                  <td>{fmt(m.totalLogLikelihood, 8)}</td>
                  <td>
                    {fmt(m.aic, 8)}
                    {display.preferAic === m.nStates ? ' ←' : ''}
                  </td>
                  <td>
                    {fmt(m.bic, 8)}
                    {display.preferBic === m.nStates ? ' ←' : ''}
                  </td>
                  <td>
                    {m.iterations}
                    {m.converged ? '' : '*'}
                  </td>
                  <td>{m.means.map((x) => fmt(x, 4)).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Prefer by AIC: <strong>K={display.preferAic}</strong>. Prefer by
            BIC: <strong>K={display.preferBic}</strong>. Arrows mark the lower
            score. These are information-criteria picks, not conformation names.
          </p>
        </div>
      )}

      {saved.length > 0 && (
        <details style={{ marginTop: '1rem' }}>
          <summary className="muted">Saved comparisons ({saved.length})</summary>
          <ul className="muted small">
            {saved.slice(0, 5).map((c) => (
              <li key={c.id}>
                {c.datasetFileName} · seed {c.shared.seed} · AIC→K={c.preferAic}{' '}
                BIC→K={c.preferBic} · {c.createdAt}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
