/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Persistent storage for the file-index module.
 * Stores indexed document metadata in a simple JSON file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { IndexedDocument } from './types'

export interface IndexStore {
  documents: IndexedDocument[]
  version: number
  updatedAt: number
}

const STORE_VERSION = 1

/** Read the index store from disk */
export function readIndexStore(storePath: string): IndexStore {
  if (!existsSync(storePath)) {
    return { documents: [], version: STORE_VERSION, updatedAt: 0 }
  }
  try {
    const raw = readFileSync(storePath, 'utf-8')
    const store = JSON.parse(raw) as IndexStore
    if (!Array.isArray(store.documents)) return { documents: [], version: STORE_VERSION, updatedAt: 0 }
    return store
  } catch {
    return { documents: [], version: STORE_VERSION, updatedAt: 0 }
  }
}

/** Write the index store to disk atomically */
export function writeIndexStore(storePath: string, documents: IndexedDocument[]): void {
  if (storePath) {
    const dir = dirname(storePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
  const store: IndexStore = {
    documents,
    version: STORE_VERSION,
    updatedAt: Date.now(),
  }
  // ponytail: sync write — index metadata is non-critical; rebuild recovers from loss
  writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8')
}

/** Remove a document from the store by path */
export function removeFromStore(store: IndexStore, path: string): IndexStore {
  return {
    ...store,
    documents: store.documents.filter((d) => d.path !== path),
    updatedAt: Date.now(),
  }
}

/** Update or insert a document in the store */
export function upsertInStore(store: IndexStore, document: IndexedDocument): IndexStore {
  const existing = store.documents.findIndex((d) => d.path === document.path)
  const documents =
    existing >= 0
      ? store.documents.map((d, i) => (i === existing ? document : d))
      : [...store.documents, document]
  return { ...store, documents, updatedAt: Date.now() }
}

/** Prune documents whose paths no longer exist */
export function pruneMissingFromStore(
  store: IndexStore,
  existingPaths: Set<string>,
): IndexStore {
  const documents = store.documents.filter((d) => existingPaths.has(d.path))
  return { ...store, documents, updatedAt: Date.now() }
}

/** Get documents filtered by roots and extensions */
export function filterDocuments(
  store: IndexStore,
  roots: string[],
  extensions: string[],
): IndexedDocument[] {
  return store.documents.filter((doc) => {
    const inRoot = roots.length === 0 || roots.some((r) => doc.path.startsWith(r))
    const byExt = extensions.length === 0 || extensions.includes(doc.extension)
    return inRoot && byExt
  })
}
