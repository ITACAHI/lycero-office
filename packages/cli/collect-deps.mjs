// Copies the runtime dependencies the bundle leaves external (jsdom and its
// tree) into dist/node_modules, resolving every hop from its realpath so both
// pnpm (.pnpm virtual store symlinks) and npm hoisted/nested layouts yield the
// exact dependency versions each package requires, and nesting conflicting
// versions under their consumer's node_modules when needed.
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'dist', 'node_modules')
const EXTERNALS = ['jsdom']

function resolvePkgReal(name, fromDir) {
  let dir = realpathSync(fromDir)
  for (;;) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) {
      return realpathSync(candidate)
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Given a destination node_modules root (`out`) and a consumer's destination
 * directory inside `out` (`parentDest`, or null for top-level EXTERNALS),
 * find which `realDir` would currently be resolved for `name` by walking up
 * `node_modules` directories inside `out`.
 */
function findPlacedInAncestors(name, parentDest, placedByDest) {
  if (parentDest) {
    let cur = parentDest
    while (cur.startsWith(out) && cur.length > out.length) {
      const candidate = join(cur, 'node_modules', name)
      if (placedByDest.has(candidate)) return { dest: candidate, realDir: placedByDest.get(candidate) }
      const next = dirname(cur)
      if (next === cur) break
      cur = next
    }
  }
  const topCandidate = join(out, name)
  if (placedByDest.has(topCandidate)) {
    return { dest: topCandidate, realDir: placedByDest.get(topCandidate) }
  }
  return null
}

// destDir -> realDir
const placedByDest = new Map()
const walkedPairs = new Set()

function walk(name, fromRealDir, parentDest) {
  const realDir = resolvePkgReal(name, fromRealDir)
  if (!realDir) throw new Error(`genoffice deps: cannot resolve ${name} from ${fromRealDir}`)

  const existing = findPlacedInAncestors(name, parentDest, placedByDest)
  let destDir
  if (!existing) {
    destDir = join(out, name)
    placedByDest.set(destDir, realDir)
  } else if (existing.realDir === realDir) {
    destDir = existing.dest
  } else {
    destDir = parentDest ? join(parentDest, 'node_modules', name) : join(out, name)
    placedByDest.set(destDir, realDir)
  }

  const pairKey = `${destDir}::${realDir}`
  if (walkedPairs.has(pairKey)) return
  walkedPairs.add(pairKey)

  const pkg = JSON.parse(readFileSync(join(realDir, 'package.json'), 'utf8'))
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    walk(dep, realDir, destDir)
  }
  for (const dep of Object.keys(pkg.optionalDependencies ?? {})) {
    if (resolvePkgReal(dep, realDir)) {
      walk(dep, realDir, destDir)
    }
  }
}

for (const name of EXTERNALS) walk(name, here, null)

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
for (const [destDir, realDir] of placedByDest.entries()) {
  mkdirSync(dirname(destDir), { recursive: true })
  cpSync(realDir, destDir, {
    recursive: true,
    dereference: true,
    // nested node_modules are copied by their own closure entries
    filter: (src) => !relative(realDir, src).split(sep).includes('node_modules'),
  })
}
console.log(`genoffice deps: ${placedByDest.size} packages → ${relative(here, out)}`)
