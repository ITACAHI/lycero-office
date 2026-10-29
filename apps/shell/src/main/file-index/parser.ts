/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * Text extraction / parsing for common document types in the file-index module.
 * Covers: .txt, .md, .html, .json, .xml, and generic binary-safe extraction.
 */
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

import { extractExcerpt } from './schema'

export interface ParseResult {
  content: string
  encoding: string
  mimeType: string
}

/** Parse a file by extension, extract plain text */
export function parseFile(filePath: string): ParseResult {
  const ext = extname(filePath).toLowerCase()

  try {
    switch (ext) {
      case '.txt':
      case '.md':
      case '.markdown':
      case '.csv':
        return parseText(filePath)
      case '.json':
        return parseJson(filePath)
      case '.xml':
      case '.html':
      case '.htm':
        return parseHtml(filePath)
      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
        return parseCode(filePath)
      default:
        return parseBinaryFallback(filePath)
    }
  } catch {
    return { content: '', encoding: 'utf-8', mimeType: 'application/octet-stream' }
  }
}

/** UTF-8 / UTF-16 text file */
function parseText(filePath: string): ParseResult {
  const raw = readFileSync(filePath)
  const encoding = isUtf16Le(raw) ? 'utf-16le' : 'utf-8'
  const decoder = new TextDecoder(encoding)
  const content = decoder.decode(raw)
  return { content: stripBinary(content), encoding, mimeType: 'text/plain' }
}

/** JSON with structure preserved as text */
function parseJson(filePath: string): ParseResult {
  const raw = readFileSync(filePath, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    // flatten nested structure for indexing
    const content = JSON.stringify(parsed).replace(/[{}[\]]/g, ' ')
    return { content, encoding: 'utf-8', mimeType: 'application/json' }
  } catch {
    return { content: stripBinary(raw), encoding: 'utf-8', mimeType: 'application/json' }
  }
}

/** Strip HTML tags */
function parseHtml(filePath: string): ParseResult {
  const raw = readFileSync(filePath, 'utf-8')
  const content = raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return { content, encoding: 'utf-8', mimeType: 'text/html' }
}

/** JS/TS source — strip comments and strings */
function parseCode(filePath: string): ParseResult {
  const raw = readFileSync(filePath, 'utf-8')
  const content = raw
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { content, encoding: 'utf-8', mimeType: 'text/plain' }
}

/** Generic binary — extract printable ASCII */
function parseBinaryFallback(filePath: string): ParseResult {
  const MAX_READ = 1024 * 1024 // 1 MB
  const raw = readFileSync(filePath)
  const slice = raw.buffer.slice(raw.byteOffset, raw.byteOffset + MAX_READ)
  const content = extractPrintableAscii(Buffer.from(slice))
  return { content, encoding: 'binary', mimeType: 'application/octet-stream' }
}

/** Detect UTF-16 LE BOM */
function isUtf16Le(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe
}

/** Remove non-printable / control characters */
function stripBinary(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Extract printable ASCII and common punctuation from binary buffer */
function extractPrintableAscii(buf: Buffer): string {
  const chars: string[] = []
  for (const byte of buf) {
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      chars.push(String.fromCharCode(byte))
    } else {
      chars.push(' ')
    }
  }
  return stripBinary(chars.join(''))
}
