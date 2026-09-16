import { useMemo, useState } from 'react'
import {
  summarizeProjectStats,
  type StatsRowKind,
  type StatsSourceModule,
  type StatsSummaryRow,
} from '../stats/summarizeRuns'
import type { Project } from '../types/project'

type Props = {
  /** Read-only project snapshot; this panel never mutates state or originals. */
  project: Project
}

type FilterKind = 'all' | StatsRowKind

const FILTER_OPTIONS: Array<{ value: FilterKind; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'hmmRun', label: 'HMM' },
  { value: 'hmmComparison', label: 'AIC/BIC' },
  { value: 'hmmBootstrap', label: 'Bootstrap' },
  { value: 'smfretHmmRun', label: 'smFRET HMM' },
]

const SOURCE_PILL: Record<StatsSourceModule, string> = {
  HMM: 'pill-stats-hmm',
  'AIC/BIC': 'pill-stats-aic',
  Bootstrap: 'pill-stats-boot',
  'smFRET HMM': 'pill-stats-smfret',
}

const DISCLAIMER =
  'Read-only summary of persisted runs under project.state. Metrics (LL, AIC/BIC ' +
  '“prefer”, bootstrap mean±SD, E_FRET HMM means) are statistical fit outputs — ' +
  'not biophysical truth, conformation names, or evidence of a mechanism. ' +
  'This panel does not mutate originals or re-run analyses.'

function formatWhen(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso || '—'
  return new Date(t).toLocaleString()
}

export function StatsDashboardPanel({ project }: Props) {
  const [filter, setFilter] = useState<FilterKind>('all')

  const summary = useMemo(() => summarizeProjectStats(project), [project])

  const visible = useMemo(() => {
    if (filter === 'all') return summary.allRows
    return summary.allRows.filter((r) => r.kind === filter)
  }, [summary.allRows, filter])

  const counts = {
    hmm: summary.hmmRuns.length,
    aic: summary.hmmComparisons.length,
    boot: summary.hmmBootstraps.length,
    smfret: summary.smfretHmmRuns.length,
  }

  return (
    <section
      className="panel stats-dashboard-panel"
      aria-labelledby="stats-dash-heading"
    >
      <div className="panel-head">
        <h2 id="stats-dash-heading" className="panel-title">
          Statistics dashboard
        </h2>
        <span className="muted small">
          {summary.totalCount === 0
            ? 'No persisted runs'
            : `${summary.totalCount} run${summary.totalCount === 1 ? '' : 's'} · read-only`}
        </span>
      </div>

      <p className="warn-box" role="note">
        {DISCLAIMER}
      </p>

      {summary.totalCount === 0 ? (
        <div className="empty-state">
          <p>No analysis runs saved yet.</p>
          <p className="muted">
            Run a Gaussian HMM, AIC/BIC comparison, bootstrap, or smFRET HMM
            from the panels below. Their results land under{' '}
            <code>project.state</code> (
            <code>hmmRuns</code>, <code>hmmComparisons</code>,{' '}
            <code>hmmBootstraps</code>, <code>smfretHmmRuns</code>) and will
            appear here with provenance — without claiming biophysical truth.
          </p>
        </div>
      ) : (
        <>
          <div className="stats-count-row" aria-label="Run counts by module">
            <span className="stats-count">
              <span className={`pill ${SOURCE_PILL.HMM}`}>HMM</span>{' '}
              {counts.hmm}
            </span>
            <span className="stats-count">
              <span className={`pill ${SOURCE_PILL['AIC/BIC']}`}>AIC/BIC</span>{' '}
              {counts.aic}
            </span>
            <span className="stats-count">
              <span className={`pill ${SOURCE_PILL.Bootstrap}`}>Bootstrap</span>{' '}
              {counts.boot}
            </span>
            <span className="stats-count">
              <span className={`pill ${SOURCE_PILL['smFRET HMM']}`}>
                smFRET HMM
              </span>{' '}
              {counts.smfret}
            </span>
          </div>

          <div
            className="stats-filter-row"
            role="group"
            aria-label="Filter by source module"
          >
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={
                  filter === opt.value
                    ? 'btn btn-ghost btn-sm mm-tab is-active'
                    : 'btn btn-ghost btn-sm mm-tab'
                }
                aria-pressed={filter === opt.value}
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="muted small" style={{ marginTop: '0.75rem' }}>
              No runs in this filter.
            </p>
          ) : (
            <ul className="stats-run-list">
              {visible.map((row) => (
                <StatsRunCard key={`${row.kind}:${row.id}`} row={row} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function StatsRunCard({ row }: { row: StatsSummaryRow }) {
  return (
    <li className="stats-run-card">
      <div className="stats-run-card-head">
        <div className="stats-run-title-row">
          <span className={`pill ${SOURCE_PILL[row.sourceModule]}`}>
            {row.sourceModule}
          </span>
          <strong className="stats-dataset-name" title={row.datasetId}>
            {row.datasetName}
          </strong>
        </div>
        <time
          className="muted small"
          dateTime={row.createdAt}
          title={row.createdAt}
        >
          {formatWhen(row.createdAt)}
        </time>
      </div>
      <dl className="stats-meta-grid">
        <div>
          <dt>Settings</dt>
          <dd>
            <code>{row.settingsSnippet}</code>
          </dd>
        </div>
        <div>
          <dt>Key metrics</dt>
          <dd>
            <code>{row.metricsSnippet}</code>
          </dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd className="muted small">{row.provenanceNotes}</dd>
        </div>
      </dl>
    </li>
  )
}
