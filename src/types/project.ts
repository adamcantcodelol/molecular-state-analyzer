/** A local analysis project stored in IndexedDB. */
export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  /** Optional empty state blob for future analysis data. */
  state?: Record<string, unknown>
}

export type ProjectCreateInput = {
  name: string
}
