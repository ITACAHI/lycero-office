/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureDom } from '../dom'
import { assertAllowed, type PathContext } from '../fs'
import { sanitizeCliTextInput } from '../ops-input'
import { imageSize } from './image-size'
import { blankDocument, closeDocument, fillFromHtml, saveDocument } from './docx'

/**
 * Markdown → Word reuses the markdown app's editor: its Tiptap markdown parser
 * and its docx exporter (Tiptap JSON → docx-engine), both pure apart from the
 * DOM the editor needs. Local images next to the markdown file are embedded
 * (path policy applies); remote ones fall back to their alt text, mermaid
 * diagrams to their source.
 */
async function markdownModules() {
  await ensureDom()
  const [{ Editor }, extensions, ops, docxExport] = await Promise.all([
    import('@tiptap/core'),
    import('../../../../apps/markdown/src/renderer/editor/extensions'),
    import('../../../../apps/markdown/src/renderer/editor/ops'),
    import('../../../../apps/markdown/src/renderer/export/docxExport'),
  ])
  return { Editor, extensions, ops, docxExport }
}

const NO_SLASH_MENU = {
  slashController: { onOpen() {}, onUpdate() {}, onKeyDown: () => false, onClose() {} },
  slashItems: () => [],
}

async function withMarkdownEditor<T>(
  markdown: string,
  fn: (
    editor: import('@tiptap/core').Editor,
    mods: Awaited<ReturnType<typeof markdownModules>>,
  ) => Promise<T>,
): Promise<T> {
  const mods = await markdownModules()
  const editor = new mods.Editor({
    extensions: mods.extensions.buildExtensions(NO_SLASH_MENU as never),
    content: '',
  })
  try {
    const nodes = mods.ops.parseMarkdownToNodes(editor, markdown)
    editor.commands.setContent({ type: 'doc', content: nodes.map((n) => n.toJSON()) })
    return await fn(editor, mods)
  } finally {
    editor.destroy()
  }
}

export interface MarkdownImageSource {
  /** the markdown file's location, for relative image paths */
  file: string
  ctx: PathContext
}

function isLatexFormulaLike(inner: string): boolean {
  if (inner.includes('^') || inner.includes('_') || inner.includes('=')) return true
  if (/\\[a-zA-Z]+/.test(inner)) return true
  if (/\d\s*[+\-*/<>|±×÷]|[+\-*/<>|±×÷]\s*\d/.test(inner)) return true
  return false
}

function normalizeMarkdownSegmentForDocx(text: string): string {
  // FX-46: Normalize escaped <br> variants to <br> so Tiptap / HTML parser converts them to line breaks
  let out = text
    .replace(/&amp;lt;br\s*\/?&amp;gt;/gi, '<br>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\\<br\s*\/?\\?>/gi, '<br>')

  // FX-46: Normalize \[...\] display/inline math delimiters
  out = out.replace(
    /\\\[([\s\S]+?)\\\]/g,
    (match: string, latex: string, offset: number, full: string) => {
      const inner = latex.trim()
      if (!inner || !isLatexFormulaLike(inner)) return match
      const before = full.slice(0, offset)
      const after = full.slice(offset + match.length)
      const lineStart = before.lastIndexOf('\n') + 1
      const beforeOnLine = before.slice(lineStart, offset)
      const nextNl = after.indexOf('\n')
      const afterOnLine = nextNl === -1 ? after : after.slice(0, nextNl)
      if (beforeOnLine.trim() === '' && afterOnLine.trim() === '') {
        return `\n\n$$\n${inner}\n$$\n\n`
      }
      return `$${inner.replace(/\r?\n/g, ' ').trim()}$`
    },
  )

  // FX-46: Convert inline $$...$$ (on a line with other text, e.g. table cells or list items) to $...$
  out = out.replace(
    /\$\$([^\n$]+?)\$\$/g,
    (match: string, latex: string, offset: number, full: string) => {
      const inner = latex.trim()
      if (!inner) return match
      const before = full.slice(0, offset)
      const after = full.slice(offset + match.length)
      const lineStart = before.lastIndexOf('\n') + 1
      const beforeOnLine = before.slice(lineStart, offset)
      const nextNl = after.indexOf('\n')
      const afterOnLine = nextNl === -1 ? after : after.slice(0, nextNl)
      if (beforeOnLine.trim() !== '' || afterOnLine.trim() !== '') {
        return `$${inner}$`
      }
      return match
    },
  )

  // FX-46: Convert \(...\) inline math and trim spaced $ ... $ outside display $$...$$ blocks
  return out
    .split(/(\$\$[\s\S]*?\$\$)/)
    .map((segment, index) => {
      if (index % 2 === 1) return segment
      let s = segment.replace(/\\\(([^\n]+?)\\\)/g, (match: string, latex: string) => {
        const inner = latex.trim()
        if (!inner || !isLatexFormulaLike(inner)) return match
        return `$${inner}$`
      })
      s = s.replace(
        /(?<!\\|\$)\$(?:\s+([^$\n]+?)\s*|\s*([^$\n]+?)\s+)\$(?!\$|\d)/g,
        (match: string, a?: string, b?: string) => {
          const inner = (a ?? b ?? '').trim()
          if (!inner || !isLatexFormulaLike(inner)) return match
          if (/^\d[\d.,]*\s+\S/.test(inner) && !/[\\^_=<>±×÷]/.test(inner)) return match
          return `$${inner}$`
        },
      )
      return s
    })
    .join('')
}

function normalizeMarkdownForDocx(markdown: string): string {
  const cleaned = sanitizeCliTextInput(markdown).replace(
    /\bkb-(?:ask-)?[a-z0-9_-]*\d[a-z0-9_-]*\b/gi,
    '',
  )
  return cleaned
    .split(
      /(^[ \t]*`{3,}[^\n]*\n[\s\S]*?^[ \t]*`{3,}[ \t]*$|^[ \t]*~{3,}[^\n]*\n[\s\S]*?^[ \t]*~{3,}[ \t]*$|`+[^`]*`+)/m,
    )
    .map((part, index) => (index % 2 ? part : normalizeMarkdownSegmentForDocx(part)))
    .join('')
}

export async function markdownToDocx(
  markdown: string,
  images?: MarkdownImageSource,
): Promise<Uint8Array> {
  // FX-03 / FX-34 / FX-46: Strip leaked internal markers and normalize math/<br> before parsing
  const cleaned = normalizeMarkdownForDocx(markdown)
  const hasLocalImages = /!\[[^\]]*\]\((?!(?:https?|data|blob):)[^)]+\)/i.test(cleaned)
  const isVnStructuredDoc =
    !hasLocalImages &&
    (/CỘNG HÒA XÃ HỘI|Độc lập\s*-\s*Tự do|Nơi nhận\s*:|Kính gửi\s*:|Căn cứ\s+(?:Luật|Bộ luật|Nghị định|Thông tư|Quyết định)/i.test(
      cleaned,
    ) ||
      /(?:^|\n)\s*#{1,3}\s*(?:HỢP ĐỒNG|QUYẾT ĐỊNH|TỜ TRÌNH|CÔNG VĂN|BIÊN BẢN|THÔNG BÁO|BÁO CÁO|QUY CHẾ|KẾ HOẠCH|MA TRẬN|BẢNG ĐẶC TẢ|PHIẾU ĐÁNH GIÁ|RUBRIC|ĐỀ KIỂM TRA|GIÁO ÁN)\b/im.test(
        cleaned,
      ))
  return withMarkdownEditor(cleaned, async (editor, mods) => {
    if (isVnStructuredDoc) {
      const bodyHtml = editor.getHTML()
      const doc = await blankDocument()
      try {
        fillFromHtml(doc, bodyHtml)
        return await saveDocument(doc)
      } finally {
        closeDocument(doc)
      }
    }
    return mods.docxExport.exportDocxBytes(editor.getJSON(), async (src) =>
      loadLocalImage(src, images),
    )
  })
}

async function loadLocalImage(src: string, images?: MarkdownImageSource) {
  if (!images || !src) return null
  // only real URL schemes are remote; a Windows drive letter (C:\...) is a path
  if (/^(https?|data|blob):/i.test(src)) return null
  const local = src.startsWith('file:') ? fileURLToPath(src) : src
  const candidates = [local]
  try {
    const decoded = decodeURI(local)
    if (decoded !== local) candidates.push(decoded)
  } catch {
    // a literal % in the file name is not an escape; the raw spelling is tried
  }
  const path = candidates
    .map((c) => (isAbsolute(c) ? c : resolve(dirname(images.file), c)))
    .find((c) => existsSync(c))
  if (!path) return null
  assertAllowed(path, images.ctx.env, 'read')
  const bytes = new Uint8Array(readFileSync(path))
  const size = imageSize(bytes)
  if (!size) return null
  return {
    base64: Buffer.from(bytes).toString('base64'),
    mime: size.mime,
    widthPx: size.width,
    heightPx: size.height,
  }
}

/** HTML (the docs editor's restricted subset or a plain page body) → GFM through the markdown editor's serializer. */
export async function htmlToMarkdown(html: string): Promise<string> {
  const mods = await markdownModules()
  const editor = new mods.Editor({
    extensions: mods.extensions.buildExtensions(NO_SLASH_MENU as never),
    content: html,
    contentType: 'html',
  })
  try {
    return editor.getMarkdown()
  } finally {
    editor.destroy()
  }
}

export async function markdownToHtml(markdown: string, title: string): Promise<string> {
  return withMarkdownEditor(markdown, async (editor) => {
    const body = editor.getHTML()
    return (
      '<!doctype html>\n<html><head><meta charset="utf-8">' +
      `<title>${escapeHtml(title)}</title></head>\n<body>\n${body}\n</body></html>\n`
    )
  })
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
}
