---
name: executive-deck
title: Trình chiếu Báo cáo Điều hành
description: Xây dựng bài trình chiếu báo cáo lãnh đạo theo cấu trúc kim tự tháp (mỗi tiêu đề slide nêu bật một kết luận cốt lõi), xuất ra PowerPoint.
category: business
metadata:
  version: 3.0.0
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

## QUY CHUẨN QUỐC HIỆU - TIÊU NGỮ & TIÊU ĐỀ VĂN BẢN (CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP & LYCERO DOCS AST v3.0)
1. **KHỐI QUỐC HIỆU - TIÊU NGỮ & CƠ QUAN BAN HÀNH (BẮT BUỘC DÙNG BẢNG 2 CỘT KHÔNG VIỀN TỶ LỆ 44% / 56%)**:
   - Mở đầu mọi văn bản hành chính, hợp đồng, quyết định, tờ trình, thông báo, biên bản, báo cáo, quy chế, giáo án, đề kiểm tra bằng bảng HTML 2 cột không viền (`border: none; width: 100%; border-collapse: collapse`).
   - **TUYỆT ĐỐI KHÔNG** xếp Quốc hiệu - Tiêu ngữ thành các đoạn `<p>` rời rạc theo chiều dọc, **TUYỆT ĐỐI KHÔNG** dùng ký tự gạch ngang ASCII (`───────────` hoặc `---`), bắt buộc dùng thẻ `<strong><u>...</u></strong>` để gạch chân chuẩn:
     `<table style="width: 100%; border: none; border-collapse: collapse;"><tr><td style="width: 44%; text-align: center; vertical-align: top; border: none;"><p>CƠ QUAN CHỦ QUẢN (nếu có)</p><p><strong><u>TÊN CƠ QUAN / ĐƠN VỊ BAN HÀNH</u></strong></p><p>Số: .../2026/...</p></td><td style="width: 56%; text-align: center; vertical-align: top; border: none;"><p><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p><p><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p><p><em>Hà Nội, ngày ... tháng ... năm 2026</em></p></td></tr></table>`
2. **TIÊU ĐỀ CHÍNH VĂN BẢN (`<h1>`) & TRÍCH YẾU (`<p>`)**:
   - **Tên loại văn bản / Tiêu đề tài liệu**: BẮT BUỘC dùng thẻ `<h1 style="text-align: center;"><strong>TÊN VĂN BẢN / BÁO CÁO / HỢP ĐỒNG IN HOA ĐẬM</strong></h1>` căn giữa trang trọng.
   - **Trích yếu / Tiêu đề phụ**: Đặt ngay dưới `<h1>` bằng đoạn căn giữa in đậm `<p style="text-align: center;"><strong>Về việc: ... (hoặc Tên chuyên đề / Dự án / Kỳ báo cáo)</strong></p>`.
   - **Đề mục lớn**: Dùng `<h2><strong>PHẦN I / ĐIỀU 1. ...</strong></h2>` cho cấp 1 và `<h3><strong>1.1. ...</strong></h3>` cho cấp 2. Khi gọi công cụ `write_document(plan, title, context)`, tham số `title` bắt buộc là Tiêu đề chuẩn tiếng Việt (không đặt tên tiếng Anh thô hoặc slug).
   - **TUYỆT ĐỐI KHÔNG** chèn câu cảnh báo tiếng Anh (`This is a reference draft, not legal advice...`) vào trong nội dung văn bản.
3. **KHỐI NƠI NHẬN & CHỮ KÝ CUỐI VĂN BẢN (BẢNG 2 CỘT KHÔNG VIỀN 50% / 50%)**:
   - Kết thúc văn bản bằng bảng 2 cột không viền: Cột trái là `<p><strong><em><u>Nơi nhận:</u></em></strong></p>` (hoặc Đại diện Bên B / Người lập); Cột phải là `<p><strong>THẨM QUYỀN KÝ / ĐẠI DIỆN BÊN A</strong></p><p><em>(Ký, ghi rõ họ tên và đóng dấu)</em></p>`. Ngay sau khi ghi văn bản, gọi `set_page_setup` (khổ A4 chuẩn) và `apply_ops` để căn chỉnh toàn cục.
