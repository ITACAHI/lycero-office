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
  // Pin resolution to this repo's workspace sources: in a git worktree
  // node_modules links into the main checkout, so bare specifiers would test
  // against the other checkout's sources (matches tsconfig paths)
  resolve: {
    alias: {
      // Subpath before the bare name: string aliases are prefix replacements
      '@lycero/electron-utils/remote-image': resolve(
        here,
        '../electron-utils/src/remote-image.ts',
      ),
      '@lycero/electron-utils/safe-remote-url': resolve(
        here,
        '../electron-utils/src/safe-remote-url.ts',
      ),
      '@lycero/electron-utils/generated-images': resolve(
        here,
        '../electron-utils/src/generated-images.ts',
      ),
      '@lycero/ai-provider': resolve(here, '../ai-provider/src/index.ts'),
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
})
