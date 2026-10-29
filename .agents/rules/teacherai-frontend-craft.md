---
description: Quy chuẩn kỹ thuật giao diện Lycero - Hợp nhất Astryx (Meta), Ponytail và Trải nghiệm Sư phạm
globs: apps/web/**/*.{ts,tsx,css,scss},packages/design-system/**/*.{ts,tsx,css}
alwaysApply: true
---

# Quy Chuẩn Kỹ Thuật Giao Diện Lycero (Astryx & Pedagogical Craft)

Tài liệu này định hình cách xây dựng giao diện người dùng cho **Lycero** trên nền tảng **Astryx từ Meta** (`https://astryx.atmeta.com/`), đảm bảo tính mượt mà, tối giản và trải nghiệm sư phạm thanh nhã.

## 1. Trải Nghiệm Người Dùng & Bản Sắc Ngôn Ngữ
- **Thuần Sư Phạm, Cấm Thuật Ngữ Lập Trình:** Mọi nhãn nút, tiêu đề, thông báo trạng thái hoặc hộp thoại hướng dẫn TUYỆT ĐỐI KHÔNG chứa thuật ngữ lập trình (không dùng: API, Endpoint, CRUD, Render, Syncing database, SSE, Payload, Schema...). Hãy dùng từ ngữ sư phạm thuần Việt, gần gũi: *"Lưu bài soạn"*, *"Tạo đề kiểm tra"*, *"Đang hoàn thiện"*, *"Đã đồng bộ tự động"*.
- **Tối Giản & Cực Kỳ Mượt Mà:** Loại bỏ hoàn toàn sự rườm rà, các hộp thoại phức tạp hoặc tính năng phô trương không cần thiết. Phản hồi giao diện tức thì, thao tác chuyển đổi nhẹ nhàng êm ái (chuyển động 125-300ms `ease-out`).

## 2. Mô Hình Module Chuyên Ngành & Tam Thức Làm Việc
- Mỗi tính năng chuyên ngành (Soạn giáo án, Thiết kế đề thi, Kế hoạch PPCT, Đánh giá học sinh, Kho học liệu) hoạt động như một **Phòng Làm Việc Riêng**.
- **Mọi tính năng trong phòng làm việc bắt buộc phải hỗ trợ 3 chế độ:**
  1. **Tự Động Hoàn Toàn (Full AI):** AI khởi tạo tài liệu trọn gói theo yêu cầu của giáo viên.
  2. **Thủ Công Hoàn Toàn (Manual):** Giáo viên tự tay gõ từng câu chữ, điều chỉnh cấu trúc mà không bị AI can thiệp.
  3. **Phối Hợp Cùng AI (AI-Assisted):** Giáo viên làm khung sườn, AI hỗ trợ gợi ý câu hỏi, mở rộng nội dung, sửa lỗi hành văn.
- **Tích hợp Lycero Mate (MiniChat tại chỗ):** Mỗi phòng làm việc đều có khung trợ lý Lycero Mate bên cạnh trang tài liệu, sẵn sàng nhận lệnh trực tiếp để chỉnh sửa đoạn văn bản đang chọn mà giáo viên không cần chuyển tab.
- **Đồng Bộ Thời Gian Thực (Real-Time Sync):** Dữ liệu phác thảo từ Chat Tổng được đồng bộ tức thì sang phòng làm việc và ngược lại, hiển thị trạng thái đồng bộ nhẹ nhàng, tinh tế.

## 3. Hệ Thống Token & Component Astryx (Meta)
- **Component Chuẩn:** Luôn sử dụng `@teacherai/design-system-core` (Astryx). Trước khi tạo mới bất kỳ widget nào, hãy kiểm tra kho component có sẵn.
- **Token Chủ Đạo (theme `teacheraiTheme.ts`):**
  - **Tông sáng (Matte Warm Ivory & Terracotta):** Nền kem mờ chống chói lóa `#F4F2EB`, bề mặt thẻ ngà mềm `#F9F8F3`, mực than ấm `#1C1B18`, điểm nhấn đất nung ấm (Warm Terracotta) `#8B3A1A` đạt chuẩn tương phản WCAG AA 4.5:1, viền thanh mảnh `#DDD9CE`. (Lưu ý: Stitch v4 Light và xanh `#002daa` đã bãi bỏ).
  - **Tông tối (Claude-Warm Charcoal & Radiant Terracotta):** Nền than ấm `#262624` (tuyệt đối không dùng đen tuyền `#000000`), chữ trắng ngà `#f5f4ef`, điểm nhấn terracotta ấm `#d97757`.
- **Kiểu chữ:** `Be Vietnam Pro` là phông chữ chính thức toàn hệ thống.
- **Không Viết Tailwind Utility Tự Do:** Mọi CSS đặc thù phải được scope theo component/route hoặc dùng props của Astryx, không viết đè các class tiện ích làm vỡ tính nhất quán của theme.

## 4. Kỷ Luật Ponytail (Senior Tối Giản)
- Tuyệt đối không cài thêm thư viện datepicker, dialog, hay popover bên ngoài nếu Astryx hoặc native HTML5 (`<input type="date">`, `<dialog>`, `<details>`) đã đáp ứng được.
- Đặt giải pháp tối giản lên hàng đầu: Code ít nhất, an toàn nhất, bền vững nhất.
