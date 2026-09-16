/**
 * Phase 15 — optional AI research assistant (free / stub only).
 * Completely separate from HMM, stats, smFRET, and other scientific engines.
 * Never invents results, never overwrites analyses, never calls paid APIs.
 */

/** Status of generative AI in this build ($0 / free-offline constraint). */
export type AiAssistStatus =
  | 'unavailable_no_local_model'
  | 'local_helpers_only'

export const AI_ASSIST_STATUS: AiAssistStatus = 'unavailable_no_local_model'

export const AI_UI_LABEL = 'Optional · non-authoritative'

export const AI_DISCLAIMER =
  'Optional AI assistant — separate from HMM / statistics / smFRET engines. ' +
  'No paid cloud LLM is bundled (OpenAI, Anthropic, etc.). ' +
  'Any AI or helper text shown here is non-authoritative, must never be treated ' +
  'as scientific results, and never auto-writes into analyses or project.state ' +
  'engine outputs.'

export const AI_UNAVAILABLE_MESSAGE =
  'Unavailable — no free local model configured. This build does not call paid ' +
  'cloud APIs and does not invent model completions.'

/** A copy-only prompt template for the user to paste into their own tools. */
export type AiPromptTemplate = {
  id: string
  title: string
  /** Short description of what the user might ask an external tool. */
  description: string
  /** Full prompt text — user copies; app never sends it to a model. */
  prompt: string
}

/**
 * Result of a local, non-model helper that only reformats already-persisted
 * notebook text. Never invents scientific claims.
 */
export type NotebookFormatExcerpt = {
  /** Always true — label for UI. */
  nonAuthoritative: true
  /** Explicit banner the UI must show. */
  banner: string
  /** Reformatted echo of persisted notebook text only. */
  text: string
  entryCount: number
}
