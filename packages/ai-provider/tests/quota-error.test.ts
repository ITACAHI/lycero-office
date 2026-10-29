/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { describe, expect, it, vi } from 'vitest'
import { AiQuotaExhaustedError, isAiQuotaExhaustedError } from '../src/quota-error'

describe('isAiQuotaExhaustedError — QUOTA_EXHAUSTED sentinel mapping', () => {
  // ── Direct AiQuotaExhaustedError ─────────────────────────────────

  it('matches a direct AiQuotaExhaustedError instance', () => {
    // AiQuotaExhaustedError is imported at the top of the file
    expect(isAiQuotaExhaustedError(new AiQuotaExhaustedError('monthly quota exceeded'))).toBe(true)
  })

  // ── HTTP 429 QUOTA_EXHAUSTED body strings (the Hub contract) ───────

  it('matches HTTP 429 with QUOTA_EXHAUSTED code in JSON body', () => {
    expect(
      isAiQuotaExhaustedError(
        new Error('HTTP 429: {"error":{"code":"QUOTA_EXHAUSTED","message":"Monthly AI quota exhausted"}}'),
      ),
    ).toBe(true)
  })

  it('matches plain QUOTA_EXHAUSTED string in error message', () => {
    expect(isAiQuotaExhaustedError(new Error('Monthly quota exhausted: QUOTA_EXHAUSTED'))).toBe(true)
    expect(isAiQuotaExhaustedError(new Error('AI quota exceeded (QUOTA_EXHAUSTED)'))).toBe(true)
  })

  it('matches QUOTA_EXHAUSTED as a bare string (cause-chain terminus)', () => {
    expect(isAiQuotaExhaustedError('QUOTA_EXHAUSTED')).toBe(true)
    expect(isAiQuotaExhaustedError('Monthly AI quota exhausted — QUOTA_EXHAUSTED')).toBe(true)
  })

  // ── Error code field (the Hub sets `code: "QUOTA_EXHAUSTED` on the thrown error) ──

  it('matches when `code` field is QUOTA_EXHAUSTED', () => {
    const err = new Error('quota exceeded') as Error & { code?: string }
    err.code = 'QUOTA_EXHAUSTED'
    expect(isAiQuotaExhaustedError(err)).toBe(true)
  })

  // ── Cause chain ───────────────────────────────────────────────────

  it('walks the cause chain (depth 1)', () => {
    const cause = new Error('HTTP 429: QUOTA_EXHAUSTED')
    expect(isAiQuotaExhaustedError(new Error('AI request failed', { cause }))).toBe(true)
  })

  it('walks the cause chain (depth 3)', () => {
    // The innermost error carries the QUOTA_EXHAUSTED code
    const inner = new Error('quota exhausted') as Error & { code?: string }
    inner.code = 'QUOTA_EXHAUSTED'
    const wrap1 = new Error('gateway error', { cause: inner })
    const wrap2 = new Error('request failed', { cause: wrap1 })
    const wrap3 = new Error('stream failed', { cause: wrap2 })
    expect(isAiQuotaExhaustedError(wrap3)).toBe(true)
  })

  it('walks the cause chain (depth 5 — max)', () => {
    let err: Error = new Error('bottom')
    for (let i = 0; i < 5; i++) err = new Error(`level ${i}`, { cause: err })
    // make the innermost have QUOTA_EXHAUSTED
    ;(err as Error & { code?: string }).code = 'QUOTA_EXHAUSTED'
    const deepCause = err
    expect(isAiQuotaExhaustedError(new Error('top', { cause: deepCause }))).toBe(true)
  })

  // ── Does NOT match ────────────────────────────────────────────────

  it('does not match other HTTP errors', () => {
    expect(isAiQuotaExhaustedError(new Error('HTTP 401: unauthorized'))).toBe(false)
    expect(isAiQuotaExhaustedError(new Error('HTTP 500: internal error'))).toBe(false)
    expect(isAiQuotaExhaustedError(new Error('HTTP 429: overloaded — try again later'))).toBe(false)
  })

  it('does not match generic messages', () => {
    expect(isAiQuotaExhaustedError(new Error('AI is busy, please retry'))).toBe(false)
    expect(isAiQuotaExhaustedError(new Error('rate limit exceeded'))).toBe(false)
    expect(isAiQuotaExhaustedError(new Error('Too many requests'))).toBe(false)
  })

  it('does not match null / undefined / non-error values', () => {
    expect(isAiQuotaExhaustedError(null)).toBe(false)
    expect(isAiQuotaExhaustedError(undefined)).toBe(false)
    expect(isAiQuotaExhaustedError({})).toBe(false)
    expect(isAiQuotaExhaustedError('Request failed')).toBe(false)
    expect(isAiQuotaExhaustedError(0)).toBe(false)
  })

  it('does not match credits-exhausted (a separate error class)', () => {
    expect(
      isAiQuotaExhaustedError(
        new Error('Your Lycero credits have been exhausted. Visit lycero.com/pricing to top up'),
      ),
    ).toBe(false)
  })
})
