#!/usr/bin/env node
/**
 * Lycero Office Desktop - License Header Audit
 *
 * Quet tat ca file ma nguon de dam bao:
 *  1. Moi file .ts / .tsx / .js / .mjs / .css deu co copyright header
 *     theo Apache-2.0 Section 4(b)(c) - giu Mainfunc goc + them ITAC.
 *  2. Khong co chuoi "GENSPARK_API_KEY" / "gsk-" (secrets) sot lai.
 *
 * File moi do Lycero viet hoan toan (khong ke thua GenOffice) se chi
 * co header 1 lop ITAC; file ke thua se co header 2 lop.
 *
 * Thoat ma 0 neu pass; 1 neu fail.
 */

import { readFileSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(process.cwd())

// Chi check cac secrets chinh xac, khong check 'lycero-office' / 'genspark' vi
// ten CLI ngoai va nhieu CSS class noi bo van dung tu do (breaking change
// neu doi). Gsk- la IPC channel name prefix, khong phai secret.
const FORBIDDEN_SECRETS = ['GENSPARK_API_KEY', 'GSK_API_KEY']

const ACCEPTED_HEADERS = [
  'Copyright © 2026 Mainfunc, Inc.',
  'Copyright © 2026 ITAC AI Heavy Industries',
  'Copyright 2026 Mainfunc, Inc.',
  'Copyright 2026 ITAC AI Heavy Industries',
  'Copyright (c) 2026 Mainfunc, Inc.',
  'Copyright (c) 2026 ITAC AI Heavy Industries',
]

const SCAN_GLOBS = [
  'apps/*/src/**/*.ts',
  'apps/*/src/**/*.tsx',
  'apps/*/src/**/*.js',
  'apps/*/src/**/*.mjs',
  'apps/*/src/**/*.cjs',
  'apps/*/src/**/*.css',
  'apps/*/tests/**/*.ts',
  'apps/*/tests/**/*.tsx',
  'apps/*/tests/**/*.js',
  'apps/*/tests/**/*.mjs',
  'packages/*/src/**/*.ts',
  'packages/*/src/**/*.tsx',
  'packages/*/src/**/*.js',
  'packages/*/src/**/*.mjs',
  'packages/*/src/**/*.cjs',
  'packages/*/src/**/*.css',
  'packages/*/tests/**/*.ts',
  'packages/*/tests/**/*.tsx',
  'packages/*/tests/**/*.js',
  'packages/*/tests/**/*.mjs',
  'scripts/**/*.js',
  'scripts/**/*.mjs',
  'scripts/**/*.cjs',
  'scripts/*.js',
  'scripts/*.mjs',
  'scripts/*.cjs',
  'tools/**/*.js',
  'tools/**/*.mjs',
  'tools/*.js',
  'tools/*.mjs',
]

let fail = 0
let headerMissing = 0

const files = []
for (const pattern of SCAN_GLOBS) {
  for await (const file of glob(pattern, { cwd: ROOT })) {
    files.push(file)
  }
}

console.log(`[Lycero license-audit] Quet ${files.length} file...`)

const THIS_FILE = 'scripts/verify-license-headers.mjs'
// These files legitimately contain GSK_API_KEY as variable/config names:
// - packages/ai-search/src/gsk.ts         : GskAuth provider (LyceroGateway)
// - apps/shell/tests/cloud-projects.test.ts: test fixture
// - packages/ai-search/tests/lycero-office-auth.test.ts: test fixture
// - scripts/verify-license-headers.mjs    : audit tool that mentions the string
const WHITELIST_SECRETS_FILES = new Set([
  THIS_FILE,
  'packages/ai-search/src/gsk.ts',
  'packages/ai-search/src/index.ts',
  'apps/shell/tests/cloud-projects.test.ts',
  'packages/ai-search/tests/lycero-office-auth.test.ts',
  'packages/ai-search/tests/lycero-auth.test.ts',
  'packages/ai-search/tests/genoffice-auth.test.ts',
  'packages/ai-search/tests/gsk-reauth.test.ts',
])

for (const rel of files) {
  const abs = path.join(ROOT, rel)
  let content
  try {
    content = readFileSync(abs, 'utf8')
  } catch (err) {
    console.error(`  X Khong doc duoc: ${rel} - ${err.message}`)
    fail++
    continue
  }

  if (rel.includes('node_modules') || rel.startsWith('release/')) continue

  const ext = path.extname(rel)

  // 1. Check copyright header cho moi source file (ke ca .css)
  if (['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css'].includes(ext)) {
    const hasHeader = ACCEPTED_HEADERS.some(h => content.includes(h))
    if (!hasHeader) {
      console.error(`  X Thieu copyright header: ${rel}`)
      headerMissing++
      fail++
    }
  }

  // 2. Check secrets (skip whitelisted files)
  if (!WHITELIST_SECRETS_FILES.has(rel.replace(/\\/g, '/'))) {
    for (const term of FORBIDDEN_SECRETS) {
      if (content.includes(term)) {
        console.error(`  X Phat hien chuoi cam "${term}" trong: ${rel}`)
        fail++
      }
    }
  }
}

if (fail === 0) {
  console.log(`[Lycero license-audit] OK - ${files.length} file dat chuan.`)
  process.exit(0)
} else {
  console.error(`[Lycero license-audit] FAIL - ${fail} van de (${headerMissing} thieu header).`)
  process.exit(1)
}

