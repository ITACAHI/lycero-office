/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { TABLE_TRAILING_SKIP } from '../editor/extensions'
import { TRACK_IGNORE } from '../editor/revisions'
import { blockRangePositions, HTML_RULES, parseHtmlFragment, type NumIds } from './protocol'

/**
 * Long-form writing runs as its own tool-less request whose reply body IS the
 * restricted-HTML fragment. Text deltas stream straight into the document as
 * a draft, so the user watches the text arrive and no gateway sees a silent
 * connection (tool arguments are buffered server-side until the JSON is
 * complete; a document-sized argument exceeds gateway idle cutoffs).
 */
export const DOC_MAX_CHARS = 200_000
const CONTEXT_CAP = 8000
const DRAFT_TICK_MS = 300

export interface DocWriteSpec {
  plan: string
  title?: string | undefined
  context?: string | undefined
  /** the user's own request, verbatim */
  instruction: string
}

export interface DocWriteResult {
  ok: boolean
  /** the fragment to land (complete, or the adopted partial) */
  html?: string
  /** the stream ended early: transport drop, stop, or output cap */
  truncated?: boolean
  error?: string
}

/** Panel-owned writer: streams the fragment, reports progress, settles partial output with the user. */
export interface AiDocWriter {
  write(
    spec: DocWriteSpec,
    onProgress: (html: string) => void,
    signal?: AbortSignal,
  ): Promise<DocWriteResult>
}

const WRITER_SYSTEM = [
  'You are the document writer of Lycero Office Docs, a Word-style editor. You receive a plan (title, sections, key points, tone, length) and reference material, and you write the complete content.',
  '',
  '## Writing & Legal Compliance Rules (2025–2026)',
  '- Write the requested content in full: every section in the plan, real prose.',
  '- STRICT ZERO-HALLUCINATION RULE (A.1): NEVER fabricate phone numbers, emails, addresses, CCCD numbers, GCN (Red Book) numbers, contract/invoice/document numbers, suppliers, cost norms, persons in charge, internal legal bases, opinions, or tasks not present in the prompt. For any missing information, write `"[cần bổ sung: ...]"` (never leave raw `{{PLACEHOLDER}}` variables like `{{SO_TO_TRINH}}` or `{{NGAY}}`).',
  '- TWO-TIER ADMINISTRATIVE GEOGRAPHY FROM 01/07/2025 (A.3, FX-07, FX-08): NEVER use district-level units (`quận`, `huyện`, `thị xã`, `thành phố thuộc tỉnh`). Courts: use **`TAND khu vực`** (`Nghị quyết 81/2025/UBTVQH15`, warn if prompt mentions old district court). Tax authorities: use **`Thuế cơ sở`** (e.g. `Thuế cơ sở 7 TP. Hồ Chí Minh`).',
  '- 2025–2026 VIETNAMESE LEGAL UPDATES (B.1–B.10):',
  '  + Accounting (`FX-05`): Cite **`Thông tư 99/2025/TT-BTC` (effective 01/01/2026)** instead of `TT 200/2014/TT-BTC`.',
  '  + Personal Income Tax 2026 (`FX-11`): Personal deduction **15,5 triệu đồng/tháng**, dependent deduction **6,2 triệu đồng/tháng** (`Nghị quyết 110/2025/UBTVQH15`), **5-bracket** progressive tariff (`Luật Thuế TNCN số 109/2025/QH15`).',
  '  + Personal Data Protection (`FX-06`): Cite **`Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15` + `Nghị định 356/2025/NĐ-CP` (effective 01/01/2026)** instead of `NĐ 13/2023/NĐ-CP`.',
  '  + Civil Petitions & Commercial Sanctions (`FX-07`, `FX-10`): Statement of Claim follows **Mẫu số 23-DS (`Nghị quyết 01/2017/NQ-HĐTP`**, never NQ04); cite **Điều 307 Luật Thương mại 2005** when combining penalty (8% cap under Điều 301) and damages.',
  '  + Electronic Invoices (`FX-27`): Cite **`Nghị định 123/2020/NĐ-CP` được sửa đổi, bổ sung bởi `Nghị định 70/2025/NĐ-CP` (effective 01/06/2025)**.',
  '  + Social Insurance & Employment (`FX-28`, `FX-42`): Cite **`Luật BHXH số 41/2024/QH15` (effective 01/07/2025)** and **`Luật Việc làm số 74/2025/QH15` (effective 01/01/2026)**; severance/termination settlement deadline is **14 working days (Điều 48 Bộ luật Lao động 2019)**; non-discrimination warnings must cite **Bộ luật Lao động 2019 (Khoản 8 Điều 3, Khoản 1 Điều 8)**, **Luật Việc làm số 74/2025/QH15 (Khoản 7 Điều 2, Khoản 1 Điều 5)**, and **Luật Bình đẳng giới 2006**.',
  '  + Corporate Income Tax (`FX-36`): Cite **`Luật Thuế TNDN số 67/2025/QH15`** (replace `TT 78/2014`, `TT 96/2015`, `NĐ 320/2025`, `NQ 204/2025`).',
  '- If the plan or reference material provides structural HTML tables (`<table>`), preserve all `<table>` structures. Do NOT flatten tables into plain `<p>` lines.',
  '- For Vietnamese administrative documents (Nghị định 30/2020/NĐ-CP: Công văn, Tờ trình, Quyết định, Thông báo, Biên bản hành chính) and formal contracts (EXCLUDING education lesson plans/exams), follow these NĐ 30/2020/NĐ-CP rules (`FX-12`, `FX-13`, `FX-14`):',
  '  1. Header 2-column borderless `<table style="width: 100%; border: none; border-collapse: collapse;">` using `<td>` cells (never `<th>`), with both columns starting on the exact same top line (`vertical-align: top`):',
  '     - Left `<td style="width: 40%; text-align: center; vertical-align: top; border: none;">`: `<p style="margin: 0;">TÊN CƠ QUAN CHỦ QUẢN</p><p style="margin: 0;"><strong><u>TÊN CƠ QUAN, TỔ CHỨC BAN HÀNH</u></strong></p><p style="margin: 4px 0 0 0;">Số: [cần bổ sung: số văn bản]</p>` (with an independent horizontal rule 1/3–1/2 width below the issuing organization name).',
  '     - Right `<td style="width: 60%; text-align: center; vertical-align: top; border: none;">`: wide enough so Quốc hiệu never wraps: `<p style="margin: 0;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p><p style="margin: 0;"><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p><p style="margin: 4px 0 0 0;"><em>..., ngày ... tháng ... năm ...</em></p>`',
  '  2. Main Document Title (`<h1>` centered, uppercase, bold, 14pt): `<h1 style="text-align: center;"><strong>TÊN LOẠI VĂN BẢN IN HOA</strong></h1>` and centered Subtitle / Trích yếu: `<p style="text-align: center;"><strong>Về việc ...</strong></p>` (with an independent horizontal rule 1/3–1/2 width below Trích yếu) followed by `<p style="text-align: center;"><strong>Kính gửi: ...</strong></p>`.',
  '  3. Legal & factual bases (`Căn cứ`, `FX-12`): each `Căn cứ` MUST be its own separate `<p style="text-align: left;"><em>Căn cứ ...;</em></p>` paragraph (italic, left-aligned; NEVER join multiple `Căn cứ` lines with `<br>`). Every `Căn cứ` line ends with `";"`, and the **FINAL `Căn cứ` line MUST end with a period `"."`**. For **Luật / Bộ luật** per Phụ lục I NĐ30, write ONLY the Law title without `số .../QH...` (e.g. `Căn cứ Bộ luật Lao động ngày 20 tháng 11 năm 2019;`). NEVER fabricate internal decisions/resolutions not in the prompt.',
  '  4. 6-column budget/cost tables (`STT`, `Nội dung chi`, `ĐVT`, `SL`, `Đơn giá`, `Thành tiền`): use proportional column widths (`8%`, `42%`, `10%`, `8%`, `15%`, `17%`), bold centered `<th>` headers, right-aligned numbers/amounts with Vietnamese dot thousand separators (`45.000.000`), a bold `TỔNG CỘNG` row with full Vietnamese diacritics, and `<p><em>Số tiền bằng chữ: ... đồng chẵn.</em></p>` immediately below. Note (`FX-14`): Personnel list tables must NOT include `ĐVT` or `SL` columns; keep `Điều` headings on the same page with their content.',
  '  5. Closing paragraph + 2-column borderless signature `<table style="width: 100%; border: none; border-collapse: collapse;">` kept on the same page (`keepNext`): Left `<td style="width: 45%; text-align: left; vertical-align: top; border: none;">` has `<p><strong><em>Nơi nhận:</em></strong></p><p>- Như trên;</p><p>- Lưu: VT.</p>`; Right `<td style="width: 55%; text-align: center; vertical-align: top; border: none;">` has `<p><strong>CHỨC VỤ NGƯỜI KÝ</strong></p><p></p><p></p><p></p><p><strong>Họ và tên người ký</strong></p>` — **DO NOT write the line `"(Ký, ghi rõ...)"`** (`FX-13`).',
  '  6. Statutory Vietnamese Forms, Education Documents & Specialized Rules:',
  '     - **Education Lesson Plans (`CV 5512`, `FX-40`), Primary Lesson Plans (`CV 2345`), Exam Matrices (`CV 7991`, `FX-09`, `FX-22`), Student Evaluations (`TT 22`, `FX-39`), and Rubrics (`FX-23`)**:',
  '       + **STRICTLY NO Quốc hiệu - Tiêu ngữ (`CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM`), NO district-level UBND/Phòng GD&ĐT, NO administrative legal bases (`Căn cứ...`), and NO administrative file code (`Số: .../KHBD`)**.',
  '       + Lesson plan CV 5512 follows Phụ lục IV: **I. Mục tiêu** (1. Kiến thức, 2. Năng lực, 3. Phẩm chất), **II. Thiết bị dạy học và học liệu**, **III. Tiến trình dạy học** (4 activities: Mở đầu, Hình thành kiến thức mới, Luyện tập, Vận dụng; each activity MUST have *a) Mục tiêu, b) Nội dung, c) Sản phẩm, d) Tổ chức thực hiện*; total time ≤ 90 minutes for 2 periods).',
  '       + Exam Matrix & Periodic Exam follows **Công văn 7991/BGDĐT-GDTrH**: **3 cognitive levels** (*Nhận biết – Thông hiểu – Vận dụng*, drop old 4th level Vận dụng cao); **4 parts**: Nhiều lựa chọn (~3,0đ), Đúng–Sai (~2,0đ), Trả lời ngắn (~2,0đ), Tự luận (~3,0đ); row/column sum = 10,0; balanced A/B/C/D keys; compact layout.',
  '       + Rubrics (`FX-23`): score thresholds between levels must be continuous and closed with zero gaps or overlaps (never leave a gap between 8,0 and 8,5 or 2,125 and 2,8).',
  '       + Student evaluation (`FX-39`): follow **Điều 9 Thông tư 22/2021/TT-BGDĐT** (never misclassify 6,5 as Chưa đạt; count subjects ≥ 8,0 accurately).',
  '     - **Real Estate Transfer Contract (`Nghị định 96/2024/NĐ-CP`, `FX-38`)**: Payment schedule installments MUST sum to exactly **100%** of total transfer value (never 95% or mismatched amounts).',
  '     - **Meeting Minutes (`FX-16`)**: Include ONLY information from input; 100% Vietnamese labels (*Kết luận*, *Vấn đề còn mở*, *Phân công thực hiện* — never *Action Items*).',
  '     - **Accounting Vouchers (`Mẫu 05-TT / 03-TT / 04-TT - Thông tư 99/2025/TT-BTC`, `FX-05`)**: Cite `Thông tư 99/2025/TT-BTC` (effective 01/01/2026).',
  '- Never insert an English disclaimer line or internal session IDs (`kb-...`) inside a document.',
  '',
  '## Output',
  'Reply with the restricted HTML fragment only: it starts with the first block tag and ends with the last closing tag. No markdown code fences, no commentary before or after, no <html>/<body> wrapper.',
  HTML_RULES,
].join('\n')

export function buildDocWriterRequest(
  spec: DocWriteSpec,
  langDirective: string,
): { system: string; user: string } {
  const context = spec.context?.trim()
    ? `\n\n## Reference material (all names, figures and facts come from here)\n${spec.context.slice(0, CONTEXT_CAP)}`
    : ''
  const instruction = spec.instruction.trim()
    ? `\n\n## The user's request\n${spec.instruction.slice(0, 2000)}`
    : ''
  return {
    system: `[LYCERO_PIPELINE_STAGE:doc_longform]\n${WRITER_SYSTEM}${langDirective}`,
    user: `## Plan\n${spec.title ? `Title: ${spec.title}\n` : ''}${spec.plan.slice(0, 6000)}${context}${instruction}\n\nWrite the content now.`,
  }
}

/** Strip a fence or chatter before the first block tag and a closing fence at the end. */
export function extractFragment(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n')
  const start = text.search(/<(?:h[1-6]|p|ul|ol|table|pre|blockquote|formula)[\s>]/i)
  if (start > 0) text = text.slice(start)
  else if (start < 0) text = text.replace(/^\s*```[a-z]*\n?/i, '')
  return text.replace(/\n?```\s*$/, '').trimEnd()
}

/** rough top-level block count of a fragment, for the progress chip */
export function countFragmentBlocks(html: string): number {
  return (html.match(/<(?:h[1-6]|p|ul|ol|table|pre|blockquote|formula)[\s>]/gi) ?? []).length
}

export type WritePosition = { kind: 'whole' } | { kind: 'after'; index: number }

/** meta on every draft transaction: not an edit, not history, not a tracked change */
export const DRAFT_META = 'aiDraft'

/**
 * Live draft of a streaming fragment inside the document. Each tick re-parses
 * the fragment received so far (the HTML parser closes open tags, so a
 * half-received block still renders) and swaps only the blocks that changed.
 * The draft is outside undo history and Track Changes; `finish()` removes it
 * so the caller can land the final fragment through the regular insert path,
 * giving one undo step and normal revision marks.
 */
export class DraftLanding {
  private from: number
  private to: number
  /** the text of the last tick that parsed and rendered */
  private rendered: string | null = null
  private pending: string | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private follow = true
  private readonly onTransaction = ({ transaction }: { transaction: Transaction }) => {
    if (!transaction.docChanged || transaction.getMeta(DRAFT_META)) return
    this.from = transaction.mapping.map(this.from, 1)
    this.to = Math.max(this.from, transaction.mapping.map(this.to, -1))
  }

  constructor(
    private readonly editor: Editor,
    private readonly numIds: NumIds,
    position: WritePosition,
  ) {
    this.from =
      position.kind === 'after' && position.index >= 0
        ? blockRangePositions(editor, position.index, position.index).to
        : 0
    this.to = this.from
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __lyceroAiDraftActive?: boolean }).__lyceroAiDraftActive = true
    }
    editor.on('transaction', this.onTransaction)
  }

  /** latest cumulative fragment; rendered on the next tick */
  update(html: string): void {
    if (this.closed) return
    this.pending = html
    if (this.timer === null) this.timer = setTimeout(() => this.flush(), DRAFT_TICK_MS)
  }

  /** the top-level block index the draft sits after (-1 = document start), after any user edits */
  indexBefore(): number {
    const doc = this.editor.state.doc
    let index = -1
    let i = 0
    doc.forEach((node, offset) => {
      if (offset + node.nodeSize <= this.from) index = i
      i++
    })
    return index
  }

  /**
   * Remove the draft; the document is back to what it was around it. Returns the
   * text of the last tick that rendered, so a kept stream whose tail no longer
   * parses (a half-received formula or table) can still land what the user saw.
   */
  finish(): string | null {
    if (this.closed) return this.rendered
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.flush()
    this.closed = true
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __lyceroAiDraftActive?: boolean }).__lyceroAiDraftActive = false
    }
    this.editor.off('transaction', this.onTransaction)
    if (this.to > this.from && !this.editor.isDestroyed) {
      this.editor.view.dispatch(this.draftTr().delete(this.from, this.to))
    }
    this.to = this.from
    return this.rendered
  }

  /** live top-level blocks inside the draft range, after any user edits */
  private liveNodes(): Array<{ node: ProseMirrorNode; end: number }> {
    const out: Array<{ node: ProseMirrorNode; end: number }> = []
    this.editor.state.doc.forEach((node, offset) => {
      if (offset >= this.from && offset + node.nodeSize <= this.to)
        out.push({ node, end: offset + node.nodeSize })
    })
    return out
  }

  private draftTr(): Transaction {
    return this.editor.state.tr
      .setMeta(DRAFT_META, true)
      .setMeta('addToHistory', false)
      .setMeta(TRACK_IGNORE, true)
      .setMeta(TABLE_TRAILING_SKIP, true)
  }

  private flush(): void {
    this.timer = null
    if (this.closed || this.pending === null || this.editor.isDestroyed) return
    const html = this.pending
    this.pending = null
    let next: ProseMirrorNode[]
    try {
      const stripAiChangedJson = (n: ReturnType<typeof parseHtmlFragment>[number]): ReturnType<typeof parseHtmlFragment>[number] => {
        const base = n.attrs ? { ...n, attrs: { ...n.attrs, aiChanged: false } } : n
        if (!base.content?.length) return base
        return { ...base, content: base.content.map(stripAiChangedJson) }
      }
      next = parseHtmlFragment(html, this.numIds).map((n) =>
        this.editor.schema.nodeFromJSON(stripAiChangedJson(n)),
      )
    } catch {
      return // a half-received formula or table is retried on the next tick
    }
    this.rendered = html
    // compare against the live document: a user edit inside the draft changes sizes and drops that block from the kept prefix
    const live = this.liveNodes()
    let keep = 0
    while (keep < live.length && keep < next.length && live[keep]!.node.eq(next[keep]!)) keep++
    if (keep === live.length && keep === next.length) return
    const at = keep > 0 ? live[keep - 1]!.end : this.from
    const wasVisible = this.follow && this.endVisible()
    this.editor.view.dispatch(this.draftTr().replaceWith(at, this.to, next.slice(keep)))
    this.to = at + next.slice(keep).reduce((size, n) => size + n.nodeSize, 0)
    if (wasVisible) this.scrollToEnd()
    else this.follow = false
  }

  private endVisible(): boolean {
    if (this.to === this.from) return true
    try {
      const { top } = this.editor.view.coordsAtPos(this.to - 1)
      return top >= 0 && top <= window.innerHeight
    } catch {
      return true
    }
  }

  private scrollToEnd(): void {
    if (this.to === this.from) return
    try {
      const { node } = this.editor.view.domAtPos(this.to - 1)
      const el = node instanceof Element ? node : node.parentElement
      el?.scrollIntoView?.({ block: 'nearest' })
    } catch {
      /* layout not ready */
    }
  }
}
