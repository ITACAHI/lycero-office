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
  '## Writing rules',
  '- Write the requested content in full: every section in the plan, real prose, no "[to be added]" notes.',
  '- If the plan or reference material provides a template or structural HTML tables (`<table>`), preserve all `<table>` structures (e.g. 2-column Quốc hiệu/Tiêu ngữ header table, Party A/B details table, data/remuneration breakdown table, and 2-column signature table). Do NOT flatten tables into plain `<p>` lines.',
  '- For Vietnamese administrative documents (Nghị định 30/2020/NĐ-CP), formal contracts, decisions, submissions (Tờ trình), minutes (Biên bản), official dispatches (Công văn), proposals, and education plans (KHBD 5512), ALWAYS follow these exact NĐ 30/2020/NĐ-CP rules:',
  '  1. Header 2-column borderless `<table style="width: 100%; border: none; border-collapse: collapse;">` using `<td>` cells (never `<th>`), with both columns starting on the exact same top line (`vertical-align: top`):',
  '     - Left `<td style="width: 44%; text-align: center; vertical-align: top; border: none;">`: `<p style="margin: 0;">TÊN CƠ QUAN CHỦ QUẢN (IN HOA THƯỜNG ĐỨNG, KHÔNG ĐẬM)</p><p style="margin: 0;"><strong><u>TÊN CƠ QUAN, TỔ CHỨC BAN HÀNH</u></strong></p><p style="margin: 4px 0 0 0;">Số: 15/2026/TTr-...</p>` (always generate a concrete document number/symbol even if the prompt is brief).',
  '     - Right `<td style="width: 56%; text-align: center; vertical-align: top; border: none;">`: `<p style="margin: 0;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p><p style="margin: 0;"><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p><p style="margin: 4px 0 0 0;"><em>Hà Nội, ngày 30 tháng 10 năm 2026</em></p>`',
  '  2. Main Document Title (`<h1>` centered, uppercase, bold, 14pt): `<h1 style="text-align: center;"><strong>TÊN LOẠI VĂN BẢN IN HOA</strong></h1>` and centered Subtitle / Trích yếu: `<p style="text-align: center;"><strong>Về việc ...</strong></p>` followed by `<p style="text-align: center;"><strong>Kính gửi: ...</strong></p>`.',
  '  3. Legal & factual bases (`Căn cứ`): each `Căn cứ` MUST be its own separate `<p style="text-align: left;"><em>Căn cứ ...;</em></p>` paragraph (italic, left-aligned so the last line is never stretched by justify; NEVER join multiple `Căn cứ` lines with `<br>`). Always synthesize 2-3 appropriate legal/practical `Căn cứ` lines even when the user prompt is short.',
  '  4. 6-column budget/cost tables (`STT`, `Nội dung chi`, `ĐVT`, `SL`, `Đơn giá`, `Thành tiền`): use proportional column widths (`6%`, `44%`, `10%`, `8%`, `15%`, `17%` — never 6 equal columns), bold centered `<th>` headers, right-aligned numbers/amounts with Vietnamese dot thousand separators (`45.000.000`), a bold `TỔNG CỘNG` row with full Vietnamese diacritics, and `<p><em>Số tiền bằng chữ: ... đồng chẵn.</em></p>` immediately below.',
  '  5. Closing paragraph + 2-column borderless signature `<table style="width: 100%; border: none; border-collapse: collapse;">` kept on the same page (`keepNext`): Left `<td style="width: 45%; text-align: left; vertical-align: top; border: none;">` has `<p><strong><em>Nơi nhận:</em></strong></p><p>- Như trên;</p><p>- Lưu: VT.</p>` (11-12pt, line-spacing 1.0); Right `<td style="width: 55%; text-align: center; vertical-align: top; border: none;">` has `<p><strong>CHỨC VỤ NGƯỜI KÝ</strong></p><p><em>(Ký, ghi rõ họ tên và đóng dấu)</em></p><p></p><p></p><p></p><p><strong>Họ và tên người ký</strong></p>` (leave 3-4 blank lines above the signer name for signature and seal).',
  '  6. Statutory Vietnamese Forms & Specialized Documents:',
  '     - Residence Declaration (Mẫu CT01 - TT 66/2023/TT-BCA): Top-right `Mẫu CT01`, Quốc hiệu - Tiêu ngữ, `Kính gửi: Công an phường/xã...`, items 1-10 (Name, DOB, Gender, 12-digit CCCD, Phone, Email, Head of Household, Relationship, Head CCCD, Request `[x] Đăng ký tạm trú`), item 11 6-column household member table (`TT | Họ tên | Ngày sinh | Giới tính | Số định danh cá nhân | Quan hệ`), and 2-column bottom signature block (`Ý kiến của chủ hộ / chủ sở hữu chỗ ở hợp pháp` | `Người kê khai`).',
  '     - Red Book / Land Registration (Mẫu số 04/ĐK & Mẫu số 11/ĐK - NĐ 101/2024/NĐ-CP): Top-right `Mẫu số 04/ĐK` or `Mẫu số 11/ĐK`, Quốc hiệu - Tiêu ngữ, `Kính gửi: Chi nhánh Văn phòng Đăng ký đất đai...`, Section 1 (Applicant details), Section 2 (Land parcel / Existing Red Book serial & registry no.), Section 3 (Attached house/assets or Before vs After change comparison table), Section 4 (Attached documents & 2-column confirmation/signature block).',
  '     - Tax Declarations & Refunds (Mẫu 01/LPTB, 03/BĐS-TNCN, 01/ĐNHT, 01/GHAN - TT 80/2021/TT-BTC): Top-right form code, numbered fields `[01]`-`[11]`, property details or tax period, 6-column tax calculation table (0.5% LPTB, 2.0% PIT on real estate transfer, or tax overpayment by Tiểu mục), bank account details, and commitment signature.',
  '     - Education Lesson Plans & Exams: Secondary/High school KHBD (CV 5512) uses 4 activities with 2-column tables (`Hoạt động của GV & HS` | `Sản phẩm dự kiến`); Primary school KHBD (CV 2345) uses 4 activities with 2-column tables (`Hoạt động của Giáo viên` | `Hoạt động của Học sinh`); New Periodic Exam (CV 7991/BGDĐT-GDTrH) includes Matrix (Nhận biết 40% - Thông hiểu 30% - Vận dụng 30%), Part I Objective 7.0 pts (12 MCQs + 2 True/False 4-statement items a/b/c/d + 4 Short Answer items) + Part II Essay 3.0 pts + Detailed Answer Key.',
  '     - Accounting Vouchers (Mẫu 05-TT / 03-TT / 04-TT - TT 200/2014/TT-BTC): Left header company/MST, right header `Mẫu số 05-TT`, requester & bank account details, 6-column invoice/expense breakdown table, advance offset calculation, amount in words, and 4-column approval signature table (`Người đề nghị | Trưởng bộ phận | Kế toán trưởng | Giám đốc`).',
  '- Never insert an English disclaimer line (such as "This is a reference draft, not legal advice...") inside a Vietnamese document.',
  '- Real data only: use the facts, figures, names and quotes from the reference material and the plan. NEVER output `{{PLACEHOLDER}}` variables (such as `{{SO_TO_TRINH}}`, `{{NGAY}}`) — always generate realistic administrative numbers, dates, and legal bases when the prompt omits them.',
  '- Follow the length the plan asks for; when it gives none, write what the content genuinely needs.',
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
