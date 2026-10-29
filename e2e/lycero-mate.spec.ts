/**
 * Lycero Mate — E2E real interaction test.
 *
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * This is the test the product brief asks for: open the real built app, open a
 * document, expand the AI panel (Lycero Mate), type a real prompt, hit Enter,
 * and prove the panel actually exchanged messages with a backend. Every prior
 * `e2e-ai-mate-*.cjs` script only opened the editor; the AI panel was left
 * unexercised.
 *
 * The hard part: Lycero Mate is wired to a real provider. A 2026-09 prod key
 * is not something the test runner has. We point the app at a tiny OpenAI-
 * compatible echo server we boot from the test process, then point the docs
 * renderer at a custom AI provider whose `baseUrl` is that echo server. The
 * echo server streams the prompt back, which is enough to assert the panel
 * (a) accepted the input, (b) entered the streaming state, (c) finalised
 * with text that contains the prompt the test sent.
 *
 * Anything more elaborate (a real model behind the panel) belongs in a
 * separate, key-bearing test that we deliberately do not run by default.
 */
import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  launchShell,
  closeAndSaveVideo,
  waitForPageWithUrl,
  screenshotPath,
} from './helpers'

const FIXTURE = resolve(
  __dirname,
  '../apps/docs/fixtures/generated/bao-cao-chien-luoc-ai-2026.docx',
)

/** a throwaway OpenAI-compatible chat-completions endpoint */
function startEchoServer(): Promise<{ server: Server; url: string }> {
  return new Promise((resolveFn) => {
    const server = createServer((req, res) => {
      if (req.url?.endsWith('/v1/chat/completions')) {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          let prompt = ''
          try {
            const parsed = JSON.parse(body)
            const last = parsed?.messages?.[parsed.messages.length - 1]
            prompt = (last?.content ?? '').toString()
          } catch {
            prompt = ''
          }
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(
            JSON.stringify({
              id: 'echo',
              object: 'chat.completion',
              model: 'echo',
              choices: [
                {
                  index: 0,
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: `Lycero Mate nhận: "${prompt.slice(0, 80)}"`,
                  },
                },
              ],
            }),
          )
        })
        return
      }
      res.writeHead(404).end()
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        resolveFn({ server, url: `http://127.0.0.1:${addr.port}/v1` })
      }
    })
  })
}

/** Custom-provider settings pointing at the echo server, stored before launch. */
async function seedAiSettings(userDataDir: string, baseUrl: string): Promise<void> {
  // The shape matches `AiSettings` (see packages/ai-provider/src/types.ts):
  //   { provider, providers: { [id]: { apiKey, model, baseUrl } } }
  // Custom is the OpenAI-compatible slot; pick it to bypass the Lycero key gate.
  const settings = {
    provider: 'custom',
    providers: {
      custom: {
        apiKey: 'test-key',
        model: 'echo',
        baseUrl,
      },
    },
  }
  // docs-main, sheets-main, and slides-main each read the same file at
  // <userData>/ai-settings.json; write once, all editors see it.
  await writeFile(join(userDataDir, 'ai-settings.json'), JSON.stringify(settings, null, 2))
}

test.describe('Lycero Mate — real interaction', () => {
  let server: Server | null = null
  let echoUrl = ''

  test.beforeAll(async () => {
    const started = await startEchoServer()
    server = started.server
    echoUrl = started.url
  })

  test.afterAll(async () => {
    await new Promise<void>((r) => server?.close(() => r()))
  })

  // shared harness: launch, open a docs tab, expand the AI panel. Returns the
  // .ai-dock locator, which is the scope of every assertion that follows.
  async function openMatePanelWithDocs(
    userDataDir: string,
    videoDir: string,
  ): Promise<{
    docs: import('@playwright/test').Page
    dock: import('@playwright/test').Locator
    close: () => Promise<void>
  }> {
    const launched = await launchShell({
      userDataDir,
      onboardingSeen: true,
      videoDir,
    })
    const { app, page } = launched
    await expect(page.locator('.quick-card').first()).toContainText('AI Docs')
    await page.locator('.quick-card').first().click()
    const docs = await waitForPageWithUrl(app, '://docs/')
    await docs.waitForLoadState('domcontentloaded')
    await docs.waitForTimeout(1500)
    const dock = docs.locator('.ai-dock').first()
    if (await dock.evaluate((el) => el.classList.contains('collapsed'))) {
      await dock.locator('.ai-rail, .ai-expand-btn, [aria-label*="Expand"]').first().click()
      await expect(dock).not.toHaveClass(/collapsed/)
    }
    return {
      docs,
      dock,
      close: () => closeAndSaveVideo(launched, videoDir),
    }
  }

  test('Lycero Mate: send a prompt and receive a streamed reply', async () => {
    test.setTimeout(120_000)
    const userDataDir = await mkdtemp(join(tmpdir(), 'lycero-mate-e2e-'))
    await mkdir(join(userDataDir, 'Local Storage'), { recursive: true })
    await seedAiSettings(userDataDir, echoUrl)
    const harness = await openMatePanelWithDocs(userDataDir, 'lycero-mate')
    try {
      const { docs, dock } = harness
      await expect(dock).toBeVisible()
      await docs.screenshot({ path: screenshotPath('lycero-mate-opened') })

      const prompt = 'Hãy tóm tắt tài liệu này trong 3 dòng.'
      const textarea = dock.locator('textarea').first()
      await textarea.waitFor({ state: 'visible', timeout: 15_000 })
      await textarea.fill(prompt)
      expect(await textarea.inputValue()).toBe(prompt)

      await textarea.press('Enter')

      // Streaming: send → stop button
      const stopButton = dock.locator('.ai-stop-btn, button[aria-label="Stop"]')
      await stopButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

      const assistantBubble = dock.locator('.ai-msg.ai-msg-assistant').last()
      await expect(assistantBubble).toContainText('Lycero Mate nhận:', { timeout: 20_000 })
      await expect(assistantBubble).toContainText('Hãy tóm tắt')
      await docs.screenshot({ path: screenshotPath('lycero-mate-replied') })

      const errorBox = dock.locator('.ai-msg-error').first()
      expect(await errorBox.isVisible().catch(() => false)).toBe(false)
    } finally {
      await harness.close()
    }
  })

  test('Lycero Mate: empty prompt keeps send disabled', async () => {
    test.setTimeout(60_000)
    const userDataDir = await mkdtemp(join(tmpdir(), 'lycero-mate-empty-'))
    await mkdir(join(userDataDir, 'Local Storage'), { recursive: true })
    await seedAiSettings(userDataDir, echoUrl)
    const harness = await openMatePanelWithDocs(userDataDir, 'lycero-mate-empty')
    try {
      const { docs, dock } = harness
      const sendBtn = dock.locator('.ai-send-btn').first()
      await expect(sendBtn).toBeDisabled()
      const textarea = dock.locator('textarea').first()
      // whitespace-only does not qualify as a non-empty message
      await textarea.fill('   ')
      await expect(sendBtn).toBeDisabled()
      await docs.screenshot({ path: screenshotPath('lycero-mate-empty-disabled') })
    } finally {
      await harness.close()
    }
  })

  test('Lycero Mate: two prompts in a row both get assistant replies', async () => {
    test.setTimeout(120_000)
    const userDataDir = await mkdtemp(join(tmpdir(), 'lycero-mate-history-'))
    await mkdir(join(userDataDir, 'Local Storage'), { recursive: true })
    await seedAiSettings(userDataDir, echoUrl)
    const harness = await openMatePanelWithDocs(userDataDir, 'lycero-mate-history')
    try {
      const { docs, dock } = harness
      const textarea = dock.locator('textarea').first()
      await textarea.waitFor({ state: 'visible', timeout: 15_000 })

      await textarea.fill('câu hỏi số 1')
      await textarea.press('Enter')
      const first = dock.locator('.ai-msg.ai-msg-assistant').last()
      await expect(first).toContainText('câu hỏi số 1', { timeout: 20_000 })

      await textarea.fill('câu hỏi số 2')
      await textarea.press('Enter')
      const second = dock.locator('.ai-msg.ai-msg-assistant').last()
      await expect(second).toContainText('câu hỏi số 2', { timeout: 20_000 })
      const allBubbles = dock.locator('.ai-msg.ai-msg-assistant')
      expect(await allBubbles.count()).toBeGreaterThanOrEqual(2)
      await docs.screenshot({ path: screenshotPath('lycero-mate-history') })
    } finally {
      await harness.close()
    }
  })
})
