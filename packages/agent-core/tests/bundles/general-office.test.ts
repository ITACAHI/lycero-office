/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase B.3: general_office bundle tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BundleStore } from '../../../../apps/shell/src/main/bundle-store'
import { WORK_BUNDLES } from '@lycero/ai-auth'
import {
  formatVnCurrency,
  insertTable,
  themeWarm,
  executeGeneralOfficeTool,
} from '../../src/bundles/general-office/tools'
import { generalOfficeSkill } from '../../src/bundles/general-office/skill'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// ── Shared temp dir factory (matches bundle-store pattern) ────────

let _tmpDir: string | undefined

async function makeTempDir(): Promise<string> {
  const dir = path.join(
    os.tmpdir(),
    `lycero-bundletest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ── tools.test.ts ─────────────────────────────────────────────────

describe('formatVnCurrency', () => {
  it('formats integer VND with dot separator', () => {
    expect(formatVnCurrency({ amount: 1234567 })).toBe('1.234.567 đ')
  })

  it('formats large number with dot separator', () => {
    expect(formatVnCurrency({ amount: 50000000 })).toBe('50.000.000 đ')
  })

  it('formats zero', () => {
    expect(formatVnCurrency({ amount: 0 })).toBe('0 đ')
  })

  it('rounds float amount to nearest integer', () => {
    expect(formatVnCurrency({ amount: 1234567.49 })).toBe('1.234.567 đ')
  })

  it('formats million unit', () => {
    expect(formatVnCurrency({ amount: 50, unit: 'million' })).toBe('50 triệu đ')
  })

  it('formats billion unit with locale decimal', () => {
    expect(formatVnCurrency({ amount: 2.5, unit: 'billion' })).toBe('2,5 tỷ đ')
  })

  it('defaults to VND when unit is omitted', () => {
    expect(formatVnCurrency({ amount: 999 })).toBe('999 đ')
  })

  it('handles thousand separator in VND', () => {
    expect(formatVnCurrency({ amount: 1000000000 })).toBe('1.000.000.000 đ')
  })
})

describe('insertTable', () => {
  it('generates markdown table with headers', () => {
    const result = insertTable({ rows: 2, cols: 3, headers: ['Tên', 'Tuổi', 'Thành phố'] })
    expect(result).toContain('| Tên | Tuổi | Thành phố |')
    expect(result).toContain('| --- | --- | --- |')
    expect(result.split('\n')).toHaveLength(4) // header + sep + 2 data rows
  })

  it('uses default headers when not provided', () => {
    const result = insertTable({ rows: 1, cols: 2 })
    expect(result).toContain('Cột 1')
    expect(result).toContain('Cột 2')
  })

  it('fills data rows correctly', () => {
    const result = insertTable({
      rows: 2,
      cols: 2,
      headers: ['A', 'B'],
      data: [['x', 'y'], ['z', 'w']],
    })
    expect(result).toContain('| x | y |')
    expect(result).toContain('| z | w |')
  })

  it('pads short data rows with empty cells', () => {
    const result = insertTable({
      rows: 1,
      cols: 3,
      headers: ['X', 'Y', 'Z'],
      data: [['only one']],
    })
    const lines = result.split('\n')
    expect(lines[2]).toBe('| only one |  |  |')
  })

  it('pads short header row with default column names', () => {
    const result = insertTable({ rows: 1, cols: 3 })
    const headerLine = result.split('\n')[0]!
    expect(headerLine).toBe('| Cột 1 | Cột 2 | Cột 3 |')
  })

  it('returns error for rows < 1', () => {
    const result = insertTable({ rows: 0, cols: 2 })
    expect(result).toContain('Lỗi')
  })

  it('returns error for cols < 1', () => {
    const result = insertTable({ rows: 2, cols: 0 })
    expect(result).toContain('Lỗi')
  })
})

describe('themeWarm', () => {
  it('returns spec with light palette tokens (not hex)', () => {
    const { spec } = themeWarm({ app: 'slides' })
    expect(spec.light.background).toBe('var(--surface-subtle)')
    expect(spec.light.paper).toBe('var(--surface)')
    expect(spec.light.ink).toBe('var(--text-primary)')
    expect(spec.light.accent).toBe('var(--color-ai-action)')
    expect(spec.light.border).toBe('var(--border)')
  })

  it('returns spec with dark palette tokens (not hex)', () => {
    const { spec } = themeWarm({ app: 'docs' })
    expect(spec.dark.background).toBe('var(--surface-subtle)')
    expect(spec.dark.paper).toBe('var(--surface)')
    expect(spec.dark.ink).toBe('var(--text-primary)')
    expect(spec.dark.accent).toBe('var(--color-ai-action)')
    expect(spec.dark.border).toBe('var(--border)')
  })

  it('returns motion tokens for easing', () => {
    const { spec } = themeWarm({ app: 'sheets' })
    expect(spec.motion.transitionFast).toBe('var(--transition-fast)')
    expect(spec.motion.transitionMedium).toBe('var(--transition-medium)')
  })

  it('includes slides-specific canvas overrides', () => {
    const { spec } = themeWarm({ app: 'slides' })
    expect((spec as unknown as Record<string, unknown>).canvas).toBeDefined()
    const canvas = (spec as unknown as Record<string, unknown>).canvas as Record<string, unknown>
    expect(canvas.aspectRatio).toBe('16 / 9')
    expect(canvas.fontFamily).toBe('var(--gs-font-sans)')
  })

  it('includes sheets-specific grid overrides', () => {
    const { spec } = themeWarm({ app: 'sheets' })
    const grid = (spec as unknown as Record<string, unknown>).grid as Record<string, unknown>
    expect(grid.cellFillDark).toBe('var(--bg-content)')
    expect(grid.fontFigure).toBe('tabular-nums')
  })

  it('does not include canvas/grid overrides for docs', () => {
    const { spec } = themeWarm({ app: 'docs' })
    expect((spec as unknown as Record<string, unknown>).canvas).toBeUndefined()
    expect((spec as unknown as Record<string, unknown>).grid).toBeUndefined()
  })

  it('returns a serializable JSON spec', () => {
    const { spec } = themeWarm({ app: 'docs' })
    const json = JSON.stringify(spec)
    expect(() => JSON.parse(json)).not.toThrow()
    // No raw hex — tokens use var() syntax
    expect(json).not.toMatch(/#(?:[0-9a-fA-F]{3}){1,2}/)
  })
})

describe('executeGeneralOfficeTool', () => {
  it('dispatches docs.format_vn_currency', () => {
    const result = executeGeneralOfficeTool('docs.format_vn_currency', { amount: 1234567 })
    expect(result.output).toBe('1.234.567 đ')
    expect(result.isError).toBeFalsy()
  })

  it('dispatches docs.insert_table', () => {
    const result = executeGeneralOfficeTool('docs.insert_table', {
      rows: 1,
      cols: 2,
      headers: ['A', 'B'],
    })
    expect(result.output).toContain('| A | B |')
    expect(result.summary).toBe('Chèn bảng vào tài liệu')
  })

  it('dispatches slides.theme_warm and returns JSON', () => {
    const result = executeGeneralOfficeTool('slides.theme_warm', { app: 'slides' })
    expect(result.output).toContain('var(--surface-subtle)')
    expect(result.output).toContain('warm')
    expect(result.summary).toBe('Áp dụng theme ấm cho slides')
  })

  it('returns error for unknown tool', () => {
    const result = executeGeneralOfficeTool('docs.unknown_tool' as 'docs.format_vn_currency', {})
    expect(result.isError).toBe(true)
    expect(result.output).toContain('Unknown tool')
  })
})

// ── generalOfficeSkill.test.ts ─────────────────────────────────────

describe('generalOfficeSkill', () => {
  it('has correct skill id', () => {
    expect(generalOfficeSkill.id).toBe('general_office')
  })

  it('has 3 tools registered', () => {
    expect(generalOfficeSkill.tools).toHaveLength(3)
  })

  it('has docs.format_vn_currency tool', () => {
    const tool = generalOfficeSkill.tools.find((t) => t.name === 'docs.format_vn_currency')
    expect(tool).toBeDefined()
    expect(tool!.description).toBeTruthy()
    expect(tool!.inputSchema).toBeDefined()
  })

  it('has docs.insert_table tool', () => {
    const tool = generalOfficeSkill.tools.find((t) => t.name === 'docs.insert_table')
    expect(tool).toBeDefined()
  })

  it('has slides.theme_warm tool', () => {
    const tool = generalOfficeSkill.tools.find((t) => t.name === 'slides.theme_warm')
    expect(tool).toBeDefined()
  })

  it('executeTool returns error for unknown tool', async () => {
    const result = await generalOfficeSkill.executeTool({ id: '1', name: 'unknown.tool', input: {} })
    expect(result.isError).toBe(true)
  })

  it('executeTool delegates to format_vn_currency', async () => {
    const result = await generalOfficeSkill.executeTool({
      id: '1',
      name: 'docs.format_vn_currency',
      input: { amount: 500000 },
    })
    expect(result.output).toBe('500.000 đ')
  })

  it('executeTool delegates to insert_table', async () => {
    const result = await generalOfficeSkill.executeTool({
      id: '1',
      name: 'docs.insert_table',
      input: { rows: 1, cols: 1, headers: ['X'] },
    })
    expect(result.output).toContain('X')
  })

  it('executeTool delegates to theme_warm', async () => {
    const result = await generalOfficeSkill.executeTool({
      id: '1',
      name: 'slides.theme_warm',
      input: { app: 'docs' },
    })
    expect(result.output).toContain('warm')
  })
})

// ── BundleStore required-bundle tests ─────────────────────────────

describe('BundleStore required bundle (general_office)', () => {
  let tmpDir: string
  let store: BundleStore

  beforeEach(async () => {
    tmpDir = await makeTempDir()
    store = new BundleStore({ storageDir: tmpDir })
  })

  afterEach(async () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  it('getEnabledBundles includes general_office even when not installed', async () => {
    await store.uninstall('general_office')
    const enabled = await store.getEnabledBundles()
    const keys = enabled.map((b) => b.key)
    expect(keys).toContain('general_office')
  })

  it('getEnabledBundles always returns general_office with required flag', async () => {
    await store.install(1) // accounting_vn
    const enabled = await store.getEnabledBundles()
    const keys = enabled.map((b) => b.key)
    expect(keys).toContain('general_office')
    expect(keys).toContain('accounting_vn')
  })

  it('setEnabled throws when disabling required bundle general_office', async () => {
    await expect(store.setEnabled('general_office', false)).rejects.toThrow(/required/)
  })

  it('setEnabled throws when disabling general_office after installing it', async () => {
    await store.install(0) // explicitly install general_office
    await expect(store.setEnabled('general_office', false)).rejects.toThrow(/required/)
  })

  it('setEnabled succeeds for non-required bundles', async () => {
    await store.install(1) // accounting_vn
    await expect(store.setEnabled('accounting_vn', false)).resolves.toBeUndefined()
  })

  it('general_office has required: true in registry', () => {
    const bundle = WORK_BUNDLES.find((b) => b.key === 'general_office')
    expect(bundle).toBeDefined()
    expect(bundle!.required).toBe(true)
  })

  it('non-required bundles have required: undefined', () => {
    for (const bundle of WORK_BUNDLES) {
      if (bundle.id !== 0) {
        expect(bundle.required ?? false).toBeFalsy()
      }
    }
  })

  it('required flag is optional in WorkBundle type', () => {
    // All existing bundles compile without `required` field
    for (const bundle of WORK_BUNDLES) {
      expect(typeof bundle.required === 'boolean' || bundle.required === undefined).toBe(true)
    }
  })
})

// ── Wire pattern regression ───────────────────────────────────────

describe('wire pattern regression (Phase A.6 contract)', () => {
  it('general_office tool does not conflict with accounting_vn tool names in composer', async () => {
    // general_office has docs.format_vn_currency
    // accounting_vn has docs.format_vn_currency too
    // First-write-wins: order matters — general_office should win if listed first
    const generalBundle = WORK_BUNDLES.find((b) => b.key === 'general_office')!
    const accBundle = WORK_BUNDLES.find((b) => b.key === 'accounting_vn')!

    // Ponytail finding: collision expected. general_office (id=0) listed first
    // so it wins the collision. B.1 will dedupe to shared utility.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Simulate composeBundleTools order (general_office first)
    const { composeBundleTools } = await import('../../src/composer')
    const tools = composeBundleTools([generalBundle, accBundle])
    const sharedTool = tools.find((t) => t.name === 'docs.format_vn_currency')
    expect(sharedTool?.source.bundleKey).toBe('general_office') // first-write-wins

    // Collision warning should fire
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
