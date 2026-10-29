/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Lycero Mate ActionCard integration test.
 *
 * Verifies the new `ToolDisplay.kind='action_card'` side-channel: a tool can
 * return an ActionCardData payload that the renderer will surface as a
 * Lycero Mate action card (preview-then-apply). The card carries the proposed
 * mutation but the loop tracks `mutated=false` so the doc is untouched until
 * the user clicks Apply.
 */
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { AgentLoop, type AgentStreamCallbacks, type AgentTransport } from '@lycero/agent-core'
import type { ActionCardData } from '@lycero/agent-core'
import { editorExtensions } from '../src/renderer/editor/extensions'

const para = (t: string) => ({
  type: 'docParagraph',
  attrs: { docxIndex: null },
  content: [{ type: 'text', text: t }],
})

const fixture = () => [para('Original opening sentence.')]

function createEditor(content: ReturnType<typeof fixture>): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: editorExtensions,
    content: { type: 'doc', content },
  })
}

function scriptedTransport(
  script: Array<(cb: AgentStreamCallbacks) => void>,
): AgentTransport {
  let turn = 0
  return {
    stream(_req, cb) {
      const step = script[turn++]
      if (step) queueMicrotask(() => step(cb))
      return { cancel: () => queueMicrotask(() => cb.onDone()) }
    },
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

/** The card a Lycero Mate skill emits for a "replace selection" suggestion.
 * Mirrors the docs skill's rewrite flow but stops short of mutating the doc:
 * the renderer is the only thing allowed to apply it. */
const REPLACE_CARD: ActionCardData = {
  type: 'lycero.replace-selection',
  title: 'Đề xuất chỉnh sửa',
  description: 'Lycero Mate đề xuất thay đoạn đang chọn bằng văn bản mới.',
  payload: {
    find: 'Original opening sentence.',
    replace: 'Opening sentence (Lycero Mate).',
  },
  applied: false,
}

describe('ToolDisplay.kind="action_card"', () => {
  it('declared on ToolExecution so the renderer can show a Lycero Mate card', () => {
    // Type-level: ensure ToolDisplay accepts 'action_card' and ToolExecution.display.card exists
    const card: ActionCardData = REPLACE_CARD
    const exec: import('@lycero/agent-core').ToolExecution = {
      output: 'Action card queued for user review.',
      isError: false,
      mutated: false,
      summary: 'Đề xuất chỉnh sửa',
      display: { kind: 'action_card', card },
    }
    expect(exec.display?.kind).toBe('action_card')
    expect(exec.display?.card).toEqual(card)
    expect(exec.mutated).toBe(false)
  })

  it('agent loop threads display side-channel to events without leaking into LLM context', async () => {
    const editor = createEditor(fixture())
    const before = JSON.stringify(editor.getJSON())
    const collectedExecs: Array<{
      mutated?: boolean
      display?: import('@lycero/agent-core').ToolDisplay
    }> = []
    const loop = new AgentLoop({
      transport: scriptedTransport([
        (cb) => {
          cb.onToolCall({
            id: 'c1',
            name: 'replace_suggestion',
            input: { find: 'Original opening sentence.', replace: 'New sentence.' },
          })
          cb.onDone()
        },
        (cb) => {
          cb.onDelta('Đã đề xuất chỉnh sửa, vui lòng xem thẻ.')
          cb.onDone()
        },
      ]),
      skill: {
        id: 'demo',
        slug: 'demo',
        systemPrompt: 'You are a test agent. When asked to suggest an edit, call replace_suggestion and return a short note.',
        tools: [
          {
            name: 'replace_suggestion',
            description: 'Suggest an in-place replacement without mutating the doc.',
            inputSchema: {
              type: 'object',
              properties: {
                find: { type: 'string' },
                replace: { type: 'string' },
              },
              required: ['find', 'replace'],
            },
          },
        ],
        buildContext: () => '',
        executeTool: async (call) => ({
          output: `Suggested replacement: ${call.input.replace}`,
          isError: false,
          mutated: false,
          summary: 'Đề xuất chỉnh sửa',
          display: { kind: 'action_card', card: REPLACE_CARD },
        }),
      },
      events: {
        onToolExecuted: ({ execution }) => {
          collectedExecs.push({
            mutated: execution.mutated,
            display: execution.display,
          })
        },
        onDone: () => {},
      },
    })
    loop.run('Suggest a one-sentence edit')
    await flush()
    expect(collectedExecs).toHaveLength(1)
    expect(collectedExecs[0]?.mutated).toBe(false)
    expect(collectedExecs[0]?.display?.kind).toBe('action_card')
    expect(collectedExecs[0]?.display?.card?.payload).toEqual({
      find: 'Original opening sentence.',
      replace: 'Opening sentence (Lycero Mate).',
    })
    // Doc untouched: the model never reached the renderer to click Apply
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    // Display side-channel does NOT enter the LLM context (only output does)
    const lastTool = loop.messages.find((m) => m.role === 'tool')
    expect(lastTool?.role).toBe('tool')
    if (lastTool?.role === 'tool') {
      const text = lastTool.results.map((r) => r.output).join('\n')
      expect(text).not.toContain('action_card')
      expect(text).toContain('Suggested replacement')
    }
  })
})
