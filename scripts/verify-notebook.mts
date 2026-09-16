import type { Project } from '../src/types/project'
import {
  appendNotebookEntry,
  archiveNotebookEntry,
  captureProjectVersion,
  currentVersion,
  getNotebookEntries,
  getProjectVersions,
} from '../src/notebook/persist'
import {
  buildResearchReport,
  researchReportToJson,
  researchReportToMarkdown,
} from '../src/notebook/exportReport'
import { upsertHypothesis, newHypothesisId } from '../src/conditions/persist'
import { HYPOTHESIS_KIND } from '../src/types/conditions'

let project: Project = {
  id: 'p1',
  name: 'Smoke',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  datasets: [
    {
      id: 'd1',
      fileName: 'a.csv',
      format: 'csv',
      importedAt: '2026-01-01T00:00:00.000Z',
      originalText: 'SECRET_ORIGINAL_SHOULD_NOT_APPEAR',
      byteLength: 10,
      warnings: [],
      summary: {
        kind: 'csv',
        columnNames: ['t', 'v'],
        rowCount: 1,
        previewRows: [],
      },
    },
  ],
  state: {},
}

project = appendNotebookEntry(project, {
  title: 'Saw peak',
  body: 'Raw peak at t=3',
  epistemicKind: 'observation',
  datasetIds: ['d1'],
})
const e1 = getNotebookEntries(project)[0]!
if (e1.versions.length !== 1) throw new Error('expected v1')

project = appendNotebookEntry(project, {
  id: e1.id,
  title: 'Saw peak',
  body: 'Likely two-state switch',
  epistemicKind: 'inference',
  datasetIds: ['d1'],
})
const e2 = getNotebookEntries(project)[0]!
if (e2.versions.length !== 2) throw new Error('expected v2 appended')
if (e2.versions[0]!.body !== 'Raw peak at t=3') throw new Error('v1 mutated!')
if (currentVersion(e2).epistemicKind !== 'inference') throw new Error('current kind')

const now = new Date().toISOString()
project = upsertHypothesis(project, {
  id: newHypothesisId(),
  createdAt: now,
  updatedAt: now,
  kind: HYPOTHESIS_KIND,
  title: 'Ligand opens state',
  idea: 'Maybe ligand binds open',
  ligandName: 'X',
  stateNotes: '',
  conditionIds: [],
  datasetIds: ['d1'],
})

project = captureProjectVersion(project, { label: 'v-smoke', notes: 'test' })
const vers = getProjectVersions(project)
if (vers.length !== 1) throw new Error('version count')
if (JSON.stringify(vers[0]).includes('SECRET_ORIGINAL')) {
  throw new Error('originalText leaked into version snapshot')
}

const report = buildResearchReport(project)
if (report.sections.inferences.length !== 1) throw new Error('inference missing')
if (report.sections.userHypotheses.length !== 1) throw new Error('hyp missing')
if (report.sections.userHypotheses[0]!.kind !== 'user_hypothesis') {
  throw new Error('hyp kind')
}
const md = researchReportToMarkdown(report)
const json = researchReportToJson(report)
for (const blob of [md, json, JSON.stringify(report)]) {
  if (blob.includes('SECRET_ORIGINAL')) throw new Error('originalText in export')
}
if (
  !md.includes('## Observations') ||
  !md.includes('## Inferences') ||
  !md.includes('## User hypotheses')
) {
  throw new Error('missing section headings')
}
const obsIdx = md.indexOf('## Observations')
const infIdx = md.indexOf('## Inferences')
const hypIdx = md.indexOf('## User hypotheses')
if (!(obsIdx < infIdx && infIdx < hypIdx)) throw new Error('section order')

project = archiveNotebookEntry(project, e2.id)
if (!getNotebookEntries(project).find((e) => e.id === e2.id)?.archived) {
  throw new Error('archive failed')
}

// After archive, report should exclude archived from primary sections
const report2 = buildResearchReport(project)
if (report2.sections.inferences.length !== 0) {
  throw new Error('archived inference still in report')
}

console.log('SMOKE OK', {
  versions: e2.versions.length,
  reportInf: report.sections.inferences.length,
  reportHyp: report.sections.userHypotheses.length,
  projectVersions: vers.length,
})
