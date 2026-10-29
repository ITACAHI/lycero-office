/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute } from 'node:path'
import { z } from 'zod'
import type { McpToolDefinition } from '../mcp-server'

/**
 * Read-only MCP access for the Markdown and HTML editor families.
 *
 * Both are plain-text on disk: the markdown editor round-trips the bytes
 * verbatim, the html editor serves the file through the lycero-office scheme.
 * Read needs no parsing — the byte stream *is* the content an agent wants,
 * rendered once locally for the agent and once again by the editor for the
 * user. Mirrors read_pdf (see pdf-tools.ts): sibling tool, no shared engine
 * surface, byte-level file IO with a hard size cap so a giant open files
 * cannot flood the agent's context.
 *
 * Writer/editor tools (apply_ops to an open markdown/html tab) live behind
 * the visible-editor bridges — that surface is intentionally out of scope for
 * this headless read path, since it needs a renderer protocol the family does
 * not yet expose.
 */

const MAX_TOTAL_BYTES = 4 * 1024 * 1024

const ACCEPTED_EXTS: Record<'md' | 'html', readonly string[]> = {
  md: ['.md', '.markdown'],
  html: ['.html', '.htm'],
}

function extFor(filePath: string): string {
  return extname(filePath).toLowerCase()
}

/** a guided, file-extension-aware error for "wrong family for this tool" */
function wrongFamily(filePath: string, want: 'md' | 'html'): Error {
  const got = extFor(filePath) || '(no extension)'
  const labels = { md: 'Markdown', html: 'HTML' } as const
  return new Error(
    `"${filePath}" has extension ${got}; this is not a ${labels[want]} file. ` +
      `Call read_${want} with a ${ACCEPTED_EXTS[want].join('/')} file.`,
  )
}

async function readTextFile(
  filePath: string,
  want: 'md' | 'html',
): Promise<{ path: string; bytes: number; content: string }> {
  if (!isAbsolute(filePath)) {
    throw new Error(`path must be absolute (got "${filePath}")`)
  }
  const ext = extFor(filePath)
  if (!ACCEPTED_EXTS[want].includes(ext)) throw wrongFamily(filePath, want)

  const info = await stat(filePath)
  if (info.isDirectory()) throw new Error(`"${filePath}" is a directory, not a file`)
  if (info.size > MAX_TOTAL_BYTES) {
    throw new Error(
      `"${filePath}" is ${info.size} bytes; read_${want} caps reads at ${MAX_TOTAL_BYTES} ` +
        'bytes. Open the file in Lycero Office and read it through open_documents instead.',
    )
  }
  const content = await readFile(filePath, 'utf8')
  return { path: filePath, bytes: info.size, content }
}

/**
 * Test-only: the small set of suffixes the tool accepts. Exposed so a unit test
 * can iterate the rejection paths without rerunning real stat() on fixtures.
 */
export const MD_ACCEPTED_EXTS = ACCEPTED_EXTS.md
export const HTML_ACCEPTED_EXTS = ACCEPTED_EXTS.html
export const MD_HTML_MAX_TOTAL_BYTES = MAX_TOTAL_BYTES
/** Test-only: re-export the read helpers so the unit test can drive the same cap. */
export const __test__ = { readTextFile }

export function createMdTools(): McpToolDefinition[] {
  return [
    {
      name: 'read_md',
      description:
        'Read a Markdown (.md / .markdown) file from disk and return its raw UTF-8 text, ' +
        'byte size and path. Mirrors read_pdf: headless, no engine, no editing. ' +
        'Files larger than 4 MB are rejected to keep huge docs out of the agent ' +
        'context — open the file in Lycero Office and use open_documents for those. ' +
        'For *editing* an open Markdown tab, use open_documents "list" / "read" / ' +
        '"close"; the editor control surface is not exposed here.',
      inputSchema: {
        path: z.string().describe('absolute path to a .md or .markdown file'),
      },
      handler: async (args) => {
        const path = String(args.path ?? '').trim()
        if (!path) throw new Error('read_md requires a path')
        const { bytes, content } = await readTextFile(path, 'md')
        return { path, bytes, content }
      },
    },
  ]
}

export function createHtmlTools(): McpToolDefinition[] {
  return [
    {
      name: 'read_html',
      description:
        'Read an HTML (.html / .htm) file from disk and return its raw UTF-8 text, ' +
        'byte size and path. Mirrors read_pdf: headless, no engine, no editing. ' +
        'Files larger than 4 MB are rejected to keep huge pages out of the agent ' +
        'context — open the file in Lycero Office and use open_documents for those. ' +
        'For *editing* an open HTML tab, use open_documents "list" / "read" / ' +
        '"close"; the editor control surface is not exposed here.',
      inputSchema: {
        path: z.string().describe('absolute path to a .html or .htm file'),
      },
      handler: async (args) => {
        const path = String(args.path ?? '').trim()
        if (!path) throw new Error('read_html requires a path')
        const { bytes, content } = await readTextFile(path, 'html')
        return { path, bytes, content }
      },
    },
  ]
}

export function createMdHtmlTools(): McpToolDefinition[] {
  return [...createMdTools(), ...createHtmlTools()]
}
