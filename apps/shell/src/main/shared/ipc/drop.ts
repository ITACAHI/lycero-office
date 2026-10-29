/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { ipcMain } from 'electron'
import { handleDroppedFiles, type DroppedFilesDeps } from '../../dropped-files'
import { partitionDropPayload } from '@lycero/electron-utils'

/** Channel for receiving file-open events from the OS drop handler (via preload bridge). */
const DROP_OPEN_CHANNEL = 'drop:open'

/** Channel for converting a document file to PDF */
const CONVERT_OFFICE_CHANNEL = 'drop:convert-office'

export type { DroppedFilesDeps }

/**
 * Register drop-related IPC handlers.
 * Split from index.ts as part of P4-IPC.
 */
export function registerDroppedFilesIpc(deps: DroppedFilesDeps): void {
  ipcMain.on(DROP_OPEN_CHANNEL, (_event, raw: unknown) => handleDroppedFiles(raw, deps))

  // ponytail: convertOffice stub — full conversion requires the PDF app's
  // runtime. Full implementation would: load the file in a hidden renderer
  // → trigger File > Export as PDF → save. Skipped for now since the PDF
  // app's headless export path (headless-export.ts) already covers this.
  ipcMain.handle(CONVERT_OFFICE_CHANNEL, async (_event, inputPath: unknown) => {
    if (typeof inputPath !== 'string') return { ok: false, error: 'Invalid input path' }
    // placeholder: real conversion is in the PDF app's export pipeline
    return { ok: false, error: 'convertOffice: not wired yet — use File > Export as PDF from the PDF app' }
  })
}
