/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Configures Git to use the tracked `.githooks` directory so every developer
 * who runs `npm install` or `npm run dev` gets automatic pre-commit and
 * pre-push secret scanning. Safe no-op in tarball / non-git environments.
 */

import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function main() {
  if (!existsSync(join(ROOT, '.git')) || !existsSync(join(ROOT, '.githooks'))) {
    return
  }
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
      cwd: ROOT,
      stdio: 'ignore',
    })
    for (const hook of ['pre-commit', 'pre-push']) {
      const p = join(ROOT, '.githooks', hook)
      if (existsSync(p)) {
        try {
          chmodSync(p, 0o755)
        } catch {
          /* Windows chmod is a no-op */
        }
      }
    }
  } catch {
    /* ignore if git binary is unavailable */
  }
}

main()
