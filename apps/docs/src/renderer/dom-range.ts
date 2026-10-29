/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Reusable Range: Blink fixes up every live Range on each DOM removal, so
 * per-word probe Ranges make later ProseMirror re-renders crawl. Do not nest.
 */
export function rangeSlot(): () => Range {
  let range: Range | undefined
  return () => (range ??= document.createRange())
}
