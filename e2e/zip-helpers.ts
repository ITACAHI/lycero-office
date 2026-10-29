/**
 * Cross-platform OOXML zip helpers for E2E tests.
 *
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * The suite used to shell out to `unzip`/`zip`, which do not exist on a
 * stock Windows box, so every assertion on saved workbook XML failed there
 * for a reason that had nothing to do with the product. JSZip is already a
 * workspace dependency (the xlsx gateway uses it), so read and write through
 * that instead of adding a dependency or a shell-out.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { mkdir } from 'node:fs/promises'
import JSZip from 'jszip'

/** the raw XML of one entry inside an .xlsx/.pptx/.docx, as a string */
export async function readZipEntry(archivePath: string, entryName: string): Promise<string> {
  const zip = await JSZip.loadAsync(await readFile(archivePath))
  const entry = zip.file(entryName)
  if (!entry) {
    throw new Error(`${entryName} not found in ${archivePath} (entries: ${Object.keys(zip.files).join(', ')})`)
  }
  return entry.async('string')
}

/** the entry names inside the archive, for `unzip -l` style assertions */
export async function listZipEntries(archivePath: string): Promise<string[]> {
  const zip = await JSZip.loadAsync(await readFile(archivePath))
  return Object.keys(zip.files)
}

/** the raw bytes of one entry, for binary parts (images, macros) */
export async function readZipEntryBuffer(archivePath: string, entryName: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(await readFile(archivePath))
  const entry = zip.file(entryName)
  if (!entry) {
    throw new Error(`${entryName} not found in ${archivePath} (entries: ${Object.keys(zip.files).join(', ')})`)
  }
  return entry.async('nodebuffer')
}

/** write `contents` into `entryName`, creating parent folders as needed */
export async function writeZipEntry(
  archivePath: string,
  entryName: string,
  contents: string,
): Promise<void> {
  const zip = await JSZip.loadAsync(await readFile(archivePath))
  // folder: true so Excel treats the part as a real folder entry
  zip.file(entryName, contents)
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await mkdir(dirname(archivePath), { recursive: true })
  await writeFile(archivePath, buf)
}

/**
 * Build a zip archive from a flat list of (relativeName, absolutePath) pairs.
 * Replaces the `zip -r` shell-out used by slides fixtures: same on-the-wire
 * format, no need for a system zip binary on Windows.
 */
export async function createZip(
  archivePath: string,
  files: ReadonlyArray<readonly [relName: string, absPath: string]>,
): Promise<void> {
  const zip = new JSZip()
  for (const [name, abs] of files) {
    zip.file(name, await readFile(abs))
  }
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await mkdir(dirname(archivePath), { recursive: true })
  await writeFile(archivePath, buf)
}
