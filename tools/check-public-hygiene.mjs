/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Public-repo hygiene & secret-prevention gate (`tools/check-public-hygiene.mjs`)
 *
 * Modes:
 *   - `node tools/check-public-hygiene.mjs`          : Scans all tracked files (CI & pre-push).
 *   - `node tools/check-public-hygiene.mjs --staged` : Scans only staged files (pre-commit hook).
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'

const stagedOnly = process.argv.includes('--staged')

const FORBIDDEN_FILE_PATTERNS = [
  {
    label: 'Code signing / TLS / Apple / GPG certificate or private key file',
    regex: /\.(?:pfx|p12|key|pem|cer|crt|der|jks|keystore|mobileprovision|asc|gpg)$/i,
  },
  {
    label: 'Committed .env or electron-builder.env secret file',
    regex: /(?:^|\/)(?:\.env(?:\.(?!example$)[^/]+)?|electron-builder\.env)$/i,
  },
]

const BINARY_EXTENSIONS =
  /\.(?:png|jpg|jpeg|gif|webp|ico|icns|emf|wmf|mp4|mp3|wav|ogg|webm|flac|m4a|ttf|otf|woff|woff2|doc|ppt|xls|docx|xlsx|pptx|pdf|odt|ods|odp|zip|gz|br|wasm|exe|dll|so|dylib|node|asar)$/i

const ALLOWED_TEST_FIXTURE_FILES = new Set([
  'packages/agent-core/tests/sanitize-payload.test.ts',
  'apps/markdown/tests/image-host.test.ts',
])

const CONTENT_RULES = [
  {
    label: 'Private key block (PEM / OpenSSH / PGP)',
    regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    label: 'Hardcoded API key, OAuth token, or Cloud credential',
    regex:
      /\b(?:sk-(?:proj-|live-|ant-)?[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|gho_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{22,}|lyo_[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]{16,})\b/,
  },
  {
    label: 'Hardcoded password or signing secret assignment',
    regex:
      /(?:LYCERO_WIN_(?:PROD_)?PFX_PASSWORD|CSC_KEY_PASSWORD|APPLE_APP_SPECIFIC_PASSWORD|SIGNPATH_API_TOKEN|AZURE_CLIENT_SECRET|LYCERO_JWT_SECRET)\s*[:=]\s*['"][^'"]{4,}['"]/,
  },
  {
    label: 'Hardcoded internal admin or signing credential',
    regex: /\b(?:LyceroAdmin2026!|LyceroCodeSign2026!|admin@lycero\.com)\b/,
  },
  {
    label: 'Internal production server IP or private Git host',
    regex: /\b(?:100\.121\.239\.39|git\.lycero\.com)\b/,
  },
  {
    label: 'Personal developer machine path',
    regex: /(?:[A-Za-z]:\\+Users\\+luv3b|\/Users\/luv3b)\b/,
  },
]

function getTargetFiles() {
  const args = stagedOnly
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '-z']
  const out = execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  return out.split('\0').filter(Boolean)
}

function main() {
  const files = getTargetFiles()
  if (files.length === 0) {
    console.log('Public-repo hygiene gate: 0 files to check.')
    return
  }

  const violations = []

  for (const file of files) {
    for (const rule of FORBIDDEN_FILE_PATTERNS) {
      if (rule.regex.test(file)) {
        violations.push(`${file}: forbidden file (${rule.label})`)
      }
    }

    if (BINARY_EXTENSIONS.test(file)) continue
    if (file === 'package-lock.json' || file === 'pnpm-lock.yaml') continue
    if (file === 'tools/check-public-hygiene.mjs') continue
    if (!existsSync(file)) continue

    let st
    try {
      st = statSync(file)
    } catch {
      continue
    }
    if (!st.isFile() || st.size > 4 * 1024 * 1024) continue

    const buf = readFileSync(file)
    if (buf.includes(0)) {
      violations.push(`${file}: contains NUL byte(s) in tracked text file`)
      continue
    }

    if (ALLOWED_TEST_FIXTURE_FILES.has(file)) continue

    const text = buf.toString('utf8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const rule of CONTENT_RULES) {
        const m = line.match(rule.regex)
        if (m) {
          violations.push(`${file}:${i + 1}: ${rule.label} (${JSON.stringify(m[0].slice(0, 48))})`)
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n[BLOCKED] Public-repo hygiene gate failed (${violations.length} finding(s)):\n`,
    )
    for (const v of violations) {
      console.error(`  ✗ ${v}`)
    }
    console.error(
      '\nMove secrets/keys to environment variables or GitHub Encrypted Secrets before committing/pushing.',
    )
    process.exit(1)
  }

  console.log(
    `Public-repo hygiene gate passed (${files.length} ${stagedOnly ? 'staged' : 'tracked'} file(s) scanned).`,
  )
}

main()
