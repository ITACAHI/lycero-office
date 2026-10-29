/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Renderer-safe types, interfaces, and constants for Lycero OAuth auth.
 * This file must NEVER import Node.js built-ins (node:fs, node:path, etc.)
 * to avoid pulling Node APIs into the renderer bundle.
 */

// ── Constants ───────────────────────────────────────────────────────

export const LYCERO_BASE_URL = (
  typeof process !== 'undefined' && process.env?.LYCERO_API_URL
    ? process.env.LYCERO_API_URL
    : typeof process !== 'undefined' && process.env?.LYCERO_GATEWAY_URL
      ? process.env.LYCERO_GATEWAY_URL
      : 'https://lycero.com'
).replace(/\/(?:api\/v1\/office)?\/?$/, '')

export const LYCERO_API_BASE = `${LYCERO_BASE_URL}/api/v1/office`

export const APP_TYPE = 'lycero-office-desktop'

export const HTTP_TIMEOUT_MS = 30_000

// ── User & Auth Types ────────────────────────────────────────────────

export interface LyceroUser {
  id: string
  name: string
  email: string
  avatar: string | undefined
  role: string | undefined
  persona: string | undefined
  subject: string | undefined
  grade: string | undefined
  schoolName: string | undefined
  department: string | undefined
  curriculum: string | undefined
  teachingStyle: string | undefined
  plan: string | undefined
  creditsRemaining: number | undefined
}

export interface LyceroAuthTokens {
  accessToken: string
  refreshToken?: string | undefined
  expiresAt?: number | undefined
}

export interface LyceroAuth {
  tokens: LyceroAuthTokens
  user: LyceroUser
  orgId: string | undefined
  archetypeId: number | undefined
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string | undefined
  expiresIn: number | undefined
  user: LyceroUser | undefined
}

export interface LyceroLoginProgress {
  phase: 'url' | 'pending' | 'success' | 'error'
  url?: string
  expiresInSec?: number
  error?: string
}

export interface EmailLoginResponse {
  accessToken: string
  refreshToken: string | undefined
  user: LyceroUser
  orgId: string | undefined
  archetypeId: number | undefined
}

// ── Hub Quota & Models ───────────────────────────────────────────────

export interface HubQuotaWindow {
  used: number
  limit: number
  remaining: number
  percentUsed: number
  percentRemaining: number
  resetAt: string
}

export interface HubTokenBreakdown {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface HubQuota {
  /** undefined means the Hub did not provide this value — show unknown, not a fabricated number */
  used?: number
  limit?: number
  remaining?: number
  percentUsed?: number
  percentRemaining?: number
  resetAt?: string
  fiveHours?: HubQuotaWindow
  weekly?: HubQuotaWindow
  monthly?: HubQuotaWindow
  tokens?: HubTokenBreakdown
}

export interface HubModel {
  id: string
  name: string
  tier: string
}

export interface HubModels {
  tier: string
  models: HubModel[]
}

// ── API Response types (snake_case from backend) ─────────────────────

export interface ApiTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  user?: ApiLyceroUser
  org_id?: string
  archetype_id?: number
  error?: string
  error_description?: string
}

export interface ApiLyceroUser {
  id: string
  name?: string
  fullName?: string | null
  full_name?: string | null
  email: string
  avatar?: string | null
  avatarUrl?: string | null
  avatar_url?: string | null
  role?: string
  persona?: string
  subject?: string
  grade?: string
  school_name?: string
  department?: string
  curriculum?: string
  teaching_style?: string
  plan?: string
  credits_remaining?: number
}

/** OAuth 2.0 Authorization Code Flow — token exchange response */
export interface ApiOAuthTokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in?: number
  refresh_token?: string
  refresh_expires_in?: number
  scope?: string
  user?: ApiLyceroUser
}

// ── Pure Helpers ─────────────────────────────────────────────────────

/** Map API snake_case/camelCase user to camelCase LyceroUser — no side effects, Node-free */
export function mapApiUser(apiUser: ApiLyceroUser): LyceroUser {
  const resolvedName = apiUser.name || apiUser.fullName || apiUser.full_name || ''
  const resolvedAvatar = apiUser.avatar || apiUser.avatarUrl || apiUser.avatar_url || ''
  return {
    id: String(apiUser.id ?? ''),
    name: String(resolvedName),
    email: String(apiUser.email ?? ''),
    avatar: resolvedAvatar ? String(resolvedAvatar) : '',
    role: apiUser.role ? String(apiUser.role) : undefined,
    persona: apiUser.persona ? String(apiUser.persona) : undefined,
    subject: apiUser.subject ? String(apiUser.subject) : undefined,
    grade: apiUser.grade ? String(apiUser.grade) : undefined,
    schoolName: apiUser.school_name ? String(apiUser.school_name) : undefined,
    department: apiUser.department ? String(apiUser.department) : undefined,
    curriculum: apiUser.curriculum ? String(apiUser.curriculum) : undefined,
    teachingStyle: apiUser.teaching_style ? String(apiUser.teaching_style) : undefined,
    plan: apiUser.plan ? String(apiUser.plan) : undefined,
    creditsRemaining: apiUser.credits_remaining ? Number(apiUser.credits_remaining) : undefined,
  }
}
