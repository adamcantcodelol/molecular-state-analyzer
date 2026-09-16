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
  /**
   * Optional analysis blob (e.g. hmmRuns, smfretHmmRuns, conditions,
   * hypotheses, multimodalLinks). Never a substitute for dataset originals.
   * HMM outputs, smFRET HMM runs, condition metadata, user hypotheses, and
   * multimodal link bundles are stored here separately from imported
   * originalText.
   */
  state?: Record<string, unknown>
}

export type ProjectCreateInput = {
  name: string
}
