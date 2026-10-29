/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const here = dirname(fileURLToPath(import.meta.url))

// Pin resolution to this repo's workspace sources (matches tsconfig paths;
// avoids bundling stale implementations when node_modules links point elsewhere)
const workspaceAlias = {
  // Subpath before the bare name: string aliases are prefix replacements
  '@lycero/pptx-engine/table-grid': resolve(
    here,
    '../../packages/pptx-engine/src/table-grid.ts',
  ),
  '@lycero/pptx-engine/identity': resolve(here, '../../packages/pptx-engine/src/identity.ts'),
  '@lycero/pptx-engine/named-action': resolve(
    here,
    '../../packages/pptx-engine/src/named-action.ts',
  ),
  '@lycero/pptx-engine/custgeom': resolve(here, '../../packages/pptx-engine/src/custgeom.ts'),
  '@lycero/pptx-engine/background-promote': resolve(
    here,
    '../../packages/pptx-engine/src/background-promote.ts',
  ),
  '@lycero/pptx-engine/model3d': resolve(here, '../../packages/pptx-engine/src/model3d.ts'),
  '@lycero/pptx-engine/chart-workbook': resolve(
    here,
    '../../packages/pptx-engine/src/chart-workbook.ts',
  ),
  '@lycero/pptx-engine': resolve(here, '../../packages/pptx-engine/src/index.ts'),
  '@lycero/pptx-ops/op-docs': resolve(here, '../../packages/pptx-ops/src/op-docs.ts'),
  '@lycero/pptx-ops/font-size': resolve(here, '../../packages/pptx-ops/src/font-size.ts'),
  '@lycero/pptx-ops': resolve(here, '../../packages/pptx-ops/src/index.ts'),
  '@lycero/pptx-render/preset-geometry': resolve(
    here,
    '../../packages/pptx-render/src/preset-geometry.ts',
  ),
  '@lycero/pptx-render': resolve(here, '../../packages/pptx-render/src/index.ts'),
  '@lycero/pipelines/slides/layout-audit': resolve(
    here,
    '../../packages/pipelines/src/slides/layout-audit.ts',
  ),
  '@lycero/pipelines/slides': resolve(here, '../../packages/pipelines/src/slides/index.ts'),
  // Metafile (EMF/WMF) rasterizer shared with the docs engine (renderer-only: needs canvas)
  '@lycero/docx-engine/metafile': resolve(here, '../../packages/docx-engine/src/metafile.ts'),
  '@lycero/docx-engine/math': resolve(here, '../../packages/docx-engine/src/math.ts'),
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
  // Main process/preload must bundle @lycero/* sources (they are pulled in as TS
  // source with extensionless relative imports; externalizing them under Node
  // yields ERR_MODULE_NOT_FOUND).
  main: {
    resolve: { alias: workspaceAlias },
    // Bundle opentype.js too (the packaged app ships only out/**, so external deps are unresolvable at runtime)
    plugins: [
      externalizeDepsPlugin({
        exclude: [...LYCERO_WORKSPACE_PACKAGES, 'opentype.js'],
      }),
    ],
  },
  preload: {
    // Sandboxed preload scripts cannot require arbitrary npm packages at
    // runtime — bundle all workspace and npm deps into preload.
    build: {
      externalizeDeps: false,
    },
  },
  renderer: {
    resolve: { alias: workspaceAlias },
    plugins: [react()],
    server: {
      port: Number(process.env.SLIDES_DEV_PORT) || 5175,
      strictPort: Boolean(process.env.SLIDES_DEV_PORT),
    },
  },
})
