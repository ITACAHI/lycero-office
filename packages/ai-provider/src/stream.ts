/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import type { AgentMessage, AgentToolDef } from '@lycero/agent-core'
import { isAiNetworkError } from './network-error'
import { withOutputCapFallback } from './output-cap'
import { streamAnthropic } from './protocols/anthropic'
import { streamGemini } from './protocols/gemini'
import { streamOpenAiCompatible } from './protocols/openai-compatible'
import { streamCodexAppServer } from './codex-app-server'
import { MAX_HUB_RECONNECT_ATTEMPTS, streamHubChat } from './protocols/hub-lycero'
import type { StreamCallbacks } from './protocols/shared'
import { getProviderAdapter, type AiProtocol } from './registry'
import type { AiProviderConfig, AiProviderId } from './types'

export { streamAnthropic } from './protocols/anthropic'
export { streamGemini } from './protocols/gemini'
export { streamOpenAiCompatible } from './protocols/openai-compatible'
export { MAX_HUB_RECONNECT_ATTEMPTS, streamHubChat } from './protocols/hub-lycero'
export { AiCreditsError, sseLines, throwIfCreditsNotice, parseToolInput } from './protocols/shared'
export { AiQuotaExhaustedError, isAiQuotaExhaustedError } from './quota-error'
export type { StreamCallbacks } from './protocols/shared'

export const MAX_STREAM_RECONNECT_ATTEMPTS = MAX_HUB_RECONNECT_ATTEMPTS

async function runWithNetworkReconnect(
  cb: StreamCallbacks,
  runAttempt: (trackedCb: StreamCallbacks) => Promise<void>,
  maxAttempts = MAX_STREAM_RECONNECT_ATTEMPTS,
  retryBaseDelayMs = 1_000,
): Promise<void> {
  const totalAttempts = Math.max(1, maxAttempts)
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    let emitted = false
    const trackedCb: StreamCallbacks = {
      ...cb,
      onDelta: (text) => {
        emitted = true
        cb.onDelta(text)
      },
      onToolCall: (call) => {
        emitted = true
        cb.onToolCall(call)
      },
    }
    try {
      await runAttempt(trackedCb)
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isTransient =
        !emitted &&
        !cb.signal?.aborted &&
        (isAiNetworkError(err) || /^HTTP (502|503|504|520|521|522|523|524)\b/.test(msg))
      if (isTransient && attempt < totalAttempts) {
        const delayMs =
          retryBaseDelayMs <= 0 ? 0 : Math.min(attempt * retryBaseDelayMs, retryBaseDelayMs * 6)
        if (delayMs > 0) {
          await new Promise<void>((resolve) => {
            if (!cb.signal) {
              setTimeout(resolve, delayMs)
              return
            }
            const timer = setTimeout(() => {
              cb.signal?.removeEventListener('abort', onAbort)
              resolve()
            }, delayMs)
            const onAbort = () => {
              clearTimeout(timer)
              resolve()
            }
            cb.signal.addEventListener('abort', onAbort, { once: true })
          })
        }
        if (cb.signal?.aborted) throw err
        cb.onActivity?.()
        continue
      }
      throw err
    }
  }
}

/** route a streaming, tool-calling-capable turn by provider id */
export async function streamForProvider(
  provider: AiProviderId,
  config: AiProviderConfig,
  system: string,
  messages: AgentMessage[],
  tools: AgentToolDef[],
  maxTokens: number,
  cb: StreamCallbacks,
  options?: {
    activeSkillSlugs?: string[] | undefined
    userSkillConfig?: Record<string, unknown> | undefined
    maxAttempts?: number | undefined
    retryBaseDelayMs?: number | undefined
  },
): Promise<void> {
  const endpoint = getProviderAdapter(provider).resolveEndpoint(config)
  const { baseUrl } = endpoint
  if (endpoint.model) config = { ...config, model: endpoint.model }
  if (endpoint.protocol === 'codex-app-server') {
    return streamCodexAppServer(config, system, messages, tools, maxTokens, cb)
  }
  // A model the user declared a ceiling for outranks the caller's budget; the
  // endpoint's own 400 would otherwise cost a billed round trip.
  const cap = endpoint.maxTokens !== undefined ? Math.min(maxTokens, endpoint.maxTokens) : maxTokens
  const protocol: Exclude<AiProtocol, 'codex-app-server'> = endpoint.protocol
  return withOutputCapFallback(baseUrl, config.model, cap, (tokens) => {
    switch (protocol) {
      case 'anthropic':
        return runWithNetworkReconnect(
          cb,
          (trackedCb) =>
            streamAnthropic(config, system, messages, tools, tokens, trackedCb, baseUrl, {
              headers: endpoint.headers,
              idleTimeoutMs: endpoint.idleTimeoutMs,
            }),
          options?.maxAttempts,
          options?.retryBaseDelayMs,
        )
      case 'gemini':
        return runWithNetworkReconnect(
          cb,
          (trackedCb) =>
            streamGemini(config, system, messages, tools, tokens, trackedCb, baseUrl, {
              omitTemperature: endpoint.omitTemperature,
              headers: endpoint.headers,
              idleTimeoutMs: endpoint.idleTimeoutMs,
            }),
          options?.maxAttempts,
          options?.retryBaseDelayMs,
        )
      case 'openai-compatible':
        return runWithNetworkReconnect(
          cb,
          (trackedCb) =>
            streamOpenAiCompatible(baseUrl, config, system, messages, tools, tokens, trackedCb, {
              omitTemperature: endpoint.omitTemperature,
              useMaxCompletionTokens: endpoint.useMaxCompletionTokens,
              bodyExtras: endpoint.bodyExtras,
              echoReasoning: endpoint.echoReasoning,
              headers: endpoint.headers,
              idleTimeoutMs: endpoint.idleTimeoutMs,
            }),
          options?.maxAttempts,
          options?.retryBaseDelayMs,
        )
      case 'hub-lycero':
        return streamHubChat({
          url: baseUrl,
          modelId: config.model,
          apiKey: config.apiKey,
          system,
          messages,
          tools,
          cb,
          activeSkillSlugs: options?.activeSkillSlugs ?? cb.activeSkillSlugs,
          userSkillConfig: options?.userSkillConfig ?? cb.userSkillConfig,
          maxAttempts: options?.maxAttempts,
          retryBaseDelayMs: options?.retryBaseDelayMs,
        })
    }
  })
}
