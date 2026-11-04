/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { convertLegacyDocToDocx, LegacyDocError } from '@lycero/doc2docx'
import { CliError, EXIT } from '../result'

/**
 * .doc/.dot → .docx through the in-process legacy importer: the OLE2/FIB parse
 * and the OOXML rebuild run here, without the app renderer (same engine as the
 * docs app's legacy import route).
 */
export async function convertLegacyDoc(input: Uint8Array): Promise<{
  bytes: Uint8Array
  detail: Record<string, unknown>
}> {
  try {
    const result = await convertLegacyDocToDocx(input)
    return { bytes: result.docx, detail: { warnings: result.warnings } }
  } catch (error) {
    // stable importer codes (bad_clx, bad_table, ...) stay in detail for scripts
    if (error instanceof LegacyDocError)
      throw new CliError(EXIT.conversion, error.message, { reason: error.code })
    throw error
  }
}
