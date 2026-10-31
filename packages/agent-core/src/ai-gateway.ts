/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Central Model Gateway Client Service:
 * Handles the three core cloud integration interfaces:
 * 1. Capabilities Synchronization: GET /api/v1/office/desktop/capabilities
 * 2. Streaming AI Conversations:   POST /api/v1/office/ai/chat (SSE streaming)
 * 3. Reverse Proxy Tool Execution: POST /api/v1/office/desktop/tools/execute
 */

import {
  CloudCapabilitiesManager,
  DEFAULT_CAPABILITIES_GATEWAY_URL,
  type CloudCapabilitiesResponse,
  type CloudCapabilitiesSyncResult,
} from './cloud-capabilities'
import {
  DEFAULT_TOOL_DISPATCHER_URL,
  type CloudToolExecuteResponse,
} from './cloud-tool-dispatcher'

export const DEFAULT_LYCERO_GATEWAY_URL = 'https://lycero.com'
export const DEFAULT_CHAT_GATEWAY_URL = `${DEFAULT_LYCERO_GATEWAY_URL}/api/v1/office/ai/chat`

export type AiChatMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AiChatMessageContentPart[]
  images?: Array<{ mime: string; base64: string; url?: string }>
}

export interface AiChatStreamPayload {
  model?: string | undefined
  messages: AiChatMessage[]
  temperature?: number | undefined
  maxTokens?: number | undefined
  activeSkillSlugs?: string[] | undefined
  userSkillConfig?: Record<string, Record<string, unknown>> | undefined
  stream?: boolean | undefined
  [key: string]: unknown
}

export interface AiChatChunk {
  text: string
  delta: string
  reasoningDelta?: string | undefined
}

export interface AiChatStreamController {
  abort: () => void
}

export interface AiGatewayOptions {
  gatewayBaseUrl?: string | undefined
  capabilitiesUrl?: string | undefined
  chatUrl?: string | undefined
  toolsUrl?: string | undefined
  getAccessToken?: (() => string | null | undefined) | undefined
}

export class AiGatewayService {
  private gatewayBaseUrl: string
  private capabilitiesUrl: string
  private chatUrl: string
  private toolsUrl: string
  private getAccessToken?: (() => string | null | undefined) | undefined
  private capabilitiesManager: CloudCapabilitiesManager
  private cachedCapabilities: CloudCapabilitiesResponse | null = null

  constructor(options?: AiGatewayOptions) {
    this.gatewayBaseUrl =
      options?.gatewayBaseUrl ??
      (typeof process !== 'undefined' && process.env?.LYCERO_GATEWAY_URL
        ? process.env.LYCERO_GATEWAY_URL
        : DEFAULT_LYCERO_GATEWAY_URL)

    this.capabilitiesUrl =
      options?.capabilitiesUrl ?? `${this.gatewayBaseUrl}/api/v1/office/desktop/capabilities`
    this.chatUrl = options?.chatUrl ?? `${this.gatewayBaseUrl}/api/v1/office/ai/chat`
    this.toolsUrl =
      options?.toolsUrl ?? `${this.gatewayBaseUrl}/api/v1/office/desktop/tools/execute`

    this.getAccessToken = options?.getAccessToken ?? undefined
    this.capabilitiesManager = new CloudCapabilitiesManager({
      gatewayUrl: this.capabilitiesUrl,
    })
  }

  public getCapabilitiesManager(): CloudCapabilitiesManager {
    return this.capabilitiesManager
  }

  /**
   * 1. GET /api/v1/office/desktop/capabilities
   * Fetches the Opaque Manifest of all registered skills and MCP tool endpoints.
   * Caches in-memory and persistent storage with offline fallback.
   */
  public async fetchCapabilities(options?: {
    forceRefresh?: boolean
    token?: string
  }): Promise<CloudCapabilitiesSyncResult> {
    const token = options?.token ?? this.getAccessToken?.() ?? undefined

    // Zero-lag in-memory check if not forcing refresh
    if (!options?.forceRefresh && this.cachedCapabilities) {
      return {
        ok: true,
        fromCache: true,
        skills: this.cachedCapabilities.skills,
        mcpEndpoints: this.cachedCapabilities.mcpEndpoints ?? [],
      }
    }

    const syncOptions: {
      gatewayUrl?: string
      token?: string
      forceRefresh?: boolean
    } = {
      gatewayUrl: this.capabilitiesUrl,
    }
    if (token) syncOptions.token = token
    if (options?.forceRefresh !== undefined) syncOptions.forceRefresh = options.forceRefresh

    const syncResult = await this.capabilitiesManager.syncCapabilities(syncOptions)

    if (syncResult.ok) {
      this.cachedCapabilities = {
        skills: syncResult.skills,
        mcpEndpoints: syncResult.mcpEndpoints,
      }
    }

    return syncResult
  }

  /**
   * 2. POST /api/v1/office/ai/chat
   * Dispatches conversation payload with SSE streaming.
   * Parses chunks line-by-line and extracts both response content and deep reasoning thinking deltas.
   * Ensures memory is cleaned up completely upon completion.
   */
  public streamChatCompletion(
    payload: AiChatStreamPayload,
    onChunk: (chunk: AiChatChunk) => void,
    onDone: (fullText: string) => void,
    onError: (error: Error) => void,
    signal?: AbortSignal,
  ): AiChatStreamController {
    const internalAbort = new AbortController()

    const onExternalAbort = () => internalAbort.abort()
    if (signal) {
      if (signal.aborted) {
        internalAbort.abort()
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true })
      }
    }

    // Execute async SSE fetch in background
    ;(async () => {
      let accumulatedText = ''
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

      try {
        const token = this.getAccessToken?.() ?? undefined
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-Agent-Type': 'lycero-office',
        }
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        const bodyPayload = {
          ...payload,
          stream: true,
        }

        const response = await fetch(this.chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
          signal: internalAbort.signal,
        })

        if (!response.ok) {
          const errText = await response.text().catch(() => '')
          throw new Error(
            `Máy chủ phản hồi mã lỗi ${response.status}${errText ? `: ${errText}` : ''}`,
          )
        }

        if (!response.body) {
          throw new Error('Máy chủ không trả về luồng dữ liệu (empty response body).')
        }

        reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line || line.startsWith(':')) continue // Ignore empty or heartbeat comment lines

            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim()
              if (dataStr === '[DONE]') {
                // End of stream signaled
                break
              }

              try {
                const parsed = JSON.parse(dataStr)
                let deltaText = ''
                let reasoningDelta: string | undefined

                // Extract OpenAI / Lycero delta
                if (parsed.choices && parsed.choices[0]?.delta) {
                  const d = parsed.choices[0].delta
                  if (typeof d.content === 'string') {
                    deltaText = d.content
                  }
                  if (typeof d.reasoning_content === 'string') {
                    reasoningDelta = d.reasoning_content
                  } else if (typeof d.reasoning === 'string') {
                    reasoningDelta = d.reasoning
                  } else if (typeof d.thinking === 'string') {
                    reasoningDelta = d.thinking
                  }
                }
                // Extract Anthropic delta
                else if (parsed.type === 'content_block_delta' && parsed.delta) {
                  if (typeof parsed.delta.text === 'string') {
                    deltaText = parsed.delta.text
                  }
                  if (typeof parsed.delta.thinking === 'string') {
                    reasoningDelta = parsed.delta.thinking
                  }
                }
                // Direct fallback
                else if (typeof parsed.delta === 'string') {
                  deltaText = parsed.delta
                } else if (typeof parsed.text === 'string') {
                  deltaText = parsed.text
                }

                if (deltaText || reasoningDelta) {
                  accumulatedText += deltaText
                  const chunk: AiChatChunk = {
                    text: accumulatedText,
                    delta: deltaText,
                  }
                  if (reasoningDelta !== undefined) {
                    chunk.reasoningDelta = reasoningDelta
                  }
                  onChunk(chunk)
                }
              } catch {
                // Not JSON, treat as raw text token if present
                if (dataStr) {
                  accumulatedText += dataStr
                  onChunk({
                    text: accumulatedText,
                    delta: dataStr,
                  })
                }
              }
            }
          }
        }

        onDone(accumulatedText)
      } catch (err) {
        if (!internalAbort.signal.aborted) {
          onError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        // Free RAM immediately after turn concludes (DoD 5)
        if (reader) {
          try {
            await reader.cancel()
          } catch {
            // Reader cancel safe ignore
          }
          reader = null
        }
        if (signal) {
          signal.removeEventListener('abort', onExternalAbort)
        }
      }
    })()

    return {
      abort: () => internalAbort.abort(),
    }
  }

  /**
   * 2b. Direct MCP execution against the endpoint the Hub published.
   *
   * The Hub advertises real MCP URLs (e.g. https://mcp.lycero.com/office/sse).
   * Talking to them directly keeps the round trip short and lets the MCP server
   * hold the secrets — Desktop only ever sends the Bearer token it already has.
   *
   * Returns null when there is no direct endpoint, so the caller can fall back
   * to executeProxyTool without paying for a failed request first.
   */
  public async executeMcpToolDirect(
    serverKey: string,
    toolName: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CloudToolExecuteResponse | null> {
    const endpoint = this.cachedCapabilities?.mcpEndpoints?.find(
      (e) => e.serverKey === serverKey,
    )
    if (!endpoint?.endpointUrl) return null

    // Only speak to first-party hosts directly; anything org-private keeps
    // using the Hub proxy so internal URLs are never contacted from the client.
    let host: string
    try {
      host = new URL(endpoint.endpointUrl).hostname
    } catch {
      return null
    }
    if (host !== 'mcp.lycero.com' && host !== 'api.typesafe.ai') return null

    const token = this.getAccessToken?.() ?? undefined
    if (!token) return null

    try {
      const res = await fetch(endpoint.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${token}`,
          'MCP-Protocol-Version': '2026-07-28',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
        ...(signal ? { signal } : {}),
      })

      if (!res.ok) return null

      // Direct MCP returns JSON-RPC; the Hub proxy returns its own envelope.
      // Normalise to the shape the Desktop UI already consumes.
      const payload = (await res.json()) as {
        result?: { content?: Array<{ type: string; text: string }>; isError?: boolean }
        error?: { message?: string }
      }
      if (payload.error) return null

      const parts = payload.result?.content ?? []
      const text = parts.map((p) => p.text).join('\n')
      return {
        ok: !(payload.result?.isError ?? false),
        result: text,
        ...(payload.result?.isError ? { error: parts[0]?.text ?? 'Công cụ không thành công.' } : {}),
      }
    } catch (err) {
      if (signal?.aborted) {
        return { ok: false, error: 'Thao tác thực thi công cụ đã được hủy.' }
      }
      // Network failure or non-JSON response: let the caller use the proxy.
      void err
      return null
    }
  }

  /**
   * 3. POST /api/v1/office/desktop/tools/execute
   * Reverse proxy dispatcher for remote MCP and OpenXML tools.
   * Kept as the fallback path when a direct MCP endpoint is unavailable.
   */
  public async executeProxyTool(
    serverKey: string,
    toolName: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CloudToolExecuteResponse> {
    try {
      const token = this.getAccessToken?.() ?? undefined
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Agent-Type': 'lycero-office',
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const reqInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify({
          serverKey,
          toolName,
          arguments: args,
        }),
      }
      if (signal) {
        reqInit.signal = signal
      }

      const res = await fetch(this.toolsUrl, reqInit)

      if (!res.ok) {
        return {
          ok: false,
          error: `Không thể kết nối dịch vụ công cụ trên đám mây (${res.status}).`,
        }
      }

      const data = (await res.json()) as CloudToolExecuteResponse
      return data
    } catch (err) {
      if (signal?.aborted) {
        return {
          ok: false,
          error: 'Thao tác thực thi công cụ đã được hủy.',
        }
      }
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Đã xảy ra sự cố khi kết nối tới Cổng công cụ Lycero.',
      }
    }
  }

  /**
   * Preferred tool path: direct MCP first, Hub reverse proxy as fallback.
   * Quota and audit stay on the Hub either way because the MCP server is
   * authenticated with the same Bearer token and reports back through the Hub.
   */
  public async executeTool(
    serverKey: string,
    toolName: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CloudToolExecuteResponse> {
    const direct = await this.executeMcpToolDirect(serverKey, toolName, args, signal)
    if (direct) return direct
    return this.executeProxyTool(serverKey, toolName, args, signal)
  }
}

/** Global default instance for convenience */
export const defaultAiGatewayService = new AiGatewayService()
