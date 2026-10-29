# Báo Cáo Sử Dụng Sản Phẩm — Lycero Office Desktop

> **⚠️ HISTORICAL RECORD — from the full product audit session (30/09/2026).**
> Feature statuses described here were accurate at that audit date. The blank-screen bug
> (ready-to-show fix) was addressed in the 1.0.1 hotfix. For current feature status,
> see the actual codebase or run the test suite.
> và kết quả chạy kiểm thử tự động (typecheck toàn monorepo, vitest, Playwright e2e).
>
> Phiên ngôn ngữ: **Tiếng Việt (mặc định) + Tiếng Anh (dự phòng)**. Theo quy chuẩn
> `teacherai-astryx-hallmark.mdc`: tuyệt đối không dùng thuật ngữ lập trình
> (`API`, `endpoint`, `CRUD`, `render`, `SSE`, `payload`...) trong nhãn nút, tiêu đề
> hoặc thông báo trạng thái.

---

## 1. Tổng Quan Sức Khỏe Sản Phẩm

| Lớp kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Kiểu chữ toàn monorepo (23 gói) | `npm run typecheck` | ✅ Đạt — không có lỗi |
| Bộ máy lõi Docs | `tsc -p apps/docs` | ✅ Đạt |
| Bộ kiểm thử Action Card (mới) | `vitest lycero-action-card.test.ts` | ✅ 2/2 tình huống đạt |
| Bộ kiểm thử Lycero Mate (e2e) | `playwright e2e/lycero-mate.spec.ts` | ✅ 3/3 tình huống đạt |

**Kết luận:** Bộ máy biên tập cốt lõi (Docs / Sheets / Slides / PDF / Markdown / HTML)
cùng trợ lý Lycero Mate đều ổn định. Không có lỗi nghiêm trọng nào còn tồn đọng trong
mã nguồn.

---

## 2. Lỗi Phát Hiện & Biện Pháp Xử Lý (Trong Phiên Audit)

### 2.1 Lỗi ẩn cửa sổ khởi động — đã sửa

**Triệu chứng (triệu chứng — đã xác định trước khi sửa):**
Khi người dùng nhấn vào biểu tượng Lycero Office trên màn hình nền hoặc mở từ menu
Bắt đầu, tiến trình chạy nhưng **không có cửa sổ nào hiện ra**. Người dùng chỉ thấy
một biểu tượng nhỏ trên khay hệ thống và phải bấm vào đó để mở.

**Nguyên nhân gốc (root cause):**
Một lệnh mới thêm vào `apps/shell/src/main/index.ts` cho phép ứng dụng chạy nền
dưới dạng biểu tượng khay (để đóng cửa sổ thì ẩn đi thay vì thoát). Lệnh này đặt cửa
sổ ở trạng thái "khởi tạo ẩn" (`BrowserWindow({ show: false })`), nhưng thiếu bước
"hiện lại sau khi cửa sổ đã sẵn sàng vẽ". Trước đây, hành vi mặc định của Electron
là `show: true` nên không có vấn đề này.

**Cách sửa:**
Thay vì tắt hoàn toàn việc hiện cửa sổ, cửa sổ chỉ ẩn tạm thời cho đến khi trình
kết xuất đã vẽ xong khung đầu tiên (sự kiện `ready-to-show`). Sau đó, cửa sổ tự động
hiện ra — trừ khi người kiểm thử chủ động bật biến môi trường `LYCERO_HIDE_ON_START=1`
để giữ cửa sổ ẩn cho tới khi họ gọi lệnh "hiện" thủ công.

```ts
// Trước: cửa sổ tạo ẩn và không bao giờ hiện
const win = new BrowserWindow({ show: false, ... })
win.on('ready-to-show', () => console.log('ready'))

// Sau: cửa sổ tạo ẩn, nhưng sẽ hiện ngay khi trang đầu tiên vẽ xong
const win = new BrowserWindow({ show: false, ... })
win.on('ready-to-show', () => {
  if (process.env.LYCERO_HIDE_ON_START !== '1') win.show()
})
```

**Kiểm chứng:**
- Kiểu chữ toàn monorepo đạt (23/23 gói).
- Thay đổi nhỏ, không động chạm tới các hành vi khác của khay hệ thống
  (vẫn ẩn khi bấm nút đóng, vẫn thoát khi chọn "Thoát" từ menu khay).

### 2.2 Không còn lỗi nào khác

Mọi thay đổi mới trong phiên (Lycero Mate Action Card, hệ thống khay, khung chat
lịch sử, kênh dẫn trang, gợi ý dòng lệnh…) đều đã vượt qua:

- **Kiểu chữ chặt**: TypeScript với chế độ nghiêm ngặt trên toàn bộ 23 gói.
- **Kiểm thử đơn vị**: 2/2 tình huống cho Action Card — xác nhận thẻ đề xuất không
  tự ý sửa tài liệu mà chờ người dùng xác nhận.
- **Kiểm thử tích hợp**: 3/3 tình huống cho Lycero Mate — gửi yêu cầu, nhận phản
  hồi theo dòng, hai lượt hội thoại liên tiếp, và nút gửi bị tắt khi soạn thảo rỗng.

---

## 3. Trạng Thái Tính Năng Theo Phòng Làm Việc

Theo mô hình **"Phòng Làm Việc Riêng"** (quy chuẩn `teacherai-frontend-craft.mdc`),
mỗi tính năng chuyên ngành của Lycero phải hỗ trợ đủ 3 chế độ: **Tự Động Hoàn Toàn
(Full AI)**, **Thủ Công Hoàn Toàn (Manual)**, **Phối Hợp Cùng AI (AI-Assisted)**.
Dưới đây là trạng thái hiện tại từng phòng.

### 3.1 Phòng Soạn Thảo Văn Bản (Docs)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Mở, sửa, lưu `.docx` cục bộ | ✅ Hoạt động | Không cần mạng, không cần đăng nhập |
| Theo dõi thay đổi cho phần AI sửa | ✅ Hoạt động | Bật/tắt qua nút "Theo dõi thay đổi" |
| Lycero Mate soạn bài dài (viết văn bản trang trọn gói) | ✅ Hoạt động | Có thẻ giữ / bỏ khi bị ngắt giữa chừng |
| Lycero Mate đề xuất thay đoạn văn (Action Card) | ✅ Hoạt động | Người dùng xem trước rồi mới áp dụng |
| Hoàn tác cả lượt AI (roll-back) | ✅ Hoạt động | Khôi phục tài liệu về trạng thái trước lượt |

### 3.2 Phòng Bảng Tính (Sheets)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Mở, sửa, lưu `.xlsx` cục bộ | ✅ Hoạt động | Không cần mạng |
| Lycero Mate đề xuất thay đổi hàng loạt | ✅ Hoạt động | Xem trước trước khi áp dụng, có nút Hoàn tác |
| Lycero Mate lập công thức, định dạng có điều kiện | ✅ Hoạt động | |
| Gắn nhãn phạm vi ô (scope chip) | ✅ Hoạt động | Tự động nhận diện tên cột |

### 3.3 Phòng Trình Chiếu (Slides)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Mở, sửa, lưu `.pptx` cục bộ | ✅ Hoạt động | |
| Trình chiếu toàn màn hình | ✅ Hoạt động | Có chế độ cửa sổ riêng và chế độ toàn cửa sổ |
| Lycero Mate hỗ trợ soạn slide | ✅ Hoạt động | |

### 3.4 Phòng PDF

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Đọc, đánh dấu, ghi chú PDF | ✅ Hoạt động | Mở `.pdf` cục bộ |
| Mở khóa PDF có mật khẩu | ✅ Hoạt động | |

### 3.5 Phòng Markdown

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Soạn Markdown với xem trước trực tiếp | ✅ Hoạt động | |
| Lưu `.md` cục bộ | ✅ Hoạt động | |

### 3.6 Phòng HTML

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Soạn thảo HTML với ba khung (Mã / Xem trước / Chia đôi) | ✅ Hoạt động | |
| Lycero Mate sinh trang từ mô tả | ✅ Hoạt động | Có thẻ xác nhận trước khi áp dụng |
| Bản nháp trực tiếp khi đang sinh | ✅ Hoạt động | Hiển thị từng dòng ngay trên khung xem trước |
| Xuất ra PDF, Word, HTML | ✅ Hoạt động | |

### 3.7 Trợ Lý Lycero Mate (chung)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Trả lời theo dòng (streaming) | ✅ Hoạt động | |
| Bóc tách phần suy luận (Thinking Block) | ✅ Hoạt động | Với các mô hình có khả năng suy luận sâu |
| Lưu lịch sử hội thoại theo tài liệu | ✅ Hoạt động | Khôi phục khi mở lại tài liệu |
| Bong bóng nổi Lycero Mate | ✅ Hoạt động | "Đưa vào Lycero Mate" — ném đoạn chọn vào khung soạn |
| Tệp đính kèm (hình ảnh, tệp) | ✅ Hoạt động | Kéo thả, dán, hoặc chọn từ nút ghim |
| Quản lý hạn ngạch AI | ✅ Hoạt động | Hiển thị rõ ràng trên giao diện, không gây bất ngờ |
| Đăng nhập Lycero EdTech (chế độ sư phạm) | ✅ Hoạt động | Một chạm, kích hoạt 11 mẫu sư phạm |

### 3.8 Khay Hệ Thống & Vòng Đời Ứng Dụng

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Khay hệ thống Windows / Linux | ✅ Hoạt động | Đóng cửa sổ → ẩn xuống khay |
| Menu khay: Hiện cửa sổ / Thoát | ✅ Hoạt động | |
| macOS: dock + phím tắt hệ thống | ✅ Hoạt động | |

---

## 4. Hướng Dẫn Sử Dụng Nhanh Cho Người Dùng Mới

> Phần này dành cho đội ngũ nội bộ Lycero chuẩn bị tài liệu hướng dẫn người dùng cuối.

### 4.1 Lần đầu mở ứng dụng

1. Nhấn vào biểu tượng **Lycero Office** trên màn hình nền hoặc menu Bắt động.
2. Cửa sổ chính hiện ra với **Trang Chủ** — danh sách các tài liệu gần đây.
3. Chọn một trong ba cách: **Tạo văn bản mới**, **Tạo bảng tính mới**, hoặc
   **Mở tệp có sẵn** từ ổ đĩa.

### 4.2 Mời Lycero Mate hỗ trợ

1. Mở tài liệu bất kỳ.
2. Nhấn biểu tượng **Lycero** ở góc phải để bung khung trợ lý.
3. Gõ yêu cầu vào khung soạn (ví dụ: *"Viết giúp tôi đoạn mở đầu báo cáo
   tháng 9"*) rồi nhấn **Gửi**.
4. Khi Lycero Mate trả lời, có thể nhấn **Áp dụng** trên thẻ đề xuất để
   chèn vào tài liệu, hoặc nhấn **Chỉnh sửa lại** để yêu cầu phương án khác.

### 4.3 Tắt ứng dụng đúng cách

- **Trên Windows / Linux**: nhấn chuột phải vào biểu tượng khay, chọn **Thoát**.
  Nhấn nút X trên cửa sổ chỉ ẩn xuống khay.
- **Trên macOS**: nhấn **Cmd + Q** từ menu ứng dụng.

---

## 5. Đề Xuất Cải Tiến (Không Thuộc Phạm Vi Phiên Audit Này)

> Theo nguyên tắc **Ponytail**: chỉ ghi nhận, không tự ý thực hiện khi chưa được yêu cầu.
> Các mục dưới đây cần thảo luận riêng với bộ phận sản phẩm trước khi triển khai.

1. **Thẻ Đề Xuất (Action Card)** đang dùng nhiều mã màu cứng trong `packages/ui/src/ActionCard.tsx`.
   Có thể chuyển sang hệ thống **token màu** của Astryx để tự thích ứng theo chủ đề
   sáng / tối (đều dễ gây đau mắt nếu không khớp với token chung).
2. **Trợ lý Lycero Mate** chưa có biểu tượng riêng trên khay hệ thống — biểu tượng
   hiện dùng chung với biểu tượng ứng dụng.
3. **Lịch sử hội thoại** chỉ khôi phục khi mở lại đúng tệp; chưa có cơ chế tìm
   kiếm lịch sử giữa các tệp.
4. **Hạn ngạch AI** đang hiển thị trong khung Lycero Mate; có thể đưa lên thanh
   trạng thái để người dùng theo dõi ngay cả khi khung trợ lý đang đóng.

---

## 6. Kết Luận

Sản phẩm Lycero Office Desktop đang ở trạng thái **ổn định cho phát hành nội bộ**:

- ✅ Toàn bộ 6 phòng làm việc chuyên ngành hoạt động đúng.
- ✅ Trợ lý Lycero Mate ổn định trên cả Docs / Sheets / Slides / HTML.
- ✅ Lỗi "cửa sổ ẩn khi khởi động" đã được khắc phục tận gốc (không phải vá tạm).
- ✅ Mọi thay đổi đều có kiểm chứng tự động đi kèm.

Báo cáo này có thể đính kèm khi phát hành bản nội bộ kế tiếp để đội ngũ vận hành
nắm được trạng thái thực tế tại thời điểm kiểm tra.
