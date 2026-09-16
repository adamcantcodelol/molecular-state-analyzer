import { useEffect, useMemo, useRef, useState } from 'react'
import type { ImportedDataset, MmcifSummary, PdbSummary } from '../types/dataset'
import { probeWebGl } from '../viz/webglSupport'

type Props = {
  datasets: ImportedDataset[]
}

type ViewerMode = 'full' | 'reduced' | 'summary'

type MolstarViewer = {
  loadStructureFromData: (
    data: string,
    format: 'pdb' | 'mmcif',
    options?: { dataLabel?: string },
  ) => Promise<void>
  handleResize: () => void
  dispose: () => void
  plugin: {
    clear: () => void
    canvas3d?: {
      setProps: (props: Record<string, unknown>) => void
    } | null
  }
}

function isStructureDataset(d: ImportedDataset): boolean {
  return d.format === 'pdb' || d.format === 'mmcif'
}

function formatLabel(d: ImportedDataset): string {
  const tag = d.format === 'pdb' ? 'PDB' : 'mmCIF'
  return `${d.fileName} (${tag})`
}

function StructureSummaryView({ dataset }: { dataset: ImportedDataset }) {
  const s = dataset.summary
  if (s.kind === 'pdb') {
    const pdb = s as PdbSummary
    return (
      <dl className="meta-grid viewer-summary-grid">
        <div>
          <dt>Title</dt>
          <dd>{pdb.title ?? '—'}</dd>
        </div>
        <div>
          <dt>ATOM</dt>
          <dd>{pdb.atomCount}</dd>
        </div>
        <div>
          <dt>HETATM</dt>
          <dd>{pdb.hetatmCount}</dd>
        </div>
        <div>
          <dt>Models</dt>
          <dd>{pdb.modelCount}</dd>
        </div>
        <div>
          <dt>Chains</dt>
          <dd>{pdb.chainIds.length ? pdb.chainIds.join(', ') : '—'}</dd>
        </div>
      </dl>
    )
  }
  if (s.kind === 'mmcif') {
    const cif = s as MmcifSummary
    return (
      <dl className="meta-grid viewer-summary-grid">
        <div>
          <dt>Entry</dt>
          <dd>{cif.entryId ?? '—'}</dd>
        </div>
        <div>
          <dt>_atom_site rows</dt>
          <dd>{cif.atomSiteRows ?? '—'}</dd>
        </div>
        <div>
          <dt>Data blocks</dt>
          <dd>{cif.dataBlockIds.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt>Categories</dt>
          <dd>{cif.categoryNames.slice(0, 12).join(', ') || '—'}</dd>
        </div>
      </dl>
    )
  }
  return <p className="muted">No structural summary for this format.</p>
}

/**
 * Display-only Mol* panel for PDB/mmCIF datasets.
 * Reads originalText for rendering only — never writes back to the dataset
 * or analysis results.
 */
export function MolecularViewerPanel({ datasets }: Props) {
  const structures = useMemo(
    () => datasets.filter(isStructureDataset),
    [datasets],
  )

  const [datasetId, setDatasetId] = useState('')
  const [mode, setMode] = useState<ViewerMode>('full')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [webglOk, setWebglOk] = useState(true)
  const [webglNote, setWebglNote] = useState<string | null>(null)
  const [viewerEpoch, setViewerEpoch] = useState(0)

  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<MolstarViewer | null>(null)
  const loadGen = useRef(0)

  const activeId =
    datasetId && structures.some((d) => d.id === datasetId)
      ? datasetId
      : (structures[0]?.id ?? '')
  const dataset = structures.find((d) => d.id === activeId) ?? null

  // Probe WebGL once; auto-downgrade when unavailable.
  useEffect(() => {
    const probe = probeWebGl()
    if (!probe.ok) {
      setWebglOk(false)
      setWebglNote(probe.reason)
      setMode('summary')
      return
    }
    setWebglOk(true)
    setWebglNote(`WebGL${probe.version} available`)
  }, [])

  // Create / tear down Mol* when mode allows 3D.
  useEffect(() => {
    if (mode === 'summary') {
      if (viewerRef.current) {
        viewerRef.current.dispose()
        viewerRef.current = null
      }
      if (hostRef.current) hostRef.current.innerHTML = ''
      return
    }

    if (!hostRef.current) return

    let cancelled = false

    async function boot() {
      setError(null)
      setStatus('Loading Mol*…')
      try {
        const [{ Viewer }] = await Promise.all([
          import('molstar/lib/apps/viewer/app'),
          import('molstar/lib/mol-plugin-ui/skin/light.scss'),
        ])
        const hostEl = hostRef.current
        if (cancelled || !hostEl) return

        if (viewerRef.current) {
          viewerRef.current.dispose()
          viewerRef.current = null
        }
        hostEl.innerHTML = ''

        const reduced = mode === 'reduced'
        const viewer = (await Viewer.create(hostEl, {
          layoutIsExpanded: false,
          layoutShowControls: !reduced,
          layoutShowRemoteState: false,
          layoutShowSequence: !reduced,
          layoutShowLog: false,
          layoutShowLeftPanel: !reduced,
          collapseLeftPanel: true,
          collapseRightPanel: true,
          viewportShowExpand: false,
          viewportShowToggleFullscreen: true,
          viewportShowControls: !reduced,
          viewportShowSettings: !reduced,
          viewportShowSelectionMode: false,
          viewportShowAnimation: false,
          viewportShowTrajectoryControls: false,
          viewportShowScreenshotControls: false,
          powerPreference: 'low-power',
          preferWebgl1: reduced,
          allowMajorPerformanceCaveat: true,
          pixelScale: reduced ? 0.6 : 1,
          pickScale: reduced ? 0.25 : 0.5,
          illumination: false,
          volumeStreamingDisabled: true,
          disabledExtensions: [
            'mp4-export',
            'geo-export',
            'model-export',
            'zenodo-import',
            'backgrounds',
          ],
        })) as unknown as MolstarViewer

        if (cancelled) {
          viewer.dispose()
          return
        }
        viewerRef.current = viewer
        setStatus(
          reduced ? 'Mol* ready (reduced detail)' : 'Mol* ready',
        )
        setViewerEpoch((n) => n + 1)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to start Mol* viewer.'
        setError(msg)
        setStatus(null)
        setWebglOk(false)
        setWebglNote(`Mol* init failed — showing summary only. (${msg})`)
        setMode('summary')
      }
    }

    void boot()

    return () => {
      cancelled = true
      if (viewerRef.current) {
        viewerRef.current.dispose()
        viewerRef.current = null
      }
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
  }, [mode, structures.length])

  // Load selected structure (read-only from originalText).
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !dataset || mode === 'summary' || viewerEpoch === 0) return

    const gen = ++loadGen.current
    let cancelled = false

    async function load() {
      setError(null)
      setStatus(`Loading ${dataset!.fileName}…`)
      try {
        viewer!.plugin.clear()
        const format = dataset!.format === 'pdb' ? 'pdb' : 'mmcif'
        // Copy so Mol* cannot mutate our stored originalText.
        const text = String(dataset!.originalText)
        await viewer!.loadStructureFromData(text, format, {
          dataLabel: dataset!.fileName,
        })
        if (cancelled || gen !== loadGen.current) return

        if (mode === 'reduced') {
          viewer!.plugin.canvas3d?.setProps({
            renderer: { xrayEdgeFalloff: 1 },
          })
        }
        viewer!.handleResize()
        setStatus(
          mode === 'reduced'
            ? `Showing ${dataset!.fileName} (reduced: lower pixel scale, minimal UI)`
            : `Showing ${dataset!.fileName}`,
        )
      } catch (err) {
        if (cancelled || gen !== loadGen.current) return
        const msg =
          err instanceof Error ? err.message : 'Failed to load structure.'
        setError(msg)
        setStatus(null)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [dataset, mode, viewerEpoch])

  // Resize observer
  useEffect(() => {
    const host = hostRef.current
    if (!host || mode === 'summary') return
    const ro = new ResizeObserver(() => {
      viewerRef.current?.handleResize()
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [mode, viewerEpoch])

  return (
    <section className="panel viewer-panel" aria-labelledby="viewer-heading">
      <div className="panel-head">
        <h2 id="viewer-heading" className="panel-title">
          3D structure viewer
        </h2>
        <span className="muted small">Mol* · display-only</span>
      </div>

      <p className="muted small">
        Renders imported PDB/mmCIF from <code>originalText</code> only. The
        viewer never mutates stored files or HMM/analysis results.
      </p>

      {structures.length === 0 ? (
        <p className="muted">
          No PDB or mmCIF datasets in this project yet. Import{' '}
          <code>fixtures/sample.pdb</code> or <code>fixtures/sample.cif</code>{' '}
          to try the viewer.
        </p>
      ) : (
        <>
          <div className="row viewer-controls">
            <label className="field">
              <span className="field-label">Dataset</span>
              <select
                value={activeId}
                onChange={(e) => setDatasetId(e.target.value)}
              >
                {structures.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatLabel(d)}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="viewer-mode">
              <legend className="field-label">Mode</legend>
              <label className="choice">
                <input
                  type="radio"
                  name="viewer-mode"
                  checked={mode === 'full'}
                  disabled={!webglOk}
                  onChange={() => setMode('full')}
                />
                Full
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="viewer-mode"
                  checked={mode === 'reduced'}
                  disabled={!webglOk}
                  onChange={() => setMode('reduced')}
                />
                Reduced (CPU-safe)
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="viewer-mode"
                  checked={mode === 'summary'}
                  onChange={() => setMode('summary')}
                />
                Summary only
              </label>
            </fieldset>
          </div>

          {webglNote && (
            <p className="muted small" role="status">
              {webglNote}
            </p>
          )}
          {status && (
            <p className="muted small" role="status">
              {status}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {mode === 'summary' ? (
            <div className="viewer-fallback">
              <p className="warn-banner">
                3D view unavailable or turned off — showing parsed structure
                summary instead of WebGL
                {!webglOk && webglNote ? ` (${webglNote})` : ''}.
              </p>
              {dataset && <StructureSummaryView dataset={dataset} />}
            </div>
          ) : (
            <div
              ref={hostRef}
              className={
                mode === 'reduced'
                  ? 'molstar-host molstar-host-reduced'
                  : 'molstar-host'
              }
              aria-label="Molstar molecular canvas"
            />
          )}

          {mode !== 'summary' && dataset && (
            <details className="viewer-details">
              <summary>Structure summary (from import parse)</summary>
              <StructureSummaryView dataset={dataset} />
            </details>
          )}
        </>
      )}
    </section>
  )
}
