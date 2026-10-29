/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Lycero Office Desktop
 * Copyright \u00a9 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright \u00a9 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase C.1: Keyword-based intent router.
 *
 * Routes a user prompt to the most relevant WorkBundle using deterministic
 * keyword matching against bundle keys, labels, tool names, tool descriptions,
 * and bundle-specific custom intent keywords.
 *
 * ponytail: small static keyword set — no fuzzy matching.
 * Upgrade path: integrate `packages/ai-search/gsk.ts` if it has a token matcher.
 */

import type { WorkBundle } from '@lycero/ai-auth'

/**
 * How the router matched the prompt to a bundle.
 */
export type MatchVia = 'labelVi' | 'key' | 'intent' | 'tool'

/**
 * Result of intent routing.
 */
export interface RouteDecision {
  /** Snake-case bundle id that best matches the prompt */
  bundleId: string
  /** Keywords that triggered the match */
  matchedKeywords: string[]
  /** Confidence score 0..1 */
  confidence: number
  /** Which field produced the match */
  matchedVia: MatchVia
}

// ─────────────────────────────────────────────────────────────────────────────
// Vietnamese diacritics stripper (character-level lookup, no NFD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip Vietnamese diacritics from a string.
 * Iterates character-by-character using a lookup table — avoids the NFD
 * normalization path which has platform-specific behaviour on some Node.js builds.
 *
 * ponytail: small static keyword set — upgrade path: gsk token matcher.
 */
function stripVnDiacritics(text: string): string {
  let result = ''
  for (const ch of text) {
    result += DIAC[ch] ?? ch
  }
  return result
}

// No duplicate keys — esbuild will warn on duplicate object keys
const DIAC: Record<string, string> = {
  '\u{00E0}': 'a',
  '\u{00E1}': 'a',
  '\u{00E2}': 'a',
  '\u{00E3}': 'a',
  '\u{00E8}': 'e',
  '\u{00E9}': 'e',
  '\u{00EA}': 'e',
  '\u{00EC}': 'i',
  '\u{00ED}': 'i',
  '\u{00F2}': 'o',
  '\u{00F3}': 'o',
  '\u{00F4}': 'o',
  '\u{00F5}': 'o',
  '\u{00F9}': 'u',
  '\u{00FA}': 'u',
  '\u{00FD}': 'y',
  '\u{0103}': 'a',
  '\u{0111}': 'd',
  '\u{0129}': 'i',
  '\u{0169}': 'u',
  '\u{01A1}': 'o',
  '\u{01B0}': 'u',
  '\u{1EA1}': 'a',
  '\u{1EA3}': 'a',
  '\u{1EA5}': 'a',
  '\u{1EA7}': 'a',
  '\u{1EAD}': 'a',
  '\u{1EAF}': 'a',
  '\u{1EB1}': 'a',
  '\u{1EB3}': 'a',
  '\u{1EB5}': 'a',
  '\u{1EB7}': 'a',
  '\u{1EB9}': 'a',
  '\u{1EBB}': 'a',
  '\u{1EBD}': 'e',
  '\u{1EBF}': 'e',
  '\u{1EC1}': 'e',
  '\u{1EC3}': 'e',
  '\u{1EC5}': 'e',
  '\u{1EC7}': 'e',
  '\u{1EC9}': 'i',
  '\u{1ECB}': 'i',
  '\u{1ECD}': 'o',
  '\u{1ECF}': 'o',
  '\u{1ED1}': 'o',
  '\u{1ED3}': 'o',
  '\u{1ED5}': 'o',
  '\u{1ED7}': 'o',
  '\u{1ED9}': 'o',
  '\u{1EDB}': 'o',
  '\u{1EDD}': 'o',
  '\u{1EDF}': 'o',
  '\u{1EE1}': 'o',
  '\u{1EE3}': 'o',
  '\u{1EE5}': 'u',
  '\u{1EE7}': 'u',
  '\u{1EE9}': 'u',
  '\u{1EEB}': 'u',
  '\u{1EEF}': 'u',
  '\u{1EF1}': 'u',
  '\u{1EF3}': 'y',
  '\u{1EF5}': 'y',
  '\u{1EF7}': 'y',
  '\u{1EF9}': 'y',
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a prompt for keyword matching.
 * - strip Vietnamese diacritics
 * - lowercase
 * - strip punctuation
 * - trim whitespace
 * - collapse internal whitespace to single spaces
 */
export function normalizePrompt(prompt: string): string {
  if (!prompt) return ''
  return stripVnDiacritics(prompt.toLowerCase())
    .toLowerCase()
    .replace(/[.,;:!??'"()\[\]{}<>\/\\-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword extraction (pure functions, no side effects)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split a string into normalized keyword tokens (lowercase, no diacritics).
 */
function tokenizeField(value: string): Set<string> {
  if (!value) return new Set()
  return new Set(
    value
      .toLowerCase()
      .split(/[\s.,;:!?\u00b7\u2022()[\]{}'"<>\/\\\-_\u2014\u2013]+/)
      .map((t) => stripVnDiacritics(t.trim()))
      .filter(Boolean)
  )
}

/**
 * Extract all searchable keywords from a bundle.
 * All keywords are normalized (lowercase, no diacritics) so they match
 * normalized prompt tokens.
 */
function extractBundleKeywords(bundle: WorkBundle): Map<string, MatchVia> {
  const keywords = new Map<string, MatchVia>()

  // 1. Bundle key tokens + full key
  for (const token of bundle.key.split('_')) {
    if (token) keywords.set(token, 'key')
  }
  keywords.set(bundle.key, 'key')
  keywords.set(bundle.key.replace(/_/g, ''), 'key')

  // 2. Bundle labelVi tokens
  for (const token of tokenizeField(bundle.labelVi)) {
    keywords.set(token, 'labelVi')
  }

  // 3. Tool names and descriptions
  for (const tool of bundle.tools) {
    for (const token of tool.name.split('.')) {
      if (token) keywords.set(stripVnDiacritics(token), 'tool')
    }
    for (const token of tokenizeField(tool.description)) {
      keywords.set(token, 'tool')
    }
  }

  // 4. Custom intents (Phase C extension)
  const intents = (bundle as unknown as { intents?: readonly string[] }).intents
  if (intents) {
    for (const intent of intents) {
      for (const token of tokenizeField(intent)) {
        keywords.set(token, 'intent')
      }
    }
  }

  return keywords
}

// ─────────────────────────────────────────────────────────────────────────────
// Core routing algorithm
// ─────────────────────────────────────────────────────────────────────────────

interface BundleScore {
  bundle: WorkBundle
  matchedKeywords: string[]
  via: MatchVia
}

/**
 * Route a user prompt to the most relevant enabled WorkBundle.
 *
 * Algorithm (deterministic, no AI):
 *  1. Normalize prompt (lowercase, strip diacritics, trim)
 *  2. For each enabled bundle, count keyword hits from all sources
 *  3. Pick bundle with highest score; ties broken by alphabetical bundle key
 *  4. Confidence = hits / 3 clamped 0..1
 *  5. Empty prompt or zero hits → fallback to general_office (always-on)
 */
export function routeIntent(prompt: string, enabledBundles: WorkBundle[]): RouteDecision {
  const normalized = normalizePrompt(prompt)

  const fallback =
    enabledBundles.find((b) => b.key === 'general_office') ?? enabledBundles[0]

  if (!normalized || !enabledBundles.length || !fallback) {
    return {
      bundleId: fallback?.key ?? 'general_office',
      matchedKeywords: [],
      confidence: 0,
      matchedVia: 'labelVi',
    }
  }

  const promptTokens = new Set(
    normalized.split(' ').map((t) => t.trim()).filter(Boolean)
  )

  const scores: BundleScore[] = []

  for (const bundle of enabledBundles) {
    const bundleKeywords = extractBundleKeywords(bundle)
    const matched: string[] = []
    let bestVia: MatchVia = 'labelVi'

    for (const token of promptTokens) {
      if (bundleKeywords.has(token)) {
        const via = bundleKeywords.get(token)!
        matched.push(token)
        if (via === 'key') {
          bestVia = via
        } else if (via === 'intent' && bestVia !== 'key') {
          bestVia = via
        } else if (via === 'labelVi' && bestVia !== 'key' && bestVia !== 'intent') {
          bestVia = via
        }
      }
    }

    if (matched.length > 0) {
      scores.push({ bundle, matchedKeywords: matched, via: bestVia })
    }
  }

  if (scores.length === 0) {
    return {
      bundleId: fallback.key,
      matchedKeywords: [],
      confidence: 0,
      matchedVia: 'labelVi',
    }
  }

  // Sort: hit count DESC, then bundle key ASC (deterministic tie-breaking)
  scores.sort((a, b) => {
    const hitDiff = b.matchedKeywords.length - a.matchedKeywords.length
    if (hitDiff !== 0) return hitDiff
    return a.bundle.key.localeCompare(b.bundle.key)
  })

  const winner = scores[0]!
  const hitCount = winner.matchedKeywords.length

  // Confidence: hits / 3 clamped 0..1
  const confidence = Math.min(1, hitCount / 3)

  return {
    bundleId: winner.bundle.key,
    matchedKeywords: winner.matchedKeywords,
    confidence,
    matchedVia: winner.via,
  }
}
