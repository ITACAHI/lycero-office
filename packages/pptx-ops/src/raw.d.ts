/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/** Vite-style raw text import (the op guides ship as markdown); bundlers outside Vite need a matching loader */
declare module '*.md?raw' {
  const text: string
  export default text
}
