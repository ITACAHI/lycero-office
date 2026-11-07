/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import {
  addElement,
  addPicture,
  ANIM_DIRECTIONS,
  ANIM_EFFECTS,
  ANIM_TRIGGERS,
  createBlankPptx,
  editPictureSrcRect,
  elementSpid,
  openPptx,
  promoteSlideBackground,
  savePptx,
  setElementEffects,
  setElementFill,
  setSlideAnimations,
  setSlideBackground,
  setSlideNotes,
  setSlideTransition,
  TRANSITION_KINDS,
  type AnimDirection,
  type AnimEffectKind,
  type AnimTrigger,
  type GradientFillPatch,
  type Paragraph,
  type Slide,
  type SlideAnimation,
  type SlideElement,
  type SlideTransitionKind,
  type TextElement,
  type TextRun,
} from '@lycero/pptx-engine'
import {
  buildRenderSlide,
  EMU_PER_PX_96,
  pinLaidOutParagraphs,
  type FontMetricsProvider,
} from '@lycero/pptx-render'
import { coverCropFractions } from './cover-crop'

export const SPEC_CANVAS_W = 1280
export const SPEC_CANVAS_H = 720

const MAX_ELEMENTS = 48
const MAX_IMAGES = 8
const MAX_TEXT_LEN = 4000

/** Preset geometries the spec may use; unknown kinds fall back to rect instead of emitting invalid prst XML. */
const SHAPE_KINDS = new Set([
  'rect',
  'roundRect',
  'ellipse',
  'triangle',
  'rightArrow',
  'leftArrow',
  'upArrow',
  'downArrow',
  'chevron',
  'diamond',
  'parallelogram',
  'trapezoid',
  'hexagon',
  'pentagon',
  'pie',
  'donut',
  'star5',
  'heart',
  'cloud',
  'line',
  'lineArrow',
])

export interface SpecRun {
  text: string
  sizePt?: number
  bold?: boolean
  italic?: boolean
  color?: string
  font?: string
}

export interface SpecParagraph {
  runs: SpecRun[]
  align?: 'left' | 'center' | 'right' | 'justify'
  lineSpacingPct?: number
  spaceBeforePt?: number
  spaceAfterPt?: number
  bullet?: boolean
}

export interface SpecGradient {
  from: string
  to: string
  /** Optional intermediate stop color at 50% */
  via?: string
  /** Linear gradient angle in degrees (default 135) */
  angleDeg?: number
  /** Radial gradient when true */
  radial?: boolean
}

export interface SpecShadow {
  color?: string
  blurPt?: number
  distPt?: number
  angleDeg?: number
}

export interface SpecAnim {
  effect?: AnimEffectKind
  trigger?: AnimTrigger
  durationMs?: number
  delayMs?: number
  direction?: AnimDirection
  /** Optional click-reveal step group (1, 2, 3...) for stepped reveals (<Steps>/<Step> parity) */
  step?: number
}

interface SpecBase {
  x: number
  y: number
  w: number
  h: number
  /** Optional Morph continuity key across slides (e.g. "!!slide-title", "!!eyebrow", "!!card-1") */
  name?: string
  /** Optional entrance/emphasis animation spec, or 'none'/false to skip animation */
  anim?: SpecAnim | 'none' | false
}

export interface SpecShape extends SpecBase {
  type: 'shape'
  shape: string
  fill?: string
  gradient?: SpecGradient
  stroke?: { color: string; widthPt: number }
  /** Corner radius in px for roundRect (defaults to pill radius for h<=46, else 14px) */
  radius?: number
  /** Drop shadow on card/surface shapes (true for default open-slide elevation, or custom SpecShadow) */
  shadow?: boolean | SpecShadow
  paragraphs?: SpecParagraph[]
  valign?: 'top' | 'middle' | 'bottom'
  /** mirror the shape horizontally (an arrow points the other way) */
  flipH?: boolean
  /** mirror vertically; a `line` box draws bottom-left to top-right */
  flipV?: boolean
}

export interface SpecText extends SpecBase {
  type: 'text'
  paragraphs: SpecParagraph[]
  valign?: 'top' | 'middle' | 'bottom'
}

export interface SpecImage extends SpecBase {
  type: 'image'
  url: string
}

export type SpecElement = SpecShape | SpecText | SpecImage

export interface PageSpec {
  background?: string
  backgroundGradient?: SpecGradient
  /** Slide transition effect (defaults to 'morph' at build time when omitted) */
  transition?: SlideTransitionKind
  /** Optional speaker notes (talk track for Presenter View, written into OOXML notesSlide) */
  notes?: string
  elements: SpecElement[]
}

const EMU_PER_PT = 12700
const ANIM_EFFECT_SET = new Set<string>(ANIM_EFFECTS)
const ANIM_TRIGGER_SET = new Set<string>(ANIM_TRIGGERS)
const ANIM_DIRECTION_SET = new Set<string>(ANIM_DIRECTIONS)
const TRANSITION_KIND_SET = new Set<string>(TRANSITION_KINDS)

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** #RGB / #RRGGBB / #RRGGBBAA → normalized #RRGGBB(AA), else undefined */
function normColor(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  let hex = v.trim().replace(/^#/, '').toUpperCase()
  if (/^[0-9A-F]{3}$/.test(hex)) hex = [...hex].map((c) => c + c).join('')
  return /^[0-9A-F]{6}([0-9A-F]{2})?$/.test(hex) ? `#${hex}` : undefined
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

function parseGradient(v: unknown): SpecGradient | undefined {
  if (!v || typeof v !== 'object') return undefined
  const rec = asRecord(v)
  const from = normColor(rec.from ?? rec.start ?? rec.color1)
  const to = normColor(rec.to ?? rec.end ?? rec.color2)
  if (!from || !to) return undefined
  const via = normColor(rec.via ?? rec.mid)
  const angleDeg = num(rec.angleDeg ?? rec.angle)
  return {
    from,
    to,
    ...(via ? { via } : {}),
    ...(angleDeg !== undefined ? { angleDeg: ((angleDeg % 360) + 360) % 360 } : {}),
    ...(rec.radial === true ? { radial: true } : {}),
  }
}

function parseShadow(v: unknown): boolean | SpecShadow | undefined {
  if (v === true || v === 'sm' || v === 'md' || v === 'lg' || v === 'soft' || v === 'card') {
    return true
  }
  if (v === 'hard' || v === 'brutalist' || v === 'offset') {
    return { color: '#151313', blurPt: 0, distPt: 6, angleDeg: 45 }
  }
  if (!v || typeof v !== 'object') return undefined
  const rec = asRecord(v)
  const color = normColor(rec.color)
  const blurPt = num(rec.blurPt ?? rec.blur)
  const distPt = num(rec.distPt ?? rec.dist ?? rec.distance)
  const angleDeg = num(rec.angleDeg ?? rec.angle ?? rec.dir)
  return {
    ...(color ? { color } : {}),
    ...(blurPt !== undefined ? { blurPt: Math.min(Math.max(blurPt, 0), 64) } : {}),
    ...(distPt !== undefined ? { distPt: Math.min(Math.max(distPt, 0), 48) } : {}),
    ...(angleDeg !== undefined ? { angleDeg: ((angleDeg % 360) + 360) % 360 } : {}),
  }
}

function parseAnim(v: unknown): SpecAnim | 'none' | false | undefined {
  if (v === false || v === 'none') return 'none'
  if (typeof v === 'string') {
    const k = v.trim()
    return ANIM_EFFECT_SET.has(k) ? { effect: k as AnimEffectKind } : undefined
  }
  if (!v || typeof v !== 'object') return undefined
  const rec = asRecord(v)
  if (rec.effect === 'none' || rec.enabled === false) return 'none'
  const effectRaw = typeof rec.effect === 'string' ? rec.effect.trim() : undefined
  const triggerRaw = typeof rec.trigger === 'string' ? rec.trigger.trim() : undefined
  const dirRaw = typeof rec.direction === 'string' ? rec.direction.trim() : undefined
  const durationMs = num(rec.durationMs ?? rec.duration)
  const delayMs = num(rec.delayMs ?? rec.delay)
  const step = num(rec.step)
  const out: SpecAnim = {
    ...(effectRaw && ANIM_EFFECT_SET.has(effectRaw) ? { effect: effectRaw as AnimEffectKind } : {}),
    ...(triggerRaw && ANIM_TRIGGER_SET.has(triggerRaw)
      ? { trigger: triggerRaw as AnimTrigger }
      : {}),
    ...(dirRaw && ANIM_DIRECTION_SET.has(dirRaw) ? { direction: dirRaw as AnimDirection } : {}),
    ...(durationMs !== undefined
      ? { durationMs: Math.round(Math.min(Math.max(durationMs, 80), 5000)) }
      : {}),
    ...(delayMs !== undefined
      ? { delayMs: Math.round(Math.min(Math.max(delayMs, 0), 10000)) }
      : {}),
    ...(step !== undefined && step >= 0 ? { step: Math.round(Math.min(step, 20)) } : {}),
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Index of the `}` that closes the object opening at `start`, tracking string
 * literals and escapes so a brace inside one does not count. -1 when the walk
 * runs out of text or the braces never balance.
 */
function matchingBrace(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  return -1
}

/**
 * Extracts and validates the spec from raw LLM output. Tolerant of fences and
 * junk around the JSON; invalid elements are dropped with a warning rather
 * than failing the page. Returns an error only when nothing usable remains,
 * phrased so it can be fed back to the model for a corrected attempt.
 */
export interface ParseSpecOptions {
  /** Accept local file paths and data: URLs as image sources (the CLI); default http(s) only. */
  localImages?: boolean
}

export function parsePageSpec(
  raw: string,
  canvasW = SPEC_CANVAS_W,
  canvasH = SPEC_CANVAS_H,
  opts: ParseSpecOptions = {},
): { ok: true; spec: PageSpec; warnings: string[] } | { ok: false; error: string } {
  const text = String(raw ?? '')
  const start = text.indexOf('{')
  if (start < 0) return { ok: false, error: 'no JSON object found in the output' }
  // Prose around the spec can carry braces of its own, so the object's own
  // closing brace is the one that matches it; the last brace in the text is
  // only a fallback for output the walk cannot balance.
  const matched = matchingBrace(text, start)
  const end = matched >= 0 ? matched : text.lastIndexOf('}')
  if (end <= start) return { ok: false, error: 'no JSON object found in the output' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${e instanceof Error ? e.message : String(e)}` }
  }
  return parsePageSpecObject(parsed, canvasW, canvasH, opts)
}

/** Same validation as parsePageSpec for an already-parsed JSON value (one page of a deck spec). */
export function parsePageSpecObject(
  parsed: unknown,
  canvasW = SPEC_CANVAS_W,
  canvasH = SPEC_CANVAS_H,
  opts: ParseSpecOptions = {},
): { ok: true; spec: PageSpec; warnings: string[] } | { ok: false; error: string } {
  const root = asRecord(parsed)
  const rawEls = Array.isArray(root.elements) ? root.elements : []
  if (rawEls.length === 0) return { ok: false, error: 'the "elements" array is missing or empty' }

  const warnings: string[] = []
  const elements: SpecElement[] = []
  /** Index each retained element had in the model's own array, so duplicate
      advice still names the element numbers the model wrote. */
  const keptRawIdx: number[] = []
  const keep = (el: SpecElement, rawIdx: number): void => {
    elements.push(el)
    keptRawIdx.push(rawIdx)
  }
  let images = 0

  const parseParagraphs = (v: unknown): SpecParagraph[] => {
    if (!Array.isArray(v)) return []
    const out: SpecParagraph[] = []
    for (const p of v) {
      const pr = asRecord(p)
      const runsRaw = Array.isArray(pr.runs) ? pr.runs : []
      const runs: SpecRun[] = []
      for (const r of runsRaw) {
        const rr = asRecord(r)
        const t = typeof rr.text === 'string' ? rr.text.slice(0, MAX_TEXT_LEN) : ''
        const sizePt = num(rr.sizePt)
        runs.push({
          text: t,
          ...(sizePt ? { sizePt: Math.min(Math.max(sizePt, 6), 160) } : {}),
          ...(rr.bold === true ? { bold: true } : {}),
          ...(rr.italic === true ? { italic: true } : {}),
          ...(normColor(rr.color) ? { color: normColor(rr.color) } : {}),
          ...(typeof rr.font === 'string' && rr.font.trim()
            ? { font: rr.font.trim().slice(0, 80) }
            : {}),
        })
      }
      if (runs.length === 0) runs.push({ text: '' })
      const align = pr.align
      const lineSpacingPct = num(pr.lineSpacingPct)
      const spaceBeforePt = num(pr.spaceBeforePt)
      const spaceAfterPt = num(pr.spaceAfterPt)
      out.push({
        runs,
        ...(align === 'left' || align === 'center' || align === 'right' || align === 'justify'
          ? { align }
          : {}),
        ...(lineSpacingPct ? { lineSpacingPct: Math.min(Math.max(lineSpacingPct, 60), 300) } : {}),
        ...(spaceBeforePt !== undefined
          ? { spaceBeforePt: Math.min(Math.max(spaceBeforePt, 0), 96) }
          : {}),
        ...(spaceAfterPt !== undefined
          ? { spaceAfterPt: Math.min(Math.max(spaceAfterPt, 0), 96) }
          : {}),
        ...(pr.bullet === true ? { bullet: true } : {}),
      })
    }
    return out
  }

  for (const [i, rawEl] of rawEls.entries()) {
    if (elements.length >= MAX_ELEMENTS) {
      warnings.push(`element cap ${MAX_ELEMENTS} reached; the rest were dropped`)
      break
    }
    const el = asRecord(rawEl)
    const x = num(el.x)
    const y = num(el.y)
    const w = num(el.w)
    const h = num(el.h)
    if (x === undefined || y === undefined || w === undefined || h === undefined) {
      warnings.push(`element ${i}: missing/non-numeric x/y/w/h, dropped`)
      continue
    }
    // Clamp into the canvas; drop elements whose origin already lies outside
    if (x >= canvasW || y >= canvasH || x + w <= 0 || y + h <= 0) {
      warnings.push(`element ${i}: outside the ${canvasW}x${canvasH} canvas, dropped`)
      continue
    }
    const cx = Math.max(0, Math.min(x, canvasW - 1))
    const cy = Math.max(0, Math.min(y, canvasH - 1))
    const cw = Math.max(0, Math.min(w - (cx - x), canvasW - cx))
    const ch = Math.max(0, Math.min(h - (cy - y), canvasH - cy))
    if (cw < 1 || ch < 1) {
      warnings.push(`element ${i}: outside the ${canvasW}x${canvasH} canvas, dropped`)
      continue
    }
    const name =
      typeof el.name === 'string' && el.name.trim() ? el.name.trim().slice(0, 80) : undefined
    const anim = parseAnim(el.anim)
    const base: SpecBase = {
      x: cx,
      y: cy,
      w: cw,
      h: ch,
      ...(name ? { name } : {}),
      ...(anim !== undefined ? { anim } : {}),
    }
    const type = el.type

    if (type === 'image') {
      const url =
        typeof el.url === 'string'
          ? el.url.trim().replace(/^https?:\/\//i, (scheme) => scheme.toLowerCase())
          : ''
      if (!/^https?:\/\//.test(url) && !(opts.localImages && url)) {
        warnings.push(`element ${i}: image url must be http(s), dropped`)
        continue
      }
      if (images >= MAX_IMAGES) {
        warnings.push(`element ${i}: image cap ${MAX_IMAGES} reached, dropped`)
        continue
      }
      images += 1
      keep({ type: 'image', url, ...base }, i)
      continue
    }

    if (type === 'text') {
      const paragraphs = parseParagraphs(el.paragraphs)
      if (paragraphs.length === 0 || paragraphs.every((p) => !p.runs.some((r) => r.text.trim()))) {
        warnings.push(`element ${i}: text element without any text, dropped`)
        continue
      }
      const valign = el.valign
      keep(
        {
          type: 'text',
          ...base,
          paragraphs,
          ...(valign === 'top' || valign === 'middle' || valign === 'bottom' ? { valign } : {}),
        },
        i,
      )
      continue
    }

    if (type === 'shape') {
      let shape = typeof el.shape === 'string' ? el.shape.trim() : 'rect'
      if (!SHAPE_KINDS.has(shape)) {
        warnings.push(`element ${i}: unknown shape "${shape}", using rect`)
        shape = 'rect'
      }
      const fill = normColor(el.fill)
      const gradient = parseGradient(el.gradient)
      const strokeRec = asRecord(el.stroke)
      const strokeColor = normColor(strokeRec.color)
      const strokeWidth = num(strokeRec.widthPt)
      const stroke = strokeColor
        ? { color: strokeColor, widthPt: Math.min(Math.max(strokeWidth ?? 1, 0.25), 24) }
        : undefined
      const radiusRaw = num(el.radius)
      const radius = radiusRaw !== undefined ? Math.min(Math.max(radiusRaw, 0), 999) : undefined
      const shadow = parseShadow(el.shadow)
      const isLine = shape === 'line' || shape === 'lineArrow'
      if (!fill && !gradient && !stroke && !isLine) {
        warnings.push(`element ${i}: shape without fill or stroke, dropped`)
        continue
      }
      const paragraphs = parseParagraphs(el.paragraphs)
      const valign = el.valign
      keep(
        {
          type: 'shape',
          shape,
          ...base,
          ...(fill ? { fill } : {}),
          ...(gradient ? { gradient } : {}),
          ...(stroke ? { stroke } : {}),
          ...(radius !== undefined ? { radius } : {}),
          ...(shadow !== undefined ? { shadow } : {}),
          ...(paragraphs.some((p) => p.runs.some((r) => r.text.trim())) ? { paragraphs } : {}),
          ...(valign === 'top' || valign === 'middle' || valign === 'bottom' ? { valign } : {}),
          ...(el.flipH === true ? { flipH: true } : {}),
          ...(el.flipV === true ? { flipV: true } : {}),
        },
        i,
      )
      continue
    }

    warnings.push(`element ${i}: unknown type "${String(type)}", dropped`)
  }

  if (elements.length === 0) {
    return {
      ok: false,
      error: `no valid elements (${warnings.join('; ') || 'all dropped'})`,
    }
  }
  warnings.push(...duplicateTextWarnings(elements, keptRawIdx))
  const notes =
    typeof root.notes === 'string' && root.notes.trim()
      ? root.notes.trim().slice(0, MAX_TEXT_LEN)
      : undefined
  const backgroundGradient = parseGradient(root.backgroundGradient ?? root.gradient)
  const transitionRaw = typeof root.transition === 'string' ? root.transition.trim() : undefined
  const transition =
    transitionRaw && TRANSITION_KIND_SET.has(transitionRaw)
      ? (transitionRaw as SlideTransitionKind)
      : undefined
  return {
    ok: true,
    spec: {
      ...(normColor(root.background) ? { background: normColor(root.background) } : {}),
      ...(backgroundGradient ? { backgroundGradient } : {}),
      ...(transition ? { transition } : {}),
      ...(notes ? { notes } : {}),
      elements,
    },
    warnings,
  }
}

/** Text of a spec element for the duplicate check, or null when it has none. */
function rawElementText(el: unknown): string | null {
  const rec = asRecord(el)
  if (rec.type !== 'text' && rec.type !== 'shape') return null
  if (!Array.isArray(rec.paragraphs)) return null
  const text = rec.paragraphs
    .flatMap((p) => (Array.isArray(asRecord(p).runs) ? (asRecord(p).runs as unknown[]) : []))
    .map((r) => (typeof asRecord(r).text === 'string' ? (asRecord(r).text as string) : ''))
    .join('')
  return text.trim() ? text : null
}

/** Lower-cased text without spaces or punctuation, so "A · B" and "A（B）" compare equal. */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}

const DUP_MIN_CHARS = 12
const DUP_MIN_PREFIX = 10
const DUP_PREFIX_SHARE = 0.6

/**
 * Two text boxes on one page that say (nearly) the same thing are almost
 * always an authoring slip — a subtitle restating the chart caption, a
 * heading pasted twice. Compared on normalized text: identical, or sharing a
 * long common prefix that covers most of the shorter one. Advice only.
 *
 * The pairwise pass is quadratic in the elements handed in, so feed it the
 * retained set only. `rawIdx[k]` is the element number to name for position k,
 * letting a caller that already dropped elements still cite the numbering the
 * model itself wrote.
 */
export function nearDuplicateTextWarnings(rawEls: unknown[]): string[] {
  return duplicateTextWarnings(
    rawEls,
    rawEls.map((_el, i) => i),
  )
}

function duplicateTextWarnings(els: readonly unknown[], rawIdx: readonly number[]): string[] {
  const texts: { i: number; text: string; norm: string }[] = []
  for (let k = 0; k < els.length; k++) {
    const text = rawElementText(els[k])
    if (text === null) continue
    const norm = normalizeText(text)
    if (norm.length >= DUP_MIN_CHARS) texts.push({ i: rawIdx[k]!, text, norm })
  }
  const out: string[] = []
  for (let a = 0; a < texts.length; a++) {
    for (let b = a + 1; b < texts.length; b++) {
      const x = texts[a]!
      const y = texts[b]!
      const shorter = Math.min(x.norm.length, y.norm.length)
      let prefix = 0
      while (prefix < shorter && x.norm[prefix] === y.norm[prefix]) prefix++
      const same = x.norm === y.norm
      if (!same && (prefix < DUP_MIN_PREFIX || prefix < shorter * DUP_PREFIX_SHARE)) continue
      const quote = (t: string) => (t.length > 40 ? `${t.slice(0, 40)}…` : t)
      out.push(
        `elements ${x.i} and ${y.i}: ${same ? 'identical' : 'near-duplicate'} text ("${quote(x.text)}" / "${quote(y.text)}"); merge them or make one say something else`,
      )
    }
  }
  return out
}

export interface BuildPageDeps {
  /** Downloads an image; null on failure (page continues without it) */
  fetchImage: (url: string) => Promise<{ bytes: Uint8Array; ext: string } | null>
  /** Decodes natural pixel size for cover-cropping; null skips the crop */
  imageDims?: (bytes: Uint8Array) => { width: number; height: number } | null
  /** Font metrics for the post-build text measurement; absent skips the box-height fix */
  fontMetrics?: FontMetricsProvider
  /** Pin soft-wrapped line breaks with explicit <a:br/> runs after measuring (`open-slide` parity) */
  pinLineBreaks?: boolean
}

/**
 * The LLM sizes text boxes from a rough chars-per-line heuristic, which routinely
 * undersizes big CJK titles; the box has no autofit, so the canvas draws the overflow
 * past the selection frame (and PowerPoint past the shape). Re-measure every text box
 * with the real layout engine — on the reopened (parsed) model, the exact input the
 * landed page will render from — and grow too-short boxes to their content height.
 * Grow-only, plain text boxes only (shape label boxes are design intent); middle/bottom
 * anchored boxes shift up so the rendered glyphs stay exactly where they were.
 * When a text box grows downward, any stacked element sitting below it in the same
 * horizontal column is cascaded downward to prevent overlap.
 * Returns the re-saved bytes, or null when every box already fits.
 */
async function growTextBoxesToContent(
  bytes: Uint8Array,
  metrics: FontMetricsProvider,
  opts: { pinLineBreaks?: boolean } = {},
): Promise<Uint8Array | null> {
  const opened = await openPptx(bytes)
  const slide = opened.deck.slides[0]
  if (!slide) return null
  const baseWidthPx = opened.deck.size.cx / EMU_PER_PX_96 // native px → vp.scale = 1
  const baseHeightPx = opened.deck.size.cy / EMU_PER_PX_96
  const rendered = buildRenderSlide(slide, opened.deck.size, { fitWidthPx: baseWidthPx, metrics })
  let changed = false

  const liveBoxes = new Map<string, { x: number; y: number; w: number; h: number }>()
  for (const n of rendered.nodes) {
    if (n.decoration) continue
    liveBoxes.set(n.sourceId, { x: n.box.x, y: n.box.y, w: n.box.w, h: n.box.h })
  }

  const pushDownBelow = (
    sourceId: string,
    colX: number,
    colW: number,
    oldBottom: number,
    newBottom: number,
  ): void => {
    if (newBottom <= oldBottom + 0.5) return
    const candidates = rendered.nodes
      .filter((n) => !n.decoration && n.sourceId !== sourceId)
      .map((n) => ({ node: n, box: liveBoxes.get(n.sourceId)! }))
      .filter(({ box }) => {
        if (!box) return false
        if (box.w * box.h >= baseWidthPx * baseHeightPx * 0.7) return false
        const overlapX = Math.min(colX + colW, box.x + box.w) - Math.max(colX, box.x)
        return overlapX > 4 && box.y >= oldBottom - 4
      })
      .sort((a, b) => a.box.y - b.box.y)

    const frontier: Array<{ x: number; w: number; oldB: number; newB: number }> = [
      { x: colX, w: colW, oldB: oldBottom, newB: newBottom },
    ]

    for (const { node: candNode, box: candBox } of candidates) {
      let requiredTop = candBox.y
      for (const f of frontier) {
        const overlapX = Math.min(f.x + f.w, candBox.x + candBox.w) - Math.max(f.x, candBox.x)
        if (overlapX <= 4 || candBox.y < f.oldB - 4) continue
        const preservedGap = Math.min(Math.max(0, candBox.y - f.oldB), 8)
        requiredTop = Math.max(requiredTop, f.newB + preservedGap)
      }
      if (requiredTop <= candBox.y + 0.5) continue
      const maxTop = Math.max(candBox.y, baseHeightPx - candBox.h)
      const nextTop = Math.min(requiredTop, maxTop)
      if (nextTop <= candBox.y + 0.5) continue

      const candEl = slide.elements.find((e) => e.id === candNode.sourceId)
      if (!candEl || !('transform' in candEl) || !candEl.transform) continue
      const prevBottom = candBox.y + candBox.h
      candBox.y = nextTop
      const nextBottom = candBox.y + candBox.h
      candEl.transform = {
        ...candEl.transform,
        offset: {
          ...candEl.transform.offset,
          y: Math.round(nextTop * EMU_PER_PX_96),
        },
      }
      candEl.dirtyTransform = true
      changed = true
      frontier.push({ x: candBox.x, w: candBox.w, oldB: prevBottom, newB: nextBottom })
    }
  }

  const textNodes = rendered.nodes
    .filter((n) => !n.decoration && n.type === 'text' && n.text)
    .sort((a, b) => a.box.y - b.box.y)

  for (const node of textNodes) {
    if (node.type !== 'text' || !node.text) continue
    const el = slide.elements.find((e) => e.id === node.sourceId)
    if (el?.type !== 'text') continue
    const tel = el as TextElement
    const t = node.text

    if (
      opts.pinLineBreaks &&
      tel.text &&
      tel.text.paragraphs.length > 0 &&
      t.lines.length > tel.text.paragraphs.length
    ) {
      tel.text = {
        ...tel.text,
        paragraphs: pinLaidOutParagraphs(tel.text, t),
      }
      tel.dirty = true
      changed = true
    }

    const curBox = liveBoxes.get(node.sourceId) ?? {
      x: node.box.x,
      y: node.box.y,
      w: node.box.w,
      h: node.box.h,
    }
    const needH = Math.max(t.contentHeight, t.inkBottom ?? 0) + t.insets.t + t.insets.b
    const growPx = needH - curBox.h
    if (growPx < 0.5) continue

    const oldBottom = curBox.y + curBox.h
    curBox.h = needH
    if (t.anchor === 'middle') curBox.y -= growPx / 2
    else if (t.anchor === 'bottom') curBox.y -= growPx
    const newBottom = curBox.y + curBox.h

    const offset = {
      ...tel.transform.offset,
      y: Math.round(curBox.y * EMU_PER_PX_96),
      cy: Math.max(1, Math.round(needH * EMU_PER_PX_96)),
    }
    tel.transform = { ...tel.transform, offset }
    tel.dirtyTransform = true
    changed = true

    pushDownBelow(node.sourceId, curBox.x, curBox.w, oldBottom, newBottom)
  }
  return changed ? savePptx(opened) : null
}

function toEngineParagraphs(paragraphs: SpecParagraph[]): Paragraph[] {
  return paragraphs.map((p) => {
    const runs: TextRun[] = p.runs.map((r) => ({
      text: r.text,
      ...(r.sizePt ? { fontSize: r.sizePt } : {}),
      ...(r.bold ? { bold: true } : {}),
      ...(r.italic ? { italic: true } : {}),
      ...(r.color ? { color: r.color } : {}),
      ...(r.font ? { fontFamily: r.font, latinFont: r.font, eaFont: r.font } : {}),
    }))
    return {
      runs,
      ...(p.align ? { align: p.align } : {}),
      ...(p.lineSpacingPct ? { lineHeight: p.lineSpacingPct } : {}),
      ...(p.spaceBeforePt !== undefined ? { spaceBefore: p.spaceBeforePt } : {}),
      ...(p.spaceAfterPt !== undefined ? { spaceAfter: p.spaceAfterPt } : {}),
      ...(p.bullet
        ? { bullet: { type: 'char' as const, char: '•' }, marL: 228600, indent: -228600 }
        : {}),
    }
  })
}

function toGradientPatch(g: SpecGradient): GradientFillPatch {
  const stops = g.via
    ? [
        { pos: 0, color: g.from },
        { pos: 0.5, color: g.via },
        { pos: 1, color: g.to },
      ]
    : [
        { pos: 0, color: g.from },
        { pos: 1, color: g.to },
      ]
  return {
    stops,
    ...(g.radial ? { radial: true } : { angle: g.angleDeg ?? 135 }),
  }
}

function resolveShadowEffect(sh: boolean | SpecShadow) {
  if (typeof sh === 'boolean') {
    return {
      color: '#00000024',
      blurRad: Math.round(18 * EMU_PER_PT),
      dist: Math.round(6 * EMU_PER_PT),
      dirDeg: 90,
    }
  }
  return {
    color: sh.color ?? '#00000028',
    blurRad: Math.round((sh.blurPt ?? 16) * EMU_PER_PT),
    dist: Math.round((sh.distPt ?? 5) * EMU_PER_PT),
    dirDeg: sh.angleDeg ?? 90,
  }
}

function maxFontSizePt(el: SpecElement): number {
  if (el.type === 'image') return 0
  const paras = el.paragraphs ?? []
  let max = 0
  for (const p of paras) {
    for (const r of p.runs) {
      if ((r.sizePt ?? 14) > max) max = r.sizePt ?? 14
    }
  }
  return max
}

/**
 * Assigns deterministic Morph continuity names (`!!slide-title`, `!!eyebrow`,
 * `!!slide-subtitle`, `!!card-1`, etc.) to unnamed structural elements so both
 * PowerPoint Morph (`option="byObject"`) and Lycero's `MorphStage` smoothly
 * interpolate shared chrome and cards across slides.
 */
function resolveMorphNames(
  elements: readonly SpecElement[],
  canvasW: number,
  canvasH: number,
): Array<string | undefined> {
  const names: Array<string | undefined> = elements.map((e) => e.name)
  let hasTitle = false
  let hasSubtitle = false
  let hasEyebrow = false
  let hasHeaderRule = false
  let hasFooter = false
  let cardCount = 0

  for (let i = 0; i < elements.length; i++) {
    if (names[i]) continue
    const el = elements[i]!
    if (el.w * el.h >= canvasW * canvasH * 0.65) continue
    if (
      !hasEyebrow &&
      el.y < 140 &&
      el.h <= 46 &&
      el.w <= 360 &&
      (el.type === 'shape' || (el.type === 'text' && maxFontSizePt(el) <= 15))
    ) {
      names[i] = '!!eyebrow'
      hasEyebrow = true
      continue
    }
    if (!hasTitle && el.type === 'text' && el.y < 360 && maxFontSizePt(el) >= 26) {
      names[i] = '!!slide-title'
      hasTitle = true
      continue
    }
    if (
      hasTitle &&
      !hasSubtitle &&
      el.type === 'text' &&
      el.y < 420 &&
      maxFontSizePt(el) >= 13 &&
      maxFontSizePt(el) < 26
    ) {
      names[i] = '!!slide-subtitle'
      hasSubtitle = true
      continue
    }
    if (
      !hasHeaderRule &&
      el.type === 'shape' &&
      el.y >= 120 &&
      el.y < 230 &&
      el.h <= 4 &&
      el.w >= 400
    ) {
      names[i] = '!!header-rule'
      hasHeaderRule = true
      continue
    }
    if (!hasFooter && el.y >= canvasH - 64 && el.h <= 44 && el.w >= 120) {
      names[i] = '!!footer'
      hasFooter = true
      continue
    }
    if (
      el.type === 'shape' &&
      (el.shape === 'roundRect' || el.shape === 'rect') &&
      el.w >= 160 &&
      el.h >= 90 &&
      cardCount < 6
    ) {
      cardCount += 1
      names[i] = `!!card-${cardCount}`
    }
  }
  return names
}

interface CreatedSlideItem {
  specEl: SpecElement
  slideEl: SlideElement
}

/**
 * Open-Slide Spatial Card-Grouping Entrance Choreographer:
 * - Groups inner text/badges/icons with the card container (`roundRect`/`rect`)
 *   whose bounding box encloses their center, so cards and their contents
 *   glide in together as a single cohesive unit.
 * - Uses `withPrev` relative delays (`delayMs: 0` for members within the same
 *   unit, `delayMs: 75` between consecutive staggered units) so `buildSteps`
 *   and OOXML `<p:timing>` play the entire entrance sequence smoothly.
 * - Supports explicit `el.anim` overrides and `step >= 1` click-reveal groups.
 */
function synthesizeSlideAnimations(
  slide: Slide,
  created: readonly CreatedSlideItem[],
  canvasW: number,
  canvasH: number,
): SlideAnimation[] {
  const liveIds = new Set(slide.elements.map((e) => e.id))
  const active = created.filter(
    ({ specEl, slideEl }) =>
      liveIds.has(slideEl.id) && specEl.anim !== 'none' && specEl.anim !== false,
  )
  if (active.length === 0) return []

  // Identify container shapes (cards, pills, callout boxes) that are not full-bleed background slabs
  const containers = active
    .map((item, idx) => ({ item, idx, area: item.specEl.w * item.specEl.h }))
    .filter(({ item, area }) => {
      const s = item.specEl
      if (s.type !== 'shape') return false
      if (s.shape === 'line' || s.shape === 'lineArrow') return false
      return s.w >= 60 && s.h >= 22 && area < canvasW * canvasH * 0.65
    })
    .sort((a, b) => a.area - b.area)

  const parentOf = new Map<number, number>()
  for (let i = 0; i < active.length; i++) {
    const el = active[i]!.specEl
    const area = el.w * el.h
    // Skip full-bleed background slabs unless explicitly animated
    if (area >= canvasW * canvasH * 0.65 && !el.anim) {
      parentOf.set(i, -1)
      continue
    }
    const cx = el.x + el.w / 2
    const cy = el.y + el.h / 2
    for (const c of containers) {
      if (c.idx === i) continue
      if (area >= c.area) continue
      const cb = c.item.specEl
      if (cx >= cb.x - 6 && cx <= cb.x + cb.w + 6 && cy >= cb.y - 6 && cy <= cb.y + cb.h + 6) {
        parentOf.set(i, c.idx)
        break
      }
    }
  }

  // Resolve transitive container parents (e.g. text inside badge inside card -> card)
  const rootOf = (idx: number): number => {
    let cur = idx
    const seen = new Set<number>()
    while (parentOf.has(cur)) {
      const p = parentOf.get(cur)!
      if (p < 0) return -1
      if (seen.has(p)) break
      seen.add(p)
      cur = p
    }
    return cur
  }

  const unitMap = new Map<number, CreatedSlideItem[]>()
  for (let i = 0; i < active.length; i++) {
    const r = rootOf(i)
    if (r < 0) continue
    const list = unitMap.get(r) ?? []
    list.push(active[i]!)
    unitMap.set(r, list)
  }

  interface VisualUnit {
    lead: SpecElement
    members: CreatedSlideItem[]
    step: number
    explicitAnim?: SpecAnim
  }

  const units: VisualUnit[] = []
  for (const [, members] of unitMap) {
    const lead = members[0]!.specEl
    const explicitAnim = members
      .map((m) => (typeof m.specEl.anim === 'object' && m.specEl.anim ? m.specEl.anim : undefined))
      .find(Boolean)
    const step = explicitAnim?.step ?? 0
    units.push({ lead, members, step, explicitAnim })
  }

  const isChromeUnit = (lead: SpecElement): boolean =>
    (lead.y < 165 && lead.w * lead.h < canvasW * canvasH * 0.25) ||
    (lead.y >= canvasH - 64 && lead.h <= 44) ||
    lead.name === '!!footer' ||
    lead.name === '!!header-rule'

  // Sort units by step, then chrome/header first, then visual row (quantized to 40px bands), then left-to-right
  units.sort((a, b) => {
    if (a.step !== b.step) return a.step - b.step
    const chromeA = isChromeUnit(a.lead) ? 0 : 1
    const chromeB = isChromeUnit(b.lead) ? 0 : 1
    if (chromeA !== chromeB) return chromeA - chromeB
    const rowA = Math.round(a.lead.y / 40)
    const rowB = Math.round(b.lead.y / 40)
    if (rowA !== rowB) return rowA - rowB
    return a.lead.x - b.lead.x
  })

  const out: SlideAnimation[] = []
  for (let ui = 0; ui < units.length; ui++) {
    const u = units[ui]!
    const exp = u.explicitAnim
    const isHeader = isChromeUnit(u.lead)
    const isHeroMedia = u.lead.type === 'image' || u.lead.w * u.lead.h > canvasW * canvasH * 0.18
    const defaultEffect: AnimEffectKind = isHeader ? 'fade' : isHeroMedia ? 'zoom' : 'flyIn'
    const effect: AnimEffectKind = exp?.effect ?? defaultEffect
    const direction: AnimDirection | undefined =
      exp?.direction ?? (effect === 'flyIn' ? 'bottom' : undefined)
    const durationMs = exp?.durationMs ?? (effect === 'fade' ? 240 : 280)
    const prevStep = ui > 0 ? units[ui - 1]!.step : u.step
    const startsClickStep = (ui > 0 && u.step > prevStep) || exp?.trigger === 'onClick'

    for (let mi = 0; mi < u.members.length; mi++) {
      const member = u.members[mi]!
      const spid = elementSpid(member.slideEl)
      if (!spid) continue
      const memberExp =
        typeof member.specEl.anim === 'object' && member.specEl.anim
          ? member.specEl.anim
          : undefined
      const trigger: AnimTrigger =
        mi === 0
          ? startsClickStep
            ? 'onClick'
            : (exp?.trigger ?? 'withPrev')
          : (memberExp?.trigger ?? 'withPrev')
      const delayMs =
        mi === 0
          ? (exp?.delayMs ?? (ui === 0 || startsClickStep ? 0 : 75))
          : (memberExp?.delayMs ?? 0)
      out.push({
        spid,
        effect: memberExp?.effect ?? effect,
        trigger,
        durationMs: memberExp?.durationMs ?? durationMs,
        delayMs,
        ...((memberExp?.direction ?? direction)
          ? { direction: memberExp?.direction ?? direction }
          : {}),
      })
    }
  }
  return out
}

/**
 * Builds a one-slide PPTX from the spec. Elements are added in array order
 * (spec order = z-order); a background color becomes a full-bleed rect that
 * the landing pipeline's promoteSlideBackground lifts to the slide background.
 */
export async function buildPagePptx(
  spec: PageSpec,
  deps: BuildPageDeps,
  canvasW = SPEC_CANVAS_W,
): Promise<{ bytes: Uint8Array; imageFailures: string[]; imageWarnings: string[] }> {
  const opened = await openPptx(await createBlankPptx())
  const slide = opened.deck.slides[0]!
  const canvasH = Math.round((canvasW * opened.deck.size.cy) / opened.deck.size.cx)
  const scale = opened.deck.size.cx / canvasW
  const toEmu = (px: number) => Math.round(px * scale)
  const anchorOf = (
    v: 'top' | 'middle' | 'bottom' | undefined,
    dflt: 't' | 'ctr',
  ): 't' | 'ctr' | 'b' => (v === 'top' ? 't' : v === 'middle' ? 'ctr' : v === 'bottom' ? 'b' : dflt)
  // Zero insets: the spec's boxes are exact; PowerPoint's default 0.1in/0.05in
  // insets would shift every text off its planned spot.
  const zeroInsets = { l: 0, t: 0, r: 0, b: 0 }

  const imageFailures: string[] = []
  const imageWarnings: string[] = []
  const fetched = new Map<string, { bytes: Uint8Array; ext: string } | null>()
  await Promise.all(
    [
      ...new Set(spec.elements.filter((e) => e.type === 'image').map((e) => (e as SpecImage).url)),
    ].map(async (url) => {
      try {
        fetched.set(url, await deps.fetchImage(url))
      } catch {
        fetched.set(url, null)
      }
    }),
  )

  if (spec.backgroundGradient) {
    setSlideBackground(opened, slide, toGradientPatch(spec.backgroundGradient))
  } else if (spec.background) {
    addElement(slide, {
      kind: 'rect',
      offset: { x: 0, y: 0, cx: opened.deck.size.cx, cy: opened.deck.size.cy },
      fillColor: spec.background,
    })
  }

  const morphNames = resolveMorphNames(spec.elements, canvasW, canvasH)
  const createdItems: CreatedSlideItem[] = []

  for (let i = 0; i < spec.elements.length; i++) {
    const el = spec.elements[i]!
    const morphName = morphNames[i]
    const offset = {
      x: toEmu(el.x),
      y: toEmu(el.y),
      cx: Math.max(1, toEmu(el.w)),
      cy: Math.max(1, toEmu(el.h)),
    }
    if (el.type === 'image') {
      const img = fetched.get(el.url)
      if (!img) {
        imageFailures.push(el.url)
        continue
      }
      const pic = addPicture(opened, slide, { bytes: img.bytes, ext: img.ext, offset })
      if (!pic) {
        imageFailures.push(el.url)
        continue
      }
      if (morphName) pic.name = morphName
      const dims = deps.imageDims?.(img.bytes) ?? null
      if (dims) {
        const crop = coverCropFractions(dims.width, dims.height, el.w, el.h)
        if (crop) {
          editPictureSrcRect(slide, pic.id, crop)
          const warning = heavyCropWarning(el, dims, crop)
          if (warning) imageWarnings.push(warning)
        }
      }
      createdItems.push({ specEl: el, slideEl: pic })
      continue
    }
    if (el.type === 'text') {
      const created = addElement(slide, {
        kind: 'textbox',
        offset,
        ...(morphName ? { name: morphName } : {}),
        paragraphs: toEngineParagraphs(el.paragraphs),
        bodyPr: { wrap: 'square', anchor: anchorOf(el.valign, 't'), insetsEmu: zeroInsets },
      })
      createdItems.push({ specEl: el, slideEl: created })
      continue
    }
    const minSidePx = Math.max(1, Math.min(el.w, el.h))
    const defaultRadiusPx = el.h <= 46 ? minSidePx / 2 : 14
    const targetRadiusPx = el.radius !== undefined ? Math.max(0, el.radius) : defaultRadiusPx
    const roundRectAdj =
      el.shape === 'roundRect'
        ? { adj: Math.round(Math.min(0.5, targetRadiusPx / minSidePx) * 100000) }
        : undefined
    const created = addElement(slide, {
      kind: el.shape,
      offset,
      ...(morphName ? { name: morphName } : {}),
      ...(roundRectAdj ? { adjustments: roundRectAdj } : {}),
      ...(el.fill ? { fillColor: el.fill } : {}),
      ...(el.stroke
        ? {
            stroke: {
              color: el.stroke.color,
              widthEmu: Math.round(el.stroke.widthPt * EMU_PER_PT),
            },
          }
        : {}),
      ...(el.flipH ? { flipH: true } : {}),
      ...(el.flipV ? { flipV: true } : {}),
      ...(el.paragraphs ? { paragraphs: toEngineParagraphs(el.paragraphs) } : {}),
      ...(el.paragraphs
        ? { bodyPr: { wrap: 'square', anchor: anchorOf(el.valign, 'ctr'), insetsEmu: zeroInsets } }
        : {}),
    })
    if (el.gradient) {
      setElementFill(opened, slide, created.id, toGradientPatch(el.gradient))
    }
    if (el.shadow) {
      setElementEffects(slide, created.id, { shadow: resolveShadowEffect(el.shadow) })
    }
    createdItems.push({ specEl: el, slideEl: created })
  }

  if (!spec.backgroundGradient) {
    promoteSlideBackground(slide, opened.deck.size)
  }
  setSlideTransition(slide, spec.transition ?? 'morph')
  const synthesizedAnims = synthesizeSlideAnimations(slide, createdItems, canvasW, canvasH)
  if (synthesizedAnims.length > 0) {
    setSlideAnimations(slide, synthesizedAnims)
  }
  if (spec.notes) {
    setSlideNotes(opened, 0, spec.notes)
  }
  let bytes = await savePptx(opened)
  if (deps.fontMetrics) {
    bytes =
      (await growTextBoxesToContent(bytes, deps.fontMetrics, {
        ...(deps.pinLineBreaks ? { pinLineBreaks: true } : {}),
      })) ?? bytes
  }
  return { bytes, imageFailures, imageWarnings }
}

/** Below this share of the source left visible, the center crop is reported (a square photo in a 16:9 banner keeps 56% and passes). */
export const HEAVY_CROP_KEEP = 0.5

/**
 * A box whose aspect is far from the picture's throws most of the picture
 * away: a 1200×1500 product shot in a 314×96 strip shows a quarter of it, cut
 * through the middle. The build still lands it (cover-crop never distorts),
 * but the author should hear about it.
 */
function heavyCropWarning(
  el: SpecImage,
  dims: { width: number; height: number },
  crop: { l: number; t: number; r: number; b: number },
): string | null {
  const kept = (1 - crop.l - crop.r) * (1 - crop.t - crop.b)
  if (kept >= HEAVY_CROP_KEEP) return null
  const axis = crop.t > 0 ? 'top and bottom' : 'left and right'
  return `image ${el.url}: the ${Math.round(el.w)}×${Math.round(el.h)} box shows only ${Math.round(kept * 100)}% of the ${dims.width}×${dims.height} picture (center crop, ${axis} cut off); size the box nearer the picture's aspect ratio or crop the file first`
}
