/**
 * electron-builder configuration (moved out of package.json "build" so the
 * auto-update feed URL can be injected at build time instead of living in
 * the repo).
 *
 * LYCERO_UPDATE_URL — public base URL of the update channel (the generic
 * provider prefix that serves latest.yml / latest-mac.yml). Required for
 * release builds; CI provides it as a repository secret. For local release
 * builds put it in apps/shell/electron-builder.env (gitignored) — the
 * electron-builder CLI loads that file automatically.
 *
 * When the variable is unset (forks, PR smoke builds, plain local packaging)
 * the publish config is omitted: electron-builder then bakes no
 * app-update.yml into the app and in-app auto-update stays disabled.
 *
 * LYCERO_GA4_MEASUREMENT_ID / LYCERO_GA4_API_SECRET — GA4 Measurement
 * Protocol credentials for anonymous usage analytics, injected the same way
 * (CI secrets, or apps/shell/electron-builder.env locally). They are written
 * into the packaged app's package.json via extraMetadata and read back by
 * src/main/analytics.ts. When either is unset — every source/fork build —
 * nothing is injected and the app runs with analytics fully disabled.
 *
 * LYCERO_FONT_CDN_URL — base URL for the curated downloadable-font catalog.
 * Official release jobs inject it through extraMetadata so the endpoint stays
 * out of source. Without it, font download prompts/catalog entries are hidden;
 * users can still install local font files.
 */

const { execFileSync } = require('node:child_process')
const { existsSync, rmSync } = require('node:fs')
const { join } = require('node:path')

function normalizeHttpsBaseUrl(name, value) {
  if (!value || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('invalid')
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    throw new Error(`${name} must be an HTTPS base URL without credentials, query, or fragment`)
  }
}

const updateUrl =
  process.env.LYCERO_UPDATE_URL || 'https://lycero.com/api/v1/office/updates'
const ga4MeasurementId = process.env.LYCERO_GA4_MEASUREMENT_ID
const ga4ApiSecret = process.env.LYCERO_GA4_API_SECRET
const fontCdnUrl = normalizeHttpsBaseUrl(
  'LYCERO_FONT_CDN_URL',
  process.env.LYCERO_FONT_CDN_URL,
)

// LYCERO_MAC_X64=1 — opt into packaging the Intel (x64) dmg/zip alongside
// arm64. Off by default: Intel packages must only ever ship signed with the
// company certificate (planned dual-track pipeline), so the current release
// pipeline stays arm64-only and never produces a personally-signed Intel
// artifact. The downstream layout (feed archive name, LyceroOffice-intel.dmg
// alias) keys off which dmgs exist, so flipping this flag is the single
// switch.
const includeMacX64 = process.env.LYCERO_MAC_X64 === '1'
if (process.env.CSC_LINK !== undefined && !process.env.CSC_LINK.trim()) {
  delete process.env.CSC_LINK
}
if (process.env.CSC_KEY_PASSWORD !== undefined && !process.env.CSC_KEY_PASSWORD.trim()) {
  delete process.env.CSC_KEY_PASSWORD
}
const hasAppleSignIdentity = Boolean(
  (process.env.CSC_LINK && process.env.CSC_LINK.trim()) ||
    (process.env.CSC_NAME && process.env.CSC_NAME.trim()),
)
if (!hasAppleSignIdentity) {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
}
const hasAppleNotarizeCreds = Boolean(
  (process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID) ||
    process.env.APPLE_KEYCHAIN_PROFILE,
)

// LYCERO_WIN_ARM64=1 — package the Windows ARM64 installer instead of x64.
// CI runs it as a second electron-builder pass (own BUILD_DIR) after the
// unchanged x64 pass, so the two never share an output dir or a sidecar path:
// the sidecar comes from the matching cargo target dir and is checked to
// exist at beforePack because electron-builder exits 0 on a missing
// extraResources source (Sheets would ship dead on every ARM install).
const winArm64 = process.env.LYCERO_WIN_ARM64 === '1'
// 7-Zip packs ARM64 executables with its ARM64 branch filter, which the NSIS
// install-time extractor (Nsis7z) cannot decode: it silently skips
// LyceroOffice.exe and every dll (electron-builder#9983). BCJ it can decode.
if (winArm64 && !process.env.ELECTRON_BUILDER_7Z_FILTER) {
  process.env.ELECTRON_BUILDER_7Z_FILTER = 'BCJ'
}
const winArch = winArm64 ? 'arm64' : 'x64'
const winSidecarTarget = winArm64 ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-gnu'
const winSidecarCandidates = [
  `../sheets/native/xlsx-engine/target/${winSidecarTarget}/release/xlsx-sidecar.exe`,
  '../sheets/native/xlsx-engine/target/release/xlsx-sidecar.exe',
]
const WIN_SIDECAR =
  winSidecarCandidates.find((rel) => existsSync(join(__dirname, rel))) ?? winSidecarCandidates[0]

// LICENSES.chromium.html only exists after the Electron binary download —
// since Electron 42 that no longer happens during `npm ci` (the postinstall
// script was replaced by the lazy `install-electron` bin), and electron-builder
// exits 0 on a missing extraResources source, so without this check the
// installer would silently ship without the Chromium license.
for (const rel of [
  '../../node_modules/electron/dist/LICENSES.chromium.html',
  '../../node_modules/@embedpdf/pdfium/dist/pdfium.wasm',
  '../pdf/node_modules/harfbuzzjs/hb-subset.wasm',
]) {
  if (!existsSync(join(__dirname, rel))) {
    throw new Error(
      `electron-builder extraResources source missing: ${rel} (npm hoisting changed?)`,
    )
  }
}

// macOS local-OCR helper (scanned-page text recovery): a swiftc output, not
// an npm artifact — compiled here on demand so CI runners and fresh checkouts
// need no manual step. Universal (arm64 + x86_64) when both targets compile,
// host-arch otherwise; mac installers must not silently ship without it.
const VISION_OCR_HELPER = '../../packages/pdf2docx/ocr-helper/vision-ocr'

// Compile the helper. universalOnly=true has NO host-arch fallback: dual-arch
// packaging must fail loudly rather than ship a host-arch binary to both dmgs.
function compileVisionOcr({ universalOnly } = { universalOnly: false }) {
  const src = join(__dirname, `${VISION_OCR_HELPER}.swift`)
  const out = join(__dirname, VISION_OCR_HELPER)
  try {
    try {
      const slices = ['arm64', 'x86_64'].map((arch) => {
        const slice = `${out}.${arch}`
        execFileSync('swiftc', ['-O', src, '-target', `${arch}-apple-macos12`, '-o', slice], {
          stdio: 'inherit',
        })
        return slice
      })
      execFileSync('lipo', ['-create', ...slices, '-output', out], { stdio: 'inherit' })
      for (const slice of slices) rmSync(slice, { force: true })
    } catch (err) {
      if (universalOnly) throw err
      // cross-target SDK unavailable — a host-arch helper still serves this build
      execFileSync('swiftc', ['-O', src, '-o', out], { stdio: 'inherit' })
    }
  } catch (err) {
    throw new Error(`vision-ocr helper compile failed: ${err}`, { cause: err })
  }
}

if (process.platform === 'darwin' && !existsSync(join(__dirname, VISION_OCR_HELPER))) {
  compileVisionOcr()
}

// Windows local-OCR helper (Windows.Media.Ocr): compiled by the in-box .NET
// Framework csc via build-win.mjs — same on-demand policy as the mac helper,
// and Windows installers must not silently ship without it.
const WIN_OCR_HELPER = '../../packages/pdf2docx/ocr-helper/win-ocr.exe'
if (process.platform === 'win32' && !existsSync(join(__dirname, WIN_OCR_HELPER))) {
  try {
    execFileSync(
      process.execPath,
      [join(__dirname, '../../packages/pdf2docx/ocr-helper/build-win.mjs')],
      { stdio: 'inherit' },
    )
  } catch (err) {
    throw new Error(`win-ocr helper compile failed: ${err}`, { cause: err })
  }
}

// Dual-arch packs share one extraResources path, so the shipped helper must be
// a lipo fat binary. A stale host-arch build (dev path above) is rebuilt in
// place; if a universal build cannot be produced, packaging aborts — otherwise
// the other arch's OCR silently fails and every scanned page ships as bitmap.
function assertUniversalVisionOcr() {
  const helper = join(__dirname, VISION_OCR_HELPER)
  const wanted = ['x86_64', 'arm64']
  const archsOf = () =>
    existsSync(helper)
      ? execFileSync('lipo', ['-archs', helper], { encoding: 'utf8' }).trim().split(/\s+/)
      : []
  if (!wanted.every((w) => archsOf().includes(w))) {
    rmSync(helper, { force: true })
    compileVisionOcr({ universalOnly: true })
  }
  const archs = archsOf()
  for (const want of wanted) {
    if (!archs.includes(want)) {
      throw new Error(
        `vision-ocr helper is [${archs.join(', ')}] but both mac arch packages ship it`,
      )
    }
  }
}

// The module trees are electron-vite outputs produced by build:all; a missing
// one means that module's build did not run or failed. electron-builder only
// logs "file source doesn't exist" for an absent extraResources source and
// still exits 0, so without this the installer launches normally and is simply
// missing that editor — it surfaces only when a user opens the tab.
//
// Runs from the beforePack hook, not at module load: gen-third-party-notices
// requires this config to read extraResources, and the dist:* scripts run
// notices before build:all, when the out dirs legitimately don't exist yet.
// When the mac build packages BOTH arches (LYCERO_MAC_X64=1) its
// extraResources entry is a single path shared by the two packs, so the
// sidecar there must be a lipo fat binary — a host-arch-only build (the plain
// `native:build` dev path) would silently ship an arm64 sidecar inside the
// Intel dmg, where every workbook open fails. Runs from beforePack, dual-arch
// mac packs only.
function assertUniversalSidecar() {
  const sidecar = join(__dirname, '../sheets/native/xlsx-engine/target/release/xlsx-sidecar')
  if (!existsSync(sidecar)) {
    throw new Error(
      `mac extraResources source missing: ${sidecar} (run "npm run native:build:universal -w @lycero/sheets" first)`,
    )
  }
  const archs = execFileSync('lipo', ['-archs', sidecar], { encoding: 'utf8' }).trim().split(/\s+/)
  for (const want of ['x86_64', 'arm64']) {
    if (!archs.includes(want)) {
      throw new Error(
        `xlsx-sidecar is [${archs.join(', ')}] but both mac arch packages ship it — ` +
          'run "npm run native:build:universal -w @lycero/sheets" before packaging mac',
      )
    }
  }
}

function assertModuleTreesPresent() {
  for (const rel of [
    '../docs/out',
    '../sheets/out',
    '../slides/out',
    '../pdf/out',
    '../markdown/out',
    '../html/out',
    '../../packages/cli/dist/lycero-office.cjs',
    '../../packages/cli/dist/node_modules/jsdom',
  ]) {
    if (!existsSync(join(__dirname, rel))) {
      throw new Error(
        `electron-builder extraResources source missing: ${rel} (run npm run build:all first)`,
      )
    }
  }
}

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'vn.itac.lycero.office',
  productName: 'Lycero Office',
  icon: 'build-resources',
  // Resolved from the installed electron package so dependency bumps can
  // never leave a stale hard-coded pin behind (packaging would silently ship
  // the old runtime).
  electronVersion: require('electron/package.json').version,
  directories: {
    output: process.env.BUILD_DIR || 'release',
  },
  files: ['out/**'],
  extraResources: [
    {
      from: 'build/THIRD-PARTY-NOTICES.txt',
      to: 'THIRD-PARTY-NOTICES.txt',
    },
    {
      from: '../../node_modules/electron/dist/LICENSES.chromium.html',
      to: 'LICENSES.chromium.html',
    },
    {
      from: '../docs/out',
      to: 'modules/docs',
    },
    {
      from: '../sheets/out',
      to: 'modules/sheets',
    },
    {
      from: '../slides/out',
      to: 'modules/slides',
    },
    {
      from: '../pdf/out',
      to: 'modules/pdf',
    },
    {
      from: '../markdown/out',
      to: 'modules/markdown',
    },
    {
      from: '../html/out',
      to: 'modules/html',
    },
    // PDF text editing engines: the bundled main resolves these under
    // Resources/wasm when node_modules is absent (apps/pdf/src/main/wasm-path.ts)
    {
      from: '../../node_modules/@embedpdf/pdfium/dist/pdfium.wasm',
      to: 'wasm/pdfium.wasm',
    },
    {
      from: '../pdf/node_modules/harfbuzzjs/hb-subset.wasm',
      to: 'wasm/hb-subset.wasm',
    },
    // platform system-OCR helpers for scanned-page recovery (each exists only
    // on its own build platform; electron-builder skips absent sources and the
    // engine resolver degrades to the bitmap fallback when missing)
    {
      from: '../../packages/pdf2docx/ocr-helper/vision-ocr',
      to: 'ocr/vision-ocr',
    },
    {
      from: '../../packages/pdf2docx/ocr-helper/win-ocr.exe',
      to: 'ocr/win-ocr.exe',
    },
    // lycero-office command line: runs on the app binary with ELECTRON_RUN_AS_NODE,
    // so the RunAsNode fuse must stay enabled.
    // Layout (Resources/cli next to wasm/, native/, ocr/) is what
    // packages/cli/src/resources.ts expects.
    {
      from: '../../packages/cli/dist/lycero-office.cjs',
      to: 'cli/lycero-office.cjs',
    },
    {
      from: '../../packages/cli/bin/lycero-office',
      to: 'cli/lycero-office',
    },
    {
      from: '../../packages/cli/bin/lycero-office.cmd',
      to: 'cli/lycero-office.cmd',
    },
    // the CLI's version (Settings → Integrations shows it) and the agent skill
    // the same pane installs into Claude Code / Codex / …; bytes identical to the repo file
    {
      from: '../../packages/cli/package.json',
      to: 'cli/package.json',
    },
    {
      from: '../../skills/lycero-office/SKILL.md',
      to: 'cli/skills/lycero-office/SKILL.md',
    },
    {
      from: '../../skills/recommended',
      to: 'cli/skills/recommended',
    },
    {
      from: '../../LICENSE',
      to: 'LICENSE',
    },
    {
      from: '../../NOTICE',
      to: 'NOTICE',
    },
    // runtime deps the lycero-office bundle leaves external (jsdom for the Word/Markdown
    // paths); collected by packages/cli/collect-deps.mjs during its build
    {
      from: '../../packages/cli/dist/node_modules',
      to: 'cli/node_modules',
    },
  ],
  // `mimeType` is read only by the Linux target, where it becomes the
  // desktop entry's MimeType= list; associations without it are dropped
  // there. macOS and Windows ignore the field and key off `ext`.
  fileAssociations: [
    {
      ext: 'docx',
      name: 'Word Document',
      description: 'Word Document',
      role: 'Editor',
      icon: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    {
      ext: 'xlsx',
      name: 'Excel Workbook',
      description: 'Excel Workbook',
      role: 'Editor',
      icon: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    {
      ext: 'xlsm',
      name: 'Excel Macro-Enabled Workbook',
      role: 'Editor',
      icon: 'xlsx',
      mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    },
    {
      ext: 'pptx',
      name: 'PowerPoint Presentation',
      description: 'PowerPoint Presentation',
      role: 'Editor',
      icon: 'pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    },
    {
      ext: 'xls',
      name: 'Excel 97-2003 Workbook',
      role: 'Editor',
      icon: 'xlsx',
      mimeType: 'application/vnd.ms-excel',
    },
    {
      ext: 'csv',
      name: 'CSV Document',
      role: 'Editor',
      icon: 'xlsx',
      mimeType: 'text/csv',
    },
    {
      ext: 'tsv',
      name: 'TSV Document',
      role: 'Editor',
      icon: 'xlsx',
      mimeType: 'text/tab-separated-values',
    },
    {
      ext: 'ods',
      name: 'OpenDocument Spreadsheet',
      role: 'Editor',
      icon: 'xlsx',
      mimeType: 'application/vnd.oasis.opendocument.spreadsheet',
    },
    {
      ext: 'ots',
      name: 'OpenDocument Spreadsheet Template',
      role: 'Editor',
      icon: 'xlsx',
      mimeType: 'application/vnd.oasis.opendocument.spreadsheet-template',
    },
    {
      ext: 'odt',
      name: 'OpenDocument Text',
      role: 'Editor',
      icon: 'docx',
      mimeType: 'application/vnd.oasis.opendocument.text',
    },
    {
      ext: 'ott',
      name: 'OpenDocument Text Template',
      role: 'Editor',
      icon: 'docx',
      mimeType: 'application/vnd.oasis.opendocument.text-template',
    },
    {
      ext: 'odp',
      name: 'OpenDocument Presentation',
      role: 'Editor',
      icon: 'pptx',
      mimeType: 'application/vnd.oasis.opendocument.presentation',
    },
    {
      ext: 'otp',
      name: 'OpenDocument Presentation Template',
      role: 'Editor',
      icon: 'pptx',
      mimeType: 'application/vnd.oasis.opendocument.presentation-template',
    },
    {
      ext: 'pdf',
      name: 'PDF Document',
      role: 'Editor',
      icon: 'pdf',
      mimeType: 'application/pdf',
    },
    {
      ext: 'md',
      name: 'Markdown Document',
      role: 'Editor',
      icon: 'md',
      mimeType: 'text/markdown',
    },
    {
      ext: 'markdown',
      name: 'Markdown Document',
      role: 'Editor',
      icon: 'md',
      mimeType: 'text/markdown',
    },
    {
      ext: 'html',
      name: 'HTML Document',
      role: 'Editor',
      icon: 'html',
      mimeType: 'text/html',
    },
    {
      ext: 'htm',
      name: 'HTML Document',
      role: 'Editor',
      icon: 'html',
      mimeType: 'text/html',
    },
  ],
  npmRebuild: false,
  mac: {
    // Two separate arch packages (NOT universal): arm64 keeps the exact
    // artifact names and update-feed entries it always had, x64 (opt-in via
    // LYCERO_MAC_X64=1, see includeMacX64 above) adds Intel support with
    // electron-builder's default arch-less names (LyceroOffice-<v>.dmg /
    // LyceroOffice-<v>-mac.zip). Both zips land in one latest-mac.yml and
    // electron-updater picks by process.arch. Dual-arch packs ship the same
    // lipo fat xlsx-sidecar (see assertUniversalSidecar above).
    target: [
      { target: 'dmg', arch: includeMacX64 ? ['arm64', 'x64'] : ['arm64'] },
      { target: 'zip', arch: includeMacX64 ? ['arm64', 'x64'] : ['arm64'] },
    ],
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    ...(hasAppleSignIdentity ? {} : { identity: null }),
    notarize: hasAppleSignIdentity && hasAppleNotarizeCreds,
    extraResources: [
      {
        from: '../sheets/native/xlsx-engine/target/release/xlsx-sidecar',
        to: 'native/xlsx-sidecar',
      },
    ],
  },
  win: {
    icon: 'build-resources/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: [winArch],
      },
    ],
    extraResources: [
      {
        from: WIN_SIDECAR,
        to: 'native/xlsx-sidecar.exe',
      },
      {
        from: 'build/shell-new',
        to: 'shell-new',
        filter: ['*.docx', '*.xlsx', '*.pptx'],
      },
    ],
  },
  // Unlike win (which cross-compiles the sidecar to an explicit target
  // triple), linux takes it from cargo's host-native target/release/ — the
  // same source mac uses. So no `arch` is pinned here: electron-builder
  // defaults to the build host's architecture, which is the only one the
  // sidecar was actually built for. Packaging arm64 on an x64 host, or the
  // reverse, needs a matching `cargo build --target` first.
  linux: {
    // AppImage (self-contained, any distro) + deb (apt install, pulls in the
    // GTK/NSS runtime deps) + rpm (dnf/zypper install on Fedora / RHEL /
    // openSUSE).
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
      { target: 'rpm', arch: ['x64'] },
    ],
    // deb control metadata.
    maintainer: 'ITAC AI Heavy Industries. All rights reserved.',
    vendor: 'ITAC AI Heavy Industries. All rights reserved.',
    category: 'Office',
    // Icon SET directory, not the single 1024px png: electron-builder does
    // not resize a lone png, so deb/rpm would install only
    // hicolor/1024x1024/apps/lycero-office.png — a size absent from the hicolor
    // theme index, leaving GNOME/KDE launchers on the generic fallback icon.
    // The set ships every standard raster size from the brand kit.
    icon: 'build-resources/icons',
    executableName: 'lycero-office',
    // electron-builder derives the .desktop filename from executableName, and
    // syncDesktopName makes it also set StartupWMClass — matching the WM_CLASS
    // Electron reports so the taskbar correctly links the launcher entry.
    syncDesktopName: true,
    extraResources: [
      {
        from: '../sheets/native/xlsx-engine/target/release/xlsx-sidecar',
        to: 'native/xlsx-sidecar',
      },
    ],
  },
  // artifact name derives from executableName ('lycero-office').
  deb: {
    artifactName: 'lycero-office_${version}_${arch}.deb',
    packageName: 'lycero-office',
    afterInstall: 'build/linux-after-install.sh',
    afterRemove: 'build/linux-after-remove.sh',
  },
  // rpm uses the same naming; publish: null keeps it off the auto-update feed
  // (GitHub Release download only).
  rpm: {
    artifactName: 'lycero-office-${version}.${arch}.rpm',
    packageName: 'lycero-office',
    publish: null,
    afterInstall: 'build/linux-after-install.sh',
    afterRemove: 'build/linux-after-remove.sh',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  beforePack: async (context) => {
    assertModuleTreesPresent()
    if (context.electronPlatformName === 'darwin' && includeMacX64) {
      assertUniversalSidecar()
      assertUniversalVisionOcr()
    }
    if (context.electronPlatformName === 'win32' && !existsSync(join(__dirname, WIN_SIDECAR))) {
      throw new Error(
        `win extraResources source missing: ${WIN_SIDECAR} (cargo build --target ${winSidecarTarget} first)`,
      )
    }
  },
  dmg: {
    sign: hasAppleSignIdentity,
  },
  afterAllArtifactBuild: 'build/notarize-dmg.js',
}

// Windows in-package code signing. Security features that judge every PE
// individually (Smart App Control, WDAC/AppLocker, AV heuristics) block
// unsigned child processes — the unsigned xlsx-sidecar.exe died with
// "spawn UNKNOWN" on such machines even though the installer itself was
// signed. When CI exports LYCERO_WIN_SIGN_MODE ("test" = alpha
// self-signed PFX, "production" = DigiCert KeyLocker — the two modes of
// scripts/win-sign.cjs, whose env-var contract applies here too), every
// binary electron-builder signs for win (LyceroOffice.exe, the NSIS
// uninstaller, and the installer) goes through that script. The static
// extraResources binaries (xlsx-sidecar.exe, win-ocr.exe) are signed by the
// workflow before packaging since electron-builder does not sign
// extraResources. Unset (local / fork builds) keeps the old behavior:
// electron-builder has no signing config and packages everything unsigned.
const winSignMode =
  process.env.LYCERO_WIN_SIGN_MODE === 'none' ? undefined : process.env.LYCERO_WIN_SIGN_MODE
if (winSignMode) {
  if (winSignMode !== 'test' && winSignMode !== 'production') {
    throw new Error(`LYCERO_WIN_SIGN_MODE must be "test" or "production", got "${winSignMode}"`)
  }
  const origBeforePack = config.beforePack
  config.beforePack = async (context) => {
    if (origBeforePack) await origBeforePack(context)
    if (context.electronPlatformName === 'win32') {
      for (const rel of [WIN_SIDECAR, WIN_OCR_HELPER]) {
        const binPath = join(__dirname, rel)
        if (existsSync(binPath)) {
          execFileSync(
            process.execPath,
            [join(__dirname, '../../scripts/win-sign.cjs'), winSignMode, binPath],
            { stdio: 'inherit' },
          )
        }
      }
    }
  }
  config.win.signtoolOptions = {
    // Single pass per file: the sha1+sha256 dual-signing default is a
    // pre-Win8 relic and would invoke the hook twice per binary.
    signingHashAlgorithms: ['sha256'],
    sign: (configuration) => {
      execFileSync(
        process.execPath,
        [join(__dirname, '../../scripts/win-sign.cjs'), winSignMode, configuration.path],
        { stdio: 'inherit' },
      )
      return Promise.resolve()
    },
  }
}

if (updateUrl) {
  config.publish = [
    {
      provider: 'generic',
      url: updateUrl.replace(/\/+$/, ''),
      channel: 'latest',
    },
  ]
}

// CI's "-c.extraMetadata.version=..." CLI override deep-merges with this block,
// so the version and all injected feature settings survive together.
const extraMetadata = {}
if (ga4MeasurementId && ga4ApiSecret) {
  extraMetadata.lyceroAnalytics = {
    measurementId: ga4MeasurementId,
    apiSecret: ga4ApiSecret,
  }
}
if (fontCdnUrl) extraMetadata.lyceroFontCdn = { baseUrl: fontCdnUrl }
if (Object.keys(extraMetadata).length) config.extraMetadata = extraMetadata

module.exports = config
