/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Shared types for the file-index module.
 * Defines the shape of indexed documents and search results.
 */

export interface IndexedDocument {
  id: string
  path: string
  name: string
  extension: string
  size: number
  modifiedAt: number
  indexedAt: number
  contentHash: string
  /** plain-text extracted content, tokenized at index time */
  content: string
  /** short excerpt for display in search results */
  excerpt: string
}

export interface SearchResult {
  document: IndexedDocument
  score: number
  highlights: string[]
}

export interface IndexOptions {
  /** directories to scan (recursively) */
  roots: string[]
  /** file extensions to include */
  extensions: string[]
  /** max file size in bytes (skip larger files) */
  maxFileSize?: number
  /** min file size in bytes (skip very small/empty files) */
  minFileSize?: number
}

export interface IndexProgress {
  phase: 'scanning' | 'parsing' | 'indexing' | 'complete' | 'error'
  totalFiles: number
  processedFiles: number
  currentFile?: string
  error?: string
}

export interface SearchOptions {
  /** max results to return */
  limit?: number
  /** minimum score threshold (0-1) */
  minScore?: number
  /** roots to search within (empty = all) */
  roots?: string[]
  /** file extensions to filter (empty = all) */
  extensions?: string[]
  /** sort by: 'relevance' | 'modified' | 'name' */
  sortBy?: 'relevance' | 'modified' | 'name'
}

export interface SearchQuery {
  query: string
  options?: SearchOptions
}
