/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { ipcMain, Menu, webContents } from 'electron'
import type { TabManager } from '../../tab-manager'
import { menuIcons, TAB_MENU_ICON, type TabKind } from '../../menu-icons'
import type { TabsChannels } from '../../../shared/tabs-api'

// tMain is declared in index.ts and passed implicitly via the HomeDeps interface.
// Declare it here so the TabsDeps.tm parameter type resolves.
declare const tMain: (scope: unknown, key: string, params?: Record<string, unknown>) => string

export interface TabsDeps {
  channels: TabsChannels
  tabManager: () => TabManager | undefined
  shellWindow: () => Electron.BrowserWindow | undefined
  newDocTab: () => void
  newSheetTab: () => void | Promise<void>
  newSlideTab: () => void
  newMarkdownTab: () => void
  newHtmlTab: () => void
  newPdfTab: () => void | Promise<void>
  openFileViaDialog: () => void | Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tm: (...args: any[]) => string
}

/**
 * Dismiss all chrome popovers across all renderer windows.
 * Lives here (not in index.ts) so it can be used by both:
 * - index.ts: called on window will-move to dismiss popovers
 * - registerTabsIpc: called on TABS_CHANNELS.chromePressed IPC
 */
export function broadcastChromePressed(exclude?: Electron.WebContents): void {
  for (const wc of webContents.getAllWebContents()) {
    if (wc !== exclude) wc.send('app:chrome-pressed')
  }
}

/**
 * Register tab-management IPC handlers.
 * Split from index.ts as part of P4-IPC.
 */
export function registerTabsIpc(deps: TabsDeps): void {
  const {
    channels,
    tabManager,
    shellWindow,
    newDocTab,
    newSheetTab,
    newSlideTab,
    newMarkdownTab,
    newHtmlTab,
    newPdfTab,
    openFileViaDialog,
    tm,
  } = deps

  ipcMain.on(channels.chromePressed, (event) => broadcastChromePressed(event.sender))
  ipcMain.handle(channels.list, () => tabManager()?.list() ?? [])
  ipcMain.handle(channels.activate, (_event, id: string) => tabManager()?.activateTab(id))
  ipcMain.handle(channels.close, (_event, id: string) => tabManager()?.closeTab(id))
  ipcMain.handle(channels.reorder, (_event, id: string, toIndex: number) => {
    if (typeof id === 'string' && Number.isInteger(toIndex)) tabManager()?.reorderTab(id, toIndex)
  })
  // "all tabs" overflow menu — native popup because the editors' WebContentsView
  // would cover any DOM dropdown the shell renderer draws below the tab strip
  ipcMain.handle(channels.showAppMenu, (_event, x: unknown, y: unknown) => {
    const sw = shellWindow()
    if (!sw) return
    Menu.getApplicationMenu()?.popup({
      window: sw,
      ...(typeof x === 'number' && typeof y === 'number'
        ? { x: Math.round(x), y: Math.round(y) }
        : {}),
    })
  })
  ipcMain.handle(channels.showMenu, (_event, x: unknown, y: unknown) => {
    const tm2 = tabManager()
    const sw = shellWindow()
    if (!tm2 || !sw) return
    const menu = Menu.buildFromTemplate(
      tm2.list().map((tab) => ({
        label: tab.title,
        type: 'checkbox' as const,
        checked: tab.active,
        icon: menuIcons()[TAB_MENU_ICON[tab.kind as TabKind]],
        click: () => tm2.activateTab(tab.id),
      })),
    )
    menu.popup({
      window: sw,
      ...(typeof x === 'number' && typeof y === 'number'
        ? { x: Math.round(x), y: Math.round(y) }
        : {}),
    })
  })
  // "+" new-file menu — native for the same reason as the tab list above
  ipcMain.handle(channels.showNewMenu, (_event, x: unknown, y: unknown) => {
    const tm2 = tabManager()
    const sw = shellWindow()
    if (!tm2 || !sw) return
    const menu = Menu.buildFromTemplate([
      { label: tm('menuSectionNew'), type: 'header', enabled: false },
      {
        label: tm('menuNewDoc'),
        icon: menuIcons().docx,
        click: () => newDocTab(),
      },
      {
        label: tm('menuNewSheet'),
        icon: menuIcons().xlsx,
        click: () => void newSheetTab(),
      },
      {
        label: tm('menuNewSlide'),
        icon: menuIcons().pptx,
        click: () => newSlideTab(),
      },
      {
        label: tm('menuNewMarkdown'),
        icon: menuIcons().md,
        click: () => newMarkdownTab(),
      },
      {
        label: tm('menuNewHtml'),
        icon: menuIcons().html,
        click: () => newHtmlTab(),
      },
      {
        label: tm('menuNewPdf'),
        icon: menuIcons().pdf,
        click: () => void newPdfTab(),
      },
      { type: 'separator' },
      { label: tm('menuOpen'), click: () => void openFileViaDialog() },
    ])
    menu.popup({
      window: sw,
      ...(typeof x === 'number' && typeof y === 'number'
        ? { x: Math.round(x), y: Math.round(y) }
        : {}),
    })
  })
}
