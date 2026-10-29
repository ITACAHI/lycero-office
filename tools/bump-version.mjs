/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  CARGO_LOCK_REL,
  CARGO_TOML_REL,
  CLI_BUNDLE_REL,
  CORE_SKILL_FILES,
  compareSemver,
  discoverWorkspacePackageJsons,
  verifyVersionSync,
} from './check-version-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const SEMVER_RE = /^\d+\.\d+\.\d+$/

export function computeNextVersion(current, target = 'patch') {
  if (!SEMVER_RE.test(current)) {
    throw new Error(`Invalid current version "${current}" (expected x.y.z)`)
  }
  if (target === '--sync' || target === 'sync') {
    return current
  }
  if (SEMVER_RE.test(target)) {
    return target
  }
  const [major, minor, patch] = current.split('.').map(Number)
  switch (target) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(
        `Invalid version bump target "${target}". Use patch | minor | major | sync | <x.y.z>`,
      )
  }
}

function updateJsonVersionFile(fullPath, newVersion) {
  const raw = readFileSync(fullPath, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const data = JSON.parse(raw)
  data.version = newVersion
  writeFileSync(fullPath, JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol, 'utf8')
}

export function bumpAllVersions(nextVersion, repoRoot = REPO_ROOT) {
  const touchedFiles = []

  // 1. Root package.json
  updateJsonVersionFile(join(repoRoot, 'package.json'), nextVersion)
  touchedFiles.push('package.json')

  // 2. All apps/*/package.json and packages/*/package.json
  const workspaces = discoverWorkspacePackageJsons(repoRoot)
  for (const { rel } of workspaces) {
    updateJsonVersionFile(join(repoRoot, rel), nextVersion)
    touchedFiles.push(rel)
  }

  // 3. package-lock.json
  const lockPath = join(repoRoot, 'package-lock.json')
  if (existsSync(lockPath)) {
    const raw = readFileSync(lockPath, 'utf8')
    const eol = raw.includes('\r\n') ? '\r\n' : '\n'
    const lock = JSON.parse(raw)
    lock.version = nextVersion
    if (lock.packages?.['']) {
      lock.packages[''].version = nextVersion
    }
    for (const { workspaceKey } of workspaces) {
      if (lock.packages?.[workspaceKey]) {
        lock.packages[workspaceKey].version = nextVersion
      }
    }
    writeFileSync(lockPath, JSON.stringify(lock, null, 2).replace(/\n/g, eol) + eol, 'utf8')
    touchedFiles.push('package-lock.json')
  }

  // 4. Rust sidecar Cargo.toml & Cargo.lock
  const cargoTomlPath = join(repoRoot, CARGO_TOML_REL)
  if (existsSync(cargoTomlPath)) {
    const raw = readFileSync(cargoTomlPath, 'utf8')
    const updated = raw.replace(
      /(^\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m,
      `$1${nextVersion}$3`,
    )
    writeFileSync(cargoTomlPath, updated, 'utf8')
    touchedFiles.push(CARGO_TOML_REL)
  }

  const cargoLockPath = join(repoRoot, CARGO_LOCK_REL)
  if (existsSync(cargoLockPath)) {
    const raw = readFileSync(cargoLockPath, 'utf8')
    const updated = raw.replace(
      /(\[\[package\]\]\r?\nname\s*=\s*"xlsx-sidecar"\r?\nversion\s*=\s*")([^"]+)(")/,
      `$1${nextVersion}$3`,
    )
    writeFileSync(cargoLockPath, updated, 'utf8')
    touchedFiles.push(CARGO_LOCK_REL)
  }

  // 5. Core Lycero Office SKILL.md files
  for (const rel of CORE_SKILL_FILES) {
    const full = join(repoRoot, rel)
    if (!existsSync(full)) continue
    const raw = readFileSync(full, 'utf8')
    const updated = raw.replace(
      /^(\uFEFF?---\r?\n[\s\S]*?^\s+version:\s*)(['"]?)(\d+\.\d+\.\d+)\2/m,
      `$1$2${nextVersion}$2`,
    )
    writeFileSync(full, updated, 'utf8')
    touchedFiles.push(rel)
  }

  // 6. Built CLI bundle (if present on disk, keep banner in sync immediately)
  const cliBundlePath = join(repoRoot, CLI_BUNDLE_REL)
  if (existsSync(cliBundlePath)) {
    const raw = readFileSync(cliBundlePath, 'utf8')
    const updated = raw.replace(
      /^const __cliAppVersion = "[^"]+";/m,
      `const __cliAppVersion = ${JSON.stringify(nextVersion)};`,
    )
    if (updated !== raw) {
      writeFileSync(cliBundlePath, updated, 'utf8')
    }
  }

  return touchedFiles
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()

if (isMain) {
  const rawArgs = process.argv.slice(2)
  let stageFiles = false
  let ifUnchanged = false
  let targetArg = 'patch'

  for (const arg of rawArgs) {
    if (arg === '--stage') {
      stageFiles = true
    } else if (arg === '--if-unchanged') {
      ifUnchanged = true
    } else if (arg === '--sync') {
      targetArg = 'sync'
    } else {
      targetArg = arg
    }
  }

  const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  const currentVersion = rootPkg.version

  if (ifUnchanged) {
    const headShow = spawnSync('git', ['show', 'HEAD:package.json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    if (headShow.status === 0) {
      try {
        const headPkg = JSON.parse(headShow.stdout)
        if (headPkg.version && SEMVER_RE.test(headPkg.version)) {
          if (compareSemver(currentVersion, headPkg.version) > 0) {
            // Already bumped relative to HEAD — just ensure all modules are synchronized
            targetArg = 'sync'
          }
        }
      } catch {
        // ignore
      }
    }
  }

  const nextVersion = computeNextVersion(currentVersion, targetArg)
  const touched = bumpAllVersions(nextVersion, REPO_ROOT)
  const { mismatches } = verifyVersionSync(REPO_ROOT)

  if (mismatches.length > 0) {
    console.error('❌ Version synchronization failed after update:')
    for (const m of mismatches) console.error(`  - ${m}`)
    process.exit(1)
  }

  if (stageFiles) {
    const stageable = touched.filter((rel) => {
      const checkIgnore = spawnSync('git', ['check-ignore', '-q', rel], { cwd: REPO_ROOT })
      return checkIgnore.status !== 0
    })
    const gitAdd = spawnSync('git', ['add', '--', ...stageable], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    })
    if (gitAdd.status !== 0) process.exit(gitAdd.status ?? 1)
  }

  const actionLabel =
    currentVersion === nextVersion
      ? `Synchronized all ${touched.length} manifests at v${nextVersion}`
      : `Bumped lockstep version v${currentVersion} -> v${nextVersion} across ${touched.length} manifests`
  console.log(`✅ ${actionLabel}`)
}
