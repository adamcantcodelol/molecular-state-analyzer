/**
 * Phase 17 — sanitize user-facing exports / privacy helpers.
 * Science data stays in IndexedDB; exports must not leak originalText.
 */

const SENSITIVE_KEY = /^(originalText|password|token|api[_-]?key|secret|authorization|cookie)$/i

export function stripSensitiveKeys<T>(value: T): T {
  return walk(value) as T
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(walk)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) continue
      out[k] = walk(v)
    }
    return out
  }
  return value
}

/** True if a stringified export appears to contain raw originalText payloads. */
export function exportLooksSafe(serialized: string): boolean {
  // Heuristic: refuse if a JSON key "originalText" appears with a long string value
  if (/"originalText"\s*:\s*"[^"]{200,}"/.test(serialized)) return false
  if (/"originalText"\s*:\s*'[^']{200,}'/.test(serialized)) return false
  return true
}

export const PRIVACY_FINDINGS = {
  localFirst:
    'Projects, datasets, HMM/smFRET runs, notebook, and plans persist in browser IndexedDB only.',
  scienceNetwork:
    'Gaussian HMM / compare / bootstrap / import / QC / plots do not call remote science APIs.',
  mayLeaveBrowser: [
    'User-initiated file downloads (CSV/JSON exports, reports, synthetic downloads).',
    'Optional Mol* 3D display may use WebGL locally; analysis does not require network.',
  ],
  notIncludedInReports: ['dataset.originalText', 'secrets/tokens (stripped if present)'],
} as const
