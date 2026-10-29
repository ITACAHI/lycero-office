/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

export interface PiiTokenizeResult {
  maskedText: string
  piiMap: Map<string, string>
}

/**
 * High-performance PII Redactor for Vietnamese Office Documents.
 * Masking occurs client-side before any network payload leaves the local machine.
 * The Central Cloud Gateway operates on anonymized placeholder tokens.
 */
export class PiiTokenizer {
  // Vietnamese phone numbers: 10 digits starting with 03, 05, 07, 08, 09 or +84 (supports 4-3-3 and 3-3-4 dots/spaces/dashes)
  private static readonly PHONE_REGEX =
    /(?<!\d)(?:\+84[\s.-]?|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])(?:\d[.\s-]?\d{3}[.\s-]?\d{3}|[.\s-]?\d{3}[.\s-]?\d{4}|\d{7})\b(?!\d)/g

  // Vietnamese Identity Numbers: 12-digit CCCD or 9-digit CMND (excluding financial figures ending in 000)
  private static readonly CCCD_REGEX = /\b(?!\d*000\b)\d{12}\b/g
  private static readonly CMND_REGEX = /\b(?!\d*000\b)\d{9}\b/g

  // Standard email addresses
  private static readonly EMAIL_REGEX =
    /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g

  // Payment & credit cards: 16 digits
  private static readonly CARD_REGEX =
    /\b(?:\d{4}[ -]?){3}\d{4}\b/g

  /**
   * Masks sensitive PII tokens within input text.
   */
  public static mask(text: string, existingMap?: Map<string, string>): PiiTokenizeResult {
    const map = existingMap ?? new Map<string, string>()
    let counter = map.size + 1

    const createToken = (type: string, original: string): string => {
      // If original is already mapped, reuse the token
      for (const [t, v] of map.entries()) {
        if (v === original) return t
      }
      const token = `[PII_${type}_${counter++}]`
      map.set(token, original)
      return token
    }

    let masked = text
      // 1. Credit cards
      .replace(this.CARD_REGEX, (m) => createToken('CARD', m))
      // 2. Email
      .replace(this.EMAIL_REGEX, (m) => createToken('EMAIL', m))
      // 3. Phone numbers
      .replace(this.PHONE_REGEX, (m) => createToken('PHONE', m))
      // 4. CCCD (12 digits)
      .replace(this.CCCD_REGEX, (m) => createToken('CCCD', m))
      // 5. CMND (9 digits)
      .replace(this.CMND_REGEX, (m) => createToken('CMND', m))

    return { maskedText: masked, piiMap: map }
  }

  /**
   * Restores all PII tokens to their original values in text.
   * Includes fallback recovery when an LLM drops brackets/prefix or substitutes a dummy placeholder
   * for a single masked token of that category.
   */
  public static restore(text: string, piiMap: Map<string, string>): string {
    if (!text || piiMap.size === 0) return text
    let restored = text
    const missingByType = new Map<string, string[]>()

    for (const [token, original] of piiMap.entries()) {
      if (restored.includes(token)) {
        restored = restored.replaceAll(token, original)
        continue
      }
      // Fallback 1: LLM wrote [PHONE_1] or PII_PHONE_1 instead of [PII_PHONE_1]
      const m = token.match(/^\[PII_([A-Z]+)_(\d+)\]$/)
      if (m && m[1] && m[2]) {
        const type = m[1]
        const idx = m[2]
        const altRegex = new RegExp(`\\[?(?:PII_)?${type}_${idx}\\]?`, 'gi')
        if (altRegex.test(restored)) {
          restored = restored.replace(altRegex, original)
          continue
        }
        const list = missingByType.get(type) ?? []
        list.push(original)
        missingByType.set(type, list)
      }
    }

    // Fallback 2: If exactly 1 token of a category was in the prompt and the LLM substituted a dummy phone/email/CCCD
    const phoneMissing = missingByType.get('PHONE')
    if (phoneMissing && phoneMissing.length === 1 && phoneMissing[0] && !restored.includes(phoneMissing[0])) {
      restored = restored.replace(this.PHONE_REGEX, phoneMissing[0])
    }
    const emailMissing = missingByType.get('EMAIL')
    if (emailMissing && emailMissing.length === 1 && emailMissing[0] && !restored.includes(emailMissing[0])) {
      restored = restored.replace(this.EMAIL_REGEX, emailMissing[0])
    }
    const cccdMissing = missingByType.get('CCCD')
    if (cccdMissing && cccdMissing.length === 1 && cccdMissing[0] && !restored.includes(cccdMissing[0])) {
      restored = restored.replace(this.CCCD_REGEX, cccdMissing[0])
    }

    return restored
  }

  /**
   * Streaming de-tokenizer to unmask tokens across streamed SSE chunk boundaries.
   */
  public static createStreamUnmasker(piiMap: Map<string, string>): (delta: string) => string {
    if (piiMap.size === 0) {
      return (delta: string) => delta
    }

    let buffer = ''
    return (delta: string): string => {
      buffer += delta

      // If buffer contains a possible beginning of token '[PII_' that has not completed ']'
      const openBracketIdx = buffer.lastIndexOf('[PII_')
      if (openBracketIdx !== -1) {
        const closeBracketIdx = buffer.indexOf(']', openBracketIdx)
        if (closeBracketIdx === -1) {
          // Token is partially cut off at the end of the chunk; flush everything before it
          const safePrefix = buffer.slice(0, openBracketIdx)
          buffer = buffer.slice(openBracketIdx)
          return PiiTokenizer.restore(safePrefix, piiMap)
        }
      }

      // If buffer is complete or no partial token, restore and flush
      const out = PiiTokenizer.restore(buffer, piiMap)
      buffer = ''
      return out
    }
  }
}
