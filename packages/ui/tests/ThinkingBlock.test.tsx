/** @vitest-environment jsdom */
/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { ThinkingBlock } from '../src/ThinkingBlock'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

describe('ThinkingBlock', () => {
  it('returns null when no reasoning and not thinking', () => {
    act(() => {
      root.render(createElement(ThinkingBlock, { reasoning: '', isThinking: false }))
    })
    expect(host.innerHTML).toBe('')
  })

  it('renders the streaming indicator while reasoning is in flight', () => {
    act(() => {
      root.render(
        createElement(ThinkingBlock, {
          reasoning: 'Đang tính toán',
          isThinking: true,
        }),
      )
    })
    expect(host.textContent).toMatch(/Lycero Mate đang suy luận sư phạm/)
    expect(host.textContent).toMatch(/Đang tính toán/)
  })

  it('renders the historical label after reasoning completes', () => {
    act(() => {
      root.render(
        createElement(ThinkingBlock, {
          reasoning: 'Đã hoàn tất',
          isThinking: false,
        }),
      )
    })
    expect(host.textContent).toMatch(/Quá trình suy luận sư phạm/)
  })

  it('reports the Vietnamese char count when idle', () => {
    act(() => {
      root.render(
        createElement(ThinkingBlock, {
          reasoning: 'nội dung bất kỳ',
          isThinking: false,
        }),
      )
    })
    expect(host.textContent).toMatch(/ký tự: 15/)
  })

  it('auto-expands while thinking', () => {
    act(() => {
      root.render(
        createElement(ThinkingBlock, { reasoning: 'abc', isThinking: true }),
      )
    })
    const btn = host.querySelector('button') as HTMLButtonElement
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('collapses by default when reasoning is done', () => {
    act(() => {
      root.render(
        createElement(ThinkingBlock, { reasoning: 'abc', isThinking: false }),
      )
    })
    const btn = host.querySelector('button') as HTMLButtonElement
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('honors defaultExpanded prop', () => {
    act(() => {
      root.render(
        createElement(ThinkingBlock, {
          reasoning: 'abc',
          isThinking: false,
          defaultExpanded: true,
        }),
      )
    })
    const btn = host.querySelector('button') as HTMLButtonElement
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })
})
