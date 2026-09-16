import { PERF_SUMMARY } from '../perf/limits'

/** Read-only Phase 16 documentation of performance limits (not a benchmark suite). */
export function PerfNotesPanel() {
  return (
    <section className="panel" aria-labelledby="perf-heading">
      <h2 id="perf-heading" className="panel-title">
        Performance notes
      </h2>
      <p className="muted">
        Heavy science stays on the <strong>CPU</strong> (Web Workers). GPU is only
        for optional 3D display. Limits below are safety guards — they do not invent
        results.
      </p>
      <ul className="muted small">
        <li>{PERF_SUMMARY.workers}</li>
        <li>{PERF_SUMMARY.gpu}</li>
        <li>
          Soft warn at {PERF_SUMMARY.obsWarn.toLocaleString()} observations; fits
          blocked above {PERF_SUMMARY.obsFitMax.toLocaleString()}.
        </li>
        <li>
          Time-series plots may stride-downsample above{' '}
          {PERF_SUMMARY.plotMaxPoints.toLocaleString()} points (display only;
          stored data unchanged).
        </li>
      </ul>
      <p className="muted small">
        See <code>fixtures/README-performance.md</code>.
      </p>
    </section>
  )
}
