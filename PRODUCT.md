# PRODUCT.md — Bản Định Vị Sản Phẩm & Định Vị Kinh Doanh (SSOT)

> **Nguồn sự thật duy nhất (SSOT)** cho định vị sản phẩm, mô hình kinh doanh, và phạm vi tính năng.
> Mọi thành viên đội ngũ phát triển, AI Agents, kỹ sư thiết kế và đội ngũ pháp lý
> phải tuân thủ tài liệu này trước khi lập trình, tái cấu trúc hoặc phát hành tính năng mới.
>
> **Về nội dung đã được dời sang tài liệu chuyên biệt:**
> - Thiết kế chi tiết giao diện → `DESIGN.md`
> - Quy tắc AI Agent cho developer → `AGENTS.md`
> - Pháp lý & bản quyền → `LEGAL_AND_IP_COMPLIANCE.md`
> - Bảo mật → `SECURITY.md`
> - Kiến trúc kỹ thuật → `TECHNICAL_ARCHITECTURE_REVIEW.md`
> - Các quyết định sản phẩm đang chờ owner → `docs/PRODUCT_DECISIONS.md`
>
> **Về copyright GenOffice:** Giữ nguyên `Copyright © 2026 Mainfunc, Inc.` trên mọi file kế thừa GenOffice.
> Xem `AGENTS.md §2` và `LEGAL_AND_IP_COMPLIANCE.md` để biết chi tiết.

---

## 1. Định Vị Sản Phẩm

**Lycero Office** là bộ ứng dụng văn phòng mã nguồn mở thế hệ mới cho Windows,
macOS và Linux — **lựa chọn văn phòng mặc định miễn phí** cho cá nhân, doanh
nghiệp vừa và tổ chức lớn đang tìm kiếm giải pháp thay thế phần mềm trả phí.

- **Bộ máy biên tập cốt lõi miễn phí vĩnh viễn (Free Forever):** Mọi tính năng
  tạo, mở, chỉnh sửa, lưu và in tài liệu `.docx / .xlsx / .pptx / .pdf / .md / .html`
  hoạt động 100% offline, không cần đăng nhập, không quảng cáo, không watermark.
- **Trợ lý AI Lycero Mate:** Khung trợ lý AI tích hợp bên phải màn hình, hỗ trợ
  streaming reasoning, thẻ hành động (`ActionCardData`), chọn mô hình động
  (`fetchRemoteModels`).
- **Thương hiệu độc lập:** "Lycero" và "Lycero Office" thuộc sở hữu của
  **ITAC AI Heavy Industries**, không liên kết với bất kỳ tổ chức nào khác.

### 1.1. Phạm Vi Phát Hành v1 & Lộ Trình Dài Hạn

Lycero Office v1 phục vụ **mọi đối tượng người dùng** — cá nhân, doanh nghiệp,
giáo dục, freelance, công chức, kế toán, lập trình viên, marketing, pháp lý,
bất động sản — thông qua kiến trúc **Work Bundle Marketplace**.

Các hệ thống EdTech (11 archetype sư phạm, kho mẫu KHBD 5512, kết nối
`lycero-office://sync`) **đã có sẵn trong code** và được kích hoạt qua Work
Bundle hoặc đăng nhập tài khoản Lycero EdTech. Không có ranh giới "v1 chỉ
doanh nghiệp".

**Tầm nhìn dài hạn (Phase 2+):**
- Hệ sinh thái Lycero EdTech trên `lycero.com` với deep-link
  `lycero-office://sync?token=<JWT>`
- Bổ sung archetype sư phạm (hiện registry `work-bundles.ts` có 10, gồm
  `k12_teacher` và `higher_ed`; mục tiêu roadmap là 11)
- On-premise Model Gateway cho Enterprise

---

## 2. Mô Hình Sản Phẩm & Cơ Chế Kinh Doanh

### 2.1. Bộ Máy Cốt Lõi Miễn Phí Trọn Đời

Toàn bộ các bộ máy xử lý định dạng chuẩn ISO/IEC 29500 (OOXML) và mở:

| App | Định dạng | Tính năng |
|---|---|---|
| Lycero Docs | `.docx`, `.lmd`, `.txt` | Soạn thảo WYSIWYG, phân trang A4, font metric chính xác |
| Lycero Sheets | `.xlsx`, `.csv`, `.tsv` | Bảng tính công thức, sidecar Rust, tabular figures |
| Lycero Slides | `.pptx` | Trình chiếu 16:9, xuất PDF headless |
| Lycero PDF | `.pdf` | Đọc, ghi chú, chỉnh sửa byte-level |
| Lycero Markdown | `.md` | Soạn thảo + live preview |
| Lycero HTML | `.html` | Soạn thảo WYSIWYG |

**Cam kết:** Người dùng không có tài khoản hoặc không có Internet vẫn dùng toàn
bộ tính năng trên 100% miễn phí, vĩnh viễn, bảo mật tuyệt đối trên máy cá nhân.

### 2.2. Cơ Chế Hạn Ngạch & Phân Cấp Mô Hình AI

> **Trạng thái triển khai thực tế (10/2026):**
> Lycero Hub API hiện tại metering theo **số lượt yêu cầu** (`x-ratelimit-remaining`
> header), không theo token đầu vào/đầu ra. Interface `HubQuota` trả về
> `{used, limit, resetAt}`. Quyết định meter theo token (input/output/cached) là
> **chưa triển khai** — xem `docs/PRODUCT_DECISIONS.md` §1.

| Hạng | Định mức AI | Yêu cầu |
|---|---|---|
| **Miễn phí (Free)** | Định mức tháng do Lycero Hosted Gateway cấp. Không cần tài khoản. Model: mặc định do Hub trả về. | Không |
| **Pro (BYOK)** | Mở khóa "Bring Your Own Key" — kết nối OpenAI / Anthropic / Gemini / DeepSeek / Groq / Ollama / LM Studio / on-premise gateway; kích hoạt mô hình suy luận sâu (DeepSeek-R1, Claude Thinking, Gemini Thinking, OpenAI o-series) | Tài khoản Pro |
| **Enterprise** | Định mức tập trung cho cả tổ chức, Lycero Model Gateway on-premise, Zero Data Retention (ZDR), bảng điều khiển quản trị | License Enterprise |

**Cơ chế metering:** Định mức được tính theo **số lượt yêu cầu** (request count)
gửi qua Lycero Hosted Gateway. Mỗi lượt yêu cầu AI (1 chat message, 1 streaming
turn) trừ 1 đơn vị khỏi định mức còn lại. Chu kỳ reset theo tháng dương lịch.
Các con số cụ thể (Free-tier cố định, Pro-tier giới hạn, Enterprise quota tập
trung) xem `docs/PRODUCT_DECISIONS.md` §1.

**Free-tier safety:** `getAiProviders()` chỉ trả về BYOK-capable providers khi
tài khoản đã xác thực tier ≥ Pro. Client-side gating này là defense-in-depth;
Lycero Gateway vẫn là enforcement chính ở phía server.

### 2.3. Hệ Thống Kỹ Năng Tùy Biến & Work Bundle Marketplace

Người dùng tự tạo, sửa, upload các gói `.skill` / `.zip` / thư mục `SKILL.md`
chứa YAML metadata + prompt + script tự động hóa.

- **Quản lý:** `CustomSkillsManager` (`apps/shell/src/main/skills/`) — bật/tắt,
  cập nhật, xuất file.
- **Sandbox:** Skill chạy trong môi trường cô lập, không truy cập filesystem ngoài
  workspace được phép và không gọi được mạng ngoài allowlist.
- **Work Bundle Marketplace:** Ngoài custom skills, người dùng cài các "gói
  công việc" (Work Bundle) từ cloud để mở rộng AI toolset theo ngành nghề.
  Mỗi Work Bundle = 1 bộ tools + cloud skills + terminology riêng. AI tự bóc
  tách intent từ prompt + ngữ cảnh văn bản để gọi đúng tool — người dùng
  không cần chọn thủ công bundle nào đang active.

---

## 3. Kiến Trúc Sản Phẩm

### 3.1. Cửa Sổ Hợp Nhất Đa Tab (Single-Window Multi-Tab)

Electron + React 19 + Vite. Một cửa sổ duy nhất quản lý nhiều tài liệu:

```
+------------------------------------------------------------------+
| Title Bar: [Lycero Office]  [Tabs]   [Model Badge]  [Settings]  |
+------------------------------------------------------------------+
| Left Rail |       Center Editor Canvas       |   Lycero Mate     |
| (56-240px)|  (Docs/Sheets/Slides/PDF/MD/HTML)| (AI Copilot 360px)|
+------------------------------------------------------------------+
| Status Bar: Saved 1,420 words  •  Quota: 85/100  •  Ready         |
+------------------------------------------------------------------+
```

Phím tắt: `Ctrl+J` (macOS `Cmd+J`) bật/tắt Lycero Mate. Bộ phím tắt tiêu chuẩn
(`Ctrl+S`, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `Ctrl+F`, `Ctrl+H`,
`Ctrl+K`) đều được hỗ trợ đầy đủ.

### 3.2. Mô Hình Trục Kép (Dual-Axis)

- **Editor Canvas (trục trái):** Bàn soạn thảo WYSIWYG, ribbon Astryx tối giản.
- **Lycero Mate Panel (trục phải):** Trợ lý AI, 360px, dock/undock, nắm bắt
  toàn bộ ngữ cảnh con trỏ và vùng chọn.

Mọi tính năng AI hỗ trợ **3 chế độ**:

1. **Tự động hoàn toàn (Full AI):** Khởi tạo tài liệu trọn gói từ yêu cầu.
2. **Thủ công hoàn toàn (Manual):** Người dùng tự tay gõ từng ký tự, AI không can thiệp.
3. **Phối hợp cùng AI (AI-Assisted):** AI đề xuất khung sườn, hiển thị
   `ActionCardData` để người dùng preview và Apply hoặc từ chối.

### 3.3. Bố Cục Không Gian 3 Vùng

| Vùng | Chiều rộng | Nội dung |
|---|---|---|
| Left Rail (Explorer) | `56px – 240px` (resize) | Recents, Starred, Folder tree, Templates |
| Center Editor Canvas | `flex 1` | Editor đang mở |
| Lycero Mate | `360px` (toggle) | AI Copilot |

---

## 4. Định Danh Thương Hiệu & Pháp Lý

### 4.1. Brand Identity

| Mục | Giá trị |
|---|---|
| Tên thương mại | `Lycero Office` |
| App ID | `vn.itac.lycero.office` *(giá trị thực tế tại `apps/shell/electron-builder.cjs:228`)* |
| Tác giả / Bản quyền | `ITAC AI Heavy Industries` |
| Deep-link scheme | `lycero-office://` |
| Env vars build | `LYCERO_*` (ví dụ `LYCERO_UPDATE_URL`, `LYCERO_GA4_MEASUREMENT_ID`, `LYCERO_FONT_CDN_URL`) |
| User data (Linux) | `~/.config/Lycero Office/` |

### 4.2. Bản Quyền & Pháp Lý

- **Nguồn gốc mã nguồn:** Kế thừa và phát triển từ **GenOffice
  (Copyright © 2026 Mainfunc, Inc.)** theo giấy phép **Apache License 2.0**.
- **Tác phẩm phái sinh hợp pháp:** Tuân thủ Điều 4 Apache 2.0, Khoản 2 Điều 14
  Luật Sở hữu trí tuệ Việt Nam và Công ước Berne.
- **Bất biến:**
  - KHÔNG được xóa header `Copyright © 2026 Mainfunc, Inc.` trên file kế thừa.
  - File do Lycero viết mới phải gắn header `Copyright © 2026 ITAC AI Heavy Industries.`
  - `NOTICE` và `LICENSE` ở thư mục gốc phải được phân phối kèm mọi bản cài đặt.
- **Tương thích định dạng tệp:** Mọi tham chiếu đến định dạng tệp
  (`.docx`, `.xlsx`, `.pptx`, …) và phím tắt quen thuộc được sử dụng thuần túy
  cho mục đích kỹ thuật tương thích; các nhãn hiệu thương mại thuộc chủ sở hữu
  tương ứng.

Chi tiết toàn văn tại `LEGAL_AND_IP_COMPLIANCE.md`.

### 4.3. Bảo Mật & Quyền Riêng Tư

- **Local-First:** Dữ liệu tài liệu ưu tiên lưu cục bộ, không đồng bộ lên cloud
  nếu không có sự cho phép rõ ràng của người dùng.
- **Offline Core:** Biên tập văn bản, bảng tính, trình chiếu hoạt động 100%
  khi mất mạng.
- **Electron Security Triad:** Mọi `BrowserWindow` đều bật `sandbox: true`,
  `contextIsolation: true`, `nodeIntegration: false`. IPC đầu vào được xác thực
  qua Zod hoặc inline type guard.
- **AI Gateway ZDR:** Lycero Hosted Gateway áp dụng chính sách Zero Data Retention
  cho mọi luồng AI; PII được bảo vệ theo GDPR và Luật An ninh mạng Việt Nam.

---

## 5. Kho Mẫu Tài Liệu (Templates)

| Loại | Mẫu có sẵn |
|---|---|
| Docs | Hợp đồng kinh tế, Đề xuất dự án (RFP), Quy chế nội bộ, Biên bản họp (MOM), NDA |
| Sheets | Quản lý dòng tiền, Báo cáo lãi lỗ (P&L), KPI/OKR tracker, Bảng lương |
| Slides | Báo cáo kinh doanh quý, Company Profile, Pitch Deck gọi vốn |

Kho mẫu EdTech (KHBD 5512, Bloom, SKKN, PPCT) được kích hoạt khi người dùng
đăng nhập Lycero EdTech hoặc bật Work Bundle giáo dục.

Định dạng template: `apps/shell/src/main/templates.ts` (xem chi tiết trong file).

---

## 6. Đối Tượng Người Dùng v1

| Phân khúc | Mô tả | Use case chính |
|---|---|---|
| Cá nhân | Sinh viên, freelancer, người dùng phổ thông | Soạn thảo cá nhân, không cần AI Pro |
| SMB / Doanh nghiệp vừa | Văn phòng 5-200 người | Hợp đồng, báo cáo tài chính, thuyết trình |
| Doanh nghiệp lớn | Tập đoàn 200+ người | BYOK on-premise, ZDR, SSO, admin dashboard |
| Giáo dục | Giáo viên, giảng viên, người dùng sư phạm | KHBD 5512, Bloom, hệ Work Bundle EdTech (hiện có `k12_teacher`, `higher_ed`) |

---

## 7. Tham Chiếu Chéo

| Chủ đề | Tài liệu |
|---|---|
| Thiết kế chi tiết | `DESIGN.md` |
| Quy tắc AI Agent | `AGENTS.md`, `CLAUDE.md` |
| Pháp lý & bản quyền | `LEGAL_AND_IP_COMPLIANCE.md` |
| Bảo mật | `SECURITY.md` |
| Kiến trúc kỹ thuật | `TECHNICAL_ARCHITECTURE_REVIEW.md` |
| Đóng góp | `CONTRIBUTING.md` |
| Các quyết định đang chờ owner | `docs/PRODUCT_DECISIONS.md` |
| Lịch sử audit & rebrand | `AUDIT_REBRAND_GAP.md` (historical) |
| Lịch sử phát triển Work Bundle | `WORK_BUNDLE_MARKETPLACE_PLAN.md` (historical) |
| OAuth unification design | `docs/auth-unification/OAUTH_UNIFICATION_DESIGN.md` (reference) |

---

*PRODUCT.md — Lycero Office Desktop — Copyright © 2026 ITAC AI Heavy Industries.*
*Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).*
