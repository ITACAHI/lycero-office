/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Tokenizer for the file-index search module.
 * Splits content into searchable tokens.
 */

const DEFAULT_MIN_TOKEN_LENGTH = 2
const DEFAULT_MAX_TOKEN_LENGTH = 64

export interface TokenizeOptions {
  minLength?: number
  maxLength?: number
  /** split on whitespace + punctuation when true */
  aggressive?: boolean
}

/** Split text into searchable tokens */
export function tokenize(text: string, options: TokenizeOptions = {}): string[] {
  const { minLength = DEFAULT_MIN_TOKEN_LENGTH, maxLength = DEFAULT_MAX_TOKEN_LENGTH, aggressive = false } = options

  const raw = aggressive
    ? text.toLowerCase().replace(/[^a-zA-Z0-9À-ÿ\s]/g, ' ')
    : text.toLowerCase()

  const tokens: string[] = aggressive
    ? raw.split(/\s+/).filter(Boolean)
    : raw.match(/\b[a-zA-Z0-9À-ÿ]{1,64}\b/g) ?? []

  return tokens.filter((t) => t.length >= minLength && t.length <= maxLength)
}

/** Convert a search query into normalized tokens */
export function tokenizeQuery(query: string): string[] {
  // Remove special search operators (quotes, wildcards) for basic tokenization
  const cleaned = query.replace(/["'*?]/g, ' ').replace(/\s+/g, ' ').trim()
  return tokenize(cleaned, { aggressive: true })
}

/** Check if query has exact phrase (quoted string) */
export function extractPhrases(text: string): string[] {
  const phrases: string[] = []
  const re = /"([^"]+)"/g
  let match
  while ((match = re.exec(text)) !== null) {
    const phrase = match[1].toLowerCase().trim()
    if (phrase) phrases.push(phrase)
  }
  return phrases
}

/** Remove phrases from text for subsequent tokenization */
export function stripPhrases(text: string): string {
  return text.replace(/"[^"]+"/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Build an n-gram index entry for a token */
export function ngrams(token: string, n = 3): string[] {
  if (token.length < n) return [token]
  const grams: string[] = []
  for (let i = 0; i <= token.length - n; i++) {
    grams.push(token.slice(i, i + n))
  }
  return grams
}
