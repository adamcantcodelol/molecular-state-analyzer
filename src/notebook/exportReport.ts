/**
 * Research report export — Markdown and JSON.
 * Sections stay distinct: Observations / Inferences / User hypotheses.
 * Never conflates epistemic kinds or mutates originals.
 */
import { getHypotheses } from '../conditions/persist'
import type { UserHypothesis } from '../types/conditions'
import type {
  NotebookEntry,
  NotebookEntryVersion,
  NotebookEpistemicKind,
  ProjectVersionSnapshot,
} from '../types/notebook'
import type { Project } from '../types/project'
import {
  currentVersion,
  getNotebookEntries,
  getProjectVersions,
} from './persist'

export type ReportObservation = {
  entryId: string
  version: number
  title: string
  body: string
  createdAt: string
  entryCreatedAt: string
  versionCount: number
  datasetIds: string[]
  conditionIds: string[]
  hypothesisIds: string[]
}

export type ReportInference = ReportObservation

export type ReportNote = ReportObservation

export type ReportHypothesis = {
  id: string
  kind: 'user_hypothesis'
  title: string
  idea: string
  ligandName: string
  stateNotes: string
  conditionIds: string[]
  datasetIds: string[]
  createdAt: string
  updatedAt: string
}

export type ResearchReport = {
  formatVersion: 1
  exportedAt: string
  project: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }
  disclaimer: string
  sections: {
    observations: ReportObservation[]
    inferences: ReportInference[]
    userHypotheses: ReportHypothesis[]
    /** Explicitly separate — never merged into the three primary sections. */
    otherNotes: ReportNote[]
  }
  projectVersions: Array<{
    id: string
    createdAt: string
    label: string
    notes: string
    datasetCount: number
    stateFingerprint: string
    stateSummary: ProjectVersionSnapshot['stateSummary']
  }>
  datasetMeta: Array<{
    id: string
    fileName: string
    format: string
    importedAt: string
    byteLength: number
    synthetic?: boolean
  }>
}

const REPORT_DISCLAIMER =
  'This report separates Observations, Inferences, and User hypotheses. ' +
  'User hypotheses (kind: user_hypothesis) are not evidence and are never ' +
  'auto-promoted to proven results. Notebook edits append versions; prior ' +
  'revisions remain in history. Dataset originalText is not included and ' +
  'was not mutated.'

function toItem(
  entry: NotebookEntry,
  ver: NotebookEntryVersion,
): ReportObservation {
  return {
    entryId: entry.id,
    version: ver.version,
    title: ver.title,
    body: ver.body,
    createdAt: ver.createdAt,
    entryCreatedAt: entry.createdAt,
    versionCount: entry.versions.length,
    datasetIds: [...entry.datasetIds],
    conditionIds: [...entry.conditionIds],
    hypothesisIds: [...entry.hypothesisIds],
  }
}

function bucketByKind(
  entries: NotebookEntry[],
  kind: NotebookEpistemicKind,
): ReportObservation[] {
  const out: ReportObservation[] = []
  for (const entry of entries) {
    if (entry.archived) continue
    const ver = currentVersion(entry)
    if (ver.epistemicKind !== kind) continue
    out.push(toItem(entry, ver))
  }
  return out
}

function hypothesisItem(h: UserHypothesis): ReportHypothesis {
  return {
    id: h.id,
    kind: 'user_hypothesis',
    title: h.title,
    idea: h.idea,
    ligandName: h.ligandName,
    stateNotes: h.stateNotes,
    conditionIds: [...h.conditionIds],
    datasetIds: [...h.datasetIds],
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
  }
}

/** Build a structured research report from project.state (read-only). */
export function buildResearchReport(project: Project): ResearchReport {
  const entries = getNotebookEntries(project)
  const hypotheses = getHypotheses(project)
  const versions = getProjectVersions(project)
  const datasets = project.datasets ?? []

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    disclaimer: REPORT_DISCLAIMER,
    sections: {
      observations: bucketByKind(entries, 'observation'),
      inferences: bucketByKind(entries, 'inference'),
      userHypotheses: hypotheses.map(hypothesisItem),
      otherNotes: bucketByKind(entries, 'note'),
    },
    projectVersions: versions.map((v) => ({
      id: v.id,
      createdAt: v.createdAt,
      label: v.label,
      notes: v.notes,
      datasetCount: v.datasetMeta.length,
      stateFingerprint: v.stateFingerprint,
      stateSummary: v.stateSummary,
    })),
    datasetMeta: datasets.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      format: d.format,
      importedAt: d.importedAt,
      byteLength: d.byteLength,
      synthetic: d.synthetic === true ? true : undefined,
    })),
  }
}

function mdEscape(s: string): string {
  return s.replace(/\r\n/g, '\n')
}

function sectionBlock(
  heading: string,
  items: ReportObservation[],
  emptyLabel: string,
): string {
  const lines: string[] = [`## ${heading}`, '']
  if (items.length === 0) {
    lines.push(`_${emptyLabel}_`, '')
    return lines.join('\n')
  }
  for (const item of items) {
    const title = item.title.trim() || '(untitled)'
    lines.push(`### ${mdEscape(title)}`)
    lines.push('')
    lines.push(
      `- Entry \`${item.entryId}\` · version **${item.version}** of ${item.versionCount} · ${item.createdAt}`,
    )
    if (item.datasetIds.length) {
      lines.push(`- Linked datasets: ${item.datasetIds.map((id) => `\`${id}\``).join(', ')}`)
    }
    if (item.conditionIds.length) {
      lines.push(
        `- Linked conditions: ${item.conditionIds.map((id) => `\`${id}\``).join(', ')}`,
      )
    }
    if (item.hypothesisIds.length) {
      lines.push(
        `- Linked user hypotheses (ids only): ${item.hypothesisIds.map((id) => `\`${id}\``).join(', ')}`,
      )
    }
    lines.push('')
    lines.push(mdEscape(item.body.trim() || '_(empty)_'))
    lines.push('')
  }
  return lines.join('\n')
}

/** Serialize report to Markdown with clearly labeled epistemic sections. */
export function researchReportToMarkdown(report: ResearchReport): string {
  const lines: string[] = []
  lines.push(`# Research report — ${mdEscape(report.project.name)}`)
  lines.push('')
  lines.push(`Exported: ${report.exportedAt}`)
  lines.push(`Project id: \`${report.project.id}\``)
  lines.push(`Project updated: ${report.project.updatedAt}`)
  lines.push('')
  lines.push('> **Disclaimer.** ' + report.disclaimer)
  lines.push('')
  lines.push(
    'The three primary sections below are **never conflated**: Observations, Inferences, and User hypotheses.',
  )
  lines.push('')

  lines.push(
    sectionBlock(
      'Observations',
      report.sections.observations,
      'No observation entries.',
    ),
  )
  lines.push(
    sectionBlock(
      'Inferences',
      report.sections.inferences,
      'No inference entries.',
    ),
  )

  lines.push('## User hypotheses')
  lines.push('')
  lines.push(
    '_Kind: `user_hypothesis` — not evidence, not a scientific conclusion. Never auto-promoted._',
  )
  lines.push('')
  if (report.sections.userHypotheses.length === 0) {
    lines.push('_No user hypotheses._', '')
  } else {
    for (const h of report.sections.userHypotheses) {
      const title = h.title.trim() || '(untitled)'
      lines.push(`### ${mdEscape(title)}`)
      lines.push('')
      lines.push(`- Id \`${h.id}\` · kind: **user_hypothesis** · updated ${h.updatedAt}`)
      if (h.ligandName.trim()) {
        lines.push(`- Ligand: ${mdEscape(h.ligandName)}`)
      }
      if (h.conditionIds.length) {
        lines.push(
          `- Conditions: ${h.conditionIds.map((id) => `\`${id}\``).join(', ')}`,
        )
      }
      if (h.datasetIds.length) {
        lines.push(
          `- Datasets: ${h.datasetIds.map((id) => `\`${id}\``).join(', ')}`,
        )
      }
      lines.push('')
      lines.push(mdEscape(h.idea.trim() || '_(empty idea)_'))
      if (h.stateNotes.trim()) {
        lines.push('')
        lines.push(`State notes: ${mdEscape(h.stateNotes)}`)
      }
      lines.push('')
    }
  }

  if (report.sections.otherNotes.length > 0) {
    lines.push(
      sectionBlock(
        'Other notes (not observation / inference / hypothesis)',
        report.sections.otherNotes,
        'No other notes.',
      ),
    )
  }

  lines.push('## Project versions (metadata snapshots)')
  lines.push('')
  if (report.projectVersions.length === 0) {
    lines.push('_No project version snapshots._', '')
  } else {
    for (const v of report.projectVersions) {
      lines.push(`### ${mdEscape(v.label || v.id)}`)
      lines.push('')
      lines.push(`- Id \`${v.id}\` · ${v.createdAt}`)
      lines.push(`- Datasets in snapshot: ${v.datasetCount}`)
      lines.push(`- Fingerprint: \`${v.stateFingerprint}\``)
      if (v.notes.trim()) {
        lines.push(`- Notes: ${mdEscape(v.notes)}`)
      }
      lines.push('')
    }
  }

  lines.push('## Dataset metadata (no originalText)')
  lines.push('')
  if (report.datasetMeta.length === 0) {
    lines.push('_No datasets._', '')
  } else {
    for (const d of report.datasetMeta) {
      const syn = d.synthetic ? ' · **SYNTHETIC**' : ''
      lines.push(
        `- \`${d.fileName}\` (${d.format}, ${d.byteLength} bytes, imported ${d.importedAt})${syn} — id \`${d.id}\``,
      )
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(
    '_End of report. originalText was not exported and was not mutated._',
  )
  lines.push('')
  return lines.join('\n')
}

/** Serialize report to pretty-printed JSON. */
export function researchReportToJson(report: ResearchReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

export { REPORT_DISCLAIMER }
