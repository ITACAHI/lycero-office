/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { DOC_OPTS } from './view-config'

export function loadPdfForView(bytes: Uint8Array, password?: string) {
  // PDF.js transfers its input to the worker; retain the source for the
  // encrypted-document IPC and metadata checks later in the open pipeline.
  return getDocument({ data: bytes.slice(), password, ...DOC_OPTS })
}
