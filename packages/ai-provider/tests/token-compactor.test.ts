/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyRemoteTokenOptimizerPolicy,
  compactOutboundAgentTurn,
  fetchRemoteModels,
  getClientTokenOptimizerPolicy,
  resetClientTokenOptimizerPolicy,
  setRescueFetch,
  streamHubChat,
} from '../src'
import { streamOpenAiCompatible } from '../src/protocols/openai-compatible'
import type { AgentMessage } from '@lycero/agent-core'

describe('Lossless Full-Stack Token Optimizer (token-compactor)', () => {
  beforeEach(() => {
    resetClientTokenOptimizerPolicy()
  })

  afterEach(() => {
    resetClientTokenOptimizerPolicy()
    setRescueFetch(null)
    vi.restoreAllMocks()
  })

  it('starts with lossless full-stack defaults (no AST slicing, no blind tool truncation)', () => {
    const policy = getClientTokenOptimizerPolicy()
    expect(policy).toEqual({
      enabled: true,
      clientAstSlicingEnabled: false,
      clientMaxDocSnapshotChars: 120000,
      clientDeltaDeduplicationEnabled: true,
      clientTruncateStaleToolOutputsEnabled: false,
      clientMaxHistoricalToolResultChars: 32000,
      clientCompactToolDescriptions: false,
    })
  })

  it('syncs tokenOptimizerPolicy from GET /api/v1/office/ai/models via fetchRemoteModels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            models: [{ id: 'lycero-2.5-auto', displayName: 'Lycero Super Model Auto' }],
            tokenOptimizerPolicy: {
              enabled: true,
              clientAstSlicingEnabled: false,
              clientMaxDocSnapshotChars: 180000,
              clientDeltaDeduplicationEnabled: true,
              clientTruncateStaleToolOutputsEnabled: false,
              clientMaxHistoricalToolResultChars: 48000,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const models = await fetchRemoteModels('lycero', {
      model: 'lycero-2.5-auto',
      apiKey: 'test-token',
    })
    expect(models).toContain('lycero-2.5-auto')
    expect(getClientTokenOptimizerPolicy()).toMatchObject({
      enabled: true,
      clientAstSlicingEnabled: false,
      clientMaxDocSnapshotChars: 180000,
      clientDeltaDeduplicationEnabled: true,
      clientTruncateStaleToolOutputsEnabled: false,
      clientMaxHistoricalToolResultChars: 48000,
    })
  })

  it('deduplicates superseded <document_context>, Document block list, and Active sheet snapshots only when a newer user turn has a fresh snapshot', () => {
    const oldDocContext = `<document_context>\n${'Paragraph content line in initial version.\n'.repeat(20)}</document_context>`
    const oldBlockList = `\n\nDocument block list:\nThe document has 15 blocks, listed below:\n${'[0] Heading 1: Introduction to Lycero Super Model\n'.repeat(15)}`
    const oldWorkbook = `\n\nActive sheet: Revenue_2026\nMode: normal\n${'A1: Product | B1: Q1 | C1: Q2 | D1: Q3\n'.repeat(15)}`
    const freshDocContext = `<document_context>\n${'Updated paragraph content in latest turn.\n'.repeat(20)}</document_context>`

    const messages: AgentMessage[] = [
      {
        role: 'user',
        text: `[Previous conversation summary]\nUser asked to format headings.`,
      },
      {
        role: 'assistant',
        text: 'Understood.',
      },
      {
        role: 'user',
        text: `Hãy chỉnh lại phần mở đầu.\n${oldDocContext}${oldBlockList}`,
      },
      {
        role: 'assistant',
        text: 'Đã chỉnh phần mở đầu.',
      },
      {
        role: 'user',
        text: `Cập nhật bảng doanh thu.\n${oldWorkbook}`,
      },
      {
        role: 'assistant',
        text: 'Đã cập nhật bảng.',
      },
      {
        role: 'user',
        text: `Kiểm tra lại toàn bộ tài liệu.\n${freshDocContext}`,
      },
    ]

    const result = compactOutboundAgentTurn(messages)

    // Summary message from AgentLoop (COMPACT_MAX_BYTES / COMPACT_KEEP_RECENT_BYTES) is untouched
    expect(result.messages[0]).toEqual(messages[0])
    // Original messages array is not mutated
    expect((messages[2] as { text: string }).text).toContain(oldDocContext)

    // Superseded snapshots in turns #2 and #4 are replaced with compact markers
    const turn2Text = (result.messages[2] as { text: string }).text
    expect(turn2Text).toContain('Hãy chỉnh lại phần mở đầu.')
    expect(turn2Text).toContain('<document_context_superseded')
    expect(turn2Text).toContain('superseded by fresh Document block list in latest user turn')

    const turn4Text = (result.messages[4] as { text: string }).text
    expect(turn4Text).toContain('Cập nhật bảng doanh thu.')
    expect(turn4Text).toContain('superseded by fresh Active sheet context in latest user turn')

    // Latest user turn (#6) keeps 100% of its fresh snapshot without any AST slicing
    const turn6Text = (result.messages[6] as { text: string }).text
    expect(turn6Text).toContain(freshDocContext)

    expect(result.telemetry.mode).toBe('lossless_fullstack')
    expect(result.telemetry.dedupedSnapshots).toBe(3)
    expect(result.telemetry.slicedDocs).toBe(0)
    expect(result.telemetry.compactedChars).toBeLessThan(result.telemetry.originalChars)
    expect(result.telemetry.savedTokensEstimate).toBeGreaterThan(0)
  })

  it('keeps earlier snapshot 100% intact when the latest user turn does not carry a new snapshot', () => {
    const docSnapshot = `<document_context>\n${'Important legal clause text that must stay intact.\n'.repeat(20)}</document_context>`
    const messages: AgentMessage[] = [
      {
        role: 'user',
        text: `Phân tích tài liệu này.\n${docSnapshot}`,
      },
      {
        role: 'assistant',
        text: 'Tôi đã đọc xong.',
      },
      {
        role: 'user',
        text: 'Tóm tắt điều khoản số 3 giúp tôi.',
      },
    ]

    const result = compactOutboundAgentTurn(messages)
    expect((result.messages[0] as { text: string }).text).toContain(docSnapshot)
    expect(result.telemetry.dedupedSnapshots).toBe(0)
    expect(result.telemetry.compactedChars).toBe(result.telemetry.originalChars)
  })

  it('preserves 100% of distinct tool outputs and only deduplicates 100% identical read results across turns', () => {
    const identicalReadOutput = JSON.stringify({
      blocks: Array.from({ length: 30 }, (_, i) => ({
        index: i,
        text: `Block #${i} content in document AST`,
      })),
    })
    const distinctReadOutput = JSON.stringify({
      blocks: Array.from({ length: 30 }, (_, i) => ({
        index: i,
        text: `Modified Block #${i} after edit_block execution`,
      })),
    })

    const messages: AgentMessage[] = [
      { role: 'user', text: 'Read and edit blocks' },
      {
        role: 'assistant',
        text: '',
        toolCalls: [{ id: 'c1', name: 'read_blocks', input: {} }],
      },
      {
        role: 'tool',
        results: [
          { id: 'c1', name: 'read_blocks', output: identicalReadOutput },
          { id: 'c2', name: 'read_blocks', output: distinctReadOutput },
        ],
      },
      {
        role: 'assistant',
        text: '',
        toolCalls: [{ id: 'c3', name: 'read_blocks', input: {} }],
      },
      {
        role: 'tool',
        results: [{ id: 'c3', name: 'read_blocks', output: identicalReadOutput }],
      },
    ]

    const result = compactOutboundAgentTurn(messages)
    const earlierToolMsg = result.messages[2] as Extract<AgentMessage, { role: 'tool' }>
    const latestToolMsg = result.messages[4] as Extract<AgentMessage, { role: 'tool' }>

    // Earlier identical output is deduplicated because turn #5 has the exact same output
    expect(earlierToolMsg.results[0]!.output).toContain('trùng khớp 100% với bản đọc mới hơn')
    // Earlier distinct output is 100% preserved
    expect(earlierToolMsg.results[1]!.output).toBe(distinctReadOutput)
    // Latest identical output is 100% preserved
    expect(latestToolMsg.results[0]!.output).toBe(identicalReadOutput)
    expect(result.telemetry.truncatedToolOutputs).toBe(1)
  })

  it('attaches X-Lycero-Client-Compaction header on streamHubChat and streamOpenAiCompatible to Lycero Gateway', async () => {
    const capturedHeaders: Array<Record<string, string>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const h = (init?.headers ?? {}) as Record<string, string>
        capturedHeaders.push(h)
        if (String(url).endsWith('/ai/chat')) {
          const sse = [
            'data: {"type":"text","delta":"OK"}\n\n',
            'data: {"type":"finish","stopReason":"stop","usage":{"inputTokens":10,"outputTokens":2}}\n\n',
          ].join('')
          return new Response(sse, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          })
        }
        const openAiSse = [
          'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ].join('')
        return new Response(openAiSse, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }),
    )

    await streamHubChat({
      url: 'https://lycero.com/api/v1/office',
      modelId: 'lycero-2.5-auto',
      apiKey: 'test-hub-token',
      system: 'sys',
      messages: [{ role: 'user', text: 'Xin chào Lycero Super Model' }],
      tools: [],
      cb: { onDelta: () => {}, onToolCall: () => {}, signal: new AbortController().signal },
    })

    await streamOpenAiCompatible(
      'https://lycero.com/api/v1/office/ai',
      { model: 'lycero-2.5-auto', apiKey: 'test-gw-token' },
      'sys',
      [{ role: 'user', text: 'Xin chào Lycero Super Model' }],
      [],
      4096,
      { onDelta: () => {}, onToolCall: () => {}, signal: new AbortController().signal },
    )

    expect(capturedHeaders).toHaveLength(2)
    for (const headers of capturedHeaders) {
      expect(headers['X-Lycero-Client-Compaction']).toBeDefined()
      const parsed = JSON.parse(headers['X-Lycero-Client-Compaction']!)
      expect(parsed).toMatchObject({
        mode: 'lossless_fullstack',
        dedupedSnapshots: 0,
        slicedDocs: 0,
        truncatedToolOutputs: 0,
      })
      expect(parsed.originalChars).toBeGreaterThan(0)
    }
  })
})
