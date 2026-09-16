import type { DataFormat, DatasetSummary, ParseResult } from '../types/dataset'
import { detectFormat } from './detectFormat'
import { parseCsv } from './parseCsv'
import { parseFasta } from './parseFasta'
import { parseJson } from './parseJson'
import { parseMmcif } from './parseMmcif'
import { parsePdb } from './parsePdb'

export type ParsedImport = {
  format: DataFormat
  parse: ParseResult<DatasetSummary>
}

export function parseByFormat(
  format: DataFormat,
  text: string,
): ParseResult<DatasetSummary> {
  switch (format) {
    case 'fasta':
      return parseFasta(text)
    case 'pdb':
      return parsePdb(text)
    case 'mmcif':
      return parseMmcif(text)
    case 'csv':
      return parseCsv(text)
    case 'json':
      return parseJson(text)
  }
}

export function parseImportFile(
  fileName: string,
  text: string,
  formatOverride?: DataFormat,
): ParsedImport | { error: string } {
  const format = formatOverride ?? detectFormat(fileName, text)
  if (!format) {
    return {
      error:
        'Could not detect format. Use a known extension (.fasta, .pdb, .cif, .csv, .json) or pick the format manually.',
    }
  }
  return { format, parse: parseByFormat(format, text) }
}

export function needsColumnMapping(format: DataFormat): boolean {
  return format === 'csv' || format === 'json'
}
