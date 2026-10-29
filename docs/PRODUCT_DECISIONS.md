# PRODUCT_DECISIONS.md — Các Quyết Định Sản Phẩm Đang Chờ Owner

> **Trạng thái:** Active — cập nhật khi có quyết định mới.
> **Mục đích:** Ghi nhận các quyết định sản phẩm chưa có owner, để tránh
> bị quên và để team biết cái gì đang bị block.
> Mỗi hàng = một quyết định. Khi có owner + kết quả, đánh dấu DONE
> và chuyển vào `PRODUCT.md`.

---

## Bảng Quyết Định Chưa Hoàn Thành

| # | Quyết định | Trạng thái | Owner | Blocked by / Depends on | Ghi chú |
|---|---|---|---|---|---|
| 1 | **Free-tier AI quota — số cụ thể** | ⏳ OPEN | @product-owner | `HubQuota` backend response shape đã là `{used, limit, resetAt}` (request count). Cần chốt: (a) Free-tier limit bao nhiêu lượt/tháng? (b) Có dùng token-based metering thay vì request count không? | Root cause: `packages/ai-auth/src/lycero-auth-types.ts:89` định nghĩa `HubQuota = {used: number, limit: number, resetAt: string}`. `hub-lycero.ts:155-161` đọc `x-ratelimit-remaining` header (request count). Product owner muốn token metering nhưng backend chưa implement. |
| 2 | **Pro/Enterprise AI quota — số cụ thể** | ⏳ OPEN | @product-owner | Quyết định #1 | Pro: giới hạn/tháng là bao nhiêu? Enterprise: quota tập trung tính như thế nào? |
| 3 | **Token metering vs. request metering** | ⏳ OPEN | @product-owner + @backend | Backend Hub API cần thay đổi để trả về token breakdown (input/output/cached) | Hiện tại Hub meter bằng request count. Muốn token count → cần backend thay đổi. Sau khi backend xong, update `HubQuota` type + quota display UI. |
| 4 | **Root `package.json` version** | ✅ RESOLVED | @engineering | Đã xong | Đồng bộ `0.1.0` → `1.0.1`, khớp `apps/shell/package.json` và `RELEASE_NOTES.md`. |
| 5 | **App ID trong `electron-builder.cjs`** | ⏳ OPEN | @product-owner | Không có | Code hiện là `vn.itac.lycero.office`. Chưa có người dùng cài bản nào (dự án clone từ GenOffice, chưa phát hành), nên chưa cần lo về kế thừa userData. Cần chốt tên reverse-DNS chính thức theo quy chuẩn đăng ký của ITAC. |
| 6 | **Be Vietnam Pro — self-host hay CDN?** | ⏳ OPEN | @engineering | Không có | Self-host (~2-5 MB woff2) hay dùng CDN (LYCERO_FONT_CDN_URL)? AUDIT_REBRAND_GAP.md §14 câu 2 đã hỏi từ 22/09/2026. |
| 7 | **Polymorphic Switcher — vị trí UI** | ⏳ OPEN | @product-owner | GĐ 10 EdTech Archetype wiring | Trên TitleBar (PRODUCT.md §3.2 mockup) hay trong Settings → Workspace? |
| 8 | **Pricing — Pro tier giá bao nhiêu?** | ⏳ OPEN | @product-owner | BYOK feature đã implement | Chưa có bảng giá. |
| 9 | **Auto-update feed URL production** | ⏳ OPEN | @engineering | CI/CD pipeline | `LYCERO_UPDATE_URL` production value chưa set. HANDOFF-antigravity.md §bug phụ đã ghi. |
| 10 | **`docs/edtech-roadmap.md` — dangling reference** | ✅ RESOLVED | N/A | N/A | PRODUCT.md §1.1 từng trỏ đến file không tồn tại. Đã gỡ reference trong PRODUCT.md (phạm vi v1 được viết lại). Không cần tạo roadmap riêng; EdTech timeline nằm trong `SUPERPLAN.md` GĐ 10 và `docs/plans/stage10-edtech-archetypes/PLAN.md`. |

---

## Lịch Sử Quyết Định Đã Hoàn Thành

| # | Quyết định | Kết quả | Ngày |
|---|---|---|---|
| D1 | **EdTech scope trong v1** | ✅ RESOLVED — EdTech không bị deferred sang Phase 2. Work Bundle system + archetype registry đã ship trong codebase (10 archetypes trong `packages/ai-auth/src/archetypes.ts`). `PRODUCT.md` §1.1 đã viết lại: v1 phục vụ universal audience bao gồm giáo dục. | 05/10/2026 |
| D2 | **Quota metering model** | ✅ PARTIAL — Backend hiện tại meter theo request count (không phải token). Tài liệu đã ghi nhận trạng thái thực tế + decision #1. Token metering là open decision #3. | 05/10/2026 |

---

## Cách Dùng

- **Thêm quyết định mới:** Tạo hàng mới với # tiếp theo, trạng thái ⏳ OPEN.
- **Khi quyết định xong:** Điền cột Owner + kết quả, đổi trạng thái ✅ DONE.
  Sau đó cập nhật `PRODUCT.md` và xóa hàng khỏi bảng.
- **Khi quyết định bị hủy (abandoned):** Đánh dấu ❌ DROPPED + ghi lý do.

---

*PRODUCT_DECISIONS.md — Lycero Office Desktop — Copyright © 2026 ITAC AI Heavy Industries.*
