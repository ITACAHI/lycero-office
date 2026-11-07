/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import {
  computeVerticalBudget,
  fillEmptyLines,
  groupAtomsIntoLines,
  lineToRuns,
  pinLaidOutParagraphs,
  type Atom,
  type AtomLine,
  type AtomRun,
  type AtomStyle,
  type VerticalBudgetBlock,
  type VerticalBudgetResult,
} from '@lycero/pptx-render'

export {
  computeVerticalBudget,
  fillEmptyLines,
  groupAtomsIntoLines,
  lineToRuns,
  pinLaidOutParagraphs,
  type Atom,
  type AtomLine,
  type AtomRun,
  type AtomStyle,
  type VerticalBudgetBlock,
  type VerticalBudgetResult,
}

/**
 * Default high-DPI raster multiplier for CSS effects that cannot be represented
 * natively in DrawingML (`open-slide` `raster.ts` parity).
 */
export const MAX_PIXEL_RATIO = 2

/** Maximum output pixel area (`w * h * pixelRatio^2`) per rasterized layer. */
export const MAX_RASTER_PIXELS = 3_000_000

/**
 * Compute the high-DPI raster `pixelRatio` (up to `MAX_PIXEL_RATIO = 2`) for a
 * bounding box in slide px, clamping when the region area would exceed `MAX_RASTER_PIXELS`.
 */
export function pixelRatioFor(region: { w: number; h: number }): number {
  const area = Math.max(1, region.w * region.h)
  const maxByBudget = Math.sqrt(MAX_RASTER_PIXELS / area)
  return Math.max(0.5, Math.min(MAX_PIXEL_RATIO, maxByBudget))
}

/**
 * Subset of computed CSS properties inspected when deciding whether a DOM/scene node
 * stays a Native PowerPoint Object or needs a high-DPI (`pixelRatio: 2`) raster layer.
 */
export interface SceneStyleSnapshot {
  filter?: string
  backdropFilter?: string
  webkitBackdropFilter?: string
  mixBlendMode?: string
  clipPath?: string
  maskImage?: string
  webkitMaskImage?: string
  transform?: string
  backgroundImage?: string
  boxShadow?: string
}

/**
 * Parse a 2D CSS `matrix(a, b, c, d, tx, ty)` or `matrix3d(...)` string and check
 * whether it applies non-uniform scaling or skew that PowerPoint's `<a:xfrm rot>`
 * cannot represent natively (`open-slide` `measure.ts` parity).
 */
export function hasNonRigidTransform(transform: string | undefined): boolean {
  if (!transform || transform === 'none') return false
  const m2d = /^matrix\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),/.exec(transform.trim())
  if (m2d) {
    const a = Number(m2d[1])
    const b = Number(m2d[2])
    const c = Number(m2d[3])
    const d = Number(m2d[4])
    if (![a, b, c, d].every(Number.isFinite)) return true
    const scaleX = Math.hypot(a, b)
    const scaleY = Math.hypot(c, d)
    const dot = a * c + b * d
    if (Math.abs(scaleX - 1) > 0.02 || Math.abs(scaleY - 1) > 0.02) return true
    if (Math.abs(dot) > 0.02) return true
    return false
  }
  if (/skew|scale3d|perspective|rotate3d|rotateX|rotateY/i.test(transform)) return true
  return false
}

/**
 * Returns `true` when a scene node's subtree uses CSS effects (`filter: blur()`,
 * `backdrop-filter`, `mix-blend-mode`, `clip-path`, `mask-image`, or non-rigid transform)
 * that cannot be expressed as native DrawingML shapes/text and must be rasterized at `pixelRatio: 2`.
 */
export function needsSubtreeRaster(style: SceneStyleSnapshot): boolean {
  if (style.filter && style.filter !== 'none') return true
  if (style.backdropFilter && style.backdropFilter !== 'none') return true
  if (style.webkitBackdropFilter && style.webkitBackdropFilter !== 'none') return true
  if (style.mixBlendMode && style.mixBlendMode !== 'normal') return true
  if (style.clipPath && style.clipPath !== 'none') return true
  if (style.maskImage && style.maskImage !== 'none') return true
  if (style.webkitMaskImage && style.webkitMaskImage !== 'none') return true
  if (hasNonRigidTransform(style.transform)) return true
  return false
}

/**
 * Split top-level comma-separated CSS values (e.g. `background-image` or `box-shadow`)
 * without splitting commas inside `rgb(...)` / `linear-gradient(...)`.
 */
function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '(') depth++
    else if (ch === ')' && depth > 0) depth--
    else if (ch === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  const tail = value.slice(start).trim()
  if (tail) parts.push(tail)
  return parts
}

/**
 * Returns `true` when a node's background or shadow uses complex CSS (e.g. `radial-gradient`,
 * `conic-gradient`, multi-layer `background-image`, multiple `box-shadow`s, or `inset` shadow)
 * that should be rasterized into a separate background `Picture` at `pixelRatio: 2` while
 * keeping the node's text and child shapes as **Native PowerPoint Objects**.
 */
export function paintsBackgroundSeparately(style: SceneStyleSnapshot, isLeaf = false): boolean {
  const bgImg = style.backgroundImage?.trim()
  if (bgImg && bgImg !== 'none') {
    const layers = splitTopLevelCommas(bgImg)
    if (layers.length > 1) return true
    const single = layers[0] ?? ''
    if (/^(radial|conic|repeating-)/i.test(single)) return true
    if (/^url\(/i.test(single) && !isLeaf) return true
  }
  const shadow = style.boxShadow?.trim()
  if (shadow && shadow !== 'none') {
    const shadows = splitTopLevelCommas(shadow)
    if (shadows.length > 1) return true
    if (/\binset\b/i.test(shadows[0] ?? '')) return true
  }
  return false
}
