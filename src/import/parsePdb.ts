import type { ParseResult, PdbSummary } from '../types/dataset'

/**
 * Structural PDB scan only — counts records and chains from fixed columns.
 * Does not interpret chemistry or rewrite coordinates.
 */
export function parsePdb(text: string): ParseResult<PdbSummary> {
  const warnings: string[] = []
  let atomCount = 0
  let hetatmCount = 0
  let modelCount = 0
  const chains = new Set<string>()
  let titleParts: string[] = []
  let sawEnd = false

  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    if (!raw) continue
    const rec = raw.length >= 6 ? raw.slice(0, 6).trimEnd() : raw.trim()
    switch (rec) {
      case 'ATOM':
        atomCount += 1
        if (raw.length >= 22) {
          const chain = raw[21]?.trim()
          if (chain) chains.add(chain)
        }
        break
      case 'HETATM':
        hetatmCount += 1
        if (raw.length >= 22) {
          const chain = raw[21]?.trim()
          if (chain) chains.add(chain)
        }
        break
      case 'MODEL':
        modelCount += 1
        break
      case 'TITLE':
        titleParts.push(raw.slice(10).trim())
        break
      case 'END':
        sawEnd = true
        break
      default:
        break
    }
  }

  if (atomCount + hetatmCount === 0) {
    warnings.push('No ATOM/HETATM records found — file may be empty or not PDB.')
  }
  if (modelCount === 0 && atomCount + hetatmCount > 0) {
    modelCount = 1
  }
  if (!sawEnd && (atomCount > 0 || hetatmCount > 0)) {
    warnings.push('No END record found (common in some exports; original kept as-is).')
  }

  const title = titleParts.join(' ').replace(/\s+/g, ' ').trim() || undefined

  return {
    summary: {
      kind: 'pdb',
      atomCount,
      hetatmCount,
      modelCount,
      chainIds: [...chains].sort(),
      title,
    },
    warnings,
  }
}
