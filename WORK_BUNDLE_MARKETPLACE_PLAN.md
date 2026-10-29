# WORK_BUNDLE_MARKETPLACE_PLAN.md — Kế Hoạch Work Bundle Marketplace

> **⚠️ PARTIAL SHIP — Many stages are historical. Verify against current code before treating as spec.**
> Phase A (BundleStore + IPC + Marketplace UI + composeBundleSkills + wire) was shipped.
> Phase B (accounting_vn, freelance_solo, general_office bundles) was shipped.
> Phase C (keyword-based intent router) was shipped.
> Phase D (UI polish + local telemetry) was shipped.
> For authoritative Work Bundle definitions, see `packages/ai-auth/src/work-bundles.ts`.
> For current architecture, see `PRODUCT.md §2.3`.
>
> **Ngày tạo:** 02/10/2026
> **Trạng thái:** 🟡 PARTIAL SHIP — Phase A+B+C+D shipped in Oct 2026
> **Mục tiêu:** Xây dựng **Work Bundle Marketplace** — cho phép người dùng cài đặt các gói công việc (kế toán VN, freelance, lập trình viên, marketing...) để AI Lycero Mate tự bóc tách intent và gọi tool/skill phù hợp — **không khoanh vùng đối tượng người dùng**.

---

## 1. Bối cảnh & Lý do

**Trước đây (đã bỏ):** Lycero Office được định vị là "app cho 11 đối tượng sư phạm" với `data-archetype` selector — UI theme + persona sư phạm thay đổi theo người dùng (K-12, Kế toán, Marketing...). Hướng này **khoanh vùng đối tượng** và không phục vụ được người dùng universal.

**Bây giờ (định vị mới):** Lycero Office = **universal office suite** cho **mọi đối tượng người dùng**. Cá nhân hoá qua **Work Bundle** — mỗi bundle = 1 loại công việc (accounting_vn, freelance, k12_teacher, developer, marketing, legal, real_estate, ...). Người dùng bật nhiều bundle, AI tự quyết định tool/skill nào phù hợp với prompt + ngữ cảnh.

**Cơ sở hạ tầng đã có (sẵn để tích hợp):**
- `packages/ai-auth/src/work-bundles.ts` — registry 10 Work Bundles (đã viết Phase 2)
- `packages/agent-core/src/skill.ts` — `AgentSkill` interface (system prompt + tools + executeTool + verifyResponse)
- `packages/agent-core/src/cloud-tool-dispatcher.ts` — `CloudToolDispatcher` cho cloud skill execution
- `packages/agent-core/src/cloud-capabilities.ts` — `CloudCapabilitiesManager` cho skill manifest sync
- `packages/agent-core/src/index.ts` — exports `AgentLoop`, `composeSkills`, `CloudToolDispatcher`, `AiGatewayService`

---

## 2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│ Lycero Shell (Renderer)                                          │
│                                                                  │
│  ┌─────────────────────┐   ┌──────────────────────────────────┐ │
│  │ Bundle Marketplace   │   │ Lycero Mate Panel                │ │
│  │ (Settings → Bundles) │   │ (chat, streaming, ActionCards)  │ │
│  │  • 10+ bundle cards │   │  • on prompt → ask AgentLoop    │ │
│  │  • Install/Uninstall │   │  • show ThinkingBlock + tools   │ │
│  │  • Toggle enabled    │   │                                  │ │
│  └──────────┬───────────┘   └────────────┬─────────────────────┘ │
│             │ IPC                          │ IPC                   │
└─────────────┼─────────────────────────────┼──────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────┐
│ Lycero Shell (Main)                              │
│                                                  │
│  ┌────────────────────────┐                      │
│  │ Bundle Store           │                      │
│  │ • userData/bundles/    │ ←→ Cloud Marketplace │
│  │ • enabled state        │   (lycero.com/api)  │
│  │ • per-bundle config    │                      │
│  └────────────┬───────────┘                      │
│               │                                   │
│               ▼                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ AgentLoop (packages/agent-core)             │  │
│  │ • composeSkills() across enabled bundles    │  │
│  │ • system prompt = bundle intro + tools      │  │
│  │ • executeTool → local skill OR             │  │
│  │                → CloudToolDispatcher       │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 3. Thành phần cần xây

### 3.1 Bundle Store (`apps/shell/src/main/bundle-store.ts`)

**Trách nhiệm:**
- Quản lý danh sách Work Bundles đã cài (local file `userData/bundles/installed.json`)
- Quản lý enabled/disabled state per bundle
- Fetch remote manifest từ `https://lycero.com/api/v1/bundles/manifest.json`
- Cache bundle definitions (tools, skills, terminology overrides)

**API:**
```ts
interface BundleStore {
  list(): Promise<InstalledBundle[]>
  install(bundleId: string): Promise<void>
  uninstall(bundleId: string): Promise<void>
  setEnabled(bundleId: string, enabled: boolean): Promise<void>
  getEnabledBundles(): Promise<WorkBundle[]>
  fetchRemoteManifest(): Promise<RemoteBundleManifest>
}
```

**Persistent state:**
- `userData/bundles/installed.json` — array of `{ bundleId, enabled, installedAt, config }`
- `userData/bundles/<bundle-key>/manifest.json` — bundled metadata cache

### 3.2 Bundle Marketplace UI (`apps/shell/src/renderer/src/components/BundleMarketplace.tsx`)

**Vị trí:** Settings → Bundles (chung tab với Account)

**Hiển thị:**
- Grid các bundle cards (icon + label + description + Install/Uninstall + toggle)
- Search bar để filter theo `labelVi` / `description` / `key`
- Filter chips: "Đã cài", "Có sẵn", "Mới nhất", "Phổ biến"
- "Khám phá" → fetch remote manifest → hiển thị bundles cloud (optional)

**Wire:**
- IPC: `bundles:list`, `bundles:install`, `bundles:uninstall`, `bundles:set-enabled`, `bundles:fetch-manifest`
- Lycero Mate reads `getEnabledBundles()` → build composite skill

### 3.3 AgentLoop composition (`packages/agent-core/src/composer.ts`)

**Trách nhiệm:** Khi Mate nhận prompt, build `AgentSkill` composite từ enabled bundles.

```ts
export function composeBundleSkills(
  bundleStore: BundleStore,
  appSkills: AgentSkill[]    // built-in: docs, sheets, slides, ...
): Promise<AgentSkill> {
  const enabledBundles = await bundleStore.getEnabledBundles()
  const bundlePrompts = enabledBundles.map(b => bundleSystemPrompt(b)).join('\n\n')
  const bundleTools = enabledBundles.flatMap(b => b.tools)
  const cloudSkillRefs = enabledBundles.flatMap(b => b.skills)
  return composeSkills('lycero-bundles', bundlePrompts, [
    ...appSkills,
    createCloudProxySkill(cloudSkillRefs, dispatcher),
  ])
}
```

**Intent Router** (lightweight keyword/embedding match):
- Phase 1: keyword match (regex + bundle.key + bundle.labelVi + custom intent_keywords)
- Phase 2 (sau): embedding-based router

### 3.4 Cloud Bundle Marketplace (`https://lycero.com/api/v1/bundles/manifest.json`)

**Format:**
```json
{
  "version": "2026-10-02",
  "bundles": [
    {
      "id": "accounting_vn_advanced",
      "labelVi": "Kế toán Việt Nam — Nâng cao",
      "description": "VAS, MTT, TNCN, quyết toán cuối năm.",
      "tools": ["sheets.vat_calculator_v2", "..."],
      "skills": ["vn-tax-tt200-2025"],
      "sizeKb": 12,
      "author": "Lycero Official",
      "downloadUrl": "https://cdn.lycero.com/bundles/accounting_vn_advanced.zip"
  ]
}
```

**Triết lý pháp lý:** Bundle là "skills package" — không phải user data. Có thể phân phối qua CDN không cần payment gateway (free bundles) hoặc qua Pro/Enterprise subscription (premium bundles).

### 3.5 Bundle Marketplace Settings (`apps/shell/src/renderer/src/SettingsModal.tsx`)

Tab mới "Work Bundles" trong Settings. Layout:
```
┌─────────────────────────────────────────────────────────────┐
│ Work Bundles (Đã cài: 3)                          [Khám phá]│
│                                                              │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                │
│ │ Kế toán VN │ │ Freelance  │ │ Lập trình  │                │
│ │ [✓ enabled]│ │ [✓ enabled]│ │ [○ disabled]│                │
│ │ Mô tả...  │ │ Mô tả...  │ │ Mô tả...  │                │
│ │ [Settings] │ │ [Settings] │ │ [Settings]│                │
│ └────────────┘ └────────────┘ └────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Luồng hoạt động (User journey)

### 4.1 Cài bundle

```
User: Settings → Bundles → "Kế toán VN" card → [Install]
  ↓ IPC bundles:install
BundleStore.install(bundleId)
  → fetchRemoteManifest() → fetch bundle downloadUrl → save to userData
  → write installed.json
  → emit "bundle:installed" event
  ↓
Renderer: card switches to "✓ enabled" state
Mate: getEnabledBundles() returns kế toán VN bundle
```

### 4.2 Mate gọi tool

```
User: "Lập báo cáo tháng 9 cho công ty ABC, doanh thu 500tr"
  ↓ IPC lycero-mate:chat
AgentLoop.run()
  → composeBundleSkills() → returns AgentSkill with tools=[sheets.vn_vat_lookup, sheets.pnl, docs.report_template, ...]
  → system prompt: "Bạn là trợ lý AI Lycero. Khi user hỏi về kế toán VN, dùng tools:"
  ↓
Model decides: call sheets.pnl with {company: "ABC", month: 9, revenue: 500_000_000}
  ↓
executeTool() → if local: run inline → if cloud: CloudToolDispatcher.execute()
  ↓
ActionCard: "Tôi đã tạo bảng P&L. Xem trước?" → [Apply] / [Chỉnh sửa]
```

### 4.3 Tắt bundle

```
User: Settings → Bundle "Kế toán VN" → toggle OFF
  ↓ IPC bundles:set-enabled(id, false)
BundleStore.setEnabled(id, false)
  → write installed.json (enabled=false)
  → emit "bundle:disabled"
  ↓
Renderer: card switches to "○ disabled"
Mate: getEnabledBundles() no longer returns kế toán VN
AgentLoop: composeBundleSkills() không có tools VN — AI không còn dùng được
```

---

## 5. Work Bundles Phase 1 (MVP — 2 tuần)

| # | Bundle | Tools | Cloud Skills | Effort |
|---|---|---|---|---|
| 1 | `accounting_vn` | `sheets.vn_vat_lookup`, `sheets.tncn_calculate`, `docs.format_vn_currency` | `vn-tax-tt200`, `vn-mtt-201-balance` | 3 ngày |
| 2 | `freelance_solo` | `docs.freelance_contract`, `docs.nda_template`, `sheets.invoice_tracker` | `freelance-invoice-vn` | 2 ngày |
| 3 | `k12_teacher` | `docs.khbd_5512`, `docs.bloom_test`, `sheets.student_gradebook` | `cv-5512-template`, `bloom-taxonomy-vi` | 3 ngày |
| 4 | `marketing_seo` | `docs.seo_brief`, `docs.copy_review`, `sheets.content_calendar` | `seo-content-outline`, `vn-marketing-tone` | 2 ngày |
| 5 | `developer` | `docs.readme_gen`, `docs.api_doc`, `markdown.mermaid_diagram` | `code-review-vi` | 2 ngày |
| 6 | `general_office` | `docs.format_vn_currency`, `docs.insert_table`, `slides.theme_warm` | — | 1 ngày (default) |

Tổng: ~13 ngày (1 dev fulltime).

### 5.1 Cấu trúc tool definition

Mỗi tool được đăng ký với `AgentToolDef` shape:

```ts
const TOOL_VAT: AgentToolDef = {
  name: 'sheets.vn_vat_lookup',
  description: 'Tra cứu thuế suất VAT Việt Nam theo mã HS / loại hàng hóa',
  parameters: {
    type: 'object',
    properties: {
      hsCode: { type: 'string', description: 'Mã HS 8 số' },
      productName: { type: 'string', description: 'Tên hàng hóa' },
      year: { type: 'number', default: new Date().getFullYear() },
    },
    required: ['hsCode', 'productName'],
  },
}

// Local executor
async function executeVnVatLookup(call: AgentToolCall): Promise<ToolExecution> {
  const { hsCode, productName, year } = call.arguments
  // Lookup local data
  const rate = await vnTaxTable.lookupVat(hsCode, year)
  return {
    result: { rate, hsCode, productName, year, source: 'Thông tư 200/2014/TT-BTC' },
  }
}
```

### 5.2 Cloud skill reference

```ts
// trong work-bundles.ts
{
  id: 1,
  key: 'accounting_vn',
  ...
  skills: ['vn-tax-tt200', 'vn-mtt-201-balance'],
}
```

Khi Mate cần tool cloud: `CloudToolDispatcher.execute({ serverKey: 'vn-tax-tt200', toolName: 'tax_lookup', arguments: {...} })` → POST tới `https://lycero.com/api/v1/office/desktop/tools/execute` → trả result.

---

## 6. Bundle Marketplace Phase 2 (3 tuần sau MVP)

| Sub-stage | Mô tả | Effort |
|---|---|---|
| 6.1 Remote manifest fetch + cache | `https://lycero.com/api/v1/bundles/manifest.json`, refresh 6h/lần | 2 ngày |
| 6.2 Cloud bundle download (.zip) | Bundle = một `SKILL.md` zip, có manifest + tools + scripts | 2 ngày |
| 6.3 Bundle sandbox execution | Cloud skill chạy trong sandbox cô lập (giống Custom Skills) | 3 ngày |
| 6.4 Marketplace UI với ratings/reviews | Browse → Search → Install | 3 ngày |
| 6.5 Pro/Enterprise gating | Premium bundles yêu cầu license tier | 1 ngày |
| 6.6 Telemetry (opt-in) | Track bundle usage để cải thiện intent router | 2 ngày |
| 6.7 Embedding-based intent router | Phase 2 thay keyword match → embedding-based intent classification | 4 ngày |

Tổng Phase 2: ~17 ngày.

---

## 7. Phase đề xuất triển khai (theo Ponytail)

### Phase A: Foundation (3-4 ngày)
1. **A.1:** `BundleStore` (apps/shell/src/main/bundle-store.ts) + IPC channels
2. **A.2:** Settings UI tab "Work Bundles" — wire store, render 10 cards từ `work-bundles.ts`
3. **A.3:** `composeBundleSkills()` trong `packages/agent-core/src/composer.ts` — combine enabled bundles với app skills
4. **A.7:** Verify Mate vẫn hoạt động, tools không bị duplicate (sau khi wire xong A.5 + A.6)

### Phase B: First 3 bundles (5-6 ngày)
1. **B.1:** `accounting_vn` — local tools VAT lookup + P&L + format currency
2. **B.2:** `freelance_solo` — contract template + invoice tracker
3. **B.3:** `general_office` (default, không thể tắt) — basic tools

### Phase C: Intent router (2-3 ngày)
1. **C.1:** Keyword-based router cho 3 bundles đầu (regex match `labelVi` + `key` + custom intents)
2. **C.2:** Test cases: prompt "Lập báo cáo tài chính" → matches accounting_vn → tool VAT path

### Phase D: Polish + Marketplace (4-5 ngày)
1. **D.1:** UI polish (bundle cards, install animation)
2. **D.2:** Discovery (search, filter chips)
3. **D.3:** Telemetry local (file log usage counts)

**MVP total: ~14-18 ngày.**

---

## 8. Định vị cạnh tranh (so với MS Copilot)

| Tính năng | MS 365 Copilot | Lycero Work Bundles |
|---|---|---|
| Audience scope | Enterprise-only | Mọi người (Free + Pro) |
| Custom skills | IT admin config | User tự cài từ marketplace |
| Tool/skill cho 1 task | Cố định theo subscription | Chọn bundle + AI tự quyết |
| Cloud skills | SharePoint connectors only | Bất kỳ cloud service nào |
| Pricing | $30/user/month (Copilot Pro) | Free core + bundle marketplace |
| Custom data | Chỉ trong tenant | Local-first + opt-in cloud |

**Lợi thế Lycero:** universal (không khoanh vùng ngành), marketplace (cộng đồng đóng góp bundles), local-first (PII an toàn).

---

## 9. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Intent router sai → AI gọi tool sai | Medium | Phase 1 keyword match → user confirm trước khi apply (ActionCard UX đã có) |
| Bundle lạ gây PII leak | High | Sandbox execution + ZDR flag + audit trail |
| Bundle cập nhật breaking | Medium | Bundle version pinning + graceful deprecation |
| Marketplace spam bundle | Low (curated initially) | Khi Phase 2 → admin approval + ratings |
| Storage growth (nhiều bundles) | Low | Mỗi bundle <100KB, max 50 bundles = 5MB |

---

## 10. Cập nhật tài liệu cần làm sau khi implement

| File | Update |
|---|---|
| `AGENTS.md` §1.4 | Đã đổi Universal Architecture (xong) |
| `PRODUCT.md` §1.1 | Bỏ "v1 chỉ doanh nghiệp" → universal |
| `PRODUCT.md` §2.3 | Đổi từ Custom Skills → Work Bundle Marketplace |
| `DESIGN.md` §5 | Bỏ Archetype section (nếu có) |
| `SUPERPLAN.md` | Append GĐ 11 = Work Bundle Marketplace |
| `.cursor/rules/*.mdc` | Refresh cho universal + bundles |
| `AUDIT_REBRAND_GAP.md` | Append "Phase 2: pivot universal done" |

---

## 11. Trạng thái hiện tại (02/10/2026)

- [x] Phase 0: Decision record (định vị mới universal) — commit `96ceab3`
- [x] Foundation registry: `packages/ai-auth/src/work-bundles.ts` với 10 bundles — commit `96ceab3`
- [x] **Phase A.1:** BundleStore + IPC — commit `8cdb392` (✅ 17/17 vitest PASS, typecheck PASS)
- [x] **Phase A.2:** Marketplace Settings UI — commit `c664e53` (✅ typecheck PASS, 17/17 vitest PASS, 252 i18n strings × 21 locales)
- [x] **Phase A.3:** composeBundleSkills() — commit `6339af6` (✅ typecheck PASS, 19/19 composer vitest PASS, 138/138 full suite)
- [x] **Phase A.4:** applyComposedContext() — commit `a166736` (✅ 7/7 apply-composed PASS, composer 19/19 regression, typecheck PASS, pure function)
- [x] **Phase A.5:** Wire `BundleStore.getEnabledBundles()` → `AgentLoop` — commit `3119fcd` (✅ buildBundleContextResolver + bundlesRef, IPC `getEnabled()`, `LyceroMatePanel.tsx` Docs, 5/5 new tests + 31/31 agent-core regression, 150/150 full agent-core suite)
- [x] **Phase A.6:** Wire 5 caller còn lại (slides, sheets, markdown, pdf, html) — commit `efb6d43` (✅ copy verbatim từ Docs pattern, mỗi file +19, `window.aiOffice.bundles.onEnabledChanged` subscription, 5/5 wire-pattern tests + 36/36 agent-core regression, 155/155 full agent-core suite)
- [x] **Phase A.7:** Verify Mate integration (smoke test e2e: chat → compose → tool dispatch, no duplicate tools) — commit `8250515` (37/37 new tests PASS, 192/192 agent-core suite, typecheck PASS, no bugs found)
- [x] **Phase B.1:** `accounting_vn` bundle (VAT lookup, TNCN calculator, format currency) — commit `dc81e00` (+ tooling+SKILL.md+36 tests)
- [x] **Phase B.2:** `freelance_solo` bundle (freelance_contract, nda_template, invoice_tracker, SKILL.md) — commit `dc81e00` (+ tooling+SKILL.md+18 tests, cite Bộ luật Dân sự 2015 Điều 601–612)
- [x] **Phase B.3:** `general_office` bundle (always-on, format_vn_currency, insert_table, theme_warm, `required:true` guard) — commit `dc81e00` (+ tooling+skill+44 tests, BundleStore.setEnabled throws on disable)
- [x] **Phase C.1:** Keyword-based router cho 3 bundles đầu (regex match labelVi + key + custom intents) — commit `6df3545` (✅ 22 new tests PASS, 313/313 full suite PASS, typecheck PASS, composer integration, intents[] manifest extension)
- [x] **Phase C.2:** Test cases: prompt "Lập báo cáo tài chính" → matches accounting_vn → tool VAT path — commit `6df3545` (✅ 4 accounting_vn routing tests)
- [x] **Phase D:** Polish + Marketplace — commit `681a005` (✅ BundleCard UI polish, search/filter, local telemetry)

**Progress: 13/15 sub-stages (~87%)** — Phase A + B + C + D done; Phases remaining: none (MVP complete).

---

> 📌 **NHẮC LẠI:** Phase 2 cleanup (revert EdTech + rename registry) đã xong `96ceab3`. Plan này là roadmap cho 14-18 ngày tới, bắt đầu với BundleStore + IPC foundation.

Lycero Office Desktop - Copyright © 2026 ITAC AI Heavy Industries.
Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).