/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase C: intent router tests.
 *
 * All Vietnamese strings use Unicode escapes to ensure correct encoding
 * regardless of how the test file is read on disk.
 */

import { describe, it, expect } from 'vitest'
import { normalizePrompt, routeIntent } from '../../src/router/intent-router'
import { composeBundleSkills } from '../../src/composer'
import type { WorkBundle, WorkBundleSkill } from '@lycero/ai-auth'

// ─── Minimal bundle factory ───────────────────────────────────────────────────

const EMPTY_SKILL: WorkBundleSkill = {
  name: 'dummy',
  description: 'dummy skill',
  content: 'dummy content',
}

function makeBundle(overrides: Partial<WorkBundle> & { intents?: readonly string[] } = {}): WorkBundle {
  return {
    id: 1,
    key: 'test_bundle',
    labelVi: 'Test Bundle',
    description: 'Test description',
    tools: [],
    skills: [EMPTY_SKILL],
    defaultConfig: {},
    required: false,
    ...overrides,
  } as WorkBundle
}

// ─── Pre-built bundles matching actual registry ────────────────────────────────

// Unicode escapes ensure correct encoding regardless of file encoding
const ACCOUNTING_VN: WorkBundle = makeBundle({
  id: 1,
  key: 'accounting_vn',
  labelVi: 'K\u1ebf to\u00e1n Vi\u1ec7t Nam',
  description: 'VAS, MTT 200/201, TNCN, h\u00f3a \u0111\u01a1n \u0111i\u1ec7n t\u1eed.',
  intents: [
    'bao cao tai chinh',
    'hoa don',
    'thue',
    'VAT',
    'doanh thu',
    'lo nhuan',
    'bang can doi ke toan',
    'mst',
    'ma so thue',
  ],
})

const FREELANCE_SOLO: WorkBundle = makeBundle({
  id: 2,
  key: 'freelance_solo',
  labelVi: 'Freelance & C\u00e1 nh\u00e2n',
  description: 'H\u1ee3p \u0111\u1ed3ng freelance, h\u00f3a \u0111\u01a1n d\u1ecbch v\u1ee5, NDA.',
  intents: [
    'hop dong freelance',
    'hop dong tu do',
    'hoa don freelance',
    'NDA',
    'thoa thuan bao mat',
    'bao mat',
    'thanh toan',
    'cong no',
    'freelance',
  ],
})

const GENERAL_OFFICE: WorkBundle = makeBundle({
  id: 0,
  key: 'general_office',
  labelVi: 'V\u0103n ph\u00f2ng t\u1ed5ng h\u1ee3p',
  description: 'C\u00f4ng c\u1ee5 c\u01a1 b\u1ea3n.',
  required: true,
  intents: [],
})

// ─── Normalization tests ─────────────────────────────────────────────────────

describe('normalizePrompt', () => {
  it('strips Vietnamese diacritics', () => {
    // K\u1ebf to\u00e1n Vi\u1ec7t Nam
    expect(normalizePrompt('K\u1ebf to\u00e1n Vi\u1ec7t Nam')).toBe('ke toan viet nam')
  })

  it('lowercases input', () => {
    expect(normalizePrompt('LAP BAO CAO')).toBe('lap bao cao')
    expect(normalizePrompt('HOP DONG')).toBe('hop dong')
  })

  it('collapses internal whitespace', () => {
    expect(normalizePrompt('  lap    bao   cao  ')).toBe('lap bao cao')
    expect(normalizePrompt('hop\t\nfreelance')).toBe('hop freelance')
  })

  it('returns empty string for empty/blank input', () => {
    expect(normalizePrompt('')).toBe('')
    expect(normalizePrompt('   ')).toBe('')
    expect(normalizePrompt('\t\n')).toBe('')
  })

  it('handles mixed case, diacritics, and whitespace', () => {
    // L\u1eadp B\u00c1O C\u00c1O t\u00e0i ch\u00ednh
    expect(normalizePrompt('  L\u1eadp B\u00c1O C\u00c1O   t\u00e0i ch\u00ednh!  '))
      .toBe('lap bao cao tai chinh')
  })
})

// ─── Bundle routing tests ─────────────────────────────────────────────────────

describe('routeIntent \u2014 accounting_vn', () => {
  const enabled = [GENERAL_OFFICE, ACCOUNTING_VN, FREELANCE_SOLO]

  it('matches via labelVi keyword', () => {
    // Ke toan Viet Nam
    const result = routeIntent('Ke toan Viet Nam cho toi', enabled)
    expect(result.bundleId).toBe('accounting_vn')
    expect(result.matchedKeywords.length).toBeGreaterThan(0)
  })

  it('matches via key token', () => {
    const result = routeIntent('accounting_vn work', enabled)
    expect(result.bundleId).toBe('accounting_vn')
    expect(result.matchedKeywords).toContain('accounting_vn')
    expect(result.matchedVia).toBe('key')
  })

  it('matches via custom intent keyword', () => {
    // Lap bao cao tai chinh quy 3
    const result = routeIntent('Lap bao cao tai chinh quy 3', enabled)
    expect(result.bundleId).toBe('accounting_vn')
    expect(result.matchedKeywords).toContain('bao')
    expect(result.matchedKeywords).toContain('tai')
    expect(result.matchedKeywords).toContain('chinh')
    expect(result.matchedVia).toBe('intent')
  })

  it('multi-keyword \u2192 confidence > 0.5 (3+ hits \u2192 conf 1.0)', () => {
    // Tinh thue VAT cho bao cao tai chinh doanh thu
    const result = routeIntent('tinh thue VAT cho bao cao tai chinh doanh thu', enabled)
    expect(result.bundleId).toBe('accounting_vn')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(3)
  })
})

describe('routeIntent \u2014 freelance_solo', () => {
  const enabled = [GENERAL_OFFICE, ACCOUNTING_VN, FREELANCE_SOLO]

  it('matches via labelVi keyword', () => {
    // Freelancer can hop dong
    const result = routeIntent('Freelancer can hop dong', enabled)
    expect(result.bundleId).toBe('freelance_solo')
    expect(result.matchedKeywords.length).toBeGreaterThan(0)
  })

  it('matches via key token', () => {
    const result = routeIntent('freelance_solo tool', enabled)
    expect(result.bundleId).toBe('freelance_solo')
    expect(result.matchedKeywords).toContain('freelance_solo')
    expect(result.matchedVia).toBe('key')
  })

  it('matches via custom intent keyword', () => {
    // Tao NDA bao mat cho khach hang
    const result = routeIntent('tao NDA bao mat cho khach hang', enabled)
    expect(result.bundleId).toBe('freelance_solo')
    expect(result.matchedKeywords).toContain('nda')
    expect(result.matchedKeywords).toContain('bao')
    expect(result.matchedKeywords).toContain('mat')
  })

  it('multi-keyword \u2192 confidence > 0.5', () => {
    // hop dong freelance thanh toan cong no hoa don
    const result = routeIntent('hop dong freelance thanh toan cong no hoa don', enabled)
    expect(result.bundleId).toBe('freelance_solo')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(3)
  })
})

describe('routeIntent \u2014 general_office (default)', () => {
  const enabled = [GENERAL_OFFICE, ACCOUNTING_VN, FREELANCE_SOLO]

  it('matches via labelVi keyword', () => {
    // van phong tong hop
    const result = routeIntent('van phong tong hop', enabled)
    expect(result.bundleId).toBe('general_office')
    expect(result.matchedKeywords).toContain('van')
    expect(result.matchedKeywords).toContain('phong')
  })

  it('matches via key token', () => {
    const result = routeIntent('general_office', enabled)
    expect(result.bundleId).toBe('general_office')
    expect(result.matchedKeywords).toContain('general_office')
    expect(result.matchedVia).toBe('key')
  })

  it('empty prompt \u2192 fallback to general_office', () => {
    const result = routeIntent('', enabled)
    expect(result.bundleId).toBe('general_office')
    expect(result.matchedKeywords).toEqual([])
    expect(result.confidence).toBe(0)
    expect(result.matchedVia).toBe('labelVi')
  })

  it('no keyword hits \u2192 fallback to general_office', () => {
    const result = routeIntent('xyz unrecognised random words here', enabled)
    expect(result.bundleId).toBe('general_office')
    expect(result.matchedKeywords).toEqual([])
    expect(result.confidence).toBe(0)
  })
})

// ─── Tie-breaking tests ──────────────────────────────────────────────────────

describe('routeIntent \u2014 tie-breaking (deterministic)', () => {
  const emptyA = makeBundle({
    key: 'alpha',
    labelVi: 'Alpha Bundle',
    intents: ['keyword'],
  })
  const emptyB = makeBundle({
    key: 'beta',
    labelVi: 'Beta Bundle',
    intents: ['keyword'],
  })
  const emptyC = makeBundle({
    key: 'gamma',
    labelVi: 'Gamma Bundle',
    intents: ['keyword'],
  })

  it('same hit count \u2192 alphabetical bundle key wins', () => {
    const result = routeIntent('keyword', [emptyB, emptyA, emptyC])
    expect(result.bundleId).toBe('alpha')
  })

  it('same hit count across many bundles \u2192 first alphabetically wins', () => {
    const result = routeIntent('keyword', [emptyC, emptyB, emptyA])
    expect(result.bundleId).toBe('alpha')
  })
})

// ─── Integration: composeBundleSkills with router ───────────────────────────────

describe('composeBundleSkills \u2014 router integration', () => {
  const skillA: WorkBundleSkill = {
    name: 'skill_a',
    description: 'Skill A',
    content: 'Content A',
  }
  const skillB: WorkBundleSkill = {
    name: 'skill_b',
    description: 'Skill B',
    content: 'Content B',
  }
  const skillC: WorkBundleSkill = {
    name: 'skill_c',
    description: 'Skill C',
    content: 'Content C',
  }

  const accBundle = makeBundle({
    key: 'accounting_vn',
    labelVi: 'Ke toan Viet Nam',
    skills: [skillA],
    intents: ['thue'],
  })
  const freelanceBundle = makeBundle({
    key: 'freelance_solo',
    labelVi: 'Freelance',
    skills: [skillB],
    intents: ['freelance'],
  })
  const generalBundle = makeBundle({
    key: 'general_office',
    labelVi: 'Van phong',
    skills: [skillC],
    required: true,
    intents: [],
  })

  it('prompt routes to enabled bundle \u2192 primary (routed to front)', () => {
    // general_office is index 0, freelance_solo is index 1
    const result = composeBundleSkills([generalBundle, freelanceBundle], 'freelance contract')
    // freelance_bundle should be prioritized \u2192 its skill appears first
    expect(result[0]?.name).toBe('skill_b')
    expect(result[1]?.name).toBe('skill_c')
  })

  it('prompt routes to non-enabled bundle \u2192 no change (handled at caller level)', () => {
    // Only general_office is enabled; accounting_vn is NOT in the list
    const result = composeBundleSkills([generalBundle], 'tinh thue VAT')
    // general_office stays in place; no suggestion note from this function
    expect(result[0]?.name).toBe('skill_c')
    expect(result).toHaveLength(1)
  })

  it('backward compat \u2014 no prompt arg \u2192 existing insertion-order behavior', () => {
    const result = composeBundleSkills([accBundle, freelanceBundle])
    // No router reordering \u2014 skills appear in bundle insertion order
    expect(result[0]?.name).toBe('skill_a')
    expect(result[1]?.name).toBe('skill_b')
  })
})
