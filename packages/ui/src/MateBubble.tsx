/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Lycero Mate — Floating Bubble Toolbar.
 *
 * Renders a small floating toolbar above the user's selection. The bubble hosts
 * common pedagogical rewrite actions (Mở rộng / Rút gọn / Sửa chính tả /
 * Trắc nghiệm) and a "Đưa vào Lycero Mate" button that hands the snippet off
 * to the active Mate panel.
 *
 * Architecture: the bubble is a singleton visual; any host (Docs / Sheets /
 * Slides / PDF text-edit) posts the current selection through
 * `mateBubble.broadcast({ rect, text })` from a `selectionchange` listener.
 * The bubble itself is mounted once in the shell's home/pane area — the host
 * never imports it. Subscription is auto-cleaned when the last listener goes
 * away.
 *
 * Vietnamese primary; English fallback in `MateBubbleI18n`.
 */
import React, { useEffect, useRef, useState } from 'react'
import { defaultMateBubbleI18n, type MateBubbleAction, type MateBubbleI18n, type MateBubbleState } from './mate-bubble-i18n'
import './MateBubble.css'

/** Vertical space between the selection's top edge and the bubble. */
const BUBBLE_GAP_PX = 8
/** Move the bubble this far below the selection bottom when the top is clipped. */
const FALLBACK_OFFSET_PX = 28
/** Hide the bubble if the selection text is shorter than this. */
const MIN_TEXT_LEN = 2

type Listener = (state: MateBubbleState | null) => void

class MateBubbleBus {
  private listeners = new Set<Listener>()
  private current: MateBubbleState | null = null

  broadcast(state: MateBubbleState | null): void {
    this.current = state
    for (const cb of this.listeners) cb(state)
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb)
    cb(this.current)
    return () => {
      this.listeners.delete(cb)
    }
  }

  count(): number {
    return this.listeners.size
  }
}

export const mateBubble = new MateBubbleBus()

export interface MateBubbleProps {
  /** language override; defaults to Vietnamese. */
  readonly i18n?: MateBubbleI18n
  /** Called when the user picks a pedagogical action. */
  readonly onAction?: (action: MateBubbleAction, text: string) => void
  /** Called when the user clicks "Đưa vào Lycero Mate". */
  readonly onHandOff?: (text: string) => void
  /**
   * Optional safe-area rect (left/right edges in viewport coords) that
   * excludes side panels occluding the bubble. When omitted, falls back to
   * the window's inner width. Re-measure on resize / panel toggle.
   */
  readonly safeRect?: { left: number; right: number }
}

export function MateBubble({
  i18n = defaultMateBubbleI18n,
  onAction,
  onHandOff,
  safeRect,
}: MateBubbleProps): React.JSX.Element | null {
  const [state, setState] = useState<MateBubbleState | null>(null)
  const [flipBelow, setFlipBelow] = useState(false)

  useEffect(() => mateBubble.subscribe(setState), [])

  // Re-position when the selection scroll moves the rect off-screen.
  // When the rect's top is clamped by the viewport, flip the bubble below the
  // selection bottom so it always sits inside the editor.
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!state) {
      setFlipBelow(false)
      return
    }
    const el = ref.current
    if (!el) return
    const desiredTop = state.rect.top - el.offsetHeight - BUBBLE_GAP_PX
    const fits = desiredTop > 0 && state.rect.top > 0
    setFlipBelow(!fits)
  }, [state])

  if (!state || state.text.length < MIN_TEXT_LEN) return null
  const viewport = safeRect ?? viewportLeftRight(ref.current)
  const left = clampLeft(state.rect, viewport)

  // Average character height (~16-20px for body) — used when nothing else is known.
  const INFERRED_HEIGHT = 22

  return (
    <div
      ref={ref}
      className={
        'lycero-mate-bubble' +
        (flipBelow ? ' lycero-mate-bubble-below' : '') +
        (state.tailwind !== 'left' ? ` lycero-mate-bubble-tail-${state.tailwind}` : '')
      }
      role="toolbar"
      aria-label={i18n.toolbarLabel}
      style={{
        left: `${left}px`,
        top: flipBelow
          ? `${state.rect.top + state.rect.height + BUBBLE_GAP_PX}px`
          : `${state.rect.top - BUBBLE_GAP_PX - INFERRED_HEIGHT}px`,
      }}
    >
      <button
        type="button"
        className="lycero-mate-bubble-btn"
        onClick={() => onAction?.('expand', state.text)}
        title={i18n.expandTitle}
        data-action="expand"
      >
        {i18n.expand}
      </button>
      <button
        type="button"
        className="lycero-mate-bubble-btn"
        onClick={() => onAction?.('shorten', state.text)}
        title={i18n.shortenTitle}
        data-action="shorten"
      >
        {i18n.shorten}
      </button>
      <button
        type="button"
        className="lycero-mate-bubble-btn"
        onClick={() => onAction?.('grammarcheck', state.text)}
        title={i18n.grammarTitle}
        data-action="grammar"
      >
        {i18n.grammar}
      </button>
      <button
        type="button"
        className="lycero-mate-bubble-btn"
        onClick={() => onAction?.('gen-mcq', state.text)}
        title={i18n.quizTitle}
        data-action="gen-mcq"
      >
        {i18n.quiz}
      </button>
      <span className="lycero-mate-bubble-divider" aria-hidden />
      <button
        type="button"
        className="lycero-mate-bubble-btn lycero-mate-bubble-btn-cta"
        onClick={() => onHandOff?.(state.text)}
        title={i18n.handoffTitle}
        data-action="handoff"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {i18n.handoff}
      </button>
    </div>
  )
}

/** Pick the smallest non-null value (window or measured-DOM width). */
function viewportLeftRight(el: HTMLDivElement | null): { left: number; right: number } {
  // Without a parent anchor use the body / html width; browsers expose
  // innerWidth directly, and document.documentElement.clientWidth is the
  // equivalent in quirks-free layouts.
  const w = window.innerWidth
  const padding = 8 // half a hairline away from the edge
  return { left: padding, right: w - padding }
}

function clampLeft(
  rect: { left: number; width: number },
  viewport: { left: number; right: number },
): number {
  const horizontalCenter = rect.left + rect.width / 2
  const bubbleHalfWidthGuess = 220 // approximate; CSS uses ~340px max
  const desired = horizontalCenter - bubbleHalfWidthGuess / 2
  return Math.max(viewport.left, Math.min(desired, viewport.right - bubbleHalfWidthGuess))
}
