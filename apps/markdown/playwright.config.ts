/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { defineConfig } from '@playwright/test'

const port = Number(process.env.MARKDOWN_DEV_PORT) || 5177

/** Browser-only renderer coverage: it must not boot the Electron shell. */
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '*.spec.ts',
  outputDir: '../../test-results/markdown-roundtrip',
  timeout: 30_000,
  workers: 1,
  webServer: {
    command: 'npm run dev:renderer -w @lycero/markdown',
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
