/**
 * Copy-only prompt templates. The app never sends these to a model.
 * Users may paste them into their own external tools if they choose.
 */
import type { AiPromptTemplate } from '../types/ai'

export const PROMPT_TEMPLATES: AiPromptTemplate[] = [
  {
    id: 'summarize-notes-externally',
    title: 'Summarize my notebook notes (external tool)',
    description:
      'Ask an external assistant to organize your own notes without inventing data. Paste your notes after the prompt.',
    prompt: [
      'You are helping me organize lab notebook text I already wrote.',
      'Rules:',
      '- Do NOT invent measurements, p-values, structures, or HMM results.',
      '- Keep Observations, Inferences, and User hypotheses in separate sections.',
      '- Label your entire reply as non-authoritative drafting help.',
      '- If something is missing from my notes, say what is missing — do not fill gaps with guesses.',
      '',
      'My notebook text follows:',
      '',
      '[PASTE YOUR NOTEBOOK TEXT HERE]',
    ].join('\n'),
  },
  {
    id: 'draft-methods-outline',
    title: 'Draft a methods outline from my plan (external tool)',
    description:
      'Use with your own experimental-design draft text. Reminds the tool that plans are suggestions only.',
    prompt: [
      'Turn the following experimental-design draft into a plain-language methods outline.',
      'Rules:',
      '- Treat the draft as a suggestion only — not a prescription or power analysis.',
      '- Do NOT claim statistical power, significance, or required sample sizes.',
      '- Do NOT invent reagents, instruments, or results that are not in the draft.',
      '- Label the outline as non-authoritative drafting help.',
      '',
      'Draft plan text:',
      '',
      '[PASTE YOUR PLAN / GOAL TEXT HERE]',
    ].join('\n'),
  },
  {
    id: 'separate-epistemic-kinds',
    title: 'Check epistemic separation (external tool)',
    description:
      'Ask an external tool to flag where Observations / Inferences / hypotheses may be conflated in your writing.',
    prompt: [
      'Review the text below for epistemic conflation.',
      'Flag places where Observations, Inferences, and User hypotheses appear mixed.',
      'Do NOT rewrite the science or invent corrections to data.',
      'Suggest clearer section labels only. Mark your reply as non-authoritative.',
      '',
      '[PASTE YOUR TEXT HERE]',
    ].join('\n'),
  },
  {
    id: 'provenance-checklist',
    title: 'Provenance checklist (external tool)',
    description:
      'A checklist prompt for run provenance (dataset, settings, seed) — no fabricated metrics.',
    prompt: [
      'Given the analysis provenance notes I paste, produce a checklist of what is documented',
      '(dataset name, settings, seed, timestamps, module) and what is missing.',
      'Do NOT invent LL, AIC/BIC, bootstrap, or E_FRET values.',
      'Do NOT interpret latent states as biophysical names.',
      'Label the checklist as non-authoritative.',
      '',
      '[PASTE PROVENANCE / RUN NOTES HERE]',
    ].join('\n'),
  },
]
