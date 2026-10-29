/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * IPC handlers for the file-index module (full-text search).
 * Wire: apps/shell/src/main/index.ts → registerFileIndexIpc.
 */
import { ipcMain, app } from 'electron'
import { join } from 'node:path'
import { FileIndexer } from '../../file-index'
import type { SearchResult as IndexedResult } from '../../file-index/types'
import type { SearchResult } from '../../../shared/home-api'

const SEARCH_CHANNEL = 'home:search-files'
const SETTINGS_CHANNEL = 'home:file-search-settings'
const RERANK_CHANNEL = 'home:file-search-rerank'

const FILE_INDEX_STORE = () => join(app.getPath('userData'), 'file-index.json')

/** The shared FileIndexer instance (lazily created) */
let _indexer: FileIndexer | null = null

function getIndexer(): FileIndexer {
  if (!_indexer) {
    _indexer = new FileIndexer({ storePath: FILE_INDEX_STORE() })
  }
  return _indexer
}

/** Map FileIndexer-internal result to the public API shape */
function toPublicResult(r: IndexedResult): SearchResult {
  return {
    path: r.document.path,
    name: r.document.name,
    ext: r.document.extension,
    mtimeMs: r.document.modifiedAt,
    sizeBytes: r.document.size,
    score: r.score,
    snippet: r.highlights[0],
  }
}

export interface FileIndexDeps {
  /** roots to search within (passed to the indexer) */
  searchRoots: () => string[]
}

let _deps: FileIndexDeps | null = null

export function registerFileIndexIpc(deps: FileIndexDeps): void {
  _deps = deps

  ipcMain.handle(SEARCH_CHANNEL, (_event, query: unknown, options: unknown) => {
    const q = typeof query === 'string' ? query : ''
    const opts = options && typeof options === 'object' ? (options as Record<string, unknown>) : {}
    const indexer = getIndexer()
    const roots = _deps?.searchRoots() ?? []

    const results = indexer.search(q, {
      roots: roots.length > 0 ? roots : undefined,
      extensions: Array.isArray(opts.extensions) ? opts.extensions : undefined,
      limit: typeof opts.limit === 'number' ? opts.limit : 20,
      minScore: typeof opts.minScore === 'number' ? opts.minScore : 0.05,
      sortBy: opts.sortBy as 'relevance' | 'modified' | 'name' | undefined,
    })

    return results.map(toPublicResult)
  })

  ipcMain.handle(SETTINGS_CHANNEL, () => {
    const indexer = getIndexer()
    const stats = indexer.stats()
    return {
      enabled: true,
      indexedCount: stats.documentCount,
      indexing: false,
    }
  })

  ipcMain.handle(RERANK_CHANNEL, (_event, results: unknown) => {
    // ponytail: lightweight rerank just re-sorts by recency
    // full LLM rerank would go here but requires AI provider
    if (!Array.isArray(results)) return []
    return (results as SearchResult[]).sort((a, b) => b.mtimeMs - a.mtimeMs)
  })
}
