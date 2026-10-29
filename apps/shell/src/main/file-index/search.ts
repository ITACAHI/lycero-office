/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Scoring and ranking for file-index search results.
 * Implements TF-IDF-like scoring with recency boost.
 */
import type { IndexedDocument, SearchResult } from './types'
import { tokenizeQuery, extractPhrases, stripPhrases, tokenize } from './tokenizer'

export interface RankOptions {
  /** recency weight (0-1), higher = newer docs rank higher */
  recencyWeight?: number
  /** name match weight (0-1) */
  nameWeight?: number
  /** minimum match ratio (0-1) for results to appear */
  matchThreshold?: number
}

const DEFAULT_RECENT_DAYS = 90
const DEFAULT_MATCH_THRESHOLD = 0.05

/**
 * Score and rank documents against a query.
 * Returns sorted SearchResult[] with scores and highlights.
 */
export function rankDocuments(
  query: string,
  documents: IndexedDocument[],
  options: RankOptions = {},
): SearchResult[] {
  const {
    recencyWeight = 0.15,
    nameWeight = 0.2,
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
  } = options

  if (!query.trim()) return []

  const phrases = extractPhrases(query)
  const remainingQuery = stripPhrases(query)
  const queryTokens = tokenizeQuery(remainingQuery)
  const allTokens = [...queryTokens]

  const now = Date.now()
  const recentCutoff = now - DEFAULT_RECENT_DAYS * 24 * 60 * 60 * 1000

  const scored = documents
    .map((doc) => {
      const score = computeScore(doc, allTokens, phrases, now, recentCutoff, recencyWeight, nameWeight)
      const highlights = extractHighlights(doc.content, allTokens)
      return { document: doc, score, highlights }
    })
    .filter((r) => r.score >= matchThreshold)

  scored.sort((a, b) => b.score - a.score)
  return scored
}

function computeScore(
  doc: IndexedDocument,
  queryTokens: string[],
  phrases: string[],
  now: number,
  recentCutoff: number,
  recencyWeight: number,
  nameWeight: number,
): number {
  if (queryTokens.length === 0 && phrases.length === 0) return 0

  // Term frequency score
  const docTokens = tokenize(doc.content, { aggressive: true })
  const docTokenSet = new Set(docTokens)

  let tfScore = 0
  for (const token of queryTokens) {
    const count = docTokens.filter((t) => t === token).length
    if (count > 0) {
      tfScore += Math.min(1 + Math.log(count), 3) // capped log TF
    }
    // fuzzy: check if token appears as substring of any doc token
    if (!docTokenSet.has(token)) {
      const partial = docTokens.some((t) => t.includes(token) || token.includes(t))
      if (partial) tfScore += 0.3
    }
  }
  tfScore = tfScore / (queryTokens.length + 1)

  // Phrase (exact) score — bonus for exact match
  let phraseScore = 0
  const docLower = doc.content
  for (const phrase of phrases) {
    if (docLower.includes(phrase)) {
      phraseScore += 1
    }
  }
  phraseScore = phraseScore / (phrases.length || 1)

  // Recency score
  let recencyScore = 0
  if (doc.modifiedAt >= recentCutoff) {
    const ageDays = (now - doc.modifiedAt) / (24 * 60 * 60 * 1000)
    recencyScore = Math.max(0, 1 - ageDays / DEFAULT_RECENT_DAYS)
  }

  // Name match score
  const nameLower = doc.name.toLowerCase()
  const nameTokens = tokenize(doc.name, { aggressive: true })
  let nameScore = 0
  for (const token of queryTokens) {
    if (nameLower.includes(token)) nameScore += 1
  }
  nameScore = Math.min(nameScore / (queryTokens.length || 1), 1)

  // Extension score — exact extension match is a small bonus
  const docExt = '.' + doc.extension
  let extScore = 0
  for (const token of queryTokens) {
    if (token === docExt || token === doc.extension) extScore = 0.5
  }

  // Weighted sum
  const textWeight = 0.5
  return (
    tfScore * textWeight +
    phraseScore * 0.2 +
    recencyScore * recencyWeight +
    nameScore * nameWeight +
    extScore * 0.05
  )
}

/** Extract short highlight snippets around matched tokens */
function extractHighlights(content: string, queryTokens: string[]): string[] {
  const highlights: string[] = []
  const contentLower = content
  const CONTEXT = 40

  for (const token of queryTokens) {
    const idx = contentLower.indexOf(token)
    if (idx === -1) continue
    const start = Math.max(0, idx - CONTEXT)
    const end = Math.min(content.length, idx + token.length + CONTEXT)
    const snippet = (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '')
    if (!highlights.includes(snippet)) highlights.push(snippet)
    if (highlights.length >= 3) break
  }

  return highlights
}
