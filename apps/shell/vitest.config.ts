import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@lycero/ai-auth/main': resolve(__dirname, '../../packages/ai-auth/src/lycero-auth.ts'),
      '@lycero/ai-auth': resolve(__dirname, '../../packages/ai-auth/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 20000,
  },
})
