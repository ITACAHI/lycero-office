/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

/**
 * Error thrown when the Hub returns HTTP 429 with code "QUOTA_EXHAUSTED".
 * This is a permanent failure — retrying will not help until the quota cycle resets.
 * The renderer uses errorCode 'quota_exhausted' to surface a localized lock/upgrade
 * message instead of a generic overloaded notice.
 */
export class AiQuotaExhaustedError extends Error {
  public readonly errorCode = 'quota_exhausted' as const
  public readonly isPermanent = true as const

  constructor(message: string) {
    super(message)
    this.name = 'AiQuotaExhaustedError'
  }
}

/**
 * True when the value (an Error, its `cause` chain, or a plain string)
 * is the Hub's quota-exhausted sentinel: HTTP 429 + code "QUOTA_EXHAUSTED".
 * This is a permanent error — do NOT retry.
 */
export function isAiQuotaExhaustedError(err: unknown): boolean {
  if (err instanceof AiQuotaExhaustedError) return true
  let current: unknown = err
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === 'string') {
      if (current.includes('QUOTA_EXHAUSTED')) return true
    }
    const e = current as { message?: unknown; cause?: unknown; code?: unknown }
    if (typeof e.code === 'string' && e.code === 'QUOTA_EXHAUSTED') return true
    if (typeof e.message === 'string' && e.message.includes('QUOTA_EXHAUSTED')) return true
    // Walk into cause.code and cause.message so a bare-inner error in the chain is caught
    const c = e.cause as { message?: unknown; code?: unknown } | undefined
    if (typeof c?.code === 'string' && c.code === 'QUOTA_EXHAUSTED') return true
    if (typeof c?.message === 'string' && c.message.includes('QUOTA_EXHAUSTED')) return true
    current = e.cause
  }
  return false
}
