/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import * as CFB from 'cfb'
import { xlsxToText } from './xlsx'
import type { ParseFileOptions } from './parse'

const RECORD_BOF = 0x0809
const RECORD_EOF = 0x000a
const RECORD_FILEPASS = 0x002f
const RECORD_CONTINUE = 0x003c
const RECORD_BOUNDSHEET = 0x0085
const RECORD_SST = 0x00fc
const RECORD_LABELSST = 0x00fd
const RECORD_LABEL = 0x0204
const RECORD_RSTRING = 0x00d6
const RECORD_NUMBER = 0x0203
const RECORD_RK = 0x027e
const RECORD_MULRK = 0x00bd
const RECORD_FORMULA = 0x0006
const RECORD_STRING = 0x0207
const RECORD_BOOLERR = 0x0205

interface BiffRecord {
  id: number
  data: Buffer
  offset: number
}

function parseBiffRecords(stream: Buffer): BiffRecord[] {
  const records: BiffRecord[] = []
  let pos = 0
  while (pos + 4 <= stream.length) {
    const id = stream.readUInt16LE(pos)
    const len = stream.readUInt16LE(pos + 2)
    const start = pos + 4
    const end = Math.min(stream.length, start + len)
    records.push({
      id,
      data: stream.subarray(start, end),
      offset: pos,
    })
    pos = end
    if (len === 0 && id === 0 && pos < stream.length) {
      // Avoid infinite loop on zero-padded trailing sectors
      let allZero = true
      for (let i = pos; i < Math.min(stream.length, pos + 16); i++) {
        if (stream[i] !== 0) {
          allZero = false
          break
        }
      }
      if (allZero) break
    }
  }
  return records
}

/** Decode a BIFF8 RK 32-bit encoded number into an IEEE 754 float/int. */
function decodeRkNumber(rk: number): number {
  const isMul100 = (rk & 0x01) !== 0
  const isInt = (rk & 0x02) !== 0
  let value: number
  if (isInt) {
    value = rk >> 2
  } else {
    const buf = Buffer.alloc(8)
    buf.writeInt32LE(0, 0)
    buf.writeInt32LE(rk & ~3, 4)
    value = buf.readDoubleLE(0)
  }
  return isMul100 ? value / 100 : value
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (Number.isInteger(n)) return String(n)
  // Avoid floating-point noise like 12.300000000000001
  return String(Number(n.toPrecision(15)))
}

/** Read a short BIFF8 Unicode string (1-byte char count) used in BOUNDSHEET. */
function readShortUnicodeString(buf: Buffer, offset: number): string {
  if (offset + 2 > buf.length) return ''
  const cch = buf.readUInt8(offset)
  const flags = buf.readUInt8(offset + 1)
  const isUtf16 = (flags & 0x01) !== 0
  const start = offset + 2
  if (isUtf16) {
    const byteLen = Math.min(buf.length - start, cch * 2)
    return buf.subarray(start, start + byteLen).toString('utf16le')
  }
  const byteLen = Math.min(buf.length - start, cch)
  return buf.subarray(start, start + byteLen).toString('latin1')
}

/** Read a 16-bit-length BIFF8 Unicode string within a single record (LABEL, STRING, RSTRING). */
function readSingleRecordUnicodeString(buf: Buffer, offset: number): string {
  if (offset + 3 > buf.length) return ''
  const cch = buf.readUInt16LE(offset)
  const flags = buf.readUInt8(offset + 2)
  let pos = offset + 3
  const isUtf16 = (flags & 0x01) !== 0
  const hasExt = (flags & 0x04) !== 0
  const hasRich = (flags & 0x08) !== 0
  if (hasRich) {
    if (pos + 2 > buf.length) return ''
    pos += 2
  }
  if (hasExt) {
    if (pos + 4 > buf.length) return ''
    pos += 4
  }
  if (isUtf16) {
    const byteLen = Math.min(buf.length - pos, cch * 2)
    return buf.subarray(pos, pos + byteLen).toString('utf16le')
  }
  const byteLen = Math.min(buf.length - pos, cch)
  return buf.subarray(pos, pos + byteLen).toString('latin1')
}

/**
 * Parse the BIFF8 Shared String Table (SST + CONTINUE records).
 * Handles strings that span across CONTINUE boundaries where the first byte of
 * the CONTINUE payload is a new compression flag (0 = Latin1, 1 = UTF-16LE).
 */
function parseSst(sstData: Buffer, continues: Buffer[]): string[] {
  const chunks = [sstData, ...continues]
  if (sstData.length < 8) return []
  const uniqueCount = sstData.readUInt32LE(4)
  const result: string[] = []

  let chunkIdx = 0
  let pos = 8

  const advanceChunk = (): boolean => {
    chunkIdx += 1
    pos = 0
    return chunkIdx < chunks.length
  }

  const ensureBytes = (n: number): boolean => {
    while (chunkIdx < chunks.length && chunks[chunkIdx]!.length - pos < n) {
      if (chunks[chunkIdx]!.length - pos === 0) {
        if (!advanceChunk()) return false
      } else {
        return true
      }
    }
    return chunkIdx < chunks.length
  }

  const readU8 = (): number => {
    if (!ensureBytes(1)) return 0
    const v = chunks[chunkIdx]!.readUInt8(pos)
    pos += 1
    return v
  }

  const readU16 = (): number => {
    if (!ensureBytes(1)) return 0
    const rem = chunks[chunkIdx]!.length - pos
    if (rem >= 2) {
      const v = chunks[chunkIdx]!.readUInt16LE(pos)
      pos += 2
      return v
    }
    const b0 = readU8()
    const b1 = readU8()
    return b0 | (b1 << 8)
  }

  const readU32 = (): number => {
    const w0 = readU16()
    const w1 = readU16()
    return (w0 | (w1 << 16)) >>> 0
  }

  const skipRawBytes = (count: number): void => {
    let left = count
    while (left > 0 && chunkIdx < chunks.length) {
      const avail = chunks[chunkIdx]!.length - pos
      if (avail <= 0) {
        if (!advanceChunk()) break
        continue
      }
      const step = Math.min(left, avail)
      pos += step
      left -= step
    }
  }

  const maxStrings = Math.min(uniqueCount, 500_000)
  for (let i = 0; i < maxStrings; i++) {
    if (!ensureBytes(1)) break
    const cch = readU16()
    const flags = readU8()
    let isUtf16 = (flags & 0x01) !== 0
    const hasExt = (flags & 0x04) !== 0
    const hasRich = (flags & 0x08) !== 0
    const richRuns = hasRich ? readU16() : 0
    const extSize = hasExt ? readU32() : 0

    let charsLeft = cch
    let str = ''
    while (charsLeft > 0 && chunkIdx < chunks.length) {
      let avail = chunks[chunkIdx]!.length - pos
      if (avail <= 0) {
        if (!advanceChunk()) break
        // First byte of a CONTINUE record continuing character data is the new grbit flag
        const contFlags = readU8()
        isUtf16 = (contFlags & 0x01) !== 0
        avail = chunks[chunkIdx]!.length - pos
      }
      const bytesPerChar = isUtf16 ? 2 : 1
      const charsInChunk = Math.min(charsLeft, Math.floor(avail / bytesPerChar))
      if (charsInChunk <= 0) {
        if (!advanceChunk()) break
        const contFlags = readU8()
        isUtf16 = (contFlags & 0x01) !== 0
        continue
      }
      const byteCount = charsInChunk * bytesPerChar
      const slice = chunks[chunkIdx]!.subarray(pos, pos + byteCount)
      str += isUtf16 ? slice.toString('utf16le') : slice.toString('latin1')
      pos += byteCount
      charsLeft -= charsInChunk
    }

    if (richRuns > 0) skipRawBytes(richRuns * 4)
    if (extSize > 0) skipRawBytes(extSize)
    result.push(str)
  }

  return result
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
}

/**
 * Many Vietnamese education/government portals (vnEdu, SMAS, CSDL Ngành) export
 * `.xls` files that are actually HTML `<table>` documents or Excel 2003 XML
 * SpreadsheetML (`<Workbook><Worksheet><Table><Row><Cell><Data>`).
 */
function parseTextOrHtmlXls(rawText: string, maxChars?: number): string {
  const trimmed = rawText.trim()
  if (!trimmed) return ''

  // 1. Excel 2003 XML SpreadsheetML (<Workbook ...> ... <Worksheet ss:Name="...">)
  if (/<Workbook[\s>]/i.test(trimmed) && /<Row[\s>]/i.test(trimmed)) {
    const sheets: string[] = []
    const wsRegex = /<Worksheet\b([^>]*)>([\s\S]*?)<\/Worksheet>/gi
    let wsMatch: RegExpExecArray | null
    let sheetIdx = 0
    while ((wsMatch = wsRegex.exec(trimmed)) !== null) {
      sheetIdx += 1
      const attrs = wsMatch[1] ?? ''
      const body = wsMatch[2] ?? ''
      const nameMatch = /(?:ss:)?Name\s*=\s*["']([^"']+)["']/i.exec(attrs)
      const sheetName = decodeHtmlEntities(nameMatch?.[1] ?? `Sheet${sheetIdx}`)
      const rows: string[] = []
      const rowRegex = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi
      let rowMatch: RegExpExecArray | null
      while ((rowMatch = rowRegex.exec(body)) !== null) {
        const rowBody = rowMatch[1] ?? ''
        const cells: string[] = []
        const cellRegex = /<Cell\b[^>]*>([\s\S]*?)<\/Cell>/gi
        let cellMatch: RegExpExecArray | null
        while ((cellMatch = cellRegex.exec(rowBody)) !== null) {
          const cellContent = cellMatch[1] ?? ''
          const dataMatch = /<Data\b[^>]*>([\s\S]*?)<\/Data>/i.exec(cellContent)
          const rawCell = dataMatch ? dataMatch[1]! : cellContent
          const text = decodeHtmlEntities(rawCell.replace(/<[^>]+>/g, ''))
            .replace(/\s+/g, ' ')
            .trim()
          cells.push(text)
        }
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells.join('\t'))
        }
      }
      sheets.push(rows.length > 0 ? `## ${sheetName}\n${rows.join('\n')}` : `## ${sheetName}`)
    }
    if (sheets.length > 0) {
      const out = sheets.join('\n\n')
      return maxChars !== undefined && out.length > maxChars ? out.slice(0, maxChars) : out
    }
  }

  // 2. HTML <table> exported with .xls extension
  if (/<table[\s>]/i.test(trimmed) || /<tr[\s>]/i.test(trimmed)) {
    const rows: string[] = []
    const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
    let trMatch: RegExpExecArray | null
    while ((trMatch = trRegex.exec(trimmed)) !== null) {
      const trBody = trMatch[1] ?? ''
      const cells: string[] = []
      const tdRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi
      let tdMatch: RegExpExecArray | null
      while ((tdMatch = tdRegex.exec(trBody)) !== null) {
        const rawCell = tdMatch[1] ?? ''
        const text = decodeHtmlEntities(
          rawCell.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''),
        )
          .replace(/\s+/g, ' ')
          .trim()
        cells.push(text)
      }
      if (cells.some((c) => c.length > 0)) {
        rows.push(cells.join('\t'))
      }
    }
    if (rows.length > 0) {
      const out = `## Sheet1\n${rows.join('\n')}`
      return maxChars !== undefined && out.length > maxChars ? out.slice(0, maxChars) : out
    }
  }

  // 3. Plain TSV / CSV text saved as .xls
  return maxChars !== undefined && trimmed.length > maxChars
    ? trimmed.slice(0, maxChars)
    : trimmed
}

/**
 * Extract readable sheet text from a legacy Excel `.xls` file (BIFF8 OLE2,
 * HTML table `.xls`, XML Spreadsheet 2003 `.xls`, or `.xlsx` saved as `.xls`).
 */
export async function xlsToText(
  bytes: Uint8Array,
  opts: ParseFileOptions = {},
): Promise<string> {
  const buf = Buffer.from(bytes)
  if (buf.length === 0) return ''

  // 1. Check if it's actually a ZIP (.xlsx renamed to .xls)
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
    return xlsxToText(buf, opts)
  }

  // 2. Check if it's NOT an OLE2 container (e.g. HTML table, XML SpreadsheetML, CSV/TSV)
  const isOle2 =
    buf.length >= 4 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  if (!isOle2) {
    const text =
      buf[0] === 0xff && buf[1] === 0xfe
        ? buf.toString('utf16le', 2)
        : buf.toString('utf8').replace(/^\uFEFF/, '')
    return parseTextOrHtmlXls(text, opts.maxChars)
  }

  // 3. Parse OLE2 CFB container
  const cfb = CFB.read(buf, { type: 'buffer' })
  const entryNames = cfb.FullPaths.map((p) => p.toLowerCase())
  if (
    entryNames.some(
      (p) => p.endsWith('/encryptedpackage') || p.endsWith('/encryptioninfo'),
    )
  ) {
    throw new Error('This workbook is password-protected.')
  }

  const wbEntry =
    CFB.find(cfb, '/Workbook') ??
    CFB.find(cfb, '/Book') ??
    CFB.find(cfb, 'Workbook') ??
    CFB.find(cfb, 'Book')

  if (!wbEntry || !wbEntry.content) {
    throw new Error('Invalid .xls file: missing Workbook/Book stream in OLE2 container')
  }

  const stream = Buffer.from(wbEntry.content as Uint8Array)
  const records = parseBiffRecords(stream)

  // Check for BIFF8 encryption (FILEPASS record before first sheet)
  for (const rec of records) {
    if (rec.id === RECORD_FILEPASS) {
      throw new Error('This workbook is password-protected.')
    }
  }

  const sheetDefs: { name: string; offset: number; hidden: boolean }[] = []
  let sstStrings: string[] = []

  // First pass: Workbook globals (before the first worksheet BOF)
  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!
    if (rec.id === RECORD_BOUNDSHEET && rec.data.length >= 8) {
      const sheetOffset = rec.data.readUInt32LE(0)
      const visibility = rec.data.readUInt8(4)
      const sheetType = rec.data.readUInt8(5)
      if (sheetType === 0x00) {
        // Worksheet
        const name = readShortUnicodeString(rec.data, 6)
        sheetDefs.push({ name: name || `Sheet${sheetDefs.length + 1}`, offset: sheetOffset, hidden: visibility !== 0 })
      }
    } else if (rec.id === RECORD_SST) {
      const continues: Buffer[] = []
      while (i + 1 < records.length && records[i + 1]!.id === RECORD_CONTINUE) {
        i += 1
        continues.push(records[i]!.data)
      }
      sstStrings = parseSst(rec.data, continues)
    }
  }

  // Second pass: Parse each worksheet substream
  interface SheetGrid {
    name: string
    rows: Map<number, Map<number, string>>
    maxCol: number
  }
  const sheets: SheetGrid[] = []
  let currentSheet: SheetGrid | null = null
  let sheetIndex = 0
  let pendingFormulaCell: { row: number; col: number } | null = null

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!
    if (rec.id === RECORD_BOF && rec.data.length >= 4) {
      const substreamType = rec.data.readUInt16LE(2)
      if (substreamType === 0x0010) {
        // Worksheet substream
        const def = sheetDefs[sheetIndex]
        sheetIndex += 1
        currentSheet = {
          name: def?.name ?? `Sheet${sheetIndex}`,
          rows: new Map(),
          maxCol: 0,
        }
        sheets.push(currentSheet)
      } else {
        currentSheet = null
      }
      pendingFormulaCell = null
      continue
    }

    if (rec.id === RECORD_EOF) {
      currentSheet = null
      pendingFormulaCell = null
      continue
    }

    if (!currentSheet) continue

    const setCell = (row: number, col: number, val: string) => {
      if (!val) return
      let r = currentSheet!.rows.get(row)
      if (!r) {
        r = new Map()
        currentSheet!.rows.set(row, r)
      }
      r.set(col, val.replace(/[\r\n\t]+/g, ' ').trim())
      if (col > currentSheet!.maxCol) currentSheet!.maxCol = col
    }

    switch (rec.id) {
      case RECORD_LABELSST: {
        if (rec.data.length >= 10) {
          const row = rec.data.readUInt16LE(0)
          const col = rec.data.readUInt16LE(2)
          const sstIdx = rec.data.readUInt32LE(6)
          const str = sstStrings[sstIdx] ?? ''
          setCell(row, col, str)
        }
        pendingFormulaCell = null
        break
      }
      case RECORD_LABEL:
      case RECORD_RSTRING: {
        if (rec.data.length >= 9) {
          const row = rec.data.readUInt16LE(0)
          const col = rec.data.readUInt16LE(2)
          const str = readSingleRecordUnicodeString(rec.data, 6)
          setCell(row, col, str)
        }
        pendingFormulaCell = null
        break
      }
      case RECORD_NUMBER: {
        if (rec.data.length >= 14) {
          const row = rec.data.readUInt16LE(0)
          const col = rec.data.readUInt16LE(2)
          const num = rec.data.readDoubleLE(6)
          setCell(row, col, formatNumber(num))
        }
        pendingFormulaCell = null
        break
      }
      case RECORD_RK: {
        if (rec.data.length >= 10) {
          const row = rec.data.readUInt16LE(0)
          const col = rec.data.readUInt16LE(2)
          const rk = rec.data.readInt32LE(6)
          setCell(row, col, formatNumber(decodeRkNumber(rk)))
        }
        pendingFormulaCell = null
        break
      }
      case RECORD_MULRK: {
        if (rec.data.length >= 10) {
          const row = rec.data.readUInt16LE(0)
          const firstCol = rec.data.readUInt16LE(2)
          const lastCol = rec.data.readUInt16LE(rec.data.length - 2)
          const count = lastCol - firstCol + 1
          for (let k = 0; k < count; k++) {
            const offset = 4 + k * 6
            if (offset + 6 > rec.data.length - 2) break
            const rk = rec.data.readInt32LE(offset + 2)
            setCell(row, firstCol + k, formatNumber(decodeRkNumber(rk)))
          }
        }
        pendingFormulaCell = null
        break
      }
      case RECORD_FORMULA: {
        if (rec.data.length >= 14) {
          const row = rec.data.readUInt16LE(0)
          const col = rec.data.readUInt16LE(2)
          const b6 = rec.data.readUInt8(12)
          const b7 = rec.data.readUInt8(13)
          if (b6 === 0xff && b7 === 0xff) {
            const kind = rec.data.readUInt8(6)
            if (kind === 0x00) {
              // String result follows in a STRING record
              pendingFormulaCell = { row, col }
            } else if (kind === 0x01) {
              setCell(row, col, rec.data.readUInt8(8) ? 'TRUE' : 'FALSE')
              pendingFormulaCell = null
            } else {
              pendingFormulaCell = null
            }
          } else {
            const num = rec.data.readDoubleLE(6)
            setCell(row, col, formatNumber(num))
            pendingFormulaCell = null
          }
        }
        break
      }
      case RECORD_STRING: {
        if (pendingFormulaCell && rec.data.length >= 3) {
          const str = readSingleRecordUnicodeString(rec.data, 0)
          setCell(pendingFormulaCell.row, pendingFormulaCell.col, str)
          pendingFormulaCell = null
        }
        break
      }
      case RECORD_BOOLERR: {
        if (rec.data.length >= 8) {
          const row = rec.data.readUInt16LE(0)
          const col = rec.data.readUInt16LE(2)
          const val = rec.data.readUInt8(6)
          const isErr = rec.data.readUInt8(7)
          if (!isErr) {
            setCell(row, col, val ? 'TRUE' : 'FALSE')
          }
        }
        pendingFormulaCell = null
        break
      }
      default:
        if (rec.id !== RECORD_CONTINUE) {
          pendingFormulaCell = null
        }
        break
    }
  }

  const budget = opts.maxChars ?? Infinity
  const outSections: string[] = []
  let totalChars = 0

  for (const sheet of sheets) {
    const header = `## ${sheet.name}`
    const rowIndices = [...sheet.rows.keys()].sort((a, b) => a - b)
    if (rowIndices.length === 0) {
      outSections.push(header)
      totalChars += header.length + 2
      if (totalChars >= budget) break
      continue
    }
    const lines: string[] = [header]
    totalChars += header.length + 1
    for (const rIdx of rowIndices) {
      const colMap = sheet.rows.get(rIdx)!
      const maxC = Math.max(...colMap.keys())
      const cells: string[] = []
      for (let c = 0; c <= maxC; c++) {
        cells.push(colMap.get(c) ?? '')
      }
      // Trim trailing empty cells
      while (cells.length > 0 && cells[cells.length - 1] === '') {
        cells.pop()
      }
      if (cells.length > 0) {
        const line = cells.join('\t')
        lines.push(line)
        totalChars += line.length + 1
        if (totalChars >= budget) break
      }
    }
    outSections.push(lines.join('\n'))
    if (totalChars >= budget) break
  }

  return outSections.join('\n\n')
}
