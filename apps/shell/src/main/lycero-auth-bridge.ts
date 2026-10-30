/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { BrowserWindow, app, shell, safeStorage, ipcMain, webContents } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { URL } from 'node:url'
import os from 'node:os'
import crypto from 'node:crypto'
import { isGskKeyRejected, resetLyceroAuthCache as resetGskAuthCache } from '@lycero/ai-search'

// Import Lycero OAuth / Hub module (main-process only)
import {
  isExpiredJwt,
  loadLyceroAuth,
  lyceroLogout,
  hasLyceroAuth,
  lyceroAccessToken,
  loginWithEmail,
  fetchHubQuota,
  fetchHubModels,
  refreshAccessToken,
  exchangeCodeForToken,
  resolvePendingAuthCode,
  rejectPendingAuthCode,
  completeAuthCodeFromDiskState,
  saveLyceroAuth,
  startAuthorizationCodeLogin,
  resetLyceroAuthCache,
  APP_TYPE,
} from '@lycero/ai-auth/main'

// Cấu hình URL Cổng Trung Tâm
export const LYCERO_GATEWAY_URL = (process.env.LYCERO_GATEWAY_URL || 'https://lycero.com').replace(/\/(?:api\/v1\/office)?\/?$/, '')

let pendingLoginUrl = ''

export function openPendingLoginUrl(): void {
  if (pendingLoginUrl) void shell.openExternal(pendingLoginUrl)
}

function gskAuthDir(): string {
  return join(os.homedir(), '.lycero-office')
}

function gskAuthPath(): string {
  return join(gskAuthDir(), 'auth.json')
}

/**
 * Migrate legacy Hub-only users: if ~/.lycero-office/auth.json does not exist
 * but ~/.lycero/auth.json does, bring the existing Hub session into the new
 * session store.  No GSX key is minted — the Hub token is the single credential.
 * Called once at startup (Phase 4).
 *
 * Also proactively refreshes the access token if it is within 1 day of expiry,
 * so the user does not start the app with a stale session.
 */
export async function migrateLegacyAuth(): Promise<void> {
  try {
    if (existsSync(gskAuthPath())) return // already migrated or GSX user
    const parsed = loadLyceroAuth()
    const token = parsed?.tokens?.accessToken
    if (!token) return
    const session: LyceroSession = {
      token,
      refreshToken: parsed.tokens?.refreshToken,
      user: {
        id: parsed.user?.id || 'legacy',
        name: parsed.user?.fullName || parsed.user?.name || 'Lycero User',
        email: parsed.user?.email || '',
        plan: parsed.license?.tier || parsed.user?.plan || 'free',
        creditsRemaining: parsed.license?.quotaRemaining,
      },
      license: parsed.license,
      orgId: parsed.orgId,
      archetypeId: parsed.archetypeId,
      storedAt: Date.now(),
    }
    // Proactive refresh: if the token has a known expiry and is within 1 day of
    // expiring, refresh it before the user makes their first request.
    const expiresAt = parsed?.tokens?.expiresAt
    if (
      expiresAt &&
      typeof expiresAt === 'number' &&
      expiresAt < Date.now() + 24 * 60 * 60 * 1000
    ) {
      const refreshToken = parsed?.tokens?.refreshToken
      if (refreshToken) {
        try {
          const next = await refreshAccessToken(refreshToken)
          session.token = next.accessToken
          if (next.refreshToken) session.refreshToken = next.refreshToken
          console.info('[lycero-auth] proactively refreshed expired access token')
        } catch {
          console.warn('[lycero-auth] proactive token refresh failed, will retry on demand')
        }
      }
    }
    saveSession(session)
  } catch (err) {
    console.warn('[lycero-auth-bridge] migrateLegacyAuth failed:', err)
  }
}

export interface LyceroUserProfile {
  id: string
  name: string
  email: string
  avatar?: string | undefined
  role?: string | undefined
  persona?: string | undefined
  subject?: string | undefined
  grade?: string | undefined
  schoolName?: string | undefined
  department?: string | undefined
  curriculum?: string | undefined
  teachingStyle?: string | undefined
  plan?: string | undefined
  creditsRemaining?: number | undefined
  activeDevicesCount?: number | undefined
}

export interface LyceroQuotaWindow {
  used: number
  limit: number
  remaining: number
  percentUsed: number
  percentRemaining: number
  resetAt: string
}

export interface LyceroTokenBreakdown {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface LyceroLicenseInfo {
  tier: 'free' | 'plus' | 'pro' | 'enterprise'
  status?: string | undefined
  expiresAt?: string | null | undefined
  /** undefined means unknown — the Hub is the only source of truth; never fabricate a number */
  quotaLimit?: number
  quotaUsed?: number
  quotaRemaining?: number
  percentUsed?: number
  percentRemaining?: number
  cycleResetAt?: string | undefined
  weeklyLimit?: number
  weeklyUsed?: number
  weeklyRemaining?: number
  weeklyPercentUsed?: number
  weeklyPercentRemaining?: number
  weeklyResetAt?: string | undefined
  fiveHourLimit?: number
  fiveHourUsed?: number
  fiveHourRemaining?: number
  fiveHourPercentUsed?: number
  fiveHourPercentRemaining?: number
  fiveHourResetAt?: string | undefined
  tokens?: LyceroTokenBreakdown | undefined
}

export interface LyceroSession {
  token: string
  /** Refresh token for silent re-authentication. Stored encrypted; undefined if Hub did not provide one. */
  refreshToken?: string | undefined
  user: LyceroUserProfile
  license?: LyceroLicenseInfo | undefined
  quota?: {
    fiveHours?: LyceroQuotaWindow
    weekly?: LyceroQuotaWindow
    monthly?: LyceroQuotaWindow
    tokens?: LyceroTokenBreakdown
  } | undefined
  lastSyncedAt?: string | undefined
  orgId?: string | undefined
  archetypeId?: number | undefined
  storedAt: number
}

export interface LyceroLoginResult {
  success: boolean
  token?: string | undefined
  refreshToken?: string | undefined
  user?: {
    id: string
    email: string
    fullName?: string | undefined
    name?: string | undefined
  } | undefined
  license?: LyceroLicenseInfo | undefined
  error?: string | undefined
}

/** Raw response shape from /auth/login — may contain refreshToken */
interface HubLoginResponse {
  success?: boolean
  token?: string
  refreshToken?: string
  user?: {
    id?: string
    name?: string
    fullName?: string
    email?: string
  }
  license?: LyceroLicenseInfo
  error?: string
  error_description?: string
}

function getSessionPath(): string {
  const dir = join(app.getPath('userData'), 'lycero')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'session.json')
}

export function getMachineFingerprint(): string {
  try {
    const deviceFile = join(app.getPath('userData'), 'device-id.json')
    if (existsSync(deviceFile)) {
      const data = JSON.parse(readFileSync(deviceFile, 'utf-8'))
      if (data?.deviceId && typeof data.deviceId === 'string') return data.deviceId
    }
    const raw = `${process.platform}-${os.hostname()}-${os.userInfo?.()?.username || 'user'}-${crypto.randomUUID()}`
    const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)
    const deviceId = `${process.platform}-hwid-${hash}`
    const dir = dirname(deviceFile)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(deviceFile, JSON.stringify({ deviceId, createdAt: Date.now() }), 'utf-8')
    return deviceId
  } catch {
    return `${process.platform}-hwid-default`
  }
}

/**
 * Save the Lycero session to an encrypted file in userData.
 * This is the SOLE source of truth for the desktop session.
 *
 * SECURITY: Tokens are stored encrypted via Electron safeStorage (OS keychain) when
 * available. The plaintext mirror to ~/.lycero/auth.json has been REMOVED.
 * The session file contains both accessToken (in .token) and refreshToken
 * (in .refreshToken) when available from the Hub.
 */
export function saveSession(session: LyceroSession): void {
  try {
    const filePath = getSessionPath()
    const jsonStr = JSON.stringify(session)
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(jsonStr)
      writeFileSync(filePath, encrypted)
    } else {
      // Fallback: write plaintext (less secure; OS keychain unavailable).
      // The secure-store module's derived-key fallback is NOT used here because
      // this file path is Electron-main-only and safeStorage.isEncryptionAvailable()
      // is the correct sentinel for "can we use OS keychain".
      writeFileSync(filePath, jsonStr, 'utf-8')
    }
    resetGskAuthCache()
    resetLyceroAuthCache()
  } catch (err) {
    console.error('[lycero-auth] failed to save session:', err)
  }
}

export function getSession(): LyceroSession | null {
  try {
    const filePath = getSessionPath()
    if (!existsSync(filePath)) return null
    const buffer = readFileSync(filePath)
    let jsonStr: string
    if (safeStorage.isEncryptionAvailable()) {
      try {
        jsonStr = safeStorage.decryptString(buffer)
      } catch {
        jsonStr = buffer.toString('utf-8')
      }
    } else {
      jsonStr = buffer.toString('utf-8')
    }
    const session = JSON.parse(jsonStr) as LyceroSession
    // Session expires after 30 days
    if (Date.now() - session.storedAt > 30 * 24 * 60 * 60 * 1000) {
      clearSession()
      return null
    }
    if (
      session.token &&
      (isExpiredJwt(session.token) || isGskKeyRejected(session.token)) &&
      !session.refreshToken
    ) {
      clearSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function isLyceroProSession(): boolean {
  const session = getSession()
  if (session) {
    const tier = (session.license?.tier || session.user?.plan || 'free').toLowerCase()
    return tier === 'pro' || tier === 'enterprise'
  }
  const auth = loadLyceroAuth()
  const plan = auth?.user?.plan?.toLowerCase() ?? ''
  return plan.includes('pro') || plan.includes('enterprise')
}

export function clearSession(): void {
  try {
    const filePath = getSessionPath()
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch (err) {
    console.error('[lycero-auth] failed to clear session:', err)
  }
  // Also clear the legacy plaintext mirror (no longer written on save, but
  // must be deleted on sign-out so that old sessions do not persist).
  try {
    const hubAuthFile = join(os.homedir(), '.lycero', 'auth.json')
    if (existsSync(hubAuthFile)) unlinkSync(hubAuthFile)
  } catch {
    /* ignore */
  }
  resetGskAuthCache()
  resetLyceroAuthCache()
}

export async function loginToLyceroHub(email: string, pass: string): Promise<LyceroLoginResult> {
  try {
    const res = await fetch(`${LYCERO_GATEWAY_URL}/api/v1/office/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: pass,
        clientId: 'lycero-office-desktop',
        deviceId: getMachineFingerprint(),
        deviceName: `${os.hostname()} - ${os.type()}`,
        osPlatform: process.platform,
      }),
    })
    const data = (await res.json()) as HubLoginResponse
    let token = data.token
    if (!token) {
      const setCookie = res.headers.get('set-cookie')
      const match = setCookie?.match(/auth_token=([^;]+)/)
      if (match) token = match[1]
    }
    const isSuccess = data.success !== false && Boolean(token)
    if (res.ok && isSuccess && token) {
      const session: LyceroSession = {
        token,
        // Store refreshToken if the Hub provided one (enables silent re-auth)
        refreshToken: data.refreshToken,
        user: {
          id: data.user?.id || 'u-user',
          name: data.user?.fullName || data.user?.name || email.split('@')[0] || 'Lycero User',
          email: data.user?.email || email,
          plan: data.license?.tier || 'free',
        },
        // license comes only from Hub — null if Hub unreachable (unknown quota)
        license: data.license ?? undefined,
        storedAt: Date.now(),
      }
      if (data.license) {
        session.user.creditsRemaining = data.license.quotaRemaining
      }
      saveSession(session)
      try {
        saveLyceroAuth({
          tokens: {
            accessToken: token,
            refreshToken: data.refreshToken,
          },
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            plan: session.user.plan,
          },
        })
      } catch {}
      return { success: true, token, refreshToken: data.refreshToken, user: session.user, license: data.license }
    }
    return { success: false, error: data.error || data.error_description || `HTTP ${res.status}` }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

function computeDefaultEndOfMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).toISOString()
}

function computeDefaultEndOfWeekIso(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diffToMonday + 7)
  return d.toISOString()
}

function buildQuotaWindow(
  usedRaw: number | undefined,
  limitRaw: number | undefined,
  resetAtRaw: string | undefined,
  fallbackLimit: number,
  fallbackResetAt: string,
): LyceroQuotaWindow {
  const limit = typeof limitRaw === 'number' && limitRaw > 0 ? limitRaw : fallbackLimit
  const used = typeof usedRaw === 'number' && usedRaw >= 0 ? Math.round(usedRaw * 100) / 100 : 0
  const remaining = Math.max(0, Math.round((limit - used) * 100) / 100)
  const rawPercent = (used / Math.max(1, limit)) * 100
  const roundedPercent = Math.round(rawPercent * 10) / 10
  const percentUsed = used > 0 ? Math.min(100, Math.max(0.1, roundedPercent)) : 0
  const percentRemaining = Math.max(0, Math.round((100 - percentUsed) * 10) / 10)
  return {
    used,
    limit,
    remaining,
    percentUsed,
    percentRemaining,
    resetAt: resetAtRaw || fallbackResetAt,
  }
}

function isFutureResetIso(iso: string | undefined): boolean {
  if (!iso) return true
  const ms = Date.parse(iso)
  return Number.isFinite(ms) && ms > Date.now()
}

export function resolveSessionQuotas(session: LyceroSession): {
  fiveHours: LyceroQuotaWindow
  weekly: LyceroQuotaWindow
  monthly: LyceroQuotaWindow
  tokens: LyceroTokenBreakdown
} {
  const tier = (session.license?.tier || session.user.plan || 'free').toLowerCase()
  const defaultMonthlyLimit =
    tier === 'enterprise' ? 5000 : tier === 'pro' ? 1000 : tier === 'plus' ? 400 : 200
  const nextFiveHourIso = new Date(
    (Math.floor(Date.now() / (5 * 3600 * 1000)) + 1) * (5 * 3600 * 1000),
  ).toISOString()

  const lic = session.license
  const mLimit = lic?.quotaLimit && lic.quotaLimit > 0 ? lic.quotaLimit : defaultMonthlyLimit
  const mUsed =
    lic?.quotaUsed !== undefined
      ? lic.quotaUsed
      : lic?.quotaRemaining !== undefined
        ? Math.max(0, mLimit - lic.quotaRemaining)
        : session.user.creditsRemaining !== undefined
          ? Math.max(0, mLimit - session.user.creditsRemaining)
          : 0

  // Scale default weekly (~30% of monthly) and 5-hour (~12% of monthly) limits
  // proportionally to the actual monthly contract limit (TWCU).
  const baseWeeklyLimit = tier === 'enterprise' ? 1500 : tier === 'pro' ? 300 : tier === 'plus' ? 120 : 60
  const baseFiveHourLimit = tier === 'enterprise' ? 600 : tier === 'pro' ? 80 : tier === 'plus' ? 40 : 25
  const scaleFactor = defaultMonthlyLimit > 0 ? mLimit / defaultMonthlyLimit : 1
  const defaultWeeklyLimit = Math.max(10, Math.round(baseWeeklyLimit * scaleFactor))
  const defaultFiveHourLimit = Math.max(5, Math.round(baseFiveHourLimit * scaleFactor))

  const monthly =
    session.quota?.monthly && isFutureResetIso(session.quota.monthly.resetAt) && lic?.quotaUsed === undefined
      ? buildQuotaWindow(
          session.quota.monthly.used,
          session.quota.monthly.limit,
          session.quota.monthly.resetAt,
          defaultMonthlyLimit,
          computeDefaultEndOfMonthIso(),
        )
      : buildQuotaWindow(
          mUsed,
          mLimit,
          lic?.cycleResetAt,
          defaultMonthlyLimit,
          computeDefaultEndOfMonthIso(),
        )

  // Preserve valid rolling weekly/5-hour windows from /quota/check; never dump
  // cumulative monthly usage into the 5-hour or weekly window when explicit
  // window counters are absent on /auth/me.
  const wLimit = lic?.weeklyLimit && lic.weeklyLimit > 0 ? lic.weeklyLimit : defaultWeeklyLimit
  const weekly =
    session.quota?.weekly && isFutureResetIso(session.quota.weekly.resetAt)
      ? buildQuotaWindow(
          session.quota.weekly.used,
          session.quota.weekly.limit,
          session.quota.weekly.resetAt,
          defaultWeeklyLimit,
          computeDefaultEndOfWeekIso(),
        )
      : lic?.weeklyUsed !== undefined
        ? buildQuotaWindow(
            lic.weeklyUsed,
            wLimit,
            lic?.weeklyResetAt,
            defaultWeeklyLimit,
            computeDefaultEndOfWeekIso(),
          )
        : buildQuotaWindow(
            0,
            wLimit,
            lic?.weeklyResetAt,
            defaultWeeklyLimit,
            computeDefaultEndOfWeekIso(),
          )

  const hLimit = lic?.fiveHourLimit && lic.fiveHourLimit > 0 ? lic.fiveHourLimit : defaultFiveHourLimit
  const fiveHours =
    session.quota?.fiveHours && isFutureResetIso(session.quota.fiveHours.resetAt)
      ? buildQuotaWindow(
          session.quota.fiveHours.used,
          session.quota.fiveHours.limit,
          session.quota.fiveHours.resetAt,
          defaultFiveHourLimit,
          nextFiveHourIso,
        )
      : lic?.fiveHourUsed !== undefined
        ? buildQuotaWindow(
            lic.fiveHourUsed,
            hLimit,
            lic?.fiveHourResetAt,
            defaultFiveHourLimit,
            nextFiveHourIso,
          )
        : buildQuotaWindow(0, hLimit, lic?.fiveHourResetAt, defaultFiveHourLimit, nextFiveHourIso)

  const tokens: LyceroTokenBreakdown = session.quota?.tokens ??
    lic?.tokens ?? {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }

  return { fiveHours, weekly, monthly, tokens }
}

export async function fetchLyceroMe(token?: string): Promise<{
  success?: boolean
  user?: {
    id?: string
    email?: string
    fullName?: string | null
    name?: string | null
    role?: string | null
    avatarUrl?: string | null
    avatar?: string | null
    activeDevicesCount?: number
  }
  license?: LyceroLicenseInfo
  quota?: {
    fiveHours?: LyceroQuotaWindow
    weekly?: LyceroQuotaWindow
    monthly?: LyceroQuotaWindow
    tokens?: LyceroTokenBreakdown
  }
  syncedAt?: string
} | null> {
  let t = token || getSession()?.token || lyceroAccessToken()
  if (!t) return null
  try {
    let res = await fetch(`${LYCERO_GATEWAY_URL}/api/v1/office/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.status === 401) {
      const curr = getSession()
      if (curr?.refreshToken) {
        try {
          const refreshed = await refreshAccessToken(curr.refreshToken)
          if (refreshed.accessToken) {
            t = refreshed.accessToken
            curr.token = refreshed.accessToken
            if (refreshed.refreshToken) curr.refreshToken = refreshed.refreshToken
            saveSession(curr)
            res = await fetch(`${LYCERO_GATEWAY_URL}/api/v1/office/auth/me`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${t}`,
                'Content-Type': 'application/json',
              },
            })
          }
        } catch {
          clearSession()
          return null
        }
      } else {
        clearSession()
        return null
      }
    }
    if (!res.ok) return null
    const json = (await res.json()) as {
      success?: boolean
      user?: {
        id?: string
        email?: string
        fullName?: string | null
        name?: string | null
        role?: string | null
        avatarUrl?: string | null
        avatar?: string | null
        activeDevicesCount?: number
      }
      license?: LyceroLicenseInfo
      quota?: {
        fiveHours?: LyceroQuotaWindow
        weekly?: LyceroQuotaWindow
        monthly?: LyceroQuotaWindow
        tokens?: LyceroTokenBreakdown
      }
      syncedAt?: string
    }
    const curr = getSession()
    if (curr && (json?.user || json?.license)) {
      if (json.user) {
        if (json.user.id) curr.user.id = json.user.id
        if (json.user.email) curr.user.email = json.user.email
        const fullName = json.user.fullName || json.user.name
        if (fullName) curr.user.name = fullName
        if (json.user.role) curr.user.role = json.user.role
        const avatar = json.user.avatarUrl !== undefined ? json.user.avatarUrl : json.user.avatar
        if (avatar !== undefined) curr.user.avatar = avatar || undefined
        if (typeof json.user.activeDevicesCount === 'number') {
          curr.user.activeDevicesCount = json.user.activeDevicesCount
        }
      }
      if (json.license) {
        curr.license = json.license
        if (curr.user && json.license.quotaRemaining !== undefined) {
          curr.user.creditsRemaining = json.license.quotaRemaining
          curr.user.plan = json.license.tier
        }
      }
      if (json.quota) {
        curr.quota = json.quota
      } else {
        curr.quota = resolveSessionQuotas(curr)
      }
      curr.lastSyncedAt = json.syncedAt || new Date().toISOString()
      // Preserve refreshToken when re-saving
      saveSession(curr)
    }
    return json
  } catch {
    return null
  }
}

export async function updateLyceroProfile(patch: {
  fullName?: string
  avatarUrl?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const curr = getSession()
  const t = curr?.token || lyceroAccessToken()
  if (!curr && !t) {
    return { ok: false, error: 'Chưa đăng nhập tài khoản Lycero.' }
  }

  const cleanName = typeof patch.fullName === 'string' ? patch.fullName.trim().replace(/\s+/g, ' ') : undefined
  if (cleanName !== undefined && (cleanName.length < 1 || cleanName.length > 100)) {
    return { ok: false, error: 'Họ và tên phải có độ dài từ 1 đến 100 ký tự.' }
  }

  const cleanAvatar =
    patch.avatarUrl === null || patch.avatarUrl === ''
      ? null
      : typeof patch.avatarUrl === 'string'
        ? patch.avatarUrl.trim()
        : undefined
  if (typeof cleanAvatar === 'string' && !/^https?:\/\//i.test(cleanAvatar)) {
    return { ok: false, error: 'URL ảnh đại diện phải bắt đầu bằng http:// hoặc https://.' }
  }

  // Update local session immediately for instant offline-resilient UX
  if (curr) {
    if (cleanName !== undefined) curr.user.name = cleanName
    if (cleanAvatar !== undefined) curr.user.avatar = cleanAvatar ?? undefined
    curr.lastSyncedAt = new Date().toISOString()
    saveSession(curr)
    try {
      const existingAuth = loadLyceroAuth()
      if (existingAuth) {
        saveLyceroAuth({
          ...existingAuth,
          user: {
            ...existingAuth.user,
            name: curr.user.name,
            avatar: curr.user.avatar,
          },
        })
      }
    } catch {
      /* ignore */
    }
  }

  if (t) {
    try {
      const res = await fetch(`${LYCERO_GATEWAY_URL}/api/v1/office/auth/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(cleanName !== undefined ? { fullName: cleanName } : {}),
          ...(cleanAvatar !== undefined ? { avatarUrl: cleanAvatar } : {}),
        }),
      })
      if (res.ok) {
        const json = await res.json().catch(() => null)
        const updatedSession = getSession()
        if (updatedSession && json) {
          if (json.user?.fullName) updatedSession.user.name = json.user.fullName
          if (json.user?.avatarUrl !== undefined) {
            updatedSession.user.avatar = json.user.avatarUrl || undefined
          }
          if (json.license) updatedSession.license = json.license
          if (json.quota) updatedSession.quota = json.quota
          updatedSession.lastSyncedAt = json.syncedAt || new Date().toISOString()
          saveSession(updatedSession)
        }
      } else if (res.status === 400) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null
        if (errJson?.error) return { ok: false, error: errJson.error }
      }
    } catch {
      // Server unreachable or offline — local session already updated cleanly
    }
  }

  return { ok: true }
}

function broadcastAuthChanged(
  session: LyceroSession | null,
  getMainWindow?: () => BrowserWindow | null,
): void {
  const win = getMainWindow?.()
  if (win && !win.isDestroyed()) {
    win.webContents.send('lycero:auth:changed', session)
    win.webContents.send('ai:settings-changed')
    if (session) win.webContents.send('home:account-login-event', { phase: 'success' })
  }
  const allContents = webContents?.getAllWebContents?.() ?? []
  for (const wc of allContents) {
    if (wc.isDestroyed() || wc === win?.webContents) continue
    wc.send('lycero:auth:changed', session)
    wc.send('ai:settings-changed')
    if (session) wc.send('home:account-login-event', { phase: 'success' })
  }
}

export function handleLyceroDeepLink(url: string, getMainWindow: () => BrowserWindow | null): boolean {
  if (!url.startsWith('lycero://') && !url.startsWith('lycero-office://')) return false
  try {
    const parsed = new URL(url)

    const isCallback =
      parsed.host === 'callback' ||
      parsed.host === 'auth' ||
      parsed.pathname.includes('callback')
    const isSync = parsed.host === 'sync' || parsed.pathname.includes('sync')

    // ── 1. OAuth 2.0 Authorization Code Flow (lycero://callback?code=…&state=…) ──
    if (isCallback) {
      const code = parsed.searchParams.get('code')
      const state = parsed.searchParams.get('state')
      if (code && state) {
        const resolvedInMemory = resolvePendingAuthCode(code, state)
        if (!resolvedInMemory) {
          void completeAuthCodeFromDiskState(code, state)
            .then(async (auth) => {
              if (!auth) return
              const session: LyceroSession = {
                token: auth.tokens.accessToken,
                refreshToken: auth.tokens.refreshToken,
                user: auth.user,
                orgId: auth.orgId,
                archetypeId: auth.archetypeId,
                storedAt: Date.now(),
              }
              saveSession(session)
              await fetchLyceroMe(session.token)
              broadcastAuthChanged(getSession() ?? session, getMainWindow)
            })
            .catch((err) => {
              const win = getMainWindow()
              if (win && !win.isDestroyed()) {
                win.webContents.send('home:account-login-event', {
                  phase: 'error',
                  error: String((err as Error)?.message ?? err),
                })
              }
            })
        }
        return true
      }
      const oauthError = parsed.searchParams.get('error')
      if (oauthError) {
        rejectPendingAuthCode(oauthError)
        return true
      }
    }

    // ── 2. Direct token deep link (lycero://sync?token=… or lycero-office://auth/callback?token=…) ──
    if (isSync || isCallback) {
      const token = parsed.searchParams.get('token')
      if (!token) return false

      const userId = parsed.searchParams.get('user') || parsed.searchParams.get('user_id') || 'u-sync'

      let extraProfile: Record<string, unknown> = {}
      const userProfileRaw = parsed.searchParams.get('user_profile')
      if (userProfileRaw) {
        try {
          extraProfile = JSON.parse(Buffer.from(userProfileRaw, 'base64').toString('utf-8'))
        } catch {
          try {
            extraProfile = JSON.parse(decodeURIComponent(userProfileRaw))
          } catch {
            // ignore parse errors
          }
        }
      }

      const session: LyceroSession = {
        token,
        refreshToken: parsed.searchParams.get('refresh_token') || undefined,
        user: {
          id: userId,
          name:
            parsed.searchParams.get('name') ||
            String(extraProfile.name || 'Lycero User'),
          email: parsed.searchParams.get('email') || String(extraProfile.email || ''),
          avatar: parsed.searchParams.get('avatar') || String(extraProfile.avatar || '') || undefined,
          role: parsed.searchParams.get('role') || String(extraProfile.role || '') || undefined,
          persona: parsed.searchParams.get('persona') || String(extraProfile.persona || '') || undefined,
          subject: parsed.searchParams.get('subject') || String(extraProfile.subject || '') || undefined,
          grade: parsed.searchParams.get('grade') || String(extraProfile.grade || '') || undefined,
          schoolName:
            parsed.searchParams.get('school_name') ||
            parsed.searchParams.get('school') ||
            String(extraProfile.schoolName || '') ||
            undefined,
          department:
            parsed.searchParams.get('department') ||
            parsed.searchParams.get('faculty') ||
            String(extraProfile.department || '') ||
            undefined,
          curriculum:
            parsed.searchParams.get('curriculum') || String(extraProfile.curriculum || '') || undefined,
          teachingStyle:
            parsed.searchParams.get('teaching_style') ||
            String(extraProfile.teachingStyle || '') ||
            undefined,
          plan: parsed.searchParams.get('tier') || String(extraProfile.plan || '') || 'free',
        },
        license: undefined,
        orgId: parsed.searchParams.get('org_id') || String(extraProfile.orgId || '') || undefined,
        archetypeId: parsed.searchParams.get('archetype_id')
          ? Number(parsed.searchParams.get('archetype_id'))
          : Number(extraProfile.archetypeId) || 0,
        storedAt: Date.now(),
      }

      saveSession(session)
      saveLyceroAuth({
        tokens: {
          accessToken: session.token,
          refreshToken: session.refreshToken,
        },
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          avatar: session.user.avatar,
          role: session.user.role,
          persona: session.user.persona,
          subject: session.user.subject,
          grade: session.user.grade,
          schoolName: session.user.schoolName,
          department: session.user.department,
          curriculum: session.user.curriculum,
          teachingStyle: session.user.teachingStyle,
          plan: session.user.plan,
          creditsRemaining: session.user.creditsRemaining,
        },
        orgId: session.orgId,
        archetypeId: session.archetypeId,
      })

      broadcastAuthChanged(session, getMainWindow)

      void fetchLyceroMe(token).then((latest) => {
        if (latest) {
          broadcastAuthChanged(getSession() ?? session, getMainWindow)
        }
      })

      return true
    }
  } catch (err) {
    console.warn('[lycero-auth] invalid deep link url:', url, err)
  }
  return false
}

/**
 * Maps the raw Hub /quota/check JSON to the quota shape used by the renderer.
 * Values are undefined when the Hub did not provide them — no fabricated numbers.
 * Exported for unit testing; the IPC handler is the only caller in production.
 */
export function mapQuotaResponse(
  r: { used?: unknown; limit?: unknown; reset_at?: unknown } | null,
): { used: number | undefined; limit: number | undefined; resetAt: string | undefined } | null {
  if (!r) return null
  return {
    used: r.used != null ? Number(r.used) : undefined,
    limit: r.limit != null ? Number(r.limit) : undefined,
    resetAt: r.reset_at != null ? String(r.reset_at) : undefined,
  }
}


export function startLyceroOAuthFlow(
  sender: Electron.WebContents,
  getMainWindow?: () => BrowserWindow | null,
): boolean {
  pendingLoginUrl = ''
  const oauthState = crypto.randomUUID()
  let opened = false

  const sendEvent = (channel: string, payload: unknown) => {
    if (!sender.isDestroyed()) {
      sender.send(channel, payload)
    }
    const win = getMainWindow?.()
    if (win && !win.isDestroyed() && win.webContents !== sender) {
      win.webContents.send(channel, payload)
    }
  }

  return startAuthorizationCodeLogin((progress) => {
    if (progress.phase === 'url') {
      pendingLoginUrl = progress.url ?? ''
      if (!opened && pendingLoginUrl) {
        opened = true
        void shell.openExternal(pendingLoginUrl)
      }
      sendEvent('home:account-login-event', {
        phase: 'url',
        url: progress.url,
        expiresInSec: progress.expiresInSec,
      })
    } else if (progress.phase === 'success') {
      void (async () => {
        const auth = loadLyceroAuth()
        if (auth) {
          const session: LyceroSession = {
            token: auth.tokens.accessToken,
            refreshToken: auth.tokens.refreshToken,
            user: auth.user,
            orgId: auth.orgId,
            archetypeId: auth.archetypeId,
            storedAt: Date.now(),
          }
          saveSession(session)
          await fetchLyceroMe(session.token)
          broadcastAuthChanged(getSession() ?? session, getMainWindow)
        }
        sendEvent('home:account-login-event', { phase: 'success' })
      })()
    } else if (progress.phase === 'error') {
      sendEvent('home:account-login-event', {
        phase: 'error',
        error: progress.error,
      })
    }
  }, oauthState)
}

export function registerLyceroAuthIpc(getMainWindow: () => BrowserWindow | null): void {
  // Direct email/password login to Central Gateway
  ipcMain.handle('lycero:auth:loginHub', async (_event, email: string, pass: string) => {
    const result = await loginToLyceroHub(email, pass)
    if (result.success) {
      broadcastAuthChanged(getSession(), getMainWindow)
    }
    return result
  })

  // Check /me
  ipcMain.handle('lycero:auth:me', async () => {
    return fetchLyceroMe()
  })

  // Authorization Code Flow with PKCE + Deep Link
  ipcMain.handle('lycero:auth:startAuthCode', async (event) => {
    return startLyceroOAuthFlow(event.sender, getMainWindow)
  })

  // Get current session
  ipcMain.handle('lycero:auth:getSession', async () => {
    return getSession()
  })

  // Refresh the current session's access token
  ipcMain.handle('lycero:auth:refresh', async () => {
    const session = getSession()
    if (!session?.refreshToken) return { success: false, error: 'No refresh token' }
    try {
      const next = await refreshAccessToken(session.refreshToken)
      session.token = next.accessToken
      if (next.refreshToken) session.refreshToken = next.refreshToken
      saveSession(session)
      return { success: true, token: next.accessToken }
    } catch (err) {
      return { success: false, error: String((err as Error).message) }
    }
  })

  // Sign out
  ipcMain.handle('lycero:auth:signOut', async () => {
    await lyceroLogout()
    clearSession()
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('lycero:auth:changed', null)
    }
    return true
  })

  // IPC handler — all values come from the Hub exclusively
  // Uses authedFetch internally (refresh + retry on 401)
  ipcMain.handle('lycero:hub:fetchQuota', async () => {
    return fetchHubQuota()
  })

  // Fetch Hub models — uses authedFetch internally (refresh + retry on 401)
  ipcMain.handle('lycero:hub:fetchModels', async () => {
    const fromHub = await fetchHubModels()
    if (fromHub?.models && fromHub.models.length > 0) {
      const lycero25Only = fromHub.models.filter((m) => m.id.startsWith('lycero-2.5-'))
      if (lycero25Only.length > 0) {
        return { ...fromHub, models: lycero25Only }
      }
    }
    // Return the canonical Lycero 2.5 model family when Hub is unreachable
    return {
      tier: getSession()?.license?.tier || 'free',
      models: [
        { id: 'lycero-2.5-auto', name: 'Lycero 2.5 Auto', tier: 'free' },
        { id: 'lycero-2.5-pro', name: 'Lycero 2.5 Pro', tier: 'pro' },
        { id: 'lycero-2.5-flash', name: 'Lycero 2.5 Flash', tier: 'free' },
        { id: 'lycero-2.5-thinking', name: 'Lycero 2.5 Thinking', tier: 'pro' },
        { id: 'lycero-2.5-max', name: 'Lycero 2.5 Max', tier: 'enterprise' },
      ],
    }
  })
}

export {
  hasLyceroAuth,
  lyceroAccessToken,
  loginWithEmail,
  startAuthorizationCodeLogin,
  exchangeCodeForToken,
}
