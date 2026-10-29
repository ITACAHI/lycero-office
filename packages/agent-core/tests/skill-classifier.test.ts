/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { describe, expect, it } from 'vitest'
import {
  CloudCapabilitiesManager,
  DEFAULT_CLOUD_SKILL_CATALOG,
  classifySkillsForContext,
} from '../src/index'

describe('classifySkillsForContext & CloudCapabilitiesManager', () => {
  it('exposes the full built-in Cloud Skill catalog before network sync', () => {
    const manager = new CloudCapabilitiesManager()
    const catalog = manager.getCatalogSkills()
    expect(catalog.length).toBeGreaterThanOrEqual(DEFAULT_CLOUD_SKILL_CATALOG.length)
    expect(catalog.some((s) => s.slug === 'vn-admin-nd30')).toBe(true)
    expect(catalog.some((s) => s.slug === 'edtech-lesson-5512')).toBe(true)
    expect(catalog.some((s) => s.slug === 'hr-payroll-3p')).toBe(true)
    expect(catalog.some((s) => s.slug === 'data-analyst')).toBe(true)
  })

  it('classifies administrative Decree 30 requests in Docs', () => {
    const slugs = classifySkillsForContext({
      prompt: 'Soạn tờ trình xin phê duyệt kinh phí theo chuẩn Nghị định 30',
      editorModule: 'office_docx',
      pipelineStage: 'doc_longform',
    })
    expect(slugs).toContain('pipeline-doc-writer')
    expect(slugs).toContain('vn-admin-nd30')
  })

  it('classifies EdTech 5512 lesson plan and Bloom exam matrix requests', () => {
    const lessonSlugs = classifySkillsForContext({
      prompt: 'Thiết kế giáo án kế hoạch bài dạy Công văn 5512 môn Toán 10',
      editorModule: 'office_docx',
    })
    expect(lessonSlugs).toContain('edtech-lesson-5512')

    const examSlugs = classifySkillsForContext({
      prompt: 'Lập ma trận đề kiểm tra giữa kỳ 1 theo thang Bloom và Công văn 7991',
      editorModule: 'office_docx',
    })
    expect(examSlugs).toContain('edtech-exam-matrix')
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
})
