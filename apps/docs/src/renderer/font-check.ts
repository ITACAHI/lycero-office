/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import type { ParsedDoc, TableModel } from '@lycero/docx-engine'
import { BUNDLED_FONTS, cssFontFamily, isBundledFont } from './line-metrics'

const GENERIC = new Set(['serif', 'sans-serif', 'monospace'])
const CJK_CHAR_RE = /[\u2E80-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\uF900-\uFAFF]/

/** every distinct font family the document actually uses */
export function collectDocFonts(parsed: ParsedDoc): string[] {
  const names = new Set<string>()
  const usedStyleIds = new Set<string>()
  let hasCjkText = false
  const add = (font?: string) => {
    if (font) names.add(font)
  }
  const addRuns = (
    runs: readonly {
      text?: string
      font?: string
      fontAscii?: string
      styleId?: string
      themeRFonts?: { font?: string; fontAscii?: string }
    }[],
  ) => {
    for (const r of runs) {
      if (r.styleId) usedStyleIds.add(r.styleId)
      const runHasCjk = CJK_CHAR_RE.test(r.text ?? '')
      if (runHasCjk) hasCjkText = true
      add(r.fontAscii)
      if (r.font) {
        const isThemeEa = Boolean(r.themeRFonts?.font && r.font === r.themeRFonts.font)
        const isUnusedEaSlot = Boolean(r.fontAscii && r.font !== r.fontAscii && !runHasCjk)
        if (!isThemeEa && !isUnusedEaSlot) {
          add(r.font)
        }
      }
    }
  }
  const addTable = (table: TableModel) => {
    for (const row of table.rows) {
      for (const cell of row) {
        for (const p of cell.richParas ?? []) {
          if (p.styleId) usedStyleIds.add(p.styleId)
          addRuns(p.runs)
        }
        for (const nt of cell.nestedTables ?? []) addTable(nt)
      }
    }
  }
  for (const b of parsed.blocks) {
    if (b.styleId) usedStyleIds.add(b.styleId)
    addRuns(b.runs ?? [])
    for (const tb of b.textboxes ?? []) {
      for (const p of tb.paras) {
        if (p.styleId) usedStyleIds.add(p.styleId)
        addRuns(p.runs)
      }
    }
    if (b.table) addTable(b.table)
  }
  for (const s of parsed.styles.values()) {
    if (s.isDefault && s.styleId) usedStyleIds.add(s.styleId)
  }
  // Expand basedOn chain for used styles
  const queue = [...usedStyleIds]
  while (queue.length > 0) {
    const id = queue.pop()!
    const parent = parsed.styles.get(id)?.basedOn
    if (parent && !usedStyleIds.has(parent)) {
      usedStyleIds.add(parent)
      queue.push(parent)
    }
  }
  add(parsed.docDefaults?.asciiFont)
  if (
    hasCjkText &&
    !parsed.docDefaults?.eaSlotEmpty &&
    !parsed.docDefaults?.eaFromLang &&
    !parsed.docDefaults?.eaThemeSlot
  ) {
    add(parsed.docDefaults?.eastAsiaFont)
  }
  for (const s of parsed.styles.values()) {
    // Synthetic test fixtures may omit s.styleId; real parsed styles carry s.styleId
    if (s.styleId && !usedStyleIds.has(s.styleId)) continue
    add(s.display?.fontAscii)
    if (!s.display?.eaSlotEmpty && (hasCjkText || !s.styleId || !s.display?.fontAscii)) {
      add(s.display?.font)
    }
  }
  return [...names]
}

// document.fonts.check is useless here: Chromium answers true for any family
// (system-fallback rendering counts). Detect availability by measuring — an
// unresolvable family inherits the exact metrics of the generic fallback.
const SAMPLE = '永体宋黑Wmg10'

function ctx2d(): CanvasRenderingContext2D | null {
  try {
    return document.createElement('canvas').getContext('2d')
  } catch {
    return null
  }
}

function fontAvailableIn(cx: CanvasRenderingContext2D, family: string): boolean {
  const q = `"${family.replace(/"/g, '')}"`
  const width = (stack: string): number => {
    cx.font = `16px ${stack}`
    return cx.measureText(SAMPLE).width
  }
  return (
    width(`${q}, monospace`) !== width('monospace') ||
    width(`${q}, sans-serif`) !== width('sans-serif')
  )
}

const symbolCoverCache = new Map<string, boolean>()
/** outside the F020-F0FF range every symbol-encoded legacy font maps, so this always draws .notdef */
const PUA_TOFU = '\uE000'

/**
 * Family installed AND covering every char of text — macOS ships a Symbol.ttf
 * without the F0xx cmap. An uncovered PUA char renders the stack's .notdef
 * (whose metrics differ from any other stack's), so the only reliable probe is
 * comparing against a known .notdef in the same stack.
 */
export function symbolFontCovers(family: string, text: string): boolean {
  const key = `${family}\u0000${text}`
  const hit = symbolCoverCache.get(key)
  if (hit !== undefined) return hit
  const cx = ctx2d()
  let covers = false
  if (cx) {
    cx.font = `32px "${family.replace(/"/g, '')}"`
    const metrics = (s: string): string => {
      const m = cx.measureText(s)
      return [
        m.width,
        m.actualBoundingBoxLeft,
        m.actualBoundingBoxRight,
        m.actualBoundingBoxAscent,
        m.actualBoundingBoxDescent,
      ].join()
    }
    const tofu = metrics(PUA_TOFU)
    covers = [...text].every((ch) => ch <= ' ' || metrics(ch) !== tofu)
  }
  symbolCoverCache.set(key, covers)
  return covers
}

export interface FontSubstitution {
  name: string
  /** first available family in the fallback chain, null = only bundled fallback left */
  substitute: string | null
}

/**
 * Declared fonts that don't resolve on this system, with the family that
 * actually renders instead (substitution used to be silent).
 */
export function checkMissingFonts(names: string[]): FontSubstitution[] {
  if (typeof document === 'undefined') return []
  const cx = ctx2d()
  if (!cx) return []
  const out: FontSubstitution[] = []
  for (const name of names) {
    // a declared bundled face resolves in canvas yet still renders the subset fallback — report it
    if (!isBundledFont(name) && fontAvailableIn(cx, name)) continue
    const chain = cssFontFamily(name)
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter((c) => c !== name && !GENERIC.has(c))
    const substitute = chain.find((c) => !BUNDLED_FONTS.has(c) && fontAvailableIn(cx, c)) ?? null
    out.push({ name, substitute })
  }
  return out
}
