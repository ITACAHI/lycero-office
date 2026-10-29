/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// resolve sibling source packages by path (not via node_modules), so a git
// worktree whose node_modules is linked to another checkout still tests
// against this checkout's edits (same convention as packages/pdf2docx)
const local = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@lycero/docx-engine/lazy-media': local('../../packages/docx-engine/src/lazy-media.ts'),
      '@lycero/docx-engine': local('../../packages/docx-engine/src/index.ts'),
      '@lycero/font-metrics/resolve': local('../../packages/font-metrics/src/resolve.ts'),
      '@lycero/font-metrics/word-faces.json': local(
        '../../packages/font-metrics/word-faces.json',
      ),
      '@lycero/font-metrics': local('../../packages/font-metrics/src/index.ts'),
      // subpath before the bare name: string aliases are prefix replacements
      '@lycero/electron-utils/headless-export': local(
        '../../packages/electron-utils/src/headless-export.ts',
      ),
      '@lycero/electron-utils/atomic-write': local(
        '../../packages/electron-utils/src/atomic-write.ts',
      ),
      '@lycero/electron-utils/safe-external-url': local(
        '../../packages/electron-utils/src/safe-external-url.ts',
      ),
      '@lycero/electron-utils/print-job': local(
        '../../packages/electron-utils/src/print-job.ts',
      ),
      '@lycero/electron-utils': local('../../packages/electron-utils/src/index.ts'),
      '@lycero/ai-provider/browser': local('../../packages/ai-provider/src/browser.ts'),
      '@lycero/ai-provider': local('../../packages/ai-provider/src/index.ts'),
      '@lycero/i18n': local('../../packages/i18n/src/index.ts'),
      '@lycero/ui': local('../../packages/ui/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // the engine's display-only `effective` keys stay out of saved-model toEqual
    setupFiles: [local('../../packages/docx-engine/tests/setup-equality.ts')],
    environment: 'jsdom',
    testTimeout: 20000,
  },
})
