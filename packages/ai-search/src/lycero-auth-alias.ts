/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Re-exports the canonical Lycero auth module with its canonical names.
 * Backward-compatible aliases allow old callers to keep working during the
 * transition period.
 */
export {
  loadLyceroAuth,
  lyceroLogout,
  startLyceroLogin,
  lyceroApiKey as lycApiKey,
  lyceroApiKey,
  lyceroLoginInFlight,
  lyceroAuthPath,
  resetLyceroAuthCache,
} from './lycero-auth'
