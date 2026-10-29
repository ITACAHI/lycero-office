/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { describe, it, expect, vi } from 'vitest'
import { buildBundleContextResolver } from '../src/loop'
import type { WorkBundle } from '@lycero/ai-auth'

function makeBundle(overrides: Partial<WorkBundle>): WorkBundle {
  return {
    id: 1,
    key: 'test',
    labelVi: 'T',
    description: 'd',
    category: 'productivity',
    tools: [],
    skills: [],
    defaultConfig: {},
    ...overrides,
  } as WorkBundle
}

describe('wire pattern (Phase A.6 contract)', () => {
  it('resolver can be called multiple times with same bundles', () => {
    const bundles = [
      makeBundle({ key: 'a', skills: [{ name: 's1', description: 'd', content: 'c' }] }),
    ]
    const resolver = buildBundleContextResolver(bundles)

    for (let i = 0; i < 5; i++) {
      const r = resolver({ systemPrompt: 'p', tools: [] })
      expect(r.bundleKeys).toEqual(['a'])
    }
  })

  it('multiple resolvers can coexist (each app has own resolver)', () => {
    const slides = [makeBundle({ key: 'slides-bundle' })]
    const sheets = [makeBundle({ key: 'sheets-bundle' })]

    const slidesResolver = buildBundleContextResolver(slides)
    const sheetsResolver = buildBundleContextResolver(sheets)

    expect(slidesResolver({ systemPrompt: 'p', tools: [] }).bundleKeys).toEqual(['slides-bundle'])
    expect(sheetsResolver({ systemPrompt: 'p', tools: [] }).bundleKeys).toEqual(['sheets-bundle'])
  })

  it('empty bundles array = no change (graceful degradation)', () => {
    const resolver = buildBundleContextResolver([])
    const r = resolver({ systemPrompt: 'p', tools: [{ name: 'existing' }] })
    expect(r.systemPrompt).toBe('p')
    expect(r.tools.map((t) => t.name)).toEqual(['existing'])
    expect(r.bundleKeys).toEqual([])
  })

  it('fetch error is non-fatal (resolver still works with empty bundles)', () => {
    // Simulate: getEnabled() fails, we fall back to []
    const bundles: WorkBundle[] = []
    const resolver = buildBundleContextResolver(bundles)
    const r = resolver({ systemPrompt: 'p', tools: [] })
    expect(r).toBeDefined()
    expect(r.bundleKeys).toEqual([])
  })

  it('app-specific system prompts compose correctly', () => {
    // Each app can pass its own base systemPrompt
    const bundles = [
      makeBundle({ key: 'a', skills: [{ name: 's1', description: 'd', content: 'c' }] }),
    ]
    const resolver = buildBundleContextResolver(bundles)

    const slidesInput = { systemPrompt: 'SLIDES_BASE', tools: [] }
    const sheetsInput = { systemPrompt: 'SHEETS_BASE', tools: [] }

    const slidesResult = resolver(slidesInput)
    const sheetsResult = resolver(sheetsInput)

    expect(slidesResult.systemPrompt).toContain('SLIDES_BASE')
    expect(sheetsResult.systemPrompt).toContain('SHEETS_BASE')
    expect(slidesResult.systemPrompt).toContain('Skills loaded')
  })
})
