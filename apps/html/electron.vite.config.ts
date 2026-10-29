/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

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
  // @lycero/* workspace packages ship as TS source — must be bundled
  main: {
    plugins: [externalizeDepsPlugin({ exclude: LYCERO_WORKSPACE_PACKAGES })],
  },
  preload: {
    build: {
      externalizeDeps: false,
    },
  },
  renderer: {
    plugins: [react()],
    server: {
      port: Number(process.env.HTML_DEV_PORT) || 5178,
      strictPort: Boolean(process.env.HTML_DEV_PORT),
    },
  },
})
