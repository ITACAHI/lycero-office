/** @vitest-environment jsdom */
/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { MateBubble, mateBubble } from '../src/MateBubble'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  mateBubble.broadcast(null)
  // Defensive: drop any leftover subscribers from previous tests.
  while (mateBubble.count() > 0) {
    // MateBubble doesn't expose a clear method; broadcast null still leaves
    // the listener in place. Tests that need to assert count use a fresh bus
    // pattern: re-import is overkill, so we drain by unmount.
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
})

function render(props: Parameters<typeof MateBubble>[0] = {}) {
  act(() => {
    root.render(createElement(MateBubble, props))
  })
}

describe('MateBubble', () => {
  it('does not render without a selection', () => {
    render()
    expect(host.querySelector('[role="toolbar"]')).toBeNull()
  })

  it('renders when a selection is broadcast', () => {
    mateBubble.broadcast({
      text: 'Một đoạn văn bản để thử',
      rect: { top: 200, left: 100, width: 300, height: 24 },
      tailwind: 'center',
    })
    render()
    expect(host.querySelector('[role="toolbar"]')).not.toBeNull()
    expect(host.textContent).toContain('Mở rộng ý')
    expect(host.textContent).toContain('Đưa vào Mate')
  })

  it('fires onAction with the selected text', () => {
    let captured: { action: string; text: string } | null = null
    mateBubble.broadcast({
      text: 'Đoạn cần rút gọn',
      rect: { top: 200, left: 100, width: 300, height: 24 },
      tailwind: 'center',
    })
    render({
      onAction: (action, text) => {
        captured = { action, text }
      },
    })
    const shorten = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Rút gọn'),
    ) as HTMLButtonElement
    act(() => {
      shorten.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(captured).toEqual({ action: 'shorten', text: 'Đoạn cần rút gọn' })
  })

  it('fires onHandOff when the CTA is clicked', () => {
    let handed = ''
    mateBubble.broadcast({
      text: 'Bàn giao',
      rect: { top: 200, left: 100, width: 300, height: 24 },
      tailwind: 'center',
    })
    render({ onHandOff: (t) => (handed = t) })
    const cta = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Đưa vào Mate'),
    ) as HTMLButtonElement
    act(() => {
      cta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(handed).toBe('Bàn giao')
  })

  it('subscribers receive subsequent broadcasts', () => {
    render()
    expect(host.querySelector('[role="toolbar"]')).toBeNull()
    act(() => {
      mateBubble.broadcast({
        text: 'Lần thứ hai',
        rect: { top: 200, left: 100, width: 300, height: 24 },
        tailwind: 'center',
      })
    })
    expect(host.querySelector('[role="toolbar"]')).not.toBeNull()
  })

  it('cleans up its subscription on unmount', () => {
    const before = mateBubble.count()
    render()
    expect(mateBubble.count()).toBe(before + 1)
    act(() => {
      root.unmount()
    })
    expect(mateBubble.count()).toBe(before)
  })

  it('does not render for very short selections (no flicker on single keystroke)', () => {
    mateBubble.broadcast({
      text: 'a',
      rect: { top: 200, left: 100, width: 4, height: 24 },
      tailwind: 'center',
    })
    render()
    expect(host.querySelector('[role="toolbar"]')).toBeNull()
  })
})
