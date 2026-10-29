/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@lycero/pptx-engine/table-grid': resolve(here, '../pptx-engine/src/table-grid.ts'),
      '@lycero/pptx-engine/identity': resolve(here, '../pptx-engine/src/identity.ts'),
      '@lycero/pptx-engine/background-promote': resolve(
        here,
        '../pptx-engine/src/background-promote.ts',
      ),
      '@lycero/pptx-engine/custgeom': resolve(here, '../pptx-engine/src/custgeom.ts'),
      '@lycero/pptx-engine': resolve(here, '../pptx-engine/src/index.ts'),
      '@lycero/pptx-render/preset-geometry': resolve(
        here,
        '../pptx-render/src/preset-geometry.ts',
      ),
      '@lycero/pptx-render': resolve(here, '../pptx-render/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
