/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import * as lyceroAuth from '@lycero/ai-auth/main'
import { AiQuotaExhaustedError } from '../quota-error'
import { aiFetch } from '../fetch'
import { isAiNetworkError } from '../network-error'
import { PiiTokenizer } from '../pii-tokenizer'
import { compactOutboundAgentTurn } from '../token-compactor'
import type { LyceroEditorModule, LyceroPipelineStage } from '../types'
import { AiTimeoutError, createStreamWatchdog } from '../watchdog'
import { resolveLyceroGatewayContext, sseLines, type StreamCallbacks } from './shared'
import type { AgentMessage, AgentToolDef } from '@lycero/agent-core'

export const MAX_HUB_RECONNECT_ATTEMPTS = 10

interface HubFinishPayload {
  type: 'finish'
  modelUsed?: string
  stopReason?: 'stop' | 'length' | 'tool_use'
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    computeUnits?: number
  }
  quotaRemaining?: number
  quotaLimit?: number
  quotaUsed?: number
}

interface HubTextPayload {
  type: 'text'
  delta: string
}

interface HubReasoningPayload {
  type: 'reasoning' | 'thinking'
  delta: string
}

interface HubToolCallPayload {
  type: 'tool_call'
  id?: string
  name: string
  arguments?: Record<string, unknown> | string
  input?: Record<string, unknown> | string
}

interface HubErrorPayload {
  type: 'error'
  message: string
}

interface HubStartPayload {
  type: 'start'
  streamId?: string
  model?: string
}

type HubPayload =
  | HubFinishPayload
  | HubTextPayload
  | HubReasoningPayload
  | HubToolCallPayload
  | HubErrorPayload
  | HubStartPayload

function restorePiiInValue(val: unknown, piiMap: Map<string, string>): unknown {
  if (piiMap.size === 0) return val
  if (typeof val === 'string') return PiiTokenizer.restore(val, piiMap)
  if (Array.isArray(val)) return val.map((item) => restorePiiInValue(item, piiMap))
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = restorePiiInValue(v, piiMap)
    }
    return out
  }
  return val
}

function buildMessages(
  system: string,
  messages: AgentMessage[],
  maskText: (txt: string) => string,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [
    { role: 'system', content: maskText(system) },
  ]
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({
        role: 'user',
        content: m.images?.length
          ? `[Hình ảnh đính kèm: ${m.images.length} file]`
          : maskText(m.text),
      })
    } else if (m.role === 'assistant') {
      const assistantMsg: Record<string, unknown> = {
        role: 'assistant',
        content: maskText(m.text || ''),
      }
      if (m.toolCalls && m.toolCalls.length > 0) {
        assistantMsg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: maskText(JSON.stringify(tc.input ?? {})),
          },
        }))
      }
      out.push(assistantMsg)
    } else {
      for (const r of m.results) {
        out.push({
          role: 'tool',
          tool_call_id: r.id,
          name: r.name,
          content: maskText(r.output),
        })
      }
    }
  }
  return out
}

export interface StreamHubChatParams {
  url: string
  modelId: string
  apiKey?: string | undefined
  system: string
  messages: AgentMessage[]
  tools: AgentToolDef[]
  cb: StreamCallbacks
  editorModule?: LyceroEditorModule | undefined
  pipelineStage?: LyceroPipelineStage | undefined
  activeSkillSlugs?: string[] | undefined
  userSkillConfig?: Record<string, unknown> | undefined
  enablePiiMasking?: boolean | undefined
  onQuotaUpdate?: ((quota: { remaining: number; limit?: number | undefined }) => void) | undefined
  maxAttempts?: number | undefined
  retryBaseDelayMs?: number | undefined
}

async function waitWithActivity(
  ms: number,
  signal?: AbortSignal | undefined,
  onActivity?: (() => void) | undefined,
): Promise<void> {
  if (ms <= 0 || signal?.aborted) return
  const stepMs = 1_000
  let remaining = ms
  while (remaining > 0 && !signal?.aborted) {
    const slice = Math.min(remaining, stepMs)
    await new Promise<void>((resolve) => {
      if (!signal) {
        setTimeout(resolve, slice)
        return
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }, slice)
      const onAbort = () => {
        clearTimeout(timer)
        resolve()
      }
      signal.addEventListener('abort', onAbort, { once: true })
    })
    remaining -= slice
    if (!signal?.aborted) onActivity?.()
  }
}

export async function streamHubChat(params: StreamHubChatParams): Promise<void> {
  const {
    url,
    modelId,
    apiKey,
    system,
    messages,
    tools,
    cb,
    editorModule,
    pipelineStage,
    activeSkillSlugs,
    userSkillConfig,
    enablePiiMasking = true,
    onQuotaUpdate,
    maxAttempts = MAX_HUB_RECONNECT_ATTEMPTS,
    retryBaseDelayMs = 1_000,
  } = params

  let accessToken = apiKey || lyceroAuth.lyceroAccessToken()
  if (!accessToken) throw new Error('Not signed in to Lycero')

  // Client-side PII Masking
  const piiMap = new Map<string, string>()
  const maskText = (txt: string): string => {
    if (!enablePiiMasking || !txt) return txt
    const { maskedText } = PiiTokenizer.mask(txt, piiMap)
    return maskedText
  }

  // Tier-1 Client Pre-Flight Token Compaction (Delta Deduplication + AST Viewport Slicing)
  const clientCompaction = compactOutboundAgentTurn(messages)
  const outboundMessages = buildMessages(system, clientCompaction.messages, maskText)
  const lyceroCtx = resolveLyceroGatewayContext({
    baseUrl: url,
    system,
    messages: clientCompaction.messages,
    editorModule: editorModule ?? cb.editorModule,
    pipelineStage: pipelineStage ?? cb.pipelineStage,
    activeSkillSlugs: activeSkillSlugs ?? cb.activeSkillSlugs,
    userSkillConfig: userSkillConfig ?? cb.userSkillConfig,
    forceLyceroHeaders: true,
  })

  const requestUrl = `${url.replace(/\/$/, '')}/ai/chat`
  const requestHeaders = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    Authorization: `Bearer ${accessToken}`,
    Cookie: `auth_token=${accessToken}`,
    'X-Agent-Type': 'lycero-office',
    'X-Lycero-Client-Compaction': clientCompaction.headerJson,
    ...lyceroCtx.headers,
  }
  const requestBody = JSON.stringify({
    productCode: 'office',
    modelId,
    ...lyceroCtx.bodyExtras,
    messages: outboundMessages,
    ...(tools.length > 0
      ? {
          tools: tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.inputSchema },
          })),
        }
      : {}),
    stream: true,
  })

  let authRetried = false
  const totalAttempts = Math.max(1, maxAttempts)
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    let emitted = false
    const wd = createStreamWatchdog(cb.signal)
    const onBytes = () => {
      wd.touch()
      cb.onActivity?.()
    }
    try {
      await wd.guard(async () => {
        const response = await aiFetch(requestUrl, {
          method: 'POST',
          signal: wd.signal,
          headers: requestHeaders,
          body: requestBody,
        })
        onBytes()

        if (response.status === 429) {
          let msg = 'Hạn ngạch AI tháng này đã hết. Vui lòng nâng cấp gói Pro.'
          try {
            const body = await response.text()
            const parsed = JSON.parse(body) as { error?: string; code?: string }
            msg = parsed.error || msg
          } catch {
            // use default
          }
          throw new AiQuotaExhaustedError(msg)
        }

        if (response.status === 401 && !authRetried) {
          authRetried = true
          try {
            lyceroAuth.resetLyceroAuthCache?.()
          } catch {}
          let liveToken = ''
          try {
            liveToken = lyceroAuth.lyceroAccessToken?.() ?? ''
          } catch {}
          let refreshedToken: string | null = null
          if (!liveToken || liveToken === accessToken) {
            try {
              refreshedToken = (await lyceroAuth.refreshAndGetToken?.()) ?? null
            } catch {}
          }
          const nextToken =
            liveToken && liveToken !== accessToken ? liveToken : refreshedToken
          if (nextToken && nextToken !== accessToken) {
            accessToken = nextToken
            requestHeaders.Authorization = `Bearer ${accessToken}`
            requestHeaders.Cookie = `auth_token=${accessToken}`
            throw new Error('__LYCERO_RETRY_NEW_TOKEN__')
          }
        }

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`)
        }

        const remainingHeader =
          response.headers?.get?.('x-quota-remaining') ??
          response.headers?.get?.('x-ratelimit-remaining')
        const limitHeader =
          response.headers?.get?.('x-quota-limit') ??
          response.headers?.get?.('x-ratelimit-limit')
        let initialQuotaLimit: number | undefined
        if (remainingHeader !== null && remainingHeader !== undefined) {
          const remaining = parseFloat(remainingHeader)
          const limit = limitHeader ? parseFloat(limitHeader) : undefined
          if (limit !== undefined && !Number.isNaN(limit)) initialQuotaLimit = limit
          if (!Number.isNaN(remaining)) {
            onQuotaUpdate?.({ remaining, limit })
          }
        }

        let sawFinish = false
        const unmaskDelta = PiiTokenizer.createStreamUnmasker(piiMap)
        const unmaskReasoning = PiiTokenizer.createStreamUnmasker(piiMap)

        for await (const rawLine of sseLines(response.body, onBytes)) {
          const line = rawLine.trim()
          if (!line) continue
          if (line.startsWith(':')) continue
          if (!line.startsWith('data:')) continue
          const dataValue = line.slice(5).trim()
          if (!dataValue) continue

          let payload: HubPayload
          try {
            payload = JSON.parse(dataValue) as HubPayload
          } catch {
            continue
          }

          switch (payload.type) {
            case 'text':
              emitted = true
              cb.onDelta(unmaskDelta(payload.delta))
              break
            case 'reasoning':
            case 'thinking':
              // Reasoning deltas do not mutate history or visible answer text;
              // keep `emitted = false` so a drop while thinking or buffering
              // tool_calls can reconnect up to 10 times seamlessly.
              cb.onReasoningDelta?.(
                unmaskReasoning(payload.delta).replace(
                  /Manus(?:\s+1\.6)?(?:\s+Orchestrator)?/gi,
                  'Lycero Super Model',
                ),
              )
              break
            case 'tool_call': {
              emitted = true
              const rawArgs = payload.input ?? payload.arguments ?? {}
              let parsedArgs: Record<string, unknown> = {}
              if (typeof rawArgs === 'string') {
                try {
                  const parsed = JSON.parse(rawArgs)
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    parsedArgs = parsed as Record<string, unknown>
                  }
                } catch {
                  parsedArgs = {}
                }
              } else if (rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)) {
                parsedArgs = rawArgs as Record<string, unknown>
              }
              const toolInput = restorePiiInValue(parsedArgs, piiMap) as Record<string, unknown>
              cb.onToolCall?.({
                id: payload.id || `call_${Date.now()}`,
                name: payload.name,
                input: toolInput,
              })
              break
            }
            case 'finish':
              sawFinish = true
              if (payload.usage || payload.quotaRemaining !== undefined) {
                cb.onUsage?.({
                  ...(payload.usage?.inputTokens !== undefined ? { inputTokens: payload.usage.inputTokens } : {}),
                  ...(payload.usage?.outputTokens !== undefined ? { outputTokens: payload.usage.outputTokens } : {}),
                  ...(payload.usage?.computeUnits !== undefined ? { computeUnits: payload.usage.computeUnits } : {}),
                  ...(payload.quotaRemaining !== undefined ? { quotaRemaining: payload.quotaRemaining } : {}),
                  ...(payload.quotaLimit !== undefined ? { quotaLimit: payload.quotaLimit } : {}),
                  ...(payload.quotaUsed !== undefined ? { quotaUsed: payload.quotaUsed } : {}),
                })
              }
              if (payload.quotaRemaining !== undefined && Number.isFinite(payload.quotaRemaining)) {
                onQuotaUpdate?.({
                  remaining: payload.quotaRemaining,
                  limit: payload.quotaLimit ?? initialQuotaLimit,
                })
              }
              cb.onStopReason?.(payload.stopReason || 'stop')
              break
            case 'error':
              onBytes()
              throw new Error(payload.message || 'Lỗi xử lý từ Cổng Trí tuệ Lycero.')
            case 'start':
              break
          }
        }

        if (!sawFinish) {
          throw new Error('Stream closed without a finish event')
        }
      })
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === '__LYCERO_RETRY_NEW_TOKEN__' && !cb.signal?.aborted) {
        attempt--
        continue
      }
      const isTransient =
        !emitted &&
        !cb.signal?.aborted &&
        !(err instanceof AiQuotaExhaustedError) &&
        (isAiNetworkError(err) ||
          err instanceof AiTimeoutError ||
          /^HTTP (408|425|500|502|503|504|520|521|522|523|524)\b/.test(msg) ||
          msg === 'Stream closed without a finish event' ||
          /timeout|timed out|overloaded|temporarily unavailable|connection|socket|terminated|ECONN|UND_ERR|Đã xảy ra lỗi khi tạo phản hồi/i.test(
            msg,
          ))
      if (isTransient && attempt < totalAttempts) {
        const delayMs =
          retryBaseDelayMs <= 0 ? 0 : Math.min(attempt * retryBaseDelayMs, retryBaseDelayMs * 6)
        await waitWithActivity(delayMs, cb.signal, cb.onActivity)
        if (cb.signal?.aborted) throw err
        continue
      }
      throw err
    }
  }
}
