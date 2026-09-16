import type { FastaSummary, ParseResult } from '../types/dataset'

/**
 * Minimal FASTA reader. Does not validate biology — only splits headers
 * and sequence lines. Original text is left untouched by the caller.
 */
export function parseFasta(text: string): ParseResult<FastaSummary> {
  const warnings: string[] = []
  const headers: string[] = []
  let sequenceCount = 0
  let totalResidues = 0
  let currentLen = 0
  let inSeq = false

  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) continue
    if (line.startsWith('>')) {
      if (inSeq) {
        totalResidues += currentLen
        currentLen = 0
      }
      sequenceCount += 1
      const header = line.slice(1).trim() || `(unnamed sequence ${sequenceCount})`
      headers.push(header)
      inSeq = true
    } else if (line.startsWith(';')) {
      // legacy comment — ignore for counts
      continue
    } else if (inSeq) {
      const seq = line.replace(/\s+/g, '')
      if (/[^A-Za-z*-]/.test(seq)) {
        warnings.push(
          `Non-standard characters in sequence after ">${headers[headers.length - 1] ?? ''}" (kept as-is in original).`,
        )
      }
      currentLen += seq.length
    } else {
      warnings.push('Text before the first ">" header was ignored in the summary.')
    }
  }
  if (inSeq) totalResidues += currentLen

  if (sequenceCount === 0) {
    warnings.push('No FASTA headers (lines starting with ">") were found.')
  }

  // Deduplicate warning spam
  const unique = [...new Set(warnings)]

  return {
    summary: {
      kind: 'fasta',
      sequenceCount,
      totalResidues,
      headers: headers.slice(0, 50),
    },
    warnings: unique,
  }
}
