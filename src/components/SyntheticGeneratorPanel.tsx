import { useMemo, useState } from 'react'
import { newDatasetId } from '../import/ids'
import { utf8ByteLength } from '../import/readFileAsText'
import {
  defaultSynthParams,
  generateHmmSeries,
  type SynthHmmParams,
  type SynthHmmSeries,
} from '../synth/generateHmmSeries'
import type { ImportedDataset } from '../types/dataset'

type Props = {
  onAddDataset: (dataset: ImportedDataset) => Promise<void>
  busy?: boolean
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

function parseList(text: string, k: number, fill: (i: number) => number): number[] {
  const raw = text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
  return Array.from({ length: k }, (_, i) =>
    Number.isFinite(raw[i]) ? raw[i]! : fill(i),
  )
}

export function SyntheticGeneratorPanel({
  onAddDataset,
  busy = false,
}: Props) {
  const defaults = defaultSynthParams()
  const [seed, setSeed] = useState(String(defaults.seed))
  const [length, setLength] = useState(String(defaults.length))
  const [nStates, setNStates] = useState(String(defaults.nStates))
  const [meansText, setMeansText] = useState(defaults.means.join(', '))
  const [varsText, setVarsText] = useState(defaults.variances.join(', '))
  const [stayProb, setStayProb] = useState(String(defaults.stayProb))
  const [preview, setPreview] = useState<SynthHmmSeries | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const params: SynthHmmParams = useMemo(() => {
    const k = Math.max(1, Math.floor(Number(nStates)) || 1)
    const means = parseList(meansText, k, (i) => i * 5)
    const variances = parseList(varsText, k, () => 0.25).map((v) =>
      v > 0 ? v : 0.25,
    )
    return {
      seed: Number(seed),
      length: Number(length),
      nStates: k,
      means,
      variances,
      stayProb: Number(stayProb),
    }
  }, [seed, length, nStates, meansText, varsText, stayProb])

  function handleGenerate() {
    setError(null)
    setStatus(null)
    if (!Number.isFinite(params.seed)) {
      setError('Seed must be a finite number.')
      return
    }
    if (!Number.isFinite(params.length) || params.length < 2) {
      setError('Length must be at least 2.')
      return
    }
    if (
      !Number.isFinite(params.stayProb) ||
      params.stayProb < 0 ||
      params.stayProb > 1
    ) {
      setError('stayProb must be in [0, 1].')
      return
    }
    if (params.variances.some((v) => !(v > 0))) {
      setError('All variances must be positive.')
      return
    }
    try {
      const series = generateHmmSeries(params)
      setPreview(series)
      setStatus(
        `Generated SYNTHETIC series (n=${series.params.length}, K=${series.params.nStates}, seed=${series.params.seed}).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.')
      setPreview(null)
    }
  }

  function handleDownloadCsv() {
    if (!preview) return
    downloadBlob(
      `synthetic_hmm_seed${preview.params.seed}.csv`,
      preview.csv,
      'text/csv;charset=utf-8',
    )
  }

  function handleDownloadJson() {
    if (!preview) return
    downloadBlob(
      `synthetic_hmm_seed${preview.params.seed}.json`,
      preview.json,
      'application/json;charset=utf-8',
    )
  }

  async function handleAddToProject() {
    if (!preview) return
    setAdding(true)
    setError(null)
    setStatus(null)
    try {
      const p = preview.params
      const fileName = `synthetic_hmm_seed${p.seed}.csv`
      const originalText = preview.csv
      const columnNames = ['time', 'value', 'series', 'true_state']
      const previewRows = preview.time.slice(0, 5).map((t, i) => ({
        time: t,
        value: preview.value[i]!,
        series: preview.series,
        true_state: preview.trueState[i]!,
      }))

      const dataset: ImportedDataset = {
        id: newDatasetId(),
        fileName,
        format: 'csv',
        importedAt: new Date().toISOString(),
        originalText,
        byteLength: utf8ByteLength(originalText),
        warnings: [
          'SYNTHETIC dataset with known ground-truth true_state — NOT experimental or real laboratory data.',
          `Generated with seed=${p.seed}, K=${p.nStates}, length=${p.length}, stayProb=${p.stayProb}.`,
          `Ground-truth means=[${p.means.join(', ')}], variances=[${p.variances.join(', ')}].`,
          'Column true_state is ground-truth latent path (mapped as label); do not treat as experimental measurement.',
        ],
        summary: {
          kind: 'csv',
          columnNames,
          rowCount: p.length,
          previewRows,
        },
        columnMapping: [
          { column: 'time', role: 'time' },
          { column: 'value', role: 'value' },
          { column: 'series', role: 'series' },
          { column: 'true_state', role: 'label' },
        ],
        synthetic: true,
        syntheticMeta: {
          seed: p.seed,
          nStates: p.nStates,
          length: p.length,
          means: [...p.means],
          variances: [...p.variances],
          stayProb: p.stayProb,
        },
      }

      await onAddDataset(dataset)
      setStatus(`Added ${fileName} to project as SYNTHETIC dataset.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dataset.')
    } finally {
      setAdding(false)
    }
  }

  const previewRows = preview
    ? preview.time.slice(0, 8).map((t, i) => ({
        time: t,
        value: preview.value[i]!,
        true_state: preview.trueState[i]!,
      }))
    : []

  return (
    <section className="panel synth-panel" aria-labelledby="synth-heading">
      <div className="panel-head">
        <h2 id="synth-heading" className="panel-title">
          Synthetic HMM generator
        </h2>
        <span className="pill pill-synthetic">SYNTHETIC</span>
      </div>
      <p className="muted">
        Seeded Gaussian HMM path + emissions for testing (Mulberry32 +
        Box–Muller). Same seed and parameters → identical output. Data is{' '}
        <strong>SYNTHETIC</strong> with known <code>true_state</code> — never
        experimental.
      </p>

      <div className="explore-controls">
        <label className="field">
          <span className="field-label">seed</span>
          <input
            className="input"
            type="number"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            disabled={busy || adding}
          />
        </label>
        <label className="field">
          <span className="field-label">length</span>
          <input
            className="input"
            type="number"
            min={2}
            value={length}
            onChange={(e) => setLength(e.target.value)}
            disabled={busy || adding}
          />
        </label>
        <label className="field">
          <span className="field-label">K (nStates)</span>
          <input
            className="input"
            type="number"
            min={1}
            max={8}
            value={nStates}
            onChange={(e) => setNStates(e.target.value)}
            disabled={busy || adding}
          />
        </label>
        <label className="field">
          <span className="field-label">stayProb</span>
          <input
            className="input"
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={stayProb}
            onChange={(e) => setStayProb(e.target.value)}
            disabled={busy || adding}
          />
        </label>
        <label className="field">
          <span className="field-label">means (comma-separated)</span>
          <input
            className="input"
            type="text"
            value={meansText}
            onChange={(e) => setMeansText(e.target.value)}
            disabled={busy || adding}
            placeholder="0, 5"
          />
        </label>
        <label className="field">
          <span className="field-label">variances (comma-separated)</span>
          <input
            className="input"
            type="text"
            value={varsText}
            onChange={(e) => setVarsText(e.target.value)}
            disabled={busy || adding}
            placeholder="0.25, 0.25"
          />
        </label>
      </div>

      <div className="row actions hmm-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={busy || adding}
        >
          Generate preview
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleDownloadCsv}
          disabled={!preview || busy || adding}
        >
          Download CSV
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleDownloadJson}
          disabled={!preview || busy || adding}
        >
          Download JSON
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleAddToProject()}
          disabled={!preview || busy || adding}
        >
          {adding ? 'Adding…' : 'Add to project as SYNTHETIC'}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status && <p className="muted small">{status}</p>}

      {preview && (
        <div className="synth-preview">
          <h3 className="subheading">
            Preview (first {previewRows.length} of {preview.params.length})
          </h3>
          <p className="muted small">
            Params: seed={preview.params.seed}, K={preview.params.nStates},
            stayProb={preview.params.stayProb}, means=[
            {preview.params.means.join(', ')}], variances=[
            {preview.params.variances.join(', ')}]
          </p>
          <div className="mapper-table-wrap">
            <table className="data-table hmm-table">
              <thead>
                <tr>
                  <th>time</th>
                  <th>value</th>
                  <th>true_state</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.time}>
                    <td>{r.time}</td>
                    <td>{r.value.toPrecision(6)}</td>
                    <td>{r.true_state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
