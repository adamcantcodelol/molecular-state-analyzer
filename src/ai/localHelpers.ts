/**
 * Safe local helpers — no model, no network, no invented science.
 * Only reformats already-persisted notebook text the user owns.
 */
import {
  currentVersion,
  getNotebookEntries,
} from '../notebook/persist'
import { EPISTEMIC_KIND_LABELS, type NotebookEntry } from '../types/notebook'
import type { NotebookFormatExcerpt } from '../types/ai'
import type { Project } from '../types/project'

const BANNER =
  'Non-authoritative formatting of already-persisted notebook text — ' +
  'not an AI analysis, not scientific results, and not a model completion.'

/**
 * Collapse runs of whitespace inside a line; keep paragraph breaks.
 * Does not paraphrase or add claims.
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatOneEntry(entry: NotebookEntry): string {
  const cur = currentVersion(entry)
  const kind = EPISTEMIC_KIND_LABELS[cur.epistemicKind]
  const title = cur.title.trim() || '(untitled)'
  const body = normalizeWhitespace(cur.body)
  const archived = entry.archived ? ' [archived]' : ''
  const lines = [
    `### ${kind}${archived}: ${title}`,
    `id: ${entry.id}`,
    `version: ${cur.version} / ${entry.versions.length}`,
    `updatedAt: ${entry.updatedAt}`,
    '',
    body || '_(empty body)_',
  ]
  return lines.join('\n')
}

/**
 * Echo persisted notebook entries as a labeled excerpt.
 * Never invents content; skips nothing by inventing — empty list is honest.
 */
export function formatPersistedNotebookExcerpt(
  project: Project,
  options?: { includeArchived?: boolean },
): NotebookFormatExcerpt {
  const includeArchived = options?.includeArchived ?? false
  const entries = getNotebookEntries(project).filter((e) =>
    includeArchived ? true : !e.archived,
  )

  if (entries.length === 0) {
    return {
      nonAuthoritative: true,
      banner: BANNER,
      text:
        '(No persisted notebook entries to format. ' +
        'Add notes in Lab notebook & reports first. Nothing was invented.)',
      entryCount: 0,
    }
  }

  const blocks = entries.map(formatOneEntry)
  const header = [
    BANNER,
    '',
    `Project: ${project.name}`,
    `Entries formatted: ${entries.length}`,
    `Generated locally (no model): ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ].join('\n')

  return {
    nonAuthoritative: true,
    banner: BANNER,
    text: header + blocks.join('\n\n---\n\n'),
    entryCount: entries.length,
  }
}
