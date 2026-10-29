/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { recordBundleEvent, getUsageCounts } from '../src/main/bundle-telemetry'

const freshDir = (): string =>
  join(tmpdir(), `bundle-telemetry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)

describe('bundle-telemetry', () => {
  let dir: string

  beforeEach(() => {
    dir = freshDir()
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  // ── Write 3 events → file has 3 lines ──────────────────────────

  it('writes 3 events and file has 3 lines', () => {
    recordBundleEvent(dir, 'accounting_vn', 'enable')
    recordBundleEvent(dir, 'accounting_vn', 'tool_use', { toolName: 'sheets.vn_vat_lookup' })
    recordBundleEvent(dir, 'accounting_vn', 'disable')

    const file = join(dir, 'bundle-usage.jsonl')
    const content = readFileSync(file, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(3)

    const [e1, e2, e3] = lines.map((l) => JSON.parse(l))
    expect(e1.event).toBe('enable')
    expect(e2.event).toBe('tool_use')
    expect(e2.toolName).toBe('sheets.vn_vat_lookup')
    expect(e3.event).toBe('disable')
  })

  // ── getUsageCounts aggregation ──────────────────────────────────

  it('aggregates enable/disable/tool_use counts', () => {
    recordBundleEvent(dir, 'accounting_vn', 'enable')
    recordBundleEvent(dir, 'accounting_vn', 'disable')
    recordBundleEvent(dir, 'accounting_vn', 'enable')
    recordBundleEvent(dir, 'accounting_vn', 'tool_use', { toolName: 'vat' })
    recordBundleEvent(dir, 'accounting_vn', 'tool_use', { toolName: 'tncn' })
    recordBundleEvent(dir, 'accounting_vn', 'tool_use', { toolName: 'vat' })
    recordBundleEvent(dir, 'freelance_solo', 'enable')

    const counts = getUsageCounts(dir)

    expect(counts['accounting_vn']).toEqual({ enable: 2, disable: 1, toolUse: 3 })
    expect(counts['freelance_solo']).toEqual({ enable: 1, disable: 0, toolUse: 0 })
  })

  it('returns zero counts for bundles with no events', () => {
    const counts = getUsageCounts(dir)
    expect(counts).toEqual({})
  })

  it('returns empty object for non-existent file', () => {
    const counts = getUsageCounts('/non/existent/path')
    expect(counts).toEqual({})
  })

  it('skips malformed JSON lines', () => {
    const file = join(dir, 'bundle-usage.jsonl')
    writeFileSync(file, '{"ts":"2026-10-02T00:00:00.000Z","bundleId":"a","event":"enable"}\nnot-json\n{"ts":"2026-10-02T00:00:01.000Z","bundleId":"a","event":"tool_use"}\n', 'utf-8')

    const counts = getUsageCounts(dir)
    expect(counts['a']).toEqual({ enable: 1, disable: 0, toolUse: 1 })
  })

  it('does not throw if file read fails (fail-soft)', () => {
    // Non-readable file — should return empty, not throw
    const counts = getUsageCounts('/root/bundle-usage.jsonl')
    expect(counts).toEqual({})
  })

  // ── File rotation ───────────────────────────────────────────────

  it('rotates file when exceeding 10MB', () => {
    const file = join(dir, 'bundle-usage.jsonl')
    const rotated = file + '.1'

    // Write a file that is exactly at the 10MB boundary (we'll trigger rotation on the next write)
    // We write 10MB exactly — the >= check will catch it
    const tenMB = 10 * 1024 * 1024
    writeFileSync(file, 'a'.repeat(tenMB), 'utf-8')

    recordBundleEvent(dir, 'accounting_vn', 'enable')

    // Main file should now be fresh (just the new entry)
    const content = readFileSync(file, 'utf-8')
    expect(content.trim()).toContain('"event":"enable"')

    // Rotated backup should exist with old content (a*.10MB)
    expect(() => {
      const rotatedContent = readFileSync(rotated, 'utf-8')
      return rotatedContent.length
    }).not.toThrow()
    const rotatedLen = readFileSync(rotated, 'utf-8').length
    expect(rotatedLen).toBe(tenMB)
  })
})
