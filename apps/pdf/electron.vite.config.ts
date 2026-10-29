/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Non-embedded CMaps/standard fonts (e.g. CJK) need pdfjs data dirs, shipped with renderer output
const require = createRequire(import.meta.url)
const pdfjsRoot = dirname(dirname(require.resolve('pdfjs-dist/package.json')))
// vite-plugin-static-copy globs require POSIX separators; join() breaks on Windows
const pdfjsDir = (sub: string) => normalizePath(join(pdfjsRoot, 'pdfjs-dist', sub))

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
  // @lycero/* ships as TS source; pdf-lib's package only includes out/** — both must be bundled
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [...LYCERO_WORKSPACE_PACKAGES, 'pdf-lib'],
      }),
    ],
  },
  preload: {
    // Sandboxed preload scripts cannot require arbitrary npm packages at runtime
    build: {
      externalizeDeps: false,
    },
  },
  renderer: {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: pdfjsDir('cmaps'), dest: 'pdfjs' },
          { src: pdfjsDir('standard_fonts'), dest: 'pdfjs' },
          { src: pdfjsDir('wasm'), dest: 'pdfjs' },
        ],
      }),
    ],
    server: {
      port: Number(process.env.PDF_DEV_PORT) || 5176,
      strictPort: Boolean(process.env.PDF_DEV_PORT),
    },
  },
})
