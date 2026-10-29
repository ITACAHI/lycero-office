/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AiGatewayService,
  defaultAiGatewayService,
  DEFAULT_LYCERO_GATEWAY_URL,
} from '../src/ai-gateway'

describe('AiGatewayService', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('initializes with default gateway endpoints', () => {
    const service = new AiGatewayService()
    expect(service).toBeDefined()
    expect(defaultAiGatewayService).toBeDefined()
  })

  it('fetches capabilities and caches them', async () => {
    const mockCapabilities = {
      version: '2.5.0',
      skills: [
        {
          slug: 'lycero-office',
          name: 'Bộ Kỹ năng Soạn thảo Văn phòng Lycero',
          description: 'Hỗ trợ biên soạn tài liệu',
          category: 'Văn phòng',
          version: '2.5.0',
        },
      ],
      mcpEndpoints: [
        {
          serverKey: 'docx-core',
          name: 'Động cơ Word',
          tools: [{ name: 'docx_manipulate', description: 'Biên tập docx' }],
        },
      ],
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCapabilities,
    }) as unknown as typeof fetch

    const service = new AiGatewayService({
      gatewayBaseUrl: 'https://lycero.com',
    })

    const result = await service.fetchCapabilities({ forceRefresh: true })
    expect(result.ok).toBe(true)
    expect(result.skills.length).toBe(1)
    expect(result.skills[0]!.slug).toBe('lycero-office')
    expect(result.mcpEndpoints.length).toBe(1)
  })

  it('streams chat completion over SSE and parses reasoning deltas', async () => {
    const encoder = new TextEncoder()
    const sseChunks = [
      'data: {"choices":[{"delta":{"reasoning_content":"Suy nghĩ logic..."}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Kính gửi Quý cơ quan,"}}]}\n\n',
      'data: [DONE]\n\n',
    ]

    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    }) as unknown as typeof fetch

    const service = new AiGatewayService({
      gatewayBaseUrl: 'https://lycero.com',
    })

    const chunksReceived: Array<{ text: string; delta: string; reasoningDelta?: string }> = []
    let completedText = ''

    await new Promise<void>((resolve, reject) => {
      service.streamChatCompletion(
        {
          messages: [{ role: 'user', content: 'Soạn văn bản' }],
        },
        (chunk) => {
          chunksReceived.push(chunk)
        },
        (fullText) => {
          completedText = fullText
          resolve()
        },
        (err) => {
          reject(err)
        },
      )
    })

    expect(chunksReceived.length).toBeGreaterThanOrEqual(2)
    expect(chunksReceived[0]!.reasoningDelta).toBe('Suy nghĩ logic...')
    expect(completedText).toBe('Kính gửi Quý cơ quan,')
  })

  it('executes reverse proxy tool successfully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: { status: 'inserted', tableId: 'tbl_1' },
      }),
    }) as unknown as typeof fetch

    const service = new AiGatewayService({
      gatewayBaseUrl: 'https://lycero.com',
    })

    const res = await service.executeProxyTool('docx-core', 'docx_manipulate', {
      action: 'insert_table',
    })

    expect(res.ok).toBe(true)
    expect((res.result as { status: string }).status).toBe('inserted')
  })

  describe('direct MCP with proxy fallback', () => {
    // Capabilities exactly as the Hub serves them: real mcp.lycero.com URLs.
    const caps = {
      version: '2.5.0',
      skills: [],
      mcpEndpoints: [
        {
          serverKey: 'web-grounding-search',
          name: 'Tìm kiếm tri thức',
          endpointUrl: 'https://mcp.lycero.com/search/v1',
          transport: 'streamable_http' as const,
          tools: [{ name: 'lookup_curriculum' }],
        },
        {
          serverKey: 'org-private',
          name: 'Máy chủ riêng của tổ chức',
          endpointUrl: 'https://mcp.internal.example/v1',
          tools: [{ name: 'secret_tool' }],
        },
      ],
    }

    /**
     * One fetch stub covering all three hosts, recording every URL hit so a test
     * can assert which path was taken.
     */
    function installFetch(handlers: {
      direct?: () => Promise<Response>
      proxy?: () => Promise<Response>
    }): string[] {
      const seen: string[] = []
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        seen.push(url)
        if (url.includes('/capabilities')) {
          return { ok: true, json: async () => caps } as unknown as Response
        }
        if (url.includes('/tools/execute')) {
          return handlers.proxy
            ? handlers.proxy()
            : ({ ok: true, json: async () => ({ ok: true, result: null }) } as unknown as Response)
        }
        if (handlers.direct) return handlers.direct()
        throw new Error('ECONNRESET')
      }) as unknown as typeof fetch
      return seen
    }

    async function primedService(): Promise<AiGatewayService> {
      const service = new AiGatewayService({
        gatewayBaseUrl: 'https://lycero.com',
        getAccessToken: () => 'valid-token',
      })
      await service.fetchCapabilities()
      return service
    }

    it('calls the direct MCP endpoint when the Hub published one', async () => {
      const seen = installFetch({
        direct: async () =>
          ({
            ok: true,
            json: async () => ({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: 'Kết quả tìm kiếm' }] },
            }),
          }) as unknown as Response,
      })

      const res = await (await primedService()).executeTool(
        'web-grounding-search',
        'lookup_curriculum',
        { query: 'chương trình Toán 8' },
      )

      expect(res.ok).toBe(true)
      expect(res.result).toBe('Kết quả tìm kiếm')
      // Direct hit, so the reverse proxy must not appear in the call log.
      expect(seen).toContain('https://mcp.lycero.com/search/v1')
      expect(seen.some((u) => u.includes('/tools/execute'))).toBe(false)
    })

    it('falls back to the reverse proxy when the direct call fails', async () => {
      const seen = installFetch({
        // No direct handler: the stub throws for the MCP host.
        proxy: async () =>
          ({
            ok: true,
            json: async () => ({ ok: true, result: { status: 'proxied' } }),
          }) as unknown as Response,
      })

      const res = await (await primedService()).executeTool(
        'web-grounding-search',
        'lookup_curriculum',
        { query: 'x' },
      )

      expect(res.ok).toBe(true)
      expect((res.result as { status: string }).status).toBe('proxied')
      expect(seen.some((u) => u.includes('/tools/execute'))).toBe(true)
    })

    it('never contacts an org-private MCP host directly', async () => {
      const seen = installFetch({
        direct: async () =>
          ({ ok: true, json: async () => ({ ok: true, result: 'leak' }) }) as unknown as Response,
        proxy: async () =>
          ({ ok: true, json: async () => ({ ok: true, result: { status: 'proxied' } }) }) as unknown as Response,
      })

      const res = await (await primedService()).executeTool('org-private', 'secret_tool', {})

      expect(seen).not.toContain('https://mcp.internal.example/v1')
      expect((res.result as { status: string }).status).toBe('proxied')
    })
  })
})
