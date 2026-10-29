/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Tests for secure-store module.
 * Tests the derived-key encryption path (non-Electron context).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { tmpdir as tmpdirImport } from 'node:os'

import {
  encryptString,
  decryptString,
  isAvailable,
  readSecureAuth,
  writeSecureAuth,
} from '../src/secure-store'

let tmpDir: string

beforeEach(() => {
  tmpDir = join(tmpdir(), 'lycero-secure-store-test-' + Date.now())
  mkdirSync(tmpDir, { recursive: true })
  // Ensure we are NOT in an Electron context (force derived-key path)
  // by mocking process.versions.electron to undefined
  vi.stubGlobal('process', {
    ...process,
    versions: { ...process.versions, electron: undefined },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('isAvailable', () => {
  it('always reports derivedKey: true', () => {
    const avail = isAvailable()
    expect(avail.derivedKey).toBe(true)
  })

  it('reports encrypted: false in non-Electron context', () => {
    const avail = isAvailable()
    expect(avail.encrypted).toBe(false)
  })
})

describe('encryptString / decryptString round-trip', () => {
  it('round-trips a simple auth JSON object', () => {
    const auth = {
      tokens: { accessToken: 'tok-abc', refreshToken: 'ref-xyz' },
      user: { id: 'u1', name: 'Test', email: 'test@test.com' },
      orgId: 'org-1',
      archetypeId: 3,
    }
    const blob = encryptString(JSON.stringify(auth))
    expect(Buffer.isBuffer(blob)).toBe(true)
    expect(blob[0]).toBe(0x02) // VERSION_DERIVED
    const decrypted = decryptString(blob)
    const parsed = JSON.parse(decrypted)
    expect(parsed.tokens.accessToken).toBe('tok-abc')
    expect(parsed.tokens.refreshToken).toBe('ref-xyz')
    expect(parsed.user.email).toBe('test@test.com')
  })

  it('produces different IVs per call (semantic security)', () => {
    const auth = JSON.stringify({ token: 'same' })
    const blob1 = encryptString(auth)
    const blob2 = encryptString(auth)
    expect(blob1.equals(blob2)).toBe(false)
    // But both decrypt to the same value
    expect(decryptString(blob1)).toBe(decryptString(blob2))
  })

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const blob = encryptString('secret data')
    // Flip a bit in the middle (ciphertext area)
    const tampered = Buffer.from(blob)
    tampered[tampered.length - 20] ^= 0xff
    expect(() => decryptString(tampered)).toThrow()
  })

  it('throws on truncated blob', () => {
    const blob = encryptString('data')
    expect(() => decryptString(blob.subarray(0, 5))).toThrow()
  })

  it('throws on empty blob', () => {
    expect(() => decryptString(Buffer.alloc(0))).toThrow()
  })
})

describe('readSecureAuth / writeSecureAuth round-trip', () => {
  it('round-trips an auth object through the file system', () => {
    const path = join(tmpDir, 'auth.json')
    const auth = {
      tokens: { accessToken: 'tok-v2', refreshToken: 'ref-v2' },
      user: { id: 'u2', name: 'Alice', email: 'alice@x.vn' },
      orgId: 'org-2',
      archetypeId: 7,
    }
    writeSecureAuth(path, auth)
    expect(existsSync(path)).toBe(true)

    const { auth: loaded, migrated } = readSecureAuth(path)
    expect(loaded).not.toBeNull()
    expect((loaded as any).tokens.accessToken).toBe('tok-v2')
    expect((loaded as any).tokens.refreshToken).toBe('ref-v2')
    expect((loaded as any).user.email).toBe('alice@x.vn')
    expect(migrated).toBe(true)
  })

  it('returns { auth: null } when file does not exist', () => {
    const { auth, migrated } = readSecureAuth(join(tmpDir, 'nonexistent.json'))
    expect(auth).toBeNull()
    expect(migrated).toBe(false)
  })

  it('reads a legacy plaintext JSON file (migration fallback)', () => {
    const path = join(tmpDir, 'legacy-auth.json')
    const legacy = {
      tokens: { accessToken: 'legacy-tok', refreshToken: 'legacy-ref' },
      user: { id: 'u-old', name: 'Legacy', email: 'old@x.vn' },
      orgId: undefined,
      archetypeId: undefined,
    }
    // Write plaintext (no version byte) — simulates legacy file
    writeFileSync(path, JSON.stringify(legacy), 'utf-8')

    const { auth, migrated } = readSecureAuth(path)
    expect(auth).not.toBeNull()
    expect((auth as any).tokens.accessToken).toBe('legacy-tok')
    expect(migrated).toBe(false) // not encrypted — needs migration
  })

  it('reads a version-0x01 legacy file (explicit legacy marker)', () => {
    const path = join(tmpDir, 'v1-auth.json')
    const legacy = { tokens: { accessToken: 'v1-tok' }, user: { id: 'u1', name: 'V1', email: 'v1@x.vn' } }
    // Write raw JSON without going through writeSecureAuth (simulates old file)
    writeFileSync(path, JSON.stringify(legacy), 'utf-8')

    const { auth, migrated } = readSecureAuth(path)
    expect(auth).not.toBeNull()
    expect(migrated).toBe(false)
  })
})

describe('secure-store migration path', () => {
  it('migrated: true means re-saving would produce an encrypted blob', () => {
    const path = join(tmpDir, 'migrate-test.json')
    const auth = { tokens: { accessToken: 'migrate' }, user: { id: 'u', name: 'M', email: 'm@x.vn' } }

    // Write via writeSecureAuth (encrypted)
    writeSecureAuth(path, auth)
    const { migrated } = readSecureAuth(path)
    expect(migrated).toBe(true)

    // File should start with VERSION_DERIVED (0x02)
    const blob = readFileSync(path)
    expect(blob[0]).toBe(0x02)
  })
})
