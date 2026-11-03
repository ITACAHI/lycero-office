/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import type { JSONContent } from '@tiptap/core'
import {
  BLANK_BULLET_NUM_ID,
  TABLE_HEADER_FILL,
  buildBlankDocx,
  generateTableModelXml,
  latexToOmml,
  mathParagraphXml,
  parseDocx,
  saveDocx,
} from '@lycero/docx-engine'
import type {
  GeneratedBlock,
  NewImage,
  ParaFormat,
  Run,
  SaveBlock,
  SaveOptions,
  TableCell,
  TableModel,
  TableParagraph,
} from '@lycero/docx-engine'
import { diagramLanguage } from '../editor/diagrams'
import type { DiagramLanguage } from '../editor/diagrams'

/** Resolve an authored image src to embeddable bytes; null → fall back to alt text */
export type ImageLoader = (src: string) => Promise<NewImage | null>

/** Rasterize a diagram code block; null → the source is exported as code */
export type DiagramRenderer = (
  source: string,
  language: DiagramLanguage,
) => Promise<NewImage | null>

/** widest image that fits the A4 text column */
export const DOCX_MAX_IMAGE_PX = 620

export interface DocxMapping {
  blocks: SaveBlock[]
  options: SaveOptions
}

const MAX_LIST_LEVEL = 4
const INDENT_STEP = 360
/** decimal abstractNum of the blank template (numbering.xml: 0 = bullet, 1 = decimal) */
const DECIMAL_ABSTRACT_NUM_ID = '1'
const CODE_FONT = 'Consolas'
const CODE_FILL = 'F2F3F5'

// ── inline content → Run[] ──

const BARE_LATEX_SYMBOL_MAP: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  times: '×',
  div: '÷',
  cdot: '·',
  pm: '±',
  mp: '∓',
  leq: '≤',
  le: '≤',
  geq: '≥',
  ge: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  equiv: '≡',
  sim: '∼',
  simeq: '≃',
  cong: '≅',
  propto: '∝',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  forall: '∀',
  exists: '∃',
  nexists: '∄',
  in: '∈',
  notin: '∉',
  ni: '∋',
  subset: '⊂',
  supset: '⊃',
  subseteq: '⊆',
  supseteq: '⊇',
  cup: '∪',
  cap: '∩',
  setminus: '∖',
  emptyset: '∅',
  varnothing: '∅',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  iff: '⇔',
  implies: '⇒',
  mapsto: '↦',
  uparrow: '↑',
  downarrow: '↓',
  perp: '⊥',
  parallel: '∥',
  angle: '∠',
  measuredangle: '∡',
  triangle: '△',
  bigtriangleup: '△',
  degree: '°',
  circ: '°',
  dots: '…',
  ldots: '…',
  cdots: '⋯',
  therefore: '∴',
  because: '∵',
}

function normalizeBrAndMarkers(text: string): string {
  return text
    .replace(/\[PII_[A-Z0-9_]+(?:\]|\b)/g, '')
    .replace(/\[LYCERO_[A-Z0-9_]+\]/g, '')
    .replace(/\bkb-(?:ask-)?\d{8,}(?:-[a-z0-9]+)*\b/gi, '')
    .replace(/\bkb-ask-[a-z0-9_-]*\d[a-z0-9_-]*\b/gi, '')
    .replace(/&amp;lt;br\s*\/?&amp;gt;/gi, '\n')
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/\\<br\s*\/?\\?>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
}

function cleanBareLatexInText(text: string): string {
  if (!text.includes('\\') && !text.includes('^')) return text
  let s = text
  s = s.replace(/\^\{\\circ\}/g, '°').replace(/\^\\circ\b/g, '°')
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    s = s.replace(/\\sqrt\[([^{}[\]]*)\]\{([^{}]*)\}/g, '√($2)')
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    s = s.replace(/\\(?:widehat|hat)\{([^{}]*)\}/g, '∠$1')
    s = s.replace(/\\(?:overline|bar|overrightarrow|vec)\{([^{}]*)\}/g, '$1')
    s = s.replace(/\\(?:text|textbf|textit|textrm|mathrm|mathbf|mathit|mathbb|mathcal)\{([^{}]*)\}/g, '$1')
  }
  s = s.replace(/\\([a-zA-Z]+)(?![a-zA-Z])/g, (match, cmd: string) => BARE_LATEX_SYMBOL_MAP[cmd] ?? match)
  return s
}

const LEFTOVER_INLINE_MATH_RE =
  /\$\$([^\n$]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([^\n]+?)\\\)|(?<!\\|\$)\$(?!\$)([^$\n]+?)\$(?!\$|\d)/g

function isFormulaCandidate(inner: string): boolean {
  if (inner.includes('^') || inner.includes('_') || inner.includes('=')) return true
  if (/\\[a-zA-Z]+/.test(inner)) return true
  if (/\d\s*[+\-*/<>|±×÷]|[+\-*/<>|±×÷]\s*\d/.test(inner)) return true
  return false
}

function applyInlineMarks(base: Run, marks: JSONContent['marks']): Run {
  const run: Run = { ...base }
  for (const mark of marks ?? []) {
    if (mark.type === 'bold') run.bold = true
    else if (mark.type === 'italic') run.italic = true
    else if (mark.type === 'strike') run.strike = true
    else if (mark.type === 'code') run.font = CODE_FONT
    else if (mark.type === 'link' && typeof mark.attrs?.href === 'string') {
      run.link = { href: mark.attrs.href }
    }
  }
  return run
}

function runsFromInline(content: JSONContent[] | undefined): Run[] {
  const runs: Run[] = []
  for (const child of content ?? []) {
    if (child.type === 'hardBreak') {
      runs.push({ text: '\n' })
      continue
    }
    if (child.type === 'inlineMath') {
      const latex = String(child.attrs?.latex ?? '').trim()
      if (latex) {
        try {
          const inner = latexToOmml(latex)
          const omml = `<m:oMath>${inner}</m:oMath>`
          runs.push({
            text: `$${latex}$`,
            font: CODE_FONT,
            math: { omml },
          })
        } catch {
          runs.push({ text: `$${latex}$`, font: CODE_FONT })
        }
      }
      continue
    }
    if (child.type === 'image') {
      runs.push(altTextRun(child))
      continue
    }
    if (child.type === 'footnoteReference') {
      runs.push({ text: `[^${String(child.attrs?.label ?? '')}]` })
      continue
    }
    if (child.type !== 'text' || !child.text) continue
    const rawText = normalizeBrAndMarkers(child.text)
    if (!rawText) continue
    const hasCodeMark = (child.marks ?? []).some((m) => m.type === 'code')
    if (hasCodeMark) {
      runs.push(applyInlineMarks({ text: rawText }, child.marks))
      continue
    }
    LEFTOVER_INLINE_MATH_RE.lastIndex = 0
    let lastIdx = 0
    let m: RegExpExecArray | null
    while ((m = LEFTOVER_INLINE_MATH_RE.exec(rawText)) !== null) {
      const candidate = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim()
      const isSingleDollar = m[4] !== undefined
      if (
        !candidate ||
        (isSingleDollar &&
          (!isFormulaCandidate(candidate) ||
            (/^\d[\d.,]*\s+\S/.test(candidate) && !/[\\^_=<>±×÷]/.test(candidate))))
      ) {
        continue
      }
      if (m.index > lastIdx) {
        const plainSeg = cleanBareLatexInText(rawText.slice(lastIdx, m.index))
        if (plainSeg) runs.push(applyInlineMarks({ text: plainSeg }, child.marks))
      }
      try {
        const inner = latexToOmml(candidate)
        runs.push(
          applyInlineMarks(
            {
              text: `$${candidate}$`,
              font: CODE_FONT,
              math: { omml: `<m:oMath>${inner}</m:oMath>` },
            },
            child.marks,
          ),
        )
      } catch {
        const cleaned = cleanBareLatexInText(candidate)
        runs.push(applyInlineMarks({ text: cleaned, font: CODE_FONT }, child.marks))
      }
      lastIdx = m.index + m[0].length
    }
    if (lastIdx < rawText.length) {
      const tail = cleanBareLatexInText(rawText.slice(lastIdx))
      if (tail) runs.push(applyInlineMarks({ text: tail }, child.marks))
    }
  }
  return runs
}

function plainText(node: JSONContent): string {
  if (node.type === 'text') return normalizeBrAndMarkers(node.text ?? '')
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'inlineMath') return String(node.attrs?.latex ?? '')
  return (node.content ?? []).map(plainText).join('')
}

// ── mapping walker ──

interface WalkContext {
  blocks: SaveBlock[]
  restartNums: NonNullable<NonNullable<SaveOptions['numbering']>['restartNums']>
  nextOrderedNumId: number
  loadImage: ImageLoader
  renderDiagram?: DiagramRenderer
  pendingImages: Array<{ index: number; src: string; alt: string }>
  pendingDiagrams: Array<{ index: number; source: string; language: DiagramLanguage }>
}

function mergeFormat(base: ParaFormat | undefined, extra: ParaFormat): ParaFormat {
  return { ...base, ...extra, indentLeft: (base?.indentLeft ?? 0) + (extra.indentLeft ?? 0) }
}

function pushParagraph(ctx: WalkContext, block: GeneratedBlock): void {
  ctx.blocks.push({ kind: 'generated', block })
}

function altTextRun(image: JSONContent): Run {
  const alt = String(image.attrs?.alt ?? '') || String(image.attrs?.src ?? '')
  return { text: `[${alt}]`, italic: true, color: '888888' }
}

/**
 * Runs cannot carry pictures: each inline image becomes a picture block of its
 * own (a placeholder until the async load), the text around it its own block.
 */
function pushTextblock(
  ctx: WalkContext,
  content: JSONContent[] | undefined,
  block: (runs: Run[]) => GeneratedBlock,
): void {
  if (!content?.some((child) => child.type === 'image')) {
    pushParagraph(ctx, block(runsFromInline(content)))
    return
  }
  let segment: JSONContent[] = []
  const flush = () => {
    if (segment.some((child) => child.type !== 'text' || child.text?.trim())) {
      pushParagraph(ctx, block(runsFromInline(segment)))
    }
    segment = []
  }
  for (const child of content) {
    if (child.type !== 'image') {
      segment.push(child)
      continue
    }
    flush()
    ctx.pendingImages.push({
      index: ctx.blocks.length,
      src: String(child.attrs?.src ?? ''),
      alt: String(child.attrs?.alt ?? ''),
    })
    ctx.blocks.push({ kind: 'generated', block: { type: 'paragraph', runs: [] } })
  }
  flush()
}

function walkList(
  ctx: WalkContext,
  node: JSONContent,
  kind: 'bullet' | 'ordered',
  ilvl: number,
  numId: string,
  base?: ParaFormat,
): void {
  for (const item of node.content ?? []) {
    if (item.type !== 'listItem' && item.type !== 'taskItem') continue
    let firstPara = true
    for (const child of item.content ?? []) {
      if (child.type === 'paragraph') {
        const runs = runsFromInline(child.content)
        if (item.type === 'taskItem') {
          runs.unshift({ text: item.attrs?.checked ? '☑ ' : '☐ ' })
        }
        if (firstPara && item.type !== 'taskItem') {
          pushParagraph(ctx, {
            type: 'listItem',
            list: { kind, numId, ilvl: Math.min(ilvl, MAX_LIST_LEVEL) },
            runs,
            format: base,
          })
        } else {
          // task items and continuation paragraphs indent under the marker
          pushParagraph(ctx, {
            type: 'paragraph',
            runs,
            format: mergeFormat(base, { indentLeft: INDENT_STEP * (ilvl + 1) }),
          })
        }
        firstPara = false
      } else if (child.type === 'bulletList' || child.type === 'taskList') {
        walkList(ctx, child, 'bullet', ilvl + 1, BLANK_BULLET_NUM_ID, base)
      } else if (child.type === 'orderedList') {
        walkList(ctx, child, 'ordered', ilvl + 1, allocOrderedNumId(ctx), base)
      } else {
        walkBlock(ctx, child, mergeFormat(base, { indentLeft: INDENT_STEP * (ilvl + 1) }))
      }
    }
  }
}

function allocOrderedNumId(ctx: WalkContext): string {
  const numId = String(ctx.nextOrderedNumId++)
  ctx.restartNums.push({
    numId,
    abstractNumId: DECIMAL_ABSTRACT_NUM_ID,
    startOverrides: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 },
  })
  return numId
}

function tableParagraphs(cell: JSONContent): TableParagraph[] {
  const paras: TableParagraph[] = []
  for (const child of cell.content ?? []) {
    if (child.type === 'paragraph') paras.push({ runs: runsFromInline(child.content) })
  }
  return paras.length > 0 ? paras : [{ runs: [] }]
}

function mapTable(node: JSONContent): TableModel {
  const rows: TableCell[][] = []
  for (const row of node.content ?? []) {
    if (row.type !== 'tableRow') continue
    const cells: TableCell[] = []
    for (const cell of row.content ?? []) {
      if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') continue
      const isHeader = cell.type === 'tableHeader'
      const rich = tableParagraphs(cell)
      cells.push({
        paras: rich.map((p) => p.runs.map((r) => r.text).join('')),
        richParas: rich,
        ...(Number(cell.attrs?.colspan) > 1 ? { colSpan: Number(cell.attrs?.colspan) } : {}),
        ...(isHeader ? { bold: true, fill: TABLE_HEADER_FILL } : {}),
      })
    }
    if (cells.length > 0) rows.push(cells)
  }
  return { rows }
}

function walkBlock(ctx: WalkContext, node: JSONContent, base?: ParaFormat): void {
  switch (node.type) {
    case 'paragraph': {
      const pText = plainText(node).trim()
      const isKeepNextPara =
        /^(?:Điều\s+\d+|Chương\s+[IVXLCDM\d]+|Mục\s+[IVXLCDM\d]+|Phần\s+[IVXLCDM\d]+|[IVXLCDM]+\.\s+[A-ZÀ-Ỹ]|Bảng\s+\d+|Phụ lục(?:\s+\d+)?|Hoạt động\s+\d+)\b/i.test(
          pText,
        )
      const fmt = isKeepNextPara ? mergeFormat(base, { keepNext: true, keepLines: true }) : base
      pushTextblock(ctx, node.content, (runs) => ({ type: 'paragraph', runs, format: fmt }))
      break
    }
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6) as number
      const fmt = mergeFormat(base, { keepNext: true, keepLines: true })
      pushTextblock(ctx, node.content, (runs) => ({ type: 'heading', level, runs, format: fmt }))
      break
    }
    case 'bulletList':
      walkList(ctx, node, 'bullet', 0, BLANK_BULLET_NUM_ID, base)
      break
    case 'orderedList':
      walkList(ctx, node, 'ordered', 0, allocOrderedNumId(ctx), base)
      break
    case 'taskList':
      walkList(ctx, node, 'bullet', 0, BLANK_BULLET_NUM_ID, base)
      break
    case 'blockquote':
      for (const child of node.content ?? []) {
        walkBlock(ctx, child, mergeFormat(base, { indentLeft: INDENT_STEP, borders: 'l' }))
      }
      break
    case 'codeBlock': {
      const source = plainText(node)
      const code: GeneratedBlock = {
        type: 'paragraph',
        runs: [{ text: source, font: CODE_FONT, sizeHalfPoints: 19 }],
        format: mergeFormat(base, { shadingFill: CODE_FILL }),
      }
      const language = diagramLanguage(node.attrs?.language)
      if (language && ctx.renderDiagram && source.trim()) {
        ctx.pendingDiagrams.push({ index: ctx.blocks.length, source, language })
      }
      pushParagraph(ctx, code)
      break
    }
    case 'horizontalRule':
      pushParagraph(ctx, {
        type: 'paragraph',
        runs: [],
        format: mergeFormat(base, { borders: 'b' }),
      })
      break
    case 'table':
      ctx.blocks.push({ kind: 'xml', xml: generateTableModelXml(mapTable(node)) })
      break
    case 'blockMath': {
      const latex = String(node.attrs?.latex ?? '')
      try {
        ctx.blocks.push({ kind: 'xml', xml: mathParagraphXml(latexToOmml(latex)) })
      } catch {
        // LaTeX outside the OMML converter's subset: keep the source visible
        pushParagraph(ctx, {
          type: 'paragraph',
          runs: [{ text: `$$${latex}$$`, font: CODE_FONT }],
          format: base,
        })
      }
      break
    }
    case 'footnoteDefinition': {
      // docx has its own footnote model; until it is mapped, the note stays a
      // visible paragraph in the label's own `[^label]: ` form
      const label = String(node.attrs?.label ?? '')
      const runs: Run[] = [{ text: `[^${label}]: ` }]
      let first = true
      for (const child of node.content ?? []) {
        if (!first) runs.push({ text: ' ' })
        first = false
        runs.push(...runsFromInline(child.content))
      }
      pushParagraph(ctx, {
        type: 'paragraph',
        runs,
        format: mergeFormat(base, { indentLeft: INDENT_STEP }),
      })
      break
    }
    default: {
      // unknown block: keep its text so nothing silently disappears
      const text = plainText(node)
      if (text.trim()) pushParagraph(ctx, { type: 'paragraph', runs: [{ text }], format: base })
    }
  }
}

/** Map a ProseMirror document to docx-engine SaveBlocks (pure except image loading) */
export async function mapDocToSaveBlocks(
  doc: JSONContent,
  loadImage: ImageLoader,
  renderDiagram?: DiagramRenderer,
): Promise<DocxMapping> {
  const ctx: WalkContext = {
    blocks: [],
    restartNums: [],
    nextOrderedNumId: 100,
    loadImage,
    renderDiagram,
    pendingImages: [],
    pendingDiagrams: [],
  }
  for (const node of doc.content ?? []) walkBlock(ctx, node)

  // Keep caption / intro paragraphs attached to the table that immediately follows them
  for (let i = 0; i < ctx.blocks.length - 1; i++) {
    const cur = ctx.blocks[i]!
    const next = ctx.blocks[i + 1]!
    if (
      cur.kind === 'generated' &&
      next.kind === 'xml' &&
      next.xml.startsWith('<w:tbl>')
    ) {
      cur.block.format = { ...cur.block.format, keepNext: true, keepLines: true }
    }
  }

  for (const pending of ctx.pendingDiagrams) {
    const image = await ctx.renderDiagram!(pending.source, pending.language).catch(() => null)
    if (image) ctx.blocks[pending.index] = { kind: 'image', image }
  }

  for (const pending of ctx.pendingImages) {
    const image = await loadImage(pending.src).catch(() => null)
    if (image) {
      ctx.blocks[pending.index] = { kind: 'image', image }
    } else {
      ctx.blocks[pending.index] = {
        kind: 'generated',
        block: { type: 'paragraph', runs: [altTextRun({ attrs: pending })] },
      }
    }
  }

  const options: SaveOptions =
    ctx.restartNums.length > 0 ? { numbering: { restartNums: ctx.restartNums } } : {}
  return { blocks: ctx.blocks, options }
}

/** md document (PM JSON) → brand-new .docx bytes, fully local */
export async function exportDocxBytes(
  doc: JSONContent,
  loadImage: ImageLoader,
  renderDiagram?: DiagramRenderer,
): Promise<Uint8Array> {
  const mapping = await mapDocToSaveBlocks(doc, loadImage, renderDiagram)
  const parsed = await parseDocx(await buildBlankDocx())
  return saveDocx(parsed, mapping.blocks, mapping.options)
}
