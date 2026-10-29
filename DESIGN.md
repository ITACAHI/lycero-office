# DESIGN.md — Chuẩn Mực Thiết Kế Astryx (Meta) Tùy Biến Cho Lycero Office Desktop

Tài liệu này quy định toàn bộ tiêu chuẩn giao diện, hệ thống token thẩm mỹ, kiểu chữ, bố cục không gian và quy tắc tương tác người dùng (UX/UI) cho bộ ứng dụng **Lycero Office Desktop** trên các hệ điều hành Windows, macOS và Linux.

---

## 1. Triết Lý Thiết Kế & Bản Sắc Thị Giác (Design Philosophy)

Lycero Office được định vị là **bộ công cụ văn phòng thời đại AI Agent có khả năng cạnh tranh sòng phẳng với Microsoft Office**, do đó thiết kế giao diện phải đạt 3 phẩm chất cốt tử:
1. **Sự tập trung tĩnh lặng (Calm Productivity):** Người dùng làm việc với tài liệu, số liệu và bài thuyết trình hàng giờ liền. Giao diện phải êm dịu, không gây mỏi mắt, không có các hiệu ứng giật nảy hay đồ họa phô trương.
2. **Kỷ luật chống rác thị giác (Strict Anti-Slop):** Loại bỏ triệt để các bóng đổ tím xanh, viền hào quang phát sáng (glow), các thẻ lồng thẻ (nested cards) hay các khối màu gradient vô nghĩa thường thấy ở các ứng dụng AI chắp vá.
3. **Đa hình thích ứng (Polymorphic Adaptation):** Mặc định mang phong cách tinh tế, chuẩn mực của doanh nghiệp quốc tế (Corporate Neutral), nhưng sẵn sàng chuyển đổi liền mạch sang bản sắc sư phạm chuẩn mực khi kết nối hệ sinh thái Lycero EdTech.

---

## 2. Hệ Thống Màu Sắc & Bảng Token (Color System & Tokens)

Hệ thống màu sắc được phát triển từ nền tảng **Astryx (Meta)**, tối ưu cho hiển thị văn bản dài và bảo vệ thị lực trong môi trường làm việc cường độ cao:

### 2.1. Chế độ Ban Ngày (Warm Ivory & Terracotta — Matte Mode)
- **Nền tổng thể (App Canvas Background):** `#F4F2EB` (Màu kem ngà ấm, triệt tiêu ánh sáng xanh gắt của màn hình trắng tinh `#FFFFFF`).
- **Bề mặt tài liệu / Thẻ làm việc (Surface / Paper):** `#F9F8F3` (Sắc giấy ngà mềm cao cấp).
- **Mực chữ chính (Primary Text / Ink):** `#1C1B18` (Sắc than ấm, độ tương phản đạt chuẩn WCAG AAA trên nền ngà).
- **Mực chữ thứ cấp (Muted / Secondary Text):** `#6B6860`.
- **Đường viền phân tách (Borders & Dividers):** `#DDD9CE` (Thanh mảnh 1px, tinh tế và dứt khoát).
- **Điểm nhấn thương hiệu (Brand Accent):** `#8B3A1A` (Đất nung ấm - Warm Terracotta, đạt tỷ lệ tương phản chuẩn mực WCAG AA 4.5:1).
- **Màu tương tác di chuột (Hover Surface):** `#EFECE3`.
- **Màu chọn khối (Selection Highlight):** `rgba(139, 58, 26, 0.12)`.

### 2.2. Chế độ Ban Đêm (Claude-Warm Charcoal & Radiant Terracotta)
- **Nền tổng thể (App Dark Canvas):** `#262624` (Xám than ấm sâu thẳm, tuyệt đối không dùng đen tuyền OLED `#000000` gây gắt mắt).
- **Bề mặt tài liệu / Thẻ (Dark Surface):** `#2E2D2A`.
- **Thẻ nổi bật / Modal (Elevated Surface):** `#353430`.
- **Chữ chính (Dark Text):** `#F5F4EF` (Trắng ngà dịu mắt).
- **Chữ thứ cấp (Dark Muted):** `#A09D95`.
- **Đường viền tối (Dark Borders):** `#403E3A`.
- **Điểm nhấn đêm (Vibrant Terracotta):** `#D97757` (Tương phản rực rỡ nhưng ấm áp).
- **Màu tương tác di chuột (Dark Hover):** `#3B3935`.

---

## 3. Kiểu Chữ & Phông Chữ (Typography)

- **Phông chữ chính thức (Primary Font Family):** `Be Vietnam Pro`
  - Được thiết kế đặc biệt cho hiển thị tiếng Việt và ký tự Latinh quốc tế với dấu thanh cân đối hoàn hảo.
  - Bộ số liệu hình học (Tabular Figures) hiển thị chuẩn xác trong bảng tính Sheets và bảng ma trận.
- **Font Stack dự phòng (Fallback):**
  ```css
  font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif;
  ```
- **Giải thuật triệt tiêu giật bố cục (CLS = 0):** Định nghĩa font-metric fallback khớp tỷ lệ chiều cao x-height và cap-height của hệ thống.
- **Phông chữ hiển thị mã nguồn / Kỹ thuật:** `JetBrains Mono`, `Fira Code`, `Consolas`, monospace.

---

## 4. Bố Cục Không Gian Làm Việc Đa Trục (Workspace Architecture)

Bộ ứng dụng Lycero Office Desktop tuân thủ cấu trúc bố cục 3 vùng độc lập nhưng kết nối thời gian thực:

```
+-------------------------------------------------------------------------------+
| App Window Titlebar: File Tabs, Search, Sync EdTech Status, Model Indicator   |
+-----------+---------------------------------------------------+---------------+
| Left Rail | Center Editor Canvas                              | Right Panel   |
| (Files &  |                                                   | (Lycero Mate  |
| Explorer) | - Docs: Trang soạn thảo phân trang chuẩn khổ A4   | AI Copilot &  |
|           | - Sheets: Lưới ô tính vô hạn siêu tốc độ          | Reasoning     |
| [56px -   | - Slides: Bàn vẽ trình chiếu tỷ lệ 16:9           | Stream)       |
|  240px]   | - PDF/Markdown: Trình xem và chú giải byte-level  | [360px]       |
+-----------+---------------------------------------------------+---------------+
| Bottom Status Bar: Word Count, Page/Slide Index, Quota Usage, Zoom, Mode      |
+-------------------------------------------------------------------------------+
```

### 4.1. Vùng Trái — Cây Thư Mục & Quản Lý Tệp (Left Rail / Explorer)
- Khả năng thu gọn linh hoạt:
  - Dạng thanh biểu tượng 56px khi cần tối đa hóa không gian soạn thảo.
  - Dạng bảng điều khiển 240px hiển thị danh sách tệp gần đây (Recents), cây thư mục dự án cục bộ, kho mẫu (Templates).

### 4.2. Vùng Giữa — Bàn Soạn Thảo Độc Lập (Center Editor Canvas)
- Chiếm trọn tâm điểm của mắt nhìn.
- **Docs Canvas:** Hiển thị trang A4 chân thực với lề trang (Margins), thước đo (Ruler) chuẩn xác, hỗ trợ hiển thị 2 trang song song trên màn hình rộng.
- **Sheets Canvas:** Lưới tính toán hiệu năng cao, hỗ trợ freeze pane, thanh công thức (Formula Bar) thông minh, tự động hoàn thành hàm (Formula Autocomplete).
- **Slides Canvas:** Khung trình chiếu 16:9 với snap guide từ tính, danh sách slide thu nhỏ (Thumbnails) bên trái, thanh công cụ hình học trực quan.
- **PDF & Markdown Canvas:** Chú thích phân tầng, tách đôi màn hình xem trước (Live Split Preview).

### 4.3. Vùng Phải — Trợ Lý AI Lycero Mate (Right Copilot Panel)
- Chiều rộng chuẩn: `360px`, có thể bật/tắt tức thì bằng phím tắt `Ctrl + J` (hoặc `Cmd + J` trên macOS).
- **Header:** Hiển thị Selector chọn mô hình AI (Model Dropdown), nút làm mới danh sách mô hình từ máy chủ (`🔄 Máy chủ`), hạn ngạch sử dụng trong tháng (`Quota: 145 / 500`).
- **Khối Suy Luận Mở Rộng (`ThinkingBlock` Accordion):**
  - Hiển thị từng bước tư duy phân tích của các mô hình Reasoner (DeepSeek-R1, OpenAI o1/o3-mini, Gemini 2.0 Flash Thinking, Qwen 2.5 Max).
  - Tự động cuộn theo luồng stream, cho phép người dùng click để mở rộng hoặc thu gọn để không chiếm diện tích.
- **Thẻ Hành Động Tương Tác (`ActionCardData`):**
  - AI không chỉ trò chuyện mà sinh ra các khối hành động thực thi trực tiếp trên tài liệu:
    - *Docs:* Chèn đoạn văn, Thay thế phần bôi đen, Tạo bảng số liệu, Chèn công thức toán học LaTeX.
    - *Sheets:* Chèn hàng công thức tính toán, Định dạng có điều kiện, Vẽ biểu đồ phân tích.
    - *Slides:* Thêm slide mới, Tạo bố cục 2 cột, Thiết lập nội dung thuyết trình.

---

## 5. Quy Chuẩn Đa Hình (Polymorphic Design Rules)

Lycero Office phục vụ hai nhóm đối tượng lớn với cơ chế chuyển đổi thông minh:

### 5.1. Chế độ Mặc định: Doanh Nghiệp & Đa Ngành (Corporate Neutral)
- **Thuật ngữ giao diện:**
  - Tệp mới: *Văn bản mới*, *Bảng tính mới*, *Bài thuyết trình mới*.
  - Mẫu tài liệu: *Hợp đồng kinh tế*, *Biên bản họp*, *Kế hoạch kinh doanh*, *Báo cáo tài chính*, *Slide gọi vốn*, *Quy trình vận hành chuẩn SOP*.
  - Trợ lý AI: *Trợ lý văn phòng điều hành Lycero Mate*.
- **Màu sắc & biểu tượng:** Tối giản, thanh lịch, trang nhã.

### 5.2. Chế độ Giáo Dục & Đào Tạo (Lycero EdTech Persona)
- Kích hoạt khi: Người dùng bấm **"Đồng bộ với Lycero EdTech"** hoặc đăng nhập tài khoản giáo viên/nhà đào tạo.
- **Thuật ngữ giao diện tự động thích ứng:**
  - Tệp mới: *Giáo án bài dạy KHBD*, *Đề kiểm tra & Ma trận*, *Phân phối chương trình PPCT*, *Sáng kiến kinh nghiệm SKKN*.
  - Mẫu chuyên ngành theo 11 Archetype:
    1. K-12 GDPT 2018 (Công văn 5512, Thông tư 22/27).
    2. Quốc tế Song ngữ (IB PYP/MYP/DP, Cambridge IGCSE/A-Level).
    3. Đại học & Cao đẳng (Syllabus 15 tuần, CLO/PLO).
    4. Nghiên cứu sinh & Viện sĩ (APA 7th, IEEE, Scopus Review).
    5. Khảo thí & Luyện thi (Casio 9+, bẫy trắc nghiệm).
    6. Ngoại ngữ (IELTS, HSK, JLPT, CEFR).
    7. Nghề & Kỹ thuật (VQF, HSE, Thực hành xưởng).
    8. Đào tạo Doanh nghiệp L&D (ADDIE, Kirkpatrick).
    9. Gia sư & Dạy kèm (Lộ trình cấp tốc, Báo cáo Zalo).
    10. Mầm non (Montessori, GDMN 51/2020).
    11. Giáo dục Đặc biệt & Hòa nhập (IEP SMART, UDL).

---

## 6. Tiêu Chuẩn Micro-Interactions & Hiệu Năng Thị Giác

1. **Thời lượng chuyển động (Duration):** Mọi chuyển động vi mô (hover, active, dropdown, panel toggle) nằm trong khoảng `125ms - 250ms`.
2. **Hàm gia tốc (Easing):** Sử dụng hàm easing chuẩn mực `cubic-bezier(0.16, 1, 0.3, 1)` cho cảm giác nhạy bén, không bị trễ nải.
3. **Phản hồi tức thì (Instant Feedback):**
   - Click nút lưu: Xuất hiện biểu tượng đã lưu ngay lập tức tại thanh trạng thái (`Đã lưu cục bộ lúc 09:45`).
   - Phím tắt bàn phím: Hỗ trợ 100% chuẩn phím tắt của Microsoft Office (`Ctrl+S`, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `Ctrl+F`, `Ctrl+H`, `Ctrl+K`).
4. **Không gián đoạn công việc (Zero Layout Shift):** Khi thanh bên AI mở ra hoặc thu vào, canvas soạn thảo tự co giãn mượt mà theo CSS Flexbox / Grid, không làm giật vị trí con trỏ chuột hay vùng chọn văn bản.
