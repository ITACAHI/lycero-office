/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase B.3: general_office bundle local tool executors.
 *
 * This bundle is always-on (required: true) and ships 3 tools:
 *   - docs.format_vn_currency
 *   - docs.insert_table
 *   - slides.theme_warm
 *
 * ponytail: format_vn_currency is also defined in accounting_vn (Phase B.1).
 * When B.1 lands, this copy stays as source of truth for general_office owner
 * priority. B.1 will dedupe to a shared utility — follow-up tracked separately.
 */

// ── Tool input types ────────────────────────────────────────────────

export interface FormatVnCurrencyInput {
  amount: number
  /** 'VND' (default) | 'billion' | 'million' */
  unit?: 'VND' | 'billion' | 'million'
}

export interface InsertTableInput {
  rows: number
  cols: number
  headers?: string[]
  data?: string[][]
}

export interface ThemeWarmInput {
  app: 'docs' | 'slides' | 'sheets'
}

// ── Tool results ────────────────────────────────────────────────────

export interface ToolResult {
  output: string
  isError?: boolean
  summary: string
}

// ── Tool implementations ────────────────────────────────────────────

/**
 * Format a number as Vietnamese currency string.
 * Examples:
 *   formatVnCurrency(1234567)        → "1.234.567 đ"
 *   formatVnCurrency(50000000, 'million') → "50 triệu đ"
 *   formatVnCurrency(2.5, 'billion') → "2,5 tỷ đ"
 */
export function formatVnCurrency(input: FormatVnCurrencyInput): string {
  const { amount, unit = 'VND' } = input

  if (unit === 'billion') {
    return `${amount.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} tỷ đ`
  }
  if (unit === 'million') {
    return `${amount.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} triệu đ`
  }

  // VND: integer formatting with dot separator
  const intAmount = Math.round(amount)
  const formatted = intAmount.toLocaleString('vi-VN')
  return `${formatted} đ`
}

/**
 * Generate a markdown table string.
 * Ponytail: markdown is a 1-liner return; TipTap JSON would be ~20 lines.
 */
export function insertTable(input: InsertTableInput): string {
  const { rows, cols, headers = [], data = [] } = input

  if (rows < 1 || cols < 1) {
    return '[Lỗi] Bảng phải có ít nhất 1 dòng và 1 cột.'
  }

  // Pad headers to full cols
  const paddedHeaders = [...headers]
  while (paddedHeaders.length < cols) {
    paddedHeaders.push(`Cột ${paddedHeaders.length + 1}`)
  }

  // Build header row
  const headerRow = `| ${paddedHeaders.slice(0, cols).join(' | ')} |`

  // Build separator row (e.g. |---|---|---|
  const separatorRow = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`

  // Build data rows
  const dataRows: string[] = []
  for (let r = 0; r < rows; r++) {
    const row = data[r] ?? []
    const paddedRow = [...row]
    while (paddedRow.length < cols) {
      paddedRow.push('')
    }
    dataRows.push(`| ${paddedRow.slice(0, cols).join(' | ')} |`)
  }

  return [headerRow, separatorRow, ...dataRows].join('\n')
}

/**
 * Return an Astryx theme spec for the warm palette (DESIGN.md §2).
 * All colors are CSS token IDs — never raw hex.
 *
 * @see packages/ui/src/tokens.css for full token reference.
 */
export function themeWarm(input: ThemeWarmInput): { spec: ThemeWarmSpec } {
  const { app } = input

  const spec: ThemeWarmSpec = {
    app,
    palette: 'warm',
    // Token IDs, not hex values (enforces WCAG AA 4.5:1 contrast)
    light: {
      background: 'var(--surface-subtle)',   // #F4F2EB — Matte Warm Ivory
      paper: 'var(--surface)',              // #F9F8F3 — soft paper
      ink: 'var(--text-primary)',            // #1C1B18 — warm ink
      accent: 'var(--color-ai-action)',      // #8B3A1A — Warm Terracotta
      border: 'var(--border)',               // #DDD9CE — hairline
    },
    dark: {
      background: 'var(--surface-subtle)',   // #262624 — Claude Warm Charcoal
      paper: 'var(--surface)',              // #2E2D2A — elevated surface
      ink: 'var(--text-primary)',           // #F5F4EF — warm off-white
      accent: 'var(--color-ai-action)',      // #D97757 — Radiant Terracotta
      border: 'var(--border)',              // #403E3A — warm border
    },
    // Micro-motion: Astryx easing per DESIGN.md §6
    motion: {
      transitionFast: 'var(--transition-fast)',  // 150ms cubic-bezier(0.16, 1, 0.3, 1)
      transitionMedium: 'var(--transition-medium)', // 200ms cubic-bezier(0.16, 1, 0.3, 1)
    },
    // App-specific overrides
    ...(app === 'slides' ? slidesOverrides : {}),
    ...(app === 'sheets' ? sheetsOverrides : {}),
    ...(app === 'docs' ? docsOverrides : {}),
  }

  return { spec }
}

// ── App-specific overrides ──────────────────────────────────────────

const docsOverrides = {}

const slidesOverrides = {
  canvas: {
    // 16:9 presentation canvas
    aspectRatio: '16 / 9',
    fontFamily: 'var(--gs-font-sans)', // Be Vietnam Pro
  },
}

const sheetsOverrides = {
  grid: {
    // Warm tint for cell background in dark mode
    cellFillDark: 'var(--bg-content)',   // #1F1E1C
    fontFigure: 'tabular-nums',           // tabular figures for numbers
  },
}

interface ThemeWarmSpec {
  app: 'docs' | 'slides' | 'sheets'
  palette: 'warm'
  light: {
    background: string
    paper: string
    ink: string
    accent: string
    border: string
  }
  dark: {
    background: string
    paper: string
    ink: string
    accent: string
    border: string
  }
  motion: {
    transitionFast: string
    transitionMedium: string
  }
  canvas?: { aspectRatio: string; fontFamily: string }
  grid?: { cellFillDark: string; fontFigure: string }
}

// ── Dispatcher ─────────────────────────────────────────────────────

export type GeneralOfficeToolName = 'docs.format_vn_currency' | 'docs.insert_table' | 'slides.theme_warm'

export function executeGeneralOfficeTool(
  name: GeneralOfficeToolName,
  input: Record<string, unknown>
): ToolResult {
  try {
    switch (name) {
      case 'docs.format_vn_currency': {
        const result = formatVnCurrency(input as unknown as FormatVnCurrencyInput)
        return { output: result, summary: 'Định dạng tiền tệ VN' }
      }
      case 'docs.insert_table': {
        const result = insertTable(input as unknown as InsertTableInput)
        return { output: result, summary: 'Chèn bảng vào tài liệu' }
      }
      case 'slides.theme_warm': {
        const result = themeWarm(input as unknown as ThemeWarmInput)
        return {
          output: JSON.stringify(result.spec, null, 2),
          summary: 'Áp dụng theme ấm cho ' + (input as unknown as ThemeWarmInput).app,
        }
      }
      default:
        return { output: `Unknown tool: ${name}`, isError: true, summary: name }
    }
  } catch (err) {
    return {
      output: err instanceof Error ? err.message : String(err),
      isError: true,
      summary: name,
    }
  }
}
