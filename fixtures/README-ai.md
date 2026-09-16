# Phase 15 — Optional AI assistant (free / stub, non-authoritative)

Optional drafting aid that stays **completely separate** from HMM, statistics,
smFRET, and other scientific engines. **$0 only** — no paid cloud LLM is
bundled. The app never invents scientific results, never fabricates model
completions, and never auto-writes into analyses.

## What it does / does not do

- **Does:** show a clear Optional AI assistant panel; state that generative AI
  is unavailable when no free local model is configured; offer **copy-only**
  prompt templates for the user to paste into *their own* external tools;
  offer a **local** formatter that echoes already-persisted notebook text
  with epistemic labels (whitespace normalize only).
- **Does not:** call OpenAI / Anthropic / other paid APIs; invent LLM
  responses; overwrite HMM / stats / smFRET / notebook engine outputs;
  mutate `originalText`; promote helper text to evidence or scientific
  conclusions.

## Honest labeling

| Surface | Label |
|---------|--------|
| Panel pill | Optional · non-authoritative |
| Generative model | Unavailable — no free local model configured |
| Prompt templates | Copy-only; not sent by this app |
| Notebook excerpt | Non-authoritative formatting of already-persisted text |

Disclaimer (also in UI):

> Optional AI assistant — separate from HMM / statistics / smFRET engines.
> No paid cloud LLM is bundled. Any AI or helper text is non-authoritative,
> must never be treated as scientific results, and never auto-writes into
> analyses.

## Persistence

This phase does **not** add a new `project.state` engine key for AI outputs.
Helpers are ephemeral UI (clipboard / display). Notebook text they format
comes from existing `project.state.notebookEntries` (Phase 14).

## How to test

1. `npm install && npm run build && npm run dev`
2. Create or open a project. Optionally add a lab notebook entry.
3. Open **Optional AI assistant** on the dashboard (below Lab notebook).
4. Confirm the **Optional · non-authoritative** pill and warn-box disclaimer.
5. Confirm the generative-model status reads **Unavailable — no free local
   model configured** (no fake completions).
6. Expand a prompt template → **Copy prompt**. Paste elsewhere — the app
   must not have sent the prompt to a network model.
7. With at least one notebook entry, use **Format already-persisted notebook
   text** → confirm excerpt shows the entry body with Observation/Inference/
   Note labels and the non-authoritative banner. **Copy excerpt**.
8. Confirm HMM / stats / notebook panels are unchanged; `originalText` and
   engine keys under `project.state` are not rewritten by this panel.

## Build

```bash
npm run build
```

## Limitations

- No in-app local LLM runtime is shipped in this phase.
- Templates are static strings for external use only.
- Notebook formatting is an echo / normalize — not paraphrase or analysis.
- Prefer **Archive** over permanent delete in the notebook UX (Phase 14 P3).
