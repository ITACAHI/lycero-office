/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Lycero Office's own identity for the AI gateway.
 *
 * Token source priority (read order):
 *  1. userData/lycero/session.json  — encrypted desktop session (from bridge).
 *     This is the PRIMARY source. Try to decrypt with safeStorage first.
 *  2. ~/.lycero/auth.json           — legacy plaintext (DEPRECATED, read-only fallback).
 *     ai-auth now writes encrypted, but old files may still exist.
 *  3. ~/.lycero-office/auth.json    — own-key store (plaintext JSON, API key only).
 *
 * Writes go ONLY to ~/.lycero-office/auth.json (own-key store).
 * The desktop session is owned exclusively by the bridge.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, unwatchFile, watchFile, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { asRecord } from './shared'

/** Progress event for the browser login flow. */
export interface GskLoginProgress {
  phase: 'url' | 'success' | 'error'
  url?: string
  expiresInSec?: number
  /** 'network' | 'expired' | raw error text */
  error?: string
}

export type LyceroLoginProgress = GskLoginProgress

function baseUrl(): string {
  return (process.env.LYCERO_BASE_URL || process.env.LYCERO_API_URL || process.env.GSK_BASE_URL || 'https://lycero.com').replace(/\/$/, '')
}

function resolveHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || homedir()
}

function hasAuthDirOverride(): boolean {
  return Boolean(process.env.LYCERO_AUTH_DIR?.trim() || process.env.GENOFFICE_AUTH_DIR?.trim())
}

/** Override dir via LYCERO_AUTH_DIR (test isolation). */
export function lyceroAuthPath(): string {
  const overrideDir =
    process.env.LYCERO_AUTH_DIR?.trim() || process.env.GENOFFICE_AUTH_DIR?.trim()
  return join(overrideDir || join(resolveHomeDir(), '.lycero-office'), 'auth.json')
}

export interface LyceroAuth {
  apiKey: string
  keyId?: string
  accessToken?: string
}

let cachedAuth: LyceroAuth | null | undefined
const rejectedKeys = new Set<string>()

export function isGskKeyRejected(key: string): boolean {
  return Boolean(key && rejectedKeys.has(key))
}

export function isExpiredJwt(token: string): boolean {
  if (!token || !token.startsWith('eyJ')) return false
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return false
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    if (typeof payload?.exp === 'number' && payload.exp > 0) {
      return payload.exp * 1000 < Date.now() - 30_000
    }
  } catch {
    /* ignore */
  }
  return false
}

function isUsableToken(token: unknown): token is string {
  return (
    typeof token === 'string' &&
    token.length > 0 &&
    !rejectedKeys.has(token) &&
    !isExpiredJwt(token)
  )
}

function readAuthFile(): LyceroAuth | null {
  if (isUsableToken(process.env.LYCERO_API_KEY)) {
    return { apiKey: process.env.LYCERO_API_KEY }
  }

  if (!hasAuthDirOverride()) {
    // ── 1. Try userData/lycero/session.json (encrypted desktop session) ────────
    try {
      let userDataDir = ''
      if (process.versions.electron) {
        try {
          const electron = createRequire(import.meta.url)('electron')
          userDataDir = electron.app?.getPath?.('userData') ?? ''
        } catch {}
      }
      if (!userDataDir) {
        const appData =
          process.env.APPDATA ||
          (process.platform === 'darwin'
            ? join(resolveHomeDir(), 'Library', 'Application Support')
            : join(resolveHomeDir(), '.config'))
        for (const folder of ['Lycero Office', 'lycero-office']) {
          const candidate = join(appData, folder)
          if (existsSync(join(candidate, 'lycero', 'session.json'))) {
            userDataDir = candidate
            break
          }
        }
      }
      if (userDataDir) {
        const sessionFile = join(userDataDir, 'lycero', 'session.json')
        if (existsSync(sessionFile)) {
          const rawBuf = readFileSync(sessionFile)
          let jsonStr = ''
          try {
            const electron = createRequire(import.meta.url)('electron')
            if (electron.safeStorage?.isEncryptionAvailable?.()) {
              jsonStr = electron.safeStorage.decryptString(rawBuf)
            } else {
              jsonStr = rawBuf.toString('utf-8')
            }
          } catch {
            jsonStr = rawBuf.toString('utf-8')
          }
          const session = JSON.parse(jsonStr)
          if (isUsableToken(session?.token)) {
            return { apiKey: session.token, accessToken: session.token }
          }
        }
      }
    } catch {
      /* ignore */
    }

    // ── 2. Try ~/.lycero/auth.json (legacy plaintext, DEPRECATED) ─────────────
    // DEPRECATION: this path exists for migration only. ai-auth now writes encrypted.
    try {
      const hubAuthPath = join(resolveHomeDir(), '.lycero', 'auth.json')
      if (existsSync(hubAuthPath)) {
        console.warn(
          '[lycero-auth/ai-search] DEPRECATION: reading legacy ~/.lycero/auth.json. ' +
          'Re-authenticate to migrate to the encrypted desktop session.',
        )
        const parsed = JSON.parse(readFileSync(hubAuthPath, 'utf-8'))
        if (isUsableToken(parsed?.tokens?.accessToken)) {
          return { apiKey: parsed.tokens.accessToken, accessToken: parsed.tokens.accessToken }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // ── 3. Fall back to ~/.lycero-office/auth.json (or $LYCERO_AUTH_DIR/auth.json) ──
  try {
    const raw = asRecord(JSON.parse(readFileSync(lyceroAuthPath(), 'utf-8')))
    if (!isUsableToken(raw.api_key)) return null
    return {
      apiKey: raw.api_key,
      ...(typeof raw.key_id === 'string' && raw.key_id ? { keyId: raw.key_id } : {}),
      ...(typeof raw.access_token === 'string' && raw.access_token
        ? { accessToken: raw.access_token }
        : {}),
    }
  } catch {
    return null
  }
}

export function loadLyceroAuth(): LyceroAuth | null {
  if (cachedAuth === undefined || cachedAuth === null) cachedAuth = readAuthFile()
  return cachedAuth
}

/** The Lycero Office-named API key; '' when not signed in. Cached (invalidated by login/logout). */
export function lyceroApiKey(): string {
  return loadLyceroAuth()?.apiKey ?? ''
}

export interface LyceroUserInfo {
  email?: string
  plan?: string
  fullName?: string
}

export function getLyceroUserInfo(): LyceroUserInfo | null {
  if (hasAuthDirOverride()) {
    try {
      const path = lyceroAuthPath()
      if (existsSync(path)) {
        const parsed = JSON.parse(readFileSync(path, 'utf-8'))
        if (parsed?.user?.email) {
          return {
            email: parsed.user.email,
            fullName: parsed.user.fullName || parsed.user.name,
            plan: parsed.license?.tier || parsed.user.plan || 'free',
          }
        }
      }
    } catch {}
    return null
  }

  // ── 1. Try userData/lycero/session.json (encrypted desktop session) ────────
  try {
    let userDataDir = ''
    if (process.versions.electron) {
      try {
        const electron = createRequire(import.meta.url)('electron')
        userDataDir = electron.app?.getPath?.('userData') ?? ''
      } catch {}
    }
    if (!userDataDir) {
      const appData = process.env.APPDATA ||
        (process.platform === 'darwin'
          ? join(resolveHomeDir(), 'Library', 'Application Support')
          : join(resolveHomeDir(), '.config'))
      userDataDir = join(appData, 'lycero-office')
    }
    if (userDataDir) {
      const sessionFile = join(userDataDir, 'lycero', 'session.json')
      if (existsSync(sessionFile)) {
        const rawBuf = readFileSync(sessionFile)
        let jsonStr = ''
        try {
          const electron = createRequire(import.meta.url)('electron')
          if (electron.safeStorage?.isEncryptionAvailable?.()) {
            jsonStr = electron.safeStorage.decryptString(rawBuf)
          } else {
            jsonStr = rawBuf.toString('utf-8')
          }
        } catch {
          jsonStr = rawBuf.toString('utf-8')
        }
        const session = JSON.parse(jsonStr)
        if (session?.token || session?.user?.email) {
          return {
            email: session.user?.email || session.user?.name || 'Lycero User',
            fullName: session.user?.fullName || session.user?.name,
            plan: session.license?.tier || session.user?.plan || 'free',
          }
        }
      }
    }
  } catch {}

  // ── 2. Try ~/.lycero/auth.json (legacy plaintext, DEPRECATED) ─────────────
  try {
    const hubAuthPath = join(resolveHomeDir(), '.lycero', 'auth.json')
    if (existsSync(hubAuthPath)) {
      const parsed = JSON.parse(readFileSync(hubAuthPath, 'utf-8'))
      if (parsed?.user?.email) {
        return {
          email: parsed.user.email,
          fullName: parsed.user.fullName || parsed.user.name,
          plan: parsed.license?.tier || 'free',
        }
      }
    }
  } catch {}
  return null
}

function saveAuth(auth: LyceroAuth): void {
  const path = lyceroAuthPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    JSON.stringify(
      { api_key: auth.apiKey, key_id: auth.keyId, access_token: auth.accessToken },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  )
  cachedAuth = auth
}

function clearAuth(): void {
  try {
    // Clear own-key store
    if (existsSync(lyceroAuthPath())) unlinkSync(lyceroAuthPath())
  } catch {
    /* local sign-out must not throw */
  }
  cachedAuth = null
}

/** Also clear the desktop session file (called by logout IPC in the bridge). */
export function clearDesktopSession(): void {
  if (hasAuthDirOverride()) return
  try {
    let userDataDir = ''
    if (process.versions.electron) {
      try {
        const electron = createRequire(import.meta.url)('electron')
        userDataDir = electron.app?.getPath?.('userData') ?? ''
      } catch {}
    }
    if (userDataDir) {
      const sessionFile = join(userDataDir, 'lycero', 'session.json')
      if (existsSync(sessionFile)) unlinkSync(sessionFile)
    }
  } catch {
    /* ignore */
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────

class LoginFlowError extends Error {
  constructor(
    /** matches GskLoginProgress.error conventions */
    public reason: 'network' | 'expired' | string,
  ) {
    super(reason)
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('login cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
// ----- Device-code login ----------------------------------------------------------------------
// Phase 3 OAuth Unification: device-code login is now owned exclusively by the
// bridge (@lycero/ai-auth). This stub prevents breaking alias exports and old callers.

/**
 * @deprecated Use Hub login via IPC instead. Device-code login is now handled by the bridge.
 * This stub exists so that alias exports and old callers fail fast with a clear signal.
 */
export function startLyceroLogin(_onEvent?: (progress: GskLoginProgress) => void): boolean {
  console.warn('[lycero-auth] startLyceroLogin is deprecated - use Hub login via IPC.')
  return false
}

/**
 * Fire-and-forget login helper for standalone mode. In the shell app, 'ai:gsk-login'
 * is handled directly by startLyceroOAuthFlow (PKCE + deep link).
 */
export function ensureLyceroLogin(openUrl: (url: string) => void): void {
  const baseUrl = (
    process.env.LYCERO_API_URL ||
    process.env.LYCERO_GATEWAY_URL ||
    'https://lycero.com'
  ).replace(/\/(?:api\/v1\/office)?\/?$/, '')
  openUrl(`${baseUrl}/login`)
}

/** Always false since device-code login is now via IPC. Kept for alias compat. */
export function lyceroLoginInFlight(): boolean {
  return false
}

/**
 * Removes local Lycero Office credentials. The shared Lycero Hub login
 * is untouched — terminal tools and other apps keep working.
 */
export async function lyceroLogout(): Promise<void> {
  clearAuth()
}

/** Test hook: drop the auth cache. */
export function resetLyceroAuthCache(): void {
  cachedAuth = undefined
  rejectedKeys.clear()
}

export function reloadLyceroAuth(): LyceroAuth | null {
  cachedAuth = readAuthFile()
  return cachedAuth
}
export const reloadGenofficeAuth = reloadLyceroAuth

export function watchGskApiKey(onChange: (key: string) => void, intervalMs = 2000): () => void {
  let last = lyceroApiKey()
  const check = (): void => {
    reloadLyceroAuth()
    const key = lyceroApiKey()
    if (key === last) return
    last = key
    onChange(key)
  }
  const files = hasAuthDirOverride()
    ? [lyceroAuthPath()]
    : [lyceroAuthPath(), join(resolveHomeDir(), '.lycero', 'auth.json')]
  for (const f of files) watchFile(f, { persistent: false, interval: intervalMs }, check)
  return () => {
    for (const f of files) unwatchFile(f, check)
  }
}
export const watchLycApiKey = watchGskApiKey
export const watchLyceroApiKey = watchGskApiKey

/**
 * Checks whether the current signed-in user has an active Pro or Enterprise tier license.
 * Users on Free tier are restricted strictly to Lycero Central Gateway and cannot use custom BYOK LLMs.
 */
export function isLyceroProUser(): boolean {
  if (hasAuthDirOverride()) {
    try {
      const path = lyceroAuthPath()
      if (existsSync(path)) {
        const parsed = JSON.parse(readFileSync(path, 'utf-8'))
        const plan = String(parsed?.license?.tier || parsed?.user?.plan || parsed?.plan || '').toLowerCase()
        if (plan.includes('pro') || plan.includes('enterprise') || plan.includes('vip') || plan.includes('unlimited')) {
          return true
        }
      }
    } catch {
      /* ignore */
    }
    return false
  }

  // 1. Check userData/lycero/session.json (encrypted desktop session)
  try {
    let userDataDir = ''
    if (process.versions.electron) {
      try {
        const electron = createRequire(import.meta.url)('electron')
        userDataDir = electron.app?.getPath?.('userData') ?? ''
      } catch {}
    }
    if (!userDataDir) {
      const appData = process.env.APPDATA ||
        (process.platform === 'darwin'
          ? join(resolveHomeDir(), 'Library', 'Application Support')
          : join(resolveHomeDir(), '.config'))
      userDataDir = join(appData, 'lycero-office')
    }
    if (userDataDir) {
      const sessionFile = join(userDataDir, 'lycero', 'session.json')
      if (existsSync(sessionFile)) {
        const rawBuf = readFileSync(sessionFile)
        let jsonStr = ''
        try {
          const electron = createRequire(import.meta.url)('electron')
          if (electron.safeStorage?.isEncryptionAvailable?.()) {
            jsonStr = electron.safeStorage.decryptString(rawBuf)
          } else {
            jsonStr = rawBuf.toString('utf-8')
          }
        } catch {
          jsonStr = rawBuf.toString('utf-8')
        }
        const session = JSON.parse(jsonStr)
        const tier = String(session?.license?.tier || session?.user?.plan || '').toLowerCase()
        if (tier.includes('pro') || tier.includes('enterprise') || tier.includes('vip') || tier.includes('unlimited')) {
          return true
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 2. Check ~/.lycero/auth.json (legacy plaintext, DEPRECATED)
  try {
    const hubAuthPath = join(resolveHomeDir(), '.lycero', 'auth.json')
    if (existsSync(hubAuthPath)) {
      const parsed = JSON.parse(readFileSync(hubAuthPath, 'utf-8'))
      const plan = String(parsed?.user?.plan || parsed?.plan || '').toLowerCase()
      if (plan.includes('pro') || plan.includes('enterprise') || plan.includes('vip') || plan.includes('unlimited')) {
        return true
      }
    }
  } catch {
    /* ignore */
  }

  return false
}

/**
 * Localized error message when a Free tier account attempts to access custom BYOK providers.
 */
export function proRequiredErrorMessage(lang?: string): string {
  const normalized = (lang || '').toLowerCase()
  if (normalized.startsWith('vi')) {
    return 'Chỉ tài khoản Lycero Pro hoặc Enterprise mới được sử dụng mô hình LLM riêng (BYOK). Tài khoản Miễn phí (Free) sử dụng mô hình mặc định từ Lycero Central Gateway.'
  }
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) {
    return '僅 Lycero Pro 或 Enterprise 帳戶可使用自訂 LLM 模型 (BYOK)。免費帳戶使用 Lycero Central Gateway 提供的預設模型。'
  }
  if (normalized.startsWith('zh')) {
    return '仅 Lycero Pro 或 Enterprise 账户可使用自定义 LLM 模型 (BYOK)。免费账户使用 Lycero Central Gateway 提供的默认模型。'
  }
  if (normalized.startsWith('ja')) {
    return 'カスタム LLM モデル (BYOK) は Lycero Pro または Enterprise アカウントでのみ利用可能です。無料アカウントは Lycero Central Gateway のデフォルトモデルを使用します。'
  }
  return 'Custom LLM models (BYOK) require a Lycero Pro or Enterprise account. Free accounts use default models provided by Lycero Central Gateway.'
}

// Backward-compatible aliases (for places that still reference the old names)
export { lyceroApiKey as genofficeApiKey, loadLyceroAuth as loadGenofficeAuth, startLyceroLogin as startGenofficeLogin, lyceroLoginInFlight as genofficeLoginInFlight, ensureLyceroLogin as ensureGenofficeLogin, lyceroLogout as genofficeLogout, resetLyceroAuthCache as resetGenofficeAuthCache, lyceroAuthPath as genofficeAuthPath }

export type GskRecoveryOutcome = 'reminted' | 'login_started' | 'login_required'

let loginOpener: ((url: string) => void) | null = null

export function setGenofficeLoginOpener(opener: ((url: string) => void) | null): void {
  loginOpener = opener
}
export const setLyceroLoginOpener = setGenofficeLoginOpener

export function isAllowedAuthUrl(raw: string, origin: string): URL | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null
    const endpointHost = new URL(origin).hostname
    const registrable = endpointHost.replace(/^www\./, '')
    const flatHost =
      endpointHost.startsWith('[') || /^[\d.]+$/.test(endpointHost) || !registrable.includes('.')
    if (flatHost) return url.hostname === endpointHost ? url : null
    if (url.hostname !== registrable && !url.hostname.endsWith(`.${registrable}`)) return null
    return url
  } catch {
    return null
  }
}

export function invalidateGenofficeKey(key: string): boolean {
  if (!key) return false
  const current = reloadLyceroAuth()
  rejectedKeys.add(key)
  cachedAuth = undefined
  if (current?.apiKey === key) {
    try {
      const path = lyceroAuthPath()
      if (existsSync(path)) {
        const raw = asRecord(JSON.parse(readFileSync(path, 'utf-8')))
        if (raw.api_key === key) unlinkSync(path)
      }
    } catch {
      /* ignore */
    }
    return true
  }
  return false
}
export const invalidateLyceroKey = invalidateGenofficeKey

export async function recoverFromRejectedGskKey(
  key: string,
  options: { allowLogin?: boolean } = {},
): Promise<GskRecoveryOutcome> {
  invalidateGenofficeKey(key)
  if (options.allowLogin !== false && loginOpener) {
    ensureLyceroLogin(loginOpener)
    return 'login_started'
  }
  return 'login_required'
}

export class GskAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GskAuthError'
  }
}

export function isGskUnauthorizedText(text: unknown): boolean {
  return /\bHTTP 401\b|\b401 Unauthorized\b|\b401\b|unauthorized|invalid[ _-]?api[ _-]?key/i.test(String(text ?? ''))
}

export function noteGskKeyRejected(
  key: string,
  options: { allowLogin?: boolean } = {},
): Promise<GskRecoveryOutcome> {
  if (key) rejectedKeys.add(key)
  return recoverFromRejectedGskKey(key, options)
}

export function resetGskRejectedKeys(): void {
  rejectedKeys.clear()
  cachedAuth = undefined
}

export function noteGskCallFailure(
  keyOrError: unknown,
  errorOrOptions?: unknown,
): boolean {
  const isTwoArg =
    typeof keyOrError === 'string' &&
    errorOrOptions !== undefined &&
    !(
      typeof errorOrOptions === 'object' &&
      errorOrOptions !== null &&
      !(errorOrOptions instanceof Error) &&
      'allowLogin' in errorOrOptions
    )
  const key = isTwoArg ? keyOrError : lyceroApiKey()
  const err = isTwoArg ? errorOrOptions : keyOrError
  if (!key) return false
  const text = err instanceof Error ? err.message : String(err ?? '')
  if (!isGskUnauthorizedText(text)) return false
  rejectedKeys.add(key)
  invalidateGenofficeKey(key)
  return true
}
export const noteLyceroCallFailure = noteGskCallFailure
export const noteLycCallFailure = noteGskCallFailure

export function genofficeProxyFallbackPreferred(): boolean {
  return false
}
