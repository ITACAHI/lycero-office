/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import JSZip from 'jszip'
import * as numfmt from 'numfmt'
import {
  blankXlsxBuffer,
  decodeCsvBuffer,
  isNumericCell,
  parseCsv,
} from '@lycero/xlsx-gateway/gateway/csv-import'
import { columnLabel, parseAddress, parseRange } from '@lycero/xlsx-gateway/domain/cell-address'
import { isRealExcelFormula, sanitizeExcelFormula } from '@lycero/xlsx-gateway/domain/workbook-dsl'
import {
  assembleWithJsZip,
  createBufferEntrySource,
  planCellEditsToXlsx,
  readBasicWorkbook,
  toA1Address,
  type CellEdit,
  type SheetFormulaValues,
  type SheetStructuralOps,
  type XlsxMutation,
} from '@lycero/xlsx-gateway/gateway/xlsx-gateway'
import {
  nextFreeRelationshipId,
  type SheetEditPlan,
} from '@lycero/xlsx-gateway/gateway/xlsx-sheets'
import { EMPTY_PAYLOADS, type GatewayPayloads } from './xlsx-gateway-ops'
import type { WorkbookStyleEdit } from '@lycero/xlsx-gateway/shared/edit-schemas'
import {
  echoStyleColor,
  fillDisplayColor,
  isGradientFill,
  isThemeColor,
  resolveStyleColor,
  type StyleColor,
  type StyleColorEcho,
} from '@lycero/xlsx-gateway/domain/style-color'
import {
  parseStylesheetFormats,
  type StylesheetFormats,
} from '@lycero/xlsx-gateway/gateway/xlsx-style-read'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { xlsToText } from '@lycero/file-parse'
import { atomicWriteFile } from '../../../../apps/sheets/src/main/atomic-write'
import { XlsxSidecarClient } from '../../../../apps/sheets/src/main/xlsx-sidecar-client'
import { CliError, EXIT } from '../result'
import { sheetNotFoundHints } from '../suggest'
import { xlsxSidecarPath } from '../resources'

export type Scalar = string | number | boolean | null

interface CellArea {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

/** The subset of the sidecar's workbook file model (apps/sheets desktop-api) the CLI reads. */
interface OpenedWorkbook {
  sessionId: string
  sheets: {
    id: string
    name: string
    rowCount: number
    columnCount: number
    columnWidths?: {
      startColumn: number
      endColumn: number
      width?: number
      hidden: boolean
      styleIndex?: number
    }[]
    freeze?: { frozenRows: number; frozenColumns: number } | null
    hidden?: boolean
    tables?: { range: CellArea; name?: string }[]
    comments?: { row: number; column: number }[]
    pivotTables?: { path: string; outputRef: string }[]
  }[]
  activeTab: number
  definedNames?: unknown[]
  styles?: CellStyle[]
  /** #RRGGBB in theme index order [lt1, dk1, lt2, dk2, accent1-6, hlink, folHlink] */
  themeColors?: string[]
  visuals?: {
    id: string
    sheetId: string
    kind: string
    anchor: { fromRow: number; fromColumn: number }
    chart?: { chartTypes: string[]; title: string; series: unknown[] }
  }[]
  date1904?: boolean
}

interface CellStyle {
  fontFamily?: string
  fontSize?: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  wrapText: boolean
  fontColor?: string
  fillColor?: string
  horizontalAlignment?: string
  verticalAlignment?: string
  numberFormat?: string
}

interface RangeResult {
  cells: { row: number; column: number; value?: Scalar; formula?: string; styleIndex?: number }[]
  rows?: { row: number; styleIndex?: number; height?: number; hidden?: boolean }[]
  merges?: CellArea[]
  hyperlinks?: unknown[]
  conditionalRules?: unknown[]
  autoFilter?: CellArea | null
  dataValidations?: unknown[]
  /** the sidecar indexes worksheets in the background and answers with what is ready so far */
  indexingComplete?: boolean
  indexedThroughRow?: number | null
}

const INDEXING_DEADLINE_MS = 120_000

/**
 * read_range answers after at most 750ms of indexing and expects the caller
 * to poll (the app's merge-workbooks loop); a band read once could come back
 * with rows still missing and no error.
 */
async function readRangeIndexed(
  client: XlsxSidecarClient,
  sessionId: string,
  sheetId: string,
  range: Bounds,
  /** sheet-wide features (filter, rules, links) arrive only with the finished index */
  complete = false,
): Promise<RangeResult> {
  const deadline = Date.now() + INDEXING_DEADLINE_MS
  for (;;) {
    const r = (await client.readRange({ sessionId, sheetId, range })) as RangeResult
    if (
      r.indexingComplete ||
      r.indexedThroughRow === undefined ||
      (!complete && r.indexedThroughRow !== null && r.indexedThroughRow >= range.endRow)
    ) {
      return r
    }
    if (Date.now() > deadline) {
      throw new CliError(EXIT.conversion, 'the workbook did not finish indexing in time', {
        indexed_through_row: r.indexedThroughRow,
        wanted_through_row: range.endRow,
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
}

type SheetMeta = OpenedWorkbook['sheets'][number]

function pickSheet(wb: OpenedWorkbook, name: string | undefined): SheetMeta {
  const meta = name
    ? wb.sheets.find((s) => s.name === name)
    : (wb.sheets[wb.activeTab] ?? wb.sheets[0])
  if (!meta) {
    throw new CliError(
      EXIT.usage,
      `sheet not found: ${name}`,
      { sheets: wb.sheets.map((s) => s.name) },
      sheetNotFoundHints(
        name ?? '',
        wb.sheets.map((s) => s.name),
      ),
    )
  }
  return meta
}

interface RecalcResult {
  cells: {
    sheet: string
    row: number
    column: number
    formatted: string
    number?: number
    isError?: boolean
  }[]
}

/** One short-lived sidecar process per call; the CLI has no session to keep alive. */
async function withSidecar<T>(fn: (client: XlsxSidecarClient) => Promise<T>): Promise<T> {
  const binary = xlsxSidecarPath()
  if (!binary) {
    throw new CliError(EXIT.conversion, 'xlsx engine (xlsx-sidecar) not found', {
      hint: 'set XLSX_SIDECAR_PATH or run a packaged Lycero Office',
    })
  }
  const client = new XlsxSidecarClient(binary)
  try {
    return await fn(client)
  } finally {
    client.stop()
  }
}

const LEGACY_CONVERT_EXTS = new Set(['.xls', '.xlsb', '.ods', '.ots'])

async function convertLegacyOrHtmlXlsToTarget(
  client: XlsxSidecarClient,
  sourcePath: string,
  targetPath: string,
): Promise<{ sheets: number; cells: number }> {
  try {
    return (await client.convertWorkbook({ path: sourcePath, targetPath })) as {
      sheets: number
      cells: number
    }
  } catch (err) {
    const ext = extname(sourcePath).toLowerCase()
    if (ext === '.xls') {
      // Many school/government portals export HTML <table> or XML Spreadsheet 2003 as .xls
      const bytes = await readFile(sourcePath)
      const parsedText = await xlsToText(bytes)
      const rows: Scalar[][] = parsedText
        .split(/\r?\n/)
        .filter((line) => line.length > 0 && !line.startsWith('## '))
        .map((line) =>
          line.split('\t').map((cell) => {
            const trimmed = cell.trim()
            return isNumericCell(trimmed) ? Number(trimmed) : trimmed
          }),
        )
      const blank = await blankWorkbook('Sheet1')
      const edits = cellEditsFromTable('Sheet1', rows)
      const mutation = await planCellEditsToXlsx(await createBufferEntrySource(blank), edits)
      const assembled = await assembleWithJsZip(blank, mutation)
      await writeFile(targetPath, assembled.buffer)
      return { sheets: 1, cells: edits.length }
    }
    throw err
  }
}

async function withOpenWorkbook<T>(
  path: string,
  fn: (client: XlsxSidecarClient, wb: OpenedWorkbook) => Promise<T>,
): Promise<T> {
  return withSidecar(async (client) => {
    const ext = extname(path).toLowerCase()
    let openPath = path
    let tempDir: string | null = null
    try {
      if (LEGACY_CONVERT_EXTS.has(ext)) {
        tempDir = await mkdtemp(join(tmpdir(), 'lycero-xls-'))
        openPath = join(tempDir, 'converted.xlsx')
        await convertLegacyOrHtmlXlsToTarget(client, path, openPath)
      }
      const wb = (await client.open(openPath, 'en')) as OpenedWorkbook
      try {
        return await fn(client, wb)
      } finally {
        await client.close(wb.sessionId)
      }
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }
  })
}

export interface SheetSummary {
  name: string
  rows: number
  columns: number
}

export interface WorkbookSummary {
  sheets: SheetSummary[]
  definedNames: number
  activeSheet: string | null
}

export async function workbookSummary(path: string): Promise<WorkbookSummary> {
  return withOpenWorkbook(path, async (_client, wb) => ({
    sheets: wb.sheets.map((s) => ({ name: s.name, rows: s.rowCount, columns: s.columnCount })),
    definedNames: wb.definedNames?.length ?? 0,
    activeSheet: wb.sheets[wb.activeTab]?.name ?? null,
  }))
}

/** Legacy spreadsheet formats (xls, xlsb, ods) → xlsx with values and formulas. */
export async function convertLegacyWorkbook(
  path: string,
  targetPath: string,
): Promise<{ sheets: number; cells: number }> {
  return withSidecar(async (client) => {
    return convertLegacyOrHtmlXlsToTarget(client, path, targetPath)
  })
}

// ── reading ────────────────────────────────────────────────────────────

const READ_ROW_CAP = 500
const READ_COL_CAP = 100

export interface SheetFeatures {
  frozen: { rows: number; columns: number } | null
  filter: string | null
  /** merged ranges that touch the read range */
  merges: string[]
  charts: { id: string; title: string; types: string[]; series: number; anchor: string }[]
  tables: { name: string | null; range: string }[]
  /** output ranges of the sheet's pivot tables */
  pivots: string[]
  conditionalFormats: number
  dataValidations: number
  /** links on cells of the read range */
  hyperlinks: number
  notes: number
  hiddenColumns: number
  hiddenSheet: boolean
}

export interface CellFormat {
  bold?: true
  italic?: true
  underline?: true
  strikethrough?: true
  wrapText?: true
  fontFamily?: string
  fontSize?: number
  fontColor?: string
  /** when the font color is a theme slot: the slot and tint behind `fontColor` */
  fontColorTheme?: { theme: string; tint?: number }
  fillColor?: string
  /** pattern / gradient / theme-slot fills as stored, with each color resolved to rgb */
  fill?: FillEcho
  horizontalAlign?: string
  verticalAlign?: string
  numberFormat?: string
}

export type FillEcho =
  | { pattern: string; fg: StyleColorEcho; bg?: StyleColorEcho }
  | {
      gradient: {
        type?: 'linear' | 'path'
        angle?: number
        left?: number
        right?: number
        top?: number
        bottom?: number
        stops: { position: number; color: StyleColorEcho }[]
      }
    }
export type ReadWhere = 'formula' | 'error' | 'empty' | 'number' | 'text'
export const READ_WHERE: readonly ReadWhere[] = ['formula', 'error', 'empty', 'number', 'text']

const ERROR_VALUE = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|SPILL!|CALC!|GETTING_DATA)$/

export interface ReadOptions {
  sheet?: string
  range?: string
  formats?: boolean
  /** columns to keep, `A,C,E:G` */
  cols?: string
  /** stop after this many rows of the range */
  maxRows?: number
  where?: ReadWhere
  stats?: boolean
}

export interface MatchedCell {
  ref: string
  value: Scalar
  formula?: string
}

export interface SheetStats {
  sheets: { name: string; rows: number; columns: number }[]
  usedRange: string | null
  rows: number
  columns: number
  /** the range the counts below were taken over (the whole used area unless capped or --range) */
  scanned: string
  nonEmpty: number
  formulas: number
  errors: number
  numbers: number
  text: number
  booleans: number
  merges: number
}

export interface SheetRead {
  sheet: string
  range: string
  rows: Scalar[][]
  formulas: Record<string, string>
  truncated: boolean
  rowsShown: number
  rowsTotal: number
  /** with `cols`: the column of each entry of every row */
  columns?: string[]
  /** with `where`: only the matching cells */
  cells?: MatchedCell[]
  matches?: number
  stats?: SheetStats
  features: SheetFeatures
  /** with `formats`: styled cells of the range, by A1 address */
  formats?: Record<string, CellFormat>
  /** with `formats`: column widths in px (Calibri 11 characters × 7) for columns the file sizes */
  columnWidths?: Record<string, number>
  /** with `formats`: row heights in points for rows the file sizes */
  rowHeights?: Record<string, number>
}

/** Excel's sheet limits; the gateway would write anything beyond them into a file no reader accepts. */
const MAX_ROWS = 1_048_576
const MAX_COLUMNS = 16_384

export function parseAddressChecked(
  address: string,
  what = 'cell',
): { row: number; column: number } {
  let parsed: { row: number; column: number }
  try {
    parsed = parseAddress(address.toUpperCase())
  } catch {
    throw new CliError(EXIT.usage, `invalid ${what} address: ${address}`, undefined, {
      reason: 'invalid_argument',
    })
  }
  if (parsed.row >= MAX_ROWS || parsed.column >= MAX_COLUMNS) {
    throw new CliError(
      EXIT.usage,
      `${what} address outside the sheet limits (XFD1048576): ${address}`,
    )
  }
  return parsed
}

const MATCH_CAP = 1000

function parseCols(spec: string): number[] {
  const bad = (): CliError =>
    new CliError(EXIT.usage, `--cols must look like A,C,E:G (got ${spec})`, undefined, {
      reason: 'invalid_argument',
    })
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const m = /^([A-Za-z]{1,3})(?::([A-Za-z]{1,3}))?$/.exec(part.trim())
    if (!m) throw bad()
    const a = parseAddressChecked(`${m[1]}1`, 'column').column
    const b = m[2] ? parseAddressChecked(`${m[2]}1`, 'column').column : a
    for (let c = Math.min(a, b); c <= Math.max(a, b); c++) out.add(c)
  }
  if (!out.size) throw bad()
  return [...out].sort((x, y) => x - y)
}

function parseRangeChecked(range: string): Bounds {
  const parts = range.split(':')
  if (parts.length > 2 || !parts[0])
    throw new CliError(EXIT.usage, `invalid range: ${range}`, undefined, {
      reason: 'invalid_argument',
    })
  const first = parseAddressChecked(parts[0], 'range')
  const second = parts[1] ? parseAddressChecked(parts[1], 'range') : first
  return {
    startRow: Math.min(first.row, second.row),
    startColumn: Math.min(first.column, second.column),
    endRow: Math.max(first.row, second.row),
    endColumn: Math.max(first.column, second.column),
  }
}

export async function readSheet(path: string, opts: ReadOptions): Promise<SheetRead> {
  const cols = opts.cols ? parseCols(opts.cols) : undefined
  return withOpenWorkbook(path, async (client, wb) => {
    const meta = pickSheet(wb, opts.sheet)
    const bounds = opts.range
      ? parseRangeChecked(opts.range)
      : {
          startRow: 0,
          startColumn: 0,
          endRow: Math.max(0, Math.min(meta.rowCount, READ_ROW_CAP) - 1),
          endColumn: Math.max(0, Math.min(meta.columnCount, READ_COL_CAP) - 1),
        }
    const truncated =
      !opts.range && (meta.rowCount > READ_ROW_CAP || meta.columnCount > READ_COL_CAP)
    // a range beyond the used area is simply empty, not an error; the sheet-wide
    // features still come with the read, so the request is clamped, not skipped
    const empty =
      meta.rowCount === 0 ||
      meta.columnCount === 0 ||
      bounds.startRow >= meta.rowCount ||
      bounds.startColumn >= meta.columnCount
    const result: RangeResult = await readRangeIndexed(
      client,
      wb.sessionId,
      meta.id,
      empty
        ? { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 }
        : {
            startRow: bounds.startRow,
            endRow: Math.min(bounds.endRow, Math.max(meta.rowCount - 1, bounds.startRow)),
            startColumn: bounds.startColumn,
            endColumn: Math.min(
              bounds.endColumn,
              Math.max(meta.columnCount - 1, bounds.startColumn),
            ),
          },
      true,
    )
    if (empty) {
      // the A1 probe only serves the sheet-wide fields; nothing per-range belongs to the asked area
      result.cells = []
      result.rows = []
      result.merges = []
      result.hyperlinks = []
    }
    const height = bounds.endRow - bounds.startRow + 1
    const width = bounds.endColumn - bounds.startColumn + 1
    const rows: Scalar[][] = Array.from({ length: height }, () => Array<Scalar>(width).fill(null))
    const formulas: Record<string, string> = {}
    const pending: { row: number; column: number }[] = []
    for (const c of result.cells) {
      const r = c.row - bounds.startRow
      const k = c.column - bounds.startColumn
      if (r < 0 || k < 0 || r >= height || k >= width) continue
      rows[r]![k] = c.value ?? null
      if (c.formula) {
        formulas[`${columnLabel(c.column)}${c.row + 1}`] = c.formula.startsWith('=')
          ? c.formula
          : `=${c.formula}`
        if (c.value === undefined || c.value === null)
          pending.push({ row: c.row, column: c.column })
      }
    }
    // formulas written without a cached value (e.g. by genoffice itself) are evaluated on the fly
    if (pending.length) {
      const box = boundingBox(pending)
      const cells = await recalcRange(client, path, meta.name, box)
      for (const cell of cells) {
        const r = cell.row - bounds.startRow
        const k = cell.column - bounds.startColumn
        if (r < 0 || k < 0 || r >= height || k >= width) continue
        if (rows[r]![k] === null && cell.formatted !== '')
          rows[r]![k] = cell.number ?? cell.formatted
      }
    }
    const rangeLabel = `${columnLabel(bounds.startColumn)}${bounds.startRow + 1}:${columnLabel(bounds.endColumn)}${bounds.endRow + 1}`
    const stats = opts.stats ? sheetStats(wb, meta, result, rows, formulas, rangeLabel) : undefined
    const rowsTotal = opts.range ? height : Math.max(meta.rowCount, height)
    const shownRows =
      opts.maxRows !== undefined && opts.maxRows < rows.length ? rows.slice(0, opts.maxRows) : rows
    const lastRow = bounds.startRow + Math.max(shownRows.length, 1) - 1
    const keptColumns = cols?.filter((c) => c >= bounds.startColumn && c <= bounds.endColumn)
    if (keptColumns && !keptColumns.length) {
      throw new CliError(
        EXIT.usage,
        `--cols ${opts.cols} lies outside ${rangeLabel}`,
        { valid_range: rangeLabel },
        { reason: 'out_of_range', suggestion: 'widen --range or drop --cols' },
      )
    }
    const inScope = (address: string): boolean => {
      const a = parseAddress(address)
      return a.row <= lastRow && (!keptColumns || keptColumns.includes(a.column))
    }
    const pick = <T>(byAddress: Record<string, T>): Record<string, T> =>
      Object.fromEntries(Object.entries(byAddress).filter(([k]) => inScope(k)))
    const read: SheetRead = {
      sheet: meta.name,
      range:
        shownRows.length < rows.length
          ? `${columnLabel(bounds.startColumn)}${bounds.startRow + 1}:${columnLabel(bounds.endColumn)}${lastRow + 1}`
          : rangeLabel,
      rows: keptColumns
        ? shownRows.map((r) => keptColumns.map((c) => r[c - bounds.startColumn] ?? null))
        : shownRows,
      formulas: pick(formulas),
      truncated: truncated || shownRows.length < rowsTotal,
      rowsShown: shownRows.length,
      rowsTotal,
      ...(keptColumns ? { columns: keptColumns.map(columnLabel) } : {}),
      features: sheetFeatures(wb, meta, result),
    }
    if (opts.where) {
      const cells: MatchedCell[] = []
      const columns = keptColumns ?? Array.from({ length: width }, (_, k) => bounds.startColumn + k)
      let matches = 0
      shownRows.forEach((r, i) => {
        columns.forEach((c) => {
          const value = r[c - bounds.startColumn] ?? null
          const ref = `${columnLabel(c)}${bounds.startRow + i + 1}`
          const formula = formulas[ref]
          if (!cellMatches(opts.where!, value, formula)) return
          matches++
          if (cells.length < MATCH_CAP) cells.push({ ref, value, ...(formula ? { formula } : {}) })
        })
      })
      read.cells = cells
      read.matches = matches
    }
    if (stats) read.stats = stats
    if (opts.formats) {
      const formats: Record<string, CellFormat> = {}
      // xf 0 is the workbook default; a style only counts where it differs from it
      const base = wb.styles?.[0]
      const stored = await storedFormats(path)
      for (const c of result.cells) {
        if (!c.styleIndex) continue
        const style = wb.styles?.[c.styleIndex]
        const format = style ? cellFormat(style, base) : undefined
        const echoed = withStoredColors(format, stored, c.styleIndex, wb.themeColors)
        if (echoed) formats[`${columnLabel(c.column)}${c.row + 1}`] = echoed
      }
      read.formats = pick(formats)
      read.columnWidths = Object.fromEntries(
        (meta.columnWidths ?? [])
          .filter((w) => w.width !== undefined)
          .flatMap((w) => {
            const out: [string, number][] = []
            for (let c = w.startColumn; c <= Math.min(w.endColumn, bounds.endColumn); c++) {
              if (c >= bounds.startColumn && (!keptColumns || keptColumns.includes(c)))
                out.push([columnLabel(c), Math.round(w.width! * PX_PER_CHAR)])
            }
            return out
          }),
      )
      read.rowHeights = Object.fromEntries(
        (result.rows ?? [])
          .filter((r) => r.height !== undefined && r.row <= lastRow)
          .map((r) => [String(r.row + 1), r.height!]),
      )
    }
    return read
  })
}

async function hasThemePart(source: Buffer): Promise<boolean> {
  const zip = await JSZip.loadAsync(source)
  return zip.file('xl/theme/theme1.xml') !== null
}

function styleHasThemeColor(style: WorkbookStyleEdit): boolean {
  const colors: unknown[] = [style.fontColor, style.fillColor]
  for (const edge of [style.borderTop, style.borderBottom, style.borderLeft, style.borderRight]) {
    if (edge) colors.push(edge.color)
  }
  if (style.fill) {
    if ('gradient' in style.fill) colors.push(...style.fill.gradient.stops.map((s) => s.color))
    else colors.push(style.fill.fg, style.fill.bg)
  }
  return colors.some((c) => isThemeColor(c as StyleColor | null | undefined))
}

function flattenThemeColors(style: WorkbookStyleEdit): WorkbookStyleEdit {
  const rgb = <T extends StyleColor | null | undefined>(c: T): string | T =>
    isThemeColor(c) ? resolveStyleColor(c) : c
  const out: WorkbookStyleEdit = { ...style }
  if (out.fontColor !== undefined) out.fontColor = rgb(out.fontColor)
  if (out.fillColor !== undefined) out.fillColor = rgb(out.fillColor)
  for (const key of ['borderTop', 'borderBottom', 'borderLeft', 'borderRight'] as const) {
    const edge = out[key]
    if (edge && edge.color !== undefined) out[key] = { ...edge, color: rgb(edge.color) }
  }
  if (out.fill) {
    out.fill =
      'gradient' in out.fill
        ? {
            gradient: {
              ...out.fill.gradient,
              stops: out.fill.gradient.stops.map((s) => ({ ...s, color: rgb(s.color) })),
            },
          }
        : {
            ...out.fill,
            fg: rgb(out.fill.fg),
            ...(out.fill.bg === undefined ? {} : { bg: rgb(out.fill.bg) }),
          }
  }
  return out
}

function sameStyleColor(a: StyleColor | undefined, b: StyleColor | undefined): boolean {
  if (typeof a === 'string' || typeof b === 'string' || !a || !b) return a === b
  return a.theme === b.theme && (a.tint ?? 0) === (b.tint ?? 0)
}

async function storedFormats(path: string): Promise<StylesheetFormats | undefined> {
  try {
    const zip = await JSZip.loadAsync(await readFile(path))
    const xml = await zip.file('xl/styles.xml')?.async('string')
    return xml === undefined ? undefined : parseStylesheetFormats(xml)
  } catch {
    return undefined
  }
}

/** the sidecar resolves every color to rgb; styles.xml still knows the theme slot and the pattern */
function withStoredColors(
  format: CellFormat | undefined,
  stored: StylesheetFormats | undefined,
  styleIndex: number,
  palette: readonly string[] | undefined,
): CellFormat | undefined {
  const xf = stored?.xfs[styleIndex]
  if (!stored || !xf) return format
  const out: CellFormat = { ...format }
  // the Normal font is usually theme="1": only a font the cell chose over it is a format
  const baseFont = stored.fontColors[stored.xfs[0]?.fontId ?? 0]
  const fontColor = stored.fontColors[xf.fontId]
  if (isThemeColor(fontColor) && !sameStyleColor(fontColor, baseFont)) {
    const echo = echoStyleColor(fontColor, palette)
    out.fontColor = echo.rgb
    out.fontColorTheme = { theme: echo.theme!, ...(echo.tint ? { tint: echo.tint } : {}) }
  }
  const fill = stored.fills[xf.fillId]
  if (fill) {
    // theme slots resolve here so fillColor and fill.fg.rgb agree byte for byte
    const display = fillDisplayColor(fill)
    if (display && (!out.fillColor || isThemeColor(display))) {
      out.fillColor = echoStyleColor(display, palette).rgb
    }
    if (isGradientFill(fill)) {
      const g = fill.gradient
      out.fill = {
        gradient: {
          ...(g.type ? { type: g.type } : {}),
          ...(g.angle !== undefined ? { angle: g.angle } : {}),
          ...(g.left !== undefined ? { left: g.left } : {}),
          ...(g.right !== undefined ? { right: g.right } : {}),
          ...(g.top !== undefined ? { top: g.top } : {}),
          ...(g.bottom !== undefined ? { bottom: g.bottom } : {}),
          stops: g.stops.map((stop) => ({
            position: stop.position,
            color: echoStyleColor(stop.color, palette),
          })),
        },
      }
    } else if (fill.pattern !== 'solid' || isThemeColor(fill.fg)) {
      out.fill = {
        pattern: fill.pattern,
        fg: echoStyleColor(fill.fg, palette),
        ...(fill.bg === undefined ? {} : { bg: echoStyleColor(fill.bg, palette) }),
      }
    }
  }
  return Object.keys(out).length ? out : undefined
}

function cellMatches(where: ReadWhere, value: Scalar, formula: string | undefined): boolean {
  switch (where) {
    case 'formula':
      return formula !== undefined
    case 'error':
      return typeof value === 'string' && ERROR_VALUE.test(value)
    case 'empty':
      return value === null && formula === undefined
    case 'number':
      return typeof value === 'number'
    case 'text':
      return typeof value === 'string' && !ERROR_VALUE.test(value)
  }
}

function sheetStats(
  wb: OpenedWorkbook,
  meta: SheetMeta,
  result: RangeResult,
  rows: Scalar[][],
  formulas: Record<string, string>,
  scanned: string,
): SheetStats {
  const stats: SheetStats = {
    sheets: wb.sheets.map((s) => ({ name: s.name, rows: s.rowCount, columns: s.columnCount })),
    usedRange:
      meta.rowCount && meta.columnCount
        ? `A1:${columnLabel(meta.columnCount - 1)}${meta.rowCount}`
        : null,
    rows: meta.rowCount,
    columns: meta.columnCount,
    scanned,
    nonEmpty: 0,
    formulas: Object.keys(formulas).length,
    errors: 0,
    numbers: 0,
    text: 0,
    booleans: 0,
    merges: result.merges?.length ?? 0,
  }
  for (const row of rows) {
    for (const v of row) {
      if (v === null) continue
      stats.nonEmpty++
      if (typeof v === 'number') stats.numbers++
      else if (typeof v === 'boolean') stats.booleans++
      else if (ERROR_VALUE.test(v)) stats.errors++
      else stats.text++
    }
  }
  return stats
}

/** OOXML column widths are in characters of the default font; 7 px per character is Calibri 11. */
const PX_PER_CHAR = 7

function areaLabel(a: CellArea): string {
  return `${columnLabel(a.startColumn)}${a.startRow + 1}:${columnLabel(a.endColumn)}${a.endRow + 1}`
}

/** Structure the values alone do not show: panes, filter, visuals and rule counts for the sheet; merges and links for the range. */
function sheetFeatures(wb: OpenedWorkbook, meta: SheetMeta, result: RangeResult): SheetFeatures {
  return {
    frozen: meta.freeze
      ? { rows: meta.freeze.frozenRows, columns: meta.freeze.frozenColumns }
      : null,
    filter: result.autoFilter ? areaLabel(result.autoFilter) : null,
    merges: (result.merges ?? []).map(areaLabel),
    charts: (wb.visuals ?? [])
      .filter((v) => v.sheetId === meta.id && v.kind === 'chart' && v.chart)
      .map((v) => ({
        id: v.id,
        title: v.chart!.title,
        types: v.chart!.chartTypes,
        series: v.chart!.series.length,
        anchor: `${columnLabel(v.anchor.fromColumn)}${v.anchor.fromRow + 1}`,
      })),
    tables: (meta.tables ?? []).map((t) => ({ name: t.name ?? null, range: areaLabel(t.range) })),
    pivots: (meta.pivotTables ?? []).map((p) => p.outputRef),
    conditionalFormats: result.conditionalRules?.length ?? 0,
    dataValidations: result.dataValidations?.length ?? 0,
    hyperlinks: result.hyperlinks?.length ?? 0,
    notes: meta.comments?.length ?? 0,
    hiddenColumns: (meta.columnWidths ?? [])
      .filter((w) => w.hidden)
      .reduce((n, w) => n + (w.endColumn - w.startColumn + 1), 0),
    hiddenSheet: meta.hidden === true,
  }
}

function cellFormat(style: CellStyle, base: CellStyle | undefined): CellFormat | undefined {
  const out: CellFormat = {}
  if (style.bold) out.bold = true
  if (style.italic) out.italic = true
  if (style.underline) out.underline = true
  if (style.strikethrough) out.strikethrough = true
  if (style.wrapText) out.wrapText = true
  if (style.fontFamily && style.fontFamily !== base?.fontFamily) out.fontFamily = style.fontFamily
  if (style.fontSize !== undefined && style.fontSize !== base?.fontSize)
    out.fontSize = style.fontSize
  if (style.fontColor) out.fontColor = style.fontColor
  if (style.fillColor) out.fillColor = style.fillColor
  if (style.horizontalAlignment) out.horizontalAlign = style.horizontalAlignment
  if (style.verticalAlignment) out.verticalAlign = style.verticalAlignment
  if (style.numberFormat && style.numberFormat !== 'General') out.numberFormat = style.numberFormat
  return Object.keys(out).length ? out : undefined
}

// ── csv ────────────────────────────────────────────────────────────────

/** The sidecar rejects a read_range above this many cells per request (lib.rs MAX_RANGE_CELLS). */
const RANGE_CELL_CAP = 100_000
/** Same ceiling as the app's Export as CSV (MAX_CSV_EXPORT_CHARS in apps/sheets/src/shared/ipc-channels.ts). */
const MAX_CSV_CHARS = 64_000_000

export interface SheetCsv {
  sheet: string
  sheets: number
  rows: number
  columns: number
  formulas: number
  csv: string
}

/**
 * One worksheet as CSV, cell text formatted the way the grid shows it (number
 * formats applied, formulas by their cached or freshly evaluated value); the
 * same shape the app's Export as CSV writes. Rows are produced band by band so
 * a wide, sparse used range never needs a dense grid of the whole sheet.
 */
export async function sheetToCsv(path: string, opts: { sheet?: string }): Promise<SheetCsv> {
  return withOpenWorkbook(path, async (client, wb) => {
    const meta = pickSheet(wb, opts.sheet) as SheetMeta
    const styles = wb.styles ?? []
    const date1904 = wb.date1904 === true
    const columnStyles = new Map<number, number>()
    for (const span of meta.columnWidths ?? []) {
      if (span.styleIndex === undefined) continue
      for (let c = span.startColumn; c <= span.endColumn && c < meta.columnCount; c++) {
        columnStyles.set(c, span.styleIndex)
      }
    }
    const lines: string[] = []
    let chars = 0
    let formulas = 0
    if (meta.rowCount > 0 && meta.columnCount > 0) {
      const whole = {
        startRow: 0,
        endRow: meta.rowCount - 1,
        startColumn: 0,
        endColumn: meta.columnCount - 1,
      }
      for (const band of recalcBands(whole, RANGE_CELL_CAP)) {
        const r = await readRangeIndexed(client, wb.sessionId, meta.id, band)
        const height = band.endRow - band.startRow + 1
        const grid: string[][] = Array.from({ length: height }, () =>
          Array<string>(meta.columnCount).fill(''),
        )
        // OOXML precedence: the cell's own xf, then the row default, then the column default
        const rowStyles = new Map((r.rows ?? []).map((row) => [row.row, row.styleIndex]))
        const pending: { row: number; column: number }[] = []
        for (const c of r.cells) {
          if (c.formula) formulas++
          if (c.value === undefined || c.value === null) {
            if (c.formula) pending.push({ row: c.row, column: c.column })
            continue
          }
          const styleIndex = c.styleIndex ?? rowStyles.get(c.row) ?? columnStyles.get(c.column)
          const format = styleIndex === undefined ? undefined : styles[styleIndex]?.numberFormat
          grid[c.row - band.startRow]![c.column] = displayText(c.value, format, date1904)
        }
        if (pending.length) {
          for (const cell of await recalcRange(client, path, meta.name, boundingBox(pending))) {
            const row = grid[cell.row - band.startRow]
            if (row && row[cell.column] === '') row[cell.column] = cell.formatted
          }
        }
        for (const row of grid) {
          const line = row.map(csvField).join(',') + '\r\n'
          chars += line.length
          if (chars > MAX_CSV_CHARS) {
            throw new CliError(EXIT.conversion, 'sheet is too large to export as CSV', {
              limit_chars: MAX_CSV_CHARS,
            })
          }
          lines.push(line)
        }
      }
    }
    return {
      sheet: meta.name,
      sheets: wb.sheets.length,
      rows: meta.rowCount,
      columns: meta.columnCount,
      formulas,
      csv: lines.join(''),
    }
  })
}

/** Grid text for one value; `format` is the cell's resolved number format. */
export function displayText(value: Scalar, format: string | undefined, date1904: boolean): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value === null) return ''
  const pattern = format || 'General'
  // 1904-system workbooks store calendar dates 1462 days lower; time-only and
  // elapsed patterns ([h]:mm) show the serial's magnitude and must not shift
  const serial = date1904 && isCalendarDatePattern(pattern) ? value + 1462 : value
  return numfmt.format(pattern, serial, { throws: false })
}

function isCalendarDatePattern(pattern: string): boolean {
  try {
    const type = (numfmt.getFormatInfo(pattern) as { type?: string }).type
    return type === 'date' || type === 'datetime'
  } catch {
    return false
  }
}

// same quoting as the app's csv-export.ts (RFC 4180: quote on comma, quote or newline)
function csvField(text: string): string {
  const normalized = text.replace(/\r\n|\r/g, '\n')
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized
}

// ── writing ────────────────────────────────────────────────────────────

export interface CellInput {
  sheet?: string
  cell: string
  value?: Scalar
  formula?: string
  style?: WorkbookStyleEdit
}

export interface TableInput {
  name: string
  rows: Scalar[][]
  /** `row:column` → number format for cells whose value was typed on import (ISO dates) */
  formats?: Record<string, string>
}

export interface CsvTableOptions {
  /** decimal separator used by the file; `,` also accepts `.` as a thousands separator */
  decimal?: '.' | ','
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/

/** Serial day number Excel stores for an ISO date or date-time; undefined for anything else. */
export function isoDateSerial(value: string): { serial: number; format: string } | undefined {
  const m = ISO_DATE.exec(value.trim())
  if (!m) return undefined
  const [y, mo, d, hh, mm, ss] = m
    .slice(1)
    .map((part) => (part === undefined ? undefined : Number(part)))
  const utc = Date.UTC(y!, mo! - 1, d!, hh ?? 0, mm ?? 0, ss ?? 0)
  const date = new Date(utc)
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo! - 1 || date.getUTCDate() !== d) {
    return undefined
  }
  if ((hh ?? 0) > 23 || (mm ?? 0) > 59 || (ss ?? 0) > 59) return undefined
  const serial = (utc - EXCEL_EPOCH_UTC) / 86_400_000
  const format =
    hh === undefined ? 'yyyy-mm-dd' : ss === undefined ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd hh:mm:ss'
  return { serial, format }
}

/** `1.234,5` → 1234.5 under a comma decimal; plain `1234,5` too. Leading zeros stay text as in isNumericCell. */
function commaDecimalNumber(value: string): number | undefined {
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(value)) return undefined
  const normalized = value.replace(/\./g, '').replace(',', '.')
  return isNumericCell(normalized) ? Number(normalized) : undefined
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

const STYLES_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
const STYLES_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'

/**
 * The blank workbook normally ships a stylesheet of its own; this tops one up for a
 * blank that does not, because the formula engine refuses to import such a package.
 * Every part is added only when missing — a second styles Override or Relationship
 * would duplicate a PartName and a Relationship Id, which makes Excel repair the file.
 */
export async function blankWorkbook(sheetName = 'Sheet1'): Promise<Buffer> {
  const zip = await JSZip.loadAsync(await blankXlsxBuffer(sheetName))
  if (!zip.file('xl/styles.xml')) zip.file('xl/styles.xml', STYLES_XML)
  const types = await zip.file('[Content_Types].xml')!.async('string')
  if (!types.includes('PartName="/xl/styles.xml"')) {
    zip.file(
      '[Content_Types].xml',
      types.replace(
        '</Types>',
        `<Override PartName="/xl/styles.xml" ContentType="${STYLES_CONTENT_TYPE}"/></Types>`,
      ),
    )
  }
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string')
  if (!rels.includes(`Type="${STYLES_REL_TYPE}"`)) {
    zip.file(
      'xl/_rels/workbook.xml.rels',
      rels.replace(
        '</Relationships>',
        `<Relationship Id="${nextFreeRelationshipId(rels)}" ` +
          `Type="${STYLES_REL_TYPE}" Target="styles.xml"/></Relationships>`,
      ),
    )
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

const PERCENT_STRING_RE = /^\s*([+-]?\d+(?:[.,]\d+)?)\s*%\s*$/
const PERCENT_HEADER_RE =
  /%|tỷ\s*lệ|tỉ\s*lệ|phần\s*trăm|tiến\s*độ|hoàn\s*thành|progress|weight|trọng\s*số/i
const PROGRESS_HEADER_RE = /tiến\s*độ|hoàn\s*thành|progress|%\s*đạt|tỷ\s*lệ\s*đạt/i
const CONFIDENCE_HEADER_RE =
  /\bconfidence\b|độ\s*tự\s*tin|độ\s*tin\s*cậy|điểm\s*tự\s*tin|mức\s*độ\s*tự\s*tin/i

function applyAutoPercentageColumnFormats(
  rows: Scalar[][],
  formats: Record<string, string>,
): void {
  if (rows.length < 2) return
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0)
  for (let c = 0; c < width; c += 1) {
    let headerRow = -1
    let headerText = ''
    for (let r = 0; r < Math.min(rows.length, 4); r += 1) {
      const h = rows[r]?.[c]
      if (
        typeof h === 'string' &&
        PERCENT_HEADER_RE.test(h) &&
        !CONFIDENCE_HEADER_RE.test(h)
      ) {
        headerRow = r
        headerText = h
        break
      }
    }
    if (headerRow < 0) continue
    const dataNums: number[] = []
    let hasFormula = false
    for (let r = headerRow + 1; r < rows.length; r += 1) {
      const val = rows[r]?.[c]
      if (typeof val === 'number' && Number.isFinite(val)) dataNums.push(val)
      else if (typeof val === 'string' && isFormulaCellInput(val)) hasFormula = true
    }
    const isRatioColumn =
      (dataNums.length > 0 &&
        dataNums.every((n) => n >= 0 && n <= 1) &&
        dataNums.some((n) => n > 0 && n < 1)) ||
      (hasFormula && dataNums.every((n) => n >= 0 && n <= 1))
    if (!isRatioColumn) continue
    const defaultPctFmt = PROGRESS_HEADER_RE.test(headerText) ? '0%' : '0.0%'
    for (let r = headerRow + 1; r < rows.length; r += 1) {
      const val = rows[r]?.[c]
      const key = `${r}:${c}`
      const isTargetCell =
        (typeof val === 'number' && val >= 0 && val <= 1) ||
        (typeof val === 'string' && isFormulaCellInput(val))
      if (isTargetCell && !formats[key]) {
        formats[key] = defaultPctFmt
      }
    }
  }
}

const isFormulaCellInput = (s: string): boolean => isRealExcelFormula(s)

/** CSV → table; numeric-looking cells become numbers like the app's importer. */
export function csvTable(bytes: Uint8Array, name: string, opts: CsvTableOptions = {}): TableInput {
  const formats: Record<string, string> = {}
  const rows = parseCsv(decodeCsvBuffer(bytes)).map((r, rowIndex) =>
    r.map((v, columnIndex) => {
      if (typeof v === 'string' && isFormulaCellInput(v)) {
        return sanitizeExcelFormula(v, toA1Address(rowIndex, columnIndex))
      }
      const pct = PERCENT_STRING_RE.exec(v)
      if (pct) {
        const parsed = Number(pct[1]!.replace(',', '.'))
        if (Number.isFinite(parsed)) {
          formats[`${rowIndex}:${columnIndex}`] = '0.0%'
          return parsed / 100
        }
      }
      if (opts.decimal === ',') {
        const n = commaDecimalNumber(v)
        if (n !== undefined) return n
      } else if (isNumericCell(v)) {
        return Number(v)
      } else if (/^-?\d+,\d+$/.test(v.trim())) {
        const n = Number(v.trim().replace(',', '.'))
        if (Number.isFinite(n)) return n
      }
      const date = isoDateSerial(v)
      if (!date) return v
      formats[`${rowIndex}:${columnIndex}`] = date.format
      return date.serial
    }),
  )
  applyAutoPercentageColumnFormats(rows, formats)
  return Object.keys(formats).length ? { name, rows, formats } : { name, rows }
}

/** JSON rows → table; ISO date strings become Excel date serials with date formatting like csvTable. */
export function jsonTable(name: string, rawRows: Scalar[][]): TableInput {
  const formats: Record<string, string> = {}
  const rows = rawRows.map((r, rowIndex) =>
    r.map((v, columnIndex) => {
      if (typeof v !== 'string') return v
      if (isFormulaCellInput(v)) {
        return sanitizeExcelFormula(v, toA1Address(rowIndex, columnIndex))
      }
      const pct = PERCENT_STRING_RE.exec(v)
      if (pct) {
        const parsed = Number(pct[1]!.replace(',', '.'))
        if (Number.isFinite(parsed)) {
          formats[`${rowIndex}:${columnIndex}`] = '0.0%'
          return parsed / 100
        }
      }
      if (/^-?\d+,\d+$/.test(v.trim())) {
        const n = Number(v.trim().replace(',', '.'))
        if (Number.isFinite(n)) return n
      }
      const date = isoDateSerial(v)
      if (!date) return v
      formats[`${rowIndex}:${columnIndex}`] = date.format
      return date.serial
    }),
  )
  applyAutoPercentageColumnFormats(rows, formats)
  return Object.keys(formats).length ? { name, rows, formats } : { name, rows }
}

export function cellEditsFromTable(
  sheet: string,
  rows: Scalar[][],
  formats: Record<string, string> = {},
): CellEdit[] {
  const edits: CellEdit[] = []
  rows.forEach((row, r) => {
    row.forEach((raw, c) => {
      if (raw === null || raw === undefined || raw === '') return
      const numberFormat = formats[`${r}:${c}`]
      edits.push(cellEdit(sheet, r, c, raw, numberFormat ? { numberFormat } : undefined))
    })
  })
  return edits
}

function cellEdit(
  sheet: string,
  row: number,
  column: number,
  raw: Scalar,
  style?: WorkbookStyleEdit,
): CellEdit {
  let effectiveRaw = raw
  let effectiveStyle = style
  if (typeof effectiveRaw === 'string') {
    const pct = PERCENT_STRING_RE.exec(effectiveRaw)
    if (pct) {
      const parsed = Number(pct[1]!.replace(',', '.'))
      if (Number.isFinite(parsed)) {
        effectiveRaw = parsed / 100
        if (!effectiveStyle?.numberFormat) {
          effectiveStyle = { ...effectiveStyle, numberFormat: '0.0%' }
        }
      }
    }
  }
  const formula =
    typeof effectiveRaw === 'string' && isFormulaCellInput(effectiveRaw)
      ? sanitizeExcelFormula(effectiveRaw, toA1Address(row, column))
      : undefined
  return {
    sheetName: sheet,
    row,
    column,
    writeValue: true,
    cell: formula ? { value: null, formula } : { value: effectiveRaw },
    ...(effectiveStyle ? { style: effectiveStyle } : {}),
  }
}

export function cellEditsFromInputs(inputs: CellInput[], defaultSheet: string): CellEdit[] {
  return inputs.map((input, i) => {
    if (typeof input.cell !== 'string') {
      throw new CliError(EXIT.usage, `cells[${i}]: missing "cell" address (e.g. "B2")`, undefined, {
        reason: 'invalid_argument',
      })
    }
    let coords: { row: number; column: number }
    try {
      coords = parseAddressChecked(input.cell)
    } catch {
      throw new CliError(EXIT.usage, `cells[${i}]: invalid address "${input.cell}"`, undefined, {
        reason: 'invalid_argument',
      })
    }
    const raw: Scalar =
      input.formula !== undefined
        ? sanitizeExcelFormula(input.formula, input.cell)
        : (input.value ?? null)
    const styleOnly = input.value === undefined && input.formula === undefined
    const edit = cellEdit(input.sheet ?? defaultSheet, coords.row, coords.column, raw, input.style)
    return styleOnly ? { ...edit, writeValue: false } : edit
  })
}

export interface ReadbackVerifiedValues {
  formula_results: Record<string, { formula: string; value: Scalar }>
  summary_rows: { sheet: string; row: number; values: Record<string, Scalar> }[]
  applied_features: {
    sheets: number
    cells_written: number
    formulas: number
    charts: number
    conditional_formats: number
    data_validations: number
    styled_cells: number
    column_formats?: Record<string, string>
    validation_ranges?: string[]
  }
}

export interface WriteOutcome {
  cells: number
  formulas: number
  /** false when formulas were written but the engine could not fill their cached values */
  cachedValues: boolean
  /** `Sheet!A1` of formulas left without a cached value on purpose */
  uncached?: string[]
  /** `Sheet!A1` of formulas the engine could not parse (a reference it cannot read) */
  unparsed?: string[]
  warning?: string
  /** formulas the engine could not parse — reported apart from `warning`, which is about missing functions */
  formulaError?: string
  /** side effects a program should know about that are not formula related */
  notes?: { code: string; message: string }[]
  /** Verified post-write readback values for mandatory AI citation (FX-01) */
  readbackVerifiedValues?: ReadbackVerifiedValues
}

function buildReadbackVerifiedValues(
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
  edits: readonly CellEdit[],
  gateway: GatewayPayloads,
  formulaCells: readonly CellEdit[],
): ReadbackVerifiedValues {
  const formulaResults: Record<string, { formula: string; value: Scalar }> = {}
  for (const [sheetName, cells] of snapshotBySheet) {
    for (const [addr, cell] of Object.entries(cells)) {
      if (cell.formula) {
        formulaResults[`${sheetName}!${addr}`] = {
          formula: cell.formula.startsWith('=') ? cell.formula : `=${cell.formula}`,
          value: cell.value ?? null,
        }
      }
    }
  }
  const summaryRows: { sheet: string; row: number; values: Record<string, Scalar> }[] = []
  const SUMMARY_LABEL_RE =
    /\b(tổng|total|cộng|sum|trung\s*bình|average|tb|chênh\s*lệch|tỷ\s*lệ|tỉ\s*lệ|grand\s*total|subtotal)\b/i
  for (const [sheetName, cells] of snapshotBySheet) {
    const byRow = new Map<number, Record<string, Scalar>>()
    for (const [addr, cell] of Object.entries(cells)) {
      if (cell.value === null || cell.value === undefined || cell.value === '') continue
      try {
        const { row } = parseAddress(addr)
        const rowMap = byRow.get(row + 1) ?? {}
        rowMap[addr] = cell.value
        byRow.set(row + 1, rowMap)
      } catch {
        // ignore
      }
    }
    for (const [rowNum, rowMap] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
      const hasSummaryLabel = Object.values(rowMap).some(
        (v) => typeof v === 'string' && SUMMARY_LABEL_RE.test(v),
      )
      const isLastRow = rowNum === Math.max(...byRow.keys()) && Object.keys(rowMap).length >= 2
      if (hasSummaryLabel || isLastRow) {
        summaryRows.push({ sheet: sheetName, row: rowNum, values: rowMap })
      }
    }
  }
  return {
    formula_results: formulaResults,
    summary_rows: summaryRows.slice(-20),
    applied_features: {
      sheets: Math.max(1, snapshotBySheet.size),
      cells_written: edits.length,
      formulas: Math.max(formulaCells.length, Object.keys(formulaResults).length),
      charts:
        gateway.visualAdditions.filter((v) => v.chart).length + gateway.chartEdits.length,
      conditional_formats: gateway.cfStates.reduce((n, s) => n + s.rules.length, 0),
      data_validations: gateway.dvStates.reduce((n, s) => n + s.rules.length, 0),
      styled_cells: edits.filter((e) => e.style && Object.keys(e.style).length > 0).length,
      column_formats: Object.fromEntries(
        edits
          .filter((e) => e.style?.numberFormat)
          .map((e) => [`${e.sheetName}!${columnLabel(e.column)}`, e.style!.numberFormat!]),
      ),
      validation_ranges: gateway.dvStates.flatMap((s) =>
        s.rules.flatMap((r) =>
          r.ranges.map(
            (rg) =>
              `${s.sheetName}!${toA1Address(rg.startRow, rg.startColumn)}:${toA1Address(rg.endRow, rg.endColumn)} (${r.rule.type}:${r.rule.formula1 ?? ''}..${r.rule.formula2 ?? ''})`,
          ),
        ),
      ),
    },
  }
}

/**
 * Enriches edits and gateway payloads when a sheet contains a `Confidence`
 * column (`FX-41`: Data Validation 1–10) or ratio/percentage columns (`FX-33` / `FX-41`: `0%` / `0.0%`).
 */
function enrichConfidenceAndPercentageColumns(
  edits: readonly CellEdit[],
  gateway: GatewayPayloads,
  existingSheets?: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): { edits: readonly CellEdit[]; gateway: GatewayPayloads } {
  const bySheet = new Map<string, CellEdit[]>()
  for (const e of edits) {
    bySheet.set(e.sheetName, [...(bySheet.get(e.sheetName) ?? []), e])
  }
  const extraEdits: CellEdit[] = [...edits]
  const editIndexByKey = new Map<string, number>()
  extraEdits.forEach((e, idx) => editIndexByKey.set(`${e.sheetName}|${e.row}|${e.column}`, idx))
  const extraDvStates = [...gateway.dvStates.map((s) => ({ ...s, rules: [...s.rules] }))]

  for (const [sheetName, sheetEdits] of bySheet) {
    const cellMap = new Map<string, CellEdit>()
    let maxRow = 0
    let maxCol = 0
    const existingCells = existingSheets?.get(sheetName)
    if (existingCells) {
      for (const [addr, cell] of Object.entries(existingCells)) {
        try {
          const coords = parseAddress(addr)
          cellMap.set(`${coords.row}:${coords.column}`, {
            sheetName,
            row: coords.row,
            column: coords.column,
            writeValue: false,
            cell: { value: cell.value, ...(cell.formula ? { formula: cell.formula } : {}) },
          })
          if (coords.row > maxRow) maxRow = coords.row
          if (coords.column > maxCol) maxCol = coords.column
        } catch {
          // ignore invalid address
        }
      }
    }
    for (const e of sheetEdits) {
      cellMap.set(`${e.row}:${e.column}`, e)
      if (e.row > maxRow) maxRow = e.row
      if (e.column > maxCol) maxCol = e.column
    }
    if (maxRow < 1) continue
    for (let c = 0; c <= maxCol; c += 1) {
      let headerRow = -1
      let headerText = ''
      for (let r = 0; r <= Math.min(maxRow, 4); r += 1) {
        const val = cellMap.get(`${r}:${c}`)?.cell.value
        if (
          typeof val === 'string' &&
          (PERCENT_HEADER_RE.test(val) || CONFIDENCE_HEADER_RE.test(val))
        ) {
          headerRow = r
          headerText = val
          break
        }
      }
      if (headerRow < 0) continue
      const isConfidenceCol = CONFIDENCE_HEADER_RE.test(headerText)
      const isPercentCol = !isConfidenceCol && PERCENT_HEADER_RE.test(headerText)

      const dataRows: { row: number; num: number }[] = []
      const formulaRows: number[] = []
      const populatedRows: number[] = []
      for (let r = headerRow + 1; r <= maxRow; r += 1) {
        const e = cellMap.get(`${r}:${c}`)
        if (!e) continue
        if (e.cell.formula) {
          formulaRows.push(r)
          populatedRows.push(r)
          continue
        }
        if (typeof e.cell.value === 'number' && Number.isFinite(e.cell.value)) {
          dataRows.push({ row: r, num: e.cell.value })
          populatedRows.push(r)
        } else if (e.cell.value !== null && e.cell.value !== undefined && e.cell.value !== '') {
          populatedRows.push(r)
        }
      }
      // 1. Auto 0% / 0.0% formatting for ratio & progress columns (including formula cells, FX-41)
      const isRatioOrFormula =
        isPercentCol &&
        ((dataRows.length > 0 &&
          dataRows.every((d) => d.num >= 0 && d.num <= 1) &&
          dataRows.some((d) => d.num > 0 && d.num < 1)) ||
          (formulaRows.length > 0 && dataRows.every((d) => d.num >= 0 && d.num <= 1)))
      if (isRatioOrFormula) {
        const defaultPctFmt = PROGRESS_HEADER_RE.test(headerText) ? '0%' : '0.0%'
        const targetRows = [...dataRows.map((d) => d.row), ...formulaRows]
        for (const row of targetRows) {
          const key = `${sheetName}|${row}|${c}`
          const idx = editIndexByKey.get(key)
          if (idx !== undefined) {
            const current = extraEdits[idx]!
            if (!current.style?.numberFormat) {
              extraEdits[idx] = {
                ...current,
                style: { ...current.style, numberFormat: defaultPctFmt },
              }
            }
          } else {
            const existingEdit = cellMap.get(`${row}:${c}`)
            if (existingEdit) {
              const newIdx = extraEdits.length
              extraEdits.push({
                ...existingEdit,
                writeValue: false,
                style: { numberFormat: defaultPctFmt },
              })
              editIndexByKey.set(key, newIdx)
            }
          }
        }
      }
      // 2. Auto Data Validation 1-10 for Confidence column (FX-41)
      if (isConfidenceCol && (populatedRows.length > 0 || maxRow > headerRow)) {
        const startRow = headerRow + 1
        const endRow =
          populatedRows.length > 0 ? Math.max(...populatedRows) : Math.max(startRow, maxRow)
        const bounds: Bounds = { startRow, endRow, startColumn: c, endColumn: c }
        let dvSheet = extraDvStates.find((s) => s.sheetName === sheetName)
        const alreadyHasDv = dvSheet?.rules.some((r) =>
          r.ranges.some((rg) => rg.startColumn <= c && rg.endColumn >= c),
        )
        if (!alreadyHasDv) {
          const rule = {
            ranges: [bounds],
            rule: {
              allowBlank: true,
              showErrorMessage: true,
              type: 'whole' as const,
              operator: 'between' as const,
              formula1: '1',
              formula2: '10',
            },
          }
          if (dvSheet) {
            dvSheet.rules.push(rule)
          } else {
            dvSheet = { sheetName, rules: [rule], append: true, remove: [] }
            extraDvStates.push(dvSheet)
          }
        }
      }
    }
  }
  return {
    edits: extraEdits,
    gateway: { ...gateway, dvStates: extraDvStates },
  }
}

/**
 * Writes the edits, then evaluates the formulas on the written file and
 * re-applies the same edits with the results as cached values, so readers
 * that trust <v> (openpyxl, pandas, quick previews) see numbers too. The
 * file is complete after the first write; the cached-value pass is best
 * effort and never turns a finished write into a failure.
 */
export async function writeWorkbook(
  source: Buffer,
  edits: readonly CellEdit[],
  outputPath: string,
  opts: {
    plan?: SheetEditPlan
    structuralOps?: readonly SheetStructuralOps[]
    /** original → new sheet names applied by `plan`; the written file carries the new ones */
    renames?: Record<string, string>
    /** the declarative save payloads of the DSL ops the in-memory workbook cannot hold */
    gateway?: GatewayPayloads
  } = {},
): Promise<WriteOutcome> {
  const { plan, structuralOps = [], renames = {} } = opts
  let existingSheets: Map<string, Record<string, { value: Scalar; formula?: string }>> | undefined
  if (source.length > 0 && edits.length > 0) {
    try {
      const parsedSource = await readBasicWorkbook(source)
      existingSheets = new Map(parsedSource.snapshot.sheets.map((s) => [s.name, s.cells]))
    } catch {
      existingSheets = undefined
    }
  }
  const enriched = enrichConfidenceAndPercentageColumns(
    edits,
    opts.gateway ?? EMPTY_PAYLOADS,
    existingSheets,
  )
  edits = enriched.edits
  const gateway = enriched.gateway
  const notes: { code: string; message: string }[] = []
  if (edits.some((e) => e.style && styleHasThemeColor(e.style)) && !(await hasThemePart(source))) {
    // without xl/theme/theme1.xml Excel has no palette to resolve a slot against
    edits = edits.map((e) => (e.style ? { ...e, style: flattenThemeColors(e.style) } : e))
    notes.push({
      code: 'theme_colors_flattened',
      message:
        'the workbook has no theme part, so theme colors were written as their Office-theme rgb values',
    })
  }
  const save = async (formulaValues: readonly SheetFormulaValues[]): Promise<XlsxMutation> => {
    const mutation = await planCellEditsToXlsx(
      await createBufferEntrySource(source),
      edits,
      structuralOps,
      gateway.chartEdits,
      plan,
      gateway.filterStates,
      gateway.hyperlinkEdits,
      gateway.cfStates,
      gateway.dvStates,
      gateway.sheetProtections,
      gateway.definedNamesState,
      gateway.visualAdditions,
      gateway.pageSetupStates,
      gateway.noteStates,
      gateway.tableAdditions,
      gateway.pivotAdditions,
      [],
      [],
      [],
      gateway.sparklineAdditions,
      formulaValues,
    )
    return assembleWithJsZip(source, mutation)
  }
  let first: XlsxMutation
  try {
    first = await save([])
  } catch (err) {
    // the gateway fails closed with a sentence about the file (x14 rules, name clashes, table overlaps)
    throw new CliError(
      EXIT.usage,
      `ops rejected by the workbook writer: ${(err as Error).message}`,
      undefined,
      { reason: 'op_rejected' },
    )
  }
  await atomicWriteFile(outputPath, first.buffer)
  const writtenFormulaCells = edits.filter((e) => e.cell.formula)
  const base = {
    cells: edits.length,
    formulas: writtenFormulaCells.length,
    ...(notes.length ? { notes } : {}),
  }
  const writtenKeys = new Set(
    writtenFormulaCells.map((c) => `${c.sheetName} ${c.row} ${c.column}`),
  )
  const allFormulaCells: CellEdit[] = [...writtenFormulaCells]
  let snapshotBySheet = new Map<string, Record<string, { value: Scalar; formula?: string }>>()
  if (edits.length > 0 || structuralOps.length > 0 || writtenFormulaCells.length > 0) {
    try {
      const parsed = await readBasicWorkbook(first.buffer)
      const originalName = (written: string) =>
        Object.entries(renames).find(([, after]) => after === written)?.[0] ?? written
      for (const sheet of parsed.snapshot.sheets) {
        snapshotBySheet.set(sheet.name, sheet.cells)
        const origSheet = originalName(sheet.name)
        for (const [addr, cell] of Object.entries(sheet.cells)) {
          if (!cell.formula) continue
          const coords = parseAddress(addr)
          const key = `${origSheet} ${coords.row} ${coords.column}`
          if (!writtenKeys.has(key)) {
            allFormulaCells.push({
              sheetName: origSheet,
              row: coords.row,
              column: coords.column,
              writeValue: true,
              cell: { value: cell.value, formula: cell.formula },
            })
          }
        }
      }
    } catch {
      snapshotBySheet = new Map()
    }
  }
  const withReadback = (outcome: WriteOutcome): WriteOutcome => ({
    ...outcome,
    readbackVerifiedValues: buildReadbackVerifiedValues(
      snapshotBySheet,
      edits,
      gateway,
      allFormulaCells,
    ),
  })
  if (allFormulaCells.length === 0) return withReadback({ ...base, cachedValues: true })
  if (!xlsxSidecarPath()) {
    // Evaluate formulas via JS fallback when sidecar is unavailable so cachedValues still populate
    const fallbackValues = evaluateFormulasFallbackOnly(allFormulaCells, renames, snapshotBySheet)
    if (fallbackValues.length > 0) {
      const second = await save(fallbackValues)
      await atomicWriteFile(outputPath, second.buffer)
      return withReadback({ ...base, cachedValues: true })
    }
    if (writtenFormulaCells.length === 0) return withReadback({ ...base, cachedValues: true })
    return withReadback({
      ...base,
      cachedValues: false,
      warning: 'xlsx engine not found; formulas recalculate on open',
    })
  }
  try {
    const { values, uncached, unparsed } = await evaluateFormulas(
      outputPath,
      allFormulaCells,
      renames,
      writtenKeys,
      snapshotBySheet,
    )
    if (values.length) {
      const second = await save(values)
      await atomicWriteFile(outputPath, second.buffer)
      if (writtenFormulaCells.length === 0 || (uncached.length === 0 && unparsed.length === 0)) {
        return withReadback({ ...base, cachedValues: true })
      }
      const skipped = uncached.length + unparsed.length
      return withReadback({
        ...base,
        cachedValues: skipped < writtenFormulaCells.length,
        ...(uncached.length ? { uncached } : {}),
        ...(unparsed.length ? { unparsed } : {}),
        ...(uncached.length
          ? {
              warning: `${uncached.length} formula(s) use functions the local engine does not evaluate (${list(uncached)}); they have no cached value and recalculate on open`,
            }
          : {}),
        ...(unparsed.length
          ? {
              formulaError: `${unparsed.length} formula(s) the local engine could not parse (${list(unparsed)}); check their references — they have no cached value and recalculate on open`,
            }
          : {}),
      })
    }
    if (writtenFormulaCells.length === 0) return withReadback({ ...base, cachedValues: true })
    return withReadback({
      ...base,
      cachedValues: false,
      warning:
        'the engine returned no results for the written formulas; the file recalculates on open',
    })
  } catch (err) {
    const fallbackValues = evaluateFormulasFallbackOnly(allFormulaCells, renames, snapshotBySheet)
    if (fallbackValues.length > 0) {
      const second = await save(fallbackValues)
      await atomicWriteFile(outputPath, second.buffer)
      return withReadback({ ...base, cachedValues: true })
    }
    if (writtenFormulaCells.length === 0) return withReadback({ ...base, cachedValues: true })
    const message = err instanceof Error ? err.message : String(err)
    return withReadback({
      ...base,
      cachedValues: false,
      warning: `formula results not cached (${message}); the file is complete and recalculates on open`,
    })
  }
}

function evaluateFormulasFallbackOnly(
  formulaCells: readonly CellEdit[],
  renames: Record<string, string>,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): SheetFormulaValues[] {
  const bySheet = new Map<string, CellEdit[]>()
  for (const e of formulaCells) bySheet.set(e.sheetName, [...(bySheet.get(e.sheetName) ?? []), e])
  const out: SheetFormulaValues[] = []
  for (const [sheet, cells] of bySheet) {
    const writtenSheet = renames[sheet] ?? sheet
    const sheetCells = snapshotBySheet.get(writtenSheet)
    const sorted = [...cells].sort((a, b) => a.row - b.row || a.column - b.column)
    const evaluatedCells: { row: number; column: number; value: Scalar }[] = []
    for (const c of sorted) {
      const val = tryEvaluateFallbackFormula(
        c.cell.formula ?? '',
        writtenSheet,
        snapshotBySheet,
        UNPARSED_RESULT,
      )
      if (val !== undefined) {
        if (sheetCells) {
          const addr = toA1Address(c.row, c.column)
          sheetCells[addr] = { ...sheetCells[addr], value: val }
        }
        evaluatedCells.push({ row: c.row, column: c.column, value: val })
      }
    }
    if (evaluatedCells.length > 0) {
      out.push({ sheetName: sheet, cells: evaluatedCells })
    }
  }
  return out
}

/**
 * `#NAME?` from the local engine means "a function it does not implement" at
 * least as often as a typo, and `#ERROR!` is the engine's own failure, not an
 * Excel error: neither result is cached. The cell keeps its formula and no
 * <v>, and Excel computes it on open (fullCalcOnLoad).
 */
/** The engine knows the syntax but not the function: Excel computes it on open. */
const UNKNOWN_FUNCTION_RESULT = '#NAME?'
/** The engine could not parse the formula at all — a reference it cannot read, not a missing function. */
const UNPARSED_RESULT = '#ERROR!'
const list = (cells: readonly string[]) =>
  cells.slice(0, 3).join(', ') + (cells.length > 3 ? ', …' : '')
async function evaluateFormulas(
  path: string,
  formulaCells: readonly CellEdit[],
  renames: Record<string, string>,
  writtenKeys: ReadonlySet<string>,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): Promise<{ values: SheetFormulaValues[]; uncached: string[]; unparsed: string[] }> {
  const bySheet = new Map<string, CellEdit[]>()
  for (const e of formulaCells) bySheet.set(e.sheetName, [...(bySheet.get(e.sheetName) ?? []), e])
  // edits carry the file's original sheet names; the written file has the renamed ones
  const formulaMap = new Map(
    formulaCells.map((c) => [`${c.sheetName} ${c.row} ${c.column}`, c.cell.formula ?? '']),
  )
  const originalName = (written: string) =>
    Object.entries(renames).find(([, after]) => after === written)?.[0] ?? written
  return withSidecar(async (client) => {
    const out: SheetFormulaValues[] = []
    const uncached: string[] = []
    const unparsed: string[] = []
    for (const [sheet, cells] of bySheet) {
      const writtenSheet = renames[sheet] ?? sheet
      const evaluated = await recalcRange(client, path, writtenSheet, boundingBox(cells))
      const sheetCells = snapshotBySheet.get(writtenSheet)
      if (sheetCells) {
        for (const cell of evaluated) {
          if (
            !cell.isError &&
            cell.formatted !== UNKNOWN_FUNCTION_RESULT &&
            cell.formatted !== UNPARSED_RESULT
          ) {
            const addr = toA1Address(cell.row, cell.column)
            const val = (cell.number ?? (cell.formatted === '' ? null : cell.formatted)) as Scalar
            sheetCells[addr] = { ...sheetCells[addr], value: val }
          }
        }
      }
      const matched = evaluated
        .filter((cell) => formulaMap.has(`${originalName(cell.sheet)} ${cell.row} ${cell.column}`))
        .sort((a, b) => a.row - b.row || a.column - b.column)
      const values = matched.map((cell) => {
        const cellKey = `${originalName(cell.sheet)} ${cell.row} ${cell.column}`
        const isWritten = writtenKeys.has(cellKey)
        const rawFormula = formulaMap.get(cellKey) ?? ''
        const fallbackVal = tryEvaluateFallbackFormula(
          rawFormula,
          writtenSheet,
          snapshotBySheet,
          cell.isError ? UNPARSED_RESULT : cell.formatted,
        )
        if (fallbackVal !== undefined) {
          if (sheetCells) {
            const addr = toA1Address(cell.row, cell.column)
            sheetCells[addr] = { ...sheetCells[addr], value: fallbackVal }
          }
          return { row: cell.row, column: cell.column, value: fallbackVal }
        }
        // Both leave the cell without a cached value — the file is correct
        // and Excel recomputes on open — but they have different causes and
        // the caller reports them apart.
        if (cell.formatted === UNKNOWN_FUNCTION_RESULT) {
          if (isWritten) uncached.push(`${sheet}!${toA1Address(cell.row, cell.column)}`)
          return { row: cell.row, column: cell.column, value: null }
        }
        if (cell.formatted === UNPARSED_RESULT) {
          if (isWritten) unparsed.push(`${sheet}!${toA1Address(cell.row, cell.column)}`)
          return { row: cell.row, column: cell.column, value: null }
        }
        if (cell.isError) {
          return { row: cell.row, column: cell.column, value: { error: cell.formatted } }
        }
        return {
          row: cell.row,
          column: cell.column,
          value: (cell.number ?? (cell.formatted === '' ? null : cell.formatted)) as Scalar,
        }
      })
      // the refresh is keyed like the edits, by the file's original sheet name
      if (values.length) out.push({ sheetName: sheet, cells: values })
    }
    return { values: out, uncached, unparsed }
  })
}

function splitFormulaArgs(inner: string): string[] {
  const args: string[] = []
  let depth = 0
  let inQuotes = false
  let start = 0
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]
    if (ch === '"') {
      if (inQuotes && inner[i + 1] === '"') {
        i += 1
        continue
      }
      inQuotes = !inQuotes
    } else if (!inQuotes) {
      if (ch === '(') depth += 1
      else if (ch === ')') depth = Math.max(0, depth - 1)
      else if ((ch === ',' || ch === ';') && depth === 0) {
        args.push(inner.slice(start, i).trim())
        start = i + 1
      }
    }
  }
  const tail = inner.slice(start).trim()
  if (tail.length > 0) args.push(tail)
  return args
}

function resolveSheetAndRef(
  expr: string,
  defaultSheet: string,
): { sheet: string; ref: string } {
  const trimmed = expr.trim()
  const bang = trimmed.indexOf('!')
  if (bang < 0) return { sheet: defaultSheet, ref: trimmed.replace(/\$/g, '') }
  const rawSheet = trimmed.slice(0, bang).trim().replace(/^'|'$/g, '').replace(/''/g, "'")
  return { sheet: rawSheet, ref: trimmed.slice(bang + 1).trim().replace(/\$/g, '') }
}

function toNumberOrDate(v: Scalar): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const pct = PERCENT_STRING_RE.exec(v)
    if (pct) {
      const n = Number(pct[1]!.replace(',', '.'))
      if (Number.isFinite(n)) return n / 100
    }
    const d = isoDateSerial(v)
    if (d) return d.serial
    const trimmed = v.trim()
    if (isNumericCell(trimmed)) return Number(trimmed)
    if (/^-?\d+,\d+$/.test(trimmed)) {
      const n = Number(trimmed.replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function evalBasicAggregateOrMath(
  clean: string,
  currentSheet: string,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): Scalar | undefined {
  const fnMatch = /^(SUM|AVERAGE|MIN|MAX|COUNT|COUNTA|ROUND|IFERROR)\s*\(([\s\S]*)\)$/i.exec(clean)
  if (fnMatch) {
    const fn = fnMatch[1]!.toUpperCase()
    const args = splitFormulaArgs(fnMatch[2]!)
    if (fn === 'ROUND' && args.length === 2) {
      const val = evalBasicAggregateOrMath(args[0]!, currentSheet, snapshotBySheet)
      const digits = Number(args[1]!)
      if (typeof val === 'number' && Number.isFinite(val) && Number.isFinite(digits)) {
        const factor = 10 ** digits
        return Math.round(val * factor) / factor
      }
      return undefined
    }
    if (fn === 'IFERROR' && args.length === 2) {
      const val = evalBasicAggregateOrMath(args[0]!, currentSheet, snapshotBySheet)
      if (val !== undefined && val !== null) return val
      return parseCriteriaValue(args[1]!, currentSheet, snapshotBySheet)
    }
    const nums: number[] = []
    let nonEmpty = 0
    for (const arg of args) {
      if (arg.includes(':')) {
        const vals = readRangeValues(arg, currentSheet, snapshotBySheet)
        if (!vals) continue
        for (const v of vals) {
          if (v !== null && v !== undefined && v !== '') nonEmpty += 1
          const n = toNumberOrDate(v)
          if (n !== null) nums.push(n)
        }
      } else {
        const { sheet, ref } = resolveSheetAndRef(arg, currentSheet)
        if (/^[A-Z]{1,3}\d+$/i.test(ref)) {
          const cellVal = snapshotBySheet.get(sheet)?.[ref.toUpperCase()]?.value ?? null
          if (cellVal !== null && cellVal !== undefined && cellVal !== '') nonEmpty += 1
          const n = toNumberOrDate(cellVal)
          if (n !== null) nums.push(n)
        } else {
          const n = toNumberOrDate(arg)
          if (n !== null) {
            nums.push(n)
            nonEmpty += 1
          }
        }
      }
    }
    if (fn === 'COUNT') return nums.length
    if (fn === 'COUNTA') return nonEmpty
    if (fn === 'SUM') return nums.reduce((a, b) => a + b, 0)
    if (nums.length === 0) return 0
    if (fn === 'AVERAGE') return nums.reduce((a, b) => a + b, 0) / nums.length
    if (fn === 'MIN') return Math.min(...nums)
    if (fn === 'MAX') return Math.max(...nums)
  }
  // Basic arithmetic expression over cell refs (e.g. B2*C2*D2/E2)
  if (!/[A-Za-z]{4,}/.test(clean) && /[+\-*/]/.test(clean)) {
    const replaced = clean.replace(
      /(?:'((?:[^']|'')+)'!|([A-Za-z0-9_]+)!)?\$?([A-Z]{1,3})\$?(\d+)/g,
      (_m, qSheet: string | undefined, bSheet: string | undefined, col: string, row: string) => {
        const targetSheet = qSheet ? qSheet.replace(/''/g, "'") : bSheet || currentSheet
        const addr = `${col.toUpperCase()}${row}`
        const cellVal = snapshotBySheet.get(targetSheet)?.[addr]?.value ?? null
        const n = toNumberOrDate(cellVal)
        return n !== null ? String(n) : '0'
      },
    )
    if (/^[0-9+\-*/().\s]+$/.test(replaced)) {
      try {
        const res = Function(`"use strict"; return (${replaced});`)() as unknown
        if (typeof res === 'number' && Number.isFinite(res)) return res
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

function tryEvaluateFallbackFormula(
  formula: string,
  currentSheet: string,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
  sidecarFormatted: string,
): Scalar | undefined {
  const clean = formula.trim().replace(/^=/, '').trim()
  const m = /^(SUMPRODUCT|SUMIFS|COUNTIFS|AVERAGEIFS)\s*\(([\s\S]*)\)$/i.exec(clean)
  if (m) {
    const fn = m[1]!.toUpperCase()
    const args = splitFormulaArgs(m[2]!)
    try {
      if (fn === 'SUMPRODUCT') {
        return evalSumproduct(args, currentSheet, snapshotBySheet)
      }
      return evalIfs(
        fn as 'SUMIFS' | 'COUNTIFS' | 'AVERAGEIFS',
        args,
        currentSheet,
        snapshotBySheet,
        sidecarFormatted,
      )
    } catch {
      return undefined
    }
  }
  if (
    sidecarFormatted === UNKNOWN_FUNCTION_RESULT ||
    sidecarFormatted === UNPARSED_RESULT ||
    sidecarFormatted.startsWith('#')
  ) {
    return evalBasicAggregateOrMath(clean, currentSheet, snapshotBySheet)
  }
  return undefined
}

function readRangeValues(
  expr: string,
  currentSheet: string,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): Scalar[] | null {
  const { sheet, ref } = resolveSheetAndRef(expr, currentSheet)
  const cells = snapshotBySheet.get(sheet)
  if (!cells) return null
  const bounds = parseRange(ref)
  const out: Scalar[] = []
  for (let r = bounds.startRow; r <= bounds.endRow; r += 1) {
    for (let c = bounds.startColumn; c <= bounds.endColumn; c += 1) {
      out.push(cells[toA1Address(r, c)]?.value ?? null)
    }
  }
  return out
}

function evalSumproductTerm(
  expr: string,
  currentSheet: string,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): number[] | null {
  let s = expr.trim()
  let negate = 1
  while (s.startsWith('-')) {
    negate *= -1
    s = s.slice(1).trim()
  }
  if (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0
    let wrapped = true
    let inQuotes = false
    for (let i = 0; i < s.length - 1; i += 1) {
      if (s[i] === '"') inQuotes = !inQuotes
      else if (!inQuotes) {
        if (s[i] === '(') depth += 1
        else if (s[i] === ')') {
          depth -= 1
          if (depth === 0) {
            wrapped = false
            break
          }
        }
      }
    }
    if (wrapped) {
      const inner = evalSumproductExpr(s.slice(1, -1), currentSheet, snapshotBySheet)
      return inner ? inner.map((v) => v * negate) : null
    }
  }
  // Check comparison inside term: Range=Val, Range>=Val, etc.
  const cmpMatch = /^([^<>=!]+)(<=|>=|<>|<|>|=)([\s\S]+)$/.exec(s)
  if (cmpMatch) {
    const leftVals = readRangeValues(cmpMatch[1]!, currentSheet, snapshotBySheet)
    if (!leftVals) return null
    const op = cmpMatch[2]!
    const rhsRaw = cmpMatch[3]!.trim()
    const rhsScalar = parseCriteriaValue(rhsRaw, currentSheet, snapshotBySheet)
    return leftVals.map((v) => (compareExcelScalars(v, op, rhsScalar) ? 1 * negate : 0))
  }
  const rangeVals = readRangeValues(s, currentSheet, snapshotBySheet)
  if (!rangeVals) return null
  return rangeVals.map((v) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : isNumericCell(String(v ?? '').trim()) ? Number(String(v).trim()) : 0
    return n * negate
  })
}

function evalSumproductExpr(
  expr: string,
  currentSheet: string,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): number[] | null {
  // Split top-level * and +
  const factors: string[] = []
  let depth = 0
  let inQuotes = false
  let start = 0
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes) {
      if (ch === '(') depth += 1
      else if (ch === ')') depth = Math.max(0, depth - 1)
      else if (ch === '*' && depth === 0) {
        factors.push(expr.slice(start, i))
        start = i + 1
      }
    }
  }
  if (factors.length > 0) {
    factors.push(expr.slice(start))
    const arrays = factors.map((f) => evalSumproductTerm(f, currentSheet, snapshotBySheet))
    if (arrays.some((a) => !a)) return null
    const len = arrays[0]!.length
    if (arrays.some((a) => a!.length !== len)) return null
    return Array.from({ length: len }, (_, idx) =>
      arrays.reduce((acc, arr) => acc * arr![idx]!, 1),
    )
  }
  return evalSumproductTerm(expr, currentSheet, snapshotBySheet)
}

function evalSumproduct(
  args: string[],
  currentSheet: string,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): number | undefined {
  if (args.length === 0) return undefined
  const arrays = args.map((a) => evalSumproductExpr(a, currentSheet, snapshotBySheet))
  if (arrays.some((a) => !a)) return undefined
  const len = arrays[0]!.length
  if (len === 0 || arrays.some((a) => a!.length !== len)) return undefined
  let sum = 0
  for (let i = 0; i < len; i += 1) {
    let prod = 1
    for (const arr of arrays) prod *= arr![i]!
    sum += prod
  }
  return sum
}

function parseCriteriaValue(
  raw: string,
  currentSheet: string,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
): Scalar {
  const trimmed = raw.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"')
  }
  if (isNumericCell(trimmed)) return Number(trimmed)
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true'
  // Cell reference or string concatenation like ">="&F1
  if (trimmed.includes('&')) {
    const parts = trimmed.split('&').map((p) => String(parseCriteriaValue(p, currentSheet, snapshotBySheet) ?? ''))
    return parts.join('')
  }
  const { sheet, ref } = resolveSheetAndRef(trimmed, currentSheet)
  const cell = snapshotBySheet.get(sheet)?.[ref]
  return cell?.value ?? trimmed
}

function compareExcelScalars(cellVal: Scalar, op: string, target: Scalar): boolean {
  const targetNum = toNumberOrDate(target)
  const cellNum = toNumberOrDate(cellVal)
  if (targetNum !== null && cellNum !== null) {
    if (op === '=') return cellNum === targetNum
    if (op === '<>') return cellNum !== targetNum
    if (op === '<') return cellNum < targetNum
    if (op === '<=') return cellNum <= targetNum
    if (op === '>') return cellNum > targetNum
    if (op === '>=') return cellNum >= targetNum
  }
  const leftStr = String(cellVal ?? '').trim().toLowerCase()
  const rightStr = String(target ?? '').trim().toLowerCase()
  if (op === '=') return leftStr === rightStr
  if (op === '<>') return leftStr !== rightStr
  if (op === '<') return leftStr < rightStr
  if (op === '<=') return leftStr <= rightStr
  if (op === '>') return leftStr > rightStr
  if (op === '>=') return leftStr >= rightStr
  return false
}

function evalIfs(
  fn: 'SUMIFS' | 'COUNTIFS' | 'AVERAGEIFS',
  args: string[],
  currentSheet: string,
  snapshotBySheet: ReadonlyMap<string, Record<string, { value: Scalar; formula?: string }>>,
  sidecarFormatted: string,
): number | undefined {
  const hasTargetRange = fn === 'SUMIFS' || fn === 'AVERAGEIFS'
  const minArgs = hasTargetRange ? 3 : 2
  if (args.length < minArgs || (args.length - (hasTargetRange ? 1 : 0)) % 2 !== 0) {
    return undefined
  }
  const targetValues = hasTargetRange
    ? readRangeValues(args[0]!, currentSheet, snapshotBySheet)
    : null
  if (hasTargetRange && !targetValues) return undefined
  const pairsStart = hasTargetRange ? 1 : 0
  const pairs: { values: Scalar[]; op: string; target: Scalar }[] = []
  let hasIsoDateCriteriaOrCell = false
  for (let i = pairsStart; i < args.length; i += 2) {
    const critVals = readRangeValues(args[i]!, currentSheet, snapshotBySheet)
    if (!critVals) return undefined
    if (critVals.some((v) => typeof v === 'string' && isoDateSerial(v) !== undefined)) {
      hasIsoDateCriteriaOrCell = true
    }
    const rawCrit = String(parseCriteriaValue(args[i + 1]!, currentSheet, snapshotBySheet) ?? '')
    const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(rawCrit)
    const op = m?.[1] || '='
    const rhsText = (m?.[2] ?? '').trim()
    if (isoDateSerial(rhsText) !== undefined) {
      hasIsoDateCriteriaOrCell = true
    }
    const target: Scalar =
      isoDateSerial(rhsText)?.serial ?? (isNumericCell(rhsText) ? Number(rhsText) : rhsText)
    pairs.push({ values: critVals, op, target })
  }
  // Only override the sidecar when ISO dates are involved or the sidecar failed
  if (!hasIsoDateCriteriaOrCell && sidecarFormatted !== UNKNOWN_FUNCTION_RESULT && sidecarFormatted !== UNPARSED_RESULT) {
    return undefined
  }
  const len = pairs[0]!.values.length
  if ( (targetValues && targetValues.length !== len) || pairs.some((p) => p.values.length !== len)) {
    return undefined
  }
  let sum = 0
  let count = 0
  for (let idx = 0; idx < len; idx += 1) {
    const matches = pairs.every((p) => compareExcelScalars(p.values[idx] ?? null, p.op, p.target))
    if (!matches) continue
    if (fn === 'COUNTIFS') {
      count += 1
    } else {
      const v = targetValues![idx] ?? null
      const num = typeof v === 'number' && Number.isFinite(v) ? v : isNumericCell(String(v ?? '').trim()) ? Number(String(v).trim()) : null
      if (num !== null) {
        sum += num
        count += 1
      }
    }
  }
  if (fn === 'COUNTIFS') return count
  if (fn === 'AVERAGEIFS') return count > 0 ? sum / count : undefined
  return sum
}

interface Bounds {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

function boundingBox(cells: readonly { row: number; column: number }[]): Bounds {
  // a loop, not Math.min(...spread): a large uncached window would overflow the call stack
  const box = { startRow: Infinity, endRow: -Infinity, startColumn: Infinity, endColumn: -Infinity }
  for (const c of cells) {
    if (c.row < box.startRow) box.startRow = c.row
    if (c.row > box.endRow) box.endRow = c.row
    if (c.column < box.startColumn) box.startColumn = c.column
    if (c.column > box.endColumn) box.endColumn = c.column
  }
  return box
}

/** The sidecar rejects a recalc read above this many cells per request (recalc.rs MAX_RECALC_READ_CELLS). */
export const RECALC_CELL_CAP = 20_000

/** Splits a rectangle into row (and, for very wide ranges, column) bands that each fit the cap. */
export function recalcBands(bounds: Bounds, cap = RECALC_CELL_CAP): Bounds[] {
  const width = bounds.endColumn - bounds.startColumn + 1
  const bands: Bounds[] = []
  const colStep = Math.min(width, cap)
  for (let c0 = bounds.startColumn; c0 <= bounds.endColumn; c0 += colStep) {
    const c1 = Math.min(bounds.endColumn, c0 + colStep - 1)
    const rowStep = Math.max(1, Math.floor(cap / (c1 - c0 + 1)))
    for (let r0 = bounds.startRow; r0 <= bounds.endRow; r0 += rowStep) {
      bands.push({
        startRow: r0,
        endRow: Math.min(bounds.endRow, r0 + rowStep - 1),
        startColumn: c0,
        endColumn: c1,
      })
    }
  }
  return bands
}

async function recalcRange(
  client: XlsxSidecarClient,
  path: string,
  sheet: string,
  bounds: Bounds,
): Promise<RecalcResult['cells']> {
  const cells: RecalcResult['cells'] = []
  // one band per request: the recalc worker is single-flight
  for (const range of recalcBands(bounds)) {
    const r = (await client.recalcCells({
      path,
      edits: [],
      reads: [{ sheet, range }],
    })) as RecalcResult
    cells.push(...r.cells)
  }
  return cells
}

/** What the workbook engine computes for a range of the file on disk, keyed `row|column` (0-based). */
export async function computedValues(
  path: string,
  sheet: string,
  bounds: Bounds,
): Promise<Map<string, { value: Scalar; isError: boolean }>> {
  const out = new Map<string, { value: Scalar; isError: boolean }>()
  await withSidecar(async (client) => {
    for (const cell of await recalcRange(client, path, sheet, bounds)) {
      out.set(`${cell.row}|${cell.column}`, {
        value: cell.number ?? (cell.formatted === '' ? null : cell.formatted),
        isError: cell.isError === true,
      })
    }
  })
  return out
}

/** Multi-sheet plan for a fresh workbook whose blank already carries `first`. */
export function additionPlan(first: string, others: readonly string[]): SheetEditPlan | undefined {
  if (others.length === 0) return undefined
  return {
    renames: [],
    additions: others.map((name) => ({ name })),
    removals: [],
    order: [first, ...others],
  }
}
