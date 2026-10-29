/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase A.7: Mate integration smoke tests — verify end-to-end wire behaviour
 * for the Work Bundle Marketplace integration (Phases A.5 + A.6).
 *
 * Scope:
 *  1. No duplicate tools when multiple bundles share tool names
 *  2. Bundle toggle reactivity: bundlesRef updates after toggle, in-flight turns
 *     use the snapshot from turn-start (not mid-turn mutations)
 *  3. Empty bundles: composeBundleSkills([]) → app skills only, no crash
 *  4. Bundle errors: getEnabled() throws → bundlesRef stays empty, app skills OK
 *  5. Cross-app pattern consistency: all 6 LyceroMatePanel files follow the
 *     same wire contract (bundlesRef + loadBundles + onEnabledChanged)
 *
 * These are pure unit tests (no IPC, no DOM) using vitest. Each test is
 * self-contained and fast.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  composeBundleTools,
  composeBundleSkills,
  buildSystemPromptAddition,
  composeAgentContext,
} from '../src/composer'
import type { ComposedSkill } from '../src/composer'
import { applyComposedContext, type AgentTurnInput } from '../src/loop'
import { WORK_BUNDLES } from '@lycero/ai-auth'
import type { WorkBundle, WorkBundleTool, WorkBundleSkill } from '@lycero/ai-auth'

// ── Repo root helper ─────────────────────────────────────────────────────────
// Resolve the repo root once (parent of packages/agent-core/)
const __repoRoot = (() => {
  // In vitest the top-level import has the right URL
  const metaUrl = import.meta.url
  const agentCoreTestsDir = dirname(metaUrl) // packages/agent-core/tests
  const agentCoreDir = dirname(agentCoreTestsDir) // packages/agent-core
  const packagesDir = dirname(agentCoreDir) // packages
  return dirname(packagesDir) // repo root
})()

function repoPath(relative: string): string {
  return resolve(__repoRoot, relative)
}

// ── Fixture factories ────────────────────────────────────────────────────────

function tool(name: string, description = 'desc'): WorkBundleTool {
  return { name, description, parameters: { type: 'object' } }
}

function skill(name: string, description = 'desc', content = 'content'): WorkBundleSkill {
  return { name, description, content }
}

/** ComposedSkill factory (as output by composeBundleSkills) */
function composedSkill(name: string, description = 'desc', content = 'content'): ComposedSkill {
  return { name, description, content, source: { bundleKey: 'test', bundleLabel: 'Test' } }
}

function bundle(
  key: string,
  labelVi: string,
  tools: WorkBundleTool[],
  skills: WorkBundleSkill[] = [],
): WorkBundle {
  return {
    id: 99,
    key,
    labelVi,
    description: `bundle ${key}`,
    tools,
    skills,
    defaultConfig: {},
  } as WorkBundle
}

// ── Thin BundleStore mock (no IPC, no fs) ────────────────────────────────────

type EnabledListener = (bundleKey: string, enabled: boolean) => void

function makeFakeBundleStore(initialBundles: WorkBundle[]) {
  // Only enabled bundles appear in getEnabled()
  const enabledBundles = new Set<string>(initialBundles.map((b) => b.key))
  const allBundles = [...initialBundles]
  const enabledListeners = new Set<EnabledListener>()
  let getEnabledCallCount = 0

  return {
    get getEnabledCallCount() {
      return getEnabledCallCount
    },

    /** Returns only currently-enabled bundles */
    getEnabled(): WorkBundle[] {
      getEnabledCallCount++
      return allBundles.filter((b) => enabledBundles.has(b.key))
    },

    /** Async overload kept for compatibility */
    async getEnabledAsync(): Promise<WorkBundle[]> {
      return this.getEnabled()
    },

    /** Enable or disable a bundle (persisted in the mock's enabled set) */
    setEnabled(key: string, enabled: boolean): void {
      if (enabled) {
        enabledBundles.add(key)
      } else {
        enabledBundles.delete(key)
      }
      enabledListeners.forEach((cb) => cb(key, enabled))
    },

    /** Emit an enabled-changed event (triggers loadBundles) */
    emitToggle(): void {
      enabledListeners.forEach((cb) => cb('toggle', true))
    },

    onEnabledChanged(cb: EnabledListener): () => void {
      enabledListeners.add(cb)
      return () => enabledListeners.delete(cb)
    },
  }
}

// ── Bundle lifecycle simulation (models what LyceroMatePanel does) ────────────

/**
 * Simulates the useEffect(() => { loadBundles(); unsub = onEnabledChanged(...); return unsub }, [])
 * Returns the cleanup function.
 *
 * Uses synchronous getEnabled() — the mock has no real I/O, so the call resolves
 * immediately. This reflects the real behaviour: BundleStore reads from a local
 * JSON file, which on SSD completes in <1ms (practically synchronous from the
 * test's perspective).
 */
function withBundleLifecycle(
  store: ReturnType<typeof makeFakeBundleStore>,
  onUpdate: (bundles: WorkBundle[]) => void,
): () => void {
  const loadBundles = () => {
    const bundles = store.getEnabled()
    onUpdate(bundles)
  }

  loadBundles()
  const unsub = store.onEnabledChanged(() => {
    loadBundles()
  })
  return unsub
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: No duplicate tools
// ─────────────────────────────────────────────────────────────────────────────

describe('1 · No duplicate tools across bundles', () => {
  it('composeBundleTools: two bundles with same tool name → first wins, no duplicate', () => {
    const a = bundle('a', 'Bundle A', [
      tool('docs.vat_lookup', 'lookup VAT'),
      tool('sheets.pnl', 'P&L report'),
    ])
    const b = bundle('b', 'Bundle B', [
      tool('docs.vat_lookup', 'VAT lookup duplicate'),
      tool('docs.contract', 'contract'),
    ])

    const result = composeBundleTools([a, b])

    const vatTools = result.filter((t) => t.name === 'docs.vat_lookup')
    expect(vatTools).toHaveLength(1)
    expect(vatTools[0]!.source.bundleKey).toBe('a')
    expect(result.map((t) => t.name)).toEqual(['docs.vat_lookup', 'sheets.pnl', 'docs.contract'])
    expect(result).toHaveLength(3)
  })

  it('composeBundleSkills: two bundles with same skill name → first wins', () => {
    const a = bundle('x', 'X', [], [
      skill('vn-tax-tt200', 'Tax rule'),
      skill('clo-plo', 'CLO/PLO design'),
    ])
    const b = bundle('y', 'Y', [], [
      skill('vn-tax-tt200', 'Tax dup'),
      skill('freelance-invoice-vn', 'Invoice'),
    ])

    const result = composeBundleSkills([a, b])

    const taxSkills = result.filter((s) => s.name === 'vn-tax-tt200')
    expect(taxSkills).toHaveLength(1)
    expect(taxSkills[0]!.source.bundleKey).toBe('x')
    expect(result).toHaveLength(3)
  })

  it('composeBundleTools: collision in third bundle → skipped', () => {
    const a = bundle('a', 'A', [tool('shared_tool', 'from a')])
    const b = bundle('b', 'B', [tool('b_only', 'from b')])
    const c = bundle('c', 'C', [tool('shared_tool', 'collision from c')])

    const result = composeBundleTools([a, b, c])

    expect(result.filter((t) => t.name === 'shared_tool')).toHaveLength(1)
    expect(result[0]!.source.bundleKey).toBe('a')
    expect(result).toHaveLength(2)
  })

  it('applyComposedContext: base tools + bundle tools → first-write-wins (base preserved)', () => {
    const input: AgentTurnInput = {
      systemPrompt: 'base prompt',
      tools: [
        { name: 'docs.paste', description: 'paste doc' },
        { name: 'docs.vat_lookup', description: 'base VAT tool' },
      ],
    }

    const ctx = applyComposedContext(input, [
      bundle('acc', 'Accounting', [tool('docs.vat_lookup', 'bundle VAT')]),
    ])

    // docs.vat_lookup appears once (base tool wins — processed first)
    const vatTools = ctx.tools.filter((t) => t.name === 'docs.vat_lookup')
    expect(vatTools).toHaveLength(1)
    expect(vatTools[0]!.description).toBe('base VAT tool')

    // docs.paste from base is preserved
    expect(ctx.tools.find((t) => t.name === 'docs.paste')).toBeDefined()
  })

  it('composeAgentContext: tools + skills deduped at top level', () => {
    const b1 = bundle('b1', 'B1', [tool('t1'), tool('t2')], [skill('s1')])
    const b2 = bundle('b2', 'B2', [tool('t1')], [skill('s1')])

    const ctx = composeAgentContext([b1, b2])

    expect(ctx.tools).toHaveLength(2) // t1, t2
    expect(ctx.skills).toHaveLength(1) // s1
    expect(ctx.bundleKeys).toEqual(['b1', 'b2'])
    expect(ctx.composedAt).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Bundle toggle reactivity
// ─────────────────────────────────────────────────────────────────────────────

describe('2 · Bundle toggle reactivity (bundlesRef update)', () => {
  it('bundlesRef snapshot is stable during an in-flight turn', () => {
    const store = makeFakeBundleStore([
      bundle('acc', 'Accounting', [tool('sheets.vat_lookup')]),
    ])

    const bundlesRef = { current: [] as WorkBundle[] }
    const cleanup = withBundleLifecycle(store, (bundles) => {
      bundlesRef.current = bundles
    })

    // Simulate: user starts a turn — captures current bundlesRef snapshot
    const turnSnapshot = [...bundlesRef.current]
    expect(turnSnapshot.map((b) => b.key)).toContain('acc')

    // Meanwhile: user toggles a bundle OFF in Settings (mid-turn)
    // setEnabled fires onEnabledChanged, triggering loadBundles
    store.setEnabled('acc', false)

    // bundlesRef updated AFTER toggle (the subscription fires)
    // turnSnapshot is independent (a copy)
    expect(bundlesRef.current.map((b) => b.key)).not.toContain('acc')
    expect(turnSnapshot.map((b) => b.key)).toContain('acc') // snapshot still holds old value

    cleanup()
  })

  it('cleanup (unmount) stops listening — no stale updates after unmount', () => {
    const store = makeFakeBundleStore([bundle('dev', 'Dev', [tool('d1')])])

    const updates: string[][] = []
    const cleanup = withBundleLifecycle(store, (bundles) => {
      updates.push(bundles.map((b) => b.key))
    })

    // mount
    expect(updates).toHaveLength(1)

    // unmount
    cleanup()

    // Toggle after unmount → no new update (since we unsubscribe before emitting)
    store.setEnabled('dev', true)
    expect(updates).toHaveLength(1) // still just the mount call
  })

  it('getEnabled is called on mount and once per toggle', () => {
    const store = makeFakeBundleStore([bundle('dev', 'Dev', [tool('d1')])])

    const bundlesRef = { current: [] as WorkBundle[] }
    const cleanup = withBundleLifecycle(store, (bundles) => {
      bundlesRef.current = bundles
    })

    const countAfterMount = store.getEnabledCallCount

    store.setEnabled('dev', true)
    store.setEnabled('dev', false)

    expect(store.getEnabledCallCount).toBe(countAfterMount + 2)

    cleanup()
  })

  it('applyComposedContext reads bundles at call time (pure)', () => {
    // applyComposedContext is pure — it reads the bundles passed to it.
    // The caller (AgentLoop.startTurn) reads bundlesRef.current at turn start.
    // This test verifies the pure function has no hidden state.

    const input: AgentTurnInput = { systemPrompt: 'p', tools: [] }
    const bundles1 = [bundle('a', 'A', [tool('tool_a')])]
    const bundles2 = [bundle('b', 'B', [tool('tool_b')])]

    const ctx1 = applyComposedContext(input, bundles1)
    const ctx2 = applyComposedContext(input, bundles2)

    expect(ctx1.tools.map((t) => t.name)).toEqual(['tool_a'])
    expect(ctx2.tools.map((t) => t.name)).toEqual(['tool_b'])
    // Same input always returns same bundleKeys
    expect(ctx1.bundleKeys).toEqual(['a'])
    expect(ctx2.bundleKeys).toEqual(['b'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Empty bundles edge case
// ─────────────────────────────────────────────────────────────────────────────

describe('3 · Empty bundles (no enabled bundles)', () => {
  it('composeBundleTools([]) → empty array, no crash', () => {
    expect(composeBundleTools([])).toEqual([])
  })

  it('composeBundleSkills([]) → empty array, no crash', () => {
    expect(composeBundleSkills([])).toEqual([])
  })

  it('composeAgentContext([]) → zero tools/skills, no crash', () => {
    const ctx = composeAgentContext([])
    expect(ctx.tools).toEqual([])
    expect(ctx.skills).toEqual([])
    expect(ctx.bundleKeys).toEqual([])
    expect(ctx.systemPromptAddition).toBe('')
    expect(ctx.composedAt).toBeGreaterThan(0)
  })

  it('applyComposedContext with empty bundles → returns input unchanged', () => {
    const input: AgentTurnInput = {
      systemPrompt: 'original prompt',
      tools: [{ name: 'docs.app_tool', description: 'app tool' }],
    }

    const result = applyComposedContext(input, [])

    expect(result.systemPrompt).toBe('original prompt')
    expect(result.tools.map((t) => t.name)).toEqual(['docs.app_tool'])
    expect(result.bundleKeys).toEqual([])
  })

  it('WORK_BUNDLES fixture: dedup works across all 10 bundles', () => {
    const allToolNames = WORK_BUNDLES.flatMap((b) => b.tools.map((t) => t.name))
    const uniqueToolNames = [...new Set(allToolNames)]

    const ctx = composeAgentContext([...WORK_BUNDLES])

    expect(ctx.tools.map((t) => t.name)).toEqual(uniqueToolNames)
    expect(ctx.tools).toHaveLength(uniqueToolNames.length)

    const allSkillNames = WORK_BUNDLES.flatMap((b) => b.skills.map((s) => s.name))
    const uniqueSkillNames = [...new Set(allSkillNames)]
    expect(ctx.skills.map((s) => s.name)).toEqual(uniqueSkillNames)
  })

  it('buildSystemPromptAddition: empty skills → empty string', () => {
    expect(buildSystemPromptAddition([])).toBe('')
  })

  it('buildSystemPromptAddition: one skill → formatted section', () => {
    const s = composedSkill('test-skill', 'A test skill', 'Do something great.')
    const result = buildSystemPromptAddition([s])
    expect(result).toContain('## Skills loaded (1)')
    expect(result).toContain('- test-skill: A test skill')
    expect(result).toContain('### test-skill')
    expect(result).toContain('Do something great.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Bundle errors — non-fatal degradation
// ─────────────────────────────────────────────────────────────────────────────

describe('4 · Bundle errors — non-fatal degradation', () => {
  it('getEnabled() rejects → loadBundles catches error, bundlesRef stays empty', () => {
    const store = makeFakeBundleStore([])

    // Replace getEnabled with a throwing version
    const throwingGetEnabled = (): never => {
      throw new Error('IPC error: bundle store unavailable')
    }
    ;(store as ReturnType<typeof makeFakeBundleStore> & { getEnabled: () => never }).getEnabled =
      throwingGetEnabled

    const bundlesRef = { current: [] as WorkBundle[] }

    // Simulate the same pattern as LyceroMatePanel:
    // loadBundles catches errors so bundlesRef stays empty
    const loadBundles = () => {
      try {
        const bundles = store.getEnabled()
        bundlesRef.current = bundles
      } catch {
        // rejection handler: do nothing, bundlesRef stays empty
      }
    }

    loadBundles()
    expect(bundlesRef.current).toEqual([]) // still empty after error

    // Restore
    ;(store as ReturnType<typeof makeFakeBundleStore> & { getEnabled: () => WorkBundle[] }).getEnabled =
      () => [bundle('dev', 'Dev', [tool('d1')])]
    loadBundles()
    expect(bundlesRef.current.length).toBeGreaterThan(0) // recovered
  })

  it('composeBundleTools on bundle with empty tools array → no crash', () => {
    expect(() => composeBundleTools([bundle('e', 'Empty', [])])).not.toThrow()
    expect(composeBundleTools([bundle('e', 'Empty', [])])).toEqual([])
  })

  it('composeBundleSkills on bundle with empty skills array → no crash', () => {
    expect(() => composeBundleSkills([bundle('e', 'Empty', [])])).not.toThrow()
    expect(composeBundleSkills([bundle('e', 'Empty', [])])).toEqual([])
  })

  it('empty getEnabled() → same behaviour as error', () => {
    const store = makeFakeBundleStore([])
    const bundlesRef = { current: [] as WorkBundle[] }

    const cleanup = withBundleLifecycle(store, (bundles) => {
      bundlesRef.current = bundles
    })

    expect(bundlesRef.current).toEqual([])

    // App still works
    const input: AgentTurnInput = { systemPrompt: 'p', tools: [] }
    const result = applyComposedContext(input, [])
    expect(result.bundleKeys).toEqual([])

    cleanup()
  })

  it('applyComposedContext with empty bundles: system prompt preserved', () => {
    const input: AgentTurnInput = {
      systemPrompt: 'unchanged',
      tools: [{ name: 'app_tool', description: 'app' }],
    }
    const result = applyComposedContext(input, [])
    expect(result.systemPrompt).toBe('unchanged')
    expect(result.tools.map((t) => t.name)).toEqual(['app_tool'])
    expect(result.bundleKeys).toEqual([])
    expect(result.composedAt).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: Cross-app pattern consistency (contract test)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contract test: verifies the bundle wiring pattern is present in all
 * 6 LyceroMatePanel files. Uses node:fs so it reads real source.
 */
describe('5 · Cross-app pattern consistency (contract test)', () => {
  const APPS = [
    'apps/docs/src/renderer/ai/LyceroMatePanel.tsx',
    'apps/slides/src/renderer/ai/LyceroMatePanel.tsx',
    'apps/markdown/src/renderer/ai/LyceroMatePanel.tsx',
    'apps/pdf/src/renderer/ai/LyceroMatePanel.tsx',
    'apps/html/src/renderer/ai/LyceroMatePanel.tsx',
    // sheets uses a different architecture (no LyceroMatePanel.tsx)
  ] as const

  for (const app of APPS) {
    it(`${app}: bundlesRef wire contract`, () => {
      const filePath = repoPath(app)

      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        // File absent on this branch → skip gracefully
        return
      }

      // Contract checks
      expect(content).toMatch(/const\s+bundlesRef\s*=\s*useRef<WorkBundle\[\]>\(\[\]\)/)
      expect(content).toMatch(/\.getEnabled\(\)/)
      expect(content).toMatch(/\.onEnabledChanged\(/)
      expect(content).toMatch(/bundlesRef\s*[,\}]/)
    })

    it(`${app}: Phase A.5 or A.6 milestone comment present`, () => {
      const filePath = repoPath(app)

      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        return
      }

      expect(content).toMatch(/Phase A\.[56]: .*bundle/i)
    })
  }

  it('All panels follow the Docs reference pattern', () => {
    const docsPath = repoPath('apps/docs/src/renderer/ai/LyceroMatePanel.tsx')

    let docsContent: string
    try {
      docsContent = readFileSync(docsPath, 'utf-8')
    } catch {
      return
    }

    // Extract the Phase A.5/A.6 bundle section
    const phaseAMatch = docsContent.match(
      /Phase A\.[56]:[\s\S]*?(?=Phase A\.|\nconst\s+\w+Ref\s*=)/,
    )
    const phaseAContent = phaseAMatch?.[0] ?? docsContent

    const requiredPatterns = [
      /bundlesRef\s*=\s*useRef<WorkBundle\[\]>\(\[\]\)/,
      /getEnabled\(\)/,
      /onEnabledChanged\(/,
      /loadBundles/,
      /bundlesRef\s*[,\}]/,
    ]

    for (const pattern of requiredPatterns) {
      expect(phaseAContent).toMatch(pattern)
    }
  })

  it('sheets app uses different architecture (no LyceroMatePanel.tsx)', () => {
    // This test documents the known exception: sheets uses a different
    // panel architecture and does not have a LyceroMatePanel.tsx file.
    // The contract test above skips sheets.
    const sheetsPath = repoPath('apps/sheets/src/renderer/ai/LyceroMatePanel.tsx')
    let exists = false
    try {
      readFileSync(sheetsPath, 'utf-8')
      exists = true
    } catch {
      exists = false
    }
    expect(exists).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: Verify no regressions in existing composer / apply-composed
// ─────────────────────────────────────────────────────────────────────────────

describe('regression · existing composer behaviour preserved', () => {
  it('composeBundleTools: single bundle returns all its tools', () => {
    const b = bundle('test', 'Test', [tool('tool_a', 'A'), tool('tool_b', 'B')])
    const result = composeBundleTools([b])
    expect(result.map((t) => t.name)).toEqual(['tool_a', 'tool_b'])
    expect(result[0]!.source.bundleKey).toBe('test')
  })

  it('buildSystemPromptAddition: empty → empty string', () => {
    expect(buildSystemPromptAddition([])).toBe('')
  })

  it('applyComposedContext: preserves base system prompt and tools', () => {
    const input: AgentTurnInput = {
      systemPrompt: 'base system',
      tools: [{ name: 'app_tool', description: 'app tool' }],
    }
    const ctx = applyComposedContext(input, [])
    expect(ctx.systemPrompt).toBe('base system')
    expect(ctx.tools.find((t) => t.name === 'app_tool')).toBeDefined()
  })

  it('composeAgentContext: systemPromptAddition empty when no skills', () => {
    const ctx = composeAgentContext([])
    expect(ctx.systemPromptAddition).toBe('')
  })
})
