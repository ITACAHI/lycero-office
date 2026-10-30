/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ReadableStream } from 'stream/web'

// Mock @lycero/ai-auth and @lycero/ai-auth/main to avoid fs-dependent loadLyceroAuth
vi.mock('@lycero/ai-auth', () => ({
  lyceroAccessToken: () => 'mock-token',
  resetLyceroAuthCache: () => {},
  refreshAndGetToken: async () => null,
}))
vi.mock('@lycero/ai-auth/main', () => ({
  lyceroAccessToken: () => 'mock-token',
  resetLyceroAuthCache: () => {},
  refreshAndGetToken: async () => null,
}))

import { MAX_HUB_RECONNECT_ATTEMPTS, streamHubChat } from '../src/protocols/hub-lycero'
import type { StreamCallbacks } from '../src/protocols/shared'

function makeBody(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event + '\n\n'))
      }
      controller.close()
    },
  })
}

function makeCallbacks(overrides?: Partial<StreamCallbacks>): StreamCallbacks {
  return {
    onDelta: vi.fn(),
    onToolCall: vi.fn(),
    onActivity: vi.fn(),
    signal: new AbortController().signal,
    ...overrides,
  }
}

function mockFetch(body: ReadableStream<Uint8Array>) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body,
  } as unknown as Response)
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('streamHubChat SSE parser', () => {
  let controller: AbortController

  beforeEach(() => {
    controller = new AbortController()
    vi.clearAllMocks()
  })

  afterEach(() => {
    controller.abort()
  })

  it('yields 3 text chunks as onDelta calls', async () => {
    const body = makeBody([
      'data: {"type":"start","streamId":"s1","model":"test-model"}',
      'data: {"type":"text","delta":"Hello"}',
      'data: {"type":"text","delta":" world"}',
      'data: {"type":"text","delta":"!"}',
      'data: {"type":"finish","modelUsed":"test-model","usage":{"inputTokens":10,"outputTokens":3}}',
    ])
    mockFetch(body)
    const cb = makeCallbacks({ signal: controller.signal })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'test-model',
      system: '',
      messages: [],
      tools: [],
      cb,
    })

    expect(cb.onDelta).toHaveBeenCalledTimes(3)
    expect((cb.onDelta as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual(['Hello', ' world', '!'])
  })

  it('emits onStopReason on finish event', async () => {
    const body = makeBody([
      'data: {"type":"text","delta":"final answer"}',
      'data: {"type":"finish","modelUsed":"gpt-4","usage":{"inputTokens":5,"outputTokens":2}}',
    ])
    mockFetch(body)
    const cb = makeCallbacks({ onStopReason: vi.fn(), signal: controller.signal })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'gpt-4',
      system: '',
      messages: [],
      tools: [],
      cb,
    })

    expect(cb.onStopReason).toHaveBeenCalledWith('stop')
  })

  it('ignores heartbeat comment lines', async () => {
    const body = makeBody([
      ': heartbeat ping',
      'data: {"type":"text","delta":"hello"}',
      ': another ping',
      'data: {"type":"finish"}',
    ])
    mockFetch(body)
    const cb = makeCallbacks({ signal: controller.signal })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'm',
      system: '',
      messages: [],
      tools: [],
      cb,
    })

    expect(cb.onDelta).toHaveBeenCalledTimes(1)
    expect(cb.onDelta).toHaveBeenCalledWith('hello')
  })

  it('throws on error event', async () => {
    const body = makeBody([
      'data: {"type":"text","delta":"partial"}',
      'data: {"type":"error","message":"model overloaded"}',
    ])
    mockFetch(body)
    const cb = makeCallbacks({ signal: controller.signal })

    await expect(
      streamHubChat({
        url: 'https://hub.lycero.com/api/v1/office',
        modelId: 'm',
        system: '',
        messages: [],
        tools: [],
        cb,
      }),
    ).rejects.toThrow('model overloaded')
  })

  it('throws when stream closes without finish', async () => {
    const body = makeBody([
      'data: {"type":"text","delta":"partial"}',
      // no finish event
    ])
    mockFetch(body)
    const cb = makeCallbacks({ signal: controller.signal })

    await expect(
      streamHubChat({
        url: 'https://hub.lycero.com/api/v1/office',
        modelId: 'm',
        system: '',
        messages: [],
        tools: [],
        cb,
      }),
    ).rejects.toThrow('Stream closed without a finish event')
  })

  it('sends correct request body to /ai/chat', async () => {
    const body = makeBody([ 'data: {"type":"finish"}' ])
    const fetchMock = mockFetch(body)
    const cb = makeCallbacks({ signal: controller.signal })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'lycero-mate-pro',
      system: 'You are helpful.',
      messages: [{ role: 'user', text: 'Hi', images: [] }],
      tools: [],
      cb,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/ai/chat')
    const reqBody = JSON.parse(init.body as string)
    expect(reqBody.productCode).toBe('office')
    expect(reqBody.modelId).toBe('lycero-mate-pro')
    expect(reqBody.stream).toBe(true)
    expect(reqBody.messages).toHaveLength(2) // system + user
  })

  it('uses Bearer token from lyceroAccessToken', async () => {
    const body = makeBody([ 'data: {"type":"finish"}' ])
    const fetchMock = mockFetch(body)
    const cb = makeCallbacks({ signal: controller.signal })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'm',
      system: '',
      messages: [],
      tools: [],
      cb,
    })

    const [, init] = fetchMock.mock.calls[0]!
    expect(init.headers['Authorization']).toBe('Bearer mock-token')
  })

  it('masks PII in outbound messages and passes activeSkillSlugs + userSkillConfig', async () => {
    const body = makeBody([
      'data: {"type":"text","delta":"Chào [PII_PHONE_1]"}',
      'data: {"type":"finish"}',
    ])
    const fetchMock = mockFetch(body)
    const cb = makeCallbacks({ signal: controller.signal })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'lycero-mate-pro',
      system: 'Hệ thống bảo mật',
      messages: [{ role: 'user', text: 'Số của tôi là 0912345678', images: [] }],
      tools: [],
      cb,
      activeSkillSlugs: ['pedagogical-lesson-plan'],
      userSkillConfig: { 'pedagogical-lesson-plan': { detail_level: 'extended' } },
    })

    const [, init] = fetchMock.mock.calls[0]!
    const reqBody = JSON.parse(init.body as string)

    // User message must be masked in outbound request!
    expect(reqBody.messages[1].content).not.toContain('0912345678')
    expect(reqBody.messages[1].content).toContain('[PII_PHONE_')

    // Skills payload must match Gateway B specification
    expect(reqBody.activeSkillSlugs).toEqual(['pedagogical-lesson-plan'])
    expect(reqBody.userSkillConfig).toEqual({
      'pedagogical-lesson-plan': { detail_level: 'extended' },
    })

    // On delta receive, PII token must be restored to original 0912345678!
    expect(cb.onDelta).toHaveBeenCalledWith('Chào 0912345678')
  })

  it('handles reasoning and tool_call SSE events', async () => {
    const body = makeBody([
      'data: {"type":"reasoning","delta":"Đang phân tích cấu trúc 5512..."}',
      'data: {"type":"tool_call","id":"tc1","name":"lookup_standard","arguments":{"grade":"10"}}',
      'data: {"type":"finish"}',
    ])
    mockFetch(body)
    const cb = makeCallbacks({
      onReasoningDelta: vi.fn(),
      onToolCall: vi.fn(),
      signal: controller.signal,
    })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'lycero-thinking',
      system: '',
      messages: [],
      tools: [],
      cb,
    })

    expect(cb.onReasoningDelta).toHaveBeenCalledWith('Đang phân tích cấu trúc 5512...')
    expect(cb.onToolCall).toHaveBeenCalledWith({
      id: 'tc1',
      name: 'lookup_standard',
      input: { grade: '10' },
    })
  })

  it('extracts X-RateLimit-Remaining quota from response headers', async () => {
    const body = makeBody(['data: {"type":"finish"}'])
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'x-ratelimit-remaining': '145',
        'x-ratelimit-limit': '200',
      }),
      body,
    } as unknown as Response)
    vi.stubGlobal('fetch', fn)

    const cb = makeCallbacks({ signal: controller.signal })
    const onQuotaUpdate = vi.fn()

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'm',
      system: '',
      messages: [],
      tools: [],
      cb,
      onQuotaUpdate,
    })

    expect(onQuotaUpdate).toHaveBeenCalledWith({ remaining: 145, limit: 200 })
  })

  it('preserves multi-turn assistant tool_calls and tool results with tool_call_id, and unmasks PII in tool_call arguments', async () => {
    const body = makeBody([
      'data: {"type":"tool_call","id":"call_edit_1","name":"edit_paragraph","arguments":"{\\"index\\":0,\\"text\\":\\"Liên hệ [PII_EMAIL_1]\\"}"}',
      'data: {"type":"finish","stopReason":"tool_use"}',
    ])
    const fetchMock = mockFetch(body)
    const cb = makeCallbacks({
      onToolCall: vi.fn(),
      onStopReason: vi.fn(),
      signal: controller.signal,
    })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'lycero-2.5-auto',
      system: 'Document contains contact teacher@lycero.com',
      messages: [
        { role: 'user', text: 'Hãy cập nhật đoạn đầu với email teacher@lycero.com', images: [] },
        {
          role: 'assistant',
          text: 'Tôi sẽ đọc tài liệu trước.',
          toolCalls: [{ id: 'call_read_1', name: 'get_document_outline', input: { detail: true } }],
        },
        {
          role: 'tool',
          results: [{ id: 'call_read_1', name: 'get_document_outline', output: 'Paragraph 0: Liên hệ cũ' }],
        },
      ],
      tools: [
        {
          name: 'edit_paragraph',
          description: 'Edit a paragraph',
          inputSchema: { type: 'object', properties: { index: { type: 'number' }, text: { type: 'string' } } },
        },
      ],
      cb,
    })

    const [, init] = fetchMock.mock.calls[0]!
    const reqBody = JSON.parse(init.body as string)

    // System + user + assistant(tool_calls) + tool(tool_call_id)
    expect(reqBody.messages).toHaveLength(4)
    expect(reqBody.messages[2]).toEqual({
      role: 'assistant',
      content: 'Tôi sẽ đọc tài liệu trước.',
      tool_calls: [
        {
          id: 'call_read_1',
          type: 'function',
          function: {
            name: 'get_document_outline',
            arguments: JSON.stringify({ detail: true }),
          },
        },
      ],
    })
    expect(reqBody.messages[3]).toEqual({
      role: 'tool',
      tool_call_id: 'call_read_1',
      name: 'get_document_outline',
      content: 'Paragraph 0: Liên hệ cũ',
    })

    // Incoming tool_call JSON string arguments should be parsed AND have PII restored!
    expect(cb.onToolCall).toHaveBeenCalledWith({
      id: 'call_edit_1',
      name: 'edit_paragraph',
      input: { index: 0, text: 'Liên hệ teacher@lycero.com' },
    })
    expect(cb.onStopReason).toHaveBeenCalledWith('tool_use')
  })

  it('forwards X-Lycero-Editor-Module, X-Lycero-Pipeline-Stage, X-Lycero-Active-Skills headers and JSON body metadata', async () => {
    const body = makeBody(['data: {"type":"finish"}'])
    const fetchMock = mockFetch(body)
    const cb = makeCallbacks({
      signal: controller.signal,
      editorModule: 'office_slide',
      activeSkillSlugs: ['pedagogical-lesson-plan'],
      userSkillConfig: { 'pedagogical-lesson-plan': { detail_level: 'extended' } },
    })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'lycero-mate-pro',
      system: '[LYCERO_PIPELINE_STAGE:slide_page_spec]\nGenerate a 1280x720 page spec.',
      messages: [
        {
          role: 'user',
          text: '<skill name="vn-legal-nd30">\n[LYCERO_CLOUD_SKILL:vn-legal-nd30]\n</skill>\nThiết kế trang bìa.',
        },
      ],
      tools: [],
      cb,
    })

    const [, init] = fetchMock.mock.calls[0]!
    const headers = init.headers as Record<string, string>
    expect(headers['X-Lycero-Editor-Module']).toBe('office_slide')
    expect(headers['X-Lycero-Pipeline-Stage']).toBe('slide_page_spec')
    expect(headers['X-Lycero-Active-Skills']).toBe('pedagogical-lesson-plan,vn-legal-nd30')

    const reqBody = JSON.parse(init.body as string)
    expect(reqBody.editorModule).toBe('office_slide')
    expect(reqBody.pipelineStage).toBe('slide_page_spec')
    expect(reqBody.activeSkillSlugs).toEqual(['pedagogical-lesson-plan', 'vn-legal-nd30'])
    expect(reqBody.userSkillConfig).toEqual({
      'pedagogical-lesson-plan': { detail_level: 'extended' },
    })
  })

  it('auto-reconnects up to 10 attempts on network errors or mid-reasoning drops and recovers', async () => {
    expect(MAX_HUB_RECONNECT_ATTEMPTS).toBe(10)
    let callCount = 0
    const fn = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount <= 4) {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })
      }
      if (callCount <= 9) {
        // Stream emits reasoning, then closes without finish (simulating gateway/proxy drop while buffering tool_calls)
        return {
          ok: true,
          status: 200,
          body: makeBody(['data: {"type":"reasoning","delta":"Đang suy nghĩ..."}']),
        } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        body: makeBody([
          'data: {"type":"reasoning","delta":"Đang suy nghĩ lại..."}',
          'data: {"type":"text","delta":"Thành công ở lần thứ 10!"}',
          'data: {"type":"finish","stopReason":"stop"}',
        ]),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fn)
    const cb = makeCallbacks({
      onReasoningDelta: vi.fn(),
      signal: controller.signal,
    })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'lycero-2.5-auto',
      system: '',
      messages: [{ role: 'user', text: 'Tạo hợp đồng', images: [] }],
      tools: [],
      cb,
      retryBaseDelayMs: 0,
    })

    expect(fn).toHaveBeenCalledTimes(10)
    expect(cb.onDelta).toHaveBeenCalledTimes(1)
    expect(cb.onDelta).toHaveBeenCalledWith('Thành công ở lần thứ 10!')
  })

  it('recovers immediately on HTTP 401 when a fresh live token is available', async () => {
    const authHeaders: string[] = []
    const fn = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.Authorization ?? ''
      authHeaders.push(auth)
      if (auth === 'Bearer expired-jwt-token') {
        return { ok: false, status: 401, body: null } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        body: makeBody([
          'data: {"type":"text","delta":"Chào bạn!"}',
          'data: {"type":"finish","stopReason":"stop"}',
        ]),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fn)
    const cb = makeCallbacks({ signal: controller.signal })

    await streamHubChat({
      url: 'https://hub.lycero.com/api/v1/office',
      modelId: 'lycero-2.5-auto',
      apiKey: 'expired-jwt-token',
      system: '',
      messages: [{ role: 'user', text: 'hi', images: [] }],
      tools: [],
      cb,
      retryBaseDelayMs: 0,
    })

    expect(authHeaders).toEqual(['Bearer expired-jwt-token', 'Bearer mock-token'])
    expect(cb.onDelta).toHaveBeenCalledWith('Chào bạn!')
  })
})
