# GĐ 10 — Lycero EdTech 11 Archetype

> **⚠️ PLANNING STAGE — NOT YET SHIPPED as of 05/10/2026.**
> The 10 archetype registry (`packages/ai-auth/src/archetypes.ts`) already exists in code.
> This plan covers wiring it into Settings UI, polymorphic theme tokens, persona prompts,
> and per-archetype templates. For scope, see `PRODUCT.md §1.1` and `PRODUCT.md §6`.

> **Ngày tạo:** 02/10/2026
> **Trạng thái:** 🟡 PLANNING — đã correct dựa trên source code thực tế
> **Update quan trọng:** 5 archetype "inferred" trong phiên bản đầu SAI — repo đã có sẵn 10 archetype definitions trong `packages/ai-auth/src/archetypes.ts`. Plan dưới đây dùng đúng cái đã có.

---

## Discovery quan trọng (đọc từ source code)

### A1. Archetype registry đã tồn tại

File `packages/ai-auth/src/archetypes.ts` đã định nghĩa **10 archetype** (id 0-9):

| # | id | key | labelVi | description |
|---|----|----|---------|-------------|
| 0 | 0 | `general_education` | Giáo dục phổ thông (mặc định) | Áp dụng cho hầu hết giáo viên; thuật ngữ GDPT 2018 / TT22. |
| 1 | 1 | `k12_public_school` | Giáo viên K-12 (trường công lập) | Bám Công văn 5512 / Thông tư 22/2021 / GDPT 2018. |
| 2 | 2 | `higher_education` | Giảng viên Đại học & Cao đẳng | Đề cương học phần tín chỉ, CLO/PLO, chuyên đề. |
| 3 | 3 | `language_test_prep` | Giáo viên Ngoại ngữ & Khảo thí Quốc tế | IELTS / TOEIC / TOEFL / HSK; chuẩn CEFR; PPP/TBL. |
| 4 | 4 | `vocational_corporate` | Dạy nghề & Đào tạo doanh nghiệp | SOP, workshop, rubric năng lực thực hành. |
| 5 | 5 | `independent_tutor` | Gia sư tự do & Micro-school | 1-on-1, lộ trình cá nhân hóa, báo cáo phụ huynh. |
| 6 | 6 | `early_childhood` | Giáo viên Mầm non & Tiểu học | Trực quan, trò chơi giáo dục, kích thích giác quan. |
| 7 | 7 | `postgraduate_academic` | Nghiên cứu sinh & Sau đại học | Tổng quan tài liệu, APA/IEEE, liêm chính học thuật. |
| 8 | 8 | `stem_lab_lead` | Tổ trưởng chuyên môn STEM / Tổ Vật lý | Thực hành, thí nghiệm, ma trận đề chuyên sâu. |
| 9 | 9 | `homeroom_class_teacher` | Giáo viên Chủ nhiệm lớp | Sổ chủ nhiệm, sinh hoạt lớp, kết nối phụ huynh. |

### A2. Auth state đã có `archetypeId` field

```ts
// packages/ai-auth/src/lycero-auth.ts
interface LyceroAuth {
  tokens: LyceroAuthTokens
  user: LyceroUser
  orgId?: string
  archetypeId?: number   // ← ĐÃ có sẵn
}
```

### A3. Tests đã có

`packages/ai-auth/tests/archetypes.test.ts` đã test 7 cases (default, unique, lookup, fallback).

### A4. Auth flow đã có

- `startLyceroLogin()` — Device Code flow với Lycero OAuth backend
- `loginWithEmail()` — Email/password
- `refreshAndGetToken()` — Auto-refresh khi 401
- Backend endpoint: `https://lycero.com/api/v1/office/auth/*`

**→ Kết luận: GĐ 10 không phải "build từ zero" mà là "wire những gì đã có vào UI/UX/Settings".**

---

## Mục tiêu 4 sub-stage (rút từ 6 xuống)

### GĐ 10.1 — Wire archetype vào Settings UI (P1, ~1.5 ngày)

**Trạng thái:** Nhiều infrastructure đã có (registry, tests, auth field). Cần wire UI + Settings.

**Tasks:**
- 10.1.1 Tạo `apps/shell/src/renderer/src/components/ArchetypeSwitcher.tsx` (dropdown hiển thị 10 archetype)
- 10.1.2 Reuse `findArchetype()` + `findArchetypeByKey()` từ `@lycero/ai-auth` — KHÔNG redefine
- 10.1.3 Thêm vào `SettingsModal.tsx` section "Lycero EdTech" với:
  - Hiển thị archetype hiện tại (từ `loadLyceroAuth().archetypeId`)
  - Switch dropdown
  - Nút "Đồng bộ với Lycero EdTech" (theo AGENTS.md §1.4) — gọi `fetchHubQuota()` + `fetchHubModels()` để verify
- 10.1.4 Tạo IPC channel `edtech:switch-archetype` trong `apps/shell/src/main/shared/ipc/edtech.ts`
- 10.1.5 Wire IPC handler trong `apps/shell/src/main/index.ts` — persist `archetypeId` vào auth file
- 10.1.6 Add 10 i18n keys archetype name (chỉ vi + en, fallback en cho các locale khác) trong `apps/shell/src/renderer/src/strings.ts`

### GĐ 10.2 — Polymorphic Theme Tokens (P1, ~1 ngày)

**Tasks:**
- 10.2.1 Thêm `[data-archetype="k12_public_school"]` (và 9 các) vào `packages/ui/src/tokens.css` — override accent color per archetype
- 10.2.2 Ví dụ: K-12 → giữ Warm Terracotta (`#8B3A1A`); Higher-Ed → sandy/golden; Early-Childhood → soft pink/peach
- 10.2.3 Set `data-archetype` attribute trên `<html>` khi user switch (gọi từ `ArchetypeSwitcher.tsx`)
- 10.2.4 Animation: 200ms `cubic-bezier(0.16, 1, 0.3, 1)` cross-fade giữa themes

### GĐ 10.3 — Lycero Mate Persona theo System Prompt (P1, ~1.5 ngày)

**Tasks:**
- 10.3.1 Tạo `packages/agent-core/src/persona.ts` với function `getSystemPromptForArchetype(archetypeId)` → return system prompt persona list cho Lycero gpt-4o-mini
- 10.3.2 System prompt theo archetype (vd K-12: "Bạn là trợ lý sư phạm cho giáo viên Việt Nam, am hiểu Công văn 5512, Thông tư 22/2021...")
- 10.3.3 Wire vào `packages/agent-core/src/loop.ts` — khi gọi LLM, prepend system prompt theo archetype hiện tại
- 10.3.4 Mỗi archetype có 1 system prompt riêng (10 × ~200 tokens)

### GĐ 10.4 — Templates per Archetype (P2, ~2 ngày)

**Tasks:**
- 10.4.1 Mỗi archetype có 3-5 templates mặc định (.docx structure schema)
- 10.4.2 Templates dùng `docx-engine` (đã có) — chỉ tạo file JSON config per archetype
- 10.4.3 Tạo `apps/shell/src/main/skills/edtech-templates/{k12-public-school, higher-education, language-test-prep, ...}.json` (10 files)
- 10.4.4 `apps/shell/src/renderer/src/components/TemplateGallery.tsx` — grid hiển thị templates per archetype
- 10.4.5 Click template → mở Docs với structure sẵn

---

## Effort estimate

| Sub-stage | Effort | Files touched | Risk |
|-----------|--------|---------------|------|
| 10.1 Wire UI | 1.5 days | ~5 | LOW (reuse existing registry) |
| 10.2 Theme tokens | 1 day | ~4 | LOW (CSS-only) |
| 10.3 Persona prompts | 1.5 days | ~5 | MED (LLM integration) |
| 10.4 Templates | 2 days | ~12 | MED (template content) |
| **GĐ 10 total** | **~6 days** | **~26 files** | **MED** |

> Giảm từ 11 ngày → 6 ngày vì reuse existing `archetypes.ts` + AUTH flow.

---

## Files sẽ tạo/sửa

### Sửa (existing)
- `apps/shell/src/renderer/src/SettingsModal.tsx` — thêm Lycero EdTech section
- `apps/shell/src/main/index.ts` — wire IPC handler
- `apps/shell/src/main/lycero-auth-bridge.ts` — extend với archetype save/load
- `packages/ui/src/tokens.css` — thêm archetype theme variants
- `packages/agent-core/src/loop.ts` — prepend persona system prompt
- `apps/shell/src/renderer/src/strings.ts` — thêm 10 i18n keys (vi + en)

### Tạo mới
- `apps/shell/src/renderer/src/components/ArchetypeSwitcher.tsx`
- `apps/shell/src/main/shared/ipc/edtech.ts`
- `packages/agent-core/src/persona.ts`
- `apps/shell/src/main/skills/edtech-templates/*.json` (10 files)
- `apps/shell/src/renderer/src/components/TemplateGallery.tsx`
- `docs/USER_GUIDE_EDTECH.md`

---

## Risks + Giải pháp

| Risk | Giải pháp |
|------|-----------|
| 10 i18n keys × 21 locales effort lớn | Phase 1 chỉ vi + en, các locale khác fallback en (đã có sẵn) |
| LLM prompt quality test | 10.3 dùng 1 archetype K-12 E2E trước, nếu OK mới mở rộng |
| Template content cần SME | Dùng public templates (Công văn 5512 PDF, IB EE guide PDF) |
| Theme animation có thể gây CLS | Test thực tế trong 10.2 — nếu CLS > 0 dùng solid color swap |

---

## Next steps (launch worker ngay)

1. ✅ User đã chốt scope GĐ 10 (10 archetype từ `archetypes.ts`)
2. ✅ JWT re-purposed từ existing `archetypeId: number` field
3. ✅ Theme animation: 200ms cubic-bezier (impeccable.md standard)
4. ✅ i18n phase 1: vi + en, fallback en

→ **Launch worker GĐ 10.1 ngay (Wire Archetype vào Settings UI)**

---

## Liên kết

- `packages/ai-auth/src/archetypes.ts` — existing 10 archetype definitions
- `packages/ai-auth/src/lycero-auth.ts` — auth flow có archetypeId field
- `apps/shell/src/main/lycero-auth-bridge.ts` — shell bridge
- `AGENTS.md` §1.4 — Polymorphic Architecture spec