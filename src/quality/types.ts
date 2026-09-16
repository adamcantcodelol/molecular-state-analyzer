export type QualitySeverity = 'info' | 'warn'

export type QualityIssue = {
  id: string
  severity: QualitySeverity
  code: string
  message: string
  /** Optional count / examples for the UI — never used to mutate data. */
  detail?: string
}

export type QualityReport = {
  datasetId: string
  checkedAt: string
  issues: QualityIssue[]
  /** True when at least one warn-level issue exists. */
  hasWarnings: boolean
}
