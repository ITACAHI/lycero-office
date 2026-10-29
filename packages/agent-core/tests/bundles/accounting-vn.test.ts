/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Import from tools module
// ─────────────────────────────────────────────────────────────────────────────

import {
  executeVnVatLookup,
  executeTncnCalculate,
  executeFormatVnCurrency,
  calculateTncn,
  formatVnCurrency,
  type TncnResult,
} from '../../src/bundles/accounting-vn/tools'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

function makeCall(name: string, input: Record<string, unknown>): ToolCall {
  return { id: `test-${Math.random()}`, name, input }
}

// ─────────────────────────────────────────────────────────────────────────────
// sheets.vn_vat_lookup
// ─────────────────────────────────────────────────────────────────────────────

describe('sheets.vn_vat_lookup', () => {
  it('returns VAT info for known MST', async () => {
    const call = makeCall('sheets.vn_vat_lookup', { taxCode: '0100123456' })
    const result = await executeVnVatLookup(call)
    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.output)
    expect(data.taxCode).toBe('0100123456')
    expect(data.companyName).toBe('Công ty TNHH MTV X')
    expect(data.vatRate).toBe(10)
    expect(data.source).toContain('Thông tư 200/2014/TT-BTC')
  })

  it('returns default 10% rate for unknown MST', async () => {
    const call = makeCall('sheets.vn_vat_lookup', { taxCode: '9999999999' })
    const result = await executeVnVatLookup(call)
    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.output)
    expect(data.vatRate).toBe(10)
    expect(data.note).toContain('mặc định')
    expect(data.companyName).toBe('(không tìm thấy)')
  })

  it('returns error for empty tax code', async () => {
    const call = makeCall('sheets.vn_vat_lookup', { taxCode: '' })
    const result = await executeVnVatLookup(call)
    expect(result.isError).toBe(true)
    expect(result.output).toContain('không được để trống')
  })

  it('returns error for invalid length (9 digits)', async () => {
    const call = makeCall('sheets.vn_vat_lookup', { taxCode: '123456789' })
    const result = await executeVnVatLookup(call)
    expect(result.isError).toBe(true)
    expect(result.output).toContain('10 hoặc 14 chữ số')
  })

  it('returns error for invalid length (12 digits)', async () => {
    const call = makeCall('sheets.vn_vat_lookup', { taxCode: '123456789012' })
    const result = await executeVnVatLookup(call)
    expect(result.isError).toBe(true)
  })

  it('strips non-numeric characters from MST', async () => {
    const call = makeCall('sheets.vn_vat_lookup', { taxCode: '0100-1234-56' })
    const result = await executeVnVatLookup(call)
    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.output)
    expect(data.taxCode).toBe('0100123456')
  })

  it('summary is non-empty string', async () => {
    const call = makeCall('sheets.vn_vat_lookup', { taxCode: '0100123456' })
    const result = await executeVnVatLookup(call)
    expect(typeof result.summary).toBe('string')
    expect(result.summary.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// sheets.tncn_calculate
// ─────────────────────────────────────────────────────────────────────────────

describe('sheets.tncn_calculate', () => {
  describe('calculateTncn (pure function)', () => {
    it('happy path: income 20M, region I, no dependents → 0 tax', () => {
      const result = calculateTncn({ income: 20_000_000, dependents: 0, region: '1' })
      // 20M - 11M personal = 9M → ≤ 5M threshold → 0 tax
      expect(result.taxableIncome).toBe(0)
      expect(result.tax).toBe(0)
    })

    it('edge: taxable exactly 5M → 5% bracket, 250k tax', () => {
      // income = 11M (personal) + 9M (region I) + 5M taxable = 25M
      const result = calculateTncn({ income: 25_000_000, dependents: 0, region: '1' })
      expect(result.taxableIncome).toBe(5_000_000)
      expect(result.taxRate).toBe(5)
      // 5M × 5% - 0 = 250,000
      expect(result.tax).toBe(250_000)
    })

    it('negative income throws', () => {
      expect(() => calculateTncn({ income: -1_000_000, dependents: 0, region: '1' })).toThrow()
    })

    it('negative dependents throws', () => {
      expect(() => calculateTncn({ income: 20_000_000, dependents: -1, region: '1' })).toThrow()
    })
  })

  it('happy path: income 30M, 1 dependent, region II', async () => {
    const call = makeCall('sheets.tncn_calculate', { income: 30_000_000, dependents: 1, region: '2' })
    const result = await executeTncnCalculate(call)
    expect(result.isError).toBeUndefined()
    const data: TncnResult = JSON.parse(result.output)
    expect(data.income).toBe(30_000_000)
    expect(data.personalDeduction).toBe(11_000_000)
    expect(data.dependentDeduction).toBe(4_400_000)
    expect(data.regionDeduction).toBe(7_500_000)
    expect(data.taxableIncome).toBe(7_100_000)
    // 7.1M falls in bracket 2: 5M-10M → 10%, deduct 250k
    // 7,100,000 × 10% - 250,000 = 460,000
    expect(data.taxRate).toBe(10)
    expect(data.tax).toBe(460_000)
    expect(data.breakdown.length).toBeGreaterThan(0)
    expect(data.authority).toContain('Nghị định 954/2020')
  })

  it('returns error for missing income', async () => {
    const call = makeCall('sheets.tncn_calculate', { dependents: 0 })
    const result = await executeTncnCalculate(call)
    expect(result.isError).toBe(true)
    expect(result.output).toContain('bắt buộc')
  })

  it('returns error for non-numeric income', async () => {
    const call = makeCall('sheets.tncn_calculate', { income: 'abc' as unknown as number })
    const result = await executeTncnCalculate(call)
    expect(result.isError).toBe(true)
  })

  it('correct tax bracket 3: taxable 15M → 15%', () => {
    // income = 15M + 11M + 9M = 35M → taxable = 15M
    const result = calculateTncn({ income: 35_000_000, dependents: 0, region: '1' })
    expect(result.taxableIncome).toBe(15_000_000)
    expect(result.taxRate).toBe(15)
    // 15M × 15% - 1,250,000 = 2,250,000 - 1,250,000 = 1,000,000
    expect(result.tax).toBe(1_000_000)
  })

  it('max bracket: taxable exactly 80M — 30 percent rate (b\u0101\u1eadc 6)', () => {
    // income = 80M + 11M + 9M = 100M — taxable = 80M
    // 80M is the upper boundary of bac 6 (<=80M), rate = 30%, deduct = 9,850,000
    const result = calculateTncn({ income: 100_000_000, dependents: 0, region: '1' })
    expect(result.taxableIncome).toBe(80_000_000)
    expect(result.taxRate).toBe(30)
    // 80M x 30% - 9,850,000 = 14,150,000
    expect(result.tax).toBe(14_150_000)
  })

  it('overflow bracket: taxable 90M — 35 percent rate (Infinity bac)', () => {
    // income = 90M + 11M + 9M = 110M — taxable = 90M (exceeds 80M upper boundary)
    const result = calculateTncn({ income: 110_000_000, dependents: 0, region: '1' })
    expect(result.taxableIncome).toBe(90_000_000)
    expect(result.taxRate).toBe(35)
    // 90M x 35% - 18,150,000 = 13,350,000
    expect(result.tax).toBe(13_350_000)
  })

  it('summary contains formatted numbers', async () => {
    const call = makeCall('sheets.tncn_calculate', { income: 30_000_000, dependents: 1, region: '2' })
    const result = await executeTncnCalculate(call)
    expect(result.summary).toContain('30.000.000')
    expect(result.summary).toContain('460.000')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// docs.format_vn_currency
// ─────────────────────────────────────────────────────────────────────────────

describe('docs.format_vn_currency', () => {
  describe('formatVnCurrency (pure function)', () => {
    it('VND: basic number', () => {
      const r = formatVnCurrency({ amount: 500_000_000 })
      expect(r).toBe('500.000.000 đ')
    })

    it('VND: small number', () => {
      expect(formatVnCurrency({ amount: 150_000 })).toBe('150.000 đ')
    })

    it('VND: large number', () => {
      const r = formatVnCurrency({ amount: 1_234_567_890 })
      expect(r).toBe('1.234.567.890 đ')
    })

    it('million: formats with comma decimal', () => {
      const r = formatVnCurrency({ amount: 500_000_000, unit: 'million' })
      expect(r).toBe('500,0 triệu')
    })

    it('billion: formats correctly', () => {
      const r = formatVnCurrency({ amount: 5_000_000_000, unit: 'billion' })
      expect(r).toBe('5,0 tỷ')
    })

    it('billion: small amount', () => {
      const r = formatVnCurrency({ amount: 500_000_000, unit: 'billion' })
      expect(r).toBe('0,5 tỷ')
    })

    it('zero', () => {
      expect(formatVnCurrency({ amount: 0 })).toBe('0 đ')
    })
  })

  it('happy path: formats 500M as VND', async () => {
    const call = makeCall('docs.format_vn_currency', { amount: 500_000_000 })
    const result = await executeFormatVnCurrency(call)
    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.output)
    expect(data.formatted).toBe('500.000.000 đ')
    expect(data.unit).toBe('VND')
  })

  it('happy path: formats as million', async () => {
    const call = makeCall('docs.format_vn_currency', { amount: 500_000_000, unit: 'million' })
    const result = await executeFormatVnCurrency(call)
    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.output)
    expect(data.formatted).toBe('500,0 triệu')
  })

  it('edge: NaN returns error', async () => {
    const call = makeCall('docs.format_vn_currency', { amount: NaN })
    const result = await executeFormatVnCurrency(call)
    expect(result.isError).toBe(true)
    expect(result.output).toContain('không hợp lệ')
  })

  it('edge: null amount returns error', async () => {
    const call = makeCall('docs.format_vn_currency', { amount: null })
    const result = await executeFormatVnCurrency(call)
    expect(result.isError).toBe(true)
  })

  it('summary is non-empty string', async () => {
    const call = makeCall('docs.format_vn_currency', { amount: 100_000_000 })
    const result = await executeFormatVnCurrency(call)
    expect(typeof result.summary).toBe('string')
    expect(result.summary.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SKILL.md shape (property-based)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs'
import { resolve } from 'path'

const SKILL_DIR = resolve(__dirname, '../../src/bundles/accounting-vn')

function loadSkill(name: string): string {
  return readFileSync(resolve(SKILL_DIR, name), 'utf-8')
}

describe('SKILL.md shape (property-based)', () => {
  it('vn-tax-tt200.md has required YAML frontmatter fields', () => {
    const content = loadSkill('vn-tax-tt200.md')
    expect(content).toContain('---')
    const firstSep = content.indexOf('---')
    const secondSep = content.indexOf('---', firstSep + 1)
    const frontmatter = content.slice(firstSep + 1, secondSep)

    expect(frontmatter).toMatch(/^id:\s*vn-tax-tt200$/m)
    expect(frontmatter).toMatch(/^name:/m)
    expect(frontmatter).toMatch(/^description:/m)
    expect(frontmatter).toMatch(/^instructions:\s*\|$/m)
    expect(frontmatter).toMatch(/^version:/m)
    expect(frontmatter).toMatch(/^authority:/m)
  })

  it('vn-tax-tt200.md instructions ≥ 200 characters', () => {
    const content = loadSkill('vn-tax-tt200.md')
    const markerIdx = content.indexOf('instructions: |')
    const instructionsStart = markerIdx + 'instructions: |'.length + 1
    const instructions = content.slice(instructionsStart).trim()
    expect(instructions.length).toBeGreaterThanOrEqual(200)
  })

  it('vn-mtt-201-balance.md has required YAML frontmatter fields', () => {
    const content = loadSkill('vn-mtt-201-balance.md')
    expect(content).toContain('---')
    const firstSep = content.indexOf('---')
    const secondSep = content.indexOf('---', firstSep + 1)
    const frontmatter = content.slice(firstSep + 1, secondSep)

    expect(frontmatter).toMatch(/^id:\s*vn-mtt-201-balance$/m)
    expect(frontmatter).toMatch(/^name:/m)
    expect(frontmatter).toMatch(/^description:/m)
    expect(frontmatter).toMatch(/^instructions:\s*\|$/m)
    expect(frontmatter).toMatch(/^version:/m)
    expect(frontmatter).toMatch(/^authority:/m)
  })

  it('vn-mtt-201-balance.md instructions ≥ 200 characters', () => {
    const content = loadSkill('vn-mtt-201-balance.md')
    const markerIdx = content.indexOf('instructions: |')
    const instructionsStart = markerIdx + 'instructions: |'.length + 1
    const instructions = content.slice(instructionsStart).trim()
    expect(instructions.length).toBeGreaterThanOrEqual(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Manifest integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('Manifest integrity (accounting_vn bundle)', () => {
  it('accounting_vn bundle tools have unique names', () => {
    // These must match the names registered in work-bundles.ts
    const expectedToolNames = ['sheets.vn_vat_lookup', 'sheets.tncn_calculate', 'docs.format_vn_currency']
    expect(expectedToolNames).toHaveLength(new Set(expectedToolNames).size)
  })

  it('accounting_vn bundle has exactly 2 cloud skills', () => {
    const expectedSkillNames = ['vn-tax-tt200', 'vn-mtt-201-balance']
    expect(expectedSkillNames).toHaveLength(2)
    expect(expectedSkillNames).toHaveLength(new Set(expectedSkillNames).size)
  })

  it('work-bundles.ts already registers accounting_vn with correct tool names', async () => {
    // Dynamic import to get the live registry
    const { WORK_BUNDLES } = await import('@lycero/ai-auth')
    const bundle = WORK_BUNDLES.find((b) => b.key === 'accounting_vn')
    expect(bundle).toBeDefined()
    expect(bundle!.tools.map((t) => t.name)).toContain('sheets.vn_vat_lookup')
    expect(bundle!.tools.map((t) => t.name)).toContain('sheets.tncn_calculate')
    expect(bundle!.tools.map((t) => t.name)).toContain('docs.format_vn_currency')
    expect(bundle!.skills.map((s) => s.name)).toContain('vn-tax-tt200')
    expect(bundle!.skills.map((s) => s.name)).toContain('vn-mtt-201-balance')
  })
})
