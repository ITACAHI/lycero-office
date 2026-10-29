import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const slidesHarfbuzzDir = resolve(__dirname, '../slides/node_modules/harfbuzzjs')
const rootHarfbuzzDir = resolve(__dirname, '../../node_modules/harfbuzzjs')

const aiAuthAlias = {
  '@lycero/ai-auth/main': resolve(__dirname, '../../packages/ai-auth/src/lycero-auth.ts'),
  '@lycero/ai-auth': resolve(__dirname, '../../packages/ai-auth/src/index.ts'),
  '@lycero/pipelines/slides/layout-audit': resolve(
    __dirname,
    '../../packages/pipelines/src/slides/layout-audit.ts',
  ),
  '@lycero/pipelines/slides': resolve(__dirname, '../../packages/pipelines/src/slides/index.ts'),
  '../../../../node_modules/harfbuzzjs': existsSync(slidesHarfbuzzDir)
    ? slidesHarfbuzzDir
    : rootHarfbuzzDir,
}

export default defineConfig({
  main: {
    resolve: { alias: aiAuthAlias },
    build: {
      rollupOptions: {
        external: ['node:sqlite'],
      },
    },
  },
  preload: {
    resolve: { alias: aiAuthAlias },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          // dedicated preload for the auto-update window
          update: resolve(__dirname, 'src/preload/update.ts'),
          // dedicated preload for the PDF password prompt window
          'pdf-password': resolve(__dirname, 'src/preload/pdf-password.ts'),
        },
      },
    },
  },
  renderer: {
    resolve: { alias: aiAuthAlias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          // strong-guidance update window (see src/main/update-window.ts)
          update: resolve(__dirname, 'src/renderer/update.html'),
          // PDF password prompt window (see src/main/pdf-password-dialog.ts)
          'pdf-password': resolve(__dirname, 'src/renderer/pdf-password.html'),
        },
      },
    },
    server: {
      port: Number(process.env.SHELL_DEV_PORT) || 5199,
      strictPort: Boolean(process.env.SHELL_DEV_PORT),
    },
  },
})
