/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { Fragment, type ReactNode } from 'react'

/**
 * Minimal dependency-free markdown for chat bubbles: paragraphs, ul/ol,
 * headings, pipe tables, fenced code, **bold**, *italic*, `inline code`.
 * Tolerates partial (streaming) input — anything unrecognized renders as
 * plain text.
 *
 * Markdown links stay literal text unless the host passes a nav (single `nav`
 * prop or a `navs` list) whose scheme the href carries — then they become
 * in-app navigation links. External URLs never turn into clickable links here.
 */

export interface MarkdownNav {
  /** href prefix that renders as an in-app navigation link (e.g. 'docnav://') */
  scheme: string
  onNavigate: (href: string) => void
}

export interface MarkdownImage {
  /** Resolve an image href from `![alt](href)`; return undefined to skip the image */
  resolve?: (href: string) => string | undefined
}

/** first nav whose scheme prefixes href; undefined keeps the link dead text */
function matchNav(navs: readonly MarkdownNav[], href: string): MarkdownNav | undefined {
  return navs.find((n) => href.startsWith(n.scheme))
}

// Hrefs may carry one level of balanced parens (sheet names like `Data (2)`
// arrive as sheetnav://Data%20(2)!B2), so the href cannot simply stop at ')'.
const HREF = /(?:[^\s()]|\([^\s()]*\))+/.source
const INLINE_RE = new RegExp(
  `(\`[^\`\\n]+\`|\\*\\*[^*\\n]+?\\*\\*|\\*[^*\\n]+?\\*|!\\[[^\\]\\n]*\\]\\(${HREF}\\)|\\[[^\\]\\n]+\\]\\(${HREF}\\))`,
  'g',
)
const LINK_RE = new RegExp(`^\\[([^\\]]+)\\]\\((${HREF})\\)$`)
const IMG_RE = new RegExp(`^!\\[([^\\]]*)\\]\\((${HREF})\\)$`)
/** a whole line that is nothing but an image, the manual's figure syntax */
const IMG_LINE_RE = new RegExp(`^\\s*!\\[([^\\]]*)\\]\\((${HREF})\\)$`)

function renderInline(
  text: string,
  navs: readonly MarkdownNav[],
  images?: MarkdownImage,
): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    const tok = m[0] ?? ''
    if (tok.startsWith('`')) out.push(<code key={key++}>{tok.slice(1, -1)}</code>)
    else if (tok.startsWith('**'))
      // emphasis wraps inline content, so a cite link inside it still navigates
      out.push(<strong key={key++}>{renderInline(tok.slice(2, -2), navs, images)}</strong>)
    else if (tok.startsWith('![')) {
      // An image sharing a line with prose, a list step or a table cell — not
      // just a line of its own. parseBlocks only ever made a *whole* line an
      // image block, so anything with text around it reached this pass, and
      // this pass had no image case and printed the source. Without a resolver
      // — every chat panel passes none — the literal stands, which is exactly
      // what those panels rendered before.
      const img = IMG_RE.exec(tok)
      const src = img ? images?.resolve?.(img[2] ?? '') : undefined
      if (img && src) {
        out.push(
          <img key={key++} className="ai-md-img" src={src} alt={img[1] ?? ''} loading="lazy" />,
        )
      } else out.push(tok)
    } else if (tok.startsWith('[')) {
      const link = LINK_RE.exec(tok)
      const href = link?.[2] ?? ''
      const hit = link ? matchNav(navs, href) : undefined
      if (link && hit) {
        out.push(
          <a
            key={key++}
            className="ai-md-nav"
            href={href}
            onClick={(e) => {
              e.preventDefault()
              hit.onNavigate(href)
            }}
          >
            {link[1]}
          </a>,
        )
      } else {
        out.push(tok) // non-nav links keep today's literal rendering
      }
    } else out.push(<em key={key++}>{renderInline(tok.slice(1, -1), navs, images)}</em>)
    last = i + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type CellAlign = 'left' | 'center' | 'right' | undefined

type MdBlock =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'h'; text: string; level: number }
  | { kind: 'table'; align: CellAlign[]; head: string[]; rows: string[][] }
  | { kind: 'code'; lines: string[] }
  | { kind: 'img'; alt: string; href: string }

const FENCE_RE = /^\s*(`{3,}|~{3,})/
const DELIM_CELL_RE = /^\s*:?-+:?\s*$/

/** Splits a table row on pipes that are neither escaped nor inside inline code. */
function splitCells(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inCode = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\' && line[i + 1] === '|') {
      cur += '|'
      i++
    } else if (ch === '`') {
      inCode = !inCode
      cur += ch
    } else if (ch === '|' && !inCode) {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  if (cells.length && !cells[0]?.trim()) cells.shift()
  if (cells.length && !cells[cells.length - 1]?.trim()) cells.pop()
  return cells.map((c) => c.trim())
}

function parseDelimiterRow(line: string): CellAlign[] | null {
  if (!line.includes('-')) return null
  const cells = splitCells(line)
  if (!cells.length || !cells.every((c) => DELIM_CELL_RE.test(c))) return null
  return cells.map((c) => {
    const l = c.startsWith(':')
    const r = c.endsWith(':')
    if (l && r) return 'center'
    if (r) return 'right'
    if (l) return 'left'
    return undefined
  })
}

function normalizeChatMarkdownInput(raw: string): string {
  if (!raw) return raw
  const parts = raw.split(/(```[\s\S]*?```)/g)
  return parts
    .map((part, idx) => {
      if (idx % 2 === 1) return part
      let out = part
        .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, '')
        .replace(/<\|tool_call_start\|>[\s\S]*?(?:<\|tool_call_end\|>|$)/gi, '')
        .replace(/<function=[a-zA-Z0-9_.-]+>[\s\S]*?(?:<\/function>|$)/gi, '')
        .replace(/<invoke\b[\s\S]*?(?:<\/invoke>|$)/gi, '')
      if (/<table\b/i.test(out)) {
        out = out.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableInner) => {
          const rows: string[][] = []
          const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
          let trM: RegExpExecArray | null
          while ((trM = trRe.exec(String(tableInner))) !== null) {
            const cells: string[] = []
            const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi
            let cM: RegExpExecArray | null
            while ((cM = cellRe.exec(trM[1] ?? '')) !== null) {
              cells.push(
                (cM[1] ?? '')
                  .replace(/<br\s*\/?>/gi, ' ')
                  .replace(/<[^>]+>/g, '')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .replace(/\|/g, '\\|'),
              )
            }
            if (cells.length > 0) rows.push(cells)
          }
          if (rows.length === 0) return ''
          const cols = Math.max(...rows.map((r) => r.length))
          const pad = (r: string[]) => {
            const c = [...r]
            while (c.length < cols) c.push('')
            return `| ${c.join(' | ')} |`
          }
          const head = pad(rows[0]!)
          const sep = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`
          return `\n\n${[head, sep, ...rows.slice(1).map(pad)].join('\n')}\n\n`
        })
      }
      if (/<(?:h[1-6]|p|div|span|strong|b|em|i|u|ul|ol|li|br|hr)\b/i.test(out)) {
        out = out
          .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl, inner) => {
            const clean = String(inner).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
            return `\n\n${'#'.repeat(Number(lvl))} ${clean}\n\n`
          })
          .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => {
            const clean = String(inner).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
            return `\n- ${clean}`
          })
          .replace(/<\/?(?:ul|ol)\b[^>]*>/gi, '\n')
          .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
          .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<hr\s*\/?>/gi, '\n---\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<p\b[^>]*>/gi, '')
          .replace(/<\/?(?:div|span|u|font|center|section|article|header|footer|tbody|thead|tr|td|th)\b[^>]*>/gi, '')
      }
      if (out.includes('\\') || out.includes('$')) {
        out = out
          .replace(/\\(?:text|mathrm|textbf|textit)\{([^{}]*)\}/g, '$1')
          .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
          .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
          .replace(/\\times\b/g, '×')
          .replace(/\\div\b/g, '÷')
          .replace(/\\cdot\b/g, '·')
          .replace(/\\pm\b/g, '±')
          .replace(/\\(?:leq|le)\b/g, '≤')
          .replace(/\\(?:geq|ge)\b/g, '≥')
          .replace(/\\(?:neq|ne)\b/g, '≠')
          .replace(/\\approx\b/g, '≈')
          .replace(/\\infty\b/g, '∞')
          .replace(/\\sum\b/g, '∑')
          .replace(/\\pi\b/g, 'π')
          .replace(/\\Delta\b/g, 'Δ')
          .replace(/\\Rightarrow\b/g, '⇒')
          .replace(/\\(?:rightarrow|to)\b/g, '→')
          .replace(/\\left\s*([([])/g, '$1')
          .replace(/\\right\s*([\])])/g, '$1')
          .replace(/\\,/g, ' ')
          .replace(/\\\[([\s\S]*?)\\\]/g, '$1')
          .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
          .replace(/\$\$([^$]+)\$\$/g, '$1')
          .replace(/\$([^$\n]+)\$/g, '$1')
      }
      return out
    })
    .join('')
}

function parseBlocks(text: string): MdBlock[] {
  const normalizedText = normalizeChatMarkdownInput(text)
  const blocks: MdBlock[] = []
  let cur: MdBlock | null = null
  const flush = (): void => {
    if (cur) {
      blocks.push(cur)
      cur = null
    }
  }
  const lines = normalizedText.split('\n')
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx] ?? ''
    const line = raw.trimEnd()
    if (cur?.kind === 'code') {
      if (FENCE_RE.test(line)) flush()
      else cur.lines.push(raw)
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    // Standalone image line: ![alt](href) — the manual's figure syntax, and a
    // thing an AI reply can contain on its own. It is a *block* only when the
    // host can resolve it; see the render side, which falls back to the literal
    // text rather than dropping the line.
    const img = IMG_LINE_RE.exec(line)
    if (img) {
      flush()
      blocks.push({ kind: 'img', alt: img[1] ?? '', href: img[2] ?? '' })
      continue
    }
    if (FENCE_RE.test(line)) {
      flush()
      cur = { kind: 'code', lines: [] }
      continue
    }
    if (cur?.kind === 'table') {
      if (line.includes('|')) {
        const width = cur.head.length
        const cells = splitCells(line).slice(0, width)
        while (cells.length < width) cells.push('')
        cur.rows.push(cells)
        continue
      }
      flush()
    }
    if (line.includes('|')) {
      const align = parseDelimiterRow(lines[idx + 1] ?? '')
      if (align) {
        const head = splitCells(line)
        if (head.length === align.length) {
          flush()
          cur = { kind: 'table', align, head, rows: [] }
          idx++
          continue
        }
      }
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      flush()
      blocks.push({ kind: 'h', text: h[2] ?? '', level: (h[1] ?? '#').length })
      continue
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line)
    if (ul) {
      if (cur?.kind !== 'ul') {
        flush()
        cur = { kind: 'ul', items: [] }
      }
      cur.items.push(ul[1] ?? '')
      continue
    }
    const ol = /^\s*\d+[.、)]\s+(.*)$/.exec(line)
    if (ol) {
      if (cur?.kind !== 'ol') {
        flush()
        cur = { kind: 'ol', items: [] }
      }
      cur.items.push(ol[1] ?? '')
      continue
    }
    if (cur?.kind !== 'p') {
      flush()
      cur = { kind: 'p', lines: [] }
    }
    cur.lines.push(line)
  }
  flush()
  return blocks
}

export function Markdown({
  text,
  nav,
  navs,
  images,
}: {
  text: string
  nav?: MarkdownNav
  navs?: readonly MarkdownNav[]
  images?: MarkdownImage
}): React.JSX.Element {
  // the legacy single nav rides along with the newer list; first scheme
  // match wins, and hosts never pass overlapping schemes anyway
  const navList: readonly MarkdownNav[] = nav ? [nav, ...(navs ?? [])] : (navs ?? [])
  return (
    <div className="ai-md">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === 'h') {
          // level class lets hosts scale heading sizes (chat keeps them equal;
          // the manual styles h2/h3 distinctly)
          return (
            <p key={i} className={`ai-md-h ai-md-h${b.level}`}>
              {renderInline(b.text, navList, images)}
            </p>
          )
        }
        if (b.kind === 'img') {
          const src = images?.resolve?.(b.href)
          // No resolver, or one that misses: render the line as written. Six of
          // the AI panels pass no resolver at all, and swallowing a line
          // because a host cannot draw it loses whatever the model actually
          // said there.
          if (!src) return <p key={i}>{`![${b.alt}](${b.href})`}</p>
          return <img key={i} className="ai-md-img" src={src} alt={b.alt} loading="lazy" />
        }
        if (b.kind === 'ul' || b.kind === 'ol') {
          const items = b.items.map((it, j) => <li key={j}>{renderInline(it, navList, images)}</li>)
          return b.kind === 'ul' ? <ul key={i}>{items}</ul> : <ol key={i}>{items}</ol>
        }
        if (b.kind === 'code') {
          return (
            <pre key={i} className="ai-md-pre">
              <code>{b.lines.join('\n')}</code>
            </pre>
          )
        }
        if (b.kind === 'table') {
          const cellStyle = (j: number): React.CSSProperties | undefined =>
            b.align[j] ? { textAlign: b.align[j] } : undefined
          return (
            <div key={i} className="ai-md-table-wrap">
              <table className="ai-md-table">
                <thead>
                  <tr>
                    {b.head.map((c, j) => (
                      <th key={j} style={cellStyle(j)}>
                        {renderInline(c, navList, images)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((c, j) => (
                        <td key={j} style={cellStyle(j)}>
                          {renderInline(c, navList, images)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return (
          <p key={i}>
            {b.lines.map((ln, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(ln, navList, images)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
