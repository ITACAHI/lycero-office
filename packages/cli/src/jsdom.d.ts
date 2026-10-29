/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/** Minimal surface of jsdom used by src/dom.ts (the package ships no bundled types here). */
declare module 'jsdom' {
  export class VirtualConsole {}
  export class JSDOM {
    constructor(
      html?: string,
      options?: { pretendToBeVisual?: boolean; virtualConsole?: VirtualConsole },
    )
    readonly window: Window & typeof globalThis
  }
}
