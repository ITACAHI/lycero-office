/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * IPC handlers for folder roots (multi-root home tree).
 * Wire: apps/shell/src/main/index.ts → registerFolderRootsIpc.
 */
import { ipcMain, app } from 'electron'
import { join } from 'node:path'
import {
  defaultRoots,
  readFolderRoots,
  writeFolderRoots,
  addFolderRoot,
  removeFolderRoot,
  validateNewRoot,
  refreshRoots,
  type FolderRoot as FRoot,
} from '../../folder-roots'

const FOLDER_ROOTS_STORE = () => join(app.getPath('userData'), 'folder-roots.json')

export interface FolderRootsDeps {
  /** userData path for store */
  userData: string
  /** documents dir for defaults */
  documents: string
}

let _store: ReturnType<typeof readFolderRoots> | null = null

function getStore() {
  if (!_store) {
    _store = readFolderRoots(FOLDER_ROOTS_STORE())
  }
  return _store
}

function persist() {
  if (_store) writeFolderRoots(FOLDER_ROOTS_STORE(), _store)
}

export function registerFolderRootsIpc(deps: FolderRootsDeps): void {
  ipcMain.handle('home:folder-roots', () => {
    const refreshed = refreshRoots(getStore().roots)
    return { roots: refreshed, version: getStore().version }
  })

  ipcMain.handle('home:add-folder-root', (_event, path: unknown, alias: unknown) => {
    const p = typeof path === 'string' ? path : ''
    if (!p) return { ok: false, error: 'Đường dẫn không hợp lệ.' }
    const existing = getStore()
    const err = validateNewRoot(p, existing.roots)
    if (err) return { ok: false, error: err }
    _store = addFolderRoot(existing, p, typeof alias === 'string' ? alias : undefined)
    persist()
    return { ok: true, roots: _store.roots, version: _store.version }
  })

  ipcMain.handle('home:drop-folder-roots', (_event) => {
    const defaultRootsList = defaultRoots(deps.userData, deps.documents)
    _store = { roots: defaultRootsList, version: (_store?.version ?? 0) + 1 }
    persist()
    return { ok: true }
  })

  ipcMain.handle('home:remove-folder-root', (_event, path: unknown) => {
    const p = typeof path === 'string' ? path : ''
    if (!p) return
    _store = removeFolderRoot(getStore(), p)
    persist()
  })
}
