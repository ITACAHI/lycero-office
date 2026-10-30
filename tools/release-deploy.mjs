/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

function run(cmd, args, label) {
  console.log(`\n▶ ${label}: ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32' && cmd === 'npm',
  })
  if (res.status !== 0) {
    console.error(`❌ Failed at step: ${label} (exit code ${res.status ?? 1})`)
    process.exit(res.status ?? 1)
  }
}

function parseArgs(argv) {
  let bump = 'patch'
  let message = ''
  let skipPush = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--no-push') {
      skipPush = true
    } else if (arg === '-m' || arg === '--message') {
      message = argv[++i] || ''
    } else if (arg === 'patch' || arg === 'minor' || arg === 'major' || arg === 'sync') {
      bump = arg
    }
  }
  return { bump, message, skipPush }
}

const { bump, message, skipPush } = parseArgs(process.argv.slice(2))

// 1. Bump lockstep version across all manifests
run(process.execPath, ['tools/bump-version.mjs', bump, '--stage'], 'Bump lockstep version')

// 2. Rebuild CLI bundle so __cliAppVersion matches the new version
run('npm', ['run', 'build', '-w', '@lycero/cli'], 'Rebuild CLI bundle')

// 3. Run version sync, public hygiene, and license checks
run(process.execPath, ['tools/check-version-sync.mjs'], 'Verify lockstep version sync (38 manifests)')
run(process.execPath, ['tools/check-public-hygiene.mjs'], 'Verify public-repo hygiene gate')
run(process.execPath, ['tools/check-licenses.mjs'], 'Verify production dependency licenses')

// 4. Read new version
const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
const version = pkg.version
const tag = `v${version}`
const commitMsg = message || `chore(release): publish ${tag}`

// 5. Stage all tracked changes, commit, and tag
run('git', ['add', '-u'], 'Stage tracked modifications')
run('git', ['commit', '-m', commitMsg], `Commit ${tag}`)
run('git', ['tag', '-a', tag, '-m', `Release ${tag}`], `Create annotated tag ${tag}`)

if (!skipPush) {
  // 6. Push branch & tag to both origin (GitLab) and github (Public GitHub)
  run('git', ['push', 'origin', 'public-main:main', '--force'], 'Push main branch to origin')
  run('git', ['push', 'origin', tag], `Push tag ${tag} to origin`)
  run('git', ['push', 'github', 'public-main:main', '--force'], 'Push main branch to github')
  run('git', ['push', 'github', tag], `Push tag ${tag} to github`)
  console.log(`\n✅ Successfully deployed ${tag} to origin and github!`)
  console.log(`   Monitor GitHub Actions: gh run list --repo ITACAHI/lycero-office --limit 3`)
} else {
  console.log(`\n✅ Prepared commit and tag ${tag} locally (--no-push set).`)
}
