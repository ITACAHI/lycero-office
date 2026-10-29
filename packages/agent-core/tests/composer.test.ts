/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { describe, it, expect, vi } from 'vitest'
import {
  composeBundleTools,
  composeBundleSkills,
  buildSystemPromptAddition,
  composeAgentContext
} from '../src/composer'
import type { WorkBundle, WorkBundleTool, WorkBundleSkill } from '@lycero/ai-auth'

// Minimal fake bundle factory
function makeTool(overrides: Partial<WorkBundleTool> = {}): WorkBundleTool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: { type: 'object' },
    ...overrides
  }
}

function makeSkill(overrides: Partial<WorkBundleSkill> = {}): WorkBundleSkill {
  return {
    name: 'test_skill',
    description: 'A test skill',
    content: 'Skill content here',
    ...overrides
  }
}

function makeBundle(overrides: Partial<WorkBundle> = {}): WorkBundle {
  return {
    id: 1,
    key: 'test_bundle',
    labelVi: 'Test Bundle',
    description: 'Test description',
    tools: [],
    skills: [],
    defaultConfig: {},
    ...overrides
  } as WorkBundle
}

describe('composeBundleTools', () => {
  it('returns empty array when no bundles', () => {
    expect(composeBundleTools([])).toEqual([])
  })

  it('flattens tools from all bundles', () => {
    const a = makeBundle({ key: 'a', labelVi: 'Bundle A', tools: [makeTool({ name: 'a1', description: 'Tool A1' })] })
    const b = makeBundle({ key: 'b', labelVi: 'Bundle B', tools: [makeTool({ name: 'b1', description: 'Tool B1' })] })
    const result = composeBundleTools([a, b])
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('a1')
    expect(result[1].name).toBe('b1')
    expect(result[0].source.bundleKey).toBe('a')
    expect(result[1].source.bundleKey).toBe('b')
  })

  it('preserves tool description and parameters', () => {
    const params = { type: 'object' as const, properties: { amount: { type: 'number' } } }
    const bundle = makeBundle({
      key: 'test',
      tools: [makeTool({ name: 't1', description: 'desc', parameters: params })]
    })
    const result = composeBundleTools([bundle])
    expect(result[0].description).toBe('desc')
    expect(result[0].parameters).toEqual(params)
  })

  it('first-write-wins on collision, logs warning', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = makeBundle({ key: 'a', tools: [makeTool({ name: 'shared', description: 'A version' })] })
    const b = makeBundle({ key: 'b', tools: [makeTool({ name: 'shared', description: 'B version' })] })
    const result = composeBundleTools([a, b])
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('A version')
    expect(result[0].source.bundleKey).toBe('a')
    expect(consoleSpy).toHaveBeenCalled()
    expect(consoleSpy.mock.calls[0][0]).toContain('tool name collision')
    expect(consoleSpy.mock.calls[0][0]).toContain('shared')
    consoleSpy.mockRestore()
  })

  it('skips duplicate tools from same bundle', () => {
    const bundle = makeBundle({
      key: 'test',
      tools: [
        makeTool({ name: 't1' }),
        makeTool({ name: 't1' })  // duplicate within same bundle
      ]
    })
    const result = composeBundleTools([bundle])
    expect(result).toHaveLength(1)
  })

  it('sets correct bundle metadata on source', () => {
    const bundle = makeBundle({ key: 'accounting_vn', labelVi: 'Kế toán', tools: [makeTool({ name: 'calc' })] })
    const result = composeBundleTools([bundle])
    expect(result[0].source).toEqual({ bundleKey: 'accounting_vn', bundleLabel: 'Kế toán' })
  })
})

describe('composeBundleSkills', () => {
  it('returns empty array when no bundles', () => {
    expect(composeBundleSkills([])).toEqual([])
  })

  it('flattens skills from all bundles', () => {
    const a = makeBundle({ key: 'a', skills: [makeSkill({ name: 's1' })] })
    const b = makeBundle({ key: 'b', skills: [makeSkill({ name: 's2' })] })
    const result = composeBundleSkills([a, b])
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('s1')
    expect(result[1].name).toBe('s2')
  })

  it('preserves skill content and description', () => {
    const bundle = makeBundle({
      key: 'test',
      skills: [makeSkill({ name: 'skill1', description: 'A skill', content: 'Skill content' })]
    })
    const result = composeBundleSkills([bundle])
    expect(result[0].name).toBe('skill1')
    expect(result[0].description).toBe('A skill')
    expect(result[0].content).toBe('Skill content')
  })

  it('first-write-wins on collision', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = makeBundle({ key: 'a', skills: [makeSkill({ name: 'dup', content: 'First' })] })
    const b = makeBundle({ key: 'b', skills: [makeSkill({ name: 'dup', content: 'Second' })] })
    const result = composeBundleSkills([a, b])
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('First')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('buildSystemPromptAddition', () => {
  it('returns empty string for no skills', () => {
    expect(buildSystemPromptAddition([])).toBe('')
  })

  it('renders skills section with correct count', () => {
    const skills = [
      { name: 'skill_a', description: 'A desc', content: 'A content', source: { bundleKey: 'x', bundleLabel: 'X' } },
      { name: 'skill_b', description: 'B desc', content: 'B content', source: { bundleKey: 'y', bundleLabel: 'Y' } }
    ]
    const result = buildSystemPromptAddition(skills)
    expect(result).toContain('## Skills loaded (2)')
    expect(result).toContain('- skill_a: A desc')
    expect(result).toContain('- skill_b: B desc')
  })

  it('formats each skill with ### header and content', () => {
    const skills = [
      { name: 'tax_skill', description: 'Tax rules', content: 'VAT is 10%', source: { bundleKey: 'acc', bundleLabel: 'Accounting' } }
    ]
    const result = buildSystemPromptAddition(skills)
    expect(result).toContain('### tax_skill')
    expect(result).toContain('VAT is 10%')
  })

  it('handles multiline skill content correctly', () => {
    const skills = [
      { name: 'multi', description: 'desc', content: 'Line 1\nLine 2\nLine 3', source: { bundleKey: 'x', bundleLabel: 'X' } }
    ]
    const result = buildSystemPromptAddition(skills)
    expect(result).toContain('Line 1\nLine 2\nLine 3')
  })

  it('trims trailing whitespace', () => {
    const skills = [
      { name: 's', description: 'd', content: 'content', source: { bundleKey: 'x', bundleLabel: 'X' } }
    ]
    const result = buildSystemPromptAddition(skills)
    expect(result).toBe(result.trimEnd())
  })
})

describe('composeAgentContext', () => {
  it('composes full context with timestamp', () => {
    const a = makeBundle({
      key: 'a',
      tools: [makeTool({ name: 't1' })],
      skills: [makeSkill({ name: 's1' })]
    })
    const ctx = composeAgentContext([a])
    expect(ctx.tools).toHaveLength(1)
    expect(ctx.skills).toHaveLength(1)
    expect(ctx.bundleKeys).toEqual(['a'])
    expect(ctx.systemPromptAddition).toContain('Skills loaded')
    expect(ctx.systemPromptAddition).toContain('s1')
    expect(typeof ctx.composedAt).toBe('number')
    expect(ctx.composedAt).toBeGreaterThan(0)
  })

  it('handles empty bundle list', () => {
    const ctx = composeAgentContext([])
    expect(ctx.tools).toEqual([])
    expect(ctx.skills).toEqual([])
    expect(ctx.systemPromptAddition).toBe('')
    expect(ctx.bundleKeys).toEqual([])
    expect(typeof ctx.composedAt).toBe('number')
  })

  it('accumulates bundleKeys in order', () => {
    const bundles = [
      makeBundle({ key: 'first' }),
      makeBundle({ key: 'second' }),
      makeBundle({ key: 'third' })
    ]
    const ctx = composeAgentContext(bundles)
    expect(ctx.bundleKeys).toEqual(['first', 'second', 'third'])
  })

  it('deduplicates tools across multiple bundles', () => {
    const bundles = [
      makeBundle({ key: 'a', tools: [makeTool({ name: 'shared' }), makeTool({ name: 'unique_a' })] }),
      makeBundle({ key: 'b', tools: [makeTool({ name: 'shared' }), makeTool({ name: 'unique_b' })] })
    ]
    const ctx = composeAgentContext(bundles)
    // 3 unique tools: shared (from a wins), unique_a, unique_b
    expect(ctx.tools).toHaveLength(3)
    expect(ctx.tools.find(t => t.name === 'shared')?.source.bundleKey).toBe('a')
    expect(ctx.tools.find(t => t.name === 'unique_a')?.source.bundleKey).toBe('a')
    expect(ctx.tools.find(t => t.name === 'unique_b')?.source.bundleKey).toBe('b')
  })
})
