---
name: lycero-slides
title: Động Cơ Kiến Trúc Trình Chiếu 16 -9 (Cloud Slides Architect)
description: Quy chuẩn thiết kế bố cục trình chiếu 16 -9 Astryx, chống tràn chữ (HarfBuzz metrics) và phân cấp thị giác.
category: office
scenarios: Động Cơ Kiến Trúc Trình Chiếu 16 -9 (Cloud Slides Architect) chuẩn 2026 | Kiểm toán & chuẩn hóa thể thức | Tự động tính toán và Read-Back
quickPrompts: Áp dụng kỹ năng Động Cơ Kiến Trúc Trình Chiếu 16 -9 (Cloud Slides Architect) để khởi tạo tài liệu chuẩn thể thức Việt Nam 2026
metadata:
  version: 3.3.0
---

# Động Cơ Kiến Trúc Trình Chiếu 16:9 (Cloud Slides Architect) (lycero-slides)
> **Mô tả nghiệp vụ**: Quy chuẩn thiết kế bố cục trình chiếu 16:9 Astryx, chống tràn chữ (HarfBuzz metrics) và phân cấp thị giác.

[CLOUD SECRET SKILL: LYCERO-SLIDES v3.2 — MASTER 16:9 SLIDE DESIGN SYSTEM (MCKINSEY + TASTE PROTOCOL + MECHANICAL GATES)]
Tham số thiết kế: Chủ đề thị giác=editorial_warm, Mật độ thông tin=balanced, Tự động tạo lời giảng=true.

1. QUY TẮC ACTION TITLE, CHỐNG BỊA SỐ LIỆU & CỔNG KIỂM ĐỊNH CƠ HỌC (SLIDE MAKER MECHANICAL GATES):
   - [GATE 0 — ZERO UNVERIFIED STATISTICS / CẤM TUYỆT ĐỐI BỊA SỐ LIỆU]: CHỈ sử dụng các con số, thống kê, tỷ lệ % và dữ liệu tài chính do người dùng cung cấp trong câu lệnh hoặc tài liệu đính kèm. Khi người dùng không cung cấp số liệu cụ thể, BẮT BUỘC ghi rõ `"[cần số liệu]"` hoặc trình bày luận điểm định tính (bỏ hẳn con số giả định); TUYỆT ĐỐI KHÔNG tự sáng tác số liệu thống kê không có nguồn.
   - [GATE 1 — NO CATEGORY TITLE]: Tiêu đề mỗi slide BẮT BUỘC phải là 1 câu kết luận điều hành có động từ rõ ràng (<= 15 từ; chỉ gắn số liệu khi người dùng đã cung cấp, tuyệt đối không tự bịa số liệu). CẤM TUYỆT ĐỐI đặt tiêu đề danh mục chung chung ("Tổng quan", "Giới thiệu", "Kết quả", "Chi tiết", "Mục lục").
   - [GATE 2 — NOTES NEVER ECHO SLIDE]: Kịch bản thuyết trình (Speaker Notes) là phần lời nói tự nhiên bổ sung dẫn chứng, câu chuyện và chuyển ý của diễn giả; CẤM sao chép nguyên văn các gạch đầu dòng trên slide vào Speaker Notes.
   - [GATE 3 — CHART NEVER SAYS IT TWICE]: Khi slide đã có biểu đồ hoặc Big Number KPI, phần văn bản bên cạnh phải giải thích nguyên nhân ("Tại sao?") và hành động ("Làm gì tiếp?"), không đọc lại con số trên biểu đồ.

2. CHỐNG TRÀN CHỮ & NGÂN SÁCH TỪ NGỮ (CANVAS 1280×720 PX — WORD BUDGET <= 80 WORDS/SLIDE):
   - Mỗi slide chỉ truyền tải tối đa 1 thông điệp cốt lõi (Single Proposition), tổng số từ trên toàn slide <= 80 từ, không quá 4 cards hoặc 5 gạch đầu dòng (mỗi gạch đầu dòng <= 12 từ).
   - Khoảng cách lề an toàn bốn cạnh (Safe Margin) >= 48px (`x >= 48`, `y >= 44`, `x + w <= 1232`, `y + h <= 676`).
   - Khoảng cách giữa các card (Gap) >= 20px, padding bên trong card >= 16px. Không bao giờ lồng thẻ trong thẻ (no nested cards).

3. ĐA DẠNG HÓA BỐ CỤC (LAYOUT VARIETY & MCKINSEY EXHIBIT ARCHETYPES):
   - CẤM lặp lại cùng 1 kiểu layout ở 2 slide liên tiếp.
   - Bắt buộc luân phiên nhịp nhàng giữa các archetype bố cục chuẩn: `hero_big_number`, `three_column_cards`, `left_text_right_image`, `two_column_comparison`, `kpi_cards_row`, `timeline_horizontal`, `two_by_two_grid`.

4. BẢNG MÀU & ĐỘ TƯƠNG PHẢN (WCAG AA PALETTE & ANTI-AI SLOP):
   - Tối đa 1 màu nền chính (Background) + 1 màu chữ chính (Primary Text) + 2 màu nhấn (Primary/Secondary Accent) đạt độ tương phản chuẩn WCAG AA (>= 4.5:1).
   - CẤM tuyệt đối lỗi "rainbow cards" (mỗi thẻ 1 màu sặc sỡ khác nhau) hoặc gradient tím/xanh AI slop.

[QUY CHUẨN QUỐC HIỆU - TIÊU NGỮ, BẢNG DỮ LIỆU <COLGROUP> & CHỮ KÝ CHUẨN LYCERO v3.2]:
- **Nguyên tắc Thực thi Trung thực (Zero-Hallucination & Chuẩn Thể thức 2026)**: Khởi tạo ngay tài liệu đúng thể thức; TUYỆT ĐỐI KHÔNG tự bịa SĐT, email, địa chỉ, số CCCD, số GCN, số sổ tiết kiệm, số hợp đồng/hóa đơn/văn bản, nhà cung cấp, định mức, người phụ trách, căn cứ nội bộ, ý kiến, tiến độ, KR công ty hay nhật ký review không có trong đề bài — thông tin nào đề không nêu thì bắt buộc để "[cần bổ sung: ...]".
- **Khung HTML Golden Master Bắt buộc trên Word (`docs`)**:
  1) **Bảng Header 2 cột không viền (`44% / 56%`, cùng hàng đầu `vertical-align: top`)**:
     `<table style="width: 100%; border: none; border-collapse: collapse;"><colgroup><col style="width: 40%;" /><col style="width: 60%;" /></colgroup><tr><td style="width: 40%; text-align: center; vertical-align: top; border: none;"><p>TÊN CƠ QUAN CHỦ QUẢN</p><p><strong><u>TÊN CƠ QUAN / ĐƠN VỊ BAN HÀNH</u></strong></p><p>Số: [cần bổ sung: số văn bản]</p></td><td style="width: 60%; text-align: center; vertical-align: top; border: none;"><p><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p><p><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p><p><em>Hà Nội, ngày 30 tháng 10 năm 2026</em></p></td></tr></table>`
  2) **Tiêu đề chính & Trích yếu**: `<h1 style="text-align: center;"><strong>TÊN LOẠI VĂN BẢN / BÁO CÁO IN HOA ĐẬM</strong></h1>` và `<p style="text-align: center;"><strong>Về việc ...</strong></p>`.
  3) **Bảng Dữ liệu / Dự toán 6 cột có `<colgroup>` chia đúng tỷ lệ chuẩn (`8% / 42% / 10% / 8% / 15% / 17%` — tương ứng `720 / 3740 / 900 / 700 / 1400 / 1600 twips`)**:
     `<table style="width: 100%; border-collapse: collapse;" border="1"><colgroup><col style="width: 8%;" /><col style="width: 42%;" /><col style="width: 10%;" /><col style="width: 8%;" /><col style="width: 15%;" /><col style="width: 17%;" /></colgroup><thead><tr><th style="text-align: center;"><strong>STT</strong></th><th style="text-align: center;"><strong>Nội dung hạng mục / Khoản mục chi tiết</strong></th><th style="text-align: center;"><strong>ĐVT</strong></th><th style="text-align: center;"><strong>SL</strong></th><th style="text-align: center;"><strong>Đơn giá (đ)</strong></th><th style="text-align: center;"><strong>Thành tiền (đ)</strong></th></tr></thead><tbody>...<tr><td colspan="5" style="text-align: center;"><strong>TỔNG CỘNG</strong></td><td style="text-align: right;"><strong>45.000.000</strong></td></tr></tbody></table>`
  4) **Bảng Nơi nhận & Chữ ký 2 cột không viền (`45% / 55%`, giữ cùng trang với đoạn kết `keepNext` + `cantSplit`)**:
     `<table style="width: 100%; border: none; border-collapse: collapse;"><colgroup><col style="width: 45%;" /><col style="width: 55%;" /></colgroup><tr><td style="width: 45%; text-align: left; vertical-align: top; border: none;"><p><strong><em>Nơi nhận:</em></strong></p><p>- Như trên;</p><p>- Ban Giám đốc (để b/c);</p><p>- Lưu: VT, HS.</p></td><td style="width: 55%; text-align: center; vertical-align: top; border: none;"><p><strong>THỦ TRƯỞNG ĐƠN VỊ / GIÁM ĐỐC</strong></p><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p><p><strong>Nguyễn Văn A</strong></p></td></tr></table>`

<lycero_global_mandatory_rules_v2018>
## QUY TẮC CHUNG BẮT BUỘC (MỤC 6.A — SUPER PLAN v2.0.18 / 01/11/2026)
1. **Cấm tuyệt đối tự bịa chi tiết (`FX-15`, `FX-37`)**: Không được tự bịa SĐT, email, địa chỉ, số CCCD, số Giấy chứng nhận (GCN), số sổ tiết kiệm, số hợp đồng/hóa đơn/văn bản, nhà cung cấp, định mức, người phụ trách, căn cứ nội bộ, ý kiến, tiến độ, KR công ty hay nhật ký review không có trong đề bài. Thông tin nào đề không nêu thì bắt buộc để `"[cần bổ sung: ...]"`.
2. **Read-back bắt buộc & Báo lỗi trung thực (`FX-01`, `FX-19`, `FX-34`)**: Câu trả lời trong chat chỉ được nêu số liệu và tính năng đã đọc lại từ file sau khi lưu (`read-back` qua `docs read` / `sheet read` / `slides read`). Nếu thao tác công cụ (`sheet apply` / `docs apply` / `add_chart`) báo `error` hoặc `partial` thì phải nói rõ trong chat là thao tác đó chưa thực hiện được, tuyệt đối không nói đã làm xong. Không dán HTML thô hay lời gọi công cụ vào chat (`FX-34`).
3. **Địa giới hành chính 2 cấp từ 01/07/2025 (`FX-07`, `FX-08`, `FX-40`)**: Tuyệt đối không dùng cấp quận/huyện/thị xã/thành phố thuộc tỉnh cũ; chỉ dùng cấp Xã/Phường/Đặc khu và cấp Tỉnh/Thành phố trực thuộc TW. Tòa án dùng **TAND khu vực** (theo NQ 81/2025/UBTVQH15). Cơ quan thuế dùng **Thuế cơ sở** (ví dụ: *Thuế cơ sở 7 TP. Hồ Chí Minh*).
4. **Thể thức chuẩn Việt Nam (`FX-17`)**: Font `Times New Roman` cỡ 13–14pt; lề trên/dưới 20–25mm, trái 30–35mm, phải 15–20mm; 100% nhãn bằng tiếng Việt (cấm dùng nhãn tiếng Anh như *Action Items*, *Owner*, *Status*); số có dấu chấm phân cách nghìn (`1.000.000`); ngày định dạng `dd/mm/yyyy`.
5. **Quy tắc lưu file (`FX-02`, `FX-18`)**: Chỉ lưu file duy nhất tại thư mục tài liệu `"Lycero Office"`, không tạo bản trùng, không bao giờ chạy lệnh ghi file thử (`test.html`, `test.docx`, `"Hello test"`) vào thư mục hay tên file của người dùng.
6. **Chặn rò rỉ metadata nội bộ (`FX-03`)**: Tuyệt đối không đưa ID phiên (`kb-...`), trace ID hay timestamp hệ thống vào nội dung văn bản.

## CẬP NHẬT PHÁP LÝ VIỆT NAM 2025–2026 BẮT BUỘC ÁP DỤNG
- **Kế toán doanh nghiệp (`FX-05`)**: Áp dụng **`Thông tư 99/2025/TT-BTC` (hiệu lực 01/01/2026)** thay thế hoàn toàn chế độ kế toán doanh nghiệp cũ năm 2014.
- **Thuế TNCN & Tiền lương 2026 (`FX-11`)**: Giảm trừ gia cảnh bản thân **15,5 triệu đồng/tháng (15.500.000 đ/tháng)**, người phụ thuộc **6,2 triệu đồng/tháng (6.200.000 đ/người/tháng)** theo **`Nghị quyết 110/2025/UBTVQH15`**; biểu thuế lũy tiến từng phần **5 bậc** (5%, 15%, 25%, 30%, 35%) theo **`Luật Thuế TNCN số 109/2025/QH15`**.
- **Bảo vệ dữ liệu cá nhân (`FX-06`)**: Áp dụng **`Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15` + `Nghị định 356/2025/NĐ-CP` (hiệu lực 01/01/2026)** thay thế nghị định bảo vệ dữ liệu cá nhân cũ năm 2023.
- **Tòa án & Tố tụng dân sự/thương mại (`FX-07`, `FX-10`)**: Tòa án nhân dân sơ thẩm là **`TAND khu vực` (`Nghị quyết 81/2025/UBTVQH15`)** (thay tòa án cấp huyện cũ; bắt buộc cảnh báo khi đề bài có tên tòa cấp huyện cũ); Đơn khởi kiện theo **Mẫu số 23-DS (`Nghị quyết 01/2017/NQ-HĐTP`**, tuyệt đối không ghi NQ04); quan hệ giữa phạt vi phạm (trần 8% theo Điều 301) và bồi thường thiệt hại viện dẫn **Điều 307 Luật Thương mại 2005**.
- **Cơ quan Thuế (`FX-08`)**: Thay tên cơ quan thuế cấp quận/huyện cũ bằng **`Thuế cơ sở`** (ví dụ: *Thuế cơ sở 7 TP. Hồ Chí Minh*).
- **Ma trận & Đề kiểm tra (`FX-09`, `FX-22`)**: Theo **`Công văn 7991/BGDĐT-GDTrH`**: Ma trận **3 mức độ** (*Nhận biết – Thông hiểu – Vận dụng*, bỏ mức Vận dụng cao 4 mức cũ); cấu trúc **4 phần**: Nhiều lựa chọn (~3,0đ), Đúng–Sai (~2,0đ), Trả lời ngắn (~2,0đ), Tự luận (~3,0đ); tự kiểm tra tổng điểm từng hàng/cột = 10,0 và số câu khớp đề; đáp án phân bổ đủ A/B/C/D; bảng cô đọng không tràn 15 trang.
- **Giáo án CV 5512, Tiểu học CV 2345, Rubric, Hồ sơ giáo dục (`FX-23`, `FX-39`, `FX-40`)**: TUYỆT ĐỐI KHÔNG gắn Quốc hiệu - Tiêu ngữ, KHÔNG ghi UBND cấp huyện cũ, KHÔNG ghi căn cứ pháp lý hành chính hay mã số hồ sơ hành chính (`Số: .../KHBD`) vào giáo án hay tài liệu sư phạm. Giáo án CV 5512 đúng Phụ lục IV (I. Mục tiêu, II. Thiết bị dạy học và học liệu, III. Tiến trình dạy học đủ 4 hoạt động a/b/c/d, tổng thời gian ≤ 90 phút cho 2 tiết). Đánh giá học sinh đúng Điều 9 Thông tư 22/2021/TT-BGDĐT. Rubric ngưỡng điểm liên tục, không hở giữa 8,0 và 8,5.
- **Hóa đơn điện tử (`FX-27`)**: Viện dẫn **`Nghị định 123/2020/NĐ-CP` được sửa đổi, bổ sung bởi `Nghị định 70/2025/NĐ-CP` (hiệu lực 01/06/2025)**.
- **Bảo hiểm xã hội & Việc làm (`FX-28`)**: Viện dẫn **`Luật BHXH số 41/2024/QH15` (hiệu lực 01/07/2025)** và **`Luật Việc làm số 74/2025/QH15` (hiệu lực 01/01/2026)**.
- **Thuế TNDN (`FX-36`)**: Viện dẫn **`Luật Thuế TNDN số 67/2025/QH15`** (tuyệt đối không viện dẫn các thông tư thuế TNDN cũ năm 2014, 2015 đã hết hiệu lực hay số hiệu văn bản sai).
- **Thể thức Nghị định 30/2020/NĐ-CP (`FX-12`, `FX-13`, `FX-14`)**: Ô Quốc hiệu đủ rộng (56%–60%) không xuống dòng; đường kẻ ngang độc lập 1/3–1/2 dưới tên cơ quan và dưới trích yếu; mỗi dòng Căn cứ kết thúc bằng ";", **dòng Căn cứ cuối cùng bắt buộc kết thúc bằng "."**; đối với **Luật / Bộ luật** chỉ ghi tên Luật, không ghi số/ký hiệu kiểu `số .../QH...`; bỏ dòng `"(Ký, ghi rõ...)"`; bảng nhân sự không có cột `ĐVT/SL`; giữ tiêu đề `Điều` đi cùng nội dung.
- **Hợp đồng BĐS, Tuyển dụng, Bàn giao NS, Biên bản họp, Email, KPI, OKR, Chi phí (`FX-16`, `FX-20`, `FX-38`, `FX-41`, `FX-42`)**: Hợp đồng chuyển nhượng BĐS (`FX-38`) tổng các đợt thanh toán = đúng 100%; JD cảnh báo phân biệt đối xử theo BLLĐ 2019 (K8 Đ3, K1 Đ8), Luật Việc làm 74/2025/QH15 (K7 Đ2, K1 Đ5) và Luật Bình đẳng giới 2006; Bàn giao NS (`FX-42`) thanh toán trong 14 ngày làm việc (Điều 48 BLLĐ 2019), không ghi tài sản "đã thu hồi" khi đề ghi "chưa thống kê"; KPI (`FX-20`) định dạng `0,0%`, `=RANK.EQ`, biểu đồ cột, conditional format `< 95%`; OKR (`FX-41`) Tiến độ `0,0%`, Data Validation tự tin `1–10`, 100% tiếng Việt.
</lycero_global_mandatory_rules_v2018>

[LYCERO_CLOUD_SKILL:lycero-slides]
