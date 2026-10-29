/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Lycero Search & Media CLI integration — search / image generation /
 * media analysis / upload / transcription.
 *
 * Execution: the main process spawns the CLI's JS entry with
 * ELECTRON_RUN_AS_NODE=1 so Electron itself acts as Node (the variable is a
 * no-op in a plain Node environment), avoiding the Windows problem where
 * .cmd files cannot be passed to execFile.
 *
 * Auth: gskApiKey() below. When not logged in, hasGskAuth() returns false and
 * callers should fall back to other implementations (e.g. Serper search).
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  asRecord,
  firstItem,
  gskProxyUrl,
  isCopyrightHost,
  safeHost,
  type ImageSearchResult,
  type WebSearchResult,
} from './shared'
import { getLyceroUserInfo, lyceroApiKey } from './lycero-auth'
import {
  lyceroAnalyzeMedia,
  lyceroGenerateImage,
  lyceroImageSearch,
  lyceroTranscribe,
  lyceroWebSearch,
} from './lycero-gateway'

const SEARCH_TIMEOUT_MS = 60_000
const GENERATE_TIMEOUT_MS = 600_000
const MAX_BUFFER = 32 * 1024 * 1024

/**
 * JS entry of Lycero CLI.
 * Note: Direct CLI child-process execution is deprecated in favor of Lycero Gateway HTTP endpoints.
 */
export function resolveGskEntry(): string | null {
  return process.env.LYCERO_CLI_PATH ?? process.env.GSK_CLI_PATH ?? null
}

let compatPath: string | null | undefined

/**
 * Under Electron-as-Node, Commander.js sees process.versions.electron and
 * parses argv with Electron conventions (skipping one argument fewer), so it
 * treats the entry path as a command and prints help. Workaround: --require a
 * script that deletes versions.electron. In a plain Node environment
 * (tests/tsx) no handling is needed and an empty array is returned.
 */
function electronCompatArgs(): string[] {
  if (!process.versions.electron) return []
  if (compatPath === undefined) {
    try {
      const dir = join(homedir(), '.lycero-office', 'bin')
      mkdirSync(dir, { recursive: true })
      compatPath = join(dir, 'electron-compat.js')
      writeFileSync(compatPath, 'delete process.versions.electron;\n')
    } catch {
      compatPath = null
    }
  }
  return compatPath ? ['--require', compatPath] : []
}

/**
 * API key for Lycero / tool_cli auth; '' when not logged in.
 */
export function gskApiKey(): string {
  if (process.env.LYCERO_API_KEY) return process.env.LYCERO_API_KEY
  if (process.env.GSK_API_KEY) return process.env.GSK_API_KEY
  return lyceroApiKey()
}

/**
 * Whether Lycero authentication is usable.
 * Set AI_SEARCH_DISABLE_GSK=1 or AI_SEARCH_DISABLE_LYCERO=1 to force-disable.
 */
export function hasGskAuth(): boolean {
  if (process.env.AI_SEARCH_DISABLE_GSK === '1' || process.env.AI_SEARCH_DISABLE_LYCERO === '1') return false
  return !!gskApiKey()
}

// ── Child-process proxy plumbing ────────────────────────────────────

// The main process's undici dispatcher (see the apps' proxy bootstraps) never
// reaches child processes: without forwarding they dial the central endpoint directly.
export { setGskProxyUrl, gskProxyUrl } from './shared'

/**
 * env for gsk CLI children: Electron-as-Node plus proxy forwarding. The CLI
 * uses Node's built-in fetch, which ignores proxy env vars unless
 * NODE_USE_ENV_PROXY=1 (Node >= 24 — Electron 41 ships Node 24). Only
 * http(s):// proxies are forwarded; undici's env proxy cannot speak SOCKS.
 */
export function gskChildEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, ELECTRON_RUN_AS_NODE: '1' }
  const proxy = [
    gskProxyUrl(),
    base.HTTPS_PROXY,
    base.https_proxy,
    base.HTTP_PROXY,
    base.http_proxy,
    base.ALL_PROXY,
    base.all_proxy,
  ].find((v) => v && /^https?:\/\//.test(v))
  if (proxy) {
    // scrub inherited variants: undici's env proxy prefers the lowercase
    // names, so a leftover https_proxy/all_proxy would override the selection
    delete env.https_proxy
    delete env.http_proxy
    delete env.ALL_PROXY
    delete env.all_proxy
    env.NODE_USE_ENV_PROXY = '1'
    env.HTTPS_PROXY = proxy
    env.HTTP_PROXY = proxy
  }
  return env
}

// ── Low-level execution ─────────────────────────────────────────────

/**
 * gsk output may have [INFO] log lines mixed in before or after the JSON;
 * scan for a line starting with { or [ and parse the longest valid JSON
 * block from there, shrinking past any trailing logs.
 */
export function parseGskOutput(stdout: string): unknown {
  const trimmed = stdout.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    /* fall through to line-by-line scan */
  }
  const lines = trimmed.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim()
    if (line.startsWith('{') || line.startsWith('[')) {
      for (let j = lines.length; j > i; j--) {
        try {
          return JSON.parse(lines.slice(i, j).join('\n'))
        } catch {
          continue
        }
      }
    }
  }
  throw new Error(`No JSON found in gsk output: ${stdout.slice(0, 300)}`)
}

function runGsk(_args: string[], _timeoutMs: number, _signal?: AbortSignal): Promise<unknown> {
  return Promise.reject(new Error('Hệ sinh thái Lycero: runGsk không còn được sử dụng.'))
}

// ── Search ──────────────────────────────────────────────────────────

/** Parses the `gsk search` response shape data.organic_results[{title,link,snippet}] (exported for tests) */
export function parseGskWebSearch(
  raw: unknown,
  maxResults: number,
): { results: WebSearchResult[]; answer?: string } {
  const data = asRecord(asRecord(raw).data ?? raw)
  const organic: unknown[] = Array.isArray(data.organic_results) ? data.organic_results : []
  const results: WebSearchResult[] = organic.slice(0, maxResults).map((item) => {
    const o = asRecord(item)
    return {
      title: String(o.title ?? ''),
      url: String(o.link ?? ''),
      snippet: String(o.snippet ?? ''),
    }
  })
  const answer = typeof data.answer === 'string' && data.answer ? data.answer : undefined
  return answer !== undefined ? { results, answer } : { results }
}

export async function gskWebSearch(
  query: string,
  maxResults = 6,
): Promise<{ results: WebSearchResult[]; answer?: string }> {
  return lyceroWebSearch(query, maxResults)
}

/** Parses the `gsk img-search` response shape data[{image_url,title,source,link,width,height}] (exported for tests) */
export function parseGskImageSearch(raw: unknown, maxResults: number): ImageSearchResult[] {
  const dataRaw = asRecord(raw).data
  const data: unknown[] = Array.isArray(dataRaw) ? dataRaw : []
  const images: ImageSearchResult[] = []
  for (const item of data) {
    const img = asRecord(item)
    const imageUrl = String(img.image_url ?? img.imageUrl ?? '')
    if (!imageUrl) continue
    if (isCopyrightHost(imageUrl)) continue
    const width = Number(img.width)
    const height = Number(img.height)
    const entry: ImageSearchResult = {
      title: String(img.title ?? ''),
      imageUrl,
      sourceUrl: String(img.link ?? ''),
      source: String(img.source ?? safeHost(img.link)),
    }
    if (Number.isFinite(width) && width > 0) entry.width = width
    if (Number.isFinite(height) && height > 0) entry.height = height
    images.push(entry)
    if (images.length >= maxResults) break
  }
  return images
}

export async function gskImageSearch(query: string, maxResults = 8): Promise<ImageSearchResult[]> {
  return lyceroImageSearch(query, maxResults)
}

// ── Image generation ────────────────────────────────────────────────

export interface GskGenerateImageOptions {
  /** Image description (English works better; text that must appear in the image stays verbatim) */
  prompt: string
  /** Generation model; defaults to the Lycero default. Special-purpose: fal-bria-rmbg background removal, fal-ai/recraft-clarity-upscale upscaling, flux-pro/outpaint outpainting */
  model?: string
  /** Reference/edit-target image URLs */
  referenceImageUrls?: string[]
  /** 1:1 | 4:3 | 16:9 | 9:16 | 3:4 | 2:3 | 3:2 | auto */
  aspectRatio?: string
  /** auto | 0.5k | 1k | 2k | 3k | 4k */
  imageSize?: string
  signal?: AbortSignal
}

export interface GskGeneratedImage {
  /** Watermark-free image URL (preferred); can be downloaded and inserted directly */
  url: string
  taskId: string
}

/** Parses `gsk img` results: prefers data.generated_images[].image_urls_nowatermark (exported for tests) */
export function parseGskGeneratedImage(raw: unknown): GskGeneratedImage {
  const data = asRecord(asRecord(raw).data ?? raw)
  const img = asRecord(firstItem(data.generated_images ?? data.images ?? []))
  const url = firstItem(img.image_urls_nowatermark) ?? firstItem(img.image_urls) ?? img.url ?? ''
  if (!url) {
    throw new Error(`gsk image generation returned no result: ${JSON.stringify(raw).slice(0, 200)}`)
  }
  return { url: String(url), taskId: String(img.task_id ?? '') }
}

export async function gskGenerateImage(
  options: GskGenerateImageOptions,
  signal?: AbortSignal,
): Promise<GskGeneratedImage> {
  const gen = await lyceroGenerateImage(options, signal ?? options.signal)
  return {
    url: gen.url,
    taskId: gen.taskId ?? '',
  }
}

/**
 * Returns downloadable link for generated files.
 */
export async function gskResolveDownloadUrl(url: string): Promise<string> {
  return url
}

// ── Cloud single-slide generation (Lycero slide_generate) ───────────

/**
 * Calls the tool_cli HTTP endpoint directly so structured params
 * (deck_context/images) are sent as JSON.
 */
const GSK_TOOL_CLI_BASE =
  process.env.LYCERO_TOOL_CLI_BASE ||
  (process.env.LYCERO_API_URL ? `${process.env.LYCERO_API_URL.replace(/\/$/, '')}/api/v1/office/tool_cli` : undefined) ||
  'https://lycero.com/api/v1/office/tool_cli'
const SLIDE_GENERATE_TIMEOUT_MS = 240_000

export interface GskSlideGenerateOptions {
  /** Content and layout brief for this page */
  brief: string
  title?: string
  /** Deck-level visual system / typography / palette rules (Style Skill text) */
  styleSkill?: string
  /** Deck topic, page index, total pages, neighboring-page context */
  deckContext?: Record<string, unknown>
  /** HTTPS image candidates for this page */
  images?: { url: string; caption?: string }[]
  width?: number
  height?: number
  /** Slides model tier: ultra = opus-class model, standard (server default) = lighter model */
  tier?: 'standard' | 'ultra'
  signal?: AbortSignal
}

/** Final NDJSON line = the result; heartbeat lines have no status field */
export function parseToolCliNdjson(text: string): Record<string, unknown> {
  const lines = text.trim().split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim()
    if (!line.startsWith('{')) continue
    try {
      const obj: unknown = JSON.parse(line)
      if (obj && typeof obj === 'object' && 'status' in obj) return obj as Record<string, unknown>
    } catch {
      continue
    }
  }
  throw new Error(`No result line in tool_cli response: ${text.slice(0, 300)}`)
}

async function toolCliPost(
  path: string,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<unknown> {
  const key = gskApiKey()
  if (!key) throw new Error('Not logged in to Lycero (lycero login)')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const resp = await fetch(`${GSK_TOOL_CLI_BASE}${path}`, {
      method: 'POST',
      // X-Agent-Type splits GenOffice usage out of the proxy's "Claw" billing bucket
      headers: {
        'X-Api-Key': key,
        'Content-Type': 'application/json',
        'X-Agent-Type': 'lycero-office',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await resp.text()
    if (!resp.ok) throw new Error(`tool_cli ${path} HTTP ${resp.status}: ${text.slice(0, 200)}`)
    const result = parseToolCliNdjson(text)
    if (result.status !== 'ok') {
      throw new Error(`tool_cli ${path} failed: ${result.message ?? result.status}`)
    }
    return result.data
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Generates one editable slide in the cloud (brief → HTML → one-slide PPTX)
 * and returns the downloaded PPTX bytes plus the model that produced it.
 */
export async function gskSlideGenerate(
  options: GskSlideGenerateOptions,
): Promise<{ bytes: Uint8Array; model: string }> {
  const { signal } = options
  const body: Record<string, unknown> = { brief: options.brief }
  if (options.title) body.title = options.title
  if (options.styleSkill) body.style_skill = options.styleSkill
  if (options.deckContext) body.deck_context = options.deckContext
  if (options.images?.length) body.images = options.images
  if (options.width) body.width = options.width
  if (options.height) body.height = options.height
  if (options.tier) body.tier = options.tier
  const data = asRecord(
    await toolCliPost('/slide_generate', body, SLIDE_GENERATE_TIMEOUT_MS, signal),
  )
  const pptxUrl = data.pptx_url
  if (!pptxUrl)
    throw new Error(`slide_generate returned no pptx_url: ${JSON.stringify(data).slice(0, 200)}`)
  // The bare file-wrapper URL 403s on plain GET; swap for a signed direct link first
  const dl = asRecord(
    await toolCliPost('/file/download', { file_wrapper_url: pptxUrl }, SEARCH_TIMEOUT_MS, signal),
  )
  const downloadUrl = dl.download_url
  if (!downloadUrl) throw new Error('file/download returned no download_url')
  const resp = await fetch(String(downloadUrl), signal ? { signal } : undefined)
  if (!resp.ok) throw new Error(`PPTX download failed: HTTP ${resp.status}`)
  return { bytes: new Uint8Array(await resp.arrayBuffer()), model: String(data.model ?? '') }
}

// ── Media analysis / transcription ──────────────────────────────────

/** Best-effort text extraction from gsk analysis-type command output (shape varies by task, so be lenient; exported for tests) */
export function extractGskText(raw: unknown): string {
  const data = asRecord(raw).data ?? raw
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    for (const key of [
      'analysis',
      'analysis_result',
      'result',
      'content',
      'text',
      'answer',
      'transcript',
    ]) {
      const v = (data as Record<string, unknown>)[key]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return JSON.stringify(data ?? raw)
}

export interface GskAnalyzeMediaOptions {
  /** Media URLs or local paths (image/audio/video) */
  mediaUrls: string[]
  /** Analysis requirements (in English): what info to extract and what it's for */
  requirements: string
}

export async function gskAnalyzeMedia(
  options: GskAnalyzeMediaOptions,
  signal?: AbortSignal,
): Promise<string> {
  return lyceroAnalyzeMedia(options, signal)
}
export const lyceroAnalyzeMediaCompat = gskAnalyzeMedia

export interface GskTranscribeOptions {
  /** Audio URLs or local paths */
  audioUrls: string[]
  /** Prompt (context / proper nouns; can improve recognition quality) */
  prompt?: string
  /** whisper-1 | gemini-3-flash-preview | elevenlabs_scribe_v2 */
  model?: string
}

export async function gskTranscribe(
  options: GskTranscribeOptions,
  signal?: AbortSignal,
): Promise<string> {
  return lyceroTranscribe(options, signal)
}
export const lyceroTranscribeCompat = gskTranscribe

// ── Past projects (Lycero web) ──────────────────────────────────────

export interface GskPastProject {
  projectId: string
  /** raw project type, e.g. 'slides_agent_git' */
  type: string
  title: string
  /** creation time, ISO-like string from the API */
  ctime: string
  /** relative web URL, e.g. '/agents?id=...' — join with https://lycero.com */
  projectUrl: string
}

export interface GskPastProjectsPage {
  projects: GskPastProject[]
  total: number
  hasMore: boolean
}

/**
 * Parses `gsk projects`. data.projects lacks project_url — it only appears in
 * session_state.past_projects — so take it from there, falling back to
 * deriving it from the project id. (exported for tests)
 */
export function parseGskPastProjects(raw: unknown): GskPastProjectsPage {
  const rec = asRecord(raw)
  const data = asRecord(rec.data ?? raw)
  const urlById = new Map<string, string>()
  const sessionProjects = asRecord(asRecord(rec.session_state).past_projects).projects
  if (Array.isArray(sessionProjects)) {
    for (const item of sessionProjects) {
      const p = asRecord(item)
      if (p.project_id && typeof p.project_url === 'string' && p.project_url) {
        urlById.set(String(p.project_id), p.project_url)
      }
    }
  }
  const listRaw: unknown[] = Array.isArray(data.projects) ? data.projects : []
  const projects: GskPastProject[] = []
  for (const item of listRaw) {
    const p = asRecord(item)
    const projectId = String(p.project_id ?? '')
    if (!projectId) continue
    projects.push({
      projectId,
      type: String(p.type ?? ''),
      title: String(p.title ?? ''),
      ctime: String(p.ctime ?? ''),
      projectUrl: urlById.get(projectId) ?? `/agents?id=${projectId}`,
    })
  }
  const total = Number(data.total)
  return {
    projects,
    total: Number.isFinite(total) ? total : projects.length,
    hasMore: data.has_more === true,
  }
}

export interface GskListPastProjectsOptions {
  /** 'slides' | 'docs' | 'sheets' | ...; omit for all kinds */
  artifactTypes?: string[]
  /** page size, default 20, max 100 */
  limit?: number
  offset?: number
  signal?: AbortSignal
}

/** Lists the user's own past Lycero web projects, newest first (`lycero projects`). */
export async function gskListPastProjects(
  options: GskListPastProjectsOptions = {},
): Promise<GskPastProjectsPage> {
  try {
    const key = gskApiKey()
    if (!key) return { projects: [], total: 0, hasMore: false }
    const url = new URL('https://lycero.com/api/v1/office/projects')
    if (options.limit !== undefined) url.searchParams.set('limit', String(options.limit))
    if (options.offset !== undefined) url.searchParams.set('offset', String(options.offset))
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
      ...(options.signal ? { signal: options.signal } : {}),
    })
    if (!resp.ok) return { projects: [], total: 0, hasMore: false }
    const json = await resp.json()
    return parseGskPastProjects(json)
  } catch {
    return { projects: [], total: 0, hasMore: false }
  }
}
export const lyceroListPastProjects = gskListPastProjects

export interface GskLoginInfo {
  email: string
  plan: string
  creditBalance?: number
}

/** Current Lycero login info; null when not logged in or profile is unavailable */
export async function gskLoginInfo(): Promise<GskLoginInfo | null> {
  const user = getLyceroUserInfo()
  if (user?.email) {
    return {
      email: user.email,
      plan: user.plan ?? 'Lycero Member',
    }
  }
  return null
}

/** Lycero-named alias of gskLoginInfo */
export const lyceroLoginInfo = gskLoginInfo
export const lycLoginInfo = gskLoginInfo


export const MAX_GSK_RESULTS = 20
export const MAX_GSK_SNIPPET_CHARS = 2000

export function summarizeGskFailure(raw: unknown, fallback = 'unknown error'): string {
  const text = (typeof raw === 'string' ? raw : raw == null ? '' : String(raw)).trim()
  if (!text) return fallback
  const isHtml = /<!doctype|<html[\s>]|<\/html>|<body[\s>]/i.test(text)
  if (!isHtml) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const errors = lines.filter((l) => /^\[ERROR\]/i.test(l))
    const kept = errors.length ? errors : lines.filter((l) => !/^\[INFO\]/i.test(l))
    const joined = (kept.length ? kept : lines).join(' ')
    return joined.length > 300 ? `${joined.slice(0, 300)}…` : joined
  }
  const plain = text
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:[a-z][a-z0-9]*|#\d+|#x[0-9a-f]+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^HTTP\s+\d{3}\s*:?\s*/i, '')
    .trim()
  const head = /HTTP\s+(\d{3})/.exec(text)?.[1]
  const label = head ? `HTTP ${head} (HTML error page)` : 'an HTML error page'
  if (!plain) return label
  return `${label}: ${plain.length > 200 ? `${plain.slice(0, 200)}…` : plain}`
}
