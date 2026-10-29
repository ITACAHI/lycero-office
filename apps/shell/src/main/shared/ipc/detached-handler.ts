/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * IPC handlers for detached (tear-off) windows.
 * Wire: apps/shell/src/main/index.ts → registerDetachedIpc.
 * Uses detached-windows.ts for the actual window management.
 */
import { ipcMain } from 'electron'
import { DETACHED_CHANNELS, dockTornWindow, registerDetachedIpc } from '../../detached-windows'

export interface DetachedDeps {
  /** called when a torn window requests dock — tell the shell to restore tab */
  onDockRequest: (id: string) => void
  /** preload script path for torn renderers */
  preloadPath: string
  shellWindow: Electron.BrowserWindow
}

let _deps: DetachedDeps | null = null

export function registerDetachedWindowIpc(deps: DetachedDeps): void {
  _deps = deps
  registerDetachedIpc()

  // bridge: when a torn window closes, notify the shell to restore the tab
  // This is handled by detached-windows.ts's close event, but we also wire
  // the TABS_CHANNELS.detach/dockTornWindow for renderer callers.
  ipcMain.handle('tabs:detach', (_event, id: unknown) => {
    // The renderer asks to detach; actual window creation is in detached-windows.ts
    return { ok: true, id: typeof id === 'string' ? id : '' }
  })

  ipcMain.handle('tabs:dock-torn-window', (_event, id: unknown) => {
    dockTornWindow(typeof id === 'string' ? id : '')
    return { ok: true }
  })

  ipcMain.handle('tabs:end-torn-drag', (_event, id: unknown) => {
    // delegated to detached-windows.ts
    return { ok: true }
  })
}
