import type { ImportedDataset } from './dataset'

/** A local analysis project stored in IndexedDB. */
export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  /**
   * Imported datasets for this project.
   * Originals are preserved on each dataset; nothing is silently rewritten.
   */
  datasets: ImportedDataset[]
  /** Optional empty state blob for future analysis data. */
  state?: Record<string, unknown>
}

export type ProjectCreateInput = {
  name: string
}
