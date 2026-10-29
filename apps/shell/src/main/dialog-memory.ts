/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Dialog memory: remembers the last-used directory for each dialog kind
 * (open / save / folder-pick) and restores it on the next invocation.
 *
 * Electron ≥ 43 pins file dialogs to Downloads when no `defaultPath` is set.
 * This module restores the pre-43 "remember last directory" behavior per
 * dialog type, using a lightweight JSON store in userData.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type DialogKind = 'open' | 'save' | 'folder'

export interface DialogMemoryStore {
  /** last used directory per dialog kind */
  lastDir: Partial<Record<DialogKind, string>>
  /** last used filter extension per dialog kind */
  lastFilter: Partial<Record<DialogKind, string>>
  version: number
}

const STORE_VERSION = 1

/** Read the dialog memory store */
export function readDialogMemory(storePath: string): DialogMemoryStore {
  if (!existsSync(storePath)) return { lastDir: {}, lastFilter: {}, version: STORE_VERSION }
  try {
    const raw = JSON.parse(readFileSync(storePath, 'utf-8')) as Partial<DialogMemoryStore>
    const lastDir = raw.lastDir && typeof raw.lastDir === 'object' ? raw.lastDir : {}
    const lastFilter = raw.lastFilter && typeof raw.lastFilter === 'object' ? raw.lastFilter : {}
    return {
      lastDir: lastDir as Partial<Record<DialogKind, string>>,
      lastFilter: lastFilter as Partial<Record<DialogKind, string>>,
      version: raw.version ?? STORE_VERSION,
    }
  } catch {
    return { lastDir: {}, lastFilter: {}, version: STORE_VERSION }
  }
}

/** Write the dialog memory store */
export function writeDialogMemory(storePath: string, store: DialogMemoryStore): void {
  writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8')
}

/**
 * Remember a chosen directory after a dialog is confirmed.
 * Call this after a dialog returns `!result.canceled && result.filePaths.length > 0`
 * (or `result.filePath` for save dialogs).
 */
export function rememberDialogDirectory(
  store: DialogMemoryStore,
  kind: DialogKind,
  chosenPath: string,
): DialogMemoryStore {
  const dir = dirname(chosenPath)
  if (!dir || dir === '.') return store
  return {
    ...store,
    lastDir: { ...store.lastDir, [kind]: dir },
    version: store.version + 1,
  }
}

/**
 * Remember a chosen file filter extension after an open dialog.
 */
export function rememberDialogFilter(
  store: DialogMemoryStore,
  kind: DialogKind,
  extension: string,
): DialogMemoryStore {
  return {
    ...store,
    lastFilter: { ...store.lastFilter, [kind]: extension },
    version: store.version + 1,
  }
}

/**
 * Get the remembered directory for a dialog kind.
 * Falls back to `fallbackDir` when nothing is stored.
 */
export function getRememberedDirectory(
  store: DialogMemoryStore,
  kind: DialogKind,
  fallbackDir?: string,
): string | undefined {
  return store.lastDir[kind] ?? fallbackDir
}

/**
 * Get the remembered filter extension for a dialog kind.
 */
export function getRememberedFilter(store: DialogMemoryStore, kind: DialogKind): string | undefined {
  return store.lastFilter[kind]
}

/** Clear the stored directory for a dialog kind */
export function clearDialogMemory(store: DialogMemoryStore, kind: DialogKind): DialogMemoryStore {
  const lastDir = { ...store.lastDir }
  delete lastDir[kind]
  return { ...store, lastDir, version: store.version + 1 }
}

/** Clear all dialog memory */
export function clearAllDialogMemory(storePath: string): void {
  writeFileSync(
    storePath,
    JSON.stringify({ lastDir: {}, lastFilter: {}, version: STORE_VERSION }, null, 2),
    'utf-8',
  )
}

/**
 * Build a `defaultPath` option for a dialog, anchoring a bare file name
 * in the remembered directory.
 *
 * Example:
 *   const path = buildDialogDefaultPath(store, 'open', 'Untitled.docx')
 *   // → '/Users/me/Documents/Untitled.docx' if lastDir['open'] = '/Users/me/Documents'
 */
export function buildDialogDefaultPath(
  store: DialogMemoryStore,
  kind: DialogKind,
  fallbackDir: string,
  fileName?: string,
): string | undefined {
  const dir = getRememberedDirectory(store, kind, fallbackDir)
  if (!dir) return undefined
  if (fileName) return join(dir, fileName)
  return dir
}
