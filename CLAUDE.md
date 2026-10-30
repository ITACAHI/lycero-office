# CLAUDE.md

Guidance for AI agents and human contributors working in this repo.

## Theming rules (mandatory)

The suite supports light / dark / system UI themes. The switching mechanism is a
`data-theme` attribute on `<html>` plus CSS custom properties defined once in
`packages/ui/src/tokens.css` (light defaults in `:root`, overrides in
`[data-theme='dark']`, and a `prefers-color-scheme` media-query fallback for
system mode).

1. **UI chrome colors must use semantic tokens.** Never write raw `#hex` /
   `rgb()` in renderer CSS rules or chrome-related inline styles — reference
   `var(--surface)`, `var(--text)`, `var(--hover)`, etc. from
   `packages/ui/src/tokens.css`. Raw values are allowed only on custom-property
   definition lines (`--x: #...;` — token, accent, or app-scoped variable
   definitions). CI enforces this for new/changed renderer CSS lines
   (`tools/check-theme-colors.mjs`).
2. **Every new token gets both values.** Adding a token means adding it to all
   three blocks in `tokens.css` (light, dark, system-dark fallback).
3. **Accent colors stay per-app.** Each app defines `--accent` /
   `--accent-dark` / `--accent-soft` (and its dark-adjusted values) in its own
   `styles.css`. Shared rules reference `var(--accent)` and inherit the app's
   brand color.
4. **Document content is never re-authored by the theme.** Page surfaces, cell
   fills, slide content, PDF page bitmaps, export/print stylesheets, chart
   palettes, highlight color maps, stamps, and WordArt presets are document
   data: they stay hardcoded, must not reference chrome tokens, and every
   save/export/print path must produce identical output in both themes. A
   Word/Excel-style _dark page_ (Sheets via Univer's `darkMode`, Docs via
   `apps/docs/src/renderer/editor/dark-page.ts`) is a display-time remap only:
   the authored color stays the real declaration, the remapped twin lives in
   a screen-only `--dk-*` / `.page-dark` layer, and print/export never see it.
5. **Canvas-drawn UI affordances go through a constants table.** Konva/canvas
   editing chrome (selection frames, guides, handles) reads from the app's
   canvas color table (e.g. `canvas-colors.ts`) keyed by the current theme —
   no inline hex in draw calls.

## Build gotchas

- App main-process code (`apps/*/src/main`) is compiled into the **shell**
  build. After changing it, rebuild the shell or the change silently does not
  run.
- In dev mode, preload changes require a rebuild — a stale preload leaves the
  renderer blank.
- Workspace packages listed in an app's `dependencies` must also be added to
  the `externalizeDepsPlugin` `exclude` list, or the packaged app crashes on
  launch.
- `useI18n()`'s `t` is not referentially stable; never put it in a hook
  dependency array. Store the key and translate at render time.

## UI strings (i18n)

- Large dictionaries are sharded per locale: `i18n/strings-<domain>.ts` is a
  thin aggregator over `i18n/<domain>/<lang>.ts` (one file per language, `zh`
  defines the key set). Add a new key to `zh.ts` and to every sibling shard;
  the `satisfies Record<keyof typeof zh, string>` on each shard turns a
  missing or extra key into a type error. Never grow the aggregator back into
  a single 19-locale object.

## Lockstep Versioning (mandatory on every change)

Every code or configuration change in this monorepo MUST bump and synchronize
the version (`x.y.z`) in lockstep across all **37 component manifests**:

- Root `package.json` + all 7 `apps/*/package.json` + all 22 `packages/*/package.json`
- `package-lock.json` (root `version`, `packages[""].version`, and all 29 workspace entries)
- `apps/sheets/native/xlsx-engine/Cargo.toml` and `Cargo.lock` (`xlsx-sidecar`)
- Core Agent Skills: `skills/lycero-office/SKILL.md`, `skills/genoffice/SKILL.md`,
  `.agents/skills/lycero-office/SKILL.md`, `.claude/skills/lycero-office/SKILL.md`
- Built CLI bundle (`packages/cli/dist/lycero-office.cjs`, if present)

Never hand-edit a single `package.json` version in isolation. Always run:

```bash
npm run version:bump        # patch bump (or version:minor / version:major)
npm run build -w @lycero/cli
npm run check:version-sync  # verifies all 38 component manifests match
```

(`.githooks/pre-commit`, `.githooks/pre-push`, and CI enforce `tools/check-version-sync.mjs`).

## Multi-Platform Release & Deployment Workflow

1. **Local Verification & Bundle Gate:**
   - `npm run typecheck && npm run build:all && npm run verify:bundle`
   - `npm run check:public-hygiene && npm run licenses`
2. **Local Windows Installer Packaging:**
   - 64-bit (`x64`): `npm run dist:win` → `apps/shell/release/Lycero Office Setup <version>.exe`
   - 32-bit (`ia32`): `npm run dist:win:ia32` → `apps/shell/release-ia32/Lycero Office Setup <version>-ia32.exe`
3. **Dual-Remote Release Push (`origin` GitLab + `github` Public Repo):**
   - Commit tracked files (`git add -u`, never force-add gitignored `.claude/` files) and tag `git tag -a v<version> -m "Release v<version>"`.
   - Push `public-main:main` and tag `v<version>` to both `origin` and `github`.
4. **GitHub Actions CI/CD (`.github/workflows/release.yml`) & NSIS Auto-Update Rules:**
   - Builds and publishes all **17 release assets** across Windows (`x64` & 32-bit `ia32`), macOS (Apple Silicon `arm64` & Intel `x64`), and Linux (`.AppImage`, `.deb`, `.rpm` + `.asc` GPG signatures).
   - Always keep artifact directories flat in `apps/shell/release/` before `actions/upload-artifact@v4` and pass only files (`find release-assets -type f | sort`) to `gh release upload`.
   - In `apps/shell/build/installer.nsh`: always keep `!macro customCheckAppRunning` (using `nsProcess` + `nsProcess::_Unload`), sanitize stale `HKLM`/`HKCU` flags in `!macro customInit`, self-heal `$newStartMenuLink` and `$newDesktopLink` in `!macro customInstall`, and use `StdUtils.ExecShellAsUser` + `800ms` `nsProcess::_FindProcess` + `Exec '"$appExe" --updated'` fallback (never expand `!insertmacro StartApp`, `UAC_AsUser_ExecShell`, or top-level `Function` blocks, and never set `autoUpdater.installDirectory` on paths with spaces).

<!-- AI_CTO_BRIDGE_START -->

## Quy trình CTO dùng chung

Trước tác vụ kỹ thuật, đọc `D:/Bộ quy trình Dev/AGENTS.md` và nạp skill phù hợp theo định tuyến tại đó.
Giải quyết liên kết tương đối theo thư mục chứa tài liệu gốc. Bộ quy trình chỉ là tham chiếu; chỉ sửa workspace dự án hiện tại.
Giữ quy định riêng của dự án; nếu xung đột không giải được, báo rõ và chờ người phụ trách. Nếu cầu nối được nạp từ nhiều file, áp dụng một lần.
Thiếu quyền đọc hoặc thiếu tool phải báo BLOCKED/NOT RUN. Cầu nối không bật hook, không cấp quyền gửi mã tới endpoint ngoài, tiêu tiền, commit/push/merge hoặc deploy.
<!-- AI_CTO_BRIDGE_END -->
