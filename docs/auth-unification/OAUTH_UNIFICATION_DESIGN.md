# Lycero Office — OAuth Unification Design Document

> **Status:** Design only. No code is written in this document.
> **Author:** AI Agent (Lycero Office codebase analysis)
> **Scope:** Unifying `packages/ai-auth/src/lycero-auth.ts` (Hub OAuth) and `packages/ai-search/src/lycero-auth.ts` (GSX/Office Addin Auth)

---

## 1. Caller Inventory

### 1.1 `@lycero/ai-auth` imports

**Package exports:** `src/index.ts` (types/constants/barrel) + `src/lycero-auth.ts` (main-process runtime, via `@lycero/ai-auth/main`).

#### Type-only imports (renderer-safe, zero runtime dependency)

| File | Symbol(s) imported | Bearer needed? | API key needed? | Rewritable? |
|---|---|---|---|---|
| `apps/shell/src/renderer/src/components/BundleMarketplace.tsx:9` | `WORK_BUNDLES` | No | No | No — pure data |
| `apps/shell/src/renderer/src/bundles/BundleCard.tsx:10` | `WorkBundle` | No | No | No — pure data |
| `apps/shell/src/renderer/src/bundles/filter.ts:8` | `WorkBundle` | No | No | No — pure data |
| `apps/shell/src/renderer/src/SettingsModal.tsx:28` | `ARCHETYPES` | No | No | No — pure data |
| `apps/docs/src/renderer/ai/LyceroMatePanel.tsx:6` | `WorkBundle` | No | No | No — pure data |
| `apps/html/src/renderer/ai/LyceroMatePanel.tsx:6` | `WorkBundle` | No | No | No — pure data |
| `apps/markdown/src/renderer/ai/LyceroMatePanel.tsx:5` | `WorkBundle` | No | No | No — pure data |
| `apps/pdf/src/renderer/ai/LyceroMatePanel.tsx:5` | `WorkBundle` | No | No | No — pure data |
| `apps/slides/src/renderer/ai/LyceroMatePanel.tsx:10` | `WorkBundle` | No | No | No — pure data |
| `apps/sheets/src/renderer/App.tsx:120` | `WorkBundle` | No | No | No — pure data |
| `packages/agent-core/src/loop.ts:12` | `WorkBundle` | No | No | No — pure data |
| `packages/agent-core/src/router/intent-router.ts:17` | `WorkBundle` | No | No | No — pure data |
| `packages/agent-core/src/composer.ts:8` | `WorkBundle, WorkBundleTool, WorkBundleSkill` | No | No | No — pure data |
| `packages/agent-core/src/bundles/general-office/skill.ts:15` | `WORK_BUNDLES` | No | No | No — pure data |
| `packages/agent-core/src/bundles/accounting-vn/skills.ts:8` | `WorkBundleSkill` | No | No | No — pure data |
| `apps/shell/src/shared/bundle-api.ts:8` | `WorkBundle` | No | No | No — pure data |
| `apps/shell/tests/bundle-card.test.ts:10` | `WorkBundle` | No | No | No — test only |
| `packages/agent-core/tests/router/intent-router.test.ts:16` | `WorkBundle, WorkBundleSkill` | No | No | No — test only |
| `packages/agent-core/tests/bundles/general-office.test.ts:12` | `WORK_BUNDLES` | No | No | No — test only |
| `packages/agent-core/tests/mate-integration.test.ts:36` | `WORK_BUNDLES` | No | No | No — test only |
| `packages/agent-core/tests/wire-pattern.test.ts:10` | `WorkBundle` | No | No | No — test only |
| `packages/agent-core/tests/build-resolver.test.ts:10` | `WorkBundle` | No | No | No — test only |
| `packages/agent-core/tests/apply-composed.test.ts:10` | `WorkBundle, WorkBundleTool, WorkBundleSkill` | No | No | No — test only |
| `packages/agent-core/tests/composer.test.ts:15` | `WorkBundle, WorkBundleTool, WorkBundleSkill` | No | No | No — test only |

#### Main-process runtime imports

| File | Function(s) called | Bearer needed? | API key needed? | Rewritable? |
|---|---|---|---|---|
| `apps/shell/src/main/lycero-auth-bridge.ts:17-27` | `startLyceroLogin`, `lyceroLoginInFlight`, `loadLyceroAuth`, `lyceroLogout`, `hasLyceroAuth`, `lyceroAccessToken`, `loginWithEmail`, `fetchHubQuota`, `fetchHubModels` | **Yes** | No | **Yes — canonical Hub orchestrator** |
| `apps/shell/src/main/index.ts:113` | `startLyceroLogin` (via `@lycero/ai-search` alias) | **Yes** | No | Covered by bridge |
| `apps/shell/src/main/shared/ipc/home.ts:21` | `startLyceroLogin` | **Yes** | No | Covered by bridge |
| `packages/ai-auth/tests/auth-refresh.test.ts:5` | `authedFetch` | **Yes** | No | Test only |
| `apps/shell/tests/lycero-hub-auth.test.ts:27` | `loginToLyceroHub` (bridge wrapper) | **Yes** | No | Test only |
| `scripts/patch-lycero-auth-bridge.mjs:17` | `startLyceroLogin` | **Yes** | No | Script only |

### 1.2 `@lycero/ai-search` imports

**Package root** (`src/index.ts`) re-exports from: `gsk`, `lycero-gateway`, `lycero-auth`, `lycero-auth-alias`, `media-tools`, `search-tools`, `shared`.

#### Main-process runtime imports

| File | Function(s) called | Bearer needed? | API key needed? | Rewritable? |
|---|---|---|---|---|
| `apps/shell/src/main/index.ts:111-114` | `loadLyceroAuth` (aliased), `setGskProxyUrl`, `startLyceroLogin` (via `@lycero/ai-search`) | **Yes** | No | **Yes — unify via bridge** |
| `apps/shell/src/main/shared/ipc/home.ts:17-21` | `gskLoginInfo`, `loadLyceroAuth`, `lyceroLogout`, `startLyceroLogin` | **Yes** | No | **Yes** |
| `apps/shell/src/main/cloud-projects.ts:3` | `gskApiKey`, `gskListPastProjects`, `hasGskAuth` | No | **Yes** | **Yes — derive from Hub token** |
| `apps/slides/src/main/ai-ipc.ts:40-49` | `webSearchTool`, `imageSearchTool`, `ensureLyceroLogin`, `gskApiKey`, `generateImageTool`, `analyzeMediaTool`, `gskLoginInfo`, `hasGskAuth`, `isLyceroProUser`, `proRequiredErrorMessage` | No | **Yes** | **Yes** |
| `apps/slides/src/main/slides-main.ts:30` | `gskApiKey`, `gskSlideGenerate`, `setGskProxyUrl` | No | **Yes** | **Yes** |
| `apps/sheets/src/main/sheets-main.ts:89-96` | `ensureLyceroLogin`, `lycApiKey`, `lycLoginInfo`, `hasGskAuth`, `setGskProxyUrl`, `webSearchTool`, `imageSearchTool`, `generateImageTool` | No | **Yes** | **Yes** |
| `apps/docs/src/main/docs-main.ts:107-113` | `generateImageTool`, `lycLoginInfo`, `hasGskAuth`, `webSearchTool`, `imageSearchTool`, `analyzeMediaTool` | No | **Yes** | **Yes** |
| `apps/pdf/src/main/pdf-main.ts:31` | `generateImageTool` | No | **Yes** | **Yes** |
| `apps/markdown/src/main/markdown-main.ts:31` | `generateImageTool` | No | **Yes** | **Yes** |
| `apps/html/src/main/html-main.ts:42` | `generateImageTool` | No | **Yes** | **Yes** |
| `packages/cli/src/cloud.ts:3` | `setGskProxyUrl` | No | **Yes** | **Yes** |
| `packages/cli/src/commands/capabilities.ts:8` | `hasGskAuth`, `readAiSettingsFile` | No | **Yes** | **Yes** |
| `packages/cli/src/commands/media.ts:2` | `analyzeMediaTool` | No | **Yes** | **Yes** |
| `packages/cli/src/commands/search.ts:1` | `imageSearchTool`, `webSearchTool` | No | **Yes** | **Yes** |
| `packages/cli/src/commands/image.ts:4` | `generateImageTool` | No | **Yes** | **Yes** |
| `apps/shell/tests/cloud-projects.test.ts:5` | `gskListPastProjects`, `GskPastProjectsPage` | No | **Yes** | Test only |
| `packages/ai-search/tests/lycero-auth.test.ts:13` | `startLyceroLogin`, `lyceroApiKey`, `loadLyceroAuth` | **Yes** | No | Test only |
| `packages/ai-search/tests/lycero-auth.test.ts:6` | `loadLyceroAuth`, `lyceroApiKey` (from `gsk.ts`) | No | **Yes** | Test only |
| `packages/cli/tests/capabilities.test.ts:6` | `hasGskAuth` | No | **Yes** | Test only |

---

## 2. API Surface Diff

### System A — `@lycero/ai-auth` (`packages/ai-auth/src/lycero-auth.ts`)

| Export | Type | Notes |
|---|---|---|
| `startLyceroLogin(progressCb)` | `function` | Device code OAuth, Hub endpoint |
| `lyceroLoginInFlight()` | `function` | True while device-code poll is running |
| `loginWithEmail(email, pass)` | `function` | Email/password login, saves to `~/.lycero/auth.json` |
| `loadLyceroAuth()` | `function` | Returns full `LyceroAuth` object |
| `hasLyceroAuth()` | `function` | True if `accessToken` present |
| `lyceroAccessToken()` | `function` | Returns raw Bearer token string |
| `lyceroLogout()` | `function` | POST `/auth/logout`, clears both in-memory and disk |
| `fetchHubQuota()` | `function` | GET `/quota/check` via `authedFetch` |
| `fetchHubModels()` | `function` | GET `/ai/models` via `authedFetch` |
| `authedFetch<T>(url, init)` | `function` | Bearer auth, auto-refresh-on-401 |
| `refreshAccessToken(rt)` | `function` | Manual refresh |
| `resetLyceroAuthCache()` | `function` | Test hook |
| `__setFetchForTest(impl)` | `function` | Test hook |
| `getLyceroBaseUrl()` | `function` | Returns `LYCERO_BASE_URL` |
| `lyceroAuthPath()` | `function` | Returns `~/.lycero/auth.json` path |
| `saveLyceroAuth` | `function` | Alias of internal `saveAuth` |
| `isLyceroProUser()` | `function` | Checks plan tier |
| `LYCERO_BASE_URL`, `LYCERO_API_BASE`, `APP_TYPE`, `HTTP_TIMEOUT_MS` | `const` | Config constants |
| `LyceroUser`, `LyceroAuthTokens`, `LyceroAuth`, `DeviceCodeResponse`, `TokenResponse`, `LyceroLoginProgress`, `EmailLoginResponse`, `HubQuota`, `HubModel`, `HubModels` | `type` | Type exports |
| `mapApiUser` | `function` | Maps raw API user to typed `LyceroUser` |
| `WORK_BUNDLES`, `ARCHETYPES`, `findWorkBundle`, `findArchetype`, etc. | `data/function` | Bundle/archetype registry |
| **Storage** | | `~/.lycero/auth.json` |

### System B — `@lycero/ai-search` (`packages/ai-search/src/lycero-auth.ts`)

| Export | Type | Notes |
|---|---|---|
| `startLyceroLogin(progressCb)` | `function` | Device code OAuth, different endpoint (`/api/office_addin_auth/device_code`) |
| `lyceroLoginInFlight()` | `function` | Same pattern |
| `ensureLyceroLogin(openUrl)` | `function` | Fire-and-forget variant |
| `loadLyceroAuth()` | `function` | Returns `{apiKey, keyId?, accessToken?}` |
| `lyceroApiKey()` | `function` | Returns API key string |
| `lyceroLogout()` | `function` | Revokes GSX key via session, clears `~/.lycero-office/auth.json` |
| `isLyceroProUser()` | `function` | Checks plan tier (reads 3 sources) |
| `getLyceroUserInfo()` | `function` | Returns `{email?, plan?, fullName?}` |
| `proRequiredErrorMessage(lang?)` | `function` | i18n error string |
| `resetLyceroAuthCache()` | `function` | Test hook |
| `lyceroProxyFallbackPreferred()` | `function` | Test hook |
| `lyceroAuthPath()` | `function` | Returns `~/.lycero-office/auth.json` path |
| `lyceroLoginProgress` | `type` | `GskLoginProgress` alias |
| `LyceroAuth` | `type` | `{apiKey, keyId?, accessToken?}` |
| `LyceroUserInfo` | `type` | `{email?, plan?, fullName?}` |
| `GskLoginProgress` | `type` | `{phase, url?, expiresInSec?, error?}` |
| **genoffice* aliases** | | `genofficeApiKey`, `startGenofficeLogin`, `loadGenofficeAuth`, etc. |
| **Storage** | | `~/.lycero-office/auth.json` (primary); also reads `~/.lycero/auth.json` (lines 133-140) and `userData/lycero/session.json` |

### System B also exports (via `gsk.ts`, `lycero-gateway.ts`, `search-tools.ts`, `media-tools.ts`)

| Export | Source | Calls auth? |
|---|---|---|
| `gskApiKey()`, `hasGskAuth()` | `gsk.ts` | Reads `lyceroApiKey()` |
| `lyceroWebSearch`, `lyceroImageSearch`, `lyceroGenerateImage`, `lyceroAnalyzeMedia`, `lyceroTranscribe` | `lycero-gateway.ts` | **Yes** — uses `lyceroApiKey()` as Bearer |
| `webSearchTool`, `imageSearchTool`, `testSearchProvider` | `search-tools.ts` | Reads `hasGskAuth()` |
| `generateImageTool`, `analyzeMediaTool`, `lyceroGate` | `media-tools.ts` | Calls `hasLyceroAuth()` from `lycero-gateway` |
| `gskLoginInfo`, `gskListPastProjects`, `gskSlideGenerate`, `gskChildEnv` | `gsk.ts` | **Yes** — all use `gskApiKey()` |
| `setGskProxyUrl`, `gskProxyUrl` | `shared.ts` | No |

### Matrix: What A has that B doesn't (and vice versa)

| Capability | System A | System B |
|---|---|---|
| Device code OAuth (Hub endpoint) | Yes (`/auth/device-code` → `/auth/token`) | Yes (`/api/office_addin_auth/device_code` → `/api/office_addin_auth/token`) |
| Email/password login | Yes (`/auth/login`) | **No** |
| Token refresh with rotation | Yes (auto on 401, single-flight) | **No** |
| `authedFetch` (auto-refresh) | Yes | **No** (uses raw `fetch` in `lycero-gateway`) |
| `fetchHubQuota`, `fetchHubModels` | Yes | **No** (would need to be added) |
| Proxy fallback fetch channel | **No** | Yes (`proxyFallbackFetch`, dual-channel) |
| Session cookie + GSX API key creation (`/api/api_tokens/create`) | **No** | Yes |
| GSX API key revocation on logout | **No** | Yes |
| `genoffice*` backward-compat aliases | **No** | Yes (8 aliases) |
| Reads `~/.lycero/auth.json` | **No** | Yes (lines 133-140 in `readAuthFile`) |
| Reads `~/.lycero-office/auth.json` | **No** | Yes (primary storage) |
| Reads `userData/lycero/session.json` | **No** | Yes (for `isLyceroProUser`) |
| Stores `accessToken` + optional `refreshToken` | Yes | Yes (but different shape: `{apiKey, keyId, accessToken?}`) |
| Work bundle / archetype registry | Yes (full) | **No** |
| i18n error strings (`proRequiredErrorMessage`) | **No** | Yes |
| Storage path | `~/.lycero/auth.json` | `~/.lycero-office/auth.json` |
| `LYCERO_AUTH_DIR` env override | Yes | Yes |

---

## 3. Storage Conflict Analysis

### 3.1 Are both files read in the same flow?

**Yes — and it already happens today.**

The `readAuthFile()` function in System B (`packages/ai-search/src/lycero-auth.ts`, lines 133-175) reads **three** sources in priority order:

```
1. process.env.LYCERO_API_KEY          (env override)
2. ~/.lycero/auth.json                 ← System A's file!
   └─ If tokens.accessToken exists: returns { apiKey: accessToken, accessToken }
3. userData/lycero/session.json        ← Bridge's encrypted session file
   └─ If session.token exists: returns { apiKey: token, accessToken: token }
4. ~/.lycero-office/auth.json           ← System B's own file
```

So when a user logs in via **System A** (Hub device code), System B's `readAuthFile()` **already reads** the Hub token from `~/.lycero/auth.json` and uses it as the API key. This is the de-facto "Option B" behavior that already exists.

### 3.2 Hub login exists, GSX key absent (current default state)

- `~/.lycero/auth.json` has `{ tokens: { accessToken }, user, ... }`
- `~/.lycero-office/auth.json` does not exist
- System A works fully (Hub quota, models, streaming)
- System B: `readAuthFile()` falls through to step 2, finds the Hub token, wraps it as `{ apiKey: accessToken, accessToken }`, and all GSX features (search, image gen, cloud projects) **work** — because `lycero-gateway.ts` sends the Hub token as `Authorization: Bearer <token>` and the Gateway apparently accepts it
- **Result: functional, but the GSX API key was never minted.** The Hub token is used directly.

### 3.3 GSX key created, Hub session logged out

- `~/.lycero-office/auth.json` has `{ api_key: "...", key_id: "...", access_token: "..." }`
- `~/.lycero/auth.json` may be absent or expired
- System B works fully (GSX API key used for all gateway calls)
- System A: `loadLyceroAuth()` returns null (no Hub token). `hasLyceroAuth()` returns false. Hub quota/models cannot be fetched. `startLyceroLogin` can re-establish the Hub session.
- **Bridge (`lycero-auth-bridge.ts`)** writes to `~/.lycero/auth.json` on every Hub login, but never reads from `~/.lycero-office/auth.json` — it does not know about GSX keys.
- **Result: GSX features work, Hub features fail.**

### 3.4 Key observation: Gateway accepts Hub tokens as API keys

The critical fact making the current system partially interoperable: `lycero-gateway.ts` sends `Authorization: Bearer <token>` with the Hub token, and the Gateway appears to accept it. This is why the "Hub token used as GSX key" fallback in System B works.

---

## 4. Unification Design (3 Options)

### Option A — Hub as Source of Truth, Derive GSX Key On Demand

**Concept:** System A (Hub) remains the single login flow. After a successful Hub device-code or email login, the bridge automatically calls `POST /api/api_tokens/create` once to mint a GSX API key, and stores it alongside the Hub token. Both subsystems read from the same Hub session.

#### Canonical source: `apps/shell/src/main/lycero-auth-bridge.ts`

All login flows (device code, email, deep link) converge here. After saving the Hub session, it calls the GSX token-creation endpoint once and caches the result.

#### What changes:

1. **`lycero-auth-bridge.ts`** — After `saveSession()`, call `POST /api/api_tokens/create` with the Hub token + session cookie to mint GSX API key. Write the result to `~/.lycero-office/auth.json`. On logout, also revoke the GSX key.
2. **`packages/ai-search/src/lycero-auth.ts`** — Strip out the redundant device-code login. Change `readAuthFile()` to read only from `~/.lycero-office/auth.json` and `~/.lycero/auth.json` (as a fallback for legacy). Remove the GSX-specific login flow (`runDeviceLogin` → session → `POST /api/api_tokens/create`).
3. **`packages/ai-search/src/lycero-gateway.ts`** — No change needed; it already reads `lyceroApiKey()` which reads from the unified store.
4. **`apps/shell/src/main/index.ts`** — Remove the `@lycero/ai-search` `startLyceroLogin` import; route everything through the bridge's IPC handlers.
5. **Keep `genoffice*` aliases** in `lycero-auth-alias.ts` — backward compat.

#### Code footprint:

| File | Est. lines changed | Kind |
|---|---|---|
| `apps/shell/src/main/lycero-auth-bridge.ts` | +60 | Add GSX key minting after Hub login |
| `packages/ai-search/src/lycero-auth.ts` | -180 (redundant login flow) | Remove GSX-specific device code |
| `apps/shell/src/main/index.ts` | -5 | Remove duplicate `startLyceroLogin` import |
| `apps/shell/src/main/shared/ipc/home.ts` | -5 | Remove duplicate import |
| `packages/ai-search/src/lycero-auth-alias.ts` | 0 | No change (aliases still needed) |
| `packages/ai-search/tests/lycero-auth.test.ts` | ~40 | Update to test unified flow |
| **Total** | ~-90 net | |

#### Migration plan (existing users):

1. On first launch after migration, if `~/.lycero/auth.json` exists but `~/.lycero-office/auth.json` does not: silently mint a GSX API key using the existing Hub token.
2. If both exist with valid tokens: use both (no change to user experience).
3. If only GSX key exists (old session): Hub login can re-establish via `startLyceroLogin`, which will then also mint a new GSX key.
4. After migration window (3 months): stop reading from `~/.lycero-office/auth.json` in System B `readAuthFile()`, require Hub token as canonical.

#### Risk if Hub/GSX server unavailable:

- **Hub login fails:** Neither system works. GSX key minting also fails (dependent).
- **Hub login succeeds, GSX mint fails:** Hub features work; GSX features fall back to reading Hub token from `~/.lycero-office/auth.json` (legacy compat path). User experience: search/image works but GSX API key field in settings shows empty. **Graceful degradation.**
- **Both servers up, GSX mint fails on first login, Hub is later unreachable:** GSX features silently use Hub token as key (current behavior, already works). **No user-visible breakage.**

#### Compatibility impact:

- `genoffice*` aliases: **keep** (Option A doesn't touch them)
- System B's proxy fallback: **keep** (it improves reliability even when using Hub token)

#### Risk rating: **LOW**. The GSX mint is additive; failure is non-breaking.

---

### Option B — GSX as Source of Truth, Derive Hub Token from API Key

**Concept:** System B (GSX) becomes the single login flow. After GSX login, the Bridge reads the GSX API key and uses it as the Bearer token for all Hub calls (`/auth/me`, `/quota/check`, `/ai/models`). The Hub endpoints must accept the GSX API key as a Bearer token.

#### What changes:

1. **`packages/ai-search/src/lycero-auth.ts`** — **Primary.** Keep the GSX device-code login flow as the single entry point.
2. **`apps/shell/src/main/lycero-auth-bridge.ts`** — Replace all Hub-specific fetch calls with GSX API key used as Bearer token. Replace `fetchHubQuota()` / `fetchHubModels()` with GSX-derived equivalents.
3. **`packages/ai-auth/src/lycero-auth.ts`** — Either delete or demote to a shim that reads from `~/.lycero-office/auth.json`.
4. **`packages/ai-auth`** — Keep type exports (`WorkBundle`, `ARCHETYPES`, etc.) and re-export from the unified auth module.
5. **`packages/ai-search/src/lycero-gateway.ts`** — No change; already uses `lyceroApiKey()` as Bearer.

#### Code footprint:

| File | Est. lines changed | Kind |
|---|---|---|
| `packages/ai-auth/src/lycero-auth.ts` | -300 or make it a shim | Major: remove or wrap |
| `apps/shell/src/main/lycero-auth-bridge.ts` | -80/+120 | Major: swap Hub calls for GSX-based calls |
| `packages/ai-auth/` (other files) | -200 (remove duplicate types) | Delete/redistribute types |
| `packages/ai-search/tests/lycero-auth.test.ts` | ~80 | Major: rewrite login flow tests |
| **Total** | ~+300 | |

#### Critical dependency: **Hub must accept GSX API key as Bearer token.**

If the Hub endpoints (`/auth/me`, `/quota/check`, `/ai/models`) only accept the OAuth Hub token and reject the GSX API key, this option **breaks all Hub features**. This must be confirmed with the backend team before proceeding.

#### Migration plan (existing users):

1. On first launch after migration: if `~/.lycero-office/auth.json` exists, use it. If only `~/.lycero/auth.json` exists, fall back to Option A behavior (mint GSX key from Hub token).
2. Users who only have a GSX key: seamless. Users who only have a Hub token: GSX login flow runs and mints a new key.

#### Risk if Hub/GSX server unavailable:

- **GSX login fails:** Neither system works. Hub-only features fail.
- **GSX login succeeds, Hub endpoints reject GSX API key:** **Catastrophic** — all Hub quota/models/licensing silently fail. No graceful fallback unless a fallback to Hub device-code flow is added.

#### Compatibility impact:

- `genoffice*` aliases: **keep**
- Proxy fallback: **keep**

#### Risk rating: **HIGH** (if Hub rejects GSX API key as Bearer). Blocked on backend confirmation.

---

### Option C — Single Auth Service, Two Credential Stores Kept in Sync

**Concept:** A new top-level `LyceroAuthService` (in `packages/ai-auth/src/`) orchestrates both credential stores. Login is a single flow that produces both a Hub OAuth token and a GSX API key atomically. Each subsystem reads its own credential format from the canonical store.

#### Architecture:

```
LyceroAuthService
  ├── login() → saves to ~/.lycero/auth.json (Hub) + ~/.lycero-office/auth.json (GSX)
  ├── logout() → revokes GSX key + clears both stores
  ├── getHubToken() → reads ~/.lycero/auth.json
  ├── getGskApiKey() → reads ~/.lycero-office/auth.json
  └── hasAuth() → true if both present (or either, with graceful fallback)
```

#### What changes:

1. **`packages/ai-auth/src/`** — New `lycero-auth-service.ts` that coordinates both stores. New `lycero-gsx.ts` that wraps GSX-specific operations (session cookie → API key mint).
2. **`packages/ai-search/src/lycero-auth.ts`** — Remove its own device-code login; call into the service.
3. **`apps/shell/src/main/lycero-auth-bridge.ts`** — Delegates to the service.
4. **`packages/ai-auth/src/lycero-auth.ts`** — Keep Hub OAuth logic; the service orchestrates.
5. **Both test suites** — Need updates.

#### Code footprint:

| File | Est. lines changed | Kind |
|---|---|---|
| `packages/ai-auth/src/lycero-auth-service.ts` (new) | +200 | New file |
| `packages/ai-auth/src/lycero-gsx.ts` (new) | +100 | New file |
| `packages/ai-auth/src/lycero-auth.ts` | ~+20 | Add service hook |
| `packages/ai-search/src/lycero-auth.ts` | -120 (remove own login) | Refactor |
| `apps/shell/src/main/lycero-auth-bridge.ts` | -40/+60 | Refactor |
| Both test suites | ~+100 | New tests |
| **Total** | ~+260 new, ~-160 modified | |

#### Migration plan:

1. On startup: detect which store(s) are present.
2. If only Hub exists: run GSX mint (graceful, as in Option A).
3. If only GSX exists: use it, Hub mint deferred until needed.
4. If neither exists: run full device code flow that produces both.

#### Risk if Hub/GSX server unavailable:

- Same graceful degradation as Option A for Hub-down scenarios.
- If GSX mint fails but Hub succeeds: Hub features work, GSX features use Hub token fallback (current behavior).

#### Compatibility impact:

- `genoffice*` aliases: **keep**
- Proxy fallback: **keep**

#### Risk rating: **MEDIUM**. Adds a new abstraction layer (the service). Ponytail concern: is the extra orchestration layer worth it, given that Options A and C are functionally equivalent?

---

## 5. Recommended Path: Option A with Selective GSX Mint

**Rationale:** The current codebase already partially implements Option A. System B's `readAuthFile()` already reads `~/.lycero/auth.json`. The only missing piece is: after a Hub login, **automatically mint the GSX API key** so both stores are populated in one shot.

### Why Option A over Option C?

Option C's "atomic dual-credential" promise is mostly illusory — the two credential stores are issued by two different backend services, and there is no server-side atomic transaction that produces both simultaneously. The real atomicity is "one user gesture → two async server calls." Option A achieves the same result with less code.

### Why not Option B?

Option B is blocked on an unconfirmed backend assumption: that Hub endpoints accept GSX API keys as Bearer tokens. Until the backend team confirms this, Option B carries a catastrophic failure mode.

### Recommended Implementation Steps (in order)

**Phase 1: Bridge augmentation (lowest risk)**

1. In `apps/shell/src/main/lycero-auth-bridge.ts`, add a function `mintGskApiKeyFromSession(session: LyceroSession): Promise<void>` that:
   - Uses the existing `establishSession()` pattern from `packages/ai-search/src/lycero-auth.ts` (lines 364-369)
   - Calls `POST /api/api_tokens/create` (lines 409-418 of `packages/ai-search/src/lycero-auth.ts`)
   - Writes result to `~/.lycero-office/auth.json`
2. Call `mintGskApiKeyFromSession()` at the end of `saveSession()` (line 139) and in `loginToLyceroHub()` (line 239). Make it fire-and-forget (non-blocking).
3. Add a `revokeGskApiKey()` call in `clearSession()`.

**Phase 2: Remove duplicate login entry points**

4. In `apps/shell/src/main/index.ts:111-114`: remove `startLyceroLogin` import from `@lycero/ai-search`; route through the bridge's IPC (`lycero:auth:startLogin`).
5. In `apps/shell/src/main/shared/ipc/home.ts:20-21`: same — remove `startLyceroLogin` from `@lycero/ai-search`, use IPC channel instead.
6. In `apps/shell/src/main/index.ts:3354`: same for the rescue login.

**Phase 3: Simplify System B's auth module**

7. In `packages/ai-search/src/lycero-auth.ts`: remove the GSX-specific device-code login flow (the `runDeviceLogin` function and the `startLyceroLogin` implementation). Keep `readAuthFile()`, `saveAuth()`, `clearAuth()`, `isLyceroProUser()`, `getLyceroUserInfo()`, `proRequiredErrorMessage()`, and all test hooks. Keep `startLyceroLogin` as a re-export that calls the bridge via IPC, OR keep it as a stub that reads from the store and warns that the login flow should go through the bridge.
8. **Keep all `genoffice*` aliases** — they cost nothing and prevent breakages in legacy code paths.

**Phase 4: Storage path canonicalization**

9. Add a migration in `readAuthFile()`: if `~/.lycero-office/auth.json` does not exist but `~/.lycero/auth.json` does, attempt the GSX mint silently (Phase 1 already handles new logins; this handles existing Hub-only users on first migration run).

**Phase 5: Verify**

10. Run `apps/shell/tests/lycero-hub-auth.test.ts` and `packages/ai-search/tests/lycero-auth.test.ts` — update as needed.
11. Manual smoke test: login via device code, verify both `~/.lycero/auth.json` and `~/.lycero-office/auth.json` are populated, verify search and Hub quota both work.

---

## 6. Risks & Unknowns

### 6.1 Questions for the Hub/GSX backend team

1. **Does the Hub Gateway (`lycero.com`) accept the GSX API key (from `POST /api/api_tokens/create`) as a Bearer token for `/auth/me`, `/quota/check`, and `/ai/models`?** This determines whether Option B is viable. Currently the codebase falls back to using the Hub OAuth token as the GSX API key, which suggests the Gateway accepts both formats — but this needs explicit confirmation.

2. **Is there a server-side endpoint to convert an OAuth Hub token to a GSX API key without re-running device-code flow?** This would make Option A more efficient (one token exchange instead of session cookie + key creation).

3. **Does `POST /api/api_tokens/create` support a parameter to reuse/mint the same key name on every login, or does it create duplicate keys?** The current code stores `previousKeyId` and revokes it (lines 427-431 of System B), but this is fragile. If the server supports key upsert by name, the client-side revocation can be removed.

4. **What is the TTL of the GSX API key?** Is it 30 days (session cookie lifetime) or longer? This affects the logout/revoke strategy.

### 6.2 Edge cases not covered by unification

1. **Simultaneous Hub logout vs. GSX features in-flight:** If a user logs out of Hub while a search is running, the GSX key (if present) should continue working. Option A handles this: GSX key persists independently. Option C (atomic sync) would also handle it. The current System B already has this protection.

2. **Hub token expired, GSX key still valid:** System B's gateway calls use the Hub token as a fallback key. If the Hub token is expired but the GSX key is still valid, the fallback would fail. Fix: after detecting a 401 on the Hub token fallback path, try the GSX key as Bearer. This should be added to `lycero-gateway.ts` regardless of which unification option is chosen.

3. **Account switching:** If a user logs out and logs in as a different Hub account, the old GSX key must be revoked before the new one is minted. Option A handles this via `previousKeyId` tracking (already implemented in System B). Ensure the bridge's `mintGskApiKeyFromSession()` preserves this behavior.

4. **Multiple app instances:** If two Lycero Office windows are open and one logs out, the other should react. The `lycero:auth:changed` IPC event (sent by `lycero-auth-bridge.ts`) already handles this.

5. **CLI tool sessions:** `packages/cli/src/cloud.ts` and other CLI tools read `~/.lycero/auth.json`. After unification, they should continue to work (the Hub token is always present). GSX-specific CLI commands should continue to read the GSX key from `~/.lycero-office/auth.json`.

### 6.3 Test strategy

#### Existing tests to update

| Test file | What changes |
|---|---|
| `packages/ai-search/tests/lycero-auth.test.ts` | Remove `startLyceroLogin` device-code test (flow moved to bridge). Keep `loadLyceroAuth` read-priority tests. Add test for GSX key minting from Hub session. |
| `apps/shell/tests/lycero-hub-auth.test.ts` | Add test for GSX key minting after `loginToLyceroHub`. |
| `apps/shell/tests/cloud-projects.test.ts` | No changes needed; already uses `gskListPastProjects` which reads from the unified store. |
| `packages/cli/tests/capabilities.test.ts` | No changes needed. |

#### New tests needed

| Test | File | Purpose |
|---|---|---|
| Bridge GSX mint integration | `apps/shell/tests/lycero-hub-auth.test.ts` | Verify `mintGskApiKeyFromSession()` is called after login |
| Storage migration | `packages/ai-auth/tests/` (new file) | Verify `~/.lycero/auth.json` → `~/.lycero-office/auth.json` migration for existing users |
| Dual-store coherence | `packages/ai-auth/tests/auth-store.test.ts` (new) | Verify both stores stay in sync after login/logout/account-switch |
| Graceful degradation | `packages/ai-search/tests/lycero-gateway.test.ts` (new) | Verify fallback from Hub token → GSX key → error when both are expired |

---

## Appendix: Key File Map

| File | Role | System |
|---|---|---|
| `packages/ai-auth/src/lycero-auth.ts` | Hub OAuth, token refresh, `authedFetch`, Hub quota/models | A (canonical) |
| `packages/ai-auth/src/index.ts` | Renderer-safe barrel: types, constants, work bundles | A |
| `packages/ai-search/src/lycero-auth.ts` | GSX OAuth, API key mint, proxy fallback | B (to be simplified) |
| `packages/ai-search/src/lycero-auth-alias.ts` | Canonical name re-exports + `genoffice*` compat | B |
| `packages/ai-search/src/lycero-gateway.ts` | Gateway HTTP calls (search, image, transcribe) — reads `lyceroApiKey()` | B |
| `packages/ai-search/src/gsk.ts` | CLI tools, `gskApiKey()`, `hasGskAuth()`, `gskChildEnv` | B |
| `packages/ai-search/src/search-tools.ts` | `webSearchTool`, `imageSearchTool` (uses `hasGskAuth()`) | B |
| `packages/ai-search/src/media-tools.ts` | `generateImageTool`, `analyzeMediaTool` (uses `hasLyceroAuth()`) | B |
| `packages/ai-search/src/index.ts` | Full package barrel re-export | B |
| `apps/shell/src/main/lycero-auth-bridge.ts` | **Orchestrator:** IPC handlers, session save, Hub calls, quota, deep links | Bridge |
| `apps/shell/src/main/lycero-cloud-sync.ts` | Cloud project sync — reads `getSession()` from bridge | Bridge |
| `apps/shell/src/main/cloud-projects.ts` | Cloud projects — reads `gskApiKey()` from `@lycero/ai-search` | Consumer |
| `apps/slides/src/main/ai-ipc.ts` | Slides AI IPC — reads `gskApiKey()`, `hasGskAuth()` | Consumer |
| `apps/sheets/src/main/sheets-main.ts` | Sheets AI IPC — reads `hasGskAuth()`, `generateImageTool` | Consumer |
| `apps/docs/src/main/docs-main.ts` | Docs AI IPC — reads `hasGskAuth()`, `generateImageTool` | Consumer |
| `packages/cli/src/cloud.ts` | CLI cloud tools — reads `setGskProxyUrl` | Consumer |
| `packages/cli/src/commands/search.ts` | CLI search command — reads `webSearchTool`, `imageSearchTool` | Consumer |
