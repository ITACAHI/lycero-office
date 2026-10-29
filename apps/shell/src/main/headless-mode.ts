/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Headless mode detection and management.
 *
 * Headless mode is used when the shell is invoked from the CLI with
 * `--headless-export` (or `--headless-convert`) and no window should be
 * shown. This module provides the single source of truth for that flag,
 * which every editor main module checks before opening BrowserWindows or
 * performing focus-stealing operations.
 *
 * See also: `packages/electron-utils/src/headless-mode.ts` for the
 * shared (package-level) flag, and `apps/shell/src/main/headless-export.ts`
 * for the export orchestration layer.
 */
import { app } from 'electron'

/** Command-line arguments that indicate headless mode */
const HEADLESS_ARGVS = ['--headless', '--headless-export', '--headless-convert', '--headless-batch']

/** Environment variable that forces headless mode */
const HEADLESS_ENV = 'LYCERO_HEADLESS'

/** The shared process-wide flag (also mirrored in electron-utils/headless-mode) */
let _isHeadless = false

/**
 * Detect headless mode from command-line arguments or environment.
 * Must be called once before the app is ready.
 */
export function detectHeadlessMode(): boolean {
  // Check environment first (CI / explicit override)
  if (process.env[HEADLESS_ENV] === '1' || process.env[HEADLESS_ENV] === 'true') {
    return true
  }
  // Check argv
  for (const arg of HEADLESS_ARGVS) {
    if (process.argv.includes(arg)) return true
  }
  return false
}

/** Initialize headless mode before app startup */
export function initHeadlessMode(): void {
  _isHeadless = detectHeadlessMode()
}

/**
 * Get the current headless mode state.
 * Returns true when the shell was started with `--headless*` flags.
 */
export function isHeadlessMode(): boolean {
  return _isHeadless
}

/**
 * Override headless mode (useful for testing).
 */
export function setHeadlessMode(on: boolean): void {
  _isHeadless = on
}

/**
 * Check if the shell should skip creating the main BrowserWindow.
 * In headless mode, `app.whenReady()` resolves but no window is created —
 * instead, the export pipeline runs and the process exits.
 */
export function shouldSkipMainWindow(): boolean {
  return _isHeadless
}

/**
 * Get the headless export format from argv (e.g. `--to pdf`).
 * Returns null when not in headless export mode.
 */
export function getHeadlessExportTarget(): string | null {
  const idx = process.argv.indexOf('--to')
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1]
  }
  // Also check --headless-convert <input> --to <format>
  return null
}

/**
 * Get the headless input file path from argv.
 * Returns null when not in headless export/convert mode.
 */
export function getHeadlessInputPath(): string | null {
  // Input comes after --headless-export or --headless-convert
  for (const flag of ['--headless-export', '--headless-convert']) {
    const idx = process.argv.indexOf(flag)
    if (idx >= 0 && idx + 1 < process.argv.length && !process.argv[idx + 1].startsWith('--')) {
      return process.argv[idx + 1]
    }
  }
  return null
}

/**
 * Get the output path from argv (--out <path>).
 * Returns null when not specified.
 */
export function getHeadlessOutputPath(): string | null {
  const idx = process.argv.indexOf('--out')
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1]
  }
  return null
}

/**
 * Whether to emit JSON envelopes instead of human-readable text.
 * Enabled with `--json` flag.
 */
export function isHeadlessJsonMode(): boolean {
  return process.argv.includes('--json')
}

/**
 * Compute the exit code for a headless operation result.
 */
export function headlessExitCode(success: boolean): number {
  return success ? 0 : 1
}
