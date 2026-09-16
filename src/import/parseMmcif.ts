import type { MmcifSummary, ParseResult } from '../types/dataset'

/**
 * Lightweight mmCIF tokenizer for data block / category discovery.
 * Does not validate against the PDBx dictionary or mutate content.
 */
export function parseMmcif(text: string): ParseResult<MmcifSummary> {
  const warnings: string[] = []
  const dataBlockIds: string[] = []
  const categories = new Set<string>()
  let atomSiteRows: number | undefined
  let entryId: string | undefined
  let inAtomSiteLoop = false
  let atomSiteColCount = 0
  let atomSiteValueCount = 0

  const tokens = tokenizeCif(text)
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]!
    if (t.startsWith('data_')) {
      dataBlockIds.push(t.slice(5) || '(anonymous)')
      inAtomSiteLoop = false
      i += 1
      continue
    }
    if (t === 'loop_') {
      i += 1
      const loopTags: string[] = []
      while (i < tokens.length && tokens[i]!.startsWith('_')) {
        loopTags.push(tokens[i]!)
        i += 1
      }
      const catNames = loopTags.map((tag) => tag.slice(1).split('.')[0] ?? tag)
      for (const c of catNames) categories.add(c)
      const isAtomSite = loopTags.some((tag) => tag.startsWith('_atom_site.'))
      if (isAtomSite) {
        inAtomSiteLoop = true
        atomSiteColCount = loopTags.length
        atomSiteValueCount = 0
      } else {
        inAtomSiteLoop = false
      }
      // consume values until next reserved token
      while (
        i < tokens.length &&
        !tokens[i]!.startsWith('data_') &&
        tokens[i] !== 'loop_' &&
        !tokens[i]!.startsWith('_') &&
        tokens[i] !== 'save_' &&
        !tokens[i]!.startsWith('save_')
      ) {
        if (inAtomSiteLoop) atomSiteValueCount += 1
        i += 1
      }
      if (inAtomSiteLoop && atomSiteColCount > 0) {
        atomSiteRows = Math.floor(atomSiteValueCount / atomSiteColCount)
        if (atomSiteValueCount % atomSiteColCount !== 0) {
          warnings.push(
            `_atom_site loop value count (${atomSiteValueCount}) is not divisible by column count (${atomSiteColCount}).`,
          )
        }
        inAtomSiteLoop = false
      }
      continue
    }
    if (t.startsWith('_')) {
      const cat = t.slice(1).split('.')[0] ?? t
      categories.add(cat)
      if (t === '_entry.id' && i + 1 < tokens.length) {
        entryId = stripQuotes(tokens[i + 1]!)
      }
      i += 2 // tag + value
      continue
    }
    i += 1
  }

  if (dataBlockIds.length === 0) {
    warnings.push('No data_ block found — file may not be mmCIF.')
  }

  return {
    summary: {
      kind: 'mmcif',
      dataBlockIds,
      categoryNames: [...categories].sort().slice(0, 80),
      atomSiteRows,
      entryId,
    },
    warnings,
  }
}

function stripQuotes(v: string): string {
  if (
    (v.startsWith("'") && v.endsWith("'")) ||
    (v.startsWith('"') && v.endsWith('"'))
  ) {
    return v.slice(1, -1)
  }
  return v
}

/** Simple CIF tokenizer: handles comments, quoted strings, and ;text; blocks. */
function tokenizeCif(text: string): string[] {
  const out: string[] = []
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]!
    if (c === '#') {
      while (i < n && text[i] !== '\n') i += 1
      continue
    }
    if (/\s/.test(c)) {
      i += 1
      continue
    }
    if (c === ';') {
      // semicolon-delimited multiline value (must be at line start in strict CIF;
      // we accept it whenever we see it after whitespace for robustness)
      i += 1
      let buf = ''
      while (i < n) {
        if (
          text[i] === ';' &&
          (i === 0 || text[i - 1] === '\n')
        ) {
          i += 1
          break
        }
        buf += text[i]
        i += 1
      }
      out.push(buf.trimEnd())
      continue
    }
    if (c === "'" || c === '"') {
      const q = c
      i += 1
      let buf = ''
      while (i < n && text[i] !== q) {
        buf += text[i]
        i += 1
      }
      if (i < n) i += 1
      out.push(buf)
      continue
    }
    let buf = ''
    while (i < n && !/\s/.test(text[i]!) && text[i] !== '#') {
      buf += text[i]
      i += 1
    }
    if (buf) out.push(buf)
  }
  return out
}
