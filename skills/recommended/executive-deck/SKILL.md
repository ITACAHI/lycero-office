---
name: executive-deck
title: Trình chiếu Báo cáo Điều hành
description: Xây dựng bài trình chiếu báo cáo lãnh đạo theo cấu trúc kim tự tháp (mỗi tiêu đề slide nêu bật một kết luận cốt lõi), xuất ra PowerPoint.
category: business
scenarios: Trình chiếu báo cáo Hội đồng Quản trị | Pitch Deck gọi vốn & trình bày chiến lược | Báo cáo tổng kết quý/năm điều hành (QBR)
quickPrompts: Thiết kế bộ Slide Báo cáo Điều hành (Executive Deck 16:9) trình HĐQT theo nguyên tắc Kim tự tháp Minto và Action Title | Xây dựng bộ Slide trình bày chiến lược kinh doanh và kết quả vận hành quý với bố cục Bento Grid hiện đại
metadata:
  version: 3.3.0
---

# Trình chiếu Báo cáo Điều hành (executive-deck)
> **Mô tả nghiệp vụ**: Xây dựng bài trình chiếu báo cáo lãnh đạo theo cấu trúc kim tự tháp (mỗi tiêu đề slide nêu bật một kết luận cốt lõi), xuất ra PowerPoint.

# Executive deck

A reporting deck is read, not performed. The reader should get the whole
argument from the slide titles alone; the body of each slide is the proof.

## Before building

1. Decide the single answer the deck gives. Write it as one sentence. That
   sentence is the title of slide 2 and the backbone of the whole deck.
2. Read every attached or referenced file fully. Figures, names and dates
   come only from there. If the source lacks a number the story needs, say
   so on the slide rather than estimating.
3. Fix the length from the request: default 8-12 slides for a business
   review, 5-7 for a status update. Fewer slides with a clear line beat
   more slides with everything.

## Structure (pyramid, answer first)

1. **Title slide** — Deck title that names the decision or question, date,
   presenter or team.
2. **Answer slide** — The one-sentence conclusion as the title; three
   supporting points as the body, each one line. Nothing else.
3. **One slide per supporting point** — Title = the point as a full
   sentence with a verb ("Churn rose because onboarding slipped in Q2", not
   "Churn"). Body = the evidence: one chart or one table or 3-5 bullets,
   never all three. Order the slides in the same order as the three points
   on the answer slide.
4. **Recommendation / next steps** — Numbered actions, each with an owner
   and a date where the source allows. Title states what is being asked
   ("Approve the Q4 onboarding rebuild").
5. **Risks or open questions** — Only if real. Short.
6. **Appendix** — Detail tables, methodology, backup charts. Nothing in the
   appendix may be needed to follow the main story.

## Slide rules

- Every title is a complete sentence stating a conclusion. If a title could
  sit on any deck ("Overview", "Results"), rewrite it.
- One message per slide. If a slide needs an "and", split it.
- Bullets: at most 5, each at most 12 words, parallel grammar, no
  sub-bullets. A bullet that needs a second line is a sentence for the
  notes, not a bullet.
- Numbers on slides carry unit and period. The source goes in a small
  footer line on that slide, not in a bullet.
- Charts: one series highlighted, the rest muted; title the chart with its
  takeaway, not its subject. Prefer bar for comparison, line for trend; no
  pie with more than 4 slices.
- Speaker notes hold the narration and the caveats, in full sentences.
  Write them for every content slide.
- Keep the deck's language consistent with the request and sources.

## Turning a document into a deck

- Extract the document's conclusion first, then its three strongest
  supports; everything else is appendix or dropped.
- Never paste paragraphs onto slides. Each paragraph becomes at most one
  bullet, or a figure.
- Preserve the document's figures exactly; do not round further than the
  source does.

## Design

Stay inside the app's default theme and layouts. Do not set custom fonts,
colors or sizes unless the user asks for a specific look. Consistency across
slides matters more than any single slide looking rich.

## Before you say done

- Read only the titles, top to bottom: they must form a coherent argument
  that ends in the recommendation.
- The three points on the answer slide match the following slide titles in
  wording and order.
- No slide has more than one chart/table, or more than 5 bullets.
- Every content slide has notes.
- Tell the user the storyline in three lines and list anything you could
  not source.

## KHUNG BIỂU MẪU, BẢNG BIỂU & CÔNG THỨC CHUYÊN SÂU BẮT BUỘC (EXECUTIVE-DECK v3.2)
- **[GATE 0 — CẤM BỊA SỐ LIỆU]**: Tuyệt đối chỉ dùng số liệu người dùng cung cấp; nếu thiếu số liệu thì ghi `"[cần số liệu]"` hoặc trình bày định tính.
- **[GATE 1 — ACTION TITLE]**: Tiêu đề mỗi slide là 1 câu kết luận điều hành có động từ rõ ràng (<= 15 từ), cấm đặt tiêu đề danh mục chung chung ("Tổng quan", "Kết quả", "Chi tiết").
- **Nhịp điệu Bố cục 1280×720**: Luân phiên `hero_big_number`, `kpi_cards_row`, `two_column_comparison`, `three_column_cards`, `timeline_horizontal`; tối đa 80 từ/slide, lề an toàn >= 48px.


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

[LYCERO_CLOUD_SKILL:executive-deck]
