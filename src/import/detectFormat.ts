import type { DataFormat } from '../types/dataset'

const EXT_MAP: Record<string, DataFormat> = {
  fasta: 'fasta',
  fa: 'fasta',
  fna: 'fasta',
  faa: 'fasta',
  pdb: 'pdb',
  ent: 'pdb',
  cif: 'mmcif',
  mmcif: 'mmcif',
  csv: 'csv',
  tsv: 'csv',
  json: 'json',
}

export function extensionOf(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName
  const i = base.lastIndexOf('.')
  if (i <= 0) return ''
  return base.slice(i + 1).toLowerCase()
}

/** Prefer file extension; fall back to light content sniffing. */
export function detectFormat(fileName: string, text: string): DataFormat | null {
  const ext = extensionOf(fileName)
  if (ext && EXT_MAP[ext]) return EXT_MAP[ext]

  const trimmed = text.trimStart()
  if (!trimmed) return null

  if (trimmed.startsWith('>')) return 'fasta'
  if (trimmed.startsWith('data_') || trimmed.startsWith('#')) {
    // mmCIF often starts with data_XXX or comment lines
    if (/\b_atom_site\./.test(text) || /^data_/m.test(text)) return 'mmcif'
  }
  if (/^(HEADER|TITLE|ATOM\s|HETATM|MODEL\s)/m.test(trimmed.slice(0, 4000))) {
    return 'pdb'
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      /* not JSON */
    }
  }
  // Heuristic: look like delimited rows
  const firstLines = trimmed.split(/\r?\n/).slice(0, 3)
  if (firstLines.some((l) => l.includes(',') || l.includes('\t'))) {
    return 'csv'
  }
  return null
}

export function acceptAttribute(): string {
  return [
    '.fasta',
    '.fa',
    '.fna',
    '.faa',
    '.pdb',
    '.ent',
    '.cif',
    '.mmcif',
    '.csv',
    '.tsv',
    '.json',
    'text/csv',
    'application/json',
    'chemical/x-pdb',
  ].join(',')
}
