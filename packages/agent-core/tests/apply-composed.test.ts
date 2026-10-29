/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { describe, it, expect } from 'vitest'
import { applyComposedContext, type AgentTurnInput } from '../src/loop'
import type { WorkBundle, WorkBundleTool, WorkBundleSkill } from '@lycero/ai-auth'

// Minimal fake bundle factory
function makeTool(overrides: Partial<WorkBundleTool> = {}): WorkBundleTool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: { type: 'object' },
    ...overrides,
  }
}

function makeSkill(overrides: Partial<WorkBundleSkill> = {}): WorkBundleSkill {
  return {
    name: 'test_skill',
    description: 'A test skill',
    content: 'Skill content here',
    ...overrides,
  }
}

function makeBundle(overrides: Partial<WorkBundle> = {}): WorkBundle {
  return {
    id: 1,
    key: 'test_bundle',
    labelVi: 'Test Bundle',
    description: 'desc',
    tools: [],
    skills: [],
    defaultConfig: {},
    ...overrides,
  } as WorkBundle
}

describe('applyComposedContext', () => {
  it('returns empty bundleKeys when no bundles', () => {
    const input: AgentTurnInput = { systemPrompt: 'base', tools: [] }
    const result = applyComposedContext(input, [])
    expect(result.bundleKeys).toEqual([])
    expect(result.systemPrompt).toBe('base')
    expect(result.tools).toEqual([])
  })

  it('appends systemPromptAddition when bundles have skills', () => {
    const bundle = makeBundle({
      key: 'a',
      skills: [makeSkill({ name: 's1', description: 'd', content: 'c' })],
    })
    const result = applyComposedContext({ systemPrompt: 'base', tools: [] }, [bundle])
    expect(result.systemPrompt).toContain('base')
    expect(result.systemPrompt).toContain('Skills loaded')
    expect(result.bundleKeys).toEqual(['a'])
  })

  it('merges composed tools into tools list', () => {
    const bundle = makeBundle({
      key: 'a',
      tools: [{ name: 'bundle_tool', description: 'd', parameters: {} }],
    })
    const result = applyComposedContext({ systemPrompt: 'p', tools: [] }, [bundle])
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].name).toBe('bundle_tool')
  })

  it('dedups tools with first-write-wins (caller tools take precedence)', () => {
    const bundle = makeBundle({
      key: 'a',
      tools: [{ name: 'shared', description: 'bundle version', parameters: { type: 'object' } }],
    })
    const result = applyComposedContext(
      { systemPrompt: 'p', tools: [{ name: 'shared', description: 'caller version' }] },
      [bundle],
    )
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].description).toBe('caller version')
  })

  it('does not mutate input', () => {
    const input: AgentTurnInput = {
      systemPrompt: 'base',
      tools: [{ name: 'a' }],
    }
    const bundle = makeBundle({
      key: 'b',
      skills: [makeSkill({ name: 's', description: 'd', content: 'c' })],
    })
    const original = JSON.parse(JSON.stringify(input))
    applyComposedContext(input, [bundle])
    expect(input).toEqual(original)
  })

  it('exposes composedAt timestamp', () => {
    const before = Date.now()
    const result = applyComposedContext({ systemPrompt: 'p', tools: [] }, [])
    const after = Date.now()
    expect(result.composedAt).toBeGreaterThanOrEqual(before)
    expect(result.composedAt).toBeLessThanOrEqual(after)
  })

  it('handles bundles with both tools and skills', () => {
    const bundle = makeBundle({
      key: 'a',
      tools: [{ name: 't1', description: 'd', parameters: {} }],
      skills: [makeSkill({ name: 's1', description: 'd', content: 'c' })],
    })
    const result = applyComposedContext({ systemPrompt: 'p', tools: [] }, [bundle])
    expect(result.tools).toHaveLength(1)
    expect(result.systemPrompt).toContain('Skills loaded (1)')
  })
})
