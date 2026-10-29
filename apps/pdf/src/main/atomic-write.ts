/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { atomicWriteFile } from '@lycero/electron-utils/atomic-write'

/**
 * Shared temp + rename writer: retries the transient Windows EPERM/EBUSY rename
 * locks (Defender, indexer, an open preview) and falls back to an in-place write.
 */
export async function writePdfAtomically(targetPath: string, bytes: Uint8Array): Promise<void> {
  await atomicWriteFile(targetPath, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
}
