/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Process-wide "no user is watching" flag, set once by the shell's
 * `--headless-export` entry before any editor module boots.
 *
 * The editor modules share one bundle inside the shell, so a single module
 * variable is enough. Everything that would steal focus or spawn UI after a
 * successful write (opening the exported PDF in a tab, revealing it in the
 * file manager) checks this first.
 */
let headless = false

export function setHeadlessMode(on: boolean): void {
  headless = on
}

export function isHeadlessMode(): boolean {
  return headless
}
