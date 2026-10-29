/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

/**
 * File extension regex patterns for document routing.
 * Used by the shell to detect and route file opens by extension.
 */

/** Matches .docx files (case-insensitive) */
export const DOCX_RE = /\.docx$/i

/** Matches .xlsx, .xlsm, .xls, and .csv files */
export const XLSX_RE = /\.(xlsx|xlsm|xls|csv)$/i

/** Matches .pptx files */
export const PPTX_RE = /\.pptx$/i

/** Matches .pdf files */
export const PDF_RE = /\.pdf$/i

/** Matches .md and .markdown files */
export const MD_RE = /\.(md|markdown)$/i

/** Matches .html and .htm files */
export const HTML_RE = /\.html?$/i

/** Document formats we recognize but don't open — surfaced as a dialog, not silently dropped */
export const UNSUPPORTED_DOC_RE = /\.(doc|rtf|odt|ppt|pps|odp|ods|xlsb|pages|key|numbers)$/i

/**
 * Single source of truth for the open-dialog filter. Includes the
 * legacy .doc/.ppt binaries so they are selectable and surface the explicit
 * "not supported" dialog via openDocumentPath instead of being grayed out.
 */
export const OPEN_DIALOG_EXTENSIONS = [
  'docx',
  'doc',
  'xlsx',
  'xlsm',
  'xls',
  'csv',
  'pptx',
  'ppt',
  'pdf',
  'md',
  'markdown',
  'html',
  'htm',
]
