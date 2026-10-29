/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * File schema / metadata extraction for the file-index module.
 * Normalizes raw file stats into IndexedDocument shape.
 */
import { readFileSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { createHash } from 'node:crypto'

import type { IndexedDocument } from './types'

const MAX_METADATA_SIZE = 64 * 1024 // 64 KB for metadata-only read

export interface FileSchema {
  path: string
  size: number
  modifiedAt: number
  extension: string
  name: string
  contentHash: string
}

/** Extract schema from a file path without reading full content */
export function extractSchema(filePath: string): FileSchema | null {
  let stats: import('node:fs').Stats
  try {
    stats = statSync(filePath)
  } catch {
    return null
  }
  if (!stats.isFile()) return null

  const size = stats.size
  const contentHash = hashFile(filePath, Math.min(size, MAX_METADATA_SIZE))
  const name = basename(filePath)
  const ext = extname(name).toLowerCase().slice(1)

  return {
    path: filePath,
    size,
    modifiedAt: stats.mtimeMs,
    extension: ext,
    name,
    contentHash,
  }
}

/** Fast hash — reads up to `maxBytes` from file start */
export function hashFile(filePath: string, maxBytes: number): string {
  try {
    const fd = readFileSync(filePath)
    const slice = fd.buffer.slice(fd.byteOffset, fd.byteOffset + maxBytes)
    return createHash('sha256').update(Buffer.from(slice)).digest('hex').slice(0, 16)
  } catch {
    return 'unknown'
  }
}

/** Build an IndexedDocument from a file schema + parsed content */
export function buildDocument(
  schema: FileSchema,
  content: string,
  indexedAt: number,
): IndexedDocument {
  return {
    id: schema.contentHash,
    path: schema.path,
    name: schema.name,
    extension: schema.extension,
    size: schema.size,
    modifiedAt: schema.modifiedAt,
    indexedAt,
    contentHash: schema.contentHash,
    content: content.toLowerCase(),
    excerpt: extractExcerpt(content),
  }
}

/** Short excerpt from content (first ~200 chars) */
export function extractExcerpt(content: string, maxLen = 200): string {
  const cleaned = content.replace(/\s+/g, ' ').trim()
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '…' : cleaned
}

/** Check if file extension is supported for indexing */
export function isIndexableExtension(ext: string, allowed: readonly string[]): boolean {
  const lower = ext.toLowerCase()
  return allowed.length === 0 || allowed.includes(lower)
}
