/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  CloudCapabilitiesManager,
  OFFLINE_CAPABILITIES_MESSAGE,
  type CapabilitiesStorage,
  type CloudCapabilitiesResponse,
} from '../src/cloud-capabilities'
import { CloudToolDispatcher, createCloudProxySkill } from '../src/cloud-tool-dispatcher'

class TestStorage implements CapabilitiesStorage {
  private readonly store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('CloudCapabilitiesManager', () => {
  let storage: TestStorage

  const mockResponse: CloudCapabilitiesResponse = {
    skills: [
      {
        slug: 'pedagogical-lesson-plan',
        name: 'Soạn thảo Kế hoạch Bài dạy (Công văn 5512)',
        description: 'Tự động xây dựng tiến trình dạy học chuẩn mực theo khung 5512 của Bộ GD&ĐT.',
        category: 'Sư phạm & Giáo dục',
        version: '2.1.0',
        clientConfigSchema: [
          {
            id: 'detail_level',
            label: 'Mức độ chi tiết',
            type: 'select',
            defaultValue: 'standard',
            options: [
              { label: 'Cô đọng, trọng tâm', value: 'concise' },
              { label: 'Chuẩn mực, chi tiết', value: 'standard' },
              { label: 'Mở rộng, nâng cao', value: 'extended' },
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
        tools: [
          {
            name: 'format_lesson_plan',
            description: 'Định dạng bảng phân chia hoạt động học theo 5512',
            inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
          },
        ],
      },
    ],
    mcpEndpoints: [
      {
        serverKey: 'edu-reference',
        name: 'Tra cứu Học liệu Bộ GD&ĐT',
        tools: [
          {
            name: 'lookup_curriculum_standard',
            description: 'Tra cứu chuẩn đầu ra chương trình 2018',
            inputSchema: { type: 'object', properties: { subject: { type: 'string' } } },
          },
        ],
      },
    ],
  }

  beforeEach(() => {
    storage = new TestStorage()
    vi.restoreAllMocks()
  })

  it('loads cached capabilities immediately on startup without network delay', async () => {
    storage.setItem('lycero_cloud_capabilities_manifest', JSON.stringify(mockResponse))
    storage.setItem('lycero_cloud_skills_active', JSON.stringify(['pedagogical-lesson-plan']))

    const manager = new CloudCapabilitiesManager({ storage })
    const loaded = await manager.loadFromCache()

    expect(loaded).toBe(true)
    expect(manager.getSkills().length).toBe(1)
    expect(manager.getSkills()[0]?.name).toBe('Soạn thảo Kế hoạch Bài dạy (Công văn 5512)')
    expect(manager.isSkillActive('pedagogical-lesson-plan')).toBe(true)
    expect(manager.getActiveSkillSlugs()).toEqual(['pedagogical-lesson-plan'])
  })

  it('syncs capabilities from Cloud Gateway and saves to persistent storage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    })
    vi.stubGlobal('fetch', fetchMock)

    const manager = new CloudCapabilitiesManager({
      gatewayUrl: 'https://lycero.com/api/v1/office/desktop/capabilities',
      storage,
    })

    const result = await manager.syncCapabilities({ token: 'test-token' })

    expect(result.ok).toBe(true)
    expect(result.fromCache).toBe(false)
    expect(result.skills.length).toBe(1)
    expect(manager.getMcpEndpoints().length).toBe(1)

    // Check storage persistence
    const saved = storage.getItem('lycero_cloud_capabilities_manifest')
    expect(saved).not.toBeNull()
    expect(JSON.parse(saved!)).toEqual(mockResponse)

    // Check defaults were seeded
    const config = manager.getUserSkillConfig('pedagogical-lesson-plan') as Record<string, unknown>
    expect(config.detail_level).toBe('standard')
    expect(config.include_rubric).toBe(true)
    expect(config.creativity).toBe(3)
  })

  it('handles offline state by returning cached capabilities and refined Vietnamese notification', async () => {
    storage.setItem('lycero_cloud_capabilities_manifest', JSON.stringify(mockResponse))

    // Simulate offline
    vi.stubGlobal('navigator', { onLine: false })

    const manager = new CloudCapabilitiesManager({ storage })
    const result = await manager.syncCapabilities()

    expect(result.ok).toBe(true)
    expect(result.fromCache).toBe(true)
    expect(result.message).toBe(OFFLINE_CAPABILITIES_MESSAGE)
    expect(result.skills.length).toBe(1)
  })

  it('manages skill active state and custom user configurations', async () => {
    storage.setItem('lycero_cloud_capabilities_manifest', JSON.stringify(mockResponse))
    const manager = new CloudCapabilitiesManager({ storage })
    await manager.loadFromCache()

    const subscriber = vi.fn()
    manager.subscribe(subscriber)

    await manager.setSkillActive('pedagogical-lesson-plan', true)
    expect(manager.isSkillActive('pedagogical-lesson-plan')).toBe(true)
    expect(subscriber).toHaveBeenCalled()

    await manager.setSkillConfigValue('pedagogical-lesson-plan', 'detail_level', 'extended')
    const config = manager.getUserSkillConfig('pedagogical-lesson-plan') as Record<string, unknown>
    expect(config.detail_level).toBe('extended')

    // Persisted to storage
    const storedConfig = JSON.parse(storage.getItem('lycero_cloud_skills_config')!)
    expect(storedConfig['pedagogical-lesson-plan'].detail_level).toBe('extended')
  })
})

describe('CloudToolDispatcher & createCloudProxySkill', () => {
  it('dispatches tool calls through Cloud Reverse Proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: { formatted: true, title: 'Kế hoạch Bài dạy Toán 10' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const dispatcher = new CloudToolDispatcher({
      gatewayUrl: 'https://lycero.com/api/v1/office/desktop/tools/execute',
      getAccessToken: () => 'bearer-token-123',
    })

    const execution = await dispatcher.executeTool({
      serverKey: 'edu-reference',
      toolName: 'lookup_curriculum_standard',
      arguments: { subject: 'Toán' },
    })

    expect(execution.isError).toBe(false)
    expect(execution.output).toContain('Kế hoạch Bài dạy Toán 10')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://lycero.com/api/v1/office/desktop/tools/execute',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer bearer-token-123',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('handles tool execution failures with elegant Vietnamese messaging', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })
    vi.stubGlobal('fetch', fetchMock)

    const dispatcher = new CloudToolDispatcher()
    const execution = await dispatcher.executeTool({
      serverKey: 'test',
      toolName: 'sample_tool',
      arguments: {},
    })

    expect(execution.isError).toBe(true)
    expect(execution.output).toBe('Không thể kết nối tới dịch vụ xử lý công cụ trên Cổng Trí tuệ Lycero.')
    expect(execution.output).not.toContain('500')
    expect(execution.output).not.toContain('Exception')
  })

  it('createCloudProxySkill constructs an AgentSkill with Opaque Manifest (empty systemPrompt)', async () => {
    const dispatcher = new CloudToolDispatcher()
    const skill = createCloudProxySkill({
      id: 'cloud-test',
      skills: [
        {
          slug: 'test-skill',
          name: 'Kỹ năng mẫu',
          description: 'Mô tả mẫu',
          category: 'Chung',
          version: '1.0.0',
          tools: [
            {
              name: 'cloud_format_text',
              description: 'Định dạng văn bản',
              inputSchema: { type: 'object' },
            },
          ],
        },
      ],
      dispatcher,
    })

    expect(skill.id).toBe('cloud-test')
    // Client NEVER contains secret prompts
    expect(skill.systemPrompt).toBe('')
    expect(skill.tools.length).toBe(1)
    expect(skill.tools[0]?.name).toBe('cloud_format_text')
  })

  it('deduplicates against local editor tools while preserving specialized Cloud Tools', () => {
    const dispatcher = new CloudToolDispatcher()
    const skill = createCloudProxySkill({
      id: 'cloud-dedup',
      skills: () => [
        {
          slug: 'cloud-office-suite',
          name: 'Bộ công cụ Cloud',
          description: 'Cloud tools',
          category: 'Chung',
          version: '1.0.0',
          tools: [
            {
              name: 'write_document',
              description: 'Duplicate local doc tool (must be skipped)',
              inputSchema: { type: 'object' },
            },
            {
              name: 'propose_operations',
              description: 'Duplicate local slide tool (must be skipped)',
              inputSchema: { type: 'object' },
            },
            {
              name: 'docx_manipulate',
              description: 'Specialized cloud docx tool',
              inputSchema: { type: 'object' },
            },
            {
              name: 'pptx_render_audit',
              description: 'Specialized cloud slide audit tool',
              inputSchema: { type: 'object' },
            },
          ],
        },
      ],
      endpoints: () => [
        {
          serverKey: 'legal-vn',
          name: 'Tra cứu Pháp luật',
          tools: [
            {
              name: 'generate_deck',
              description: 'Duplicate local deck tool (must be skipped)',
              inputSchema: { type: 'object' },
            },
            {
              name: 'search_legal_docs',
              description: 'Tra cứu văn bản quy phạm pháp luật',
              inputSchema: { type: 'object' },
            },
            {
              name: 'python_calc_exec',
              description: 'Chạy tính toán Python trên Cloud',
              inputSchema: { type: 'object' },
            },
            {
              name: 'chart_svg_render',
              description: 'Kết xuất biểu đồ SVG trên Cloud',
              inputSchema: { type: 'object' },
            },
          ],
        },
      ],
      dispatcher,
    })

    const toolNames = skill.tools.map((t) => t.name)
    expect(toolNames).not.toContain('write_document')
    expect(toolNames).not.toContain('propose_operations')
    expect(toolNames).not.toContain('generate_deck')
    expect(toolNames).toEqual([
      'docx_manipulate',
      'pptx_render_audit',
      'search_legal_docs',
      'python_calc_exec',
      'chart_svg_render',
    ])
  })
})
