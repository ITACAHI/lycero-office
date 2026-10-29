/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/// Re-exported from its own electron-utils subpath on purpose: the CLI bundles
/// this module (packages/cli/src/formats/xlsx.ts), and the package barrel pulls
/// in renderer/main-only modules that import 'electron' at top level, which a
/// plain Node process cannot resolve.
export { atomicWriteFile } from '@lycero/electron-utils/atomic-write'
