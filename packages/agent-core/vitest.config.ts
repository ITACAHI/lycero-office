import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@lycero/ai-auth/main': resolve(__dirname, '../ai-auth/src/lycero-auth.ts'),
      '@lycero/ai-auth': resolve(__dirname, '../ai-auth/src/index.ts'),
      '@lycero/ai-search': resolve(__dirname, '../ai-search/src/index.ts'),
      '@lycero/ai-provider': resolve(__dirname, '../ai-provider/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
