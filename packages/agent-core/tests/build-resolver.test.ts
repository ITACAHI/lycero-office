/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { describe, it, expect } from 'vitest'
import { buildBundleContextResolver } from '../src/loop'
import type { WorkBundle } from '@lycero/ai-auth'

function makeBundle(overrides: Partial<WorkBundle>): WorkBundle {
  return {
    id: 1,
    key: 'test_bundle',
    labelVi: 'Test',
    description: 'd',
    category: 'productivity',
    tools: [],
    skills: [],
    defaultConfig: {},
    ...overrides,
  } as WorkBundle
}

describe('buildBundleContextResolver', () => {
  it('returns a function', () => {
    const resolver = buildBundleContextResolver([])
    expect(typeof resolver).toBe('function')
  })

  it('resolver applies empty bundles (no change)', () => {
    const resolver = buildBundleContextResolver([])
    const result = resolver({ systemPrompt: 'p', tools: [] })
    expect(result.systemPrompt).toBe('p')
    expect(result.tools).toEqual([])
  })

  it('resolver applies bundles to input', () => {
    const bundle = makeBundle({
      key: 'a',
      skills: [{ name: 's1', description: 'd', content: 'c' }],
      tools: [{ name: 't1', description: 'd', parameters: {} }],
    })
    const resolver = buildBundleContextResolver([bundle])
    const result = resolver({ systemPrompt: 'base', tools: [] })
    expect(result.bundleKeys).toEqual(['a'])
    expect(result.systemPrompt).toContain('Skills loaded')
    expect(result.tools).toHaveLength(1)
  })

  it('resolver is idempotent across calls (same bundles = same output)', () => {
    const bundle = makeBundle({
      key: 'a',
      skills: [{ name: 's1', description: 'd', content: 'c' }],
    })
    const resolver = buildBundleContextResolver([bundle])
    const r1 = resolver({ systemPrompt: 'p', tools: [] })
    const r2 = resolver({ systemPrompt: 'p', tools: [] })
    // composedAt may differ but content identical
    expect(r1.systemPrompt).toBe(r2.systemPrompt)
    expect(r1.bundleKeys).toEqual(r2.bundleKeys)
  })

  it('resolver captures bundles by closure (mutating array after build affects next call)', () => {
    const bundles: WorkBundle[] = []
    const resolver = buildBundleContextResolver(bundles)
    const r1 = resolver({ systemPrompt: 'p', tools: [] })
    expect(r1.bundleKeys).toEqual([])

    bundles.push(
      makeBundle({
        key: 'late',
        skills: [{ name: 's', description: 'd', content: 'c' }],
      }),
    )
    const r2 = resolver({ systemPrompt: 'p', tools: [] })
    // Note: this is INTENDED Ponytail ceiling — caller responsible for passing fresh bundles.
    // We document this so the test acts as a contract.
    expect(r2.bundleKeys).toEqual(['late'])
  })
})
