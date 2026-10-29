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
} from './lycero-auth'

// Backward-compatible aliases (lycero-office-* names → lycero-* names)
export {
  loadLyceroAuth as loadGenofficeAuth,
  lyceroLogout as genofficeLogout,
  startLyceroLogin as startGenofficeLogin,
  lyceroApiKey as genofficeApiKey,
  lyceroLoginInFlight as genofficeLoginInFlight,
  lyceroAuthPath as genofficeAuthPath,
  resetLyceroAuthCache as resetGenofficeAuthCache,
} from './lycero-auth'
