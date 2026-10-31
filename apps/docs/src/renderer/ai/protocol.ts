/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import type { Editor } from '@tiptap/core'
import { REDACT_MARK } from './redact'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import {
  TABLE_HEADER_FILL,
  type Block,
  type CommentInfo,
  type TableCell,
  type TableModel,
} from '@lycero/docx-engine'
import { pmTableToModel, tableModelToPmNode, type PmMark, type PmNode } from '../editor/convert'
import { equationBlockJson, inlineEquationNodeJson } from '../editor/equation'
import { inheritFrom, inheritTableFormatting, sameBlockRole } from './inherit-formatting'
import { TRACK_IGNORE, type RevisionRange } from '../editor/revisions'
import { countWords, documentTextForWordCount, leafTextForWordCount } from '../word-count'
import { blockRangePositions, isTrackedDeleted, liveText } from './doc-utils'
import {
  modelTextOf,
  projectedNodeText,
  redactNode,
  redactTextBetween,
  type RedactableNode,
} from './redact-view'
import { opSignatures } from './ops'
import { pageSetupContextLines, type AiSectionState } from './page-setup'
import { listRevisionEntries } from './revision-ops'

export { blockRangePositions, isTrackedDeleted, liveText }

/**
 * Agent protocol: the model runs a multi-turn tool-use loop — it reads the document skeleton
 * (block list with numbered addressing), reads full block content on demand,
 * and mutates the document exclusively through tools (tools.ts). Questions
 * are answered directly in chat without touching the document. Context size
 * stays bounded: previews are clipped and full content is pulled lazily.
 */

// ---- context budgets (characters, ≈4 chars/token) ----

const SELECTION_MAX_CHARS = 24_000
const DOC_CONTEXT_MAX_CHARS = 8_000
const PREVIEW_MAX_CHARS = 60
const PREVIEW_TIGHT_CHARS = 20

/**
 * Guide for the apply_ops tool: format, structure and batch operations travel
 * as a flat op list executed atomically by ops.ts. The signature lines come
 * from the op registry, so the guide cannot drift from the implementation.
 */
export const OPS_GUIDE = [
  'apply_ops runs a list of ops as ONE atomic transaction: every op is validated first and any invalid op rejects the whole batch (the error quotes the op\'s usage line). Each op is a flat object { op, target?, ...fields }. Fields are patches: a present field is set, null clears it, an absent field is left untouched — never repeat properties the user did not ask to change. Colors are "#RRGGBB", font sizes are points, lengths are twips (1 pt = 20 twips). Pass dryRun: true to validate and see the plan without changing the document.',
  '',
  'Target (all conditions are ANDed; provide at least one):',
  '```',
  'interface Target {',
  "  nodeType?: 'docHeading' | 'docParagraph' | 'docListItem' | 'image' | 'table'  // image = image block, table = editable table (row/column/merge/format ops)",
  "  headingLevel?: number        // only together with nodeType: 'docHeading'",
  '  containsText?: string        // block plain text contains this substring',
  '  matchCase?: boolean          // defaults to true',
  '  blockIndexes?: number[]      // indexes from the "document block list"',
  "  scope?: 'selection' | 'document'  // selection = only blocks covered by the current selection; when part of a block is selected, setFont / setMatchedFont / findReplace act only on the selected characters (paragraph-level ops still apply to the whole block)",
  '}',
  '```',
  'Ops:',
  '```',
  ...opSignatures(),
  '```',
  '',
  'Common recipes:',
  '- "Make all headings red" → ops: [{"op":"setFont","target":{"nodeType":"docHeading"},"color":"#FF0000"}]',
  '- "1.5 line spacing for the whole document" → one setParagraphFormat each for docParagraph / docHeading / docListItem with "lineSpacing":1.5',
  '- "Demote the \'Risk Notice\' level-2 heading to level 3" → ops: [{"op":"setHeadingLevel","target":{"nodeType":"docHeading","headingLevel":2,"containsText":"Risk Notice"},"level":3}]',
  '- "Delete blocks 3 to 5" → ops: [{"op":"deleteBlocks","target":{"blockIndexes":[3,4,5]}}]',
  '- "Turn blocks 2 to 4 into a numbered list" → ops: [{"op":"setList","target":{"blockIndexes":[2,3,4]},"kind":"number"}]',
  '- "Center all images" → ops: [{"op":"setImageProperties","target":{"nodeType":"image"},"align":"center"}]',
  '- "In block 5, change 8% to 9%" → ops: [{"op":"findReplace","find":"8%","replace":"9%","target":{"blockIndexes":[5]}}]',
  '- "Bold every TODO:" → ops: [{"op":"setMatchedFont","text":"TODO:","bold":true}]',
  '- "Turn all the red text back to normal" → ops: [{"op":"setMatchedFont","matchColor":"#FF0000","color":null}]  (read_blocks shows the red runs as <span style="color:#FF0000">; links and other colors are untouched)',
  '- "Make every 9 pt run 10.5 pt" → ops: [{"op":"setMatchedFont","matchFontSize":9,"fontSize":10.5}]',
  '- "Make the selected words 14 pt blue" (partial selection) → ops: [{"op":"setFont","target":{"scope":"selection"},"fontSize":14,"color":"#1A73E8"}]',
  '- "Two-character first-line indent for the whole document" (11 pt font) → one setParagraphFormat for docParagraph with "indentFirstLine":440',
  '- "Insert a table of contents at the beginning" → ops: [{"op":"insertToc","afterBlockIndex":-1}]; if the user wants the TOC on its own page, also setParagraphFormat the first body block after the TOC with "pageBreakBefore":true',
  '- "Number the figures" → one insertField {"type":"SEQ","args":"Figure \\* ARABIC"} per caption paragraph (afterText places the number after the label); "refresh the numbering / the date" → [{"op":"updateFields"}]; a cross-reference is insertBookmark on the target paragraph, then insertField {"type":"REF","args":"Name \\h"} where it is cited',
  '- Cover page recipe: use insert_content to insert one paragraph each for title/subtitle/date at the start of the document, then setFont to enlarge the title (e.g. "fontSize":36), setParagraphFormat to center everything and give the title "spaceBefore":4800, and finally set "pageBreakBefore":true on the first body block after the cover',
  '',
  'Discipline:',
  '- Read the "document block list" before issuing ops; anything like "paragraph N / a certain section" must be addressed with block indexes from the list — never guess;',
  '- Only give the fields the user explicitly asked to change;',
  '- Protected blocks such as images cannot be modified with style ops (they are skipped); to change table content, use read_blocks to get the <table> and rewrite it wholesale with replace_blocks (the table keeps its column widths, borders, shading and cell formatting; cells whose text you leave unchanged keep their content untouched).',
  '',
  'Known error cases (must avoid):',
  'BC-1 Giving fields the user did not ask for, wiping existing formatting by mistake;',
  'BC-2 A "whole document" formatting operation only changed docParagraph and missed docHeading/docListItem;',
  'BC-3 Addressing by word/character position (no such addressing exists); use block indexes, text containment or the selection instead;',
  'BC-4 Using findReplace sentence by sentence for rewrites such as translation/abbreviation; use replace_blocks (or replace_selection for a selected span) instead;',
].join('\n')

export const HTML_RULES = [
  'The html tool input is a restricted HTML fragment. Rules:',
  '- Only these tags are allowed: h1 h2 h3 h4 h5 h6 p ul ol li strong em u s a br table thead tbody tr th td pre code blockquote',
  '- Tables: for data tables, use <th> for the first (header) row; for 2-column Vietnamese administrative header tables (Quốc hiệu - Tiêu ngữ) and signature/footer blocks, use a borderless <table style="width: 100%; border: none; border-collapse: collapse;"> with <td> cells (never <th>) and format cell lines with <p style="text-align: center;">, <strong>, <em>, <u>, or <br>; nested tables are not supported',
  '- Vietnamese Quốc hiệu - Tiêu ngữ & Document Title standard (Nghị định 30/2020/NĐ-CP & Enterprise/Legal/Education docs): (1) 2-column borderless header <table> where both columns start at row 0 top-aligned (Left <td style="width: 44%; text-align: center; vertical-align: top; border: none;">: TÊN CƠ QUAN CHỦ QUẢN in regular upright uppercase without <strong> / <strong><u>TÊN CƠ QUAN, TỔ CHỨC BAN HÀNH</u></strong> bold underlined / Số: 15/2026/TTr-...; Right <td style="width: 56%; text-align: center; vertical-align: top; border: none;">: <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong> / <strong><u>Độc lập - Tự do - Hạnh phúc</u></strong> / <em>Hà Nội, ngày ... tháng ... năm 2026</em>), (2) centered Document Title <h1 style="text-align: center;"><strong>TÊN LOẠI VĂN BẢN IN HOA</strong></h1> and centered Subtitle/Trích yếu <p style="text-align: center;"><strong>Về việc ...</strong></p>, (3) each "Căn cứ ...;" line as its own separate <p style="text-align: left;"><em>Căn cứ ...;</em></p> paragraph (italic, left-aligned so it is never stretched by justify; never join multiple Căn cứ with <br>), (4) 6-column budget/cost tables (STT, Nội dung chi, ĐVT, SL, Đơn giá, Thành tiền) with proportional widths (6%, 44%, 10%, 8%, 15%, 17%), bold centered headers, right-aligned dot-separated numbers (45.000.000), and bold TỔNG CỘNG row with full Vietnamese diacritics, (5) 2-column borderless signature table (Left 45% Nơi nhận 11-12pt; Right 55% centered bold uppercase signer title, italic "(Ký, ghi rõ họ tên và đóng dấu)", 3-4 blank lines for wet signature/stamp, and bold signer full name)',
  '- Use <pre> for code samples (monospace font + shading, line breaks preserved); use <blockquote> for quotations (indent + left bar)',
  '- Use <formula>LaTeX</formula> for math (produces native Word equations): as a top-level block it becomes its own centered paragraph; placed inside <p>/<li>/<h*> text it is an inline formula flowing with the text, e.g. <p>From <formula>E = mc^2</formula> we know…</p>; supports the common subset of \\frac \\sqrt super/subscripts \\sum \\int \\lim matrix environments Greek letters etc., the align environment is not supported; invalid LaTeX fails the whole call — fix and retry',
  '- Do not include <html>/<body>, markdown code fences, or explanatory text',
  "- <sel>…</sel> appears only in the context to mark the user's selection; it is not a tag you may write",
  '- <img src="doc:B.I"> in read_blocks output is picture I of block B. To keep a picture when you replace its block, copy that exact tag into the new HTML where the picture should sit; a replaced range whose pictures you leave out loses them (the tool result says so). Any other <img> is ignored — new pictures go through insert_picture',
  '- <span style="color:#RRGGBB;font-size:Npt"> appears only in read_blocks output, on runs whose color or size differs from the rest of the block (color:auto / font-size:default = back to the block\'s normal style); it is read-only — writing <span> has no effect, change colors and sizes with the apply_ops formatting commands',
  '- Organize long content into sections with h2/h3 (unless the user only wants a single paragraph)',
  '- Keep the same language as the original document / user instruction, unless translation is requested',
].join('\n')

/**
 * Agent system prompt: document-first, intent resolution, act via tools,
 * answer in chat.
 */
export const AGENT_SYSTEM_PROMPT = [
  'You are the document assistant built into the local document editor Lycero Office Docs. You read and modify the currently open document exclusively through tools; there is no other modification channel.',
  '',
  '# Intent resolution',
  '- The user asks to modify/generate/translate/format → call the appropriate tools, then summarize what was done in one or two sentences;',
  '- The user is asking a question or consulting (word count, structure, "what is this about", writing advice, etc.) → answer directly in plain text without calling modification tools;',
  '- For statistics such as word count or block count, quote the "full-text stats" from the "document block list" directly — do not count yourself;',
  '- When intent is unclear, read the document first (the block list in the message, and read_blocks for full text if needed), then decide.',
  '',
  '# Tool usage',
  '- Every user message carries the latest "document block list" (index|type|content preview; previews may be truncated); after modifications, call get_document_context if you need the latest state;',
  '- When a list preview is truncated, read the full content with read_blocks before rewriting; never rewrite based on a truncated preview;',
  '- Content changes: use insert_content for new content, and replace_blocks to rewrite/replace existing blocks (pass a block index range and the new HTML); replaced blocks pass their paragraph and text formatting (font, size, color, indent, spacing, alignment) on to the new blocks automatically, and a rewritten table keeps its widths, borders, shading and cell formatting, so a rewrite never needs follow-up formatting commands;',
  '- Long new content (drafting a whole document, a chapter, a full report/article/translation — anything beyond a few paragraphs) goes through write_document: you pass the plan and the reference material, and the system writer streams the text into the document while the user watches; never paste long content into insert_content. When the document is blank and the user asks for content, use write_document;',
  '- Never invent `{{PLACEHOLDER}}` variables (such as `{{SO_TO_TRINH}}`, `{{NGAY}}`) when drafting or editing a concrete document unless the user explicitly asks for a reusable form/template ("mẫu biểu", "form mẫu", "template"); use standard administrative notation (e.g. "Số: .../TTr-...", "ngày ... tháng ... năm 2026") for open administrative fields and preserve all concrete facts from the user prompt;',
  '- Formatting, structure, and batch operations (color/font size/line spacing/alignment/indent/heading level/find & replace/delete/move/list conversion) go through apply_ops — do not rewrite whole blocks with replace_blocks;',
  '- Small in-place text fixes (changing a few words inside a sentence) go through apply_ops findReplace with a target — do not rewrite the whole block; styling every occurrence of a phrase (e.g. bold each "TODO") uses setMatchedFont, and so does restyling every run of a given color or size (matchColor / matchFontSize) — never rewrite blocks or restyle whole blocks to fix a few runs;',
  '- When the user has text selected, the message includes the selection block indexes and content; rewrite-style requests apply to the selection by default;',
  '- When only part of a block is selected, the selected span is delimited by <sel>…</sel> and repeated as "Selected text": "this"/"the selected text" means exactly that span. Restyle it with apply_ops and target {"scope":"selection"} (run-level ops then touch only the selected characters); rewrite it with replace_selection. Never restyle or rewrite the whole block for a partial selection;',
  '- Web search: use web_search when you need up-to-date information/data/fact checking; search before writing about uncertain facts — do not fabricate;',
  '- Illustrations: when the user wants pictures, first image_search (English keywords work better) → pick a suitable result → insert_image with its imageUrl; when the user asks to generate/draw a picture, or search cannot match the needed illustration, use generate_image with a detailed English prompt;',
  '- Tracked deletions (struck-through revision text) are not part of the current content and are hidden from the block list/read_blocks/stats; when a [tracked deletion] tag or a skipped-deletion notice appears, that text is already deleted — never try to delete or rewrite it again (the user accepts/rejects revisions in the Review tab);',
  '- Charts: use insert_chart for data visualization (bar/line/pie; saved as native Word charts); use edit_chart to change the data of an existing chart block in the block list; data must be real, from the document or search results;',
  '- New standalone document: when the user asks to put results into a NEW/separate document (a summary, a report, an extraction) instead of this one, use create_document with the full content — do not insert that content into the current document and do not claim you cannot create files;',
  '- One reply may chain multiple tools; after everything is done, always finish with a short plain-text summary.',
  '',
  '# Comments',
  '- Unresolved comment threads ride along in every user message (id, author, anchored block, quoted anchor text); resolved threads are omitted. read_comments returns the full list including resolved threads and replies.',
  '- When the user asks to handle/address/resolve the comments, process them one at a time: read the anchored block, apply the requested change with the normal editing tools, then reply_comment with a one-sentence summary of what changed, then resolve_comment. Handle each comment in its own tool sequence — never one giant edit for all of them.',
  '- A comment that is a question or is ambiguous gets a reply_comment with an answer or a clarifying question, no document change and no resolve.',
  "- Never modify content beyond a comment's anchored passage unless the comment explicitly requires it; skip threads that are already resolved.",
  '- When the user asks for review notes, questions or suggestions without changing the text (proofread and comment, flag weak spots, ask the author), use add_comment on the exact passage instead of editing; delete_comment only when the user asks to remove a comment.',
  '',
  '# Template filling',
  '- When the user asks to fill in a template/form, first scan the document for placeholders: [bracketed labels], {{curly names}}, runs of underscores (____), and protected content-control blocks whose label reads as a field.',
  "- List every placeholder found (with block indexes). Fill the ones the user's message answers via findReplace with a target so the surrounding formatting survives; for the rest, ask for the missing values in one consolidated question — never invent facts to fill a field.",
  "- Dates follow the user's locale; never change text outside the placeholders.",
  '',
  '# Fields, footnotes & endnotes',
  '- insertField writes real Word fields (SEQ caption numbers, DATE/TIME, REF/PAGEREF to a bookmark, MERGEFIELD, PAGE/NUMPAGES, AUTHOR…). Results the editor cannot compute (page numbers, document properties) are placeholders marked for Word to recompute when the file opens; mention that when you report. TOC → insertToc, never insertField.',
  '- insert_footnote / insert_endnote put a superscript reference mark into a block (after afterText, else at its end) and store the note text; read_notes lists notes with ids and anchored blocks; edit_note changes the text of one in place (findReplace inside the note, id kept); delete_note removes one with its mark. Notes are not document blocks — never reach them via block indexes or rewrite a block just to change its note.',
  '',
  '# Headers & footers',
  '- The message context lists the current header/footer text. Change them with set_header_footer: plain text, \\n between lines; the tokens {PAGE} and {NUMPAGES} become live page-number fields (e.g. text "{PAGE} / {NUMPAGES}" renders as "3 / 12"); an empty string clears the text.',
  '- view "first" / "even" writes the different-first-page or even-page variant and switches the corresponding Word setting on automatically; omit view for the normal header/footer.',
  '- Existing per-line alignment and styling are preserved; logos and images in the part are untouched. Headers/footers are not document blocks — never try to reach them via block indexes.',
  '',
  '# Answer citations',
  '- When an answer draws on specific parts of the document, cite them as markdown links: [heading text or a short label](docnav://block/N), where N is a block index from the current block list. The user can click these to jump to the passage.',
  '- Only cite block indexes that exist in the block list — never guess; prefer heading blocks as citation anchors. Whole-document answers may omit citations.',
  '',
  '# Tracked revisions',
  '- read_revisions lists every pending tracked change (kind, author, date, block index, affected text). Use it when the user asks what changed / to review or summarize the revisions (a redline summary).',
  '- Redline summary shape: overall counts first (insertions/deletions, authors, date range), then the changes grouped by document section using the heading structure from the block list, one line each; end with a "Potential concerns" list flagging risky edits (deleted obligations or qualifiers, changed numbers/dates/amounts, weakened commitments). Cite block indexes so the user can locate each change.',
  '- Summarizing is read-only: do not modify the document, and never try to accept or reject revisions — the user does that in the Review tab.',
  '',
  '# Mind map',
  '- When the user asks for a mind map / knowledge structure / overview diagram of the document or a topic, call generate_mindmap with the whole tree in one call — never draw it with text or ask the user to confirm first;',
  '- The root is the document title (or the focus topic when the user named one — also pass it as `focus`); its children are the main sections/headings, then key concepts, 2-5 per node, 2-4 levels deep;',
  "- Labels are short phrases (2-8 words) in the document's own language and wording, taken from its headings and key sentences — never invent topics the document does not cover;",
  "- Cite each node's source with `block` (a block index from the current block list); omit it for nodes that span several blocks. Only cite indexes that exist;",
  '- generate_mindmap does not modify the document. After it returns, reply with one short sentence (e.g. that the map is ready and branches can be expanded).',
  '',
  '# HTML fragment rules',
  HTML_RULES,
  '',
  '# apply_ops guide',
  OPS_GUIDE,
].join('\n')

export { countWords, documentTextForWordCount }

// ---- selection scope ----

export interface SelectionScope {
  /** top-level child indexes covered by the selection (inclusive) */
  startIndex: number
  endIndex: number
  /** true when the user has an actual range selected (not just a caret) */
  isRange: boolean
  /** exact ProseMirror positions; run-level commands narrow to them when the range is partial */
  from?: number
  to?: number
}

export function getSelectionScope(editor: Editor): SelectionScope {
  const { from, to, empty } = editor.state.selection
  const doc = editor.state.doc
  let startIndex = -1
  let endIndex = -1
  let index = 0
  doc.forEach((node, offset) => {
    const nodeFrom = offset
    const nodeTo = offset + node.nodeSize
    if (nodeTo > from && nodeFrom < to) {
      if (startIndex === -1) startIndex = index
      endIndex = index
    } else if (empty && from >= nodeFrom && from <= nodeTo && startIndex === -1) {
      startIndex = index
      endIndex = index
    }
    index++
  })
  if (startIndex === -1) {
    startIndex = doc.childCount - 1
    endIndex = doc.childCount - 1
  }
  return { startIndex, endIndex, isRange: !empty, from, to }
}

/**
 * The character-precise part of a range selection, clamped to its block range;
 * null when the selection covers the blocks whole (or carries no positions).
 */
export function partialSelection(
  editor: Editor,
  scope: SelectionScope,
): { from: number; to: number } | null {
  if (!scope.isRange || scope.from === undefined || scope.to === undefined) return null
  const doc = editor.state.doc
  if (scope.startIndex < 0 || scope.endIndex >= doc.childCount) return null
  const { from, to } = blockRangePositions(editor, scope.startIndex, scope.endIndex)
  const first = doc.child(scope.startIndex)
  const last = doc.child(scope.endIndex)
  // character precision exists only for top-level text blocks; a range that
  // starts or ends inside a table / protected block keeps whole-block semantics
  if (!first.isTextblock || !last.isTextblock) return null
  if (scope.from <= from + 1 && scope.to >= to - 1) return null
  return {
    from: Math.min(Math.max(scope.from, from), to),
    to: Math.min(Math.max(scope.to, from), to),
  }
}

// ---- blocks -> restricted HTML ----

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The run style a block's text mostly uses; runs that differ from it are the ones worth showing. */
interface RunStyle {
  color: string | null
  sizeHalfPoints: number | null
}

function runStyleOf(marks: PmMark[]): RunStyle {
  const ts = marks.find((m: PmMark) => m.type === 'docTextStyle')
  const color = ts?.attrs?.color
  const size = ts?.attrs?.sizeHalfPoints
  return {
    // 'auto' is Word's explicit automatic color: the same as no color
    color: typeof color === 'string' && color && color !== 'auto' ? color.toUpperCase() : null,
    sizeHalfPoints: typeof size === 'number' ? size : null,
  }
}

function dominantRunStyle(content: PmNode[] | undefined): RunStyle {
  const colors = new Map<string | null, number>()
  const sizes = new Map<number | null, number>()
  for (const node of content ?? []) {
    if (node.type !== 'text' || !node.text) continue
    // pending deletions are hidden from the model, so they must not set its baseline
    if ((node.marks ?? []).some((m: PmMark) => m.type === 'del')) continue
    const { color, sizeHalfPoints } = runStyleOf(node.marks ?? [])
    colors.set(color, (colors.get(color) ?? 0) + node.text.length)
    sizes.set(sizeHalfPoints, (sizes.get(sizeHalfPoints) ?? 0) + node.text.length)
  }
  const top = <T>(m: Map<T, number>, fallback: T): T =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback
  return { color: top(colors, null), sizeHalfPoints: top(sizes, null) }
}

/**
 * Color / size the model needs to see: only where a run departs from the
 * block's dominant style, so a uniformly styled document reads as plain text
 * and a red correction or an oversized word stands out. Read-only markup —
 * the parser drops <span> styles (formatting goes through apply_ops).
 */
function styleAttr(marks: PmMark[], base: RunStyle): string {
  const { color, sizeHalfPoints } = runStyleOf(marks)
  const decl: string[] = []
  if (color !== base.color) decl.push(`color:${color ? `#${color}` : 'auto'}`)
  if (sizeHalfPoints !== base.sizeHalfPoints)
    decl.push(`font-size:${sizeHalfPoints === null ? 'default' : `${sizeHalfPoints / 2}pt`}`)
  return decl.length ? ` style="${decl.join(';')}"` : ''
}

function wrapInlineText(raw: string, marks: PmMark[], base?: RunStyle): string {
  let text = escapeHtml(raw)
  const has = (type: string) => marks.some((m: PmMark) => m.type === type)
  if (has('bold')) text = `<strong>${text}</strong>`
  if (has('italic')) text = `<em>${text}</em>`
  if (has('underline')) text = `<u>${text}</u>`
  if (has('strike')) text = `<s>${text}</s>`
  const link = marks.find((m: PmMark) => m.type === 'link')
  if (link?.attrs?.href) text = `<a href="${escapeHtml(String(link.attrs.href))}">${text}</a>`
  const style = base ? styleAttr(marks, base) : ''
  if (style) text = `<span${style}>${text}</span>`
  return text
}

/** Export hook: maps a picture's source to the `src` the restricted HTML should carry; null drops it. */
export type ImageSrcMapper = (src: string) => string | null

/** `doc:B.I` — the I-th picture of block B; read_blocks shows it, replace_blocks resolves it back to the picture */
export const IMAGE_REF_PREFIX = 'doc:'
const IMAGE_REF_RE = /^doc:(\d+)\.(\d+)$/

/** per-block counter handing out picture ordinals while a block serializes */
interface ImageRefs {
  block: number
  next: number
}

function inlineAtomToHtml(node: PmNode, image?: ImageSrcMapper, refs?: ImageRefs): string {
  if (node.type === 'hardBreak') return '<br>'
  if (node.type === 'docInlineImage') {
    // a rule image is decoration; a withheld picture must never become a fetchable ref
    if (node.attrs?.rule || node.attrs?.redact) return ''
    if (image) {
      const src = image(String(node.attrs?.dataUrl ?? ''))
      return src ? `<img src="${escapeHtml(src)}">` : ''
    }
    // the model's view: a picture is content it must see (an image-only
    // paragraph used to read as <p></p> and got replaced away), and the ref
    // lets it keep the picture when rewriting the block
    return refs ? `<img src="${IMAGE_REF_PREFIX}${refs.block}.${refs.next++}">` : ''
  }
  if (node.type === 'docInlineMath') {
    // editor-created formulas round-trip as LaTeX; parsed-from-docx ones
    // degrade to the flat token strip (structure lost if the model rewrites)
    const source = String(node.attrs?.latex ?? '') || String(node.attrs?.text ?? '')
    return source ? `<formula>${escapeHtml(source)}</formula>` : ''
  }
  if (node.type === 'docRuby') return escapeHtml(String(node.attrs?.base ?? ''))
  return ''
}

/** Character offsets (relative to the block's content start) of the user's selection inside this block */
export interface InlineSelection {
  from: number
  to: number
}

/**
 * Inline content as restricted HTML. With `sel`, the selected span is
 * delimited by <sel>…</sel> (text nodes split at the boundaries). Every inline
 * node other than text is an atom, so it occupies exactly one position.
 */
function inlineToHtml(
  content: PmNode[] | undefined,
  sel?: InlineSelection,
  image?: ImageSrcMapper,
  refs?: ImageRefs,
): string {
  if (!content) return ''
  const base = dominantRunStyle(content)
  let html = ''
  let pos = 0
  let open = false
  let pending = sel && sel.from < sel.to ? sel : null
  const boundary = (at: number) => {
    if (!pending) return
    if (!open && at >= pending.from && at < pending.to) {
      html += '<sel>'
      open = true
    }
    if (open && at >= pending.to) {
      html += '</sel>'
      open = false
      pending = null
    }
  }
  for (const node of content) {
    // del-marked runs are pending deletions, not current content (but they still occupy positions)
    const deleted = (node.marks ?? []).some((m: PmMark) => m.type === 'del')
    if (node.type === 'text') {
      const text = node.text ?? ''
      const marks = node.marks ?? []
      const end = pos + text.length
      const cuts = [pos]
      if (pending) for (const c of [pending.from, pending.to]) if (c > pos && c < end) cuts.push(c)
      cuts.push(end)
      for (let i = 0; i < cuts.length - 1; i++) {
        boundary(cuts[i])
        if (!deleted)
          html += wrapInlineText(text.slice(cuts[i] - pos, cuts[i + 1] - pos), marks, base)
      }
      pos = end
      continue
    }
    boundary(pos)
    if (!deleted) html += inlineAtomToHtml(node, image, refs)
    pos += 1
  }
  boundary(pos)
  if (open) html += '</sel>'
  return html
}

/** plain text of a paragraph's inline content, hard breaks as newlines */
function inlineToPlainText(content: PmNode[] | undefined): string {
  if (!content) return ''
  return content
    .filter((n) => !(n.marks ?? []).some((m: PmMark) => m.type === 'del'))
    .map((n) => (n.type === 'hardBreak' ? '\n' : n.type === 'text' ? (n.text ?? '') : ''))
    .join('')
}

/** <pre> body: escaped plain text, the selected span delimited by <sel>…</sel> like the rich blocks */
function codeToHtml(content: PmNode[] | undefined, sel?: InlineSelection): string {
  if (!content) return ''
  const plain = inlineToPlainText(content)
  if (!sel || sel.from >= sel.to) return escapeHtml(plain)
  // deleted runs are dropped from the text but still occupy positions: map positions to text offsets
  let pos = 0
  let offset = 0
  let start = -1
  let end = -1
  for (const n of content) {
    const size = n.type === 'text' ? (n.text ?? '').length : 1
    const kept = !(n.marks ?? []).some((m: PmMark) => m.type === 'del')
    const width = kept ? (n.type === 'text' ? size : n.type === 'hardBreak' ? 1 : 0) : 0
    if (start < 0 && sel.from < pos + size)
      start = offset + (kept ? Math.max(sel.from - pos, 0) : 0)
    if (end < 0 && sel.to <= pos + size) end = offset + (kept ? Math.max(sel.to - pos, 0) : 0)
    pos += size
    offset += width
  }
  if (start < 0) start = plain.length
  if (end < 0) end = plain.length
  return `${escapeHtml(plain.slice(0, start))}<sel>${escapeHtml(plain.slice(start, end))}</sel>${escapeHtml(plain.slice(end))}`
}

/** paragraph carries the <pre> preset (see CODE_BLOCK_PRESET) */
function isCodeParagraph(node: PmNode): boolean {
  return (
    node.attrs?.shadingFill === CODE_BLOCK_PRESET.shadingFill &&
    node.attrs?.borders === CODE_BLOCK_PRESET.borders
  )
}

/** paragraph carries the <blockquote> preset (see QUOTE_BLOCK_PRESET) */
function isQuoteParagraph(node: PmNode): boolean {
  return node.attrs?.borders === QUOTE_BLOCK_PRESET.borders && Number(node.attrs?.indentLeft) > 0
}

/** table block -> restricted <table> HTML so the model can read and rewrite it */
function tableToHtml(table: TableModel): string {
  const headerRow = isHeaderRowTable(table)
  const rows = table.rows.map((row, r) => {
    const tag = headerRow && r === 0 ? 'th' : 'td'
    const cells = row
      .map((cell) => `<${tag}>${cell.paras.map(escapeHtml).join('<br>')}</${tag}>`)
      .join('')
    return `<tr>${cells}</tr>`
  })
  return `<table>${rows.join('')}</table>`
}

function isHeaderRowTable(table: TableModel): boolean {
  return table.rows.length > 1 && table.rows[0].every((c) => c.bold || c.fill !== undefined)
}

/**
 * Export variant: cells keep their inline pictures (the table model is text
 * only). The grid comes from the model so merged cells keep their columns;
 * each non-continuation entry maps to the row's next physical cell node.
 */
function tableToHtmlWithImages(node: PmNode, image: ImageSrcMapper): string {
  const model = pmTableToModel(node)
  const headerRow = isHeaderRowTable(model)
  const rows = model.rows.map((row, r) => {
    const tag = headerRow && r === 0 ? 'th' : 'td'
    const physical = node.content?.[r]?.content ?? []
    let next = 0
    const cells = row
      .map((entry) => {
        if (entry.vMerge === 'continue') return `<${tag}></${tag}>`
        const cell = physical[next++]
        const paras = (cell?.content ?? [])
          .filter((n) => n.type === 'docParagraph' || n.type === 'docListItem')
          .map((n) => inlineToHtml(n.content, undefined, image))
        return `<${tag}>${paras.join('<br>')}</${tag}>`
      })
      .join('')
    return `<tr>${cells}</tr>`
  })
  return `<table>${rows.join('')}</table>`
}

/**
 * Serialize top-level nodes [startIndex, endIndex] into restricted HTML.
 * Consecutive list items of the same kind are grouped into ul/ol. With `sel`
 * (absolute positions), the selected characters are delimited by <sel>…</sel>.
 */
export function serializeRangeToHtml(
  editor: Editor,
  startIndex: number,
  endIndex: number,
  sel?: { from: number; to: number } | null,
  image?: ImageSrcMapper,
): string {
  // The model's view, not the document's: a withheld span's words must
  // not travel in the HTML this produces. `redactNode` is total, so a
  // shape it does not recognise still comes through rather than
  // throwing and falling back to the unredacted text.
  const json = redactNode(editor.getJSON() as RedactableNode) as PmNode
  const children = (json.content ?? []).slice(startIndex, endIndex + 1)
  const parts: string[] = []
  let listBuffer: { kind: string; items: string[] } | null = null

  const flushList = () => {
    if (!listBuffer) return
    const tag = listBuffer.kind === 'ordered' ? 'ol' : 'ul'
    parts.push(`<${tag}>${listBuffer.items.join('')}</${tag}>`)
    listBuffer = null
  }
  const inlineSel = (i: number): InlineSelection | undefined => {
    if (!sel) return undefined
    const pmNode = editor.state.doc.child(startIndex + i)
    const start = blockRangePositions(editor, startIndex + i, startIndex + i).from + 1
    const from = Math.max(sel.from, start) - start
    const to = Math.min(sel.to, start + pmNode.content.size) - start
    return from < to ? { from, to } : undefined
  }

  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (isTrackedDeleted(editor.state.doc.child(startIndex + i))) {
      // the deleted block still separates the surrounding lists in the document
      flushList()
      continue
    }
    const refs: ImageRefs | undefined = image ? undefined : { block: startIndex + i, next: 0 }
    if (node.type === 'docHeading') {
      flushList()
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6)
      parts.push(`<h${level}>${inlineToHtml(node.content, inlineSel(i), image, refs)}</h${level}>`)
    } else if (node.type === 'docListItem') {
      const kind = (node.attrs?.kind as string) ?? 'bullet'
      if (!listBuffer || listBuffer.kind !== kind) {
        flushList()
        listBuffer = { kind, items: [] }
      }
      listBuffer.items.push(`<li>${inlineToHtml(node.content, inlineSel(i), image, refs)}</li>`)
    } else if (node.type === 'docParagraph') {
      flushList()
      if (isCodeParagraph(node)) {
        parts.push(`<pre>${codeToHtml(node.content, inlineSel(i))}</pre>`)
      } else if (isQuoteParagraph(node)) {
        parts.push(
          `<blockquote>${inlineToHtml(node.content, inlineSel(i), image, refs)}</blockquote>`,
        )
      } else {
        parts.push(`<p>${inlineToHtml(node.content, inlineSel(i), image, refs)}</p>`)
      }
    } else if (node.type === 'docTable') {
      flushList()
      parts.push(image ? tableToHtmlWithImages(node, image) : tableToHtml(pmTableToModel(node)))
    } else {
      flushList()
      const formula = node.attrs?.formulaDisplay as { tokens?: string[]; latex?: string } | null
      if (formula?.latex) {
        // full LaTeX recovered: the model can rewrite the formula losslessly
        parts.push(`<formula>${escapeHtml(formula.latex)}</formula>`)
      } else if (formula?.tokens?.length) {
        parts.push(
          `<p>[Protected formula: ${escapeHtml(formula.tokens.join(' '))}, structure is read-only, kept as is]</p>`,
        )
      } else {
        const label = String(node.attrs?.label ?? node.attrs?.blockType ?? 'content')
        // fields (TOC lines, page numbers, dates…) expose their visible result text
        const preview = String(node.attrs?.previewText ?? '')
          .replace(/\s+/g, ' ')
          .trim()
        parts.push(
          `<p>[Protected content: ${escapeHtml(label)}${preview ? ` — visible text: "${escapeHtml(clip(preview, 300))}"` : ''}, kept as is]</p>`,
        )
      }
    }
  }
  flushList()
  return parts.join('\n')
}

// ---- document context + layered request builders ----

/** Header/footer snapshot for the AI context; texts use {PAGE}/{NUMPAGES} tokens, null = variant off */
export interface AiHfState {
  header: string
  footer: string
  headerFirst: string | null
  footerFirst: string | null
  headerEven: string | null
  footerEven: string | null
  titlePg: boolean
  evenOddHf: boolean
  multiSection: boolean
}

function hfContextLines(hf: AiHfState): string[] {
  const fmt = (v: string) => (v ? `"${clip(v.replace(/\n/g, '\\n'), 160)}"` : '(empty)')
  const lines = [
    'Headers & footers ({PAGE}/{NUMPAGES} are live page-number fields; change with set_header_footer):',
    `- header: ${fmt(hf.header)} | footer: ${fmt(hf.footer)}`,
  ]
  if (hf.titlePg) {
    lines.push(
      `- first-page variant: header ${fmt(hf.headerFirst ?? '')} | footer ${fmt(hf.footerFirst ?? '')}`,
    )
  }
  if (hf.evenOddHf) {
    lines.push(
      `- even-page variant: header ${fmt(hf.headerEven ?? '')} | footer ${fmt(hf.footerEven ?? '')}`,
    )
  }
  if (hf.multiSection) {
    lines.push(
      '- the document has multiple sections; header/footer edits apply to the first section (later sections inherit unless they define their own)',
    )
  }
  return lines
}

interface ContextEntry {
  index: number
  type: string
  preview: string
  isHeading: boolean
  deleted: boolean
}

/**
 * Numbered structure snapshot for command-mode addressing: one line per
 * top-level block. Block numbers MUST equal the live PM doc order at execution
 * time, so this is rebuilt per request and never cached.
 */
export function buildDocumentContext(
  editor: Editor,
  scope?: SelectionScope,
  hf?: AiHfState,
): string {
  const entries: ContextEntry[] = []
  let index = 0
  let fullText = ''
  let hasPendingDeletions = false
  // textBetween's blockSeparator: between block units, never leading or trailing
  let fullTextFirst = true
  const appendFullText = (text: string) => {
    fullText += fullTextFirst ? text : ` ${text}`
    fullTextFirst = false
  }
  editor.state.doc.forEach((node) => {
    let type: string
    let preview: string
    let isHeading = false
    let deleted: boolean
    if (node.type.name === 'docProtected') {
      // protected blocks can only be block-level deletions (blockRevision)
      deleted = isTrackedDeleted(node)
      type = String(node.attrs.label || node.attrs.blockType || 'protected')
      preview = String(node.attrs.previewText ?? '')
      // A picture carries no text of its own: an empty preview reads as "this
      // content is invisible to me", so name the way to actually see it.
      if (node.attrs.blockType === 'image' && !preview) {
        preview = `(picture, no text — use analyze_media with blockIndex ${index} to see it)`
      }
      if (deleted) hasPendingDeletions = true
      else if (node.textContent !== '') appendFullText(node.textContent)
    } else {
      deleted = isTrackedDeleted(node)
      const live = liveText(node)
      // deleted blocks show their struck text so the model can talk about the
      // revision, but that text never counts as current content
      preview = deleted ? node.textContent : live
      if (!deleted && !live.trim()) {
        const pictures = inlineImagesOf(node).length
        if (pictures > 0) preview = `(${pictures} picture${pictures === 1 ? '' : 's'}, no text)`
      }
      if (!deleted)
        appendFullText(
          liveText(node, false, {
            blockSeparator: ' ',
            leafText: leafTextForWordCount,
          }),
        )
      if (deleted || live !== node.textContent) hasPendingDeletions = true
      if (node.type.name === 'docHeading') {
        type = `h${Math.min(Math.max(Number(node.attrs.level) || 1, 1), 6)}`
        isHeading = true
      } else if (node.type.name === 'docListItem') {
        type = 'li'
      } else if (node.type.name === 'docTable') {
        type = 'table'
      } else {
        type = 'p'
      }
    }
    entries.push({ index, type, preview: preview.replace(/\s+/g, ' ').trim(), isHeading, deleted })
    index++
  })

  const render = (bodyMax: number) =>
    entries.map((e) => {
      const body = clip(e.preview, e.isHeading ? PREVIEW_MAX_CHARS : bodyMax)
      return `${e.index}|${e.type}|${e.deleted ? '[tracked deletion] ' : ''}${body}`
    })
  let lines = render(PREVIEW_MAX_CHARS)
  if (lines.join('\n').length > DOC_CONTEXT_MAX_CHARS) lines = render(PREVIEW_TIGHT_CHARS)
  if (lines.join('\n').length > DOC_CONTEXT_MAX_CHARS) {
    // keep both ends (numbering must stay verifiable), elide the middle
    let dropStart = Math.floor(lines.length / 3)
    let dropEnd = lines.length - Math.floor(lines.length / 3)
    while (
      dropStart > 1 &&
      dropEnd < lines.length - 1 &&
      [...lines.slice(0, dropStart), ...lines.slice(dropEnd)].join('\n').length >
        DOC_CONTEXT_MAX_CHARS
    ) {
      dropStart = Math.max(1, dropStart - 10)
      dropEnd = Math.min(lines.length - 1, dropEnd + 10)
    }
    lines = [
      ...lines.slice(0, dropStart),
      `…(${dropEnd - dropStart} blocks elided here; numbering is continuous, extrapolate indexes if needed)…`,
      ...lines.slice(dropEnd),
    ]
  }

  scope ??= getSelectionScope(editor)
  const partialNote = partialSelection(editor, scope)
    ? ' (part of the text only — see the <sel> markers in the selected content)'
    : ''
  const selLine = scope.isRange
    ? scope.startIndex === scope.endIndex
      ? `Current selection: block ${scope.startIndex}${partialNote}`
      : `Current selection: blocks ${scope.startIndex}-${scope.endIndex}${partialNote}`
    : `No selection; cursor is in block ${scope.startIndex}`

  // authoritative stats for answer mode (previews above may be clipped)
  const statsLine = `Full-text stats: words ${countWords(fullText)}, characters (no spaces) ${
    fullText.replace(/\s/g, '').length
  }, characters (with spaces) ${fullText.length}`

  return [
    `The document has ${entries.length} blocks, listed below (index|type|content preview):`,
    ...lines,
    statsLine,
    ...(hasPendingDeletions
      ? [
          'Tracked changes: blocks tagged [tracked deletion] and struck-through text inside other blocks are pending deletion revisions — that text is already deleted, is excluded from stats/read_blocks, and must never be deleted or rewritten again; the user accepts/rejects revisions in the Review tab.',
        ]
      : []),
    ...(hf ? hfContextLines(hf) : []),
    selLine,
  ].join('\n')
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

// ---- tracked revisions context ----

const REVISIONS_CONTEXT_MAX = 200

const REVISION_KIND_LABEL: Record<RevisionRange['kind'], string> = {
  ins: 'inserted',
  del: 'deleted',
  // ins+del marks on the same text: added while tracking, then deleted —
  // never part of the base document; both accept and reject remove it
  both: 'inserted then deleted (not in the base document)',
  pPrChange: 'paragraph formatting changed',
  paraMarkDel: 'paragraph mark deleted (joins the next paragraph)',
  paraMarkIns: 'paragraph mark inserted',
  paraMarkRPrChange: 'paragraph mark formatting changed',
  rPrChange: 'text formatting changed',
  moveFrom: 'moved away',
  moveTo: 'moved here',
  rowIns: 'table row inserted',
  rowDel: 'table row deleted',
  cellIns: 'table cell inserted',
  cellDel: 'table cell deleted',
  blockIns: 'block inserted',
  blockDel: 'block deleted',
}

/** flat listing of every pending tracked change; backs the read_revisions tool */
export function buildRevisionsContext(editor: Editor): string {
  const revisions = listRevisionEntries(editor.state.doc)
  if (revisions.length === 0) return '(the document has no tracked revisions)'
  const shown = revisions.slice(0, REVISIONS_CONTEXT_MAX)
  const lines = shown.map((rev) => {
    const date = rev.date ? ` on ${rev.date.slice(0, 10)}` : ''
    const excerpt = rev.text ? `: "${clip(rev.text, 200)}"` : ''
    const change = rev.change ? ` (${rev.change})` : ''
    return `- ${rev.id} | block ${rev.blockIndex} | ${REVISION_KIND_LABEL[rev.kind]} by ${rev.author || 'unknown'}${date}${change}${excerpt}`
  })
  const header = `Tracked revisions (${revisions.length} pending; deleted text shows what will disappear on accept; ids are positional and renumber after every edit):`
  const overflow =
    revisions.length > shown.length
      ? [`…and ${revisions.length - shown.length} more revision(s) not listed.`]
      : []
  return [header, ...lines, ...overflow].join('\n')
}

// ---- comments context ----

export interface CommentAnchor {
  blockIndex: number
  excerpt: string
}

/** anchored block + anchor text per comment id (text marks first, block-attr ranges as fallback) */
export function commentAnchors(editor: Editor): Map<string, CommentAnchor> {
  const found = new Map<string, { blockIndex: number; text: string }>()
  let index = 0
  editor.state.doc.forEach((block) => {
    block.descendants((node) => {
      if (!node.isText) return
      const mark = node.marks.find((m) => m.type.name === 'comment')
      if (!mark) return
      for (const id of String(mark.attrs.ids ?? '')
        .split(' ')
        .filter(Boolean)) {
        const entry = found.get(id) ?? { blockIndex: index, text: '' }
        // a comment can anchor across a withheld span; the model sees the placeholder
        entry.text += projectedNodeText(node as unknown as RedactableNode)
        found.set(id, entry)
      }
    })
    const starts = Array.isArray(block.attrs?.commentStarts)
      ? (block.attrs.commentStarts as string[])
      : []
    for (const id of starts) {
      if (!found.has(id))
        found.set(id, {
          blockIndex: index,
          // Through `toJSON()`, never the live node. `redactNode` walks
          // `content` as an array, and a live ProseMirror node holds a
          // Fragment there, so the whole subtree would come back untouched and
          // a withheld span would travel verbatim.
          text: modelTextOf(block.toJSON() as RedactableNode),
        })
    }
    index++
  })
  const anchors = new Map<string, CommentAnchor>()
  for (const [id, entry] of found) {
    anchors.set(id, {
      blockIndex: entry.blockIndex,
      excerpt: clip(entry.text.replace(/\s+/g, ' ').trim(), 80),
    })
  }
  return anchors
}

const COMMENTS_CONTEXT_MAX = 20

/**
 * Unresolved comment threads for the per-turn context (roots with their
 * replies, anchored block indexes included). `all` additionally lists
 * resolved threads — that variant backs the read_comments tool.
 */
export function buildCommentsContext(editor: Editor, comments: CommentInfo[], all = false): string {
  const anchors = commentAnchors(editor)
  const roots = comments.filter((c) => !c.parentId && (all || c.done !== true))
  if (roots.length === 0) return all ? '(the document has no comments)' : ''
  const shown = all ? roots : roots.slice(0, COMMENTS_CONTEXT_MAX)
  const lines: string[] = [
    all
      ? 'All comment threads (including resolved):'
      : 'Unresolved comments (address with reply_comment / resolve_comment by id):',
  ]
  for (const root of shown) {
    const anchor = anchors.get(root.id)
    const where = anchor
      ? `block ${anchor.blockIndex}, anchored text "${anchor.excerpt}"`
      : 'anchor missing'
    const state = all && root.done === true ? ' [resolved]' : ''
    lines.push(`- id ${root.id} by ${root.author} (${where})${state}: ${clip(root.text, 300)}`)
    for (const reply of comments.filter((c) => c.parentId === root.id)) {
      lines.push(`  - reply id ${reply.id} by ${reply.author}: ${clip(reply.text, 300)}`)
    }
  }
  if (!all && roots.length > shown.length) {
    lines.push(
      `…and ${roots.length - shown.length} more unresolved thread(s); use read_comments for the full list.`,
    )
  }
  return lines.join('\n')
}

/** Blank = exactly one empty paragraph; a textContent check would misread image/chart-only documents as blank. */
export function isBlankDocument(editor: Editor): boolean {
  const doc = editor.state.doc
  if (doc.childCount !== 1) return false
  const first = doc.child(0)
  return first.type.name === 'docParagraph' && first.content.size === 0
}

/**
 * Per-turn context: fresh document skeleton + selection fragment injected
 * as a selection chip. Passing `scope` freezes the selection the prompt
 * describes, so tools can later act on the same range the model saw.
 */
export function buildDocContext(
  editor: Editor,
  scope?: SelectionScope,
  comments?: CommentInfo[],
  hf?: AiHfState,
  sections?: AiSectionState[],
): string {
  const isEmptyDoc = isBlankDocument(editor)
  scope ??= getSelectionScope(editor)
  const partial = partialSelection(editor, scope)
  const selectionHtml = scope.isRange
    ? clip(
        serializeRangeToHtml(editor, scope.startIndex, scope.endIndex, partial),
        SELECTION_MAX_CHARS,
      )
    : ''
  // `textBetween` would read the words; the context quotes the selection back
  // to the model, so it has to be the projected read
  const selectedText = partial
    ? redactTextBetween(editor.getJSON() as RedactableNode, partial.from, partial.to)
    : ''
  const selectionLines = partial
    ? [
        `Content selected by the user (blocks ${scope.startIndex}-${scope.endIndex}; ONLY the span inside <sel>…</sel> is selected, the rest of these blocks is shown for context):`,
        selectionHtml,
        `Selected text (${selectedText.length} characters): "${clip(selectedText, 1000)}"`,
      ]
    : [
        `Content selected by the user (blocks ${scope.startIndex}-${scope.endIndex}):`,
        selectionHtml,
      ]
  return [
    isEmptyDoc
      ? 'The document is currently blank.'
      : `Document block list:\n${buildDocumentContext(editor, scope, hf)}`,
    // a blank body can still carry headers/footers (template setup): keep them visible
    isEmptyDoc && hf ? hfContextLines(hf).join('\n') : '',
    sections ? pageSetupContextLines(sections).join('\n') : '',
    selectionHtml ? selectionLines.join('\n') : '',
    comments && comments.length > 0 ? buildCommentsContext(editor, comments) : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

// ---- restricted HTML fragment -> PmNode[] ----

export interface NumIds {
  bullet: string | null
  ordered: string | null
}

/**
 * Preset paragraph formats for <pre> / <blockquote>: combinations of existing
 * Block-model properties, so these blocks stay fully editable and round-trip
 * byte-stable through parse -> generate -> parse (no schema/signature change).
 */
export const CODE_BLOCK_PRESET = {
  font: 'Consolas',
  shadingFill: 'F2F2F2',
  borders: 'tblr',
} as const
export const QUOTE_BLOCK_PRESET = {
  color: '666666',
  indentLeft: 720,
  borders: 'l',
} as const

/** pick an existing numbering id of the right kind so new list items join real docx numbering */
export function findNumId(blocks: Block[], kind: 'bullet' | 'ordered'): string | null {
  for (const block of blocks) {
    if (block.type === 'listItem' && block.list?.kind === kind) return block.list.numId
  }
  return null
}

const INLINE_MARK_TAGS: Record<string, string> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  s: 'strike',
  del: 'strike',
  strike: 'strike',
}

function addMarkIfMissing(marks: PmMark[], markType: string): PmMark[] {
  return marks.some((m) => m.type === markType) ? marks : [...marks, { type: markType }]
}

function extractInlineStyleMarks(el: Element, marks: PmMark[]): PmMark[] {
  const style = el.getAttribute('style') ?? ''
  if (!style) return marks
  let next = marks
  if (/font-weight\s*:\s*(?:bold|bolder|[6-9]00)\b/i.test(style)) {
    next = addMarkIfMissing(next, 'bold')
  }
  if (/font-style\s*:\s*(?:italic|oblique)\b/i.test(style)) {
    next = addMarkIfMissing(next, 'italic')
  }
  if (/text-decoration(?:-line)?\s*:[^;]*\bunderline\b/i.test(style)) {
    next = addMarkIfMissing(next, 'underline')
  }
  if (/text-decoration(?:-line)?\s*:[^;]*\bline-through\b/i.test(style)) {
    next = addMarkIfMissing(next, 'strike')
  }
  return next
}

function ensureMarkOnNodes(nodes: PmNode[], markType: string): PmNode[] {
  return nodes.map((n) => {
    if (n.type !== 'text') return n
    const existing = n.marks ?? []
    if (existing.some((m) => m.type === markType)) return n
    return { ...n, marks: [...existing, { type: markType }] }
  })
}

function removeMarkFromNodes(nodes: PmNode[], markType: string): PmNode[] {
  return nodes.map((n) => {
    if (n.type !== 'text' || !n.marks) return n
    const filtered = n.marks.filter((m) => m.type !== markType)
    const next: PmNode = { ...n }
    if (filtered.length > 0) next.marks = filtered
    else delete next.marks
    return next
  })
}

function applyTextStyleToNodes(
  nodes: PmNode[],
  stylePatch: Record<string, unknown>,
  overwriteExisting = false,
): PmNode[] {
  return nodes.map((n) => {
    if (n.type !== 'text') return n
    const marks = [...(n.marks ?? [])]
    const idx = marks.findIndex((m) => m.type === 'docTextStyle')
    if (idx >= 0) {
      const curAttrs = marks[idx].attrs ?? {}
      const merged = overwriteExisting
        ? { ...curAttrs, ...stylePatch }
        : { ...stylePatch, ...curAttrs }
      marks[idx] = { type: 'docTextStyle', attrs: merged }
    } else {
      marks.push({ type: 'docTextStyle', attrs: { ...stylePatch } })
    }
    return { ...n, marks }
  })
}

function uppercaseTextNodes(nodes: PmNode[]): PmNode[] {
  return nodes.map((n) => (n.type === 'text' && n.text ? { ...n, text: n.text.toUpperCase() } : n))
}

function formatVnThousandDots(rawText: string): string {
  return rawText.replace(/\b(\d{1,3}(?:,\d{3})+|\d{4,})\b/g, (match) => {
    const digits = match.replace(/,/g, '')
    // Avoid formatting 4-digit years like 2025, 2026, 2027
    if (/^(?:19|20)\d{2}$/.test(digits)) return match
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  })
}

function sanitizeNd30Placeholders(rawHtml: string): string {
  let out = rawHtml
  // Replace {{PLACEHOLDER}} tokens if the model emitted template variables on a short prompt (1h)
  out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_full, keyRaw: string) => {
    const key = keyRaw.trim().toUpperCase()
    if (/SO_KY_HIEU|SO_HIEU|SO_VAN_BAN|SO_TO_TRINH|SO_QUYET_DINH/.test(key)) return '15/2026/TTr-ĐV'
    if (/\bNGAY\b/.test(key) && !/THANG|NAM/.test(key)) return '30'
    if (/\bTHANG\b/.test(key) && !/NAM/.test(key)) return '10'
    if (/\bNAM\b/.test(key)) return '2026'
    if (/DIA_DANH|TINH_THANH|THANH_PHO/.test(key)) return 'Hà Nội'
    if (/CO_QUAN_CHU_QUAN|DON_VI_CHU_QUAN/.test(key)) return 'ỦY BAN NHÂN DÂN THÀNH PHỐ'
    if (/CO_QUAN_BAN_HANH|DON_VI_BAN_HANH|TEN_DON_VI|TEN_CO_QUAN/.test(key))
      return 'PHÒNG HÀNH CHÍNH - TỔNG HỢP'
    if (/NGUOI_KY|HO_TEN|DAI_DIEN| HIEU_TRUONG|GIAM_DOC/.test(key)) return 'Nguyễn Văn An'
    if (/CHUC_VU/.test(key)) return 'THỦ TRƯỞNG ĐƠN VỊ'
    if (/NOI_NHAN/.test(key)) return 'Như trên'
    if (/TONG_TIEN|SO_TIEN/.test(key)) return '45.000.000'
    return keyRaw.trim().replace(/_/g, ' ')
  })
  // Normalize unaccented TONG CONG -> TỔNG CỘNG (1d)
  out = out.replace(/\bTONG\s+CONG\b/gi, 'TỔNG CỘNG')
  out = out.replace(/\bTONG\s+SO\b/gi, 'TỔNG SỐ')
  return out
}

const CAN_CU_LINE_RE = /^(?:Căn cứ|Xét đề nghị|Theo đề nghị)\b/i
const SEPARATOR_LINE_RE = /^[-_─━=*~]{3,}$/
const VN_DATE_LINE_RE =
  /^(?:[A-ZÀ-Ỹa-zà-ỹ0-9\s.,-]+,\s*)?ngày\s+(?:\d+|\.+|_+|\[.*?\])\s+tháng\s+(?:\d+|\.+|_+|\[.*?\])\s+năm\s+(?:\d+|\.+|_+|\[.*?\])/i

function ensureNd30InlineMarks(nodes: PmNode[], textJoined: string): PmNode[] {
  const trimmed = textJoined.trim()
  if (!trimmed) return nodes
  let out = nodes
  if (
    /^CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM$/i.test(trimmed) ||
    /^Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc$/i.test(trimmed) ||
    /^ĐẠI DIỆN BÊN\s+[A-Z0-9]/i.test(trimmed) ||
    /^THỦ TRƯỞNG ĐƠN VỊ/i.test(trimmed) ||
    /^NGƯỜI LẬP BIỂU$/i.test(trimmed) ||
    /^CHỦ TỌA(?:\s+CUỘC HỌP)?$/i.test(trimmed) ||
    /^THƯ KÝ(?:\s+CUỘC HỌP)?$/i.test(trimmed) ||
    /^(?:KT\.|TM\.|TL\.|TUQ\.)\s+[A-ZÀ-Ỹ]/i.test(trimmed) ||
    /^(?:HIỆU TRƯỞNG|PHÓ HIỆU TRƯỞNG|GIÁM ĐỐC|PHÓ GIÁM ĐỐC|TRƯỞNG PHÒNG|CHỦ TỊCH|TỔNG GIÁM ĐỐC|BỘ TRƯỞNG|CHÁNH VĂN PHÒNG)$/i.test(
      trimmed,
    )
  ) {
    out = ensureMarkOnNodes(out, 'bold')
  }
  if (
    /^Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc$/i.test(trimmed) &&
    !out.some((n) => n.marks?.some((m) => m.type === 'underline'))
  ) {
    // Preserve or apply underline on Tiêu ngữ when no separate separator line is present
    out = ensureMarkOnNodes(out, 'underline')
  }
  if (
    VN_DATE_LINE_RE.test(trimmed) ||
    /^\(Ký,?\s*(?:ghi rõ họ tên|đóng dấu)/i.test(trimmed) ||
    /^\(Ký và ghi rõ họ tên/i.test(trimmed) ||
    /^\(Chữ ký,?\s*dấu/i.test(trimmed) ||
    CAN_CU_LINE_RE.test(trimmed)
  ) {
    out = ensureMarkOnNodes(out, 'italic')
    if (CAN_CU_LINE_RE.test(trimmed) || VN_DATE_LINE_RE.test(trimmed)) {
      out = removeMarkFromNodes(out, 'bold')
    }
  }
  if (/^Nơi nhận\s*:$/i.test(trimmed)) {
    out = ensureMarkOnNodes(ensureMarkOnNodes(out, 'bold'), 'italic')
  }
  return out
}

const VN_DOC_TITLE_RE =
  /^(?:HỢP ĐỒNG|QUYẾT ĐỊNH|TỜ TRÌNH|CÔNG VĂN|BIÊN BẢN|THÔNG BÁO|BÁO CÁO|QUY CHẾ|QUY ĐỊNH|ĐIỀU LỆ|GIẤY ỦY QUYỀN|GIẤY ĐỀ NGHỊ|GIẤY GIỚI THIỆU|GIẤY XÁC NHẬN|ĐƠN XIN|ĐƠN ĐỀ NGHỊ|ĐƠN KHỞI KIỆN|ĐƠN KHIẾU NẠI|ĐƠN TỐ CÁO|BẢNG BÁO GIÁ|BÁO GIÁ|PHỤ LỤC|KẾ HOẠCH|CHƯƠNG TRÌNH|ĐỀ ÁN|ĐỀ CƯƠNG|THUYẾT MINH|HƯỚNG DẪN|NGHỊ QUYẾT|CHỈ THỊ|THỎA THUẬN|BẢN GHI NHỚ|CAM KẾT|BẢN CAM KẾT|THƯ MỜI|GIẤY MỜI|PHIẾU THU|PHIẾU CHI|PHIẾU ĐỀ XUẤT|LỆNH ĐIỀU ĐỘNG|BẢN MÔ TẢ CÔNG VIỆC|HỒ SƠ MỜI THẦU|BÀI GIẢNG|GIÁO ÁN|MA TRẬN ĐỀ|BẢNG MA TRẬN|ĐỀ KIỂM TRA|ĐỀ THI)(?:\s|$|:)/i

function parseInline(element: Node, marks: PmMark[]): PmNode[] {
  const effectiveMarks =
    element.nodeType === Node.ELEMENT_NODE
      ? extractInlineStyleMarks(element as Element, marks)
      : marks
  const nodes: PmNode[] = []
  element.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').replace(/\s+/g, ' ')
      if (text)
        nodes.push({
          type: 'text',
          text,
          ...(effectiveMarks.length > 0 ? { marks: [...effectiveMarks] } : {}),
        })
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'br') {
      nodes.push({ type: 'hardBreak' })
      return
    }
    const childStyleMarks = extractInlineStyleMarks(el, effectiveMarks)
    // HTML whitespace collapsing eats literal tabs, so a tab character needs a marker;
    // a self-closing <span data-tab /> is an open tag in HTML, so its "children" are the
    // text that follows and still have to be read
    if (el.hasAttribute('data-tab')) {
      nodes.push({
        type: 'text',
        text: '\t',
        ...(childStyleMarks.length > 0 ? { marks: [...childStyleMarks] } : {}),
      })
      nodes.push(...parseInline(el, childStyleMarks))
      return
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? ''
      nodes.push(
        ...parseInline(el, [...childStyleMarks, { type: 'link', attrs: { href, rId: null } }]),
      )
      return
    }
    if (tag === 'img') {
      const ref = IMAGE_REF_RE.exec(el.getAttribute('src') ?? '')
      if (ref)
        nodes.push({
          type: IMAGE_REF_NODE,
          attrs: { block: Number(ref[1]), index: Number(ref[2]) },
        })
      // any other <img> is not restricted HTML: pictures come in through insert_picture
      return
    }
    if (tag === 'formula') {
      const latex = (el.textContent ?? '').trim()
      if (!latex) return
      try {
        nodes.push(inlineEquationNodeJson(latex))
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        throw new Error(`Cannot parse the LaTeX in <formula> (${reason}): ${latex}`, { cause: e })
      }
      return
    }
    const markType = INLINE_MARK_TAGS[tag]
    if (markType) {
      const next = addMarkIfMissing(childStyleMarks, markType)
      nodes.push(...parseInline(el, next))
      return
    }
    // unknown inline tag (span etc.): keep its text content and any inline style marks
    nodes.push(...parseInline(el, childStyleMarks))
  })
  return nodes
}

function blockNode(type: string, attrs: Record<string, unknown>, content: PmNode[]): PmNode {
  const node: PmNode = {
    type,
    attrs: { docxIndex: null, styleId: null, aiChanged: true, ...attrs },
  }
  if (content.length > 0) node.content = content
  return node
}

function parseList(
  el: Element,
  kind: 'bullet' | 'ordered',
  ilvl: number,
  numIds: NumIds,
  out: PmNode[],
): void {
  el.childNodes.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const item = child as Element
    const tag = item.tagName.toLowerCase()
    if (tag === 'ul' || tag === 'ol') {
      parseList(item, tag === 'ol' ? 'ordered' : 'bullet', ilvl + 1, numIds, out)
      return
    }
    if (tag !== 'li') return
    // extract nested lists first so their items follow this one
    const nested: Element[] = []
    item.querySelectorAll(':scope > ul, :scope > ol').forEach((n) => {
      nested.push(n)
      n.remove()
    })
    out.push(
      blockNode(
        'docListItem',
        { kind, numId: numIds[kind], ilvl: Math.min(ilvl, 4) },
        parseInline(item, []),
      ),
    )
    for (const n of nested) {
      parseList(n, n.tagName.toLowerCase() === 'ol' ? 'ordered' : 'bullet', ilvl + 1, numIds, out)
    }
  })
}

/** paragraph texts of one table cell: <br> and nested <p>/<div> split paragraphs */
function cellParas(cell: Element): string[] {
  const paras: string[] = []
  let current = ''
  const push = () => {
    paras.push(current.replace(/\s+/g, ' ').trim())
    current = ''
  }
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        current += child.textContent ?? ''
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (tag === 'br') push()
      else if (tag === 'p' || tag === 'div') {
        if (current.trim()) push()
        walk(el)
        push()
      } else walk(el)
    })
  }
  walk(cell)
  if (current.trim()) push()
  const out = paras.filter((p, i) => p !== '' || (i > 0 && i < paras.length - 1))
  return out.length > 0 ? out : ['']
}

function extractTextAlign(el: Element): 'left' | 'center' | 'right' | 'justify' | undefined {
  const attrAlign = (el.getAttribute('align') ?? '').trim().toLowerCase()
  if (attrAlign === 'left' || attrAlign === 'center' || attrAlign === 'right' || attrAlign === 'justify') {
    return attrAlign
  }
  const style = el.getAttribute('style') ?? ''
  const m = /text-align\s*:\s*(left|center|right|justify)\b/i.exec(style)
  if (m) return m[1].toLowerCase() as 'left' | 'center' | 'right' | 'justify'
  return undefined
}

function extractCellWidthPct(el: Element): number | undefined {
  const attrWidth = (el.getAttribute('width') ?? '').trim()
  const mAttr = /^(\d+(?:\.\d+)?)%$/.exec(attrWidth)
  if (mAttr) return Number(mAttr[1])
  const style = el.getAttribute('style') ?? ''
  const mStyle = /(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)%/i.exec(style)
  if (mStyle) return Number(mStyle[1])
  return undefined
}

/** Parse one table cell into PmNode paragraphs, preserving inline marks (<b>, <i>, <u>) and <br>/<p> breaks */
function parseCellParagraphNodes(
  cell: Element,
  defaultAlign?: 'left' | 'center' | 'right' | 'justify',
  isHeader?: boolean,
): PmNode[] {
  const out: PmNode[] = []
  let currentInline: PmNode[] = []
  let currentAlign = defaultAlign
  const baseMarks: PmMark[] = extractInlineStyleMarks(cell, isHeader ? [{ type: 'bold' }] : [])

  const flush = () => {
    // Trim leading/trailing whitespace on text leaves
    while (currentInline.length > 0 && currentInline[0].type === 'hardBreak') {
      currentInline.shift()
    }
    while (currentInline.length > 0 && currentInline[currentInline.length - 1].type === 'hardBreak') {
      currentInline.pop()
    }
    const textJoined = currentInline.map((n) => n.text ?? '').join('').trim()
    let align = currentAlign
    if (textJoined) {
      if (/^Nơi nhận\s*:/i.test(textJoined) || /^-\s+(?:Như trên|Lưu\s*:)/i.test(textJoined)) {
        if (!extractTextAlign(cell)) align = 'left'
      } else if (
        !align &&
        (/^CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/i.test(textJoined) ||
          /^Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc/i.test(textJoined) ||
          /^ĐẠI DIỆN BÊN/i.test(textJoined) ||
          /^THỦ TRƯỞNG ĐƠN VỊ/i.test(textJoined) ||
          /^NGƯỜI LẬP BIỂU/i.test(textJoined) ||
          /^\(Ký,?\s*(?:ghi rõ họ tên|đóng dấu)/i.test(textJoined) ||
          /^\(Ký và ghi rõ họ tên/i.test(textJoined))
      ) {
        align = 'center'
      }
    }
    const normalizedInline =
      currentInline.length > 0 ? ensureNd30InlineMarks(currentInline, textJoined) : []
    out.push(
      blockNode(
        'docParagraph',
        align ? { align } : {},
        normalizedInline,
      ),
    )
    currentInline = []
    currentAlign = defaultAlign
  }

  const pushInlineSplittingBreaks = (nodes: PmNode[], alignOverride?: 'left' | 'center' | 'right' | 'justify') => {
    let flushedOnce = false
    for (const n of nodes) {
      if (n.type === 'hardBreak') {
        if (alignOverride) currentAlign = alignOverride
        flush()
        flushedOnce = true
      } else {
        currentInline.push(n)
      }
    }
    if (currentInline.length > 0 || !flushedOnce) {
      if (alignOverride) currentAlign = alignOverride
      flush()
    }
  }

  cell.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (tag === 'br') {
        flush()
        return
      }
      if (tag === 'p' || tag === 'div') {
        if (currentInline.length > 0) flush()
        const pAlign = extractTextAlign(el) ?? defaultAlign
        const parsed = parseInline(el, baseMarks)
        pushInlineSplittingBreaks(parsed, pAlign)
        return
      }
    }
    const fakeWrap = cell.ownerDocument.createElement('span')
    fakeWrap.appendChild(child.cloneNode(true))
    const parsed = parseInline(fakeWrap, baseMarks)
    for (const n of parsed) {
      if (n.type === 'hardBreak') {
        flush()
      } else {
        currentInline.push(n)
      }
    }
  })
  if (currentInline.length > 0 || out.length === 0) flush()
  return out
}

const BORDERLESS_CELL_BORDERS: NonNullable<TableCell['borders']> = {
  top: { style: 'none' },
  left: { style: 'none' },
  bottom: { style: 'none' },
  right: { style: 'none' },
}

const BORDERLESS_TABLE_BORDERS: NonNullable<TableModel['borders']> = {
  top: { style: 'none' },
  left: { style: 'none' },
  bottom: { style: 'none' },
  right: { style: 'none' },
  insideH: { style: 'none' },
  insideV: { style: 'none' },
}

function getParagraphNodeText(p: PmNode): string {
  return (p.content ?? [])
    .map((n) => n.text ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function deriveAgencyAbbrev(agencyName: string): string {
  const cleaned = agencyName
    .replace(/^(?:CÔNG TY|TRƯỜNG|PHÒNG|SỞ|BỘ|ỦY BAN NHÂN DÂN|UBND|BAN|VIỆN|TRUNG TÂM)\s+/i, '')
    .trim()
  const words = (cleaned || agencyName).split(/\s+/).filter(Boolean)
  const abbrev = words
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
    .replace(/[^A-ZĐ0-9]/g, '')
  return abbrev || 'ĐV'
}

/**
 * <table> -> protected table block: display TableModel + generated w:tbl
 * fragment. Cell texts are patched into the fragment at save time via the
 * existing genXml branch of pmDocToSavePlan (patchTableCellTexts), so the
 * model row/col counts must mirror the generated grid.
 */
function parseTable(el: Element, docTitleHint?: string): PmNode | null {
  const trs = Array.from(el.querySelectorAll('tr'))
  if (trs.length === 0) return null
  const rawRows = trs.map((tr) => Array.from(tr.children).filter((c) => /^t[hd]$/i.test(c.tagName)))
  const cols = Math.max(
    ...rawRows.map((r) =>
      r.reduce((sum, c) => sum + Math.max(1, Number(c.getAttribute('colspan')) || 1), 0),
    ),
  )
  if (cols === 0) return null
  const rawHeaderRow = rawRows[0].some((c) => c.tagName.toLowerCase() === 'th')

  const tableText = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  const explicitBorderless =
    el.getAttribute('border') === '0' ||
    /border(?:-style)?\s*:\s*(?:none|0)\b/i.test(el.getAttribute('style') ?? '')
  const isQuocHieuTable =
    cols <= 2 &&
    rawRows.length <= 2 &&
    /CỘNG HÒA XÃ HỘI|Độc lập\s*-\s*Tự do/i.test(tableText)
  const isSignatureTable =
    cols >= 2 &&
    cols <= 4 &&
    rawRows.length <= 2 &&
    /ĐẠI DIỆN BÊN|Ký,?\s*(?:ghi rõ họ tên|đóng dấu)|Ký và ghi rõ họ tên|NGƯỜI LẬP BIỂU|THỦ TRƯỞNG ĐƠN VỊ|Nơi nhận\s*:|CHỦ TỌA CUỘC HỌP|THƯ KÝ CUỘC HỌP|NGƯỜI LÀM ĐƠN|NGƯỜI ĐỀ NGHỊ|TM\.\s*HỘI ĐỒNG|TM\.\s*ỦY BAN|HIỆU TRƯỞNG|GIÁM ĐỐC|TRƯỞNG PHÒNG/i.test(
      tableText,
    )
  const firstRowTexts = rawRows[0].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
  const looksLikeDataHeader =
    !isQuocHieuTable &&
    !isSignatureTable &&
    !explicitBorderless &&
    rawRows.length >= 2 &&
    (rawHeaderRow ||
      /^(?:STT|TT|Số TT|Mã|Hạng mục|Nội dung|Khoản mục|Tiêu chí|Cấp)/i.test(firstRowTexts[0] ?? '') ||
      rawRows[0].every((c) => !!c.querySelector('b, strong')))
  const headerRow = looksLikeDataHeader
  const isBorderless = explicitBorderless || isQuocHieuTable || isSignatureTable
  const defaultCellAlign: 'center' | undefined =
    isQuocHieuTable || isSignatureTable ? 'center' : undefined

  // Detect budget / cost / item columns for NĐ30 & accounting tables (1d)
  const isSttTable = !isBorderless && /^(?:STT|TT|Số TT)$/i.test(firstRowTexts[0] ?? '')
  const isBudgetTable =
    !isBorderless &&
    (isSttTable ||
      firstRowTexts.some((h) =>
        /Đơn giá|Thành tiền|Số tiền|Kinh phí|Dự toán|Chi phí/i.test(h),
      ))

  const colDefaultAligns: Array<'left' | 'center' | 'right' | undefined> = Array.from(
    { length: cols },
    (_v, c) => {
      if (isBorderless) return undefined
      const h = firstRowTexts[c] ?? ''
      if (c === 0 && /^(?:STT|TT|Số TT|Mã)$/i.test(h)) return 'center'
      if (/^(?:ĐVT|Đơn vị(?:\s*tính)?|SL|Số lượng|Tỷ lệ|Hệ số|Tháng|Năm)$/i.test(h)) return 'center'
      if (/Đơn giá|Thành tiền|Số tiền|Kinh phí|Dự toán|Chi phí|Giá trị|Mức chi|Tổng số/i.test(h))
        return 'right'
      if (cols === 6 && isBudgetTable) {
        if (c === 0 || c === 2 || c === 3) return 'center'
        if (c === 4 || c === 5) return 'right'
        return 'left'
      }
      return undefined
    },
  )

  const rows: TableCell[][] = rawRows.map((cells, r) => {
    const isHeader = headerRow && r === 0
    const rowText = cells.map((c) => (c.textContent ?? '').trim()).join(' ')
    const isTotalRow =
      !isBorderless &&
      r > 0 &&
      /\b(?:TỔNG\s*CỘNG|TONG\s*CONG|CỘNG|TỔNG\s*SỐ|TONG\s*SO|TỔNG\s*KINH\s*PHÍ)\b/i.test(rowText)
    let colCursor = 0
    const row: TableCell[] = cells.map((cell) => {
      const c = colCursor
      const colSpan = Math.max(1, Number(cell.getAttribute('colspan')) || 1)
      colCursor += colSpan
      const cellText = (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
      const isNoiNhanCell = /\bNơi nhận\s*:/i.test(cellText)
      const isNumericCell =
        !isBorderless &&
        !isHeader &&
        c >= 2 &&
        /^\s*-?\d[\d.,\s]*(?:\s*(?:đ|đồng|VND|VNĐ))?\s*$/i.test(cellText)
      const isTotalLabelCell =
        isTotalRow && /^(?:TỔNG\s*CỘNG|TONG\s*CONG|CỘNG|TỔNG\s*SỐ|TỔNG\s*KINH\s*PHÍ|TỔNG)$/i.test(cellText)
      const cellAlign =
        isHeader
          ? 'center'
          : isNoiNhanCell
            ? 'left'
            : isTotalLabelCell
              ? 'center'
              : isNumericCell || colDefaultAligns[c] === 'right'
                ? 'right'
                : extractTextAlign(cell) ?? colDefaultAligns[c] ?? defaultCellAlign
      return {
        paras: cellParas(cell),
        ...(colSpan > 1 ? { colSpan } : {}),
        ...(cellAlign ? { align: cellAlign } : {}),
        ...(isBorderless ? { borders: BORDERLESS_CELL_BORDERS, vAlign: 'top' as const } : {}),
        ...(isHeader
          ? { bold: true, fill: TABLE_HEADER_FILL, vAlign: 'center' as const }
          : isTotalRow
            ? { bold: true }
            : {}),
      }
    })
    while (row.reduce((s, cell) => s + (cell.colSpan ?? 1), 0) < cols)
      row.push({
        paras: [''],
        ...(isHeader ? { align: 'center' } : defaultCellAlign ? { align: defaultCellAlign } : {}),
        ...(isBorderless ? { borders: BORDERLESS_CELL_BORDERS, vAlign: 'top' as const } : {}),
        ...(isHeader
          ? { bold: true, fill: TABLE_HEADER_FILL, vAlign: 'center' as const }
          : isTotalRow
            ? { bold: true }
            : {}),
      })
    return row
  })

  // Resolve column widths:
  // 1) For 2-column Quốc hiệu - Tiêu ngữ header tables (1a): always [44, 56] so Quốc hiệu fits on 1 line.
  // 2) For 2-column Signature / Nơi nhận tables (1e): [45, 55].
  // 3) For 6-column NĐ30 budget tables (1d): [6, 44, 10, 8, 15, 17] (STT 6%, Nội dung chi 44%, ĐVT 10%, SL 8%, Đơn giá 15%, Thành tiền 17%).
  const colEls = Array.from(el.querySelectorAll('colgroup col, :scope > col'))
  const colGroupWidths = colEls.length === cols ? colEls.map((c) => extractCellWidthPct(c)) : []
  const firstRowWidths =
    rawRows[0].length === cols ? rawRows[0].map((c) => extractCellWidthPct(c)) : []
  const explicitWidths =
    firstRowWidths.length === cols &&
    firstRowWidths.every((w): w is number => typeof w === 'number' && w > 0)
      ? firstRowWidths
      : colGroupWidths.length === cols &&
          colGroupWidths.every((w): w is number => typeof w === 'number' && w > 0)
        ? colGroupWidths
        : null
  const allEqualExplicit =
    explicitWidths !== null &&
    explicitWidths.length > 2 &&
    explicitWidths.every((w) => Math.abs(w - explicitWidths[0]!) < 1.5)

  let colWidthsPct: number[]
  let colWidthsTwips: number[] | undefined
  if (isQuocHieuTable && cols === 2) {
    colWidthsPct = [44, 56]
  } else if (isSignatureTable && cols === 2) {
    colWidthsPct = [45, 55]
  } else if (cols === 6 && !isBorderless && (isBudgetTable || !explicitWidths || allEqualExplicit)) {
    colWidthsPct = [6, 44, 10, 8, 15, 17]
    colWidthsTwips = [560, 3900, 900, 700, 1400, 1600]
  } else if (cols === 5 && !isBorderless && (isBudgetTable || !explicitWidths || allEqualExplicit)) {
    colWidthsPct = [7, 45, 10, 18, 20]
  } else if (cols === 4 && !isBorderless && (isSttTable || !explicitWidths || allEqualExplicit)) {
    colWidthsPct = [8, 52, 18, 22]
  } else if (cols === 3 && !isBorderless && (isSttTable || !explicitWidths || allEqualExplicit)) {
    colWidthsPct = [8, 62, 30]
  } else if (explicitWidths) {
    const sum = explicitWidths.reduce((a, b) => a + b, 0)
    colWidthsPct = explicitWidths.map((w) => Math.round((w / sum) * 1000) / 10)
  } else {
    colWidthsPct = Array.from({ length: cols }, () => 100 / cols)
  }

  const table: TableModel = {
    rows,
    colWidthsPct,
    ...(colWidthsTwips ? { colWidthsTwips } : {}),
    ...(isBorderless ? { borders: BORDERLESS_TABLE_BORDERS } : {}),
    ...(isSignatureTable
      ? {
          rowCantSplit: rows.map(() => true),
        }
      : {}),
  }
  const pmNode = tableModelToPmNode(table)
  if (colWidthsTwips && pmNode.content) {
    // Clear pixel-rounded colwidth on cells so pmTableToModel uses exact colWidthsTwips ([560, 3900, 900, 700, 1400, 1600])
    for (const rNode of pmNode.content) {
      for (const cNode of rNode.content ?? []) {
        if (cNode.attrs) cNode.attrs = { ...cNode.attrs, colwidth: null }
      }
    }
  }

  // Hydrate cell content with rich inline marks (<b>, <i>, <u>), NĐ30 rules, and paragraph alignment
  rawRows.forEach((cells, r) => {
    const rowNode = pmNode.content?.[r]
    if (!rowNode?.content) return
    if (isSignatureTable && rowNode.attrs) {
      rowNode.attrs = { ...rowNode.attrs, cantSplit: true, cantSplitEdited: true }
    }
    const isHeader = headerRow && r === 0
    const rowText = cells.map((c) => (c.textContent ?? '').trim()).join(' ')
    const isTotalRow =
      !isBorderless &&
      r > 0 &&
      /\b(?:TỔNG\s*CỘNG|TONG\s*CONG|CỘNG|TỔNG\s*SỐ|TONG\s*SO|TỔNG\s*KINH\s*PHÍ)\b/i.test(rowText)

    let colCursor = 0
    cells.forEach((cellEl, cellIdx) => {
      const c = colCursor
      const colSpan = Math.max(1, Number(cellEl.getAttribute('colspan')) || 1)
      colCursor += colSpan
      const cellNode = rowNode.content?.[cellIdx]
      if (!cellNode) return
      const cellText = (cellEl.textContent ?? '').replace(/\s+/g, ' ').trim()
      const isNoiNhanCell = /\bNơi nhận\s*:/i.test(cellText)
      const isNumericCell =
        !isBorderless &&
        !isHeader &&
        c >= 2 &&
        /^\s*-?\d[\d.,\s]*(?:\s*(?:đ|đồng|VND|VNĐ))?\s*$/i.test(cellText)
      const isTotalLabelCell =
        isTotalRow &&
        /^(?:TỔNG\s*CỘNG|TONG\s*CONG|CỘNG|TỔNG\s*SỐ|TỔNG\s*KINH\s*PHÍ|TỔNG)$/i.test(cellText)
      const cellAlign =
        isHeader
          ? 'center'
          : isNoiNhanCell
            ? 'left'
            : isTotalLabelCell
              ? 'center'
              : isNumericCell || colDefaultAligns[c] === 'right'
                ? 'right'
                : extractTextAlign(cellEl) ?? colDefaultAligns[c] ?? defaultCellAlign

      let paras = parseCellParagraphNodes(cellEl, cellAlign, isHeader)

      // 1a & 1h) Normalize 2-column Quốc hiệu - Tiêu ngữ Header Table
      if (isQuocHieuTable) {
        // Strip empty paragraphs and standalone separator lines (---, ___) so both columns start at row 0 line 0
        paras = paras.filter((p) => {
          const t = getParagraphNodeText(p)
          return t !== '' && !SEPARATOR_LINE_RE.test(t)
        })
        if (c === 0) {
          // Left column: governing agency (regular upright uppercase), issuing agency (BOLD + UNDERLINE uppercase), Số/ký hiệu (regular upright)
          const soIdx = paras.findIndex((p) => /^(?:Số|SỐ)\s*:/i.test(getParagraphNodeText(p)))
          const agencyParas = soIdx >= 0 ? paras.slice(0, soIdx) : [...paras]
          let soPara = soIdx >= 0 ? paras[soIdx] : null
          const normalizedLeft: PmNode[] = []

          if (agencyParas.length >= 2) {
            // Line 0: Cơ quan chủ quản -> UPPERCASE, regular upright (NO bold, NO italic, NO underline)
            const govPara = agencyParas[0]!
            let govInline = uppercaseTextNodes(govPara.content ?? [])
            govInline = removeMarkFromNodes(govInline, 'bold')
            govInline = removeMarkFromNodes(govInline, 'italic')
            govInline = removeMarkFromNodes(govInline, 'underline')
            govInline = applyTextStyleToNodes(
              govInline,
              {
                font: 'Times New Roman',
                fontAscii: 'Times New Roman',
                eastAsiaFont: 'Times New Roman',
                sizeHalfPoints: 24,
              },
              true,
            )
            normalizedLeft.push(
              blockNode(
                'docParagraph',
                { align: 'center', spaceBefore: 0, spaceAfter: 20, lineSpacing: 1.1 },
                govInline,
              ),
            )
            // Line 1+: Cơ quan ban hành -> UPPERCASE, BOLD + UNDERLINE (gạch chân ngắn)
            for (let i = 1; i < agencyParas.length; i++) {
              let issInline = uppercaseTextNodes(agencyParas[i]!.content ?? [])
              issInline = ensureMarkOnNodes(issInline, 'bold')
              issInline = ensureMarkOnNodes(issInline, 'underline')
              issInline = removeMarkFromNodes(issInline, 'italic')
              issInline = applyTextStyleToNodes(
                issInline,
                {
                  font: 'Times New Roman',
                  fontAscii: 'Times New Roman',
                  eastAsiaFont: 'Times New Roman',
                  sizeHalfPoints: 25,
                },
                true,
              )
              normalizedLeft.push(
                blockNode(
                  'docParagraph',
                  { align: 'center', spaceBefore: 0, spaceAfter: 40, lineSpacing: 1.1 },
                  issInline,
                ),
              )
            }
          } else if (agencyParas.length === 1) {
            let issInline = uppercaseTextNodes(agencyParas[0]!.content ?? [])
            issInline = ensureMarkOnNodes(issInline, 'bold')
            issInline = ensureMarkOnNodes(issInline, 'underline')
            issInline = removeMarkFromNodes(issInline, 'italic')
            issInline = applyTextStyleToNodes(
              issInline,
              {
                font: 'Times New Roman',
                fontAscii: 'Times New Roman',
                eastAsiaFont: 'Times New Roman',
                sizeHalfPoints: 26,
              },
              true,
            )
            normalizedLeft.push(
              blockNode(
                'docParagraph',
                { align: 'center', spaceBefore: 0, spaceAfter: 40, lineSpacing: 1.1 },
                issInline,
              ),
            )
          }

          const issuingAgencyName =
            agencyParas.length > 0
              ? getParagraphNodeText(agencyParas[agencyParas.length - 1]!)
              : 'ĐƠN VỊ'
          const agencyAbbrev = deriveAgencyAbbrev(issuingAgencyName)
          const docTypeAbbrev = /QUYẾT ĐỊNH/i.test(docTitleHint ?? '')
            ? 'QĐ'
            : /BÁO CÁO/i.test(docTitleHint ?? '')
              ? 'BC'
              : /THÔNG BÁO/i.test(docTitleHint ?? '')
                ? 'TB'
                : /KẾ HOẠCH/i.test(docTitleHint ?? '')
                  ? 'KH'
                  : /CÔNG VĂN/i.test(docTitleHint ?? '')
                    ? 'CV'
                    : 'TTr'

          let soText = soPara ? getParagraphNodeText(soPara) : ''
          if (!soText || /\.\.\.|___|\[\s*\]/.test(soText) || /^Số\s*:\s*(?:\/|$)/i.test(soText)) {
            soText = `Số: 15/2026/${docTypeAbbrev}-${agencyAbbrev}`
          }
          const soInline = applyTextStyleToNodes(
            [{ type: 'text', text: soText }],
            {
              font: 'Times New Roman',
              fontAscii: 'Times New Roman',
              eastAsiaFont: 'Times New Roman',
              sizeHalfPoints: 26,
            },
            true,
          )
          normalizedLeft.push(
            blockNode(
              'docParagraph',
              { align: 'center', spaceBefore: 40, spaceAfter: 0, lineSpacing: 1.1 },
              soInline,
            ),
          )
          paras = normalizedLeft
        } else if (c === 1) {
          // Right column: Quốc hiệu (IN HOA đậm cỡ 12-13), Tiêu ngữ (đậm cỡ 13-14, gạch chân bằng độ dài dòng chữ), địa danh ngày tháng (nghiêng)
          const normalizedRight: PmNode[] = []
          for (const p of paras) {
            const t = getParagraphNodeText(p)
            if (/CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/i.test(t)) {
              let qhInline = [{ type: 'text', text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' }]
              qhInline = ensureMarkOnNodes(qhInline, 'bold')
              qhInline = applyTextStyleToNodes(
                qhInline,
                {
                  font: 'Times New Roman',
                  fontAscii: 'Times New Roman',
                  eastAsiaFont: 'Times New Roman',
                  sizeHalfPoints: 25, // 12.5pt (fits on 1 line cleanly, inside 12-13pt requirement)
                },
                true,
              )
              normalizedRight.push(
                blockNode(
                  'docParagraph',
                  { align: 'center', spaceBefore: 0, spaceAfter: 20, lineSpacing: 1.1 },
                  qhInline,
                ),
              )
            } else if (/Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc/i.test(t)) {
              let tnInline = [{ type: 'text', text: 'Độc lập - Tự do - Hạnh phúc' }]
              tnInline = ensureMarkOnNodes(tnInline, 'bold')
              tnInline = ensureMarkOnNodes(tnInline, 'underline')
              tnInline = applyTextStyleToNodes(
                tnInline,
                {
                  font: 'Times New Roman',
                  fontAscii: 'Times New Roman',
                  eastAsiaFont: 'Times New Roman',
                  sizeHalfPoints: 27, // 13.5pt (inside 13-14pt requirement)
                },
                true,
              )
              normalizedRight.push(
                blockNode(
                  'docParagraph',
                  { align: 'center', spaceBefore: 0, spaceAfter: 60, lineSpacing: 1.1 },
                  tnInline,
                ),
              )
            } else {
              let dateText = t
              if (/\.\.\.|___/.test(dateText)) {
                const locMatch = /^([^,]+),\s*ngày/i.exec(dateText)
                const loc = locMatch ? locMatch[1]!.trim() : 'Hà Nội'
                dateText = `${loc}, ngày 30 tháng 10 năm 2026`
              }
              let dtInline = [{ type: 'text', text: dateText }]
              dtInline = ensureMarkOnNodes(dtInline, 'italic')
              dtInline = applyTextStyleToNodes(
                dtInline,
                {
                  font: 'Times New Roman',
                  fontAscii: 'Times New Roman',
                  eastAsiaFont: 'Times New Roman',
                  sizeHalfPoints: 26, // 13pt
                },
                true,
              )
              normalizedRight.push(
                blockNode(
                  'docParagraph',
                  { align: 'center', spaceBefore: 20, spaceAfter: 0, lineSpacing: 1.1 },
                  dtInline,
                ),
              )
            }
          }
          paras = normalizedRight.length > 0 ? normalizedRight : paras
        }
      } else if (isSignatureTable) {
        // 1e) Normalize Nơi nhận (left column, 11-12pt, lineSpacing 1.0, spaceAfter 0) & Chữ ký (right column, 3-4 blank lines above signer name)
        if (isNoiNhanCell) {
          const expandedParas: PmNode[] = []
          for (const p of paras) {
            const t = getParagraphNodeText(p)
            if (!t) continue
            const inlineSplitMatch = /^(\s*Nơi nhận\s*:)\s+(.+)$/i.exec(t)
            if (inlineSplitMatch) {
              expandedParas.push(
                blockNode('docParagraph', { align: 'left' }, [{ type: 'text', text: 'Nơi nhận:' }]),
              )
              const restItems = inlineSplitMatch[2]!
                .split(/(?=-\s+)/)
                .map((s) => s.trim())
                .filter(Boolean)
              for (const item of restItems) {
                expandedParas.push(
                  blockNode('docParagraph', { align: 'left' }, [{ type: 'text', text: item }]),
                )
              }
            } else {
              expandedParas.push(p)
            }
          }
          paras = expandedParas.map((p) => {
            const t = getParagraphNodeText(p)
            const isHeading = /^Nơi nhận\s*:/i.test(t)
            let inline = p.content ?? []
            if (isHeading) {
              inline = [{ type: 'text', text: 'Nơi nhận:' }]
              inline = ensureMarkOnNodes(ensureMarkOnNodes(inline, 'bold'), 'italic')
              inline = applyTextStyleToNodes(
                inline,
                {
                  font: 'Times New Roman',
                  fontAscii: 'Times New Roman',
                  eastAsiaFont: 'Times New Roman',
                  sizeHalfPoints: 24, // 12pt
                },
                true,
              )
            } else {
              inline = removeMarkFromNodes(removeMarkFromNodes(inline, 'bold'), 'italic')
              inline = applyTextStyleToNodes(
                inline,
                {
                  font: 'Times New Roman',
                  fontAscii: 'Times New Roman',
                  eastAsiaFont: 'Times New Roman',
                  sizeHalfPoints: 22, // 11pt
                },
                true,
              )
            }
            return blockNode(
              'docParagraph',
              { align: 'left', spaceBefore: 0, spaceAfter: 0, lineSpacing: 1.0 },
              inline,
            )
          })
        } else {
          // Signer column: ensure title (BOLD UPPERCASE), instruction (italic), 3 blank lines, and signer name (BOLD)
          const nonEmpty = paras.filter((p) => getParagraphNodeText(p) !== '')
          if (nonEmpty.length >= 2) {
            const normalizedSig: PmNode[] = []
            const lastPara = nonEmpty[nonEmpty.length - 1]!
            const lastText = getParagraphNodeText(lastPara)
            const lastIsInstruction = /^\(Ký,?\s*(?:ghi rõ họ tên|đóng dấu)|^\(Ký và ghi rõ họ tên/i.test(
              lastText,
            )
            const signerNamePara = lastIsInstruction ? null : lastPara
            const headerParas = lastIsInstruction ? nonEmpty : nonEmpty.slice(0, -1)
            let hasKyInstruction = false

            for (const hp of headerParas) {
              const ht = getParagraphNodeText(hp)
              if (/^\(Ký,?\s*(?:ghi rõ họ tên|đóng dấu)|^\(Ký và ghi rõ họ tên|^\(Chữ ký/i.test(ht)) {
                hasKyInstruction = true
                let kyInline = ensureMarkOnNodes(
                  removeMarkFromNodes(hp.content ?? [], 'bold'),
                  'italic',
                )
                kyInline = applyTextStyleToNodes(
                  kyInline,
                  {
                    font: 'Times New Roman',
                    fontAscii: 'Times New Roman',
                    eastAsiaFont: 'Times New Roman',
                    sizeHalfPoints: 24, // 12pt
                  },
                  true,
                )
                normalizedSig.push(
                  blockNode(
                    'docParagraph',
                    { align: 'center', spaceBefore: 0, spaceAfter: 0, lineSpacing: 1.1 },
                    kyInline,
                  ),
                )
              } else {
                let titleInline = uppercaseTextNodes(hp.content ?? [])
                titleInline = ensureMarkOnNodes(removeMarkFromNodes(titleInline, 'italic'), 'bold')
                titleInline = applyTextStyleToNodes(
                  titleInline,
                  {
                    font: 'Times New Roman',
                    fontAscii: 'Times New Roman',
                    eastAsiaFont: 'Times New Roman',
                    sizeHalfPoints: 26, // 13pt
                  },
                  true,
                )
                normalizedSig.push(
                  blockNode(
                    'docParagraph',
                    { align: 'center', spaceBefore: 0, spaceAfter: 20, lineSpacing: 1.1 },
                    titleInline,
                  ),
                )
              }
            }

            if (!hasKyInstruction) {
              let kyInline: PmNode[] = [
                {
                  type: 'text',
                  text: '(Ký, ghi rõ họ tên và đóng dấu)',
                  marks: [
                    { type: 'italic' },
                    {
                      type: 'docTextStyle',
                      attrs: {
                        font: 'Times New Roman',
                        fontAscii: 'Times New Roman',
                        eastAsiaFont: 'Times New Roman',
                        sizeHalfPoints: 24,
                      },
                    },
                  ],
                },
              ]
              normalizedSig.push(
                blockNode(
                  'docParagraph',
                  { align: 'center', spaceBefore: 0, spaceAfter: 0, lineSpacing: 1.1 },
                  kyInline,
                ),
              )
            }

            // Insert 3 blank lines for signing & stamping (1e)
            for (let b = 0; b < 3; b++) {
              normalizedSig.push(
                blockNode(
                  'docParagraph',
                  {
                    align: 'center',
                    spaceBefore: 0,
                    spaceAfter: 0,
                    lineSpacing: 1.0,
                    emptyRunSize: 24,
                    emptyRunFont: 'Times New Roman',
                  },
                  [],
                ),
              )
            }

            if (signerNamePara) {
              let nameInline = ensureMarkOnNodes(
                removeMarkFromNodes(signerNamePara.content ?? [], 'italic'),
                'bold',
              )
              nameInline = applyTextStyleToNodes(
                nameInline,
                {
                  font: 'Times New Roman',
                  fontAscii: 'Times New Roman',
                  eastAsiaFont: 'Times New Roman',
                  sizeHalfPoints: 26, // 13pt
                },
                true,
              )
              normalizedSig.push(
                blockNode(
                  'docParagraph',
                  { align: 'center', spaceBefore: 0, spaceAfter: 0, lineSpacing: 1.1 },
                  nameInline,
                ),
              )
            }
            paras = normalizedSig
          }
        }
      } else if (!isBorderless) {
        // 1d & 1f) Data / Budget table formatting: header bold center, numbers right with thousand dots, TỔNG CỘNG bold
        paras = paras.map((p) => {
          let inline = (p.content ?? []).map((n) => {
            if (n.type !== 'text' || !n.text) return n
            let txt = n.text.replace(/\bTONG\s+CONG\b/gi, 'TỔNG CỘNG').replace(/\bTONG\s+SO\b/gi, 'TỔNG SỐ')
            if (!isHeader && (isNumericCell || colDefaultAligns[c] === 'right')) {
              txt = formatVnThousandDots(txt)
            }
            return { ...n, text: txt }
          })
          if (isHeader || isTotalRow) {
            inline = ensureMarkOnNodes(inline, 'bold')
          }
          inline = applyTextStyleToNodes(
            inline,
            {
              font: 'Times New Roman',
              fontAscii: 'Times New Roman',
              eastAsiaFont: 'Times New Roman',
              sizeHalfPoints: 24, // 12pt inside data tables so columns never wrap > 2-3 lines (1f)
            },
            false,
          )
          return blockNode(
            'docParagraph',
            {
              ...p.attrs,
              ...(cellAlign ? { align: cellAlign } : {}),
              spaceBefore: 20,
              spaceAfter: 20,
              lineSpacing: 1.1,
            },
            inline,
          )
        })
      }

      cellNode.content = paras
      if (cellAlign && cellNode.attrs) {
        cellNode.attrs = { ...cellNode.attrs, align: cellAlign }
      }
      if (rows[r]?.[c]) {
        rows[r]![c]!.paras = paras.map((p) => getParagraphNodeText(p))
      }
    })
  })
  return pmNode
}

/** <pre> -> mono/shaded paragraph; newlines preserved as hard breaks */
function parseCodeBlock(el: Element): PmNode | null {
  const text = (el.textContent ?? '').replace(/^\n/, '').replace(/\s+$/, '')
  if (!text) return null
  // Latin slot only: monospace applies to code text, an inherited CJK font stays intact
  const mark: PmMark = { type: 'docTextStyle', attrs: { fontAscii: CODE_BLOCK_PRESET.font } }
  const content: PmNode[] = []
  text.split('\n').forEach((line, i) => {
    if (i > 0) content.push({ type: 'hardBreak' })
    if (line !== '') content.push({ type: 'text', text: line, marks: [mark] })
  })
  return blockNode(
    'docParagraph',
    { shadingFill: CODE_BLOCK_PRESET.shadingFill, borders: CODE_BLOCK_PRESET.borders },
    content,
  )
}

/** <blockquote> -> indented gray paragraph with a left border */
function parseBlockquote(el: Element): PmNode | null {
  const mark: PmMark = { type: 'docTextStyle', attrs: { color: QUOTE_BLOCK_PRESET.color } }
  const inline = parseInline(el, [mark])
  if (inline.length === 0) return null
  return blockNode(
    'docParagraph',
    { indentLeft: QUOTE_BLOCK_PRESET.indentLeft, borders: QUOTE_BLOCK_PRESET.borders },
    inline,
  )
}

/**
 * Parse a restricted HTML fragment returned by the model into top-level PmNodes.
 * Tolerates markdown code fences and plain-text responses.
 */
/** placeholder emitted by the parser for `<img src="doc:B.I">`; resolveImageRefs swaps in the real picture */
const IMAGE_REF_NODE = '__imageRef'

/** the pictures read_blocks showed for this block, in the same order: no rules, no pending deletions, no withheld pictures */
function inlineImagesOf(block: ProseMirrorNode): ProseMirrorNode[] {
  const out: ProseMirrorNode[] = []
  block.descendants((n) => {
    if (
      n.type.name === 'docInlineImage' &&
      !n.attrs.rule &&
      !n.marks.some((m) => m.type.name === 'del' || m.type.name === REDACT_MARK)
    )
      out.push(n)
    return true
  })
  return out
}

/**
 * Swap `<img src="doc:B.I">` placeholders for the pictures they name in the
 * current document (before the edit lands). Unknown refs are dropped.
 * Returns the blocks that were referenced, so replace_blocks can tell which
 * pictures of the replaced range survive.
 */
export function resolveImageRefs(
  editor: Editor,
  nodes: PmNode[],
): { nodes: PmNode[]; kept: Array<{ block: number; index: number }>; unresolved: number } {
  const kept: Array<{ block: number; index: number }> = []
  let unresolved = 0
  const doc = editor.state.doc
  const visit = (list: PmNode[]): PmNode[] =>
    list.flatMap((n) => {
      if (n.type === IMAGE_REF_NODE) {
        const block = Number(n.attrs?.block)
        const index = Number(n.attrs?.index)
        const picture =
          block >= 0 && block < doc.childCount ? inlineImagesOf(doc.child(block))[index] : undefined
        if (!picture) {
          unresolved++
          return []
        }
        kept.push({ block, index })
        return [picture.toJSON() as PmNode]
      }
      return n.content ? [{ ...n, content: visit(n.content) }] : [n]
    })
  return { nodes: visit(nodes), kept, unresolved }
}

/** pictures (non-rule inline images) inside top-level blocks [start, end] */
export function countInlineImages(editor: Editor, start: number, end: number): number {
  let n = 0
  for (let i = start; i <= end && i < editor.state.doc.childCount; i++) {
    const block = editor.state.doc.child(i)
    if (!isTrackedDeleted(block)) n += inlineImagesOf(block).length
  }
  return n
}

const HAS_CHILD_BLOCK_TAG_RE =
  /^(?:h[1-6]|p|div|section|article|main|header|footer|ul|ol|table|pre|blockquote|formula)$/i

function splitInlineAtHardBreaks(inline: PmNode[]): PmNode[][] {
  const segments: PmNode[][] = []
  let cur: PmNode[] = []
  for (const node of inline) {
    if (node.type === 'hardBreak') {
      if (cur.length > 0) segments.push(cur)
      cur = []
    } else {
      cur.push(node)
    }
  }
  if (cur.length > 0) segments.push(cur)
  return segments
}

export function parseHtmlFragment(raw: string, numIds: NumIds): PmNode[] {
  let text = raw.trim()
  const fence = /```(?:html)?\s*([\s\S]*?)```/.exec(text)
  if (fence) text = fence[1].trim()
  if (!text) return []

  text = sanitizeNd30Placeholders(text)

  // plain text response (no tags): one paragraph per blank-line-separated chunk
  if (!/<[a-z][\s\S]*>/i.test(text)) {
    return text
      .split(/\n{2,}/)
      .map((para) =>
        blockNode('docParagraph', {}, [{ type: 'text', text: para.replace(/\s+/g, ' ').trim() }]),
      )
      .filter((n) => n.content?.[0]?.text)
  }

  const parsed = new DOMParser().parseFromString(text, 'text/html')
  const firstHeadingText = (parsed.body.querySelector('h1, h2')?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const isNd30Doc =
    /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM|Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc/i.test(text) ||
    VN_DOC_TITLE_RE.test(firstHeadingText) ||
    /\bNơi nhận\s*:/i.test(text) ||
    /\bCăn cứ\s+(?:Luật|Nghị định|Thông tư|Quyết định|Quy chế|Điều lệ)/i.test(text)

  const out: PmNode[] = []
  const pushFormula = (el: Element) => {
    const latex = (el.textContent ?? '').trim()
    if (!latex) return
    try {
      out.push(equationBlockJson(latex))
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      throw new Error(`Cannot parse the LaTeX in <formula> (${reason}): ${latex}`, { cause: e })
    }
  }

  const pushFormattedParagraph = (inlineChunk: PmNode[], explicitAlign?: 'left' | 'center' | 'right' | 'justify') => {
    const chunkText = inlineChunk
      .map((n) => n.text ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (!chunkText) return
    let normalized = ensureNd30InlineMarks(inlineChunk, chunkText)
    let align = explicitAlign
    if (CAN_CU_LINE_RE.test(chunkText)) {
      // 1c) Dòng căn cứ phải in nghiêng và căn trái, tuyệt đối không justify kéo giãn chữ
      align = 'left'
    } else if (
      !align &&
      (/^CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/i.test(chunkText) ||
        /^Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc/i.test(chunkText) ||
        /^\((?:Căn cứ|Ban hành kèm theo)/i.test(chunkText) ||
        /^Về việc\s+/i.test(chunkText) ||
        /^V\/v\s+/i.test(chunkText) ||
        /^Kính gửi\s*:/i.test(chunkText))
    ) {
      align = 'center'
    } else if (!align && isNd30Doc) {
      align = 'justify'
    }
    if (/^(?:Về việc|V\/v)\s+/i.test(chunkText)) {
      normalized = ensureMarkOnNodes(normalized, 'bold')
    }
    if (isNd30Doc) {
      normalized = applyTextStyleToNodes(
        normalized,
        {
          font: 'Times New Roman',
          fontAscii: 'Times New Roman',
          eastAsiaFont: 'Times New Roman',
          sizeHalfPoints: 26, // 13pt standard NĐ30 body size
        },
        false,
      )
    }
    out.push(
      blockNode(
        'docParagraph',
        {
          ...(align ? { align } : {}),
          ...(isNd30Doc
            ? {
                lineSpacing: 1.15,
                spaceBefore: CAN_CU_LINE_RE.test(chunkText) ? 20 : 40,
                spaceAfter: CAN_CU_LINE_RE.test(chunkText) ? 40 : 60,
              }
            : {}),
        },
        normalized,
      ),
    )
  }

  const walkBlockContainer = (container: Node) => {
    container.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent ?? '').trim()
        if (t) pushFormattedParagraph([{ type: 'text', text: t }])
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      const headingMatch = /^h([1-6])$/.exec(tag)
      if (headingMatch) {
        let level = Number(headingMatch[1])
        let align = extractTextAlign(el)
        const headingText = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
        const isMainDocTitle = VN_DOC_TITLE_RE.test(headingText)
        if (level === 2 && isMainDocTitle) {
          level = 1
        }
        if (!align && (level === 1 || isMainDocTitle)) {
          align = 'center'
        }
        let inline = parseInline(el, [])
        if (level === 1 || isMainDocTitle) {
          inline = ensureMarkOnNodes(inline, 'bold')
        }
        if (isNd30Doc) {
          inline = ensureMarkOnNodes(inline, 'bold')
          inline = applyTextStyleToNodes(
            inline,
            {
              font: 'Times New Roman',
              fontAscii: 'Times New Roman',
              eastAsiaFont: 'Times New Roman',
              sizeHalfPoints: level === 1 || isMainDocTitle ? 28 : 26, // 14pt main title, 13pt section heading
            },
            true,
          )
        }
        out.push(
          blockNode(
            'docHeading',
            {
              level,
              ...(align ? { align } : {}),
              ...(isNd30Doc
                ? {
                    lineSpacing: 1.15,
                    spaceBefore: level === 1 ? 120 : 80,
                    spaceAfter: level === 1 ? 40 : 60,
                    keepNext: true,
                  }
                : {}),
            },
            inline,
          ),
        )
      } else if (tag === 'ul' || tag === 'ol') {
        parseList(el, tag === 'ol' ? 'ordered' : 'bullet', 0, numIds, out)
      } else if (tag === 'table') {
        const node = parseTable(el, firstHeadingText)
        if (node) out.push(node)
      } else if (tag === 'pre') {
        const node = parseCodeBlock(el)
        if (node) out.push(node)
      } else if (tag === 'blockquote') {
        const node = parseBlockquote(el)
        if (node) out.push(node)
      } else if (tag === 'formula') {
        pushFormula(el)
      } else if (
        (tag === 'div' ||
          tag === 'section' ||
          tag === 'article' ||
          tag === 'main' ||
          tag === 'header' ||
          tag === 'footer') &&
        Array.from(el.children).some((c) => HAS_CHILD_BLOCK_TAG_RE.test(c.tagName))
      ) {
        walkBlockContainer(el)
      } else if (tag === 'p' || tag === 'div') {
        const inline = parseInline(el, [])
        if (inline.length > 0) {
          const explicitAlign = extractTextAlign(el)
          const hasHardBreak = inline.some((n) => n.type === 'hardBreak')
          const rawText = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
          // 1c) Split <br>-separated Căn cứ / Xét đề nghị / Kính gửi lines into distinct paragraphs so they never stretch
          if (
            hasHardBreak &&
            (isNd30Doc || /\b(?:Căn cứ|Xét đề nghị|Theo đề nghị|Kính gửi)\b/i.test(rawText))
          ) {
            const segments = splitInlineAtHardBreaks(inline)
            for (const seg of segments) {
              pushFormattedParagraph(seg, explicitAlign)
            }
          } else {
            pushFormattedParagraph(inline, explicitAlign)
          }
        }
      } else if (tag === 'hr') {
        // Ignore raw <hr> or separator elements outside text
      } else {
        // unknown block-ish tag: salvage the text
        const t = (el.textContent ?? '').trim()
        if (t) pushFormattedParagraph([{ type: 'text', text: t }])
      }
    })
  }

  walkBlockContainer(parsed.body)

  // Post-process NĐ30 structural rules (1a, 1c, 1e, 1f, 1h)
  if (isNd30Doc && out.length > 0) {
    // 1a) Ensure the right column of the Quốc hiệu table contains the date line (move standalone date paragraph if placed outside, or synthesize if missing)
    const firstBlock = out[0]
    if (firstBlock?.type === 'docTable') {
      const rightCell = firstBlock.content?.[0]?.content?.[1]
      if (rightCell?.content) {
        const hasDateInCell = rightCell.content.some((p) =>
          VN_DATE_LINE_RE.test(getParagraphNodeText(p)),
        )
        if (!hasDateInCell) {
          // Check if block 1 is a standalone date line
          const secondBlock = out[1]
          const secondText = secondBlock?.type === 'docParagraph' ? getParagraphNodeText(secondBlock) : ''
          let dateText = 'Hà Nội, ngày 30 tháng 10 năm 2026'
          if (secondText && VN_DATE_LINE_RE.test(secondText)) {
            dateText = secondText
            out.splice(1, 1)
          }
          const dtInline = applyTextStyleToNodes(
            ensureMarkOnNodes([{ type: 'text', text: dateText }], 'italic'),
            {
              font: 'Times New Roman',
              fontAscii: 'Times New Roman',
              eastAsiaFont: 'Times New Roman',
              sizeHalfPoints: 26,
            },
            true,
          )
          rightCell.content.push(
            blockNode(
              'docParagraph',
              { align: 'center', spaceBefore: 20, spaceAfter: 0, lineSpacing: 1.1 },
              dtInline,
            ),
          )
        }
      }
    }

    // 1h) If an administrative document (Tờ trình / Quyết định / Kế hoạch / Thông báo / Công văn) has no Căn cứ lines, synthesize 2 standard Căn cứ paragraphs
    const hasCanCu = out.some(
      (b) => b.type === 'docParagraph' && CAN_CU_LINE_RE.test(getParagraphNodeText(b)),
    )
    const needsCanCu = /^(?:TỜ TRÌNH|QUYẾT ĐỊNH|KẾ HOẠCH|THÔNG BÁO|PHƯƠNG ÁN|ĐỀ ÁN)\b/i.test(
      firstHeadingText,
    )
    if (needsCanCu && !hasCanCu) {
      let insertIdx = out.findIndex(
        (b) => b.type === 'docParagraph' && /^Kính gửi\s*:/i.test(getParagraphNodeText(b)),
      )
      if (insertIdx < 0) {
        insertIdx = out.findIndex(
          (b) => b.type === 'docParagraph' && /^(?:Về việc|V\/v)\s+/i.test(getParagraphNodeText(b)),
        )
      }
      if (insertIdx < 0) {
        insertIdx = out.findIndex((b) => b.type === 'docHeading' && b.attrs?.level === 1)
      }
      if (insertIdx >= 0) {
        const defaultCanCuLines = [
          'Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;',
          'Căn cứ chức năng, nhiệm vụ, quyền hạn và kế hoạch triển khai hoạt động năm 2026 của đơn vị;',
        ]
        const canCuNodes = defaultCanCuLines.map((line) =>
          blockNode(
            'docParagraph',
            { align: 'left', lineSpacing: 1.15, spaceBefore: 20, spaceAfter: 40 },
            applyTextStyleToNodes(
              ensureMarkOnNodes([{ type: 'text', text: line }], 'italic'),
              {
                font: 'Times New Roman',
                fontAscii: 'Times New Roman',
                eastAsiaFont: 'Times New Roman',
                sizeHalfPoints: 26,
              },
              true,
            ),
          ),
        )
        out.splice(insertIdx + 1, 0, ...canCuNodes)
      }
    }

    // 1e) If Nơi nhận & signature were emitted as standalone paragraphs/lists instead of a 2-column table, pack them into a 2-column borderless signature table with cantSplit
    const standaloneNoiNhanIdx = out.findIndex(
      (b, idx) =>
        idx > 0 &&
        b.type === 'docParagraph' &&
        /^Nơi nhận\s*:/i.test(getParagraphNodeText(b)),
    )
    if (standaloneNoiNhanIdx >= 0) {
      const tailBlocks = out.slice(standaloneNoiNhanIdx)
      const leftLines: string[] = ['Nơi nhận:']
      const rightLines: string[] = []
      let inRight = false
      for (let tIdx = 0; tIdx < tailBlocks.length; tIdx++) {
        const tb = tailBlocks[tIdx]!
        const txt = getParagraphNodeText(tb)
        if (!txt) continue
        if (tIdx === 0) {
          const afterColon = txt.replace(/^Nơi nhận\s*:\s*/i, '').trim()
          if (afterColon) {
            for (const part of afterColon.split(/(?=-\s+)/).map((s) => s.trim()).filter(Boolean)) {
              leftLines.push(part)
            }
          }
          continue
        }
        if (
          !inRight &&
          (tb.type === 'docListItem' ||
            /^[-•+]\s*/.test(txt) ||
            /^(?:Như trên|Lưu\s*:|Ban Giám|Phòng\s)/i.test(txt))
        ) {
          leftLines.push(txt.startsWith('-') ? txt : `- ${txt}`)
        } else {
          inRight = true
          rightLines.push(txt)
        }
      }
      if (leftLines.length === 1) {
        leftLines.push('- Như trên;', '- Lưu: VT.')
      }
      if (rightLines.length === 0) {
        rightLines.push('THỦ TRƯỞNG ĐƠN VỊ', '(Ký, ghi rõ họ tên và đóng dấu)')
      }
      const synthTable = parsed.createElement('table')
      synthTable.setAttribute('border', '0')
      const tr = parsed.createElement('tr')
      const tdLeft = parsed.createElement('td')
      for (const l of leftLines) {
        const p = parsed.createElement('p')
        p.textContent = l
        tdLeft.appendChild(p)
      }
      const tdRight = parsed.createElement('td')
      for (const r of rightLines) {
        const p = parsed.createElement('p')
        p.textContent = r
        tdRight.appendChild(p)
      }
      tr.appendChild(tdLeft)
      tr.appendChild(tdRight)
      synthTable.appendChild(tr)
      const sigTableNode = parseTable(synthTable, firstHeadingText)
      if (sigTableNode) {
        out.splice(standaloneNoiNhanIdx, out.length - standaloneNoiNhanIdx, sigTableNode)
      }
    }

    // Format list items with Times New Roman 13pt & 1.15 spacing
    for (let i = 0; i < out.length; i++) {
      const b = out[i]!
      if (b.type === 'docListItem') {
        b.attrs = { ...b.attrs, lineSpacing: 1.15, spaceBefore: 20, spaceAfter: 40 }
        if (b.content) {
          b.content = applyTextStyleToNodes(
            b.content,
            {
              font: 'Times New Roman',
              fontAscii: 'Times New Roman',
              eastAsiaFont: 'Times New Roman',
              sizeHalfPoints: 26,
            },
            false,
          )
        }
      }
      // 1e) Mark closing paragraphs (Trên đây là / Kính trình / Trân trọng...) with keepNext & keepLines
      if (b.type === 'docParagraph') {
        const pText = getParagraphNodeText(b)
        if (/^(?:Trên đây là|Vậy kính trình|Kính trình|Đề nghị\s|Rất mong\s|Trân trọng)/i.test(pText)) {
          b.attrs = { ...b.attrs, keepNext: true, keepLines: true }
        }
      }
      // 1f) Never allow a forced pageBreakBefore before any table, and keep intro paragraph attached to table
      if (b.type === 'docTable' && i > 0) {
        const prev = out[i - 1]!
        if (prev.attrs) {
          prev.attrs = { ...prev.attrs, pageBreakBefore: false, keepNext: true, keepLines: true }
        }
        // 1e) If this is the final signature table, also mark the 2 preceding paragraphs with keepNext: true so the closing paragraph and signature block stay on the same page
        if (i === out.length - 1 && i >= 2) {
          const prev2 = out[i - 2]!
          if (prev2.type === 'docParagraph' && prev2.attrs) {
            prev2.attrs = { ...prev2.attrs, keepNext: true, keepLines: true }
          }
        }
      }
    }
  }

  return out
}

const BLOCK_TAG = /<\/?(h[1-6]|p|div|ul|ol|li|table|thead|tbody|tr|th|td|pre|blockquote)\b/gi

/**
 * Parse the replacement for a selected span: plain text or inline HTML, or a
 * single <p>…</p>. Any other block structure is refused — the selection lives
 * inside one text block, so a multi-block answer belongs to replace_blocks.
 */
export function parseInlineFragment(raw: string): PmNode[] {
  let text = raw.trim()
  const fence = /```(?:html)?\s*([\s\S]*?)```/.exec(text)
  if (fence) text = fence[1].trim()
  const single = /^<p(?:\s[^>]*)?>([\s\S]*)<\/p>$/i.exec(text)
  if (single) text = single[1]
  if (BLOCK_TAG.test(text)) {
    BLOCK_TAG.lastIndex = 0
    throw new Error(
      'replace_selection takes inline content for the selected span only; block tags (p/h*/ul/table…) mean a rewrite of whole blocks — use replace_blocks',
    )
  }
  const parsed = new DOMParser().parseFromString(`<p>${text}</p>`, 'text/html')
  const p = parsed.body.firstElementChild
  return p ? parseInline(p, []) : []
}

// ---- applying parsed fragments ----

/** record the AI's content change as tracked revisions under this author */
export interface AiTrack {
  author: string
}

function revisionDate(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** blocks whose content ins/del marks can fully represent (tracked replace) */
const TRACKABLE_TYPES = new Set(['docParagraph', 'docHeading', 'docListItem'])

// ---- formatting inheritance for rewrites ----

/**
 * Give the replacement blocks the formatting of the blocks they replace.
 * New block i takes the next not-yet-used old block of the same role (scanning
 * forward), else the nearest earlier one (an expansion of one paragraph into
 * three gives all three the paragraph's formatting). A new table takes the
 * next old table in the range (see inheritTableFormatting). Blocks with no
 * same-role counterpart (a heading the model introduced, protected content)
 * are left as parsed. Tracked-deleted old blocks are not current content and
 * never serve as templates.
 *
 * `anchors`: also hand each template's docxIndex to the first new block it
 * formats (the rewrite saves as an in-place edit of that paragraph/table).
 * Every anchor is lent at most once and in document order, so docxIndex stays
 * unique — the TrackChanges recorder and the save plan key blocks by it.
 * Callers that keep the old blocks in the document (tracked rewrites) must
 * pass false.
 */
export function inheritBlockFormatting(
  editor: Editor,
  startIndex: number,
  endIndex: number,
  nodes: PmNode[],
  anchors: boolean,
): PmNode[] {
  const doc = editor.state.doc
  const templates: Array<{ node: ProseMirrorNode; at: number }> = []
  const tables: Array<{ node: ProseMirrorNode; at: number }> = []
  for (let i = startIndex; i <= Math.min(endIndex, doc.childCount - 1); i++) {
    const node = doc.child(i)
    if (isTrackedDeleted(node)) continue
    if (TRACKABLE_TYPES.has(node.type.name)) templates.push({ node, at: i })
    else if (node.type.name === 'docTable') tables.push({ node, at: i })
  }
  if (templates.length === 0 && tables.length === 0) return nodes
  let cursor = 0
  let tableCursor = 0
  // document index of the last block whose docxIndex was lent
  let lastAnchored = -1
  const used = new Set<number>()
  return nodes.map((next) => {
    if (next.type === 'docTable') {
      const table = tables[tableCursor]
      if (!table) return next
      tableCursor++
      const anchor = anchors && table.at > lastAnchored
      if (anchor) lastAnchored = table.at
      return inheritTableFormatting(table.node, next, { anchor })
    }
    if (!TRACKABLE_TYPES.has(next.type)) return next
    let j = templates.findIndex((t, k) => k >= cursor && sameBlockRole(t.node, next))
    if (j !== -1) cursor = j + 1
    else {
      for (let k = Math.min(cursor, templates.length) - 1; k >= 0; k--) {
        if (sameBlockRole(templates[k].node, next)) {
          j = k
          break
        }
      }
    }
    if (j === -1) return next
    const first = !used.has(j)
    used.add(j)
    // anchors additionally keep document order: a template reused out of
    // order lends its formatting but not its docxIndex
    const anchor = anchors && templates[j].at > lastAnchored
    if (anchor) lastAnchored = templates[j].at
    return inheritFrom(templates[j].node, next, { anchor, first })
  })
}

/**
 * Replace the top-level block range with the parsed nodes (marked aiChanged).
 * The new blocks inherit the replaced blocks' formatting (see
 * inheritBlockFormatting). With `track`, and when both sides are plain text
 * blocks, this becomes a tracked rewrite instead: the old blocks stay struck
 * through (del) and the new blocks follow with ins marks — accept/reject via Review.
 */
function scrollPosIntoView(editor: Editor, pos: number): void {
  if (typeof requestAnimationFrame === 'undefined') return
  requestAnimationFrame(() => {
    try {
      const dom =
        (editor.view.nodeDOM?.(pos) as HTMLElement | null) ??
        (editor.view.domAtPos?.(Math.min(pos + 1, editor.state.doc.content.size))?.node as
          | HTMLElement
          | null)
      const el = dom && typeof dom.scrollIntoView === 'function' ? dom : dom?.parentElement
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    } catch {
      // ignore in headless test environments
    }
  })
}

export function replaceBlockRange(
  editor: Editor,
  startIndex: number,
  endIndex: number,
  parsed: PmNode[],
  track?: AiTrack,
): boolean {
  if (parsed.length === 0) return false
  // a tracked rewrite keeps the old blocks (struck through) next to the new
  // ones, so the anchors stay with the old blocks until the user accepts
  const nodes = inheritBlockFormatting(editor, startIndex, endIndex, parsed, !track)
  const { from, to } = blockRangePositions(editor, startIndex, endIndex)
  const pmNodes = nodes.map((n) => editor.schema.nodeFromJSON(n))

  let oldTrackable = true
  editor.state.doc.nodesBetween(from, to, (node, _pos, parent) => {
    if (parent === editor.state.doc && !TRACKABLE_TYPES.has(node.type.name)) oldTrackable = false
    return false
  })
  const newTrackable = nodes.every((n) => TRACKABLE_TYPES.has(n.type))
  if (track && oldTrackable && newTrackable) {
    const { ins, del } = editor.schema.marks
    const date = revisionDate()
    // revision marks are the change indicator; no yellow aiChanged on top
    const tracked = nodes.map((n) =>
      editor.schema.nodeFromJSON({ ...n, attrs: { ...n.attrs, aiChanged: false } }),
    )
    const inserted = tracked.reduce((size, n) => size + n.nodeSize, 0)
    const tr = editor.state.tr
    tr.setMeta(TRACK_IGNORE, true)
    if (editor.state.doc.textBetween(from, to, '\n').trim() === '') {
      // nothing to strike through (blank paragraphs): replace outright
      tr.replaceWith(from, to, tracked)
      tr.addMark(from, from + inserted, ins.create({ author: track.author, date }))
    } else {
      tr.insert(to, tracked)
      tr.addMark(to, to + inserted, ins.create({ author: track.author, date }))
      tr.addMark(from, to, del.create({ author: track.author, date }))
    }
    editor.view.dispatch(tr)
    scrollPosIntoView(editor, from)
    return true
  }
  if (track) {
    const date = revisionDate()
    const oldNodes: ProseMirrorNode[] = []
    editor.state.doc.nodesBetween(from, to, (node, _pos, parent) => {
      if (parent === editor.state.doc) {
        oldNodes.push(
          node.type.create(
            {
              ...node.attrs,
              aiChanged: false,
              blockRevision: { kind: 'del', author: track.author, date },
            },
            node.content,
            node.marks,
          ),
        )
      }
      return false
    })
    const inserted = pmNodes.map((node) =>
      node.type.create(
        {
          ...node.attrs,
          aiChanged: false,
          blockRevision: { kind: 'ins', author: track.author, date },
        },
        node.content,
        node.marks,
      ),
    )
    const tr = editor.state.tr.replaceWith(from, to, [...oldNodes, ...inserted])
    tr.setMeta(TRACK_IGNORE, true)
    editor.view.dispatch(tr)
    scrollPosIntoView(editor, from)
    return true
  }
  editor.view.dispatch(editor.state.tr.replaceWith(from, to, pmNodes))
  scrollPosIntoView(editor, from)
  return true
}

/**
 * Replace an inline range inside one text block with the given inline nodes
 * (the replace_selection tool). The new text becomes the selection so a
 * follow-up scope:'selection' command targets it. With `track`, the old text
 * stays struck through (del) and the new text follows with ins marks.
 */
export function replaceInlineRange(
  editor: Editor,
  from: number,
  to: number,
  nodes: ProseMirrorNode[],
  track?: AiTrack,
): void {
  const tr = editor.state.tr
  const blockPos = tr.doc.resolve(from).before(1)
  const inserted = nodes.reduce((size, n) => size + n.nodeSize, 0)
  if (track) {
    const date = revisionDate()
    const { ins, del } = editor.schema.marks
    tr.insert(to, nodes)
    if (inserted > 0) tr.addMark(to, to + inserted, ins.create({ author: track.author, date }))
    tr.addMark(from, to, del.create({ author: track.author, date }))
    tr.setSelection(TextSelection.create(tr.doc, to, to + inserted))
    tr.setMeta(TRACK_IGNORE, true)
  } else {
    tr.replaceWith(from, to, nodes)
    tr.setSelection(TextSelection.create(tr.doc, from, from + inserted))
    const block = tr.doc.nodeAt(blockPos)
    if (block) tr.setNodeMarkup(blockPos, undefined, { ...block.attrs, aiChanged: true })
  }
  editor.view.dispatch(tr)
  scrollPosIntoView(editor, blockPos)
}

/** insert the parsed nodes after the given top-level block index */
export function insertBlocksAfter(
  editor: Editor,
  index: number,
  nodes: PmNode[],
  track?: AiTrack,
): boolean {
  if (nodes.length === 0) return false
  const { to } = blockRangePositions(editor, index, index)
  const pmNodes = nodes.map((n) =>
    editor.schema.nodeFromJSON(track ? { ...n, attrs: { ...n.attrs, aiChanged: false } } : n),
  )
  const tr = editor.state.tr.insert(to, pmNodes)
  if (track) {
    const date = revisionDate()
    let offset = to
    for (const node of pmNodes) {
      if (TRACKABLE_TYPES.has(node.type.name)) {
        tr.addMark(
          offset,
          offset + node.nodeSize,
          editor.schema.marks.ins.create({ author: track.author, date }),
        )
      } else {
        tr.setNodeMarkup(offset, undefined, {
          ...node.attrs,
          blockRevision: { kind: 'ins', author: track.author, date },
        })
      }
      offset += node.nodeSize
    }
    tr.setMeta(TRACK_IGNORE, true)
  }
  editor.view.dispatch(tr)
  scrollPosIntoView(editor, to)
  return true
}

/**
 * Clear all `aiChanged` highlight flags across the entire document (including
 * paragraphs inside table cells) without adding an undo history step (1g).
 */
export function clearAiChangedHighlights(editor: Editor): void {
  const view = editor.view
  let tr = view.state.tr
  let touched = false
  view.state.doc.descendants((node, pos) => {
    if (node.attrs?.aiChanged) {
      tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, aiChanged: false })
      touched = true
    }
  })
  if (!touched) return
  tr = tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}
