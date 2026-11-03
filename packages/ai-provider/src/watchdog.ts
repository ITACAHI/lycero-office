/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Abort-linked watchdog for LLM requests: a connect timeout until the response
 * headers arrive, then an idle timeout re-armed on every received byte. A
 * silently stalled connection (dropped by a proxy/VPN/firewall without an RST)
 * otherwise leaves the request pending forever and the UI stuck busy.
 */

export const AI_CONNECT_TIMEOUT_MS = 60_000
/**
 * Idle timeout ("no bytes from server", counting pings and SSE heartbeats).
 * Re-armed on every received byte/event from the server.
 */
export const AI_IDLE_TIMEOUT_MS = 120_000
/**
 * FX-72: "No content delta" timeout (105s, within 90–120s).
 * Re-armed ONLY on real content deltas (text, reasoning, tool_call, or tool-arg fragments),
 * NEVER reset by SSE `: ping` heartbeats.
 */
export const AI_CONTENT_IDLE_TIMEOUT_MS = 105_000
/**
 * Hard wall-clock cap for a single streaming request (15 minutes), even if the
 * server keeps sending pings or partial deltas.
 */
export const AI_TOTAL_TIMEOUT_MS = 15 * 60_000
/** Non-streaming chat waits for the full generation before headers arrive */
export const AI_CHAT_RESPONSE_TIMEOUT_MS = 120_000
/**
 * Floor for watchdog timeouts. Values in (0, floor) are raised to the floor so
 * a tiny misconfigured timeout cannot instant-abort a healthy request.
 */
export const AI_WATCHDOG_MIN_TIMEOUT_MS = 1_000
/**
 * Cap for connect/idle watchdog timeouts. Infinite or huge values are lowered
 * to the cap so the watchdog still fires instead of going dead. Kept well below
 * the platform setTimeout overflow limit (2^31-1 ms).
 */
export const AI_WATCHDOG_MAX_TIMEOUT_MS = 600_000
/** Maximum wall-clock cap (20 minutes) for total stream runtime */
export const AI_WATCHDOG_MAX_TOTAL_TIMEOUT_MS = 20 * 60_000

/**
 * Normalize a watchdog timeout to a sane finite positive value.
 * Non-numbers, NaN, and values <= 0 fall back to the caller default;
 * Infinity and values above the cap are lowered to the cap;
 * small positives below the floor are raised to the floor.
 */
export function normalizeWatchdogTimeout(
  ms: number,
  fallbackMs: number,
  maxMs = AI_WATCHDOG_MAX_TIMEOUT_MS,
): number {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms <= 0) return fallbackMs
  if (!Number.isFinite(ms) || ms > maxMs) return maxMs
  if (ms < AI_WATCHDOG_MIN_TIMEOUT_MS) return AI_WATCHDOG_MIN_TIMEOUT_MS
  return ms
}

export type AiTimeoutKind = 'idle' | 'no_content' | 'total'

export class AiTimeoutError extends Error {
  readonly kind: AiTimeoutKind
  readonly timeoutMs: number

  constructor(ms: number, kind: AiTimeoutKind = 'idle') {
    const message =
      kind === 'total'
        ? `Yêu cầu chạy quá lâu (đã vượt giới hạn ${Math.max(1, Math.round(ms / 60_000))} phút).`
        : kind === 'no_content'
          ? `Máy chủ không phản hồi nội dung mới sau ${Math.round(ms / 1000)}s.`
          : `Máy chủ không phản hồi (không nhận được dữ liệu trong ${Math.round(ms / 1000)}s).`
    super(message)
    this.name = 'AiTimeoutError'
    this.kind = kind
    this.timeoutMs = ms
  }
}

export interface StreamWatchdog {
  /** pass to fetch: aborts on caller cancel or on timeout */
  signal: AbortSignal
  /** data arrived: switch to (and re-arm) the idle timeout */
  touch(): void
  /** content delta arrived (text, reasoning, tool_call, tool-arg delta): re-arm both idle and no-content timeout */
  touchContent(): void
  /** run the request; a timeout abort surfaces as AiTimeoutError; always disposes the timer */
  guard<T>(run: () => Promise<T>): Promise<T>
}

export function createStreamWatchdog(
  parent?: AbortSignal,
  connectMs = AI_CONNECT_TIMEOUT_MS,
  idleMs = AI_IDLE_TIMEOUT_MS,
  totalMs = AI_TOTAL_TIMEOUT_MS,
  contentIdleMs?: number,
): StreamWatchdog {
  const normalizedConnectMs = normalizeWatchdogTimeout(connectMs, AI_CONNECT_TIMEOUT_MS)
  const normalizedIdleMs = normalizeWatchdogTimeout(idleMs, AI_IDLE_TIMEOUT_MS)
  const normalizedTotalMs = normalizeWatchdogTimeout(
    totalMs,
    AI_TOTAL_TIMEOUT_MS,
    AI_WATCHDOG_MAX_TOTAL_TIMEOUT_MS,
  )
  const normalizedContentIdleMs =
    contentIdleMs !== undefined
      ? normalizeWatchdogTimeout(contentIdleMs, AI_CONTENT_IDLE_TIMEOUT_MS)
      : undefined
  const controller = new AbortController()
  let timedOutAfter = 0
  let timedOutKind: AiTimeoutKind = 'idle'
  let timer: ReturnType<typeof setTimeout> | undefined
  let contentTimer: ReturnType<typeof setTimeout> | undefined
  let totalTimer: ReturnType<typeof setTimeout> | undefined
  const arm = (ms: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timedOutAfter = ms
      timedOutKind = 'idle'
      clearTimeout(contentTimer)
      clearTimeout(totalTimer)
      controller.abort()
    }, ms)
  }
  const armContent = () => {
    if (normalizedContentIdleMs === undefined) return
    clearTimeout(contentTimer)
    contentTimer = setTimeout(() => {
      timedOutAfter = normalizedContentIdleMs
      timedOutKind = 'no_content'
      clearTimeout(timer)
      clearTimeout(totalTimer)
      controller.abort()
    }, normalizedContentIdleMs)
  }
  const onParentAbort = () => controller.abort()
  if (parent?.aborted) controller.abort()
  else parent?.addEventListener('abort', onParentAbort, { once: true })
  arm(normalizedConnectMs)
  totalTimer = setTimeout(() => {
    timedOutAfter = normalizedTotalMs
    timedOutKind = 'total'
    clearTimeout(timer)
    clearTimeout(contentTimer)
    controller.abort()
  }, normalizedTotalMs)
  return {
    signal: controller.signal,
    touch: () => {
      arm(normalizedIdleMs)
      if (normalizedContentIdleMs !== undefined && contentTimer === undefined) {
        armContent()
      }
    },
    touchContent: () => {
      arm(normalizedIdleMs)
      armContent()
    },
    async guard<T>(run: () => Promise<T>): Promise<T> {
      try {
        return await run()
      } catch (e) {
        if (timedOutAfter > 0) throw new AiTimeoutError(timedOutAfter, timedOutKind)
        throw e
      } finally {
        clearTimeout(timer)
        clearTimeout(contentTimer)
        clearTimeout(totalTimer)
        parent?.removeEventListener('abort', onParentAbort)
      }
    },
  }
}
