/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
export { convertHtmlToDocx, normalizeIr, raceWithAbort } from './convert'
export type { ConvertOptions, ConvertResult, ConvertStage, ValidatedIr } from './convert'
export type { BrowserDriver, ClipRect, ScreenshotOptions, Viewport } from './driver'
export { BROWSER_HELPER_SCRIPTS, EXTRACTOR_CALL, EXTRACTOR_SOURCE } from './extract'
export { generateDocx } from './generate'
export { FONT_RULES, mapFont, runFont } from './generate/fonts'
export { parsePageBgColor } from './generate/page-settings'
