/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
export function coverCropFractions(
  imageW: number,
  imageH: number,
  frameW: number,
  frameH: number,
): { l: number; t: number; r: number; b: number } | null {
  if (!(imageW > 0) || !(imageH > 0) || !(frameW > 0) || !(frameH > 0)) return null
  const imageAspect = imageW / imageH
  const frameAspect = frameW / frameH
  // compare relative to the larger aspect ratio so the "already matches" tolerance
  // is symmetric for wide vs. tall frames
  if (Math.abs(imageAspect - frameAspect) / Math.max(imageAspect, frameAspect) < 0.01) return null
  if (imageAspect > frameAspect) {
    const crop = (1 - frameAspect / imageAspect) / 2
    return { l: crop, t: 0, r: crop, b: 0 }
  }
  const crop = (1 - imageAspect / frameAspect) / 2
  return { l: 0, t: crop, r: 0, b: crop }
}
