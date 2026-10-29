/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/** electron-vite main-process asset imports: ?asset copies into the bundle and returns the runtime path */
declare module '*?asset' {
  const path: string
  export default path
}
