/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * IPC handlers for default app associations.
 * Wire: apps/shell/src/main/index.ts → registerDefaultAppIpc.
 */
import { ipcMain, app } from 'electron'
import { join } from 'node:path'
import {
  readDefaultAppConfig,
  writeDefaultAppConfig,
  getDefaultAppKind,
  setDefaultAppKind,
} from '../../default-app'

const DEFAULT_APP_STORE = () => join(app.getPath('userData'), 'default-app.json')

let _overrides: Record<string, string> | null = null

function getOverrides(): Record<string, string> {
  if (!_overrides) _overrides = readDefaultAppConfig(DEFAULT_APP_STORE())
  return _overrides
}

function persist() {
  if (_overrides) writeDefaultAppConfig(DEFAULT_APP_STORE(), _overrides)
}

export function registerDefaultAppIpc(): void {
  ipcMain.handle('home:default-app-status', () => ({
    overrides: getOverrides(),
    supportedApps: ['docs', 'sheets', 'slides', 'pdf', 'markdown', 'html'],
  }))

  ipcMain.handle('home:set-default-app', (_event, ext: unknown, appKind: unknown) => {
    const extension = typeof ext === 'string' ? ext : ''
    const kind = typeof appKind === 'string' ? appKind : null
    if (!extension) return { ok: false, error: 'Extension is required.' }
    _overrides = setDefaultAppKind(getOverrides(), extension, kind)
    persist()
    return { ok: true }
  })
}
