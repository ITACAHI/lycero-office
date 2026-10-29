/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// Resolve workspace packages from this checkout's sources: in a git worktree
// node_modules is a symlink into the main checkout, so bare specifiers would
// silently bundle the other checkout's (possibly stale) code.
const localAlias = {
  '@lycero/docx-engine/lazy-media': resolve(
    __dirname,
    '../../packages/docx-engine/src/lazy-media.ts',
  ),
  '@lycero/docx-engine/zip-splice': resolve(
    __dirname,
    '../../packages/docx-engine/src/zip-splice.ts',
  ),
  '@lycero/docx-engine': resolve(__dirname, '../../packages/docx-engine/src/index.ts'),
}

const LYCERO_WORKSPACE_PACKAGES = [
  '@lycero/agent-core',
  '@lycero/ai-auth',
  '@lycero/ai-provider',
  '@lycero/ai-search',
  '@lycero/cli',
  '@lycero/cloud-sync',
  '@lycero/docx-engine',
  '@lycero/electron-utils',
  '@lycero/file-parse',
  '@lycero/font-metrics',
  '@lycero/html2docx',
  '@lycero/i18n',
  '@lycero/odf2ooxml',
  '@lycero/pdf2docx',
  '@lycero/pipelines',
  '@lycero/pptx-engine',
  '@lycero/pptx-ops',
  '@lycero/pptx-render',
  '@lycero/project-store',
  '@lycero/ui',
  '@lycero/xlsx-gateway',
  '@lycero/zip-gate',
]

export default defineConfig({
  // Main and preload use only electron + node builtins; bundle everything so
  // the packaged app doesn't rely on node_modules at runtime.
  // @lycero/* deps ship as raw TS source with extensionless imports, so they
  // must be bundled — externalizing them yields ERR_MODULE_NOT_FOUND under Node
  // (same setup as apps/slides).
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [...LYCERO_WORKSPACE_PACKAGES, 'pdf-lib'],
      }),
    ],
    resolve: { alias: localAlias },
  },
  preload: {
    // Sandboxed preload scripts cannot require arbitrary npm packages at
    // runtime, so all workspace and npm deps must be bundled, not externalized.
    build: {
      externalizeDeps: false,
    },
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: localAlias },
    server: {
      // Overridable so multiple genoffice dev instances can coexist (default 5173).
      port: Number(process.env.DOCS_DEV_PORT) || 5173,
      strictPort: Boolean(process.env.DOCS_DEV_PORT),
    },
  },
})
