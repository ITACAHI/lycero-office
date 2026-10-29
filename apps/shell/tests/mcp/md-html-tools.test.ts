/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * read_md / read_html: byte-level reads of markdown and HTML files, with the
 * same 4 MB size cap as read_pdf. The fixtures are small, so the cap is exercised
 * by a tiny on-the-fly oversized file (a sparse file of zeros would be wrong —
 * stat() reports the actual byte count of a sparse file, and tests that race a
 * 4 MB write are slow). A 6 MB buffer built once covers both the rejection and
 * the path that one file over the cap rejects while a smaller file in the same
 * dir passes.
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  createMdHtmlTools,
  createMdTools,
  createHtmlTools,
  MD_HTML_MAX_TOTAL_BYTES,
} from '../../src/main/mcp/tools/md-html-tools'

let dir: string
let oneByteOver: string
let tinyMd: string
let tinyHtml: string
let noisyHtml: string

const SAMPLE_MD = '# Heading\n\nA paragraph with `code` and a [link](https://example.com).\n'
const SAMPLE_HTML =
  '<!doctype html><html><head><title>t</title></head><body><h1>Hi</h1><p>Hello world.</p></body></html>'

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'lycero-office-mcp-md-html-'))
  tinyMd = join(dir, 'tiny.md')
  tinyHtml = join(dir, 'tiny.html')
  noisyHtml = join(dir, 'noisy.htm')
  await writeFile(tinyMd, SAMPLE_MD, 'utf8')
  await writeFile(tinyHtml, SAMPLE_HTML, 'utf8')
  await writeFile(noisyHtml, SAMPLE_HTML, 'utf8')
  oneByteOver = join(dir, 'over.md')
  // 4 MB and 1 byte, deterministic and fast
  await writeFile(oneByteOver, Buffer.alloc(MD_HTML_MAX_TOTAL_BYTES + 1))
})

describe('read_md happy path', () => {
  it('returns the raw markdown bytes with path and byte count', async () => {
    const [tool] = createMdTools()
    const result = (await tool!.handler({ path: tinyMd })) as {
      path: string
      bytes: number
      content: string
    }
    expect(result.path).toBe(tinyMd)
    expect(result.bytes).toBe(Buffer.byteLength(SAMPLE_MD, 'utf8'))
    expect(result.content).toBe(SAMPLE_MD)
  })
})

describe('read_html happy path', () => {
  it('returns the raw html bytes for .html', async () => {
    const [tool] = createHtmlTools()
    const result = (await tool!.handler({ path: tinyHtml })) as {
      path: string
      bytes: number
      content: string
    }
    expect(result.path).toBe(tinyHtml)
    expect(result.bytes).toBe(Buffer.byteLength(SAMPLE_HTML, 'utf8'))
    expect(result.content).toBe(SAMPLE_HTML)
  })

  it('accepts .htm alongside .html', async () => {
    const [tool] = createHtmlTools()
    const result = (await tool!.handler({ path: noisyHtml })) as {
      content: string
    }
    expect(result.content).toBe(SAMPLE_HTML)
  })
})

describe('read_md / read_html rejection paths', () => {
  it('rejects an .md path on the html tool with a guided error', async () => {
    const [tool] = createHtmlTools()
    await expect(tool!.handler({ path: tinyMd })).rejects.toThrow(/not a HTML file/)
  })

  it('rejects an .html path on the md tool with a guided error', async () => {
    const [tool] = createMdTools()
    await expect(tool!.handler({ path: tinyHtml })).rejects.toThrow(/not a Markdown file/)
  })

  it('rejects relative paths', async () => {
    const [tool] = createMdTools()
    await expect(tool!.handler({ path: 'notes.md' })).rejects.toThrow(/absolute/)
  })

  it('rejects empty path', async () => {
    const [tool] = createMdTools()
    await expect(tool!.handler({ path: '' })).rejects.toThrow(/read_md requires a path/)
  })

  it('rejects a directory whose name ends in .md', async () => {
    const mdDir = join(dir, 'folder.md')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(mdDir)
    const [tool] = createMdTools()
    await expect(tool!.handler({ path: mdDir })).rejects.toThrow(/is a directory/)
  })

  it('rejects a file larger than the 4 MB cap', async () => {
    const [tool] = createMdTools()
    await expect(tool!.handler({ path: oneByteOver })).rejects.toThrow(/caps reads at/)
  })
})

describe('createMdHtmlTools', () => {
  it('registers both read_md and read_html exactly once each', () => {
    const tools = createMdHtmlTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(['read_html', 'read_md'])
  })
})
