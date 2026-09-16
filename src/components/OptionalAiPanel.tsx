import { useMemo, useState } from 'react'
import { formatPersistedNotebookExcerpt } from '../ai/localHelpers'
import { PROMPT_TEMPLATES } from '../ai/templates'
import {
  AI_DISCLAIMER,
  AI_UI_LABEL,
  AI_UNAVAILABLE_MESSAGE,
  type AiPromptTemplate,
} from '../types/ai'
import type { Project } from '../types/project'

type Props = {
  /** Read-only for notebook echo; this panel never mutates project.state engines. */
  project: Project
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function OptionalAiPanel({ project }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [excerptStatus, setExcerptStatus] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(
    PROMPT_TEMPLATES[0]?.id ?? null,
  )

  const excerpt = useMemo(
    () => formatPersistedNotebookExcerpt(project, { includeArchived }),
    [project, includeArchived],
  )

  async function handleCopyTemplate(t: AiPromptTemplate) {
    const ok = await copyText(t.prompt)
    setCopiedId(t.id)
    setExcerptStatus(
      ok
        ? `Copied template “${t.title}” to clipboard (for your own external tools — not sent anywhere by this app).`
        : 'Clipboard unavailable — select the template text and copy manually.',
    )
  }

  async function handleCopyExcerpt() {
    const ok = await copyText(excerpt.text)
    setCopiedId('notebook-excerpt')
    setExcerptStatus(
      ok
        ? `Copied non-authoritative notebook excerpt (${excerpt.entryCount} entr${excerpt.entryCount === 1 ? 'y' : 'ies'}).`
        : 'Clipboard unavailable — select the excerpt and copy manually.',
    )
  }

  return (
    <section
      className="panel optional-ai-panel"
      aria-labelledby="optional-ai-heading"
    >
      <div className="panel-head">
        <h2 id="optional-ai-heading" className="panel-title">
          Optional AI assistant
        </h2>
        <span className="pill pill-ai" title={AI_DISCLAIMER}>
          {AI_UI_LABEL}
        </span>
      </div>

      <div className="warn-box ai-disclaimer" role="note">
        <strong>Optional · separate from science engines.</strong> {AI_DISCLAIMER}{' '}
        This panel never overwrites HMM / stats / smFRET / notebook analyses and
        never mutates <code>originalText</code>.
      </div>

      <div className="ai-unavailable" role="status">
        <p className="ai-unavailable-title">Generative model</p>
        <p>
          <strong>{AI_UNAVAILABLE_MESSAGE}</strong>
        </p>
        <p className="muted small">
          Honest stub: we do not fabricate model responses, do not call paid
          APIs, and do not bundle a cloud LLM. If you later configure a free
          local model yourself outside this app, keep its output labeled
          non-authoritative and never paste invented results into analyses.
        </p>
      </div>

      <h3 className="subheading">Safe local helpers (no model)</h3>
      <p className="muted small">
        These helpers stay on-device. They do not call a network, do not invent
        scientific claims, and do not write into engine outputs under{' '}
        <code>project.state</code>.
      </p>

      <div className="ai-helper-block">
        <h4 className="planner-section-title">1. Copy-only prompt templates</h4>
        <p className="muted small">
          Copy a template, then paste it into <em>your own</em> external tool if
          you choose. Molecular State Analyzer does not send these prompts
          anywhere.
        </p>
        <ul className="ai-template-list">
          {PROMPT_TEMPLATES.map((t) => {
            const open = expandedId === t.id
            return (
              <li key={t.id} className="ai-template-card">
                <div className="ai-template-head">
                  <strong>{t.title}</strong>
                  <div className="row actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setExpandedId(open ? null : t.id)
                      }
                    >
                      {open ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void handleCopyTemplate(t)}
                    >
                      {copiedId === t.id ? 'Copied' : 'Copy prompt'}
                    </button>
                  </div>
                </div>
                <p className="muted small">{t.description}</p>
                {open && (
                  <pre className="ai-template-body" tabIndex={0}>
                    {t.prompt}
                  </pre>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="ai-helper-block">
        <h4 className="planner-section-title">
          2. Format already-persisted notebook text
        </h4>
        <p className="muted small">
          Echoes notebook entries already stored in this project with epistemic
          labels. Whitespace is normalized only — no paraphrasing, no new
          claims, no model.
        </p>
        <label className="row check-row">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          <span className="small">Include archived entries</span>
        </label>
        <div className="ai-excerpt-banner" role="note">
          {excerpt.banner}
        </div>
        <pre className="ai-excerpt-body" tabIndex={0}>
          {excerpt.text}
        </pre>
        <div className="row actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleCopyExcerpt()}
          >
            {copiedId === 'notebook-excerpt'
              ? 'Copied excerpt'
              : 'Copy excerpt'}
          </button>
          <span className="muted small">
            {excerpt.entryCount} entr
            {excerpt.entryCount === 1 ? 'y' : 'ies'} · local only
          </span>
        </div>
      </div>

      {excerptStatus && (
        <p className="muted small" role="status">
          {excerptStatus}
        </p>
      )}
    </section>
  )
}
