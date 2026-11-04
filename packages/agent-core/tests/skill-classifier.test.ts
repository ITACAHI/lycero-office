/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  ADVANCED_CLOUD_SKILL_SLUGS,
  BASIC_BUNDLED_SKILL_SLUGS,
  CloudCapabilitiesManager,
  DEFAULT_CLOUD_SKILL_CATALOG,
  HIDDEN_OR_MERGED_SKILL_SLUGS,
  SKILL_SLUG_ALIAS_MAP,
  classifySkillsForContext,
  fetchCloudSkillCatalog,
  getMergedSkillRedirectNotice,
  isAdvancedCloudSkill,
  isBasicBundledSkill,
  parseSkillFrontmatter,
  resetCloudSkillCatalogCache,
  resolveCanonicalSkillSlug,
} from '../src/index'

describe('classifySkillsForContext & CloudCapabilitiesManager', () => {
  it('exposes the full 190-skill built-in Cloud Skill catalog before network sync (FX-24)', () => {
    const manager = new CloudCapabilitiesManager()
    const catalog = manager.getCatalogSkills()
    expect(catalog.length).toBeGreaterThanOrEqual(190)
    expect(catalog.length).toBeGreaterThanOrEqual(DEFAULT_CLOUD_SKILL_CATALOG.length)
    expect(catalog.some((s) => s.slug === 'vn-admin-doc-nd30')).toBe(true)
    expect(catalog.some((s) => s.slug === 'vn-gdpt2018-lesson-plan-cv5512')).toBe(true)
    expect(catalog.some((s) => s.slug === 'vn-exam-matrix-specification-tt22')).toBe(true)
    expect(catalog.some((s) => s.slug === 'vn-corporate-accounting-tt200-tt133')).toBe(true)
    expect(catalog.some((s) => s.slug === 'hr-payroll-3p')).toBe(true)
    expect(catalog.some((s) => s.slug === 'data-analyst')).toBe(true)
    for (const item of catalog) {
      expect(HIDDEN_OR_MERGED_SKILL_SLUGS.has(item.slug)).toBe(false)
    }
  })

  it('resolves legacy skill aliases to canonical slugs (FX-24, FX-25)', () => {
    expect(resolveCanonicalSkillSlug('vn-admin-nd30')).toBe('vn-admin-doc-nd30')
    expect(resolveCanonicalSkillSlug('edtech-lesson-5512')).toBe('vn-gdpt2018-lesson-plan-cv5512')
    expect(resolveCanonicalSkillSlug('edtech-exam-matrix')).toBe(
      'vn-exam-matrix-specification-tt22',
    )
    expect(resolveCanonicalSkillSlug('vn-periodic-exam-7991-true-false-short-answer')).toBe(
      'vn-exam-matrix-specification-tt22',
    )
    expect(resolveCanonicalSkillSlug('vn-tax-accounting-tt200')).toBe(
      'vn-corporate-accounting-tt200-tt133',
    )
    expect(resolveCanonicalSkillSlug('vn-hr-compensation-law')).toBe('hr-payroll-3p')
  })

  it('classifies administrative Decree 30 requests in Docs to vn-admin-doc-nd30 (FX-24)', () => {
    const slugs = classifySkillsForContext({
      prompt: 'Soạn tờ trình xin phê duyệt kinh phí theo chuẩn Nghị định 30',
      editorModule: 'office_docx',
      pipelineStage: 'doc_longform',
    })
    expect(slugs).toContain('pipeline-doc-writer')
    expect(slugs).toContain('vn-admin-doc-nd30')
    expect(slugs).not.toContain('vn-admin-nd30')
  })

  it('classifies EdTech 5512 lesson plan and CV 7991 exam matrix requests to canonical slugs', () => {
    const lessonSlugs = classifySkillsForContext({
      prompt: 'Thiết kế giáo án kế hoạch bài dạy Công văn 5512 môn Toán 10',
      editorModule: 'office_docx',
    })
    expect(lessonSlugs).toContain('vn-gdpt2018-lesson-plan-cv5512')

    const examSlugs = classifySkillsForContext({
      prompt: 'Lập ma trận đề kiểm tra giữa kỳ 1 theo thang Bloom và Công văn 7991',
      editorModule: 'office_docx',
    })
    expect(examSlugs).toContain('vn-exam-matrix-specification-tt22')
  })

  it('bundles ONLY the 51 basic/tool skills locally and zero of the 155 advanced cloud skills (FX-30, FX-43)', () => {
    const recDir = resolve(__dirname, '../../../skills/recommended')
    expect(existsSync(recDir)).toBe(true)
    const entries = readdirSync(recDir).filter((name) => name !== 'locales')
    expect(entries.length).toBe(51)
    expect(BASIC_BUNDLED_SKILL_SLUGS.size).toBe(51)
    expect(ADVANCED_CLOUD_SKILL_SLUGS.size).toBe(155)
    for (const slug of entries) {
      expect(isBasicBundledSkill(slug)).toBe(true)
      expect(isAdvancedCloudSkill(slug)).toBe(false)
      const mdPath = resolve(recDir, slug, 'SKILL.md')
      expect(existsSync(mdPath)).toBe(true)
      const raw = readFileSync(mdPath, 'utf8')
      const fm = parseSkillFrontmatter(raw)
      expect(fm).not.toBeNull()
      expect(raw).not.toContain('[LYCERO_CLOUD_SKILL:')
      expect((fm?.body ?? '').trim().length).toBeGreaterThan(200)
    }
    for (const cloudSlug of [
      'vn-admin-doc-nd30',
      'vn-gdpt2018-lesson-plan-cv5512',
      'vn-exam-matrix-specification-tt22',
      'vn-corporate-accounting-tt200-tt133',
      'hr-payroll-3p',
      'vn-real-estate-sale-transfer-contract-nd96',
    ]) {
      expect(isAdvancedCloudSkill(cloudSlug)).toBe(true)
      expect(existsSync(resolve(recDir, cloudSlug))).toBe(false)
    }
  })

  it('classifies student list / spreadsheet summary requests to data-cleaning and data-analyst', () => {
    const slugs = classifySkillsForContext({
      prompt: 'tóm tắt nội dung danh_sach_hoc_sinh.xls',
      editorModule: 'office_sheet',
    })
    expect(slugs).toContain('data-cleaning')
    expect(slugs).toContain('data-analyst')
  })

  it('classifies 3P payroll and CFO financial statement prompts in Sheets', () => {
    const payrollSlugs = classifySkillsForContext({
      prompt: 'Tính bảng lương 3P, trích BHXH và thuế TNCN tháng 10',
      editorModule: 'office_sheet',
      pipelineStage: 'sheet_formula',
    })
    expect(payrollSlugs).toContain('hr-payroll-3p')

    const cfoSlugs = classifySkillsForContext({
      prompt: 'Phân tích báo cáo tài chính, dòng tiền và biên lợi nhuận EBITDA',
      editorModule: 'office_sheet',
    })
    expect(cfoSlugs).toContain('financial-statement-analysis')
  })

  it('preserves manually attached skills alongside auto-classified skills', () => {
    const slugs = classifySkillsForContext({
      prompt: 'Thiết kế pitch deck gọi vốn cho startup',
      editorModule: 'office_slide',
      pipelineStage: 'slide_outline',
      manualSlugs: ['custom-brand-skill'],
    })
    expect(slugs[0]).toBe('custom-brand-skill')
    expect(slugs).toContain('pipeline-slide-outline')
    expect(slugs).toContain('executive-deck')
  })

  it('classifies statutory administrative, land, tax, primary school and accounting voucher forms', () => {
    expect(
      classifySkillsForContext({
        prompt: 'Soạn tờ khai thay đổi thông tin cư trú đăng ký tạm trú mẫu CT01',
        editorModule: 'office_docx',
      }),
    ).toContain('vn-citizen-residence-ct01-household-forms')

    expect(
      classifySkillsForContext({
        prompt: 'Viết đơn đăng ký biến động đất đai sang tên sổ đỏ mẫu 11/ĐK',
        editorModule: 'office_docx',
      }),
    ).toContain('vn-land-registration-redbook-04dk-11dk')

    expect(
      classifySkillsForContext({
        prompt: 'Lập tờ khai lệ phí trước bạ nhà đất 01/LPTB và đề nghị hoàn thuế 01/ĐNHT',
        editorModule: 'office_docx',
      }),
    ).toContain('vn-tax-declaration-refund-exemption-tt80')

    expect(
      classifySkillsForContext({
        prompt: 'Soạn giáo án tiểu học lớp 4 theo Công văn 2345',
        editorModule: 'office_docx',
      }),
    ).toContain('vn-primary-school-lesson-plan-cv2345')

    expect(
      classifySkillsForContext({
        prompt: 'Lập giấy đề nghị thanh toán mẫu 05-TT và hoàn ứng công tác phí',
        editorModule: 'office_docx',
      }),
    ).toContain('vn-accounting-payment-voucher-forms-tt200')
  })

  it('FX-82: returns merged skill redirect notice when searching by merged slug or alias ("7991", "vn-periodic")', () => {
    const aliases = Object.entries(SKILL_SLUG_ALIAS_MAP)
      .filter(([alias, canonical]) => canonical === 'vn-exam-matrix-specification-tt22' && alias !== 'vn-exam-matrix-specification-tt22')
      .map(([alias]) => alias)

    expect(
      getMergedSkillRedirectNotice('vn-exam-matrix-specification-tt22', aliases, '7991'),
    ).toBe('Đã gộp vào: Ma trận & đặc tả đề (TT22)')

    expect(
      getMergedSkillRedirectNotice('vn-exam-matrix-specification-tt22', aliases, 'vn-periodic'),
    ).toBe('Đã gộp vào: Ma trận & đặc tả đề (TT22)')

    // Searching by canonical slug itself should not show a redirect notice
    expect(
      getMergedSkillRedirectNotice('vn-exam-matrix-specification-tt22', aliases, 'tt22'),
    ).toBeNull()
  })

  it('FX-60: fetches dynamic cloud skill catalog from /api/v1/office/skills with cache and tier locking', async () => {
    resetCloudSkillCatalogCache()
    const origFetch = globalThis.fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [
          {
            slug: 'vn-exam-matrix-specification-tt22',
            name: 'Ma trận & đặc tả đề (TT22)',
            description: 'Thiết kế ma trận đề kiểm tra',
            category: 'education',
            version: '3.4.0',
            tier: 'pro',
          },
          {
            slug: 'lesson-plan',
            name: 'Giáo án cơ bản',
            description: 'Soạn giáo án cơ bản',
            category: 'education',
            version: '3.4.0',
            tier: 'free',
          },
        ],
      }),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    try {
      const freeUserCatalog = await fetchCloudSkillCatalog({
        url: 'https://lycero.com/api/v1/office/skills',
        userTier: 'free',
        forceRefresh: true,
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const proSkill = freeUserCatalog.find((s) => s.slug === 'vn-exam-matrix-specification-tt22')
      const freeSkill = freeUserCatalog.find((s) => s.slug === 'lesson-plan')
      expect(proSkill?.tier).toBe('pro')
      expect(proSkill?.locked).toBe(true)
      expect(freeSkill?.tier).toBe('free')
      expect(freeSkill?.locked).toBe(false)

      // Subsequent call hits in-memory cache without re-fetching
      const proUserCatalog = await fetchCloudSkillCatalog({
        url: 'https://lycero.com/api/v1/office/skills',
        userTier: 'pro',
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const unlockedProSkill = proUserCatalog.find((s) => s.slug === 'vn-exam-matrix-specification-tt22')
      expect(unlockedProSkill?.locked).toBe(false)
    } finally {
      globalThis.fetch = origFetch
      resetCloudSkillCatalogCache()
    }
  })
})
