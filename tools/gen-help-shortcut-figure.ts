/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { _electron as electron, type CDPSession, type Page } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { buildBlankDocx } from '../packages/docx-engine/src/blank'

const REPO = resolve(__dirname, '..')
const SHELL_DIR = join(REPO, 'apps/shell')
const OUT_DIR = join(REPO, 'apps/shell/src/renderer/src/i18n/help/topics/img')

const LANGS = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const TARGET_LANGS = LANGS.length ? LANGS : ['zh', 'en']

async function capture(page: Page, cdp: CDPSession): Promise<Buffer> {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  })
  return Buffer.from(data, 'base64')
}

/** 1360x850 CSS at 2x, matching the committed figures. */
async function frame(page: Page, width = 1360): Promise<CDPSession> {
  await page.setViewportSize({ width, height: 850 })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 850,
    deviceScaleFactor: 2,
    mobile: false,
  })
  await page.waitForTimeout(600)
  return cdp
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const lang of TARGET_LANGS) {
    const root = mkdtempSync(join(tmpdir(), 'help-shortcuts-'))
    const home = join(root, 'home')
    const userData = join(root, 'userdata')
    const samples = join(root, 'help-samples')
    for (const dir of [home, userData, samples]) mkdirSync(dir, { recursive: true })
    writeFileSync(join(samples, 'doc.docx'), await buildBlankDocx())

    const require = createRequire(join(SHELL_DIR, 'package.json'))
    const { ELECTRON_RUN_AS_NODE: _drop, ...hostEnv } = process.env
    const args: string[] = []
    if (process.platform === 'linux') args.push('--no-sandbox', '--disable-gpu')
    args.push(SHELL_DIR, join(samples, 'doc.docx'))

    const app = await electron.launch({
      executablePath: require('electron') as unknown as string,
      args,
      env: {
        ...hostEnv,
        HOME: home,
        GENOFFICE_USER_DATA: userData,
        GENOFFICE_AUTH_DIR: join(home, '.genoffice'),
        GENOFFICE_NO_SPARE_VIEW: '1',
        GENOFFICE_LANG: lang,
      },
    })

    try {
      let docsPage: Page | undefined
      const deadline = Date.now() + 60_000
      while (!docsPage && Date.now() < deadline) {
        for (const w of app.windows()) {
          const url = await w.evaluate(() => window.location.href).catch(() => '')
          if (url.includes('/docs/') && (await w.locator('.doc-page').count())) docsPage = w
        }
        if (!docsPage) await new Promise((r) => setTimeout(r, 250))
      }
      if (!docsPage) {
        throw new Error(
          'the Word editor never rendered. If apps/docs/out is missing the renderer ' +
            'protocol answers 404 and the window comes up blank with no error — build it ' +
            'with "npx electron-vite build" in apps/docs.',
        )
      }

      const cdp = await frame(docsPage)
      await docsPage.waitForSelector('.ribbon', { timeout: 30_000 })
      const sheet = await app.evaluate(({ Menu }) => {
        const help = Menu.getApplicationMenu()?.items.find((i) => i.role === 'help')
        const item = help?.submenu?.items.find((i) => (i.accelerator ?? '').includes('/'))
        if (!item?.click) throw new Error('the Help menu has no shortcut item')
        item.click()
        return item.label ?? ''
      })
      await docsPage.waitForSelector('.modal-shortcuts', { timeout: 15_000 })
      // the dialog lists every binding, so it is scrolled to the top before the
      // shot rather than left wherever it happened to mount
      await docsPage.evaluate(() => {
        document.querySelector('.modal-shortcuts')?.scrollTo(0, 0)
      })
      await docsPage.waitForTimeout(400)

      const name = `word-shortcuts.${lang}.png`
      writeFileSync(join(OUT_DIR, name), await capture(docsPage, cdp))
      process.stdout.write(`wrote ${name} (sheet "${sheet}")\n`)
    } finally {
      await app.close().catch(() => {})
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
