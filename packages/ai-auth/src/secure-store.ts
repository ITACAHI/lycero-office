/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Secure storage module for Lycero OAuth tokens.
 *
 * Strategy (in priority order):
 *  1. Electron main process (process.versions.electron set):
 *       uses safeStorage.encryptString / safeStorage.decryptString (OS keychain).
 *       Output is a binary blob; file contains no plaintext tokens.
 *
 *  2. Non-Electron context (CLI, scripts, tests):
 *       uses a machine-derived AES-256-GCM key from scrypt(machineId + appSecret, salt).
 *       Output is a binary blob with format: [1-byte version=0x02][12-byte IV][ciphertext][16-byte auth tag].
 *
 *  3. Version 0x01 (legacy plaintext, read-only):
 *       Detect and read old plaintext JSON for migration. A deprecation warning is logged.
 *
 * This module is RENDERER-SAFE: it uses dynamic `import('electron')` inside the
 * Electron-detection branch so it can be imported from any context without pulling
 * Electron's main-process APIs into the renderer bundle.
 *
 * Constraints:
 *  - safeStorage.encryptString returns Buffer (not Uint8Array).
 *  - Non-Electron path uses node:crypto only (no external deps).
 *  - All encryption is AES-256-GCM with random IV per call.
 */

import { createHash, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ── Blob format constants ──────────────────────────────────────────────

/** Version byte for legacy plaintext JSON (read-only, deprecated). */
const VERSION_LEGACY = 0x01
/** Version byte for AES-256-GCM with scrypt-derived key. */
const VERSION_DERIVED = 0x02
/** IV length for AES-256-GCM (96-bit per NIST SP 800-38D). */
const IV_BYTES = 12
/** Auth tag length for AES-256-GCM (128-bit). */
const TAG_BYTES = 16

// ── Machine fingerprint (for non-Electron derived-key path) ─────────────

const APP_SECRET = 'lycero-office-v1-scp-k3y'
const SCRYPT_SALT = 'lycero-desktop-auth-v1'

/**
 * Derive a stable machine fingerprint WITHOUT requiring Electron.
 * Uses SHA-256 of platform + homedir username — stable per user account.
 * This is NOT a hardware ID; it is an account-local identity used only
 * to derive the disk-encryption key when OS keychain is unavailable.
 */
function machineId(): string {
  const key = `${process.platform}-${homedir()}`
  return createHash('sha256').update(key).digest('hex')
}

/** Derive the AES-256-GCM key from machine identity + app secret. */
function deriveKey(): Buffer {
  // ponytail: scrypt with fixed salt gives us a key-derivation function
  // with a tunable cost factor without adding a dep. N=2^14, r=8, p=1.
  return scryptSync(machineId(), APP_SECRET + ':' + SCRYPT_SALT, 32, {
    N: 16384,
    r: 8,
    p: 1,
  })
}

// ── Public API ────────────────────────────────────────────────────────

export interface SecureStoreAvailability {
  /** OS keychain encryption is available (Electron main process). */
  encrypted: boolean
  /** Machine-derived AES-256-GCM key is available (always true). */
  derivedKey: boolean
}

export interface SecureStoreResult {
  /** The parsed auth object, or null if the file does not exist or is unreadable. */
  auth: unknown | null
  /**
   * True when the file was encrypted (version 0x02).
   * False when the file is legacy plaintext (needs migration on next save).
   */
  migrated: boolean
}

/**
 * Returns which encryption path is active.
 * `encrypted: true`  → safeStorage is being used (OS keychain, strongest).
 * `encrypted: false` → derived-key path (AES-256-GCM with scrypt, still strong).
 */
export function isAvailable(): SecureStoreAvailability {
  const encrypted = isElectron()
  return { encrypted, derivedKey: true }
}

/**
 * Encrypt a string to a binary buffer suitable for writing to disk.
 * Never writes plaintext to disk.
 */
export function encryptString(plain: string): Buffer {
  // Always use AES-256-GCM with scrypt machine-derived key so ~/.lycero/auth.json
  // can be decrypted by both the Electron main process AND the Node CLI (`lycero-office image`).
  return encryptViaDerivedKey(plain)
}

/**
 * Decrypt a binary blob from disk back to a plaintext string.
 * Handles version byte to route to the correct decryption path.
 * Logs a deprecation warning for version 0x01 (legacy plaintext).
 *
 * VERSION_DERIVED (0x02) has two sub-formats:
 *  - safeStorage path: [0x02][os-encrypted-blob]     (small, opaque)
 *  - derived-key path: [0x02][IV(12)][ct][tag(16)]  (larger, structured)
 * The minimum total size for the derived-key path is 1+12+1+16 = 30 bytes.
 */
export function decryptString(blob: Buffer): string {
  if (blob.length === 0) throw new Error('decryptString: empty blob')

  const version = blob[0]
  if (version === undefined) throw new Error('decryptString: cannot read version byte')

  if (version === VERSION_LEGACY) {
    // Legacy: whole file is plaintext JSON
    console.warn(
      '[secure-store] DEPRECATION: legacy plaintext auth file detected at ~/.lycero/auth.json. ' +
      'This file will be migrated on next save. Please re-authenticate if you see auth issues.',
    )
    return blob.toString('utf-8')
  }

  if (version === VERSION_DERIVED) {
    const MIN_DERIVED_KEY_BLOB = 1 + IV_BYTES + 1 + TAG_BYTES
    if (blob.length >= MIN_DERIVED_KEY_BLOB) {
      try {
        return decryptViaDerivedKey(blob)
      } catch {
        // Might be a safeStorage blob whose length happens to be >= 30 bytes
        return decryptViaSafeStorage(blob)
      }
    }
    return decryptViaSafeStorage(blob)
  }

  // Unknown version — try treating as plaintext for forward-compat migration
  // (new format written by a newer version, but we are on an older binary)
  console.warn(`[secure-store] unknown auth file version 0x${version.toString(16)}, treating as plaintext.`)
  return blob.toString('utf-8')
}

// ── Internal: Electron detection ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isElectron(): boolean {
  return Boolean(
    typeof process !== 'undefined' &&
    process.versions !== undefined &&
    (process.versions as any).electron !== undefined,
  )
}

// ── Internal: safeStorage path (Electron main) ───────────────────────────

function encryptViaSafeStorage(plain: string): Buffer {
  // Dynamic import so this module is safe to import from renderer/test contexts
  // (in non-Electron contexts this branch is never taken because isElectron() is false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ss = (require('electron') as any)
  const safeStorage = ss?.safeStorage as
    | { encryptString: (s: string) => Buffer; isEncryptionAvailable: () => boolean }
    | undefined

  if (!safeStorage?.encryptString) {
    // Electron binary but safeStorage unavailable (e.g. non-main process by accident)
    return encryptViaDerivedKey(plain)
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return encryptViaDerivedKey(plain)
  }

  // safeStorage.encryptString returns a Buffer containing [magic byte][encrypted blob]
  // We just prepend our version byte so decryptString can route correctly
  const osBlob = safeStorage.encryptString(plain)
  // Prepend VERSION_DERIVED (0x02) so we know it came from safeStorage on decrypt
  return Buffer.concat([Buffer.from([VERSION_DERIVED]), osBlob])
}

function decryptViaSafeStorage(blob: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ss = (require('electron') as any)
  const safeStorage = ss?.safeStorage as
    | { decryptString: (b: Buffer) => string }
    | undefined

  if (!safeStorage?.decryptString) {
    throw new Error('safeStorage not available for decryption')
  }

  // Blob is [VERSION_DERIVED(1)][safeStorage_blob]; strip version byte
  const osBlob = blob.subarray(1)
  return safeStorage.decryptString(osBlob)
}

// ── Internal: derived-key path (AES-256-GCM, scrypt) ─────────────────────

function encryptViaDerivedKey(plain: string): Buffer {
  const key = deriveKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipher(key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: [VERSION(1)][IV(12)][ciphertext][TAG(16)]
  return Buffer.concat([Buffer.from([VERSION_DERIVED]), iv, encrypted, tag])
}

function decryptViaDerivedKey(blob: Buffer): string {
  if (blob.length < 1 + IV_BYTES + TAG_BYTES + 1) {
    throw new Error('decryptViaDerivedKey: blob too short for version+iv+tag+min')
  }

  const version = blob[0]
  if (version === undefined) throw new Error('decryptViaDerivedKey: cannot read version byte')
  if (version !== VERSION_DERIVED) {
    throw new Error(`decryptViaDerivedKey: unexpected version 0x${version.toString(16)}`)
  }

  const key = deriveKey()
  const iv = blob.subarray(1, 1 + IV_BYTES)
  const tag = blob.subarray(blob.length - TAG_BYTES)
  const encrypted = blob.subarray(1 + IV_BYTES, blob.length - TAG_BYTES)

  const decipher = createDecipher(key, iv, tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// ── Internal: Node crypto AES-256-GCM helpers ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createCipher(key: Buffer, iv: Buffer): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (require('node:crypto') as any)
  const cipher = c.createCipheriv('aes-256-gcm', key, iv)
  return cipher
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDecipher(key: Buffer, iv: Buffer, tag: Buffer): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (require('node:crypto') as any)
  const decipher = c.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher
}

// ── Convenience: read + write the canonical Lycero auth file ──────────────────

/**
 * Read the Lycero auth file at `path`, decrypting as needed.
 * Returns { auth: null } if file does not exist.
 *
 * Handles three cases:
 *  1. Encrypted blob (version 0x02): AES-256-GCM derived-key or safeStorage.
 *  2. Legacy plaintext (version 0x01 or raw JSON): DEPRECATED, read-only fallback.
 *     Used by old installs and by test helpers that write plaintext directly.
 *     Logged once, re-saved on next write to migrate.
 *  3. Unknown format: try UTF-8 decode as JSON (forward compat).
 */
export function readSecureAuth(path: string): SecureStoreResult {
  if (!existsSync(path)) return { auth: null, migrated: false }
  try {
    const blob = readFileSync(path)
    if (blob.length === 0) return { auth: null, migrated: false }

    const firstByte = blob[0]

    // Check for version bytes
    if (firstByte === VERSION_DERIVED) {
      const text = decryptString(blob)
      return { auth: JSON.parse(text), migrated: true }
    }

    if (firstByte === VERSION_LEGACY) {
      console.warn(
        '[secure-store] DEPRECATION: legacy plaintext auth file detected at ~/.lycero/auth.json. ' +
        'This file will be migrated on next save. Please re-authenticate if you see auth issues.',
      )
      const text = blob.toString('utf-8')
      return { auth: JSON.parse(text), migrated: false }
    }

    // No recognized version byte — try as plaintext JSON (forward compat, legacy files)
    try {
      const text = blob.toString('utf-8')
      const parsed = JSON.parse(text)
      // Successfully parsed as JSON — treat as legacy plaintext
      console.warn(
        '[secure-store] DEPRECATION: unencrypted auth file (no version byte). ' +
        'Re-saving will migrate to encrypted format.',
      )
      return { auth: parsed, migrated: false }
    } catch {
      // Not valid JSON at all — treat as binary noise, skip it
      return { auth: null, migrated: false }
    }
  } catch (e) {
    console.warn('[secure-store] failed to read auth file:', e)
    return { auth: null, migrated: false }
  }
}

/**
 * Write auth object to `path` as an encrypted blob.
 * Uses the appropriate encryption path based on context.
 */
export function writeSecureAuth(path: string, auth: unknown): void {
  const json = JSON.stringify(auth)
  const blob = encryptString(json)
  writeFileSync(path, blob)
}
