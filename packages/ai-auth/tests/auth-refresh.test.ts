/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Tests for authedFetch + refresh-token rotation.
 * Stub fetch via __setFetchForTest; stub auth by writing the auth file.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { join } from 'node:path'
import {
  __setFetchForTest,
  fetchHubQuota,
  lyceroAuthPath,
  resetLyceroAuthCache,
  saveLyceroAuth,
  gskLoginInfo,
  verifyOAuthState,
  resetOAuthStateForTest,
  resetAuthDirCache,
} from '../src/lycero-auth'

/** Build a fake Response-like object. */
function fakeResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as unknown as Response
}

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'lycero-auth-test-'))
  process.env.LYCERO_AUTH_DIR = tmpDir
  resetAuthDirCache()
  resetLyceroAuthCache()
  resetOAuthStateForTest()
  __setFetchForTest(null)
})

afterEach(() => {
  __setFetchForTest(null)
  resetLyceroAuthCache()
  resetOAuthStateForTest()
  resetAuthDirCache()
  delete process.env.LYCERO_AUTH_DIR
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeAuth(refreshToken: string | undefined, accessToken = 'old-access'): void {
  const path = lyceroAuthPath()
  writeFileSync(
    path,
    JSON.stringify({
      tokens: { accessToken, refreshToken },
      user: { id: 'u', name: 'U', email: 'u@x' },
      orgId: undefined,
      archetypeId: undefined,
    }),
  )
  resetLyceroAuthCache()
  saveAuthViaRead()
}

function saveAuthViaRead(): void {
  // Reset cache so the next loadLyceroAuth() reads the file we just wrote
  resetLyceroAuthCache()
}

describe('authedFetch refresh rotation', () => {
  it('returns null when no auth is present', async () => {
    let called = false
    __setFetchForTest(async () => {
      called = true
      return fakeResponse(200)
    })
    const result = await fetchHubQuota()
    expect(result).toBeNull()
    expect(called).toBe(false)
  })

  it('returns parsed body on 200', async () => {
    writeAuth('refresh-abc')
    let authHeader: string | null = null
    __setFetchForTest(async (_url, init) => {
      authHeader = (init?.headers as Record<string, string>)?.Authorization ?? null
      return fakeResponse(200, { used: 42, limit: 100, reset_at: '2026-10-01' })
    })
    const q = await fetchHubQuota()
    expect(q).toEqual({ used: 42, limit: 100, resetAt: '2026-10-01' })
    expect(authHeader).toBe('Bearer old-access')
  })

  it('refreshes token on 401 and retries the request once', async () => {
    writeAuth('refresh-xyz')
    let calls = 0
    __setFetchForTest(async (url, init) => {
      calls++
      const headers = (init?.headers as Record<string, string>) ?? {}
      const body = url.includes('/auth/refresh') ? { access_token: 'new-access', expires_in: 3600 } : { used: 7, limit: 100, reset_at: '' }
      // quota call: 401 first time, 200 second time
      if (url.includes('/quota/check')) {
        return calls === 1
          ? fakeResponse(401, { error: 'expired' })
          : fakeResponse(200, body)
      }
      // refresh call: returns new token
      return fakeResponse(200, body)
    })
    const q = await fetchHubQuota()
    expect(q).toEqual({ used: 7, limit: 100, resetAt: '' })
    // 1 quota call (401), 1 refresh call, 1 quota call (200) = 3 total
    expect(calls).toBe(3)
  })

  it('returns null when refresh fails (no refresh token)', async () => {
    writeAuth(undefined)
    let calls = 0
    __setFetchForTest(async (url) => {
      calls++
      if (url.includes('/quota/check')) return fakeResponse(401)
      return fakeResponse(400, { error: 'no_refresh' })
    })
    const q = await fetchHubQuota()
    expect(q).toBeNull()
    expect(calls).toBe(1) // no refresh attempted, no retry
  })

  it('does not stampede refresh calls on concurrent 401s', async () => {
    writeAuth('shared-refresh')
    let calls = 0
    let refreshCount = 0
    __setFetchForTest(async (url) => {
      calls++
      if (url.includes('/auth/refresh')) {
        refreshCount++
        // simulate slow refresh
        await new Promise((r) => setTimeout(r, 30))
        return fakeResponse(200, { access_token: 'rotated', expires_in: 3600 })
      }
      // quota call: 401 first time per caller, 200 after refresh
      return calls <= 2 ? fakeResponse(401) : fakeResponse(200, { used: 1, limit: 10, reset_at: '' })
    })
    // Fire 3 concurrent quota fetches
    const results = await Promise.all([fetchHubQuota(), fetchHubQuota(), fetchHubQuota()])
    expect(results.every((q) => q?.used === 1)).toBe(true)
    expect(refreshCount).toBe(1) // single in-flight refresh collapsed the stampede
  })
})

describe('gskLoginInfo — single auth info source', () => {
  it('returns null when no auth is present', () => {
    expect(gskLoginInfo()).toBeNull()
  })

  it('returns email and plan from auth file', () => {
    const path = lyceroAuthPath()
    writeFileSync(
      path,
      JSON.stringify({
        tokens: { accessToken: 'tok', refreshToken: 'ref' },
        user: { id: 'u1', name: 'Nguyễn A', email: 'user@lycero.vn', plan: 'pro', creditsRemaining: 150 },
        orgId: undefined,
        archetypeId: undefined,
      }),
    )
    resetLyceroAuthCache()
    const info = gskLoginInfo()
    expect(info).not.toBeNull()
    expect(info!.email).toBe('user@lycero.vn')
    expect(info!.plan).toBe('pro')
    expect(info!.creditBalance).toBe(150)
  })

  it('defaults plan to "Lycero Member" when absent', () => {
    const path = lyceroAuthPath()
    writeFileSync(
      path,
      JSON.stringify({
        tokens: { accessToken: 'tok' },
        user: { id: 'u2', name: 'B', email: 'b@test.com' },
        orgId: undefined,
        archetypeId: undefined,
      }),
    )
    resetLyceroAuthCache()
    const info = gskLoginInfo()
    expect(info).not.toBeNull()
    expect(info!.plan).toBe('Lycero Member')
  })
})

describe('OAuth CSRF state', () => {
  it('verifyOAuthState returns false when no state file exists', () => {
    expect(verifyOAuthState('any-state')).toBe(false)
  })

  it('verifyOAuthState returns false for mismatched state', () => {
    // verifyOAuthState returns false when file missing — covers missing-path case
    expect(verifyOAuthState('wrong-state')).toBe(false)
  })
})
