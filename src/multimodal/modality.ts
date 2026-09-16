import type { ImportedDataset } from '../types/dataset'
import type { ModalityKind } from '../types/multimodal'
import { MODALITY_LABELS } from '../types/multimodal'
import { roleColumns } from '../data/tabular'

/**
 * Infer a display modality from an imported dataset.
 * Used for honest labels in multimodal comparison — not scientific claims.
 */
export function inferDatasetModality(ds: ImportedDataset): ModalityKind {
  if (ds.format === 'pdb' || ds.format === 'mmcif') return 'structure'
  if (ds.format === 'fasta') return 'sequence'
  if (ds.format === 'csv' || ds.format === 'json') {
    const timeCols = roleColumns(ds.columnMapping, 'time')
    const valueCols = roleColumns(ds.columnMapping, 'value')
    if (timeCols.length > 0 && valueCols.length > 0) return 'time_series'
    return 'tabular'
  }
  return 'other'
}

export function modalityLabel(kind: ModalityKind): string {
  return MODALITY_LABELS[kind]
}

/** Short format + modality tag for list rows. */
export function datasetModalityTag(ds: ImportedDataset): string {
  const m = inferDatasetModality(ds)
  return `${ds.format.toUpperCase()} · ${modalityLabel(m)}`
}
