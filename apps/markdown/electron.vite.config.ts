/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// npm hoists some @tiptap packages to the repo root (shared with docs at a
// different version) and nests others under this app — dedupe forces every
// import onto this app's single copy so the bundle never carries two cores.
const TIPTAP_DEDUPE = [
  '@tiptap/core',
  '@tiptap/pm',
  '@tiptap/react',
  '@tiptap/extensions',
  '@tiptap/extension-list',
  '@tiptap/extension-table',
  '@tiptap/extension-image',
  '@tiptap/suggestion',
  '@tiptap/markdown',
  '@tiptap/extension-highlight',
  '@tiptap/extension-code-block',
]

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
    // Sandboxed preload scripts cannot require arbitrary npm packages at runtime
    build: {
      externalizeDeps: false,
    },
  },
  renderer: {
    plugins: [react()],
    resolve: { dedupe: TIPTAP_DEDUPE },
    server: {
      port: Number(process.env.MARKDOWN_DEV_PORT) || 5177,
      strictPort: Boolean(process.env.MARKDOWN_DEV_PORT),
    },
  },
})
