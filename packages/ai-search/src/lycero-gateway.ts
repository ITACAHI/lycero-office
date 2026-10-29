/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { asRecord, firstItem, type ImageSearchResult, type WebSearchResult } from "./shared"
import { lyceroApiKey } from "./lycero-auth"

const LYCERO_GATEWAY_BASE = process.env.LYCERO_GATEWAY_URL || "https://lycero.com"
const GATEWAY_API_BASE = `${LYCERO_GATEWAY_BASE}/api/v1/office/ai`
const SEARCH_TIMEOUT_MS = 60_000
const GENERATE_TIMEOUT_MS = 600_000

// ── Auth ──────────────────────────────────────────────────────────────

function getLyceroApiKey(): string {
  if (process.env.LYCERO_API_KEY) return process.env.LYCERO_API_KEY
  return lyceroApiKey()
}

export function hasLyceroAuth(): boolean {
  if (process.env.AI_SEARCH_DISABLE_LYCERO === "1") return false
  return !!getLyceroApiKey()
}

export function lyceroChildEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base }
  const proxy = [
    base.HTTPS_PROXY,
    base.https_proxy,
    base.HTTP_PROXY,
    base.http_proxy,
  ].find((v) => v && /^https?:\/\//.test(v))
  if (proxy) {
    delete env.https_proxy
    delete env.http_proxy
    env.HTTPS_PROXY = proxy
    env.HTTP_PROXY = proxy
  }
  return env
}

// ── HTTP helpers ─────────────────────────────────────────────────────

async function gatewayFetch<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<T> {
  const key = getLyceroApiKey()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(`${GATEWAY_API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    const json = await resp.json()
    const rec = asRecord(json)
    if (!resp.ok) {
      const msg = typeof rec.error === 'string' ? rec.error : (typeof rec.message === 'string' ? rec.message : `HTTP ${resp.status}`)
      throw new Error(msg)
    }
    if (rec.status && rec.status !== "ok") {
      throw new Error(typeof rec.message === 'string' ? rec.message : String(rec.status))
    }
    return json as T
  } finally {
    clearTimeout(timer)
  }
}

// ── Search ───────────────────────────────────────────────────────────

export interface LyceroSearchResponse {
  results: WebSearchResult[]
  answer?: string
}

export async function lyceroWebSearch(
  query: string,
  maxResults = 6,
): Promise<LyceroSearchResponse> {
  const data = await gatewayFetch<{ data?: unknown }>(
    "/search",
    {
      method: "POST",
      body: JSON.stringify({ query, maxResults }),
    },
    SEARCH_TIMEOUT_MS,
  )
  return parseLyceroSearch(data.data, maxResults)
}

export function parseLyceroSearch(raw: unknown, maxResults: number): LyceroSearchResponse {
  const data = asRecord(raw ?? {})
  const organic: unknown[] = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.organic_results)
      ? data.organic_results
      : []
  const results: WebSearchResult[] = organic.slice(0, maxResults).map((item) => {
    const o = asRecord(item)
    return {
      title: String(o.title ?? ""),
      url: String(o.url ?? o.link ?? ""),
      snippet: String(o.snippet ?? o.content ?? ""),
    }
  })
  const answer =
    typeof data.answer === "string" && data.answer ? data.answer : undefined
  return answer !== undefined ? { results, answer } : { results }
}

export async function lyceroImageSearch(
  query: string,
  maxResults = 8,
): Promise<ImageSearchResult[]> {
  const data = await gatewayFetch<{ data?: unknown }>(
    "/search/image",
    {
      method: "POST",
      body: JSON.stringify({ query, maxResults }),
    },
    SEARCH_TIMEOUT_MS,
  )
  return parseLyceroImageSearch(data.data, maxResults)
}

export function parseLyceroImageSearch(
  raw: unknown,
  maxResults: number,
): ImageSearchResult[] {
  const rec = asRecord(raw)
  const data = Array.isArray(raw)
    ? raw
    : Array.isArray(rec.results)
      ? rec.results
      : Array.isArray(rec.data)
        ? rec.data
        : []
  const images: ImageSearchResult[] = []
  for (const item of data as unknown[]) {
    const img = asRecord(item)
    const imageUrl = String(
      img.imageUrl ?? img.image_url ?? img.imageURL ?? "",
    )
    if (!imageUrl) continue
    const entry: ImageSearchResult = {
      title: String(img.title ?? ""),
      imageUrl,
      sourceUrl: String(
        img.sourceUrl ?? img.source_url ?? img.link ?? "",
      ),
      source: String(img.source ?? ""),
    }
    if (typeof img.width === "number") entry.width = img.width
    if (typeof img.height === "number") entry.height = img.height
    images.push(entry)
    if (images.length >= maxResults) break
  }
  return images
}

// ── Image generation ─────────────────────────────────────────────────

export interface LyceroGenerateImageOptions {
  prompt: string
  model?: string | undefined
  referenceImageUrls?: string[] | undefined
  aspectRatio?: string | undefined
  imageSize?: string | undefined
  transparentBackground?: boolean | undefined
}

export interface LyceroGeneratedImage {
  url: string
  taskId: string | undefined
  bytes: Uint8Array | undefined
}

export async function lyceroGenerateImage(
  options: LyceroGenerateImageOptions,
  signal?: AbortSignal,
): Promise<LyceroGeneratedImage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort, { once: true })
  try {
    const data = await gatewayFetch<{ data?: unknown }>(
      "/image-gen",
      {
        method: "POST",
        body: JSON.stringify({
          prompt: options.prompt,
          model: options.model,
          reference_image_urls: options.referenceImageUrls,
          aspect_ratio: options.aspectRatio,
          image_size: options.imageSize,
          transparent_background: options.transparentBackground,
        }),
      },
      GENERATE_TIMEOUT_MS,
    )
    return parseLyceroGeneratedImage(data.data)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

export function parseLyceroGeneratedImage(
  raw: unknown,
): LyceroGeneratedImage {
  const data = asRecord(raw ?? {})
  const firstImage = Array.isArray(data.images ?? data.generated_images)
    ? firstItem(data.images ?? data.generated_images)
    : data
  const img = asRecord(firstImage ?? {})
  const imageUrls = asRecord(img).image_urls
  const imageUrlsNowatermark = asRecord(img).image_urls_nowatermark
  const url = String(
    img.url ??
      (Array.isArray(imageUrls) ? imageUrls[0] : undefined) ??
      (Array.isArray(imageUrlsNowatermark) ? imageUrlsNowatermark[0] : undefined) ??
      "",
  )
  if (!url) {
    throw new Error(
      `lycero image generation returned no result: ${JSON.stringify(raw).slice(0, 200)}`,
    )
  }
  return {
    url,
    taskId:
      typeof img.task_id === "string"
        ? img.task_id
        : img.taskId
          ? String(img.taskId)
          : undefined,
    bytes: undefined,
  }
}

// ── Transcription ────────────────────────────────────────────────────

export interface LyceroTranscribeOptions {
  audioUrls: string[]
  prompt?: string | undefined
  model?: string | undefined
}

export async function lyceroTranscribe(
  options: LyceroTranscribeOptions,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort, { once: true })
  try {
    const data = await gatewayFetch<{ data?: unknown }>(
      "/transcribe",
      {
        method: "POST",
        body: JSON.stringify({
          audio_urls: options.audioUrls,
          prompt: options.prompt,
          model: options.model,
        }),
      },
      GENERATE_TIMEOUT_MS,
    )
    return extractLyceroText(data.data)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

// ── Media analysis ───────────────────────────────────────────────────

export interface LyceroAnalyzeMediaOptions {
  mediaUrls: string[]
  requirements: string
}

export async function lyceroAnalyzeMedia(
  options: LyceroAnalyzeMediaOptions,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort, { once: true })
  try {
    const data = await gatewayFetch<{ data?: unknown }>(
      "/analyze",
      {
        method: "POST",
        body: JSON.stringify({
          media_urls: options.mediaUrls,
          requirements: options.requirements,
        }),
      },
      GENERATE_TIMEOUT_MS,
    )
    return extractLyceroText(data.data)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

export function extractLyceroText(raw: unknown): string {
  const data = asRecord(raw ?? {})
  if (typeof data.text === "string") return data.text
  if (typeof data.content === "string") return data.content
  if (typeof data.result === "string") return data.result
  if (typeof data.analysis === "string") return data.analysis
  if (typeof data.transcript === "string") return data.transcript
  if (typeof data.answer === "string") return data.answer
  return JSON.stringify(data)
}
