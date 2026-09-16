import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, ProjectCreateInput } from '../types/project'

interface MolecularStateDB extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { 'by-updatedAt': string }
  }
}

const DB_NAME = 'molecular-state-analyzer'
const DB_VERSION = 1
const STORE = 'projects'

let dbPromise: Promise<IDBPDatabase<MolecularStateDB>> | null = null

function getDb(): Promise<IDBPDatabase<MolecularStateDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MolecularStateDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('by-updatedAt', 'updatedAt')
      },
    })
  }
  return dbPromise
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Normalize Phase 1 projects that lack `datasets`. */
function normalize(project: Project): Project {
  return {
    ...project,
    datasets: Array.isArray(project.datasets) ? project.datasets : [],
  }
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb()
  const all = await db.getAll(STORE)
  return all
    .map(normalize)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDb()
  const project = await db.get(STORE, id)
  return project ? normalize(project) : undefined
}

export async function createProject(input: ProjectCreateInput): Promise<Project> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Project name is required')
  }

  const now = new Date().toISOString()
  const project: Project = {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    datasets: [],
    state: {},
  }

  const db = await getDb()
  await db.put(STORE, project)
  return project
}

export async function saveProject(project: Project): Promise<Project> {
  const updated: Project = normalize({
    ...project,
    updatedAt: new Date().toISOString(),
  })
  const db = await getDb()
  await db.put(STORE, updated)
  return updated
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}
