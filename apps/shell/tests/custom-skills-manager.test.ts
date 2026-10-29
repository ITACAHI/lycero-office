/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import { describe, expect, it } from 'vitest'
import { CustomSkillsManager } from '../src/main/skills/custom-skills-manager'

describe('CustomSkillsManager', () => {
  it('loads built-in preset skills by default', () => {
    const manager = new CustomSkillsManager()
    const skills = manager.listSkills()
    expect(skills.length).toBeGreaterThanOrEqual(4)

    const legalSkill = skills.find((s) => s.id === 'tham-dinh-hop-dong')
    expect(legalSkill).toBeDefined()
    expect(legalSkill?.category).toBe('corporate')
    expect(legalSkill?.builtIn).toBe(true)

    const edtechSkill = skills.find((s) => s.id === 'khbd-gdpt-2018')
    expect(edtechSkill).toBeDefined()
    expect(edtechSkill?.category).toBe('edtech')

    const academicSkill = skills.find((s) => s.id === 'de-cuong-nckh-scopus')
    expect(academicSkill).toBeDefined()
    expect(academicSkill?.category).toBe('academic')
  })

  it('aggregates system prompts for active skills in getActiveSkillsContext()', () => {
    const manager = new CustomSkillsManager()
    const context = manager.getActiveSkillsContext()
    expect(context).toContain('CÁC BỘ KỸ NĂNG CHUYÊN MÔN NGƯỜI DÙNG ĐÃ KÍCH HOẠT')
    expect(context).toContain('Thẩm Định Hợp Đồng Kinh Tế')
    expect(context).toContain('Soạn Kế Hoạch Bài Dạy Chuẩn GDPT 2018')
  })

  it('allows saving and toggling custom skills', () => {
    const manager = new CustomSkillsManager()
    const custom = manager.saveSkill({
      name: 'test-custom-skill',
      title: 'Kỹ Năng Kiểm Thử Tự Động',
      description: 'Mô tả kỹ năng kiểm thử',
      category: 'general',
      systemPrompt: 'Quy tắc kiểm thử chuyên sâu cho Lycero Mate',
      triggers: ['test', 'kiemthu'],
    })
    expect(custom.id).toBeDefined()
    expect(custom.enabled).toBe(true)

    const list = manager.listSkills()
    expect(list.some((s) => s.id === custom.id)).toBe(true)

    // Toggle off
    const toggledOff = manager.toggleSkill(custom.id, false)
    expect(toggledOff).toBe(true)
    expect(manager.listSkills().find((s) => s.id === custom.id)?.enabled).toBe(false)

    // Delete
    const deleted = manager.deleteSkill(custom.id)
    expect(deleted).toBe(true)
    expect(manager.listSkills().some((s) => s.id === custom.id)).toBe(false)
  })
})
