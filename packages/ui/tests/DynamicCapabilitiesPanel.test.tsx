/** @vitest-environment jsdom */
/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { DynamicCapabilitiesPanel } from '../src/DynamicCapabilitiesPanel'
import type { CloudSkillManifest } from '@lycero/agent-core'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

const mockSkills: CloudSkillManifest[] = [
  {
    slug: 'pedagogical-lesson-plan',
    name: 'Soạn thảo Kế hoạch Bài dạy (Công văn 5512)',
    description: 'Xây dựng kế hoạch giảng dạy theo chuẩn Bộ GD&ĐT.',
    category: 'Sư phạm & Giáo dục',
    version: '1.0.0',
    clientConfigSchema: [
      {
        id: 'detail_level',
        label: 'Mức độ chi tiết',
        type: 'select',
        defaultValue: 'standard',
        options: [
          { label: 'Cô đọng', value: 'concise' },
          { label: 'Chi tiết', value: 'standard' },
        ],
      },
      {
        id: 'include_rubric',
        label: 'Bảng tiêu chí đánh giá (Rubric)',
        type: 'boolean',
        defaultValue: true,
      },
      {
        id: 'creativity',
        label: 'Độ sáng tạo hoạt động khởi động',
        type: 'slider',
        defaultValue: 3,
        min: 1,
        max: 5,
        step: 1,
      },
    ],
  },
]

describe('DynamicCapabilitiesPanel', () => {
  it('renders skill cards and active status badge', () => {
    act(() => {
      root.render(
        createElement(DynamicCapabilitiesPanel, {
          skills: mockSkills,
          activeSkillSlugs: ['pedagogical-lesson-plan'],
          skillConfigs: {
            'pedagogical-lesson-plan': { detail_level: 'standard', include_rubric: true, creativity: 3 },
          },
          onToggleSkill: vi.fn(),
          onChangeConfig: vi.fn(),
          onRefreshSkills: vi.fn(),
        }),
      )
    })

    expect(host.textContent).toContain('Kỹ năng Trợ lý Đám mây')
    expect(host.textContent).toContain('Đang áp dụng Kỹ năng (1)')
    expect(host.textContent).toContain('Soạn thảo Kế hoạch Bài dạy (Công văn 5512)')
    expect(host.textContent).toContain('Sư phạm & Giáo dục')
  })

  it('renders offline banner with refined Vietnamese notice when isOffline is true', () => {
    act(() => {
      root.render(
        createElement(DynamicCapabilitiesPanel, {
          skills: mockSkills,
          activeSkillSlugs: [],
          skillConfigs: {},
          isOffline: true,
          onToggleSkill: vi.fn(),
          onChangeConfig: vi.fn(),
          onRefreshSkills: vi.fn(),
        }),
      )
    })

    expect(host.textContent).toContain(
      'Đang làm việc ngoại tuyến, tính năng trợ lý thông minh sẽ tiếp tục khi có kết nối trở lại.',
    )
  })

  it('triggers onToggleSkill when switch is toggled', () => {
    const onToggle = vi.fn()
    act(() => {
      root.render(
        createElement(DynamicCapabilitiesPanel, {
          skills: mockSkills,
          activeSkillSlugs: [],
          skillConfigs: {},
          onToggleSkill: onToggle,
          onChangeConfig: vi.fn(),
          onRefreshSkills: vi.fn(),
        }),
      )
    })

    const switchInput = host.querySelector('input[type="checkbox"][role="switch"]') as HTMLInputElement
    expect(switchInput).not.toBeNull()
    act(() => {
      switchInput.click()
    })

    expect(onToggle).toHaveBeenCalledWith('pedagogical-lesson-plan', true)
  })

  it('renders dynamic config controls when skill is active and triggers onChangeConfig', () => {
    const onChangeConfig = vi.fn()
    act(() => {
      root.render(
        createElement(DynamicCapabilitiesPanel, {
          skills: mockSkills,
          activeSkillSlugs: ['pedagogical-lesson-plan'],
          skillConfigs: {
            'pedagogical-lesson-plan': { detail_level: 'standard', include_rubric: true, creativity: 3 },
          },
          onToggleSkill: vi.fn(),
          onChangeConfig,
          onRefreshSkills: vi.fn(),
        }),
      )
    })

    expect(host.textContent).toContain('Tùy biến Kỹ năng')
    expect(host.textContent).toContain('Mức độ chi tiết')
    expect(host.textContent).toContain('Bảng tiêu chí đánh giá (Rubric)')
    expect(host.textContent).toContain('Độ sáng tạo hoạt động khởi động')

    // Test select change
    const select = host.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    act(() => {
      select.value = 'concise'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChangeConfig).toHaveBeenCalledWith('pedagogical-lesson-plan', 'detail_level', 'concise')

    // Test slider change
    const slider = host.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider).not.toBeNull()
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set
      nativeSetter?.call(slider, '4')
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      slider.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChangeConfig).toHaveBeenCalledWith('pedagogical-lesson-plan', 'creativity', 4)
  })

  it('triggers onRefreshSkills when refresh button is clicked', () => {
    const onRefresh = vi.fn()
    act(() => {
      root.render(
        createElement(DynamicCapabilitiesPanel, {
          skills: mockSkills,
          activeSkillSlugs: [],
          skillConfigs: {},
          onToggleSkill: vi.fn(),
          onChangeConfig: vi.fn(),
          onRefreshSkills: onRefresh,
        }),
      )
    })

    const refreshBtn = host.querySelector('.lycero-cap-refresh-btn') as HTMLButtonElement
    expect(refreshBtn).not.toBeNull()
    act(() => {
      refreshBtn.click()
    })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
