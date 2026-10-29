/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { ipcMain, shell, dialog, app, BrowserWindow, webContents, nativeTheme } from 'electron'
import { getSession } from '../../lycero-auth-bridge'
import { spawn } from 'node:child_process'
import { existsSync, statSync, renameSync, copyFileSync, rmSync } from 'node:fs'
import { join, dirname, basename, extname, resolve } from 'node:path'

import {
  isValidRawRenameName,
  isSameFile,
} from '../../rename-validation'
import {
  gskLoginInfo,
  loadLyceroAuth,
} from '@lycero/ai-auth/main'
import {
  showOpenDialogWithMemory,
  isUsableSaveDir,
} from '@lycero/electron-utils'
import {
  matchesExtFamily,
  normalizeRecentQuery,
  pageRecentPaths,
  statPathEntries,
  OPEN_DIALOG_EXTENSIONS,
} from '../../recent-files'
import {
  defaultSaveDir,
  projectFileRenamed,
  isInsideRoot,
  collectTreeFiles,
  createFolder,
  renameFolder,
  movePathsInto,
  rebasePath,
} from '../../recent-files'
import {
  readRecentFiles,
  readStarredFiles,
  removeRecentFiles,
  removeStarredFiles,
  toggleStarredFile,
  recordRecentFile,
} from '../../recent-files'
import {
  applyMcpSettings,
  clearMcpLogs,
  getMcpRecentLogs,
  mcpLogFilePath,
  mcpStatus,
  revealMcpLogFile,
  type McpSettings,
} from '../../mcp/app-mcp'
import {
  clearCloudProjectsStore,
  cloudProjectExternalUrl,
  readCloudProjectsStore,
  syncCloudProjects,
} from '../../cloud-projects'
import {
} from '../../star-prompt'
import { createDocsControl } from '../../mcp/docs-bridge'
import {
  listFolder,
  describeRoot,
  type FolderErrors,
} from '../../folder-tree'
import { showErrorDialog } from '../../error-dialog'
import {
  normalizeAiPanelPrefs,
  sameAiPanelPrefs,
  type AiPanelPrefs,
} from '@lycero/ui/ai-panel-prefs'
import type { tMain } from '../i18n'
import type {
  AccountLoginEvent,
  AccountStatus,
  AutoSaveDefault,
  FolderListing,
  FolderRoot,
  MoveConflictPolicy,
  MoveResult,
  NewFileOpts,
  RecentEntry,
  RecentPage,
  RenameResult,
  StarPromptShow,
  UiTheme,
} from '../../../shared/home-api'
import { HOME_CHANNELS } from '../../../shared/home-api'
import { isLang, normalizeLang, setUiLang, type Lang } from '@lycero/i18n'
import { isUpdateChannel, type UpdateChannel } from '../../../shared/update-api'

function stringPaths(paths: unknown): string[] {
  if (Array.isArray(paths)) return paths.filter((p): p is string => typeof p === 'string')
  return typeof paths === 'string' ? [paths] : []
}

function statEntries(paths: string[]): RecentEntry[] {
  return statPathEntries(paths, new Set(readStarredFiles()))
}

export interface HomeDeps {
  channels: typeof HOME_CHANNELS
  // Electron app state
  shellWindow: () => Electron.BrowserWindow | null
  // Auth & login
  proxyBootstrap: Promise<void>
  analytics: { active: boolean; track: (name: string, params?: Record<string, string | number>) => void }
  // Settings (get/set current value)
  currentLang: () => Lang
  currentTheme: () => UiTheme
  currentUpdateChannel: () => UpdateChannel
  currentAutoSaveDefault: () => AutoSaveDefault
  currentMcpSettings: () => McpSettings
  currentAiPanelPrefs: () => AiPanelPrefs
  analyticsEnabled: () => boolean
  // Settings (write)
  setUiLang: (lang: Lang) => void
  persistLang: (lang: Lang) => void
  writeAppSetting: (path: string, key: string, value: unknown) => void
  writeAppSettings: (path: string, settings: Record<string, unknown>) => void
  readAppSettings: (path: string) => Record<string, unknown>
  applyUpdateChannel: (channel: UpdateChannel) => void
  // App shell callbacks
  buildHomeMenu: () => void
  installDockMenu: () => void
  installBackToHomeItems: () => void
  refreshTitleBarOverlay: () => void
  // File operations
  openDocumentPath: (path: string) => void
  afterFileMoved: (oldPath: string, newPath: string) => void
  afterFolderMoved: (oldDir: string, newDir: string, filesBefore: readonly string[]) => void
  ensureFolderWatcher: () => void
  rememberPendingDir: (kind: string, opts?: NewFileOpts) => void
  // Tab factories
  newDocTab: () => void
  newSheetTab: () => void | Promise<void>
  newSlideTab: () => void
  newMarkdownTab: () => void
  newHtmlTab: () => void
  newPdfTab: () => void | Promise<void>
  // i18n
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tm: (...args: any[]) => string
  isLang: (v: unknown) => v is Lang
  isUpdateChannel: (v: unknown) => v is UpdateChannel
  // Star prompt

  upgradeStarPromptPendingRef: { current: boolean }
  readStarPrompt: () => { docOpens?: number; shownAt?: number; resolvedAt?: number }
  writeStarPrompt: (state: ReturnType<HomeDeps['readStarPrompt']>) => void
  // Analytics
  persistAnalyticsPreference: (enabled: boolean) => boolean
  // URLs
  GENTEAM_URL: string
  CREDIT_USAGE_URL: string
  // Misc — ref objects so handlers can mutate the originals in index.ts
  appSettingsPath: string
  cachedTheme: { current: UiTheme | null }
  cachedUpdateChannel: { current: UpdateChannel | null }
  cachedAutoSaveDefault: { current: AutoSaveDefault | null }
  cachedAiPanelPrefs: { current: AiPanelPrefs | null }
  cachedGithubStars: { current: number | null }
  appIsPackaged: boolean
  openFileViaDialog: () => Promise<void>
}

/**
 * Register home-screen IPC handlers (file ops, settings, MCP, cloud projects, star prompt).
 * Split from index.ts as part of P4-IPC.
 */
export function registerHomeIpc(deps: HomeDeps): void {
  const {
    channels,
    shellWindow,
    proxyBootstrap,
    analytics,
    currentLang,
    currentTheme,
    currentUpdateChannel,
    currentAutoSaveDefault,
    currentMcpSettings,
    currentAiPanelPrefs,
    analyticsEnabled,
    persistLang,
    writeAppSetting,
    writeAppSettings,
    readAppSettings,
    applyUpdateChannel,
    buildHomeMenu,
    installDockMenu,
    installBackToHomeItems,
    refreshTitleBarOverlay,
    openDocumentPath,
    afterFileMoved,
    afterFolderMoved,
    ensureFolderWatcher,
    rememberPendingDir,
    newDocTab,
    newSheetTab,
    newSlideTab,
    newMarkdownTab,
    newHtmlTab,
    newPdfTab,
    tm,
    isLang,
    isUpdateChannel,
    persistAnalyticsPreference,
    GENTEAM_URL,
    CREDIT_USAGE_URL,
appSettingsPath,
    cachedTheme,
    cachedUpdateChannel,
    cachedAutoSaveDefault,
    cachedAiPanelPrefs,
    appIsPackaged,
  } = deps

  // signed-in means Lycero Office's own login; the shared gsk CLI key
  // is only a silent fallback, deliberately not shown here to nudge users onto our key
  ipcMain.handle(channels.accountStatus, async () => {
    const session = getSession()
    if (session?.token) {
      const tier: AccountStatus['tier'] = (session.license?.tier || session.user.plan || 'free') as AccountStatus['tier']
      const quotaRemaining = session.license?.quotaRemaining ?? session.user.creditsRemaining
      return {
        loggedIn: true,
        email: session.user.email,
        tier,
        creditBalance: quotaRemaining !== undefined ? Number(quotaRemaining) : undefined,
      }
    }
    if (!loadLyceroAuth()) return { loggedIn: false }
    await proxyBootstrap
    const info = await gskLoginInfo()
    if (!info) return { loggedIn: true }
    // Map plan string to tier: 'pro' or 'enterprise' for paid plans, 'free' otherwise
    const plan = info.plan?.toLowerCase() ?? ''
    const tier: AccountStatus['tier'] =
      plan.includes('enterprise') ? 'enterprise' : plan.includes('pro') ? 'pro' : 'free'
    return { loggedIn: true, email: info.email, creditBalance: info.creditBalance, tier }
  })

  ipcMain.handle(channels.getAppVersion, (): string => app.getVersion())

  ipcMain.handle(channels.recents, (_event, query: unknown): RecentPage =>
    pageRecentPaths(readRecentFiles(), query, new Set(readStarredFiles())),
  )

  ipcMain.handle(channels.starred, (_event, query: unknown): RecentPage => {
    const { offset, limit, ext } = normalizeRecentQuery(query)
    const all = statEntries(readStarredFiles()).sort((a, b) => b.mtimeMs - a.mtimeMs)
    const filtered = ext ? all.filter((entry) => matchesExtFamily(entry.ext, ext)) : all
    return {
      entries: limit === 0 ? [] : filtered.slice(offset, offset + limit),
      total: filtered.length,
      totalAll: all.length,
    }
  })

  ipcMain.handle(channels.statPaths, (_event, paths: unknown): RecentEntry[] =>
    statEntries(stringPaths(paths)),
  )

  ipcMain.handle(channels.toggleStar, (_event, path: unknown) => {
    if (typeof path === 'string') toggleStarredFile(path)
  })

  ipcMain.handle(channels.openPath, (_event, path: unknown) => {
    if (typeof path === 'string') openDocumentPath(path)
  })

  ipcMain.handle(channels.browse, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? shellWindow()
    if (!win) return
    const result = await showOpenDialogWithMemory(dialog, win, {
      title: tm('dlgOpenTitle'),
      filters: [
        { name: tm('filterSupported'), extensions: OPEN_DIALOG_EXTENSIONS },
        { name: tm('filterWord'), extensions: ['docx', 'doc'] },
        { name: tm('filterExcel'), extensions: ['xlsx', 'xlsm', 'xls', 'csv'] },
        { name: tm('filterPpt'), extensions: ['pptx', 'ppt'] },
        { name: tm('filterPdf'), extensions: ['pdf'] },
        { name: tm('filterMarkdown'), extensions: ['md', 'markdown'] },
        { name: tm('filterHtml'), extensions: ['html', 'htm'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })
    if (!result.canceled) for (const path of result.filePaths) openDocumentPath(path)
  })

  ipcMain.handle(channels.newDoc, (_event, opts?: NewFileOpts) => {
    rememberPendingDir('doc', opts)
    newDocTab()
  })

  ipcMain.handle(channels.newSheet, (_event, opts?: NewFileOpts) => {
    rememberPendingDir('sheet', opts)
    void newSheetTab()
  })

  ipcMain.handle(channels.newSlide, (_event, opts?: NewFileOpts) => {
    rememberPendingDir('slide', opts)
    newSlideTab()
  })

  ipcMain.handle(channels.newMarkdown, (_event, opts?: NewFileOpts) => {
    rememberPendingDir('markdown', opts)
    newMarkdownTab()
  })

  ipcMain.handle(channels.newHtml, (_event, opts?: NewFileOpts) => {
    rememberPendingDir('html', opts)
    newHtmlTab()
  })

  ipcMain.handle(channels.newPdf, (_event, opts?: NewFileOpts) => {
    rememberPendingDir('pdf', opts)
    void newPdfTab()
  })

  ipcMain.handle(channels.removeRecent, (_event, paths: unknown) => {
    const list = stringPaths(paths)
    removeRecentFiles(list)
    removeStarredFiles(list.filter((p) => !existsSync(p)))
  })

  ipcMain.handle(channels.revealPath, (_event, path: unknown) => {
    if (typeof path === 'string' && existsSync(path)) shell.showItemInFolder(path)
  })

  ipcMain.handle(
    channels.renameFile,
    (_event, path: unknown, newName: unknown): RenameResult => {
      if (typeof path !== 'string' || typeof newName !== 'string')
        return { ok: false, error: tm('errBadArgs') }
      if (!isValidRawRenameName(newName)) return { ok: false, error: tm('errBadName') }
      const name = newName.trim()
      if (!existsSync(path)) return { ok: false, error: tm('errMissing') }
      const target = join(dirname(path), name)
      if (target === path) return { ok: true, path }
      if (existsSync(target) && !isSameFile(path, target)) {
        return { ok: false, error: tm('errExists') }
      }
      try {
        renameSync(path, target)
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : tm('errRenameFailed') }
      }
      afterFileMoved(path, target)
      return { ok: true, path: target }
    },
  )

  ipcMain.handle(channels.duplicateFile, (_event, path: unknown) => {
    if (typeof path !== 'string' || !existsSync(path)) return
    const ext = extname(path)
    const base = basename(path, ext)
    const dir = dirname(path)
    for (let i = 1; ; i++) {
      const target = join(dir, `${base} ${tm('copySuffix')}${i === 1 ? '' : ` ${i}`}${ext}`)
      if (existsSync(target)) continue
      copyFileSync(path, target)
      recordRecentFile(target)
      return
    }
  })

  ipcMain.handle(channels.deleteFiles, async (_event, paths: unknown) => {
    const list = stringPaths(paths)
    for (const p of list) {
      try {
        await shell.trashItem(p)
      } catch {
        // file already gone or trash unavailable
      }
    }
    removeRecentFiles(list)
    removeStarredFiles(list)
  })

  ipcMain.handle(channels.openTrash, () => {
    if (process.platform === 'darwin') {
      void shell.openPath(join(app.getPath('home'), '.Trash'))
    } else if (process.platform === 'win32') {
      spawn('explorer.exe', ['shell:RecycleBin'], { detached: true }).unref()
    } else {
      void shell.openPath(join(app.getPath('home'), '.local', 'share', 'Trash', 'files'))
    }
  })

  ipcMain.handle(channels.getLanguage, (): Lang => currentLang())

  ipcMain.handle(channels.setLanguage, (_event, lang: unknown) => {
    if (!isLang(lang) || lang === currentLang()) return
    persistLang(lang)
    buildHomeMenu()
    installDockMenu()
    installBackToHomeItems()
    for (const wc of webContents.getAllWebContents()) wc.send('app:language-changed', lang)
  })

  ipcMain.handle(channels.getUpdateChannel, (): UpdateChannel => currentUpdateChannel())

  ipcMain.handle(channels.setUpdateChannel, (_event, channel: unknown) => {
    if (!isUpdateChannel(channel) || channel === currentUpdateChannel()) return
    deps.cachedUpdateChannel.current = channel
    writeAppSetting(appSettingsPath, 'updateChannel', channel)
    applyUpdateChannel(channel)
  })

  ipcMain.handle(
    channels.onboardingSeen,
    (): boolean => readAppSettings(appSettingsPath).onboardingSeen === true,
  )

  ipcMain.handle(channels.setOnboardingSeen, (): boolean => {
    try {
      writeAppSetting(appSettingsPath, 'onboardingSeen', true)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(channels.getTheme, (): UiTheme => currentTheme())
  ipcMain.handle('app:get-theme', (): UiTheme => currentTheme())

  ipcMain.handle(channels.setTheme, (_event, theme: unknown) => {
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return
    if (theme === currentTheme()) return
    deps.cachedTheme.current = theme as UiTheme
    writeAppSetting(appSettingsPath, 'theme', theme)
    nativeTheme.themeSource = theme as 'light' | 'dark' | 'system'
    refreshTitleBarOverlay()
    for (const wc of webContents.getAllWebContents()) wc.send('app:theme-changed', theme)
  })

  ipcMain.handle(channels.getAutoSaveDefault, (): AutoSaveDefault => currentAutoSaveDefault())
  ipcMain.handle('app:get-auto-save-default', (): AutoSaveDefault => currentAutoSaveDefault())

  ipcMain.handle(channels.setAutoSaveDefault, (_event, on: unknown) => {
    if (typeof on !== 'boolean') return
    if (on === currentAutoSaveDefault().on) return
    const next: AutoSaveDefault = { on, updatedAt: Date.now() }
    deps.cachedAutoSaveDefault.current = next
    writeAppSettings(appSettingsPath, {
      autoSaveDefault: next.on,
      autoSaveDefaultUpdatedAt: next.updatedAt,
    })
    for (const wc of webContents.getAllWebContents()) wc.send('app:auto-save-default-changed', next)
  })

  ipcMain.handle(channels.getMcpStatus, () => mcpStatus())

  ipcMain.handle(channels.setMcpSettings, async (_event, patch: unknown) => {
    if (!patch || typeof patch !== 'object') return mcpStatus()
    const request = patch as {
      enabled?: unknown
      port?: unknown
      background?: unknown
      logging?: unknown
    }
    const current = currentMcpSettings()
    const enabled = typeof request.enabled === 'boolean' ? request.enabled : current.enabled
    const port =
      typeof request.port === 'number' &&
      Number.isInteger(request.port) &&
      request.port > 0 &&
      request.port < 65536
        ? request.port
        : current.port
    const background =
      typeof request.background === 'boolean' ? request.background : current.background
    const logging = typeof request.logging === 'boolean' ? request.logging : current.logging
    writeAppSettings(appSettingsPath, {
      mcpEnabled: enabled,
      mcpPort: port,
      mcpBackground: background,
      mcpLogging: logging,
    })
    try {
      return await applyMcpSettings({ enabled, port, background, logging })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ...mcpStatus(), error: message }
    }
  })

  ipcMain.handle(channels.getMcpLogs, () => getMcpRecentLogs())

  ipcMain.handle(channels.clearMcpLogs, () => {
    clearMcpLogs()
  })

  ipcMain.handle(channels.openMcpLogFile, () => {
    revealMcpLogFile()
    const logPath = mcpLogFilePath()
    if (logPath) shell.showItemInFolder(logPath)
  })

  ipcMain.handle(channels.getAnalyticsEnabled, (): boolean => analyticsEnabled())

  ipcMain.handle(channels.setAnalyticsEnabled, (_event, enabled: unknown): boolean => {
    if (typeof enabled !== 'boolean') return false
    return persistAnalyticsPreference(enabled)
  })

  const setAiPanelPrefs = (patch: unknown): AiPanelPrefs => {
    const prev = currentAiPanelPrefs()
    const raw =
      patch !== null && typeof patch === 'object' ? (patch as Record<string, unknown>) : {}
    const next = normalizeAiPanelPrefs({
      side: raw.side === 'left' || raw.side === 'right' ? raw.side : prev.side,
      fontSize: 'fontSize' in raw ? raw.fontSize : prev.fontSize,
      customFontSize: 'customFontSize' in raw ? raw.customFontSize : prev.customFontSize,
      spellcheck: 'spellcheck' in raw ? raw.spellcheck : prev.spellcheck,
    })
    if (sameAiPanelPrefs(next, prev)) return prev
    deps.cachedAiPanelPrefs.current = next
    writeAppSettings(appSettingsPath, {
      aiPanelSide: next.side,
      aiPanelFontSize: next.fontSize,
      aiPanelCustomFontSize: next.customFontSize,
      aiPanelSpellcheck: next.spellcheck,
    })
    for (const wc of webContents.getAllWebContents()) wc.send('app:ai-panel-prefs-changed', next)
    return next
  }
  ipcMain.handle(channels.setAiPanelPrefs, (_event, patch) => setAiPanelPrefs(patch))
  ipcMain.handle('app:set-ai-panel-prefs', (_event, patch) => setAiPanelPrefs(patch))
  ipcMain.handle(channels.getAiPanelPrefs, () => currentAiPanelPrefs())
  ipcMain.handle('app:get-ai-panel-prefs', () => currentAiPanelPrefs())

  const folderErrors = (): FolderErrors => ({
    badArgs: tm('errBadArgs'),
    badName: tm('errBadName'),
    missing: tm('errMissing'),
    exists: tm('errExists'),
    failed: tm('errRenameFailed'),
  })
  const insideRoot = (path: unknown): path is string =>
    typeof path === 'string' && isInsideRoot(defaultSaveDir(), path)
  const isRoot = (path: string) => resolve(path) === resolve(defaultSaveDir())

  ipcMain.handle(channels.folderRoot, (): FolderRoot => {
    const root = describeRoot(defaultSaveDir())
    if (root.usable) ensureFolderWatcher()
    return root
  })

  ipcMain.handle(channels.listFolder, (_event, dir: unknown): FolderListing => {
    if (!insideRoot(dir)) return { dir: String(dir), folders: [], files: [] }
    return listFolder(dir, new Set(readStarredFiles()))
  })

  ipcMain.handle(
    channels.createFolder,
    (_event, parent: unknown, name: unknown): RenameResult => {
      if (!insideRoot(parent) || typeof name !== 'string')
        return { ok: false, error: tm('errBadArgs') }
      return createFolder(parent, name, folderErrors())
    },
  )

  ipcMain.handle(
    channels.renameFolder,
    (_event, dir: unknown, newName: unknown): RenameResult => {
      if (!insideRoot(dir) || isRoot(dir) || typeof newName !== 'string')
        return { ok: false, error: tm('errBadArgs') }
      const filesBefore = collectTreeFiles(dir)
      const result = renameFolder(dir, newName, folderErrors())
      if (result.ok && result.path && result.path !== dir) {
        afterFolderMoved(dir, result.path, filesBefore)
      }
      return result
    },
  )

  ipcMain.handle(
    channels.movePaths,
    async (_event, paths: unknown, targetDir: unknown, policy: unknown): Promise<MoveResult> => {
      const list = stringPaths(paths)
      if (!insideRoot(targetDir)) {
        const error = tm('errBadArgs')
        return { moved: [], conflicts: [], failed: list.map((path) => ({ path, error })) }
      }
      const conflictPolicy: MoveConflictPolicy =
        policy === 'replace' || policy === 'keepBoth' || policy === 'skip' ? policy : 'ask'
      const isDir = (p: string) => {
        try {
          return statSync(p).isDirectory()
        } catch {
          return false
        }
      }
      const sources = list.filter((p) => !isDir(p) || isInsideRoot(defaultSaveDir(), p))
      const dirFiles = new Map(sources.filter(isDir).map((p) => [p, collectTreeFiles(p)]))
      const displaced: string[] = []
      const result = movePathsInto(sources, targetDir, conflictPolicy, folderErrors(), {
        replaceExisting: (path: string) => {
          const parked = join(
            dirname(path),
            `.lycero-office-replaced-${Date.now()}-${basename(path)}`,
          )
          const files = isDir(path) ? collectTreeFiles(path) : [path]
          renameSync(path, parked)
          return {
            commit: () => {
              displaced.push(parked)
              removeRecentFiles(files)
              removeStarredFiles(files)
              for (const file of files) projectFileRenamed(file, rebasePath(file, path, parked))
            },
            rollback: () => renameSync(parked, path),
          }
        },
      })
      for (const parked of displaced) {
        try {
          await shell.trashItem(parked)
        } catch {
          rmSync(parked, { recursive: true, force: true })
        }
      }
      for (const moved of result.moved ?? []) {
        const files = dirFiles.get(moved.from)
        if (files) afterFolderMoved(moved.from, moved.to, files)
        else afterFileMoved(moved.from, moved.to)
      }
      return result as MoveResult
    },
  )

  ipcMain.handle(channels.deleteFolder, async (_event, dir: unknown) => {
    if (!insideRoot(dir) || isRoot(dir)) return
    const files = collectTreeFiles(dir)
    try {
      await shell.trashItem(dir)
    } catch {
      return
    }
    removeRecentFiles(files)
    removeStarredFiles(files)
  })

  ipcMain.handle(channels.getDefaultSaveDir, (): string => defaultSaveDir())

  ipcMain.handle(channels.pickDefaultSaveDir, async (): Promise<string | null> => {
    const result = await showOpenDialogWithMemory(dialog, shellWindow()!, {
      title: tm('dlgPickSaveDir'),
      defaultPath: defaultSaveDir(),
      properties: ['openDirectory', 'createDirectory'],
    })
    const picked = result.filePaths[0]
    if (result.canceled || !picked) return null
    if (!isUsableSaveDir(picked)) {
      showErrorDialog(shellWindow()!, tm('errSaveDirUnusable'), picked)
      return null
    }
    writeAppSetting(appSettingsPath, 'defaultSaveDir', picked)
    ensureFolderWatcher()
    return picked
  })

  ipcMain.handle(channels.openGenTeam, () => {
    shell.openExternal(GENTEAM_URL).catch(() => {})
  })

  ipcMain.handle(channels.openCreditUsage, () => {
    shell.openExternal(CREDIT_USAGE_URL).catch(() => {})
  })



  ipcMain.handle(channels.starPromptShouldShow, () => ({ show: false, docOpens: 0 }))

  // starPromptAction removed (GitHub star prompt feature purged)

  const cloudProjectsStorePath = () => join(app.getPath('userData'), 'cloud-projects.json')

  ipcMain.handle(channels.cloudProjectsCached, () =>
    readCloudProjectsStore(cloudProjectsStorePath()),
  )

  ipcMain.handle(channels.cloudProjects, () => syncCloudProjects(cloudProjectsStorePath()))

  ipcMain.handle(channels.openCloudProject, (_event, projectUrl: unknown) => {
    const url = cloudProjectExternalUrl(projectUrl)
    if (url) void shell.openExternal(url)
  })
}
