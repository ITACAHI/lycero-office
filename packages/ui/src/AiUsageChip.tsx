/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '@lycero/i18n'
import type { AgentTokenUsage } from '@lycero/agent-core'
import { useDismissablePopover } from './popover-dismiss'
import { AI_USAGE_LABELS } from './strings-ai-usage'
import './ai-usage.css'

/** usage figures a chip can render (structural: agent-core's AgentTokenUsage satisfies it) */
export type AiTokenUsageView = AgentTokenUsage

export interface QuotaWindowData {
  used: number
  limit: number
  remaining: number
  percentUsed: number
  percentRemaining: number
  resetAt: string
}

export interface ChatQuotaStatus {
  loggedIn: boolean
  email?: string | undefined
  tier?: 'free' | 'plus' | 'pro' | 'enterprise' | undefined
  creditBalance?: number | undefined
  fiveHoursQuota?: QuotaWindowData | undefined
  weeklyQuota?: QuotaWindowData | undefined
  monthlyQuota?: QuotaWindowData | undefined
  lastSyncedAt?: string | undefined
}

/** 1234 → "1.2k", 1234567 → "1.2M"; smaller counts stay verbatim. */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

/** Add one turn's reported usage into an accumulator; sides the provider never
 * reported stay absent instead of turning into fake zeros. */
export function addTokenUsage(
  prev: AgentTokenUsage | undefined,
  delta: AgentTokenUsage,
): AgentTokenUsage {
  const out: AgentTokenUsage = { ...(prev ?? {}) }
  if (delta.inputTokens !== undefined) out.inputTokens = (out.inputTokens ?? 0) + delta.inputTokens
  if (delta.outputTokens !== undefined)
    out.outputTokens = (out.outputTokens ?? 0) + delta.outputTokens
  return out
}

const DEFAULT_FIVE_HOURS: QuotaWindowData = {
  used: 0,
  limit: 25,
  remaining: 25,
  percentUsed: 0,
  percentRemaining: 100,
  resetAt: '',
}

const DEFAULT_WEEKLY: QuotaWindowData = {
  used: 0,
  limit: 60,
  remaining: 60,
  percentUsed: 0,
  percentRemaining: 100,
  resetAt: '',
}

const DEFAULT_MONTHLY: QuotaWindowData = {
  used: 0,
  limit: 200,
  remaining: 200,
  percentUsed: 0,
  percentRemaining: 100,
  resetAt: '',
}

function normalizeWindow(raw: unknown, fallback: QuotaWindowData): QuotaWindowData {
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Record<string, unknown>
  const limit = Number(r.limit)
  if (!Number.isFinite(limit) || limit <= 0) return fallback
  const used = Math.max(0, Number(r.used ?? 0) || 0)
  const remaining =
    r.remaining !== undefined && Number.isFinite(Number(r.remaining))
      ? Math.max(0, Number(r.remaining))
      : Math.max(0, limit - used)
  const percentUsed =
    r.percentUsed !== undefined && Number.isFinite(Number(r.percentUsed))
      ? Math.min(100, Math.max(0, Math.round(Number(r.percentUsed) * 10) / 10))
      : Math.min(100, Math.round((used / limit) * 1000) / 10)
  const percentRemaining =
    r.percentRemaining !== undefined && Number.isFinite(Number(r.percentRemaining))
      ? Math.min(100, Math.max(0, Math.round(Number(r.percentRemaining) * 10) / 10))
      : Math.max(0, Math.round((100 - percentUsed) * 10) / 10)
  const resetAt = typeof r.resetAt === 'string' ? r.resetAt : ''
  return { used, limit, remaining, percentUsed, percentRemaining, resetAt }
}

async function queryHostQuotaStatus(sync = false): Promise<ChatQuotaStatus | null> {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, Record<string, unknown> | undefined>
  const arg = sync ? 'sync' : true

  try {
    // 1. Shell Home bridge (if available)
    if (sync && typeof w.aiOffice?.accountSync === 'function') {
      const res = (await (w.aiOffice.accountSync as () => Promise<unknown>)()) as Record<
        string,
        unknown
      > | null
      if (res && typeof res === 'object') {
        return {
          loggedIn: Boolean(res.loggedIn),
          email: typeof res.email === 'string' ? res.email : undefined,
          tier: (res.tier as ChatQuotaStatus['tier']) ?? 'free',
          creditBalance: typeof res.creditBalance === 'number' ? res.creditBalance : undefined,
          fiveHoursQuota: normalizeWindow(res.fiveHoursQuota, DEFAULT_FIVE_HOURS),
          weeklyQuota: normalizeWindow(res.weeklyQuota, DEFAULT_WEEKLY),
          monthlyQuota: normalizeWindow(res.monthlyQuota, DEFAULT_MONTHLY),
          lastSyncedAt: typeof res.lastSyncedAt === 'string' ? res.lastSyncedAt : undefined,
        }
      }
    }

    // 2. Unified ai:gsk-status across Docs, Sheets, Slides, PDF, Markdown, HTML, Shell
    const statusFn =
      w.desktop?.aiGskStatus ??
      w.desktopApi?.aiGskStatus ??
      w.slidesApi?.aiGskStatus ??
      w.pdfApi?.gskStatus ??
      w.markdownApi?.aiGskStatus ??
      w.htmlApi?.aiGskStatus ??
      w.aiOffice?.aiGskStatus

    if (typeof statusFn === 'function') {
      const res = (await (statusFn as (a?: unknown) => Promise<unknown>)(arg)) as Record<
        string,
        unknown
      > | null
      if (res && typeof res === 'object') {
        return {
          loggedIn: Boolean(res.loggedIn),
          email: typeof res.email === 'string' ? res.email : undefined,
          tier: (res.tier as ChatQuotaStatus['tier']) ?? 'free',
          creditBalance: typeof res.creditBalance === 'number' ? res.creditBalance : undefined,
          fiveHoursQuota: normalizeWindow(res.fiveHoursQuota, DEFAULT_FIVE_HOURS),
          weeklyQuota: normalizeWindow(res.weeklyQuota, DEFAULT_WEEKLY),
          monthlyQuota: normalizeWindow(res.monthlyQuota, DEFAULT_MONTHLY),
          lastSyncedAt: typeof res.lastSyncedAt === 'string' ? res.lastSyncedAt : undefined,
        }
      }
    }
  } catch {
    // Ignore IPC errors in test/offline environments
  }
  return null
}

function quotaTone(percentUsed: number): 'ok' | 'warn' | 'danger' {
  if (percentUsed >= 95) return 'danger'
  if (percentUsed >= 80) return 'warn'
  return 'ok'
}

function formatResetShort(iso: string, isVi: boolean): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return isVi ? ` · Làm mới ${day}/${month}` : ` · Resets ${day}/${month}`
}

/**
 * Circular 5-Hour Quota indicator in the chat composer footer.
 * Clicking opens a popover showing 5-Hour, Weekly, and Monthly quota metrics.
 * Per-message usage chips (`session` omitted/false) render nothing so raw token
 * numbers do not clutter the conversation.
 */
export function AiUsageChip({
  usage,
  session,
  lang,
}: {
  readonly usage?: AgentTokenUsage | undefined
  /** session-level placement in the composer footer */
  readonly session?: boolean | undefined
  readonly lang: Lang
}): React.JSX.Element | null {
  const [quota, setQuota] = useState<ChatQuotaStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  const refreshQuota = useCallback((sync = false) => {
    if (sync) setSyncing(true)
    void queryHostQuotaStatus(sync)
      .then((res) => {
        if (res) setQuota(res)
      })
      .finally(() => {
        if (sync) setSyncing(false)
      })
  }, [])

  useEffect(() => {
    if (!session) return
    refreshQuota(false)
    const onFocus = () => refreshQuota(false)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [session, refreshQuota])

  // Whenever an AI turn finishes and updates sessionUsage, refresh the quota ring (debounced)
  useEffect(() => {
    if (!session) return
    if (usage?.inputTokens !== undefined || usage?.outputTokens !== undefined) {
      const timer = window.setTimeout(() => refreshQuota(true), 600)
      return () => window.clearTimeout(timer)
    }
  }, [session, usage?.inputTokens, usage?.outputTokens, refreshQuota])

  const close = useCallback(() => setOpen(false), [])
  useDismissablePopover(open, close, {
    inside: () => [btnRef.current, popRef.current],
  })

  // Hide per-message token counters; only render the 5-hour quota ring in the composer footer
  if (!session) return null

  const isVi = lang === 'vi'
  const fiveHours = quota?.fiveHoursQuota ?? DEFAULT_FIVE_HOURS
  const weekly = quota?.weeklyQuota ?? DEFAULT_WEEKLY
  const monthly = quota?.monthlyQuota ?? DEFAULT_MONTHLY

  const pctUsed = Math.min(100, Math.max(0, Math.round(fiveHours.percentUsed)))
  const tone = quotaTone(fiveHours.percentUsed)
  const weeklyTone = quotaTone(weekly.percentUsed)
  const monthlyTone = quotaTone(monthly.percentUsed)

  const tierRaw = quota?.tier ?? 'free'
  const tierLabel =
    tierRaw === 'enterprise'
      ? 'ENTERPRISE'
      : tierRaw === 'pro'
        ? 'PRO'
        : tierRaw === 'plus'
          ? 'PLUS'
          : 'FREE'

  // SVG circle geometry (r=5.5 -> circumference ≈ 34.56)
  const radius = 5.5
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - ( Math.max(pctUsed > 0 ? 4 : 0, pctUsed) / 100 ) * circumference

  const togglePopover = () => {
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect()
      if (rect) {
        const popWidth = 284
        const maxLeft = Math.max(8, window.innerWidth - popWidth - 12)
        setPopStyle({
          left: Math.min(Math.max(8, rect.left), maxLeft),
          bottom: window.innerHeight - rect.top + 8,
        })
      }
      refreshQuota(false)
    }
    setOpen((v) => !v)
  }

  const tooltip = isVi
    ? `Hạn mức phiên 5 giờ: Đã dùng ${pctUsed}% (Còn lại ${fiveHours.percentRemaining}%) — Bấm để xem chi tiết Quota`
    : `5-Hour session quota: ${pctUsed}% used (${fiveHours.percentRemaining}% remaining) — Click for Quota details`

  void AI_USAGE_LABELS

  return (
    <div
      className="ai-quota-widget"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
          btnRef.current?.focus()
        }
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className={`ai-quota-ring-btn tone-${tone}${open ? ' open' : ''}`}
        onClick={togglePopover}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={tooltip}
        aria-label={tooltip}
      >
        <svg
          className="ai-quota-ring-svg"
          width="15"
          height="15"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <circle
            className="ai-quota-ring-track"
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            strokeWidth="2"
          />
          <circle
            className={`ai-quota-ring-fill tone-${tone}`}
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 8 8)"
          />
        </svg>
        <span className="ai-quota-ring-text">5h · {pctUsed}%</span>
      </button>

      {open && (
        <div
          ref={popRef}
          className="ai-quota-popover"
          role="dialog"
          aria-label={isVi ? 'Chỉ số hạn mức AI' : 'AI Quota Metrics'}
          style={popStyle}
        >
          <div className="ai-quota-pop-head">
            <div className="ai-quota-pop-title-group">
              <span className="ai-quota-pop-title">
                {isVi ? 'Hạn mức sử dụng AI' : 'AI Usage Quota'}
              </span>
              <span className={`ai-quota-tier-badge tier-${tierRaw}`}>{tierLabel}</span>
            </div>
            <button
              type="button"
              className="ai-quota-sync-btn"
              disabled={syncing}
              onClick={() => refreshQuota(true)}
              title={isVi ? 'Đồng bộ hạn mức mới nhất từ máy chủ' : 'Sync latest quota from server'}
            >
              <svg
                className={syncing ? 'ai-quota-spin' : ''}
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M13.5 8a5.5 5.5 0 1 1-1.6-3.88M13.5 2.5v3h-3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{syncing ? (isVi ? 'Đang tải' : 'Syncing') : isVi ? 'Làm mới' : 'Sync'}</span>
            </button>
          </div>

          <div className="ai-quota-pop-list">
            {/* 1. 5-Hour Session Window */}
            <div className="ai-quota-pop-item featured">
              <div className="ai-quota-pop-row">
                <span className="ai-quota-pop-label">
                  {isVi ? 'Phiên 5 giờ (5h Session)' : '5-Hour Session'}
                </span>
                <span className={`ai-quota-pop-pct tone-${tone}`}>
                  {isVi ? `${fiveHours.percentUsed}% đã dùng` : `${fiveHours.percentUsed}% used`}
                </span>
              </div>
              <div className="ai-quota-bar-track">
                <div
                  className={`ai-quota-bar-fill tone-${tone}`}
                  style={{
                    width: `${Math.max(fiveHours.percentUsed > 0 ? 3 : 0, Math.min(100, fiveHours.percentUsed))}%`,
                  }}
                />
              </div>
              <div className="ai-quota-pop-sub">
                <span>
                  {isVi
                    ? `Còn lại ${fiveHours.percentRemaining}% (${fiveHours.remaining}/${fiveHours.limit} lượt)`
                    : `${fiveHours.percentRemaining}% left (${fiveHours.remaining}/${fiveHours.limit})`}
                </span>
                <span>{isVi ? 'Chu kỳ 5 giờ' : '5h rolling'}</span>
              </div>
            </div>

            {/* 2. Weekly Quota Window */}
            <div className="ai-quota-pop-item">
              <div className="ai-quota-pop-row">
                <span className="ai-quota-pop-label">
                  {isVi ? 'Hạn mức Tuần' : 'Weekly Quota'}
                </span>
                <span className={`ai-quota-pop-pct tone-${weeklyTone}`}>
                  {isVi ? `${weekly.percentUsed}% đã dùng` : `${weekly.percentUsed}% used`}
                </span>
              </div>
              <div className="ai-quota-bar-track">
                <div
                  className={`ai-quota-bar-fill tone-${weeklyTone}`}
                  style={{
                    width: `${Math.max(weekly.percentUsed > 0 ? 3 : 0, Math.min(100, weekly.percentUsed))}%`,
                  }}
                />
              </div>
              <div className="ai-quota-pop-sub">
                <span>
                  {isVi
                    ? `Còn lại ${weekly.percentRemaining}% (${weekly.remaining}/${weekly.limit} lượt)`
                    : `${weekly.percentRemaining}% left (${weekly.remaining}/${weekly.limit})`}
                </span>
                <span>
                  {formatResetShort(weekly.resetAt, isVi).replace(/^ · /, '') ||
                    (isVi ? 'Theo tuần' : 'Weekly')}
                </span>
              </div>
            </div>

            {/* 3. Monthly Quota Window */}
            <div className="ai-quota-pop-item">
              <div className="ai-quota-pop-row">
                <span className="ai-quota-pop-label">
                  {isVi ? 'Hạn mức Tháng' : 'Monthly Quota'}
                </span>
                <span className={`ai-quota-pop-pct tone-${monthlyTone}`}>
                  {isVi ? `${monthly.percentUsed}% đã dùng` : `${monthly.percentUsed}% used`}
                </span>
              </div>
              <div className="ai-quota-bar-track">
                <div
                  className={`ai-quota-bar-fill tone-${monthlyTone}`}
                  style={{
                    width: `${Math.max(monthly.percentUsed > 0 ? 3 : 0, Math.min(100, monthly.percentUsed))}%`,
                  }}
                />
              </div>
              <div className="ai-quota-pop-sub">
                <span>
                  {isVi
                    ? `Còn lại ${monthly.percentRemaining}% (${monthly.remaining}/${monthly.limit} lượt)`
                    : `${monthly.percentRemaining}% left (${monthly.remaining}/${monthly.limit})`}
                </span>
                <span>
                  {formatResetShort(monthly.resetAt, isVi).replace(/^ · /, '') ||
                    (isVi ? 'Theo tháng' : 'Monthly')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
