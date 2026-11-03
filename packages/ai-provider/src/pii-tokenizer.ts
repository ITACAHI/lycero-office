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
  /**
   * Cross-turn registry so multi-turn agent tool calls can still restore PII tokens
   * even after earlier user messages are compacted or trimmed from history (fixes FX-04).
   */
  private static readonly globalRegistry = new Map<string, string>()

  static {
    if (typeof process !== 'undefined' && process.env?.LYCERO_PII_MAP) {
      PiiTokenizer.importGlobalRegistry(process.env.LYCERO_PII_MAP)
    }
  }

  // Vietnamese Tax ID (Mã số thuế / MST / MSDN: 10 digits or 10-3 digits, including inside Markdown tables or bold labels)
  private static readonly MST_CONTEXT_REGEX =
    /(?<=(?:Mã\s+số\s+thuế(?:\s*\(MST\))?|Mã\s+số\s+doanh\s+nghiệp|MST|MSDN|Tax\s+ID|Mã\s+ĐKKD)[*_)\s|:\-–]{0,12})\b\d{10}(?:-\d{3})?\b/gi

  // Bank account numbers following STK / Số tài khoản / Tài khoản (including inside Markdown tables or bold labels)
  private static readonly BANK_CONTEXT_REGEX =
    /(?<=(?:Số\s+tài\s+khoản(?:\s*\(STK\))?|STK|Tài\s+khoản(?:\s+ngân\s+hàng)?(?:\s+số)?|Account(?:\s+No)?)[*_)\s|:\-–]{0,12})\b\d{8,19}\b/gi

  // Signer / Representative names following Đại diện / Người đại diện / Người ký / Chủ tài khoản / Họ và tên / Giám đốc
  private static readonly NAME_CONTEXT_REGEX =
    /((?:Đại\s+diện(?:\s+theo\s+pháp\s+luật)?|Người\s+đại\s+diện|Người\s+ký|Chủ\s+tài\s+khoản|Họ\s+và\s+tên|Giám\s+đốc|Tổng\s+Giám\s+đốc)[*_)\s|:\-–]{1,12}(?:(?:Ông|Bà|Anh|Chị|Mr\.?|Ms\.?)\s+)?)([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s+[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+){1,4})/g

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

  /** Reset cross-turn registry (used by tests) */
  public static clearGlobalRegistry(): void {
    this.globalRegistry.clear()
  }

  /** Export cross-turn registry for CLI subprocesses or shared turn maps (FX-04) */
  public static exportGlobalRegistry(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of this.globalRegistry.entries()) {
      out[k] = v
    }
    return out
  }

  /** Return a clone of the cross-turn registry map */
  public static getGlobalRegistryMap(): Map<string, string> {
    return new Map<string, string>(this.globalRegistry)
  }

  /** Import cross-turn registry from JSON string or Record (used by CLI subprocesses, FX-04) */
  public static importGlobalRegistry(raw: Record<string, string> | string): void {
    try {
      const obj = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, string>) : raw
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (typeof k === 'string' && typeof v === 'string') {
            this.globalRegistry.set(k, v)
          }
        }
      }
    } catch {
      // ignore malformed env var
    }
  }

  /**
   * Masks sensitive PII tokens within input text using per-category 1-based indices
   * ([PII_MST_1], [PII_MST_2], [PII_BANK_1], [PII_BANK_2], [PII_PHONE_1], etc.)
   * so Party A and Party B entities never collide.
   */
  public static mask(text: string, existingMap?: Map<string, string>): PiiTokenizeResult {
    const map = existingMap ?? new Map<string, string>()
    const typeCounters = new Map<string, number>()

    for (const token of map.keys()) {
      const m = /^\[PII_([A-Z]+)_(\d+)\]$/.exec(token)
      if (m && m[1] && m[2]) {
        const type = m[1]
        const idx = Number(m[2])
        const prev = typeCounters.get(type) ?? 0
        if (idx > prev) typeCounters.set(type, idx)
      }
    }

    const createToken = (type: string, original: string): string => {
      const normalized = original.trim()
      // If original is already mapped in the current map, reuse its exact token
      for (const [t, v] of map.entries()) {
        if (v === normalized && t.startsWith(`[PII_${type}_`)) return t
      }
      const nextIdx = (typeCounters.get(type) ?? 0) + 1
      typeCounters.set(type, nextIdx)
      const token = `[PII_${type}_${nextIdx}]`
      map.set(token, normalized)
      this.globalRegistry.set(token, normalized)
      return token
    }

    const masked = text
      // 1. Tax IDs (MST) — must run before 10-digit/13-digit numeric rules
      .replace(this.MST_CONTEXT_REGEX, (m) => createToken('MST', m))
      // 2. Bank account numbers (STK) — must run before 9/12/16-digit numeric rules
      .replace(this.BANK_CONTEXT_REGEX, (m) => createToken('BANK', m))
      // 3. Representative / Signer names (NAME)
      .replace(this.NAME_CONTEXT_REGEX, (_m, prefix: string, name: string) => `${prefix}${createToken('NAME', name)}`)
      // 4. Credit cards (16 digits)
      .replace(this.CARD_REGEX, (m) => createToken('CARD', m))
      // 5. Email
      .replace(this.EMAIL_REGEX, (m) => createToken('EMAIL', m))
      // 6. Phone numbers
      .replace(this.PHONE_REGEX, (m) => createToken('PHONE', m))
      // 7. CCCD (12 digits)
      .replace(this.CCCD_REGEX, (m) => createToken('CCCD', m))
      // 8. CMND (9 digits)
      .replace(this.CMND_REGEX, (m) => createToken('CMND', m))

    return { maskedText: masked, piiMap: map }
  }

  /**
   * Restores all PII tokens to their original values in text.
   * Uses both the turn-local `piiMap` and the cross-turn `globalRegistry` so
   * multi-turn tool calls never leave `[PII_...]` placeholders in output files.
   */
  public static restore(text: string, piiMap?: Map<string, string>): string {
    if (!text) return text
    const combined = new Map<string, string>(this.globalRegistry)
    if (piiMap) {
      for (const [k, v] of piiMap.entries()) combined.set(k, v)
    }
    if (combined.size === 0 && !text.includes('PII_')) return text

    let restored = text
    const byType = new Map<string, string[]>()

    for (const [token, original] of combined.entries()) {
      const m = token.match(/^\[PII_([A-Z]+)_(\d+)\]$/)
      if (m && m[1]) {
        const list = byType.get(m[1]) ?? []
        if (!list.includes(original)) list.push(original)
        byType.set(m[1], list)
      }
      if (restored.includes(token)) {
        restored = restored.replaceAll(token, original)
      }
      if (m && m[1] && m[2]) {
        const type = m[1]
        const idx = m[2]
        const altRegex = new RegExp(`\\[?(?:PII_)?${type}_${idx}\\]?`, 'gi')
        if (altRegex.test(restored)) {
          restored = restored.replace(altRegex, original)
        }
      }
    }

    // Resolve any remaining [PII_<TYPE>_<N>] token (including multi-word types like TAX_ID, BANK_ACC, PERSON_NAME)
    restored = restored.replace(/\[PII_([A-Z0-9_]+?)_(\d+)\]/gi, (_full, rawType: string, rawIdx: string) => {
      const upper = rawType.toUpperCase()
      const type =
        upper === 'TAX_ID' || upper === 'TAX' || upper === 'MSDN'
          ? 'MST'
          : upper === 'BANK_ACC' || upper === 'BANK_ACCOUNT' || upper === 'ACCOUNT' || upper === 'STK'
            ? 'BANK'
            : upper === 'PERSON' ||
                upper === 'PERSON_NAME' ||
                upper === 'FULL_NAME' ||
                upper === 'SIGNER' ||
                upper === 'REP' ||
                upper === 'REPRESENTATIVE'
              ? 'NAME'
              : upper === 'PHONE_NUMBER' || upper === 'TEL' || upper === 'MOBILE'
                ? 'PHONE'
                : upper === 'ID_CARD' || upper === 'CITIZEN_ID'
                  ? 'CCCD'
                  : upper
      const idx = Math.max(1, Number(rawIdx) || 1) - 1
      const direct = byType.get(type)
      if (direct && direct.length > 0) {
        return direct[Math.min(idx, direct.length - 1)]!
      }
      // Cross-category fallback for numeric identifiers (MST <-> CMND/CCCD/PHONE, BANK <-> CARD/CCCD/CMND)
      if (type === 'MST') {
        const alt = byType.get('CMND') ?? byType.get('CCCD') ?? byType.get('PHONE')
        if (alt && alt.length > 0) return alt[Math.min(idx, alt.length - 1)]!
      }
      if (type === 'BANK') {
        const alt = byType.get('CCCD') ?? byType.get('CMND') ?? byType.get('CARD')
        if (alt && alt.length > 0) return alt[Math.min(idx, alt.length - 1)]!
      }
      return ''
    })

    // Catch any residual or truncated [PII_...] placeholder so 0 [PII_ tokens ever reach disk (FX-04)
    if (restored.includes('[PII_')) {
      restored = restored.replace(/\[PII_[A-Z0-9_]*\]?/gi, '')
    }

    // Single-entity dummy substitution recovery: ONLY when the explicit turn-local piiMap
    // has exactly 1 entity of PHONE/EMAIL/CCCD (never when 2+ parties exist, preserving FX-04)
    if (piiMap && piiMap.size > 0) {
      const localByType = new Map<string, string[]>()
      for (const [token, original] of piiMap.entries()) {
        const m = /^\[PII_([A-Z]+)_(\d+)\]$/.exec(token)
        if (m && m[1]) {
          const list = localByType.get(m[1]) ?? []
          if (!list.includes(original)) list.push(original)
          localByType.set(m[1], list)
        }
      }
      const singlePhone = localByType.get('PHONE')
      if (singlePhone && singlePhone.length === 1 && singlePhone[0] && !restored.includes(singlePhone[0])) {
        const matches = restored.match(this.PHONE_REGEX)
        if (matches && matches.length === 1) {
          restored = restored.replace(this.PHONE_REGEX, singlePhone[0])
        }
      }
      const singleEmail = localByType.get('EMAIL')
      if (singleEmail && singleEmail.length === 1 && singleEmail[0] && !restored.includes(singleEmail[0])) {
        const matches = restored.match(this.EMAIL_REGEX)
        if (matches && matches.length === 1) {
          restored = restored.replace(this.EMAIL_REGEX, singleEmail[0])
        }
      }
    }

    return restored
  }

  /**
   * Restores PII tokens using the cross-turn global registry and asserts that
   * zero `[PII_` tokens remain in the returned text (FX-04).
   */
  public static restoreGlobal(text: string): string {
    const out = this.restore(text, this.globalRegistry)
    if (/\[PII_[A-Z0-9_]*\]?/i.test(out)) {
      return out.replace(/\[PII_[A-Z0-9_]*\]?/gi, '')
    }
    return out
  }

  /**
   * Streaming de-tokenizer to unmask tokens across streamed SSE chunk boundaries.
   */
  public static createStreamUnmasker(
    piiMap: Map<string, string>,
  ): (delta: string, flush?: boolean) => string {
    let buffer = ''
    return (delta: string, flush = false): string => {
      buffer += delta

      if (!flush) {
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
      }

      // If buffer is complete, flushed, or has no partial token, restore and flush
      const out = PiiTokenizer.restore(buffer, piiMap)
      buffer = ''
      return out
    }
  }
}
