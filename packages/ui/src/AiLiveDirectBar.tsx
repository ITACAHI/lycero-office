/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Astryx Remote AI Cursor & Colored Caret Overlay (`AiLiveDirectBar`).
 * Renders a zero-clutter, remote-collaboration style AI pointer cursor,
 * colored blinking caret, and subtle target-region highlight directly over the
 * DOM element currently being edited by AI on the center canvas.
 * No floating status boxes or banners are rendered over the document content.
 */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AiLiveDirectBar.css'

export interface AiLiveDirectBarProps {
  /** Whether AI is actively streaming, reasoning, or executing direct tools */
  readonly busy: boolean
  /** Current phase or active tool summary */
  readonly phaseLabel?: string | null | undefined
  /** Active tool name (mapped to a friendly label when phaseLabel is generic) */
  readonly activeToolName?: string | null | undefined
  /** Whether the model is currently streaming reasoning tokens */
  readonly isReasoning?: boolean | undefined
  /** Number of tool steps executed in this run */
  readonly stepCount?: number | undefined
  /** Stop / cancel callback while busy */
  readonly onStop?: (() => void) | undefined
  /** Whether the completed run has direct canvas edits ready for review (Undo / Keep) */
  readonly hasReview?: boolean | undefined
  /** Optional custom label for the post-edit review bar */
  readonly reviewLabel?: string | null | undefined
  /** Revert / rollback the latest AI direct edit */
  readonly onUndo?: (() => void) | undefined
  /** Accept / keep the latest AI direct edit and dismiss the review bar */
  readonly onKeep?: (() => void) | undefined
  /** UI language ('vi' default) */
  readonly lang?: string | undefined
  /** Portal the remote AI cursor/caret over the center editor canvas (default: true) */
  readonly portalCanvas?: boolean | undefined
  /** Exact target location being edited on the screen (e.g. "Slide 2/8 • #e_3", "Đoạn #4–6", "Sheet1 • A1:D10") */
  readonly targetLocation?: string | null | undefined
  /** Real-time snippet of the content/text/formula AI is actively writing or modifying */
  readonly livePreview?: string | null | undefined
}

interface RemoteTargetMetrics {
  /** Cursor pointer (x, y) in viewport coordinates */
  readonly cursorX: number
  readonly cursorY: number
  /** Blinking colored caret in viewport coordinates */
  readonly caretX: number
  readonly caretY: number
  readonly caretHeight: number
  /** Active target block/element bounding box (when a specific element is matched) */
  readonly boxLeft: number
  readonly boxTop: number
  readonly boxWidth: number
  readonly boxHeight: number
  readonly showBox: boolean
  readonly showCaret: boolean
}

function getCanvasBounds(): { left: number; right: number; top: number; bottom: number } {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { left: 24, right: 900, top: 72, bottom: 700 }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = 16
  let right = vw - 16
  const panel = document.querySelector<HTMLElement>('.ai-dock, .copilot:not(.collapsed), .ai-panel')
  if (panel) {
    const rect = panel.getBoundingClientRect()
    if (rect.width >= 48 && rect.width < vw - 80) {
      if (rect.left <= 16) {
        left = Math.max(16, Math.round(rect.right + 12))
      } else if (rect.right >= vw - 16) {
        right = Math.min(vw - 16, Math.round(rect.left - 12))
      }
    }
  }
  return {
    left,
    right: Math.max(left + 120, right),
    top: 64,
    bottom: Math.max(180, vh - 32),
  }
}

function extractBlockNumber(targetLocation?: string | null): number | null {
  if (!targetLocation) return null
  const m = /#(\d+)/.exec(targetLocation)
  if (!m?.[1]) return null
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

function isRectVisible(rect: DOMRect, bounds: { left: number; right: number; top: number; bottom: number }): boolean {
  if (rect.width < 2 && rect.height < 2) return false
  if (rect.bottom < bounds.top - 40 || rect.top > bounds.bottom + 40) return false
  if (rect.right < bounds.left - 40 || rect.left > bounds.right + 40) return false
  return true
}

function computeTextEndCaret(
  el: HTMLElement,
  fallbackRect: DOMRect,
): { x: number; y: number; height: number } {
  try {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const rects = range.getClientRects()
    if (rects.length > 0) {
      const last = rects[rects.length - 1]!
      if (last.height > 2 && (last.left > 0 || last.top > 0)) {
        return {
          x: Math.round(last.right),
          y: Math.round(last.top),
          height: Math.max(16, Math.min(34, Math.round(last.height))),
        }
      }
    }
  } catch {
    // Fallback to element box below
  }
  return {
    x: Math.round(fallbackRect.left + Math.min(fallbackRect.width - 4, 24)),
    y: Math.round(fallbackRect.top + 3),
    height: Math.max(16, Math.min(28, Math.round(fallbackRect.height - 6))),
  }
}

function resolveRemoteTargetMetrics(
  targetLocation?: string | null,
  activeToolName?: string | null,
): { metrics: RemoteTargetMetrics; element: HTMLElement | null } {
  const bounds = getCanvasBounds()

  // 1. Slides: active morph frame or spotlighted slide element
  const slideMorph = document.querySelector<HTMLElement>(
    '.ai-live-morph-frame, .ai-live-el-spotlight.is-focused, .ai-live-el-spotlight',
  )
  if (slideMorph) {
    const rect = slideMorph.getBoundingClientRect()
    if (isRectVisible(rect, bounds)) {
      const caretX = Math.min(bounds.right - 20, Math.max(bounds.left, Math.round(rect.right - 4)))
      const caretY = Math.min(bounds.bottom - 24, Math.max(bounds.top, Math.round(rect.top + 4)))
      const caretHeight = Math.max(16, Math.min(32, Math.round(rect.height - 8)))
      return {
        element: slideMorph,
        metrics: {
          cursorX: Math.min(bounds.right - 40, Math.max(bounds.left, Math.round(rect.right - 2))),
          cursorY: Math.min(bounds.bottom - 28, Math.max(bounds.top, Math.round(rect.bottom - 2))),
          caretX,
          caretY,
          caretHeight,
          boxLeft: Math.round(rect.left),
          boxTop: Math.round(rect.top),
          boxWidth: Math.round(rect.width),
          boxHeight: Math.round(rect.height),
          // Slides already renders .ai-live-morph-frame border on stage
          showBox: false,
          showCaret: true,
        },
      }
    }
  }

  // 2. Docs / Markdown: ProseMirror blocks (.ai-changed, indexed block #N, or active streaming block)
  const pm = document.querySelector<HTMLElement>('.ProseMirror')
  if (pm) {
    let targetBlock: HTMLElement | null = null
    const changedBlocks = pm.querySelectorAll<HTMLElement>('.ai-changed, [data-ai-changed="true"]')
    if (changedBlocks.length > 0) {
      targetBlock = changedBlocks[changedBlocks.length - 1] ?? null
    }
    if (!targetBlock) {
      const blockNum = extractBlockNumber(targetLocation)
      if (blockNum !== null && pm.children.length > 0) {
        const idx = Math.min(pm.children.length - 1, Math.max(0, blockNum - 1))
        const candidate = pm.children[idx]
        if (candidate instanceof HTMLElement) targetBlock = candidate
      }
    }
    if (!targetBlock && pm.children.length > 0) {
      // During write_document / streaming or general edits, track the last non-empty block
      for (let i = pm.children.length - 1; i >= 0; i--) {
        const child = pm.children[i]
        if (child instanceof HTMLElement && child.offsetHeight > 0) {
          targetBlock = child
          break
        }
      }
    }

    if (targetBlock) {
      const rect = targetBlock.getBoundingClientRect()
      if (isRectVisible(rect, bounds)) {
        const caret = computeTextEndCaret(targetBlock, rect)
        const clampedCaretX = Math.min(bounds.right - 20, Math.max(bounds.left, caret.x))
        const clampedCaretY = Math.min(bounds.bottom - 24, Math.max(bounds.top, caret.y))
        return {
          element: targetBlock,
          metrics: {
            cursorX: Math.min(bounds.right - 44, clampedCaretX + 6),
            cursorY: Math.min(bounds.bottom - 24, clampedCaretY + caret.height - 2),
            caretX: clampedCaretX,
            caretY: clampedCaretY,
            caretHeight: caret.height,
            boxLeft: Math.round(rect.left - 4),
            boxTop: Math.round(rect.top - 2),
            boxWidth: Math.round(rect.width + 8),
            boxHeight: Math.round(rect.height + 4),
            showBox: true,
            showCaret: true,
          },
        }
      }
    }
  }

  // 3. Sheets: Univer active cell selection overlay
  const sheetSel = document.querySelector<HTMLElement>(
    '.univer-selection-style, [data-u-comp="selection-render"], .univer-cell-editor',
  )
  if (sheetSel) {
    const rect = sheetSel.getBoundingClientRect()
    if (isRectVisible(rect, bounds) && rect.width < bounds.right - bounds.left) {
      const caretX = Math.min(bounds.right - 24, Math.max(bounds.left, Math.round(rect.right - 3)))
      const caretY = Math.min(bounds.bottom - 24, Math.max(bounds.top, Math.round(rect.top + 3)))
      return {
        element: sheetSel,
        metrics: {
          cursorX: Math.min(bounds.right - 44, Math.max(bounds.left, Math.round(rect.right + 2))),
          cursorY: Math.min(bounds.bottom - 24, Math.max(bounds.top, Math.round(rect.bottom + 2))),
          caretX,
          caretY,
          caretHeight: Math.max(15, Math.min(26, Math.round(rect.height - 4))),
          boxLeft: Math.round(rect.left),
          boxTop: Math.round(rect.top),
          boxWidth: Math.round(rect.width),
          boxHeight: Math.round(rect.height),
          showBox: true,
          showCaret: true,
        },
      }
    }
  }

  // 4. PDF / HTML / Slide Stage fallback
  const stageEl = document.querySelector<HTMLElement>(
    '.pdf-annot-highlight:last-of-type, .slide-node.selected, .slide-stage, .page:first-of-type, iframe.preview-frame, .univer-render-canvas',
  )
  if (stageEl) {
    const rect = stageEl.getBoundingClientRect()
    if (isRectVisible(rect, bounds)) {
      const cx = Math.min(
        bounds.right - 56,
        Math.max(bounds.left + 24, Math.round(rect.left + Math.min(rect.width * 0.55, 320))),
      )
      const cy = Math.min(
        bounds.bottom - 36,
        Math.max(bounds.top + 24, Math.round(rect.top + Math.min(rect.height * 0.38, 220))),
      )
      const isSpecificNode =
        stageEl.classList.contains('pdf-annot-highlight') ||
        stageEl.classList.contains('slide-node')
      return {
        element: isSpecificNode ? stageEl : null,
        metrics: {
          cursorX: cx,
          cursorY: cy,
          caretX: cx - 4,
          caretY: cy - 16,
          caretHeight: 20,
          boxLeft: Math.round(rect.left),
          boxTop: Math.round(rect.top),
          boxWidth: Math.round(rect.width),
          boxHeight: Math.round(rect.height),
          showBox: isSpecificNode,
          showCaret: Boolean(activeToolName || targetLocation),
        },
      }
    }
  }

  // Default canvas center-left anchor while initializing
  const defaultX = Math.round(bounds.left + (bounds.right - bounds.left) * 0.48)
  const defaultY = Math.round(bounds.top + (bounds.bottom - bounds.top) * 0.36)
  return {
    element: null,
    metrics: {
      cursorX: defaultX,
      cursorY: defaultY,
      caretX: defaultX - 4,
      caretY: defaultY - 16,
      caretHeight: 20,
      boxLeft: defaultX - 40,
      boxTop: defaultY - 20,
      boxWidth: 80,
      boxHeight: 28,
      showBox: false,
      showCaret: Boolean(activeToolName || targetLocation),
    },
  }
}

function compactTagLabel(targetLocation?: string | null): string {
  if (!targetLocation) return 'Lycero AI'
  const cleaned = targetLocation
    .replace(/^Trang A4\s*•\s*/i, '')
    .replace(/^Markdown\s*•\s*/i, '')
    .replace(/^HTML\s*•\s*/i, '')
    .replace(/^PDF\s*•\s*/i, '')
    .trim()
  if (!cleaned) return 'Lycero AI'
  return cleaned.length > 26 ? `${cleaned.slice(0, 25)}…` : cleaned
}

export function AiLiveDirectBar({
  busy,
  activeToolName,
  portalCanvas = true,
  targetLocation,
}: AiLiveDirectBarProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<RemoteTargetMetrics | null>(null)
  const lastScrolledElRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!busy || !portalCanvas || typeof document === 'undefined') {
      setMetrics(null)
      lastScrolledElRef.current = null
      return
    }

    let rafId = 0
    const syncPosition = () => {
      const { metrics: next, element } = resolveRemoteTargetMetrics(targetLocation, activeToolName)
      setMetrics(next)
      if (element && element !== lastScrolledElRef.current) {
        lastScrolledElRef.current = element
        const rect = element.getBoundingClientRect()
        const bounds = getCanvasBounds()
        if (rect.top < bounds.top + 16 || rect.bottom > bounds.bottom - 16) {
          try {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          } catch {
            // ignore
          }
        }
      }
    }

    const scheduleSync = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        syncPosition()
      })
    }

    syncPosition()
    const intervalId = window.setInterval(scheduleSync, 110)
    window.addEventListener('resize', scheduleSync)
    window.addEventListener('scroll', scheduleSync, true)

    const observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-ai-changed'],
    })

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      window.clearInterval(intervalId)
      window.removeEventListener('resize', scheduleSync)
      window.removeEventListener('scroll', scheduleSync, true)
      observer.disconnect()
    }
  }, [busy, portalCanvas, targetLocation, activeToolName])

  if (!busy || !portalCanvas || !metrics || typeof document === 'undefined') {
    return null
  }

  const label = compactTagLabel(targetLocation)

  return createPortal(
    <div className="lycero-ai-remote-layer" aria-hidden="true">
      {metrics.showBox && (
        <div
          className="lycero-ai-remote-box"
          style={{
            transform: `translate3d(${metrics.boxLeft}px, ${metrics.boxTop}px, 0)`,
            width: `${metrics.boxWidth}px`,
            height: `${metrics.boxHeight}px`,
          }}
        />
      )}
      {metrics.showCaret && (
        <div
          className="lycero-ai-remote-caret"
          style={{
            transform: `translate3d(${metrics.caretX}px, ${metrics.caretY}px, 0)`,
            height: `${metrics.caretHeight}px`,
          }}
        >
          <span className="lycero-ai-remote-caret-head" />
        </div>
      )}
      <div
        className="lycero-ai-remote-cursor"
        style={{
          transform: `translate3d(${metrics.cursorX}px, ${metrics.cursorY}px, 0)`,
        }}
      >
        <span className="lycero-ai-remote-cursor-ripple" />
        <svg
          className="lycero-ai-remote-cursor-svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M4.2 3.4L19.4 10.7C20.3 11.1 20.2 12.4 19.2 12.7L12.6 14.5L9.7 20.6C9.3 21.5 8 21.4 7.7 20.4L3.1 4.6C2.8 3.7 3.4 3 4.2 3.4Z"
            fill="var(--color-ai-action, #8B3A1A)"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        <span className="lycero-ai-remote-tag">{label}</span>
      </div>
    </div>,
    document.body,
  )
}
