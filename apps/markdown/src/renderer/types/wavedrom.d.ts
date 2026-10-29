/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
declare module 'wavedrom' {
  /** onml tree: [tag, attrs, ...children] */
  export type Onml = [string, Record<string, unknown>, ...unknown[]]
  export const waveSkin: Record<string, Onml>
  export function renderAny(index: number, source: object, waveSkin: Record<string, Onml>): Onml
  export const onml: { stringify: (tree: Onml) => string }
}
