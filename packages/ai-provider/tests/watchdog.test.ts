/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentToolCall } from '@lycero/agent-core'
import { streamForProvider } from '../src/stream'
import {
  AI_CONNECT_TIMEOUT_MS,
  AI_CONTENT_IDLE_TIMEOUT_MS,
  AI_IDLE_TIMEOUT_MS,
  AI_TOOL_CALL_CONTENT_IDLE_TIMEOUT_MS,
  AI_TOTAL_TIMEOUT_MS,
  AiTimeoutError,
  createStreamWatchdog,
} from '../src/watchdog'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** promise that rejects when the given signal aborts (models a fetch/body read) */
function abortable(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(new Error('aborted'))
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
}

describe('createStreamWatchdog', () => {
  it('aborts and reports AiTimeoutError when nothing arrives within the connect timeout', async () => {
    const wd = createStreamWatchdog(undefined, 1_000, 5_000)
    const run = wd.guard(() => abortable(wd.signal))
    const result = expect(run).rejects.toBeInstanceOf(AiTimeoutError)
    await vi.advanceTimersByTimeAsync(1_000)
    await result
  })

  it('touch() switches to the idle timeout and re-arms it on every call', async () => {
    const wd = createStreamWatchdog(undefined, 1_000, 2_000)
    const run = wd.guard(() => abortable(wd.signal))
    const result = expect(run).rejects.toBeInstanceOf(AiTimeoutError)
    await vi.advanceTimersByTimeAsync(900)
    wd.touch() // data arrived: idle timeout from now on
    await vi.advanceTimersByTimeAsync(1_900)
    expect(wd.signal.aborted).toBe(false)
    wd.touch()
    await vi.advanceTimersByTimeAsync(1_900)
    expect(wd.signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(wd.signal.aborted).toBe(true)
    await result
  })

  it('a caller abort propagates and keeps the original error (not AiTimeoutError)', async () => {
    const parent = new AbortController()
    const wd = createStreamWatchdog(parent.signal, 1_000, 1_000)
    const run = wd.guard(() => abortable(wd.signal))
    parent.abort()
    await expect(run).rejects.toThrow('aborted')
  })

  it('an already-aborted caller signal aborts immediately', () => {
    const parent = new AbortController()
    parent.abort()
    const wd = createStreamWatchdog(parent.signal)
    expect(wd.signal.aborted).toBe(true)
  })

  it('success resolves and disposes the timer (no abort after completion)', async () => {
    const wd = createStreamWatchdog(undefined, 1_000, 1_000)
    await expect(wd.guard(() => Promise.resolve('ok'))).resolves.toBe('ok')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wd.signal.aborted).toBe(false)
  })

  it('non-timeout errors pass through unchanged', async () => {
    const wd = createStreamWatchdog(undefined, 1_000, 1_000)
    await expect(wd.guard(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
  })

  it('FX-62: uses 120s idle timeout ("Máy chủ không phản hồi") and 15-min total cap ("Yêu cầu chạy quá lâu")', async () => {
    expect(AI_IDLE_TIMEOUT_MS).toBe(120_000)
    expect(AI_TOTAL_TIMEOUT_MS).toBe(15 * 60_000)

    // 1. Idle timeout surfaces "Máy chủ không phản hồi"
    const wdIdle = createStreamWatchdog(undefined, 2_000, 5_000, 60_000)
    const runIdle = wdIdle.guard(() => abortable(wdIdle.signal))
    const idleResult = expect(runIdle).rejects.toThrow(/Máy chủ không phản hồi/)
    wdIdle.touch()
    await vi.advanceTimersByTimeAsync(5_000)
    await idleResult

    // 2. Total timeout fires even when touch() is called repeatedly (e.g. pings)
    const wdTotal = createStreamWatchdog(undefined, 3_000, 5_000, 10_000)
    const runTotal = wdTotal.guard(() => abortable(wdTotal.signal))
    const totalResult = expect(runTotal).rejects.toThrow(/Yêu cầu chạy quá lâu/)
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(2_000)
      wdTotal.touch()
    }
    expect(wdTotal.signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(wdTotal.signal.aborted).toBe(true)
    await totalResult
  })
})

describe('stream timeouts end to end', () => {
  const collector = () => {
    const deltas: string[] = []
    return {
      deltas,
      cb: {
        signal: new AbortController().signal,
        onDelta: (text: string) => deltas.push(text),
        onToolCall: (_call: AgentToolCall) => {},
      },
    }
  }

  it('rejects with AiTimeoutError when the connection never yields a response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => abortable(init.signal!)),
    )
    const { cb } = collector()
    const run = streamForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'system',
      [{ role: 'user', text: 'hi' }],
      [],
      100,
      cb,
    )
    const result = expect(run).rejects.toBeInstanceOf(AiTimeoutError)
    await vi.advanceTimersByTimeAsync(AI_CONNECT_TIMEOUT_MS)
    await result
  })

  it('rejects with AiTimeoutError when an open stream goes silent', async () => {
    const encoder = new TextEncoder()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        const signal = init.signal!
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}\n',
              ),
            )
            // stays open forever; reads reject once the watchdog aborts
            signal.addEventListener('abort', () => controller.error(new Error('aborted')))
          },
        })
        return Promise.resolve(new Response(body, { status: 200 }))
      }),
    )
    const { deltas, cb } = collector()
    const run = streamForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'system',
      [{ role: 'user', text: 'hi' }],
      [],
      100,
      cb,
    )
    const result = expect(run).rejects.toBeInstanceOf(AiTimeoutError)
    await vi.advanceTimersByTimeAsync(AI_IDLE_TIMEOUT_MS + 1_000)
    await result
    expect(deltas).toEqual(['hi'])
  })

  it('reports wire activity through onActivity', async () => {
    const encoder = new TextEncoder()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"type":"ping"}\n'))
            controller.close()
          },
        })
        return Promise.resolve(new Response(body, { status: 200 }))
      }),
    )
    const onActivity = vi.fn()
    const run = streamForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'system',
      [{ role: 'user', text: 'hi' }],
      [],
      100,
      { ...collector().cb, onActivity },
    )
    // a ping-only stream carries no content, so the turn itself rejects
    await expect(run).rejects.toThrow(/returned no content/)
    expect(onActivity).toHaveBeenCalled()
  })

  it('FX-83: waits through 150s silence during tool-call argument generation (up to 240s), but errors at 105s outside tool-call', async () => {
    expect(AI_CONTENT_IDLE_TIMEOUT_MS).toBe(105_000)
    expect(AI_TOOL_CALL_CONTENT_IDLE_TIMEOUT_MS).toBe(240_000)
    const encoder = new TextEncoder()

    // 1. Outside tool-call: aborts at 105s even if pings arrive
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        const signal = init.signal!
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}\n\n',
              ),
            )
            signal.addEventListener('abort', () => controller.error(new Error('aborted')))
          },
        })
        return Promise.resolve(new Response(body, { status: 200 }))
      }),
    )
    const runOutside = streamForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'system',
      [{ role: 'user', text: 'hi' }],
      [],
      100,
      collector().cb,
    )
    const outsideResult = expect(runOutside).rejects.toThrow(/105s/)
    await vi.advanceTimersByTimeAsync(105_000)
    await outsideResult

    // 2. Inside tool-call (after content_block_start of tool_use): still alive at 150s, completes when delta arrives
    let streamCtrl: ReadableStreamDefaultController<Uint8Array> | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        const signal = init.signal!
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            streamCtrl = controller
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_1","name":"create_document"}}\n\n',
              ),
            )
            signal.addEventListener('abort', () => controller.error(new Error('aborted')))
          },
        })
        return Promise.resolve(new Response(body, { status: 200 }))
      }),
    )
    const toolCalls: AgentToolCall[] = []
    const progressEvents: Array<{ name?: string; bytes: number }> = []
    const runInside = streamForProvider(
      'anthropic',
      { apiKey: 'k', model: 'claude-sonnet-5' },
      'system',
      [{ role: 'user', text: 'create' }],
      [],
      100,
      {
        ...collector().cb,
        onToolCall: (call) => toolCalls.push(call),
        onToolArgsProgress: (info) => progressEvents.push(info),
      },
    )
    // Flush headers + content_block_start chunk
    await vi.advanceTimersByTimeAsync(10)
    // Simulate 150s of server silence while generating tool arguments
    await vi.advanceTimersByTimeAsync(150_000)
    // Stream is still alive! Now emit the buffered arguments and close cleanly
    streamCtrl!.enqueue(
      encoder.encode(
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"title\\":\\"Report\\"}"}}\n\n' +
          'data: {"type":"content_block_stop","index":0}\n\n' +
          'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}\n\n',
      ),
    )
    streamCtrl!.close()
    await runInside
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]?.name).toBe('create_document')
    expect(progressEvents.length).toBeGreaterThanOrEqual(2)
  })
})
