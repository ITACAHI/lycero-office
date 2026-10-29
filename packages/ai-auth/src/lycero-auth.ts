/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Lycero OAuth authentication module - server/main-process only.
 * This file imports Node.js built-ins (node:fs, node:path, etc.)
 * and must NOT be imported from renderer code.
 *
 * Use `@lycero/ai-auth` (the barrel index) for types only.
 * Use `@lycero/ai-auth/main` for runtime functions from main-process code.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { readSecureAuth, writeSecureAuth } from './secure-store'

// Re-export all types/constants from the renderer-safe types file
export {
  LYCERO_BASE_URL,
  LYCERO_API_BASE,
  APP_TYPE,
  HTTP_TIMEOUT_MS,
  type LyceroUser,
  type LyceroAuthTokens,
  type LyceroAuth,
  type TokenResponse,
  type LyceroLoginProgress,
  type EmailLoginResponse,
  type HubQuota,
  type HubModel,
  type HubModels,
  type ApiTokenResponse,
  type ApiLyceroUser,
  mapApiUser,
} from './lycero-auth-types'

// Re-export work bundles for bundle-store (main-process only)
export {
  WORK_BUNDLES,
  findWorkBundle,
  findWorkBundleByKey,
  ARCHETYPES,
  findArchetype,
  findArchetypeByKey,
} from './work-bundles'
export type { Archetype, WorkBundle } from './work-bundles'

import {
  LYCERO_API_BASE,
  APP_TYPE,
  HTTP_TIMEOUT_MS,
  type LyceroAuth,
  type LyceroUser,
  type TokenResponse,
  type LyceroLoginProgress,
  type ApiTokenResponse,
  type ApiLyceroUser,
  mapApiUser,
} from './lycero-auth-types'

// ── Constants (main-only, require Node) ─────────────────────────────

/** Derive LYCERO_BASE_URL — only called at runtime from main process */
export function getLyceroBaseUrl(): string {
  return (
    process.env.LYCERO_API_URL ||
    process.env.LYCERO_GATEWAY_URL ||
    'https://lycero.com'
  ).replace(/\/(?:api\/v1\/office)?\/?$/, '')
}

function getLyceroApiBase(): string {
  return `${getLyceroBaseUrl()}/api/v1/office`
}

// Storage paths
let _lyceroAuthDir: string | null = null

function lyceroAuthDir(): string {
  if (_lyceroAuthDir !== null) return _lyceroAuthDir
  // ponytail: use process.env for test isolation; default to ~/.lycero (shared with ai-search)
  _lyceroAuthDir = process.env.LYCERO_AUTH_DIR || join(homedir(), '.lycero')
  return _lyceroAuthDir
}

export function lyceroAuthPath(): string {
  return join(lyceroAuthDir(), 'auth.json')
}

// ── Fetch resolution ────────────────────────────────────────────────

let cachedFetch: typeof fetch | undefined

function resolveFetch(): typeof fetch {
  if (cachedFetch) return cachedFetch
  let impl: typeof fetch = (...args) => fetch(...args)
  if (process.versions.electron) {
    try {
      const require = createRequire(import.meta.url)
      const { net } = require('electron') as { net?: { fetch?: typeof fetch } }
      if (net?.fetch) impl = net.fetch.bind(net)
    } catch {
      /* non-main context: keep global fetch */
    }
  }
  cachedFetch = impl
  return impl
}

// ── HTTP helpers ────────────────────────────────────────────────────

async function httpJson<T>(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<{ resp: Response; json: T }> {
  const fetchImpl = resolveFetch()
  let resp: Response | undefined
  try {
    resp = await fetchImpl(url, {
      ...init,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(HTTP_TIMEOUT_MS)])
        : AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') {
      throw new Error('Network timeout')
    }
    throw e
  }
  let json: T = {} as T
  try {
    json = await resp.json() as T
  } catch {
    /* non-JSON body; status checks below carry the error */
  }
  return { resp, json }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Login cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// ── Auth storage ────────────────────────────────────────────────────

let cachedAuth: LyceroAuth | null | undefined

function readAuthFile(): LyceroAuth | null {
  const path = lyceroAuthPath()
  const { auth, migrated } = readSecureAuth(path)
  if (!auth) return null
  const raw = auth as Record<string, unknown>
  if (!raw.tokens || !(raw.tokens as Record<string, unknown>).accessToken) return null

  if (!migrated) {
    // Legacy plaintext file detected. Log once and re-save to migrate.
    console.warn(
      '[lycero-auth] DEPRECATION: legacy plaintext auth file at ~/.lycero/auth.json. ' +
      'Migrating to encrypted format on next save.',
    )
  }

  return raw as unknown as LyceroAuth
}

export function loadLyceroAuth(): LyceroAuth | null {
  if (cachedAuth === undefined || cachedAuth === null) cachedAuth = readAuthFile()
  return cachedAuth
}

function saveAuth(auth: LyceroAuth): void {
  const path = lyceroAuthPath()
  mkdirSync(dirname(path), { recursive: true })
  writeSecureAuth(path, auth)
  cachedAuth = auth
}

/** Persist a new auth payload (used by the refresh-token rotation). */
export const saveLyceroAuth = saveAuth

function clearAuth(): void {
  try {
    const path = lyceroAuthPath()
    if (existsSync(path)) unlinkSync(path)
  } catch {
    /* local sign-out must not throw */
  }
  cachedAuth = null
}

// ── OAuth state (CSRF protection) ─────────────────────────────────────

export interface OAuthState {
  state: string
  deviceCode?: string
  createdAt: number
  /** PKCE code_verifier — only present for Authorization Code Flow */
  codeVerifier?: string
}

function lyceroOAuthStatePath(): string {
  return join(lyceroAuthDir(), 'oauth-state.json')
}

/** Persist OAuth state for CSRF verification. Exported for testing. */
export function saveOAuthState(st: OAuthState): void {
  const path = lyceroOAuthStatePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(st, null, 2) + '\n', { mode: 0o600 })
}

function readOAuthState(): OAuthState | null {
  try {
    const path = lyceroOAuthStatePath()
    if (!existsSync(path)) return null
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as OAuthState
    // State file older than 10 minutes is stale
    if (Date.now() - raw.createdAt > 10 * 60 * 1000) {
      clearOAuthState()
      return null
    }
    return raw
  } catch {
    return null
  }
}

function clearOAuthState(): void {
  try {
    const path = lyceroOAuthStatePath()
    if (existsSync(path)) unlinkSync(path)
  } catch {
    /* ignore */
  }
}

/**
 * Verify the OAuth state from a deep-link callback.
 * Returns true if the state matches and the file is cleared.
 * Returns false if state mismatch or file missing.
 *
 * SECURITY NOTE: the state file is ALWAYS cleared after this call, even when
 * the state does not match. This is deliberate (consume-once / one-shot).
 * A failed match means the state is now invalid — a captured stale state cannot
 * be replayed because the file is already gone. Callers must NOT rely on
 * the return value alone for security; the state IS consumed either way.
 */
export function verifyOAuthState(state: string): boolean {
  const stored = readOAuthState()
  if (!stored) return false
  const match = stored.state === state
  clearOAuthState()
  return match
}

/** Test hook: drop the OAuth state file and cancel any pending auth code timer. */
export function resetOAuthStateForTest(): void {
  if (pendingAuthCode?.timeoutId) {
    clearTimeout(pendingAuthCode.timeoutId)
  }
  pendingAuthCode = null
  clearOAuthState()
}

// ── PKCE helpers (RFC 7636) ──────────────────────────────────────────

/** Generate a random code_verifier (43 chars via base64url of 32 random bytes) */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Compute S256 code_challenge from a verifier.
 * RFC 7636: BASE64URL(SHA256(verifier))
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ── Authorization Code Flow ─────────────────────────────────────────

const AUTH_CODE_DEADLINE_MS = 300_000 // 5 phút để người dùng hoàn tất đăng nhập trên trình duyệt

let pendingAuthCode: {
  resolve: (payload: { code: string; state: string }) => void
  reject: (e: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
} | null = null

/**
 * Resolve the pending Auth Code login with the deep-link params.
 * Called by the main-process deep-link handler.
 * Returns true if an active in-memory pending flow was resolved, false otherwise.
 */
export function resolvePendingAuthCode(code: string, state: string): boolean {
  if (pendingAuthCode) {
    _pendingResolve({ code, state })
    clearTimeout(pendingAuthCode.timeoutId)
    pendingAuthCode = null
    return true
  }
  return false
}

/**
 * Complete an OAuth 2.0 PKCE code exchange using the persisted oauth-state.json
 * on disk when no in-memory pendingAuthCode promise is active (e.g. cold start
 * via deep-link or after the sign-in overlay was dismissed).
 */
export async function completeAuthCodeFromDiskState(
  code: string,
  state: string,
): Promise<LyceroAuth | null> {
  const stored = readOAuthState()
  if (!stored || !stored.codeVerifier) {
    clearOAuthState()
    return null
  }
  const match = stored.state === state
  clearOAuthState()
  if (!match) {
    return null
  }
  const tokenResponse = await exchangeCodeForToken(code, stored.codeVerifier, 'lycero://callback')
  const user = tokenResponse.user ?? {
    id: 'unknown',
    name: 'Lycero User',
    email: '',
    avatar: undefined,
    role: undefined,
    persona: undefined,
    subject: undefined,
    grade: undefined,
    schoolName: undefined,
    department: undefined,
    curriculum: undefined,
    teachingStyle: undefined,
    plan: undefined,
    creditsRemaining: undefined,
  }
  const auth: LyceroAuth = {
    tokens: {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresAt:
        typeof tokenResponse.expiresIn === 'number'
          ? Date.now() + tokenResponse.expiresIn * 1000
          : undefined,
    },
    user,
    orgId: undefined,
    archetypeId: undefined,
  }
  saveAuth(auth)
  return auth
}

/**
 * Reject the pending Auth Code login when the OAuth callback returns an error.
 */
export function rejectPendingAuthCode(reason: string): void {
  if (pendingAuthCode) {
    clearTimeout(pendingAuthCode.timeoutId)
    pendingAuthCode = null
    clearOAuthState()
    _pendingReject(new Error(reason || 'access_denied'))
  }
}

/**
 * Start OAuth 2.0 Authorization Code Flow with PKCE.
 *
 * Flow:
 *  1. Generate verifier + challenge
 *  2. Save OAuth state (state + verifier) for CSRF check
 *  3. Open authorize URL in browser
 *  4. Wait for deep-link `lycero-office://callback?code=…&state=…` (60 s)
 *  5. Verify state, exchange code+verifier for token
 *  6. Persist session via saveLyceroAuth()
 *
 * Returns `true` immediately; async flow is driven by `onEvent` callbacks.
 *
 * @param onEvent  Progress callback (url, success, error)
 * @param oauthState  Optional OAuth state string. When provided by the bridge,
 *                   this is used directly (enables deterministic testing). When
 *                   absent, a random UUID is generated.
 */
export function startAuthorizationCodeLogin(
  onEvent?: (progress: LyceroLoginProgress) => void,
  oauthState?: string,
): boolean {
  const emit = onEvent ?? (() => {})

  if (pendingAuthCode?.timeoutId) {
    clearTimeout(pendingAuthCode.timeoutId)
  }

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = oauthState ?? randomUUID()
  const redirectUri = 'lycero://callback'
  const authUrl = `${getLyceroApiBase()}/oauth/authorize` +
    `?client_id=${APP_TYPE}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&response_type=code` +
    `&scope=profile+email+office`

  // Lưu state + verifier để verify khi nhận deep-link callback
  saveOAuthState({ state, createdAt: Date.now(), codeVerifier })

  emit({ phase: 'url', url: authUrl, expiresInSec: AUTH_CODE_DEADLINE_MS / 1000 })

  // Wire pending resolver so deep-link can feed the code+state in.
  // Note: the timeout is set in runAuthCodeFlow, not here (single source of truth).
  pendingAuthCode = {
    resolve: (payload: { code: string; state: string }) => { _pendingResolve(payload) },
    reject: (e: Error) => { _pendingReject(e) },
    timeoutId: undefined as unknown as ReturnType<typeof setTimeout>,
  }

  // Run async flow without blocking — mirrors startLyceroLogin pattern
  void runAuthCodeFlow(codeVerifier, redirectUri, emit)
  return true
}

let _pendingResolve: (v: { code: string; state: string }) => void = () => {}
let _pendingReject: (e: Error) => void = () => {}

async function runAuthCodeFlow(
  codeVerifier: string,
  redirectUri: string,
  emit: (progress: LyceroLoginProgress) => void,
): Promise<void> {
  try {
    let code: string

    if (pendingAuthCode) {
      // Wait for deep-link to call resolvePendingAuthCode.
      // This timer is the SINGLE source of truth for the auth-code deadline.
      // (The old double-timer in startAuthorizationCodeLogin has been removed.)
      const payload = await new Promise<{ code: string; state: string }>((resolve, reject) => {
        _pendingResolve = resolve
        _pendingReject = reject
        pendingAuthCode!.timeoutId = setTimeout(() => {
          pendingAuthCode = null
          reject(new Error('expired'))
        }, AUTH_CODE_DEADLINE_MS)
      })

      // Verify CSRF state
      if (!verifyOAuthState(payload.state)) {
        throw new Error('CSRF state mismatch')
      }
      code = payload.code
    } else {
      throw new Error('No pending auth code flow')
    }

    const tokenResponse = await exchangeCodeForToken(code, codeVerifier, redirectUri)

    const user = tokenResponse.user ?? {
      id: 'unknown',
      name: 'Lycero User',
      email: '',
      avatar: undefined,
      role: undefined,
      persona: undefined,
      subject: undefined,
      grade: undefined,
      schoolName: undefined,
      department: undefined,
      curriculum: undefined,
      teachingStyle: undefined,
      plan: undefined,
      creditsRemaining: undefined,
    }
    const auth: LyceroAuth = {
      tokens: {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt:
          typeof tokenResponse.expiresIn === 'number'
            ? Date.now() + tokenResponse.expiresIn * 1000
            : undefined,
      },
      user,
      orgId: undefined,
      archetypeId: undefined,
    }
    saveAuth(auth)
    emit({ phase: 'success' })
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e)
    const reason = msg === 'expired'
      ? 'expired'
      : msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('Network')
        ? 'network'
        : msg
    emit({ phase: 'error', error: reason })
  }
}

function parseJwtUserFallback(accessToken: string): LyceroUser | undefined {
  try {
    const parts = accessToken.split('.')
    if (parts.length !== 3) return undefined
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8')) as Record<string, unknown>
    const email = typeof payload.email === 'string' ? payload.email : ''
    const id = typeof payload.sub === 'string' ? payload.sub : ''
    if (!id && !email) return undefined
    return {
      id: id || 'unknown',
      name:
        typeof payload.name === 'string' && payload.name
          ? payload.name
          : email
            ? email.split('@')[0]!
            : 'Lycero User',
      email,
      avatar: undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      persona: undefined,
      subject: undefined,
      grade: undefined,
      schoolName: undefined,
      department: undefined,
      curriculum: undefined,
      teachingStyle: undefined,
      plan: undefined,
      creditsRemaining: undefined,
    }
  } catch {
    return undefined
  }
}

/**
 * Exchange authorization code + PKCE verifier for tokens.
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const { resp, json } = await httpJson<{
    access_token: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
    user?: import('./lycero-auth-types').ApiLyceroUser
  }>(`${getLyceroApiBase()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: APP_TYPE,
    }),
  })

  if (!resp.ok) {
    const err = String(json.error || json.error_description || `HTTP ${resp.status}`)
    throw new Error(err)
  }

  const accessToken = String(json.access_token ?? '')
  const user = json.user ? mapApiUser(json.user) : parseJwtUserFallback(accessToken)
  return {
    accessToken,
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    expiresIn: json.expires_in ? Number(json.expires_in) : undefined,
    user,
  }
}

// ponytail: path resolver caches the dir path so repeated calls don't
// re-evaluate the env var. Reset the cache between test cases.
export function resetAuthDirCache(): void {
  _lyceroAuthDir = null
}

// ── Token check ─────────────────────────────────────────────────────

function readDesktopSessionToken(): string {
  if (process.env.LYCERO_AUTH_DIR) return ''
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
          ? join(homedir(), 'Library', 'Application Support')
          : join(homedir(), '.config'))
      userDataDir = join(appData, 'lycero-office')
    }
    if (!userDataDir) return ''
    const sessionFile = join(userDataDir, 'lycero', 'session.json')
    if (!existsSync(sessionFile)) return ''
    const rawBuf = readFileSync(sessionFile)
    let jsonStr = ''
    if (process.versions.electron) {
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
    } else {
      jsonStr = rawBuf.toString('utf-8')
    }
    const raw = JSON.parse(jsonStr)
    return typeof raw?.token === 'string' ? raw.token : ''
  } catch {
    return ''
  }
}

export function hasLyceroAuth(): boolean {
  return Boolean(loadLyceroAuth()?.tokens?.accessToken || readDesktopSessionToken())
}

export function lyceroAccessToken(): string {
  return loadLyceroAuth()?.tokens?.accessToken || readDesktopSessionToken()
}

export function isLyceroProUser(): boolean {
  const auth = loadLyceroAuth()
  const plan = auth?.user?.plan?.toLowerCase() ?? ''
  if (plan.includes('pro') || plan.includes('enterprise') || plan.includes('vip') || plan.includes('unlimited')) {
    return true
  }
  if (process.env.LYCERO_AUTH_DIR) return false
  // Also check Lycero desktop session stored in userData/lycero/session.json
  try {
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support') : join(homedir(), '.config'))
    const sessionFile = join(appData, 'lycero-office', 'lycero', 'session.json')
    if (existsSync(sessionFile)) {
      const raw = JSON.parse(readFileSync(sessionFile, 'utf-8'))
      const tier = String(raw.license?.tier || raw.user?.plan || '').toLowerCase()
      if (tier.includes('pro') || tier.includes('enterprise') || tier.includes('vip') || tier.includes('unlimited')) {
        return true
      }
    }
  } catch {
    /* ignore */
  }
  return false
}

// ── Email/Password Login ─────────────────────────────────────────────

import type { EmailLoginResponse as EmailLoginResponseType } from './lycero-auth-types'

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<EmailLoginResponseType> {
  const { resp, json } = await httpJson<ApiTokenResponse>(
    `${LYCERO_API_BASE}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        client_id: APP_TYPE,
      }),
    },
  )
  if (!resp.ok) {
    const error = String(json.error || json.error_description || 'Login failed')
    throw new Error(error)
  }
  const user = json.user ? mapApiUser(json.user) : {
    id: '',
    name: email,
    email,
    avatar: undefined,
    role: undefined,
    persona: undefined,
    subject: undefined,
    grade: undefined,
    schoolName: undefined,
    department: undefined,
    curriculum: undefined,
    teachingStyle: undefined,
    plan: undefined,
    creditsRemaining: undefined,
  }
  let accessToken = String(json.access_token || (json as unknown as Record<string, unknown>).token || '')
  if (!accessToken) {
    const cookie = resp.headers.get('set-cookie')
    if (cookie) {
      const match = cookie.match(/auth_token=([^;]+)/)
      if (match) accessToken = match[1]!
    }
  }

  const refreshToken = json.refresh_token ? String(json.refresh_token) : undefined
  const orgId = json.org_id ? String(json.org_id) : undefined
  const archetypeId = json.archetype_id ? Number(json.archetype_id) : undefined

  if (accessToken) {
    saveAuth({
      tokens: { accessToken, refreshToken },
      user,
      orgId,
      archetypeId,
    })
  }

  return {
    accessToken,
    refreshToken,
    user,
    orgId,
    archetypeId,
  }
}

// ── Authenticated request helper ─────────────────────────────────────

/**
 * Single in-flight refresh promise so 10 concurrent 401s collapse into one
 * token refresh. ponytail: O(1) refresh, no stampede.
 */
let refreshInFlight: Promise<string | null> | null = null

async function refreshAndGetToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const auth = loadLyceroAuth()
    const refreshToken = auth?.tokens?.refreshToken
    if (!refreshToken) {
      clearAuth()
      return null
    }
    try {
      const next = await refreshAccessToken(refreshToken)
      const current = loadLyceroAuth()
      if (!current) return null
      saveAuth({
        ...current,
        tokens: {
          accessToken: next.accessToken,
          refreshToken: next.refreshToken ?? current.tokens.refreshToken,
          expiresAt:
            typeof next.expiresIn === 'number'
              ? Date.now() + next.expiresIn * 1000
              : current.tokens.expiresAt,
        },
      })
      return next.accessToken
    } catch {
      // refreshAccessToken already cleared auth on failure
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

/**
 * Fetch wrapper that attaches a Bearer token, and on 401 transparently
 * refreshes the token once and retries the request. Returns null when the
 * caller is not signed in or the refresh has failed — callers should treat
 * null as "give up, surface a sign-in prompt".
 *
 * ponytail: keeps the existing per-caller shape (`HubQuota | null`,
 * `HubModels | null`) and pushes all auth-state handling into one place.
 */
async function authedFetch<T>(
  url: string,
  init: RequestInit & { signal?: AbortSignal } = {},
  explicitToken?: string,
): Promise<{ resp: Response; json: T; refreshed: boolean } | null> {
  let accessToken = explicitToken || lyceroAccessToken()
  if (!accessToken) return null
  const callOnce = async (): Promise<{ resp: Response; json: T; refreshed: boolean }> => {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
    headers.Authorization = `Bearer ${accessToken}`
    const { resp, json } = await httpJson<T>(url, {
      ...init,
      headers,
    })
    return { resp, json, refreshed: false }
  }

  let result = await callOnce()
  if (result.resp.status !== 401) return result

  // token expired — try one refresh + retry
  const newToken = await refreshAndGetToken()
  if (!newToken) return null
  accessToken = newToken
  result = await callOnce()
  return { ...result, refreshed: true }
}

// ── Refresh Token ───────────────────────────────────────────────────

import type { TokenResponse as TokenResponseType } from './lycero-auth-types'

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponseType> {
  const { resp, json } = await httpJson<{
    access_token: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }>(
    `${LYCERO_API_BASE}/auth/refresh`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: APP_TYPE,
      }),
    },
  )
  if (!resp.ok) {
    clearAuth()
    throw new Error('Token refresh failed')
  }
  return {
    accessToken: String(json.access_token ?? ''),
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    expiresIn: json.expires_in ? Number(json.expires_in) : undefined,
    user: undefined,
  }
}

// ── Logout ──────────────────────────────────────────────────────────

export async function lyceroLogout(): Promise<void> {
  const auth = loadLyceroAuth()
  if (auth?.tokens?.accessToken) {
    try {
      await httpJson(`${LYCERO_API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.tokens.accessToken}` },
      })
    } catch {
      /* logout is best-effort */
    }
  }
  clearAuth()
}

// ── Hub quota & models ─────────────────────────────────────────────

import type { HubQuota as HubQuotaType, HubQuotaWindow, HubModels as HubModelsType } from './lycero-auth-types'

function normalizeQuotaWindow(raw: unknown): HubQuotaWindow | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const used = Number(r.used ?? r.consumed ?? 0)
  const limit = Number(r.limit ?? 0)
  if (!Number.isFinite(limit) || limit <= 0) return undefined
  const remaining = r.remaining != null ? Number(r.remaining) : Math.max(0, limit - used)
  const percentUsed =
    r.percentUsed != null
      ? Number(r.percentUsed)
      : Math.min(100, Math.round((Math.max(0, used) / limit) * 1000) / 10)
  const percentRemaining =
    r.percentRemaining != null
      ? Number(r.percentRemaining)
      : Math.max(0, Math.round((100 - percentUsed) * 10) / 10)
  const resetAt = typeof r.resetAt === 'string' ? r.resetAt : ''
  return { used, limit, remaining, percentUsed, percentRemaining, resetAt }
}

export async function fetchHubQuota(explicitToken?: string): Promise<HubQuotaType | null> {
  try {
    const r = await authedFetch<{
      used?: number
      limit?: number
      remaining?: number
      percent_used?: number
      percent_remaining?: number
      reset_at?: string
      twcu_used?: number | null
      twcu_limit?: number
      twcu_remaining?: number
      twcu_reset_at?: string
      fiveHours?: unknown
      hourly?: unknown
      weekly?: unknown
      monthly?: unknown
      tokens?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
    }>(`${LYCERO_API_BASE}/quota/check`, { method: 'GET' }, explicitToken)
    if (!r || !r.resp.ok) return null
    const usedVal = r.json.twcu_used ?? r.json.used
    const limitVal = r.json.twcu_limit ?? r.json.limit
    const remVal = r.json.twcu_remaining ?? r.json.remaining
    const resetVal = r.json.twcu_reset_at ?? r.json.reset_at
    const fiveHours = normalizeQuotaWindow(r.json.fiveHours ?? r.json.hourly)
    const weekly = normalizeQuotaWindow(r.json.weekly)
    const monthly = normalizeQuotaWindow(r.json.monthly)
    const tokens =
      r.json.tokens && typeof r.json.tokens === 'object'
        ? {
            inputTokens: Number(r.json.tokens.inputTokens ?? 0),
            outputTokens: Number(r.json.tokens.outputTokens ?? 0),
            totalTokens: Number(r.json.tokens.totalTokens ?? 0),
          }
        : undefined
    return {
      ...(usedVal != null ? { used: Number(usedVal) } : {}),
      ...(limitVal != null ? { limit: Number(limitVal) } : {}),
      ...(remVal != null ? { remaining: Number(remVal) } : {}),
      ...(r.json.percent_used != null ? { percentUsed: Number(r.json.percent_used) } : {}),
      ...(r.json.percent_remaining != null ? { percentRemaining: Number(r.json.percent_remaining) } : {}),
      ...(resetVal != null ? { resetAt: String(resetVal) } : {}),
      ...(fiveHours ? { fiveHours } : {}),
      ...(weekly ? { weekly } : {}),
      ...(monthly ? { monthly } : {}),
      ...(tokens ? { tokens } : {}),
    }
  } catch (e) {
    console.warn('[lycero-auth] fetchHubQuota:', String(e))
    return null
  }
}

export async function fetchHubModels(): Promise<HubModelsType | null> {
  try {
    type RawModel = {
      id?: string
      modelSlug?: string
      name?: string
      displayName?: string
      tier?: string
      allowedTiers?: string[]
    }
    type RawResponse = {
      tier?: string
      models?: RawModel[]
    }
    const r =
      (await authedFetch<RawResponse>(`${LYCERO_API_BASE}/ai/models`, { method: 'GET' })) ??
      (await httpJson<RawResponse>(`${LYCERO_API_BASE}/ai/models`, { method: 'GET' }))
    if (!r || !r.resp.ok) return null
    return {
      tier: String(r.json.tier ?? 'free'),
      models: (r.json.models ?? []).map((m) => {
        const slug = String(m.modelSlug ?? m.id ?? '')
        return {
          id: slug,
          name: String(m.displayName ?? m.name ?? slug),
          tier: String(
            m.tier ?? (Array.isArray(m.allowedTiers) ? m.allowedTiers[0] : '') ?? '',
          ),
        }
      }),
    }
  } catch (e) {
    console.warn('[lycero-auth] fetchHubModels:', String(e))
    return null
  }
}

// ── gskLoginInfo — single auth info source (formerly in ai-search) ───────

export interface GskLoginInfo {
  email: string
  plan: string
  creditBalance?: number
}

/** Current Lycero login info; null when not logged in or profile unavailable */
export function gskLoginInfo(): GskLoginInfo | null {
  const auth = loadLyceroAuth()
  if (!auth?.user?.email) return null
  return {
    email: auth.user.email,
    plan: auth.user.plan ?? 'Lycero Member',
    ...(auth.user.creditsRemaining != null
      ? { creditBalance: auth.user.creditsRemaining }
      : {}),
  }
}

// ── Test hooks ─────────────────────────────────────────────────────

export function resetLyceroAuthCache(): void {
  cachedAuth = undefined
  cachedFetch = undefined
  refreshInFlight = null
}

/** Test-only: install a custom fetch implementation. */
export function __setFetchForTest(impl: typeof fetch | null): void {
  cachedFetch = impl ?? undefined
}
