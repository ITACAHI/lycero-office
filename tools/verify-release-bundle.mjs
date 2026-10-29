#!/usr/bin/env node
/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Pre-release & post-build bundle integrity verifier.
 * Prevents white-screen module load crashes and broken auto-update relaunches by verifying:
 *   1. All 7 apps (shell, docs, sheets, slides, pdf, markdown, html) have complete out/ trees
 *      and every <script>/<link> asset referenced by out/renderer/*.html exists on disk.
 *   2. Zero external npm/workspace require() calls in any out/preload/*.js bundle
 *      (sandboxed preload can only require "electron" and node builtins).
 *   3. Zero unbundled @lycero/* workspace requires in any out/main/*.js bundle.
 *   4. Zero unguarded process.env.<VAR> references in renderer bundles (out/renderer/assets/*.js).
 *   5. Single @univerjs/* version in apps/sheets renderer bundle (no ThemeService2 / LifecycleService2 collisions).
 *   6. Content-Security-Policy connect-src allows https://lycero.com in all editor index.html files.
 *   7. Auto-update relaunch hooks (apps/shell/build/installer.nsh + markInstallingUpdate in updater.ts) are intact.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPS = ['shell', 'docs', 'sheets', 'slides', 'pdf', 'markdown', 'html']
const NODE_BUILTINS = new Set([
  'electron',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
])

const errors = []

function fail(msg) {
  errors.push(msg)
}

function listJsFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listJsFiles(full))
    else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.cjs'))) {
      out.push(full)
    }
  }
  return out
}

function extractRequireSpecifiers(code) {
  const specs = new Set()
  const re = /\brequire\(\s*["']([^"']+)["']\s*\)/g
  let m
  while ((m = re.exec(code)) !== null) {
    specs.add(m[1])
  }
  return [...specs]
}

// 1. Check all 7 app out/ trees and HTML asset integrity
for (const app of APPS) {
  const outDir = join(ROOT, 'apps', app, 'out')
  const mainJs = join(outDir, 'main', 'index.js')
  const preloadJs = join(outDir, 'preload', 'index.js')
  const rendererHtml = join(outDir, 'renderer', 'index.html')

  for (const [label, filePath] of [
    ['main/index.js', mainJs],
    ['preload/index.js', preloadJs],
    ['renderer/index.html', rendererHtml],
  ]) {
    if (!existsSync(filePath)) {
      fail(`[${app}] Missing build output: apps/${app}/out/${label}`)
    } else if (statSync(filePath).size === 0) {
      fail(`[${app}] Empty build output (0 bytes): apps/${app}/out/${label}`)
    }
  }

  if (existsSync(rendererHtml)) {
    const html = readFileSync(rendererHtml, 'utf8')
    const assetRefs = [
      ...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g),
      ...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g),
    ].map((m) => m[1])

    if (assetRefs.length === 0) {
      fail(`[${app}] out/renderer/index.html has no <script src> or stylesheet <link> tags`)
    }
    for (const ref of assetRefs) {
      if (/^(https?:|data:|blob:)/.test(ref)) continue
      const assetPath = resolve(join(outDir, 'renderer'), ref.replace(/^\//, './'))
      if (!existsSync(assetPath)) {
        fail(
          `[${app}] out/renderer/index.html references missing asset "${ref}" (expected ${assetPath})`,
        )
      }
    }
  }

  // 2. Check preload bundles: zero external npm/workspace requires allowed
  for (const preloadFile of listJsFiles(join(outDir, 'preload'))) {
    const code = readFileSync(preloadFile, 'utf8')
    for (const spec of extractRequireSpecifiers(code)) {
      if (spec.startsWith('./') || spec.startsWith('../')) continue
      if (NODE_BUILTINS.has(spec) || spec.startsWith('electron/')) continue
      fail(
        `[${app}] Preload bundle "${preloadFile}" contains external require("${spec}"). ` +
          'Sandboxed preload scripts cannot resolve npm or @lycero/* packages at runtime (causes white screen on file open). ' +
          'Ensure preload.build.externalizeDeps is false in electron.vite.config.ts.',
      )
    }
  }

  // 3. Check main bundles: zero unbundled @lycero/* workspace requires allowed, and no legacy genoffice-app scheme
  for (const mainFile of listJsFiles(join(outDir, 'main'))) {
    const code = readFileSync(mainFile, 'utf8')
    if (code.includes('genoffice-app') || code.includes('genoffice-docx-media')) {
      fail(
        `[${app}] Main bundle "${mainFile}" still references legacy scheme "genoffice-app" / "genoffice-docx-media" instead of "lycero-app" / "lycero-docx-media".`,
      )
    }
    for (const spec of extractRequireSpecifiers(code)) {
      if (spec.startsWith('@lycero/')) {
        fail(
          `[${app}] Main bundle "${mainFile}" contains unbundled workspace require("${spec}"). ` +
            'Add all @lycero/* packages to externalizeDepsPlugin exclude in electron.vite.config.ts.',
        )
      }
    }
  }

  // 4. Check renderer bundles for unguarded process.env.<VAR>
  for (const rendererFile of listJsFiles(join(outDir, 'renderer', 'assets'))) {
    const code = readFileSync(rendererFile, 'utf8')
    const envRe = /process\.env\.([A-Z0-9_]+)/g
    let m
    while ((m = envRe.exec(code)) !== null) {
      const varName = m[1]
      if (varName === 'NODE_ENV') continue
      const prefix = code.slice(Math.max(0, m.index - 120), m.index)
      if (!prefix.includes('typeof process')) {
        fail(
          `[${app}] Renderer bundle "${rendererFile}" has unguarded process.env.${varName}, ` +
            'which throws ReferenceError: process is not defined in Chromium renderer.',
        )
      }
    }
  }

  // 6. Check renderer source index.html CSP connect-src allows https://lycero.com
  const srcHtmlPath = join(ROOT, 'apps', app, 'src', 'renderer', 'index.html')
  if (existsSync(srcHtmlPath)) {
    const srcHtml = readFileSync(srcHtmlPath, 'utf8')
    if (srcHtml.includes('connect-src') && !srcHtml.includes('https://lycero.com')) {
      fail(
        `[${app}] apps/${app}/src/renderer/index.html CSP connect-src is missing "https://lycero.com"`,
      )
    }
  }
}

// 5. Check apps/sheets for duplicate @univerjs/* versions or nested copies
const nestedUniverDir = join(ROOT, 'apps', 'sheets', 'node_modules', '@univerjs')
if (existsSync(nestedUniverDir)) {
  fail(
    `[sheets] Nested duplicate directory apps/sheets/node_modules/@univerjs detected. ` +
      'All @univerjs/* packages must hoist to a single version in root node_modules.',
  )
}
const rootUniverDir = join(ROOT, 'node_modules', '@univerjs')
if (existsSync(rootUniverDir)) {
  const univerVersions = new Map()
  for (const pkgName of readdirSync(rootUniverDir)) {
    if (pkgName === 'icons') continue
    const pkgJsonPath = join(rootUniverDir, pkgName, 'package.json')
    if (existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
      univerVersions.set(pkgName, pkg.version)
    }
  }
  const distinctVersions = new Set(univerVersions.values())
  if (distinctVersions.size > 1) {
    fail(
      `[sheets] Mixed @univerjs/* versions in node_modules: ${[...distinctVersions].join(', ')}. ` +
        'All @univerjs/* packages must share the exact same version.',
    )
  }
}

// 7. Check auto-update relaunch hooks (NSIS installer.nsh + updater.ts close-guard bypass)
const installerNshPath = join(ROOT, 'apps', 'shell', 'build', 'installer.nsh')
if (!existsSync(installerNshPath)) {
  fail('[shell] Missing apps/shell/build/installer.nsh for NSIS auto-update relaunch')
} else {
  const nsh = readFileSync(installerNshPath, 'utf8')
  if (!nsh.includes('StrCpy $launchLink "$appExe"')) {
    fail('[shell] apps/shell/build/installer.nsh is missing StrCpy $launchLink "$appExe"')
  }
  if (!nsh.includes('!macro customInstall') || !nsh.includes('UAC_AsUser_ExecShell')) {
    fail('[shell] apps/shell/build/installer.nsh is missing !macro customInstall / UAC_AsUser_ExecShell relaunch hook')
  }
  if (/^\s*Function\s+/m.test(nsh)) {
    fail('[shell] apps/shell/build/installer.nsh must not contain top-level Function blocks outside !macro (included before LogicLib.nsh)')
  }
}

const builderCfgPath = join(ROOT, 'apps', 'shell', 'electron-builder.cjs')
if (existsSync(builderCfgPath)) {
  const builderCfg = readFileSync(builderCfgPath, 'utf8')
  if (!builderCfg.includes("include: 'build/installer.nsh'")) {
    fail('[shell] apps/shell/electron-builder.cjs nsis block is missing include: "build/installer.nsh"')
  }
}

const updaterTsPath = join(ROOT, 'apps', 'shell', 'src', 'main', 'updater.ts')
if (existsSync(updaterTsPath)) {
  const updaterTs = readFileSync(updaterTsPath, 'utf8')
  if (!updaterTs.includes('markInstallingUpdate()')) {
    fail(
      '[shell] apps/shell/src/main/updater.ts is missing markInstallingUpdate() before quitAndInstall',
    )
  }
}

if (errors.length > 0) {
  console.error('\n❌ Release bundle verification FAILED with ' + errors.length + ' error(s):')
  for (const err of errors) {
    console.error('  - ' + err)
  }
  process.exit(1)
}

console.log(
  '✅ Release bundle verification passed (7 apps, preload/main/renderer bundles, CSP, Univer dedupe, and NSIS updater relaunch hooks verified).',
)
