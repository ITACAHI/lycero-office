# Technical Architecture Review Report — Lycero Office Desktop

**Date:** September 19, 2026  
**Reviewer:** Architecture Review Agent  
**Scope:** Full monorepo analysis — 7 apps, 20 packages, Electron security, AI integration, theming, i18n, performance, build pipeline

---

## Executive Summary

| Dimension | Grade | Notes |
|---|---|---|
| **Overall** | **A−** | Excellent engineering; minor gaps in test coverage and circular dependency risk |
| Monorepo Architecture | A | Clean workspace, 100% `@lycero/*` scope, no `@lycero-office/*` leaks |
| Electron Security | A | Full sandbox + contextIsolation; comprehensive IPC validation |
| Performance | B+ | Lazy tab loading, streaming AI; concern: 5116-line main/index.ts monolith |
| Code Quality | A− | TypeScript strict, ESLint, Vitest; some `@ts-ignore` in vendor code |
| Build & Distribution | A | electron-builder, full auto-updater, cross-platform (Win/Mac/Linux) |
| Security Audit | A | safeExternalUrl gate, Zod IPC validation, no eval/dangerouslySetInnerHTML |
| AI Integration | B+ | Streaming, Free-tier safe, BYOK; no formal quota enforcement code seen |
| Theming & Design | A | Full tokens.css (light/dark/system), semantic tokens, anti-slop rules |
| i18n | A | Sharded per-domain + per-language dictionaries, `satisfies Record<keyof typeof zh, string>` |
| Scalability | B | 109 source files in shell alone; TypeScript strict enabled repo-wide |

**Critical Issues: 0 | Major Issues: 2 | Minor Issues: 4**

---

## 1. Monorepo Architecture

### 1.1 Workspace Composition

| Category | Count | Examples |
|---|---|---|
| **Apps** | 7 | shell, docs, sheets, slides, pdf, markdown, html |
| **Packages** | 20 | agent-core, ai-provider, ai-auth, ai-search, docx-engine, pptx-engine, pptx-render, pptx-ops, xlsx-gateway, file-parse, font-metrics, i18n, ui, electron-utils, project-store, pipelines, html2docx, pdf2docx, cli, cloud-sync |

### 1.2 Package Scope Compliance

**Rule (CLAUDE.md):** 100% `@lycero/*` across all 25 workspaces. Never introduce `@lycero-office/*` imports.

**Finding:** ✅ **COMPLIANT** — All 27 workspaces verified use `@lycero/*` naming. No `@lycero-office/*` imports found in source code (only in `apps/docs/package.json` `build.appId: "com.lycero-office.docs"` which is a legacy identifier, not an import).

### 1.3 Dependency Graph

- `@lycero/ai-provider` → `@lycero/agent-core`
- `@lycero/ui` → `@lycero/i18n`, `@lycero/pptx-render`
- `@lycero/shell` (app) → all packages via `devDependencies: "*"` workspace references
- No circular dependencies detected in workspace graph
- Root `package.json` uses `ws: ^8.21.1` and `@lycero/cloud-sync: ^1.0.0` at root level

**Score: A**

---

## 2. Electron Architecture & Security

### 2.1 Main Process Security

All BrowserWindow instances across all apps enforce the security triad:

```typescript
// apps/shell/src/main/index.ts:2707-2711
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

| App | File | contextIsolation | nodeIntegration | sandbox |
|---|---|---|---|---|
| shell | index.ts:2707 | ✅ true | ✅ false | ✅ true |
| docs | docs-main.ts:4671 | ✅ true | ✅ false | ✅ true |
| sheets | sheets-main.ts:1934 | ✅ true | ✅ false | ✅ true |
| slides | slides-main.ts:4446 | ✅ true | ✅ false | ✅ true |
| pdf | pdf-main.ts:1469 | ✅ true | ✅ false | ✅ true |
| markdown | markdown-main.ts:1085 | ✅ true | ✅ false | ✅ true |
| html | html-main.ts:1315 | ✅ true | ✅ false | ✅ true |
| update window | update-window.ts:73 | ✅ true | ✅ false | ✅ true |
| pdf-password | pdf-password-dialog.ts:92 | ✅ true | ✅ false | ✅ true |
| presenter | presenter-show.ts:76 | ✅ true | ✅ false | ✅ true |

### 2.2 IPC Input Validation

**Sheets (docs):** Full Zod schema validation end-to-end:

```typescript
// apps/sheets/src/main/sheets-main.ts:42, 2515, 2548-2552, 3083, 3106
import { z } from 'zod'

const paths = z.array(z.string().min(1)).min(1).max(20).parse(input)
const validatedSessionId = z.string().uuid().parse(sessionId)
const base = sanitizeAutoRenameBase(z.string().min(1).max(100).parse(baseName))
const validatedPath = z.string().min(1).max(1024).parse(filePath)
```

**Shell preload:** Inline type guards for all IPC parameters:

```typescript
// apps/shell/src/preload/index.ts:69-71, 94, 129, 198, 237, 250, 371
function isUiLanguage(value: unknown): value is UiLanguage { ... }
if (typeof path !== 'string' || !path) throw new Error('Invalid path.')
if (channel !== 'stable' && channel !== 'beta') throw new Error('Invalid update channel.')
if (theme !== 'light' && theme !== 'dark' && theme !== 'system') throw new Error('Invalid theme.')
if (typeof on !== 'boolean') throw new Error('Invalid AutoSave default.')
if (action !== 'starred' && action !== 'later') throw new Error('Invalid star prompt action.')
```

### 2.3 External URL Gate

Centralized via `@lycero/electron-utils`:

```typescript
// packages/electron-utils/src/safe-external-url.ts:26-37
export function safeExternalUrl(url: unknown, options?: SafeExternalUrlOptions): string | null {
  if (typeof url !== 'string') return null
  const text = url.trim()
  let parsed: URL
  try { parsed = new URL(text) } catch { return null }
  const allowed = options?.allowedProtocols ?? DEFAULT_PROTOCOLS  // ['http:', 'https:']
  return allowed.includes(parsed.protocol) ? text : null
}
```

Rejects `file:`, `javascript:`, and custom schemes. Used by docs, slides, pdf via `safeExternalUrl` in `navigation-guard.ts`.

### 2.4 No eval / No dangerouslySetInnerHTML

**Finding:** ✅ **COMPLIANT** — No `eval()`, `new Function()`, or `dangerouslySetInnerHTML` found in application source. The only `innerHTML` usage is in test files and for injecting trusted SVG icons in blockDragHandle.ts.

### 2.5 Layout Script Sandbox (Slides AI)

The Slides AI layout script interpreter (`apps/slides/src/renderer/ai/layout-script-interpreter.ts`) uses an AST-based interpreter with no `eval`, `Function`, worker, or VM context — see `SECURITY.md:28-49` for full threat model. This is defense-in-depth beyond the Electron renderer sandbox.

**Score: A**

---

## 3. Performance

### 3.1 Bundle Strategy

- **Shell bundles everything** into the main process: docs/sheets/slides main modules are TypeScript source with no build artifacts, externalizing them would break Node ESM resolution at runtime (`apps/shell/electron.vite.config.ts:11-14`).
- **Preloads** are separately built: 3 entries (index, update, pdf-password) via rollup input.
- **Renderers** each load independently via separate ports (docs:5173, sheets:5174, slides:5175, etc.).

### 3.2 Lazy Loading

- Tabs are loaded on-demand via `TabManager` (`apps/shell/src/main/tab-manager.ts`).
- Editors (docs, sheets, slides, pdf, markdown, html) are lazily instantiated when a tab is opened.
- Shell renderer dev mode starts 6 concurrent Vite instances for all renderers.

### 3.3 Memory & Event Listener Hygiene

Preload returns cleanup functions for all `ipcRenderer.on` listeners:

```typescript
// apps/shell/src/preload/index.ts:168-169, 186-187, 212, 346, 467, 601, 609, 629
onFolderChanged(handler) {
  const listener = (_event: IpcRendererEvent, dirs: unknown) => { ... }
  ipcRenderer.on(HOME_CHANNELS.folderChanged, listener)
  return () => ipcRenderer.removeListener(HOME_CHANNELS.folderChanged, listener)
}
```

### 3.4 AI Streaming

- `streamText` exported from `@lycero/agent-core` for streaming responses.
- `AgentLoop` with `AgentStreamHandle` for async streaming tool results.
- `IPC_STREAM_SILENCE_TIMEOUT_MS` for timeout detection.
- MCP server supports SSE transport for legacy clients (`apps/shell/tests/mcp/mcp-server.test.ts:148`).

### 3.5 Concern: Main Process Monolith

`apps/shell/src/main/index.ts` is **5,116 lines** of main process code in a single file. This is the most critical performance and maintainability risk in the codebase. All apps (docs, sheets, slides, pdf, markdown, html) are imported and initialized in this one file.

**Score: B+** (minor deduction for main process monolith)

---

## 4. Code Quality

### 4.1 TypeScript

```typescript
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": false,
    "skipLibCheck": true,
    "moduleResolution": "bundler"
  }
}
```

✅ `strict: true` enabled across all 27 workspaces. The `noUnusedLocals: false` setting is a deliberate tradeoff.

### 4.2 ESLint

Root `eslint.config.mjs` uses `typescript-eslint` + `eslint-plugin-react-hooks`. Key settings:

- `@typescript-eslint/no-explicit-any: 'off'` — intentional for untyped Electron IPC boundaries
- `react-hooks/exhaustive-deps: 'warn'` (not error) — incremental adoption
- `no-empty: ['error', { allowEmptyCatch: true }]` — intentional fail-open pattern
- `@typescript-eslint/ban-ts-comment: 'off'` for `packages/html2docx` (typed file-by-file migration in progress)

### 4.3 Test Coverage

25 Vitest configs across the monorepo. Test command covers 19 packages/apps:

```bash
npm test -- @lycero/i18n @lycero/electron-utils @lycero/font-metrics @lycero/docx-engine \
  @lycero/pdf2docx @lycero/html2docx @lycero/file-parse @lycero/pptx-engine \
  @lycero/pptx-render @lycero/pipelines @lycero/ai-search @lycero/agent-core \
  @lycero/ai-provider @lycero/project-store @lycero/cli @lycero/ui \
  @lycero/docs @lycero/sheets @lycero/shell @lycero/slides @lycero/pdf \
  @lycero/markdown @lycero/html
```

E2E tests via Playwright (`e2e/playwright.config.ts`).

### 4.4 Ponytail Compliance

Review of codebase shows:
- ✅ Native APIs used: `dialog`, `<input type="date">`, `<dialog>`, `<details>`
- ✅ No unnecessary datepicker/popover libraries
- ✅ `@lycero/electron-utils` reused across all apps
- ✅ `safeExternalUrl` centralized, not duplicated
- ⚠️ 1 `ponytail:` comment found (`apps/shell/src/main/index.ts:110`)

**Score: A−** (minor: main process monolith; some `@ts-ignore` in html2docx)

---

## 5. Build & Distribution

### 5.1 electron-builder Configuration

- `electron: ^43.3.0`, `electron-builder: ^26.0.12`, `electron-vite: ^5.0.0`
- `electron-updater: ^6.8.9` for auto-update
- App ID: `com.lycero-office.docs` (legacy, non-critical)

### 5.2 Auto-Updater

Full-featured auto-updater (`apps/shell/src/main/updater.ts`):
- Stable + Beta channels via `latest.yml` / `beta.yml`
- Windows: NSIS installer
- macOS: DMG + zip (Squirrel.Mac)
- Linux: AppImage (self-update), deb (manual)
- `autoUpdater.autoDownload = false` — user controls when to download
- `autoUpdater.autoInstallOnAppQuit = true` — install on quit
- `autoUpdater.disableDifferentialDownload = true` — full-package policy
- Trusted URL base from `process.resourcesPath/app-update.yml`
- CDN manual download links rebuilt from trusted base (not from remote metadata)

### 5.3 Cross-Platform

| Platform | Targets | Config |
|---|---|---|
| Windows | x64, arm64 | NSIS exe |
| macOS | universal, x64, arm64 | DMG, zip |
| Linux | x64 | AppImage, deb |

### 5.4 Code Signing

- macOS `identity: null` in build config — signing identity not configured in repo (production CI sets this)
- No code signing for Windows/Linux in repo config

**Score: A**

---

## 6. AI Integration

### 6.1 Free Tier Safety

Per `CLAUDE.md`: Free Tier **must use hosted Lycero Gateway**. BYOK endpoints must **not be exposed** to Free users. Review of `apps/shell/src/preload/index.ts:398-410` shows `getAiProviders()` returns all provider adapters (including custom BYOK endpoints) — but this is a renderer API surface. The actual enforcement must be server-side at the Lycero Gateway level.

### 6.2 BYOK Support

`ai-provider` supports:
- Custom OpenAI-compatible endpoints
- Ollama, LM Studio, On-premise Gateway
- `fetchRemoteModels` for dynamic model discovery
- `testAiSettings` for connectivity validation

### 6.3 Zero Data Retention

No ZDR enforcement visible in client code (this is a server-side policy at the Lycero Gateway).

### 6.4 Streaming

- `streamText` from `@lycero/agent-core`
- `AgentLoop` + `AgentStreamHandle` for tool streaming
- SSE transport for MCP legacy clients
- `IPC_STREAM_SILENCE_TIMEOUT_MS` timeout detection

**Score: B+** (Free-tier enforcement is server-side, not client-side visible)

---

## 7. Theming & Design System

### 7.1 Token Architecture

`packages/ui/src/tokens.css` implements full three-tier theming:

```
:root              → Light mode (default)
[data-theme='dark']  → Dark mode (override)
@media (prefers-color-scheme: dark) → System preference (override)
```

### 7.2 Semantic Tokens

| Token | Light | Dark | System-Dark |
|---|---|---|---|
| `--surface` | #ffffff | #1e1e1e | #1e1e1e |
| `--text` | #242424 | #e4e4e4 | #e4e4e4 |
| `--hover` | #f5f5f5 | #333 | #333 |
| `--border` | #e3e6ea | #3a3a3a | #3a3a3a |
| `--color-bg-page` | #ffffff | #262624 | #1e1e1e |
| `--color-bg-subtle` | #F9F8F3 | #302f2d | #2a2a2a |
| `--lycero-terracotta` | #8B3A1A | #d97757 | #e8663f |
| `--color-ai-action` | #8B3A1A | #d97757 | #e8663f |

### 7.3 Anti-Slop Rules

Enforced via `@lycero/office-craft.mdc` and `impeccable.mdc`:
- ✅ No purple-blue gradients on dark backgrounds
- ✅ No nested cards
- ✅ No raw hex in renderer CSS (CI enforced via `tools/check-theme-colors.mjs`)
- ✅ `Be Vietnam Pro` as primary font
- ✅ `cubic-bezier(0.16, 1, 0.3, 1)` for transitions (125-250ms)

### 7.4 Document vs. UI Chrome Separation

`CLAUDE.md:11-20` mandates document content never references chrome tokens. Verified: `--surface`, `--text`, `--hover` are UI chrome only. Document content (cells, paragraphs, slides) uses hardcoded values.

**Score: A**

---

## 8. i18n Architecture

### 8.1 Sharded Dictionaries

```
i18n/strings-<domain>.ts → aggregator (zh.ts keys as source of truth)
  └─ i18n/<domain>/<lang>.ts → one file per language
      └─ `satisfies Record<keyof typeof zh, string>` type enforcement
```

Verified sharded files across apps:
- `apps/docs/src/renderer/i18n/strings-app.ts`, `strings-ribbon.ts`, `strings-zotero.ts`, `strings-ai.ts`, `strings-editor.ts`, `strings-table.ts`
- `apps/sheets/src/renderer/i18n/strings-app.ts`, `strings-ai.ts`, `strings-dialogs.ts`
- `apps/slides/src/renderer/i18n/strings-app.ts`, `strings-panes.ts`, `strings-ribbon.ts`, `strings-ai.ts`
- `apps/html/src/renderer/i18n/strings-ai.ts`, `strings-app.ts`

### 8.2 Language Coverage

21 languages: vi, zh, en, ja, ko, fr, de, es, th, id, ru, ar, pt, it, pl, cs, nl, ms, he, hi, zh-TW

### 8.3 Key Enforcement

```typescript
// apps/html/src/renderer/i18n/ai/ja.ts:183, apps/docs/src/renderer/i18n/ai/en.ts:185, etc.
} satisfies Record<keyof typeof zh, string>
```

TypeScript `satisfies` operator ensures every language shard covers all keys defined in `zh.ts`. Missing or extra keys produce a compile error.

**Score: A**

---

## 9. Scalability Concerns

### 9.1 Monorepo Size

| Metric | Value |
|---|---|
| Total source files (approx.) | ~1,000+ |
| Shell main source files | 109 TypeScript files |
| Single largest file | `apps/shell/src/main/index.ts` (5,116 lines) |
| Apps | 7 |
| Packages | 20 |
| Test configs | 25 Vitest + 1 Playwright |

### 9.2 Build Times

- Root `npm run build:all` builds 7 apps + CLI + shell
- Dev mode: 6 concurrent Vite renderer servers + 1 shell
- TypeScript: `npm run typecheck` runs 22 workspace typechecks sequentially
- Tests: `npm test` runs 19 workspace tests sequentially

### 9.3 Recommendations for Scale

The 5,116-line `main/index.ts` is the primary maintainability bottleneck. Consider splitting into:
- `main/docs-handlers.ts`
- `main/sheets-handlers.ts`
- `main/slides-handlers.ts`
- `main/pdf-handlers.ts`
- `main/markdown-handlers.ts`
- `main/html-handlers.ts`
- `main/cloud-sync-handlers.ts`

**Score: B** (functional but needs architectural refactoring for long-term maintainability)

---

## Critical Issues (P0)

None.

---

## Major Issues (P1)

### 1. Main Process Monolith (P1)

**File:** `apps/shell/src/main/index.ts`  
**Lines:** 5,116  
**Severity:** Maintainability, performance, testing

This single file imports and initializes all 7 editor apps (docs, sheets, slides, pdf, markdown, html), all AI bridges (MCP, agent-core, ai-provider), cloud sync, updater, and tab management. A change to any subsystem requires loading the entire main process bundle. This increases cold-start time, complicates testing, and creates a single point of failure.

**Fix:** Split into domain-specific handler modules. This is the #1 refactoring priority.

### 2. Free Tier BYOK Enforcement (P1)

**File:** `apps/shell/src/preload/index.ts:398-410`  
**Severity:** Security, product compliance

`getAiProviders()` exposes all provider configurations including custom BYOK endpoints to the renderer. While the Lycero Gateway may enforce Free-tier restrictions server-side, there is no visible client-side enforcement preventing a motivated user from configuring custom endpoints on Free tier. For defense-in-depth, client-side gating should validate the user's tier before surfacing BYOK options.

**Fix:** Add `accountStatus()` tier check before returning BYOK-capable providers.

---

## Minor Issues (P2)

### 1. Legacy App ID (P2)

**File:** `apps/docs/package.json:56`  
**Value:** `"appId": "com.lycero-office.docs"`  
**Action:** Rename to `com.lycero.docs` in a non-breaking release.

### 2. html2docx @ts-ignore (P2)

**File:** `packages/html2docx/src/generate.ts`, `packages/html2docx/src/generate/**/*.ts`  
**Reason:** Typed file-by-file migration in progress per `packages/html2docx/README.md`. This is acknowledged and intentional.

### 3. React Hooks Exhaustive Deps (P2)

**File:** `eslint.config.mjs:68`  
**Setting:** `'react-hooks/exhaustive-deps': 'warn'` (not error)  
**Action:** Consider promoting to `'error'` in a dedicated PR.

### 4. noUnusedLocals: false (P2)

**File:** `tsconfig.base.json:13`  
**Impact:** TypeScript will not flag unused local variables. This is a tradeoff for cleaner migration code but reduces static analysis value.

---

## Recommendations

### Immediate (Before Next Release)

1. **Add Free-tier BYOK gating** in `apps/shell/src/preload/index.ts:getAiProviders()` — check `accountStatus()` tier before exposing custom endpoints.

### Short-term (Next Quarter)

2. **Split `apps/shell/src/main/index.ts`** into domain handler modules (docs, sheets, slides, pdf, markdown, html, cloud-sync).
3. **Promote `react-hooks/exhaustive-deps`** from `'warn'` to `'error'` in ESLint config.
4. **Rename `com.lycero-office.docs`** app ID to `com.lycero.docs`.

### Long-term (Roadmap)

5. **Incremental Vitest parallelization** — replace sequential workspace test runs with `npm run test --workspaces --parallel`.
6. **TypeScript incremental build** — add `incremental: true` to `tsconfig.base.json` for faster `npm run typecheck`.
7. **Complete html2docx type migration** — remove `@ts-ignore` exceptions once all files are typed.
8. **Document the AI quota enforcement architecture** — clarify client vs. server-side responsibility for Free/Pro tier quota display and enforcement.

---

## Strengths

1. **Best-in-class Electron security** — full sandbox + contextIsolation + validated IPC across every window, every app
2. **Comprehensive auto-updater** — channel-based, trusted URL base, manual fallback after failures
3. **Zero-eval layout interpreter** — AST-based Slides layout script sandbox with no escape to JavaScript runtime
4. **Type-safe i18n** — `satisfies Record<keyof typeof zh, string>` enforces complete language coverage
5. **100% @lycero/* scope** — no @lycero-office/* leaks, clean package boundaries
6. **Streaming AI** — `streamText`, `AgentStreamHandle`, SSE transport, silence timeout detection
7. **Design system maturity** — full three-tier theming (light/dark/system), semantic tokens, anti-slop rules, CI-enforced token usage
8. **Cross-platform** — Windows (NSIS), macOS (DMG/Squirrel), Linux (AppImage/deb) all configured
9. **Ponytail principles applied** — no unnecessary libraries, native APIs preferred, centralized utilities
10. **Safe external URL gate** — `safeExternalUrl` centralized, no `javascript:` or `file:` leaks

---

## Verdict

**Lycero Office Desktop demonstrates excellent engineering quality with enterprise-grade security practices.** The codebase shows strong discipline in Electron security (sandbox everywhere, validated IPC, no eval), a mature design system with comprehensive theming, type-safe i18n across 21 languages, and thoughtful AI streaming architecture.

The primary concern is the **5,116-line main process monolith** in `apps/shell/src/main/index.ts`, which represents a technical debt hotspot that will compound as the application grows. The secondary concern is **client-side BYOK enforcement** for Free-tier users, which should be addressed as defense-in-depth even if the Lycero Gateway enforces this server-side.

The codebase is production-ready with the identified issues addressed in the near-term roadmap. Architecture grade: **A−**.

---

*Review generated by Architecture Review Agent — Lycero Office Desktop, September 19, 2026*
