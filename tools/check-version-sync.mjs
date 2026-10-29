/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const SEMVER_RE = /^\d+\.\d+\.\d+$/

export function compareSemver(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

export function discoverWorkspacePackageJsons(repoRoot = REPO_ROOT) {
  const results = []
  for (const group of ['apps', 'packages']) {
    const groupDir = join(repoRoot, group)
    if (!existsSync(groupDir)) continue
    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const rel = `${group}/${entry.name}/package.json`
      if (existsSync(join(repoRoot, rel))) {
        results.push({ rel, workspaceKey: `${group}/${entry.name}` })
      }
    }
  }
  return results.sort((a, b) => a.rel.localeCompare(b.rel))
}

export const CORE_SKILL_FILES = [
  'skills/lycero-office/SKILL.md',
  'skills/genoffice/SKILL.md',
  '.agents/skills/lycero-office/SKILL.md',
  '.claude/skills/lycero-office/SKILL.md',
]

export const CARGO_TOML_REL = 'apps/sheets/native/xlsx-engine/Cargo.toml'
export const CARGO_LOCK_REL = 'apps/sheets/native/xlsx-engine/Cargo.lock'
export const CLI_BUNDLE_REL = 'packages/cli/dist/lycero-office.cjs'

export function parseCargoTomlVersion(text) {
  const match = /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(text)
  return match ? match[1] : null
}

export function parseCargoLockSidecarVersion(text) {
  const match = /\[\[package\]\]\r?\nname\s*=\s*"xlsx-sidecar"\r?\nversion\s*=\s*"([^"]+)"/.exec(
    text,
  )
  return match ? match[1] : null
}

export function parseSkillFrontmatterVersion(text) {
  const fm = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!fm) return null
  const match = /^\s+version:\s*['"]?(\d+\.\d+\.\d+)['"]?\s*$/m.exec(fm[1])
  return match ? match[1] : null
}

export function parseCliBundleVersion(text) {
  const prefix = 'const __cliAppVersion = '
  const line = text.split(/\r?\n/).find((row) => row.startsWith(prefix))
  if (!line) return null
  try {
    const val = JSON.parse(line.slice(prefix.length).replace(/;\s*$/, ''))
    return typeof val === 'string' ? val : null
  } catch {
    return null
  }
}

export function verifyVersionSync(repoRoot = REPO_ROOT) {
  const mismatches = []
  const checked = []

  const rootPkgPath = join(repoRoot, 'package.json')
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
  const expected = rootPkg.version

  if (!expected || !SEMVER_RE.test(expected)) {
    mismatches.push(`package.json: invalid or missing semver version "${expected}"`)
    return { expected: expected || 'unknown', checked, mismatches }
  }
  checked.push(`package.json (${expected})`)

  // 1. All apps/*/package.json and packages/*/package.json
  const workspaces = discoverWorkspacePackageJsons(repoRoot)
  for (const { rel } of workspaces) {
    const pkg = JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'))
    checked.push(`${rel} (${pkg.version})`)
    if (pkg.version !== expected) {
      mismatches.push(`${rel}: version is "${pkg.version}", expected "${expected}"`)
    }
  }

  // 2. package-lock.json (root + packages[""] + all workspace entries)
  const lockPath = join(repoRoot, 'package-lock.json')
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
    checked.push(`package-lock.json (${lock.version})`)
    if (lock.version !== expected) {
      mismatches.push(
        `package-lock.json: root version is "${lock.version}", expected "${expected}"`,
      )
    }
    const rootEntryVer = lock.packages?.['']?.version
    if (rootEntryVer !== expected) {
      mismatches.push(
        `package-lock.json#packages[""]: version is "${rootEntryVer}", expected "${expected}"`,
      )
    }
    for (const { workspaceKey } of workspaces) {
      const entry = lock.packages?.[workspaceKey]
      if (!entry) {
        mismatches.push(`package-lock.json#packages["${workspaceKey}"]: missing workspace entry`)
      } else if (entry.version !== expected) {
        mismatches.push(
          `package-lock.json#packages["${workspaceKey}"]: version is "${entry.version}", expected "${expected}"`,
        )
      }
    }
  }

  // 3. Rust native sidecar Cargo.toml & Cargo.lock
  const cargoTomlPath = join(repoRoot, CARGO_TOML_REL)
  if (existsSync(cargoTomlPath)) {
    const cargoVer = parseCargoTomlVersion(readFileSync(cargoTomlPath, 'utf8'))
    checked.push(`${CARGO_TOML_REL} (${cargoVer})`)
    if (cargoVer !== expected) {
      mismatches.push(`${CARGO_TOML_REL}: version is "${cargoVer}", expected "${expected}"`)
    }
  }

  const cargoLockPath = join(repoRoot, CARGO_LOCK_REL)
  if (existsSync(cargoLockPath)) {
    const lockVer = parseCargoLockSidecarVersion(readFileSync(cargoLockPath, 'utf8'))
    checked.push(`${CARGO_LOCK_REL} (${lockVer})`)
    if (lockVer !== expected) {
      mismatches.push(
        `${CARGO_LOCK_REL} [xlsx-sidecar]: version is "${lockVer}", expected "${expected}"`,
      )
    }
  }

  // 4. Core Lycero Office SKILL.md manifests
  for (const rel of CORE_SKILL_FILES) {
    const full = join(repoRoot, rel)
    if (!existsSync(full)) continue
    const skillVer = parseSkillFrontmatterVersion(readFileSync(full, 'utf8'))
    checked.push(`${rel} (${skillVer})`)
    if (skillVer !== expected) {
      mismatches.push(`${rel}: metadata.version is "${skillVer}", expected "${expected}"`)
    }
  }

  // 5. Built CLI bundle (if present on disk)
  const cliBundlePath = join(repoRoot, CLI_BUNDLE_REL)
  if (existsSync(cliBundlePath)) {
    const cliVer = parseCliBundleVersion(readFileSync(cliBundlePath, 'utf8'))
    const expectedCli = process.env.LYCERO_APP_VERSION?.trim() || expected
    checked.push(`${CLI_BUNDLE_REL} (${cliVer})`)
    if (cliVer !== expectedCli) {
      mismatches.push(
        `${CLI_BUNDLE_REL}: __cliAppVersion is "${cliVer}", expected "${expectedCli}"`,
      )
    }
  }

  return { expected, checked, mismatches }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()

if (isMain) {
  const args = process.argv.slice(2)
  let requireBump = false
  let baseRef = 'HEAD'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--require-bump') {
      requireBump = true
    } else if (args[i] === '--base' && args[i + 1]) {
      baseRef = args[++i]
    }
  }

  const { expected, checked, mismatches } = verifyVersionSync(REPO_ROOT)

  if (requireBump && process.env.SKIP_VERSION_BUMP !== '1') {
    const prevShow = spawnSync('git', ['show', `${baseRef}:package.json`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    if (prevShow.status === 0) {
      try {
        const prevPkg = JSON.parse(prevShow.stdout)
        if (prevPkg.version && SEMVER_RE.test(prevPkg.version)) {
          if (compareSemver(expected, prevPkg.version) <= 0) {
            mismatches.push(
              `Version bump required: current version "${expected}" is not greater than ${baseRef} version "${prevPkg.version}". Run "npm run version:bump" first.`,
            )
          }
        }
      } catch {
        // ignore parse errors on historical baseRef
      }
    }
  }

  if (mismatches.length > 0) {
    console.error(`❌ Lockstep version check FAILED (${mismatches.length} issue(s)):`)
    for (const msg of mismatches) {
      console.error(`  - ${msg}`)
    }
    console.error(
      `\n💡 Run "npm run version:bump" (or "node tools/bump-version.mjs --sync") to synchronize all modules.`,
    )
    process.exit(1)
  }

  console.log(
    `✅ Lockstep version check passed: all ${checked.length} component manifests are synchronized at v${expected}.`,
  )
}
