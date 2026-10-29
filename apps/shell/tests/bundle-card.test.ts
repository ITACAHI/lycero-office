/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { filterBundles, normalizeBundle } from '../src/renderer/src/bundles/filter'
import type { WorkBundle } from '@lycero/ai-auth'
import type { InstalledBundleEntry } from '../src/shared/bundle-api'

const ACCOUNTING_VN: WorkBundle = {
  id: 1,
  key: 'accounting_vn',
  labelVi: 'Kế toán Việt Nam',
  description: 'VAS, MTT 200/201, TNCN, hóa đơn điện tử.',
  tools: [
    { name: 'sheets.vn_vat_lookup', description: 'Tra cứu VAT', parameters: {} },
    { name: 'sheets.tncn_calculate', description: 'Tính TNCN', parameters: {} },
  ],
  skills: [{ name: 'vn-tax-tt200', description: 'Thuế GTGT', content: 'content' }],
  defaultConfig: {},
}

const GENERAL_OFFICE: WorkBundle = {
  id: 0,
  key: 'general_office',
  labelVi: 'Văn phòng tổng hợp',
  description: 'Công cụ cơ bản cho hợp đồng, báo cáo.',
  tools: [{ name: 'docs.format_vn_currency', description: 'Format currency', parameters: {} }],
  skills: [],
  required: true,
}

const INSTALLED_ENABLED: InstalledBundleEntry = {
  bundleId: 1,
  bundleKey: 'accounting_vn',
  enabled: true,
  installedAt: Date.now(),
  config: {},
}

describe('normalizeBundle', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalizeBundle('Kế toán Việt Nam')).toBe('ke toan viet nam')
    expect(normalizeBundle('Công cụ')).toBe('cong cu')
  })

  it('is idempotent', () => {
    const s = normalizeBundle('Văn phòng')
    expect(normalizeBundle(s)).toBe(s)
  })
})

describe('filterBundles', () => {
  const bundles = [ACCOUNTING_VN, GENERAL_OFFICE]

  it('returns all bundles when search is empty and filter is all', () => {
    const result = filterBundles(bundles, '', [], 'all')
    expect(result).toHaveLength(2)
  })

  it('filters by labelVi', () => {
    const result = filterBundles(bundles, 'kế toán', [], 'all')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('filters by description', () => {
    const result = filterBundles(bundles, 'hợp đồng', [], 'all')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('general_office')
  })

  it('filters by tool name', () => {
    const result = filterBundles(bundles, 'vn_vat_lookup', [], 'all')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('returns empty array when no match', () => {
    const result = filterBundles(bundles, 'xyz', [], 'all')
    expect(result).toHaveLength(0)
  })

  it('diacritic-insensitive: matches without diacritics', () => {
    const result = filterBundles(bundles, 'ke toan', [], 'all')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('filter installed: shows only installed bundles', () => {
    const result = filterBundles(bundles, '', [INSTALLED_ENABLED], 'installed')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('filter enabled: shows only enabled bundles', () => {
    const result = filterBundles(bundles, '', [INSTALLED_ENABLED], 'enabled')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('filter enabled: hides disabled bundles', () => {
    const disabled: InstalledBundleEntry = { ...INSTALLED_ENABLED, enabled: false }
    const result = filterBundles(bundles, '', [disabled], 'enabled')
    expect(result).toHaveLength(0)
  })

  it('filters by skill name', () => {
    const result = filterBundles(bundles, 'vn-tax-tt200', [], 'all')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('search is case-insensitive', () => {
    const result = filterBundles(bundles, 'KẾ TOÁN', [], 'all')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('search matches by bundle key', () => {
    const result = filterBundles(bundles, 'accounting', [], 'all')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('combined search + filter', () => {
    const result = filterBundles(bundles, 'viet', [INSTALLED_ENABLED], 'installed')
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe('accounting_vn')
  })

  it('combined search + filter yields nothing', () => {
    const result = filterBundles(bundles, 'freelance', [INSTALLED_ENABLED], 'installed')
    expect(result).toHaveLength(0)
  })
})
