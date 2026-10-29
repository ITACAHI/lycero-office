/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openPptx } from '@lycero/pptx-engine'
import {
  createPedagogicalTemplate,
  fetchCloudTemplates,
  resetCloudTemplatesCache,
} from '../src/main/templates'

describe('Cloud & Local Templates (apps/shell/src/main/templates.ts)', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lycero-templates-test-'))
    process.env.LYCERO_TEMPLATES_CACHE_DIR = tempDir
    resetCloudTemplatesCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    resetCloudTemplatesCache()
    delete process.env.LYCERO_TEMPLATES_CACHE_DIR
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('builds 6-slide 16:9 PPTX decks locally when offline (slide-su-pham & pitch-deck-pptx)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const res1 = await createPedagogicalTemplate('slide-su-pham', tempDir, () => {})
    expect(res1.filePath).toBeDefined()
    const opened1 = await openPptx(new Uint8Array(readFileSync(res1.filePath!)))
    expect(opened1.deck.slides).toHaveLength(6)

    const res2 = await createPedagogicalTemplate('pitch-deck-pptx', tempDir, () => {})
    expect(res2.filePath).toBeDefined()
    const opened2 = await openPptx(new Uint8Array(readFileSync(res2.filePath!)))
    expect(opened2.deck.slides).toHaveLength(6)
  })

  it('builds cong-van-nd30 (HTML doc) and bang-luong-3p (.xlsx) locally when offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const openedDocs: Array<{ title: string; html: string }> = []

    const docRes = await createPedagogicalTemplate('cong-van-nd30', tempDir, (doc) => {
      openedDocs.push(doc)
    })
    expect(docRes.filePath).toBeUndefined()
    expect(openedDocs).toHaveLength(1)
    expect(openedDocs[0]?.title).toContain('Nghị định 30')
    expect(openedDocs[0]?.html).toContain('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')

    const sheetRes = await createPedagogicalTemplate('bang-luong-3p', tempDir, () => {})
    expect(sheetRes.filePath).toMatch(/\.xlsx$/)
  })

  it('syncs Cloud Templates from GET /api/v1/office/templates, caches to disk, and prefers Cloud payload', async () => {
    const cloudTemplates = [
      {
        id: 'cong-van-nd30',
        title: 'Công văn Nghị định 30 (Bản Cloud Mới)',
        format: 'docx' as const,
        html: '<h1>CÔNG VĂN CLOUD CẬP NHẬT TỪ ADMIN PANEL</h1><p>Nội dung chuẩn mới.</p>',
      },
    ]

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ templates: cloudTemplates }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const synced = await fetchCloudTemplates('https://lycero.com')
    expect(synced).toHaveLength(1)
    expect(synced[0]?.id).toBe('cong-van-nd30')

    const openedDocs: Array<{ title: string; html: string }> = []
    await createPedagogicalTemplate('cong-van-nd30', tempDir, (doc) => {
      openedDocs.push(doc)
    })
    expect(openedDocs).toHaveLength(1)
    expect(openedDocs[0]?.title).toBe('Công văn Nghị định 30 (Bản Cloud Mới)')
    expect(openedDocs[0]?.html).toContain('CÔNG VĂN CLOUD CẬP NHẬT TỪ ADMIN PANEL')

    // Now simulate offline and verify disk cache fallback works
    resetCloudTemplatesCache()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const cached = await fetchCloudTemplates('https://lycero.com')
    expect(cached).toHaveLength(1)
    expect(cached[0]?.title).toBe('Công văn Nghị định 30 (Bản Cloud Mới)')
  })
})
