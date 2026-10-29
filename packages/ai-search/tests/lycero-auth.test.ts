/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  clearDesktopSession,
  getLyceroUserInfo,
  isLyceroProUser,
  lyceroApiKey,
  lyceroAuthPath,
  lyceroLoginInFlight,
  lyceroLogout,
  loadLyceroAuth,
  reloadLyceroAuth,
  resetLyceroAuthCache,
  startLyceroLogin,
  type LyceroAuth,
} from '../src/lycero-auth'
import { gskApiKey, setGskProxyUrl } from '../src/gsk'

let dir: string
let fakeHome: string
let origHome: string | undefined
let origUserProfile: string | undefined
let origAppData: string | undefined

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lycero-auth-'))
  fakeHome = mkdtempSync(join(tmpdir(), 'lycero-home-'))
  origHome = process.env.HOME
  origUserProfile = process.env.USERPROFILE
  origAppData = process.env.APPDATA
  process.env.HOME = fakeHome
  process.env.USERPROFILE = fakeHome
  process.env.APPDATA = join(fakeHome, 'AppData', 'Roaming')
  process.env.LYCERO_AUTH_DIR = dir
  delete process.env.GSK_API_KEY
  delete process.env.LYCERO_API_KEY
  resetLyceroAuthCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
  rmSync(fakeHome, { recursive: true, force: true })
  if (origHome === undefined) delete process.env.HOME
  else process.env.HOME = origHome
  if (origUserProfile === undefined) delete process.env.USERPROFILE
  else process.env.USERPROFILE = origUserProfile
  if (origAppData === undefined) delete process.env.APPDATA
  else process.env.APPDATA = origAppData
  delete process.env.LYCERO_AUTH_DIR
  delete process.env.GSK_API_KEY
  delete process.env.LYCERO_API_KEY
  setGskProxyUrl('')
  resetLyceroAuthCache()
})

// Helper: write a GSX auth file directly (mirrors what the bridge's mint would write)
function writeGskAuth(auth: LyceroAuth): void {
  const path = lyceroAuthPath()
  const { mkdirSync, writeFileSync } = require('node:fs')
  mkdirSync(require('node:path').dirname(path), { recursive: true })
  writeFileSync(
    path,
    JSON.stringify(
      { api_key: auth.apiKey, key_id: auth.keyId, access_token: auth.accessToken },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  )
}

describe('startLyceroLogin (stub)', () => {
  // Phase 3: device-code login moved to bridge IPC. startLyceroLogin is a no-op stub.

  it('returns false immediately (no-op stub)', () => {
    const result = startLyceroLogin((progress) => {
      // Should never be called
      expect(progress).toBeUndefined()
    })
    expect(result).toBe(false)
  })

  it('lyceroLoginInFlight() is always false (stub)', () => {
    expect(lyceroLoginInFlight()).toBe(false)
    startLyceroLogin()
    expect(lyceroLoginInFlight()).toBe(false)
  })
})

describe('loadLyceroAuth read-priority', () => {
  it('prefers LYCERO_API_KEY env override', () => {
    process.env.LYCERO_API_KEY = 'env-key-override'
    expect(loadLyceroAuth()).toEqual({ apiKey: 'env-key-override' })
  })

  it('feeds lyceroApiKey() from env override', () => {
    process.env.LYCERO_API_KEY = 'env-key'
    expect(lyceroApiKey()).toBe('env-key')
    expect(gskApiKey()).toBe('env-key')
  })

  it('GSK_API_KEY env override takes precedence over GSX file for gskApiKey()', () => {
    writeGskAuth({ apiKey: 'file-key', keyId: 'kid-1' })
    process.env.GSK_API_KEY = 'gsk-override'
    expect(gskApiKey()).toBe('gsk-override')
    expect(lyceroApiKey()).toBe('file-key') // lyceroApiKey does not check GSK_API_KEY
  })

  it('reads from ~/.lycero-office/auth.json when present', () => {
    writeGskAuth({ apiKey: 'file-key', keyId: 'kid-1', accessToken: 'at-1' })
    expect(loadLyceroAuth()).toEqual({ apiKey: 'file-key', keyId: 'kid-1', accessToken: 'at-1' })
    expect(lyceroApiKey()).toBe('file-key')
  })

  it('file permissions are 0o600', () => {
    writeGskAuth({ apiKey: 'perm-key', keyId: 'kid-p' })
    if (process.platform !== 'win32') {
      expect(statSync(lyceroAuthPath()).mode & 0o777).toBe(0o600)
    }
  })

  it('returns null when no auth is present', () => {
    expect(loadLyceroAuth()).toBeNull()
    expect(lyceroApiKey()).toBe('')
  })
})

describe('lyceroLogout', () => {
  it('removes the local auth file', async () => {
    writeGskAuth({ apiKey: 'key-to-clear', keyId: 'kid-1', accessToken: 'at-1' })

    await lyceroLogout()
    expect(existsSync(lyceroAuthPath())).toBe(false)
    expect(lyceroApiKey()).toBe('')
  })

  it('is a no-op when not signed in', async () => {
    await lyceroLogout()
    expect(loadLyceroAuth()).toBeNull()
  })
})

function writeLegacyHomeAuth(payload: Record<string, unknown>): string {
  const legacyDir = join(fakeHome, '.lycero')
  mkdirSync(legacyDir, { recursive: true })
  const legacyPath = join(legacyDir, 'auth.json')
  writeFileSync(legacyPath, JSON.stringify(payload, null, 2) + '\n', { mode: 0o600 })
  return legacyPath
}

function writeFakeDesktopSession(payload: Record<string, unknown>): string {
  const sessionDir = join(process.env.APPDATA!, 'lycero-office', 'lycero')
  mkdirSync(sessionDir, { recursive: true })
  const sessionPath = join(sessionDir, 'session.json')
  writeFileSync(sessionPath, JSON.stringify(payload, null, 2) + '\n', { mode: 0o600 })
  return sessionPath
}

describe('LYCERO_AUTH_DIR isolation vs legacy ~/.lycero/auth.json fallback', () => {
  it('returns null and does not read legacy ~/.lycero/auth.json when LYCERO_AUTH_DIR is empty', () => {
    writeLegacyHomeAuth({
      tokens: { accessToken: 'legacy-secret-token' },
      user: { email: 'legacy@example.com', plan: 'pro' },
      license: { tier: 'pro' },
    })
    writeFakeDesktopSession({
      token: 'desktop-session-token',
      user: { email: 'desktop@example.com', plan: 'pro' },
      license: { tier: 'pro' },
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(loadLyceroAuth()).toBeNull()
    expect(lyceroApiKey()).toBe('')
    expect(gskApiKey()).toBe('')
    expect(getLyceroUserInfo()).toBeNull()
    expect(isLyceroProUser()).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('reads auth from LYCERO_AUTH_DIR instead of legacy ~/.lycero/auth.json when both exist', () => {
    writeLegacyHomeAuth({
      tokens: { accessToken: 'legacy-secret-token' },
      user: { email: 'legacy@example.com', plan: 'pro' },
    })
    writeGskAuth({ apiKey: 'override-dir-key', keyId: 'override-kid', accessToken: 'override-at' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(loadLyceroAuth()).toEqual({
      apiKey: 'override-dir-key',
      keyId: 'override-kid',
      accessToken: 'override-at',
    })
    expect(lyceroApiKey()).toBe('override-dir-key')
    expect(reloadLyceroAuth()?.apiKey).toBe('override-dir-key')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not delete real desktop session file when clearDesktopSession() is called under LYCERO_AUTH_DIR', () => {
    const sessionPath = writeFakeDesktopSession({ token: 'keep-me' })
    clearDesktopSession()
    expect(existsSync(sessionPath)).toBe(true)
  })

  it('falls back to legacy ~/.lycero/auth.json in default mode when LYCERO_AUTH_DIR is unset', () => {
    delete process.env.LYCERO_AUTH_DIR
    resetLyceroAuthCache()
    writeLegacyHomeAuth({
      tokens: { accessToken: 'legacy-fallback-token' },
      user: { email: 'legacy@example.com', fullName: 'Legacy User', plan: 'pro' },
      license: { tier: 'pro' },
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(loadLyceroAuth()).toEqual({
      apiKey: 'legacy-fallback-token',
      accessToken: 'legacy-fallback-token',
    })
    expect(lyceroApiKey()).toBe('legacy-fallback-token')
    expect(getLyceroUserInfo()).toEqual({
      email: 'legacy@example.com',
      fullName: 'Legacy User',
      plan: 'pro',
    })
    expect(isLyceroProUser()).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('DEPRECATION: reading legacy ~/.lycero/auth.json'),
    )
  })
})
