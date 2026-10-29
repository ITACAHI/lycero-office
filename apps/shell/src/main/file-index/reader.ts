/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * File reader utilities for the file-index module.
 * Handles safe sequential reads of files for indexing.
 */
import { readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

import { isIndexableExtension } from './schema'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB cap for indexing

export interface FileReadResult {
  path: string
  content: string
  size: number
  error?: string
}

/** Read files matching criteria from a directory (non-recursive) */
export function listIndexableFiles(
  dir: string,
  extensions: readonly string[],
  maxSize = MAX_FILE_SIZE,
): string[] {
  const files: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const ext = extname(entry.name).toLowerCase().slice(1)
      if (!isIndexableExtension(ext, extensions)) continue
      const path = join(dir, entry.name)
      try {
        const size = statSync(path).size
        if (size > 0 && size <= maxSize) files.push(path)
      } catch { /* skip unreadable */ }
    }
  } catch { /* skip unreadable dirs */ }
  return files
}

/** Recursively list all indexable files under a root */
export function listIndexableFilesRecursive(
  root: string,
  extensions: readonly string[],
  maxSize = MAX_FILE_SIZE,
): string[] {
  const results: string[] = []
  const walk = (dir: string) => {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          // Skip hidden / system directories
          if (!entry.name.startsWith('.') && !entry.name.startsWith('~')) {
            walk(path)
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase().slice(1)
          if (!isIndexableExtension(ext, extensions)) continue
          try {
            const size = statSync(path).size
            if (size > 0 && size <= maxSize) results.push(path)
          } catch { /* skip */ }
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }
  walk(resolve(root))
  return results
}

/** Estimate total size of files to be indexed */
export function estimateIndexSize(files: string[]): { count: number; bytes: number } {
  let bytes = 0
  for (const path of files) {
    try {
      bytes += statSync(path).size
    } catch { /* no-op */ }
  }
  return { count: files.length, bytes }
}
