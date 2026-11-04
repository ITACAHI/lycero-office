/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/// Electron 43 pins file dialogs without an explicit `defaultPath` to the
/// user's Downloads folder and no longer lets the OS restore the last-used
/// directory between invocations (electron/electron#49868). These wrappers
/// restore the pre-43 behavior the way the Electron breaking-changes guide
/// recommends: remember the directory of the last confirmed pick and thread
/// it into the next dialog's `defaultPath`.
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { getUiLang } from '@lycero/i18n'
import type {
  BrowserWindow,
  Dialog,
  MessageBoxOptions,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron'

// Keyed by the dialog module so tests with fake dialogs stay isolated. Each
// app bundles its own copy of this module, so the memory is scoped per
// editor — close enough to the per-app directory tracking the OS did before.
const lastUsedDirectoryByDialog = new WeakMap<Dialog, string>()

function withRememberedDirectory<T extends OpenDialogOptions | SaveDialogOptions>(
  dialog: Dialog,
  options: T,
  fallbackDir?: string | (() => string),
): T {
  // No pick confirmed yet this session: anchor in the caller's fallback (the
  // configurable default save folder) instead of Electron's Downloads pin.
  if (options.defaultPath !== undefined && basename(options.defaultPath) !== options.defaultPath) {
    return options
  }
  let lastDir = lastUsedDirectoryByDialog.get(dialog)
  if (!lastDir) {
    try {
      lastDir = typeof fallbackDir === 'function' ? fallbackDir() : fallbackDir
    } catch {
      // This is only a dialog suggestion. An unavailable default folder must
      // not prevent the user from picking another location explicitly.
    }
  }
  if (!lastDir) return options
  if (options.defaultPath === undefined) return { ...options, defaultPath: lastDir }
  // A bare file name is a Save As suggestion: anchor it in the remembered
  // directory instead of letting Electron relocate it to Downloads.
  if (basename(options.defaultPath) === options.defaultPath) {
    return { ...options, defaultPath: join(lastDir, options.defaultPath) }
  }
  return options
}

export async function showOpenDialogWithMemory(
  dialog: Dialog,
  parent: BrowserWindow | null | undefined,
  options: OpenDialogOptions,
  fallbackDir?: string,
): Promise<OpenDialogReturnValue> {
  const withDir = withRememberedDirectory(dialog, options, fallbackDir)
  const result = parent
    ? await dialog.showOpenDialog(parent, withDir)
    : await dialog.showOpenDialog(withDir)
  const picked = result.filePaths[0]
  if (!result.canceled && picked) {
    lastUsedDirectoryByDialog.set(
      dialog,
      options.properties?.includes('openDirectory') ? picked : dirname(picked),
    )
  }
  return result
}

/**
 * Save As suggestion for a document that was opened from `sourcePath`: the
 * same folder with the suggested name (Word parity — Save As starts where the
 * document lives, not in the last-used or default folder). Falls back to the
 * bare name, which `withRememberedDirectory` then anchors, when the document
 * has never been on disk.
 */
export function saveAsSuggestion(
  sourcePath: string | null | undefined,
  defaultName: string,
): string {
  return sourcePath ? join(dirname(sourcePath), defaultName) : defaultName
}

function overwritePromptLabels(): { message: string; yes: string; no: string } {
  const lang = getUiLang()
  if (lang === 'zh' || lang === 'zh-TW') {
    return {
      message: lang === 'zh-TW' ? '檔案已存在。要取代嗎？' : '文件已存在。是否替换？',
      yes: lang === 'zh-TW' ? '是' : '是',
      no: lang === 'zh-TW' ? '否' : '否',
    }
  }
  if (lang === 'en') {
    return {
      message: 'File already exists. Replace it?',
      yes: 'Yes',
      no: 'No',
    }
  }
  return {
    message: 'Tệp đã tồn tại. Thay thế?',
    yes: 'Có',
    no: 'Không',
  }
}

export async function showSaveDialogWithMemory(
  dialog: Dialog,
  parent: BrowserWindow | null | undefined,
  options: SaveDialogOptions,
  fallbackDir?: string | (() => string),
): Promise<SaveDialogReturnValue> {
  const withDir = withRememberedDirectory(dialog, options, fallbackDir)
  const result = parent
    ? await dialog.showSaveDialog(parent, withDir)
    : await dialog.showSaveDialog(withDir)
  if (!result.canceled && result.filePath) {
    lastUsedDirectoryByDialog.set(dialog, dirname(result.filePath))
    if (typeof dialog.showMessageBox === 'function' && existsSync(result.filePath)) {
      const labels = overwritePromptLabels()
      const msgOpts: MessageBoxOptions = {
        type: 'question',
        message: labels.message,
        detail: basename(result.filePath),
        buttons: [labels.yes, labels.no],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      }
      const confirm =
        parent && (typeof parent.isDestroyed !== 'function' || !parent.isDestroyed())
          ? await dialog.showMessageBox(parent, msgOpts)
          : await dialog.showMessageBox(msgOpts)
      if (confirm.response !== 0) {
        return { canceled: true, filePath: '' }
      }
    }
  }
  return result
}
