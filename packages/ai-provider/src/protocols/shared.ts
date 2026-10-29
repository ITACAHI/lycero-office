/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import type { AgentMessage, AgentToolCall } from '@lycero/agent-core'
import type { AiTokenUsage, LyceroEditorModule, LyceroPipelineStage } from '../types'

// ---- endpoint URL composition ----

/**
 * Append a provider endpoint path to a base URL without string concatenation.
 *
 * A custom base URL may carry a query string (Azure-style `?api-version=…`,
 * gateways that pin a version) and a fragment. Concatenating would push the
 * path into the query component, so the request 404s or lands on the wrong
 * route. Setting `pathname` keeps the query in place and the fragment is
 * dropped — it is never sent to the server anyway.
 */
export function endpointUrl(baseUrl: string, path: string, search?: string): string {
  const url = new URL(baseUrl)
  const base = url.pathname.replace(/\/+$/, '')
  const suffix = path.replace(/^\/+/, '')
  url.pathname = suffix ? `${base}/${suffix}` : base
  url.hash = ''
  if (search !== undefined) url.search = search
  return url.toString()
}

// ---- streaming (SSE line splitting shared by all providers) ----

/** Max buffered SSE line: a gateway sending GB without newline would OOM main. */
export const MAX_SSE_LINE_BYTES = 4 * 1024 * 1024
export const MAX_RESPONSE_BODY_BYTES = MAX_SSE_LINE_BYTES

export class ResponseBodyTooLargeError extends Error {
  constructor(
    readonly receivedBytes: number,
    readonly capBytes: number,
  ) {
    super(`Response body exceeded the ${capBytes}-byte limit (${receivedBytes} bytes)`)
    this.name = 'ResponseBodyTooLargeError'
  }
}

export interface CappedReadOptions {
  maxBytes?: number
  onBytes?: () => void
  /** `truncate` keeps what fit under the cap and never throws (error-body diagnostics). */
  onOverflow?: 'throw' | 'truncate'
}

export async function readCappedResponseText(
  response: Response,
  options: (() => void) | CappedReadOptions = {},
): Promise<string> {
  const opts = typeof options === 'function' ? { onBytes: options } : options
  const maxBytes = opts.maxBytes ?? MAX_RESPONSE_BODY_BYTES
  const truncate = opts.onOverflow === 'truncate'
  const declaredBytes = Number(response.headers.get('content-length'))
  if (!truncate && Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    if (response.body) await response.body.cancel().catch(() => undefined)
    throw new ResponseBodyTooLargeError(declaredBytes, maxBytes)
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      opts.onBytes?.()
      const total = bytes + value.byteLength
      if (truncate && total >= maxBytes) {
        text += decoder.decode(value.subarray(0, maxBytes - bytes), { stream: true })
        break
      }
      if (total > maxBytes) throw new ResponseBodyTooLargeError(total, maxBytes)
      bytes += value.byteLength
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } catch (err) {
    // truncate mode reports whatever arrived: the caller is already reporting the status
    if (!truncate) throw err
    return text + decoder.decode()
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

/** Flatten an OpenAI `content` field to text: gateways may answer with a string or an array of parts. */
export function openAiContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const text = (part as { text?: unknown } | null)?.text
        return typeof text === 'string' ? text : ''
      })
      .join('')
  }
  return ''
}

export async function* sseLines(
  body: NodeJS.ReadableStream | ReadableStream<Uint8Array>,
  onBytes?: () => void,
): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  let lineBytes = 0
  const stream = body as ReadableStream<Uint8Array>
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      onBytes?.()
      for (const byte of value) {
        if (byte === 0x0a) {
          lineBytes = 0
          continue
        }
        lineBytes++
        if (lineBytes > MAX_SSE_LINE_BYTES) {
          throw new Error(
            `SSE line exceeded buffer limit (${lineBytes} bytes, cap ${MAX_SSE_LINE_BYTES}); the gateway sent a line without newline.`,
          )
        }
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) yield line
    }
    // Flush the decoder: bytes of a multibyte char still buffered inside
    // TextDecoder under { stream: true } are discarded without a final
    // decode() — a stream cut mid-char (dropped connection) would lose its
    // tail silently instead of surfacing the standard replacement mark.
    buffer += decoder.decode()
    if (buffer) yield buffer
  } finally {
    // The consumer may abandon this generator mid-stream (an in-band gateway
    // error thrown inside the for-await loop calls .return()). Without this
    // cleanup the reader stays locked and the underlying socket is not
    // returned to the pool until GC nondeterministically finalizes it.
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

/**
 * Per-tool streamed argument buffer cap: a provider streaming argument
 * fragments forever (never finishing) would otherwise grow the pending
 * tool-call buffer without bound. Throwing aborts the turn; sseLines
 * cancels the underlying stream on the way out.
 */
export const MAX_TOOL_JSON_CHARS = 512_000

export interface SseDataEvent {
  raw: string
  /** Parsed JSON body, undefined for a non-JSON payload such as `[DONE]` or a keep-alive. */
  json: unknown
}

/**
 * Frames the `data:` payloads of an SSE stream into whole events.
 *
 * A server may split one JSON body across several `data:` lines (one event, joined
 * with a newline), or close every event with a single newline and no blank line at
 * all. So a value that already parses as JSON is dispatched on its own and only
 * fragments are held back and joined. The parsed body rides along so callers do
 * not parse twice. `[DONE]` counts as whole: holding it back as a fragment left a
 * newline-only stream that keeps its socket open waiting forever.
 */
export async function* sseDataEvents(
  body: NodeJS.ReadableStream | ReadableStream<Uint8Array>,
  onBytes?: () => void,
): AsyncGenerator<SseDataEvent> {
  let parts: string[] = []
  const flush = (): SseDataEvent | undefined => {
    if (!parts.length) return undefined
    const raw = parts.join('\n')
    parts = []
    return { raw, json: parseJson(raw) }
  }
  for await (const line of sseLines(body, onBytes)) {
    if (!line.startsWith('data:')) {
      const held = flush()
      if (held) yield held
      continue
    }
    const raw = line.slice(5).trim()
    if (!raw) continue
    const json = parseJson(raw)
    if (raw === '[DONE]' || json !== undefined) {
      const held = flush()
      if (held) yield held
      yield { raw, json }
      continue
    }
    // Only a JSON opener starts a fragment; anything else alone is a keep-alive.
    if (!parts.length && !/^[[{]/.test(raw)) {
      yield { raw, json }
      continue
    }
    parts.push(raw)
    // Dispatch as soon as the joined fragments form a body, so a later keep-alive
    // is not glued onto it.
    const joined = parts.join('\n')
    const whole = parseJson(joined)
    if (whole !== undefined) {
      parts = []
      yield { raw: joined, json: whole }
    }
  }
  const held = flush()
  if (held) yield held
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

export function throwIfToolJsonOverBudget(jsonLength: number, provider: string): void {
  if (jsonLength > MAX_TOOL_JSON_CHARS) {
    throw new Error(
      `Tool call arguments exceeded the ${provider} buffer limit (${jsonLength} chars, cap ${MAX_TOOL_JSON_CHARS}); ` +
        'the provider kept streaming argument fragments without finishing. Ask for the output in several smaller parts.',
    )
  }
}

/**
 * Max tool calls started per streamed turn: per-argument bytes are capped
 * above, but a gateway could still stream 100k near-empty tool_use blocks
 * and grow the completed-call list without bound.
 */
export const MAX_STREAM_TOOL_CALLS = 100

export function throwIfToolCountOverBudget(count: number, provider: string): void {
  if (count > MAX_STREAM_TOOL_CALLS) {
    throw new Error(
      `Too many streamed tool calls (${count}, cap ${MAX_STREAM_TOOL_CALLS}) for ${provider}; ` +
        'the provider kept starting tool calls without finishing the turn.',
    )
  }
}

export interface StreamCallbacks {
  onDelta: (text: string) => void
  onToolCall: (call: AgentToolCall) => void
  /** raw model reasoning deltas (reasoning_content); stored so interleaved-thinking models get it echoed back */
  onReasoningDelta?: (text: string) => void
  /** normalized stop reason ('max_tokens' when the output was cut off by the token limit) */
  onStopReason?: (reason: string) => void
  /** tokens the provider billed for this turn; fires once at stream end when the provider reports usage at all */
  onUsage?: (usage: AiTokenUsage) => void
  /** bytes arrived on the wire (fires per network chunk, including SSE pings; used for keepalive) */
  onActivity?: () => void
  /** Stable renderer transport id for providers with native sessions. */
  sessionId?: string
  editorModule?: LyceroEditorModule | undefined
  pipelineStage?: LyceroPipelineStage | undefined
  activeSkillSlugs?: string[] | undefined
  userSkillConfig?: Record<string, unknown> | undefined
  signal: AbortSignal
}

const VALID_PIPELINE_STAGES = new Set<LyceroPipelineStage>([
  'chat',
  'doc_longform',
  'slide_style',
  'slide_outline',
  'slide_page_spec',
  'slide_edit',
  'sheet_formula',
])

const VALID_EDITOR_MODULES = new Set<LyceroEditorModule>([
  'office_docx',
  'office_sheet',
  'office_slide',
  'office_pdf',
  'office_markdown',
  'office_html',
])

export function isLyceroGatewayUrl(baseUrl: string): boolean {
  const lower = (baseUrl || '').toLowerCase()
  return (
    lower.includes('lycero.com') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('/api/v1/office')
  )
}

export interface ResolvedLyceroGatewayContext {
  editorModule: LyceroEditorModule
  pipelineStage: LyceroPipelineStage
  activeSkillSlugs: string[]
  headers: Record<string, string>
  bodyExtras: Record<string, unknown>
}

export function resolveLyceroGatewayContext(options: {
  baseUrl: string
  system: string
  messages?: readonly AgentMessage[] | undefined
  editorModule?: LyceroEditorModule | undefined
  pipelineStage?: LyceroPipelineStage | undefined
  activeSkillSlugs?: readonly string[] | undefined
  userSkillConfig?: Record<string, unknown> | undefined
  forceLyceroHeaders?: boolean | undefined
}): ResolvedLyceroGatewayContext {
  const {
    baseUrl,
    system,
    messages = [],
    editorModule: explicitModule,
    pipelineStage: explicitStage,
    activeSkillSlugs: explicitSlugs,
    userSkillConfig,
    forceLyceroHeaders = false,
  } = options

  // 1. Resolve pipelineStage from explicit option or [LYCERO_PIPELINE_STAGE:<stage>] tag in system
  let pipelineStage: LyceroPipelineStage =
    explicitStage && VALID_PIPELINE_STAGES.has(explicitStage) ? explicitStage : 'chat'
  const stageMatch = /\[LYCERO_PIPELINE_STAGE:([a-z0-9_-]+)\]/i.exec(system)
  if (!explicitStage && stageMatch?.[1]) {
    const candidate = stageMatch[1].toLowerCase() as LyceroPipelineStage
    if (VALID_PIPELINE_STAGES.has(candidate)) {
      pipelineStage = candidate
    }
  }

  // 2. Resolve editorModule from explicit option, pipelineStage prefix, or system prompt cues
  let editorModule: LyceroEditorModule = 'office_docx'
  if (explicitModule && VALID_EDITOR_MODULES.has(explicitModule)) {
    editorModule = explicitModule
  } else if (
    pipelineStage === 'slide_style' ||
    pipelineStage === 'slide_outline' ||
    pipelineStage === 'slide_page_spec' ||
    pipelineStage === 'slide_edit' ||
    /\b(1280x720|slide visual designer|deck planner|generate_deck|propose_operations|inspect_slide)\b/i.test(
      system,
    )
  ) {
    editorModule = 'office_slide'
  } else if (pipelineStage === 'doc_longform') {
    editorModule = 'office_docx'
  } else if (
    pipelineStage === 'sheet_formula' ||
    /\b(spreadsheet|workbook|worksheet|cell range|formula bar)\b/i.test(system)
  ) {
    editorModule = 'office_sheet'
  } else if (/\bpdf viewer|pdf document\b/i.test(system)) {
    editorModule = 'office_pdf'
  } else if (/\bmarkdown editor\b/i.test(system)) {
    editorModule = 'office_markdown'
  } else if (/\bhtml editor\b/i.test(system)) {
    editorModule = 'office_html'
  }

  // 3. Collect activeSkillSlugs from explicit list, <skill name="..."> blocks, and [LYCERO_CLOUD_SKILL:...] markers
  const slugs = new Set<string>()
  if (Array.isArray(explicitSlugs)) {
    for (const s of explicitSlugs) {
      if (typeof s === 'string' && s.trim()) slugs.add(s.trim())
    }
  }
  const scanText = (text: string) => {
    for (const m of text.matchAll(/<skill\s+name="([^"]+)">/g)) {
      if (m[1]?.trim()) slugs.add(m[1].trim())
    }
    for (const m of text.matchAll(/\[LYCERO_CLOUD_SKILL:([a-zA-Z0-9._-]+)\]/g)) {
      if (m[1]?.trim()) slugs.add(m[1].trim())
    }
  }
  if (system) scanText(system)
  for (const msg of messages) {
    if (msg.role === 'user' && msg.text) scanText(msg.text)
  }
  const activeSkillSlugs = [...slugs]

  const isLycero = forceLyceroHeaders || isLyceroGatewayUrl(baseUrl)
  const headers: Record<string, string> = isLycero
    ? {
        'X-Lycero-Editor-Module': editorModule,
        'X-Lycero-Pipeline-Stage': pipelineStage,
        ...(activeSkillSlugs.length > 0
          ? { 'X-Lycero-Active-Skills': activeSkillSlugs.join(',') }
          : {}),
      }
    : {}

  const bodyExtras: Record<string, unknown> = isLycero
    ? {
        editorModule,
        pipelineStage,
        ...(activeSkillSlugs.length > 0 ? { activeSkillSlugs } : {}),
        ...(userSkillConfig && Object.keys(userSkillConfig).length > 0 ? { userSkillConfig } : {}),
      }
    : {}

  return {
    editorModule,
    pipelineStage,
    activeSkillSlugs,
    headers,
    bodyExtras,
  }
}

/** Coerce a provider's usage figure (number on the wire, sometimes a numeric string) to a finite count. */
export function usageCount(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Models occasionally emit unescaped " inside string values (e.g. English quotes in Chinese copy).
 * Single-pass scan: a " inside a string whose next non-whitespace char is not structural gets escaped.
 */
function repairUnescapedQuotes(json: string): string {
  let out = ''
  let inStr = false
  for (let i = 0; i < json.length; i++) {
    const c = json[i]!
    if (!inStr) {
      if (c === '"') inStr = true
      out += c
      continue
    }
    if (c === '\\') {
      out += c + (json[++i] ?? '')
      continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < json.length && ' \n\r\t'.includes(json[j]!)) j++
      const next = json[j]
      if (next === undefined || ',}]:'.includes(next)) {
        inStr = false
        out += c
      } else {
        out += '\\"'
      }
      continue
    }
    out += c
  }
  return out
}

/**
 * Gateways can report failures (quota exhausted, moderation, upstream errors) inside a
 * 200 SSE stream, in shapes that don't match the provider protocol (e.g. an OpenAI-style
 * `{"error": ...}` event on the Anthropic route). Extract a readable message so these
 * surface as real errors instead of dissolving into an empty "successful" turn.
 */
export function sseErrorText(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
    try {
      return JSON.stringify(error)
    } catch {
      /* circular or otherwise unserializable — use the fallback */
    }
  }
  return fallback
}

/**
 * Gateways can answer a `stream: true` request with a complete non-SSE JSON body —
 * observed on the Lycero Anthropic route when credits are exhausted (HTTP 200,
 * Content-Type: application/json, the notice text inside a regular message). The SSE
 * parser would find no `data:` lines in such a body and dissolve it into an empty
 * "successful" turn. Returns the body text when that happens, else null.
 */
export async function jsonBodyInsteadOfSse(
  response: Response,
  onBytes?: () => void,
): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.toLowerCase().includes('application/json')
    ? readCappedResponseText(response, onBytes)
    : null
}

/**
 * A non-SSE JSON reply whose text is the gateway's credits-exhausted notice
 * (Lycero: "Your Lycero credits have been exhausted…") surfaces as a typed
 * error so the apps show a localized "top up" message (errorCode 'credits')
 * instead of the English notice as a normal assistant reply.
 */
export class AiCreditsError extends Error {
  constructor(notice: string) {
    super(notice)
    this.name = 'AiCreditsError'
  }
}

function creditsNoticeText(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.toLowerCase()
    const credits =
      t.includes('lycero.com/pricing') ||
      t.includes('lycero.ai/pricing') ||
      (t.includes('credit') && (t.includes('exhausted') || t.includes('insufficient')))
    return credits ? value : null
  }
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    for (const v of Object.values(value)) {
      const hit = creditsNoticeText(v)
      if (hit) return hit
    }
  }
  return null
}

export function throwIfCreditsNotice(bodyText: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    return // unparseable bodies are the emit helpers' problem
  }
  const notice = creditsNoticeText(parsed)
  if (notice) throw new AiCreditsError(notice)
}

/** Don't throw on parse failure (it would kill the whole stream); return error so the loop feeds it back for retry */
export function parseToolInput(json: string): { input: Record<string, unknown>; error?: string } {
  if (!json.trim()) return { input: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    try {
      parsed = JSON.parse(repairUnescapedQuotes(json))
    } catch {
      const msg = e instanceof Error ? e.message : String(e)
      return { input: {}, error: `${msg}; raw: ${json.slice(0, 500)}` }
    }
  }
  if (!isPlainObject(parsed)) {
    return { input: {}, error: `tool input must be a JSON object; raw: ${json.slice(0, 500)}` }
  }
  return { input: parsed }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
