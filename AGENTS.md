# AGENTS.md — Kim Chỉ Nam Cho AI Agents (Lycero Office Desktop)

> 📌 **QUAN TRỌNG:** Trước khi làm bất kỳ việc gì trong repo, Agent BẮT BUỘC phải đọc `SUPERPLAN.md` và `.cursor/rules/super-plan.mdc` (luôn auto-load). Đây là bộ nhớ cứng của dự án với 9 giai đoạn nâng cấp parity GenOffice + nguyên tắc commit.

Tài liệu này là hướng dẫn tối cao và bắt buộc cho mọi AI Agent (Antigravity, Cursor, Claude Code, Codex) khi làm việc trong kho mã nguồn **Lycero Office Desktop** tại `D:\Lycero Office\`.

> 📌 **QUAN TRỌNG:** Trước khi làm bất kỳ việc gì trong repo, Agent BẮT BUỘC phải đọc `SUPERPLAN.md` và `.cursor/rules/super-plan.mdc` (luôn auto-load). Đây là bộ nhớ cứng của dự án với 9 giai đoạn nâng cấp parity GenOffice + nguyên tắc commit.

---

## 1. Định Vị Sản Phẩm & Trải Nghiệm Người Dùng (Product & UX Core)

> **SSOT cho định vị sản phẩm:** `PRODUCT.md` — đọc trước mọi thay đổi về tính năng,
> phạm vi phát hành, mô hình kinh doanh, hay quota AI.
>
> **SSOT cho thiết kế giao diện:** `DESIGN.md` — bảng màu Astryx, kiểu chữ, motion.
>
> **SSOT cho pháp lý:** `LEGAL_AND_IP_COMPLIANCE.md` — copyright, derivative work.
>
> **SSOT cho quyết định đang chờ owner:** `docs/PRODUCT_DECISIONS.md` — quota số cụ thể,
> pricing, token metering.

Các quyết định sản phẩm cốt lõi (Free Forever, AI Quota, Work Bundle, Universal
Architecture, EdTech) đều được ghi chép đầy đủ trong `PRODUCT.md`. Phần dưới của
`tài liệu này` chỉ ghi những quy tắc **riêng cho AI Agent** — không lặp lại product pitch.

---

## 2. Bản Quyền & Tính Minh Bạch Pháp Lý (Legal & IP Compliance)

Lycero Office được xây dựng dựa trên nguyên tắc **minh bạch pháp lý tuyệt đối**, tuân thủ nghiêm ngặt luật pháp Việt Nam và các điều ước quốc tế:

1. **Nền tảng gốc & Tư cách Tác phẩm Phái sinh (Derivative Work):**
   - Lycero Office được kế thừa và phát triển từ mã nguồn mở **GenOffice**, bản quyền thuộc về **Mainfunc, Inc. (Copyright © 2026 Mainfunc, Inc.)**, phân phối hợp pháp theo giấy phép **Apache License, Version 2.0**.
   - Căn cứ Điều 4 Giấy phép Apache 2.0, Khoản 2 Điều 14 Luật Sở hữu trí tuệ Việt Nam số 50/2005/QH11 (sửa đổi 2022) và Điều 2(3) Công ước Berne, Lycero Office là một **tác phẩm phái sinh thương mại và mã nguồn mở hợp pháp**.
2. **Quy tắc bất biến về Header và File Bản quyền:**
   - **TUYỆT ĐỐI KHÔNG XÓA** header bản quyền `Copyright © 2026 Mainfunc, Inc.` trong bất kỳ tệp tin nào kế thừa từ GenOffice.
   - Các tệp tin được sửa đổi phải giữ nguyên thông báo gốc và thêm thông báo sửa đổi theo Section 4(b) Apache 2.0:
     ```ts
     /**
      * Lycero Office Desktop
      * Copyright © 2026 ITAC AI Heavy Industries.
      * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
      */
     ```
   - Các tệp tin do Lycero viết mới hoàn toàn gắn header:
     ```ts
     /**
      * Lycero Office Desktop
      * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
      */
     ```
   - File `NOTICE` và `LICENSE` tại thư mục gốc phải luôn được phân phối kèm mọi bản cài đặt và gói phát hành phần mềm.
   - Xem chi tiết toàn văn tại [LEGAL_AND_IP_COMPLIANCE.md](file:///D:/Lycero%20Office/LEGAL_AND_IP_COMPLIANCE.md).
3. **Chính sách Nhãn hiệu (Nominative Fair Use):**
   - Tên gọi _"Microsoft"_, _"Word"_, _"Excel"_, _"PowerPoint"_ thuộc bản quyền thương hiệu của Microsoft Corporation. Trong dự án Lycero Office, các tên này chỉ được dùng thuần túy theo nguyên tắc **Sử dụng Định danh Hợp lý (Nominative Fair Use)** để mô tả định dạng tệp tin tương thích (`.docx`, `.xlsx`, `.pptx`).

---

## 3. Chuẩn Mực Thiết Kế: Astryx (Meta) Tùy Biến Cho Văn Phòng & Giáo Dục

Giao diện Desktop xây dựng theo ngôn ngữ thiết kế **Astryx từ Meta** (chi tiết tại [DESIGN.md](file:///D:/Lycero%20Office/DESIGN.md)):

- **Bảng màu chống lóa, bảo vệ thị lực khi làm việc văn phòng dài giờ:**
  - **Ban ngày (Matte Warm Ivory & Terracotta):** Nền kem ngà `#F4F2EB`, bề mặt giấy mềm `#F9F8F3`, mực than ấm `#1C1B18`, điểm nhấn đất nung ấm (Warm Terracotta) `#8B3A1A` đạt chuẩn tương phản WCAG AA 4.5:1, đường viền thanh mảnh `#DDD9CE`.
  - **Ban đêm (Claude-Warm Charcoal & Radiant Terracotta):** Nền xám than ấm `#262624` (tuyệt đối không dùng đen tuyền `#000000`), chữ trắng ngà `#F5F4EF`, điểm nhấn đất nung sáng `#D97757`.
- **Kiểu chữ:** `Be Vietnam Pro` (chính thức toàn hệ thống) kèm bộ số liệu hình học Tabular Figures cho bảng tính Sheets.
- **Cấm triệt để "AI Slop":** Không gradient tím xanh; không lồng thẻ trong thẻ (nested cards); không dùng bóng đổ dơ màn hình; thời gian chuyển động từ 125ms đến 250ms với hàm gia tốc `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Mô hình Trục Kép (Dual-Axis Workspace):**
  - **Center Canvas:** Bàn soạn thảo độc lập phân trang A4 (Docs), bảng tính vô hạn (Sheets), bàn vẽ trình chiếu 16:9 (Slides), trình chú thích byte-level (PDF, Markdown).
  - **Right Copilot (Lycero Mate):** Tích hợp khối tư duy mở rộng (`ThinkingBlock` stream accordion), danh mục model động (`fetchRemoteModels`), và hệ thống Thẻ Hành Động tương tác tức thì trên trang (`ActionCardData`).

---

## 4. Triết Lý Kỹ Thuật: Ponytail (Senior Tối Giản)

"Code tốt nhất là code không cần phải viết."
Trước khi viết code, dừng lại ở bậc thang đầu tiên thỏa mãn:

1. **YAGNI:** Tính năng hay cấu trúc này có thật sự cần thiết không? Không -> Bỏ qua.
2. **Reuse:** Repo hoặc package nội bộ đã có chưa? Tái sử dụng từ `packages/*`.
3. **Stdlib & Native Web/Node API:** Đã có API native (dialog, input, fetch, stream, path, crypto) chưa? -> Dùng trực tiếp, không cài thêm thư viện phụ thuộc ngoài.
4. **Minimal Diff:** Giải quyết tận gốc (root cause), diff ngắn gọn, sạch sẽ, không sinh tầng trừu tượng thừa thãi.

---

## 5. Cấu Trúc Monorepo Của Dự Án

```
D:\Lycero Office\
├── apps\
│   ├── shell\                    # Ứng dụng khung Electron chính (Main, Preload, Renderer, Home, Tabs, Auth)
│   ├── docs\                     # Trình soạn thảo văn bản Docs (TipTap, AST byte-preserving, Phân trang A4)
│   ├── sheets\                   # Trình biên tập bảng tính Sheets (Lưới ô tính tốc độ cao, Formula bar)
│   ├── slides\                   # Trình biên tập bài trình chiếu Slides (Canvas 16:9, Shape, Text, PPTX)
│   ├── pdf\                      # Trình xem và phân tích tài liệu PDF
│   ├── markdown\                 # Trình soạn thảo Markdown kèm Live Preview
│   └── html\                     # Trình xem và biên tập trang HTML
├── packages\
│   ├── agent-core\               # Lõi điều phối AI Agent, tool calling, xử lý intent, action cards
│   ├── ai-provider\              # Kết nối AI providers (OpenAI, Anthropic, Gemini, DeepSeek, Ollama, Gateway)
│   ├── ai-search\                # Tìm kiếm thông minh trong tài liệu
│   ├── docx-engine\              # Bộ máy phân tích và tạo file Word (.docx) chuẩn ISO/IEC 29500
│   ├── pptx-engine\              # Bộ máy phân tích và tạo file PowerPoint (.pptx)
│   ├── pptx-render\              # Render hình học và đối tượng trình chiếu
│   ├── pptx-ops\                 # Thao tác đồ họa trên slide
│   ├── engine-sheets\            # Động cơ tính toán ô tính và công thức Excel
│   ├── xlsx-gateway\             # Cổng kết nối xuất nhập file (.xlsx)
│   ├── file-parse\               # Trích xuất nội dung đa định dạng
│   ├── font-metrics\             # Đo lường và căn chỉnh font chữ chính xác tuyệt đối
│   ├── project-store\            # Quản lý trạng thái dự án và lưu trữ cục bộ
│   └── ui\                       # Thư viện component chia sẻ (Astryx Theme Tokens)
├── .agents\                      # Cấu hình AI Skills & Rules chuẩn Antigravity / Agentic IDE
├── .cursor\rules\                # Cấu hình Cursor Rules
├── .claude\                      # Cấu hình Claude Code
├── LEGAL_AND_IP_COMPLIANCE.md    # Hồ sơ pháp lý và bản quyền đầy đủ
├── PRODUCT.md                    # Bản định vị sản phẩm & kinh doanh
├── DESIGN.md                     # Tiêu chuẩn thiết kế Astryx Meta
├── NOTICE                        # Thông báo bản quyền Apache 2.0 & Derivative Work
├── LICENSE                       # Toàn văn Apache License 2.0 & Appendix
└── package.json                  # Root npm/pnpm workspace configuration
```

---

## 6. Năm Nguyên Tắc Bất Biến Của Hệ Thống Desktop

1. **Local-First & Data Sovereignty:** Dữ liệu tài liệu luôn được ưu tiên lưu trữ cục bộ trên ổ đĩa của người dùng. Không tải tài liệu lên cloud nếu không có sự cho phép rõ ràng của người dùng.
2. **Offline Core:** Các chức năng biên tập văn bản, bảng tính, trình chiếu hoạt động 100% khi không có kết nối Internet.
3. **Bảo mật PII & ZDR:** Mọi luồng giao tiếp AI qua Lycero Gateway phải tuân thủ chính sách Không lưu trữ dữ liệu (Zero Data Retention) và bảo vệ thông tin định danh cá nhân (PII Protection).
4. **Stream First & Thinking Transparency:** Mọi phản hồi của Lycero Mate phải hỗ trợ streaming mượt mà; các mô hình có khả năng suy luận (Reasoning) phải được bóc tách khối suy luận vào `ThinkingBlock` chuyên biệt.
5. **Độ ổn định & Zero Crash:** Ứng dụng Desktop không được phép sập hay mất dữ liệu khi mất điện hoặc tắt ứng dụng đột ngột (tự động sao lưu bản nháp định kỳ dạng transaction-safe).

---

## 7. Quy Trình Kiểm Thử, Biên Dịch & Đánh Số Phiên Bản Đồng Bộ (Verification & Lockstep Versioning)

### 7.1. Quy Tắc Đánh Số Phiên Bản Đồng Bộ (Lockstep Versioning — BẮT BUỘC)

Mọi thay đổi mã nguồn hoặc cấu hình trong **Lycero Office Desktop** đều **BẮT BUỘC** phải tăng số phiên bản (`x.y.z`) đồng bộ 100% trên toàn bộ **37 manifest thành phần** của monorepo (không bao giờ sửa tay lẻ tẻ từng file):

1. **Danh mục 37 thành phần đồng bộ tuyệt đối:**
   - `package.json` gốc (SSOT phiên bản toàn dự án)
   - Toàn bộ 7 ứng dụng trong `apps/*/package.json` (`docs`, `html`, `markdown`, `pdf`, `sheets`, `shell`, `slides`)
   - Toàn bộ 22 gói nội bộ trong `packages/*/package.json` (`agent-core`, `ai-auth`, `ai-provider`, `ai-search`, `cli`, `cloud-sync`, `docx-engine`, `electron-utils`, `file-parse`, `font-metrics`, `html2docx`, `i18n`, `odf2ooxml`, `pdf2docx`, `pipelines`, `pptx-engine`, `pptx-ops`, `pptx-render`, `project-store`, `ui`, `xlsx-gateway`, `zip-gate`)
   - `package-lock.json` (`version` gốc, `packages[""].version`, và toàn bộ 29 workspace entries)
   - Rust Native Sidecar: `apps/sheets/native/xlsx-engine/Cargo.toml` và `apps/sheets/native/xlsx-engine/Cargo.lock` (`xlsx-sidecar`)
   - Core Agent Skills: `skills/lycero-office/SKILL.md`, `skills/genoffice/SKILL.md`, `.agents/skills/lycero-office/SKILL.md`, `.claude/skills/lycero-office/SKILL.md` (`metadata.version`)
   - CLI Bundle (nếu đã build): `packages/cli/dist/lycero-office.cjs` (`__cliAppVersion`)

2. **Lệnh chuẩn bắt buộc cho AI Agent khi có thay đổi:**
   ```bash
   # Tăng bản vá (patch: x.y.z -> x.y.z+1) — mặc định cho mọi bản sửa lỗi / tinh chỉnh
   npm run version:bump

   # Hoặc tăng minor (tính năng mới) / major (thay đổi kiến trúc lớn)
   npm run version:minor
   npm run version:major

   # Kiểm tra đồng bộ phiên bản toàn bộ 37 thành phần
   npm run check:version-sync
   ```
   _(Lưu ý: Git hook `.githooks/pre-commit` cũng tự động kích hoạt `node tools/bump-version.mjs --if-unchanged --stage` và `node tools/check-version-sync.mjs --require-bump` để chặn tuyệt đối mọi commit lệch phiên bản)._

### 7.2. Quy Trình Kiểm Thử & Biên Dịch

Mọi thay đổi code phải được kiểm chứng qua các lệnh sau trước khi hoàn tất:

```bash
# 1. Đồng bộ và kiểm tra phiên bản toàn monorepo
npm run version:bump
npm run check:version-sync

# 2. Kiểm tra kiểu TypeScript toàn bộ monorepo
npm run typecheck

# 3. Chạy kiểm thử tự động cho lõi AI và Agent
npm test -- packages/agent-core
npm test -- packages/ai-provider

# 4. Build toàn bộ monorepo đảm bảo không có lỗi đóng gói
npm run build:all
```

<!-- AI_CTO_BRIDGE_START -->

## Quy trình CTO dùng chung

Trước tác vụ kỹ thuật, đọc `D:/Bộ quy trình Dev/AGENTS.md` và nạp skill phù hợp theo định tuyến tại đó.
Giải quyết liên kết tương đối theo thư mục chứa tài liệu gốc. Bộ quy trình chỉ là tham chiếu; chỉ sửa workspace dự án hiện tại.
Giữ quy định riêng của dự án; nếu xung đột không giải được, báo rõ và chờ người phụ trách. Nếu cầu nối được nạp từ nhiều file, áp dụng một lần.
Thiếu quyền đọc hoặc thiếu tool phải báo BLOCKED/NOT RUN. Cầu nối không bật hook, không cấp quyền gửi mã tới endpoint ngoài, tiêu tiền, commit/push/merge hoặc deploy.
<!-- AI_CTO_BRIDGE_END -->
