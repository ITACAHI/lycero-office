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
      // Resolve sibling sources by path (not via node_modules) so a worktree
      // whose node_modules is linked to another checkout still tests local edits.
      '@lycero/pptx-engine/table-grid': resolve(here, '../pptx-engine/src/table-grid.ts'),
      '@lycero/pptx-engine/identity': resolve(here, '../pptx-engine/src/identity.ts'),
      '@lycero/pptx-engine/background-promote': resolve(
        here,
        '../pptx-engine/src/background-promote.ts',
      ),
      '@lycero/pptx-engine/chart-workbook': resolve(
        here,
        '../pptx-engine/src/chart-workbook.ts',
      ),
      '@lycero/pptx-engine': resolve(here, '../pptx-engine/src/index.ts'),
      '@lycero/docx-engine/math': resolve(here, '../docx-engine/src/math.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
