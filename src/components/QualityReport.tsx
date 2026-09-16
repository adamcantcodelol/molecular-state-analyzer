import { useMemo } from 'react'
import { checkDataset } from '../quality/checkDataset'
import type { QualityIssue } from '../quality/types'
import type { ImportedDataset } from '../types/dataset'

type Props = {
  dataset: ImportedDataset
}

export function QualityReport({ dataset }: Props) {
  const report = useMemo(() => checkDataset(dataset), [dataset])
  const warns = report.issues.filter((i) => i.severity === 'warn')
  const infos = report.issues.filter((i) => i.severity === 'info')

  return (
    <div className="quality-report" role="region" aria-label="Data quality">
      <div className="quality-head">
        <h3 className="subheading quality-title">Data quality</h3>
        <span className={`quality-badge ${report.hasWarnings ? 'is-warn' : 'is-ok'}`}>
          {report.hasWarnings
            ? `${warns.length} warning${warns.length === 1 ? '' : 's'}`
            : 'No quality warnings'}
        </span>
      </div>
      <p className="muted small">
        Checks inspect a derived view of the stored original. Issues are reported
        only — nothing is silently fixed, deleted, or rewritten.
      </p>

      {warns.length === 0 && infos.length === 0 && (
        <p className="muted small">No issues flagged for this dataset.</p>
      )}

      {warns.length > 0 && (
        <div className="warn-box quality-warns" role="status">
          <strong>Warnings</strong>
          <ul className="warn-list">
            {warns.map((issue) => (
              <IssueItem key={issue.id} issue={issue} />
            ))}
          </ul>
        </div>
      )}

      {infos.length > 0 && (
        <details className="quality-infos">
          <summary>
            {infos.length} parse / load note{infos.length === 1 ? '' : 's'}
          </summary>
          <ul className="warn-list">
            {infos.map((issue) => (
              <IssueItem key={issue.id} issue={issue} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function IssueItem({ issue }: { issue: QualityIssue }) {
  return (
    <li>
      <span className="quality-code">{issue.code}</span>
      {' — '}
      {issue.message}
      {issue.detail && (
        <div className="muted small quality-detail">{issue.detail}</div>
      )}
    </li>
  )
}
