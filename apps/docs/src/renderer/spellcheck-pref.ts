/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/** Persisted "check spelling as you type" toggle (Review → Spelling).
 * Drives the native Chromium checker's red squiggle on the document body and
 * the header/footer edit surfaces; on by default, matching Word. */
export const SPELLCHECK_KEY = 'aidocs.spellcheck'

export function spellcheckEnabled(): boolean {
  return localStorage.getItem(SPELLCHECK_KEY) !== '0'
}
