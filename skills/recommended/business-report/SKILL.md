---
name: business-report
title: Viết Báo cáo Kinh doanh
description: Soạn báo cáo phân tích kinh doanh chuẩn cấu trúc (tóm tắt điều hành, bối cảnh, phân tích, khuyến nghị, phụ lục) với số liệu có dẫn nguồn, xuất ra tài liệu Word.
category: business
metadata:
  version: 3.0.0
---

# Viết Báo cáo Kinh doanh (business-report)
> **Mô tả nghiệp vụ**: Soạn báo cáo phân tích kinh doanh chuẩn cấu trúc (tóm tắt điều hành, bối cảnh, phân tích, khuyến nghị, phụ lục) với số liệu có dẫn nguồn, xuất ra tài liệu Word.

# Business report

You are drafting a report that a busy reader will skim first and read second.
Structure carries the argument; prose fills it in.

## Before writing

1. Pin down four things from the request and the attached files. Ask only if
   one is genuinely missing and cannot be inferred: the decision the report
   supports, the reader (executive, team, client, regulator), the time period
   or scope, and the length (default: 2-4 pages).
2. Read every attached or referenced file in full before drafting. Numbers,
   names and dates come from those sources, never from memory. If a source
   is silent, say so in the report rather than inventing a figure.
3. Write the one-sentence conclusion first. If you cannot state it in one
   sentence, you are not ready to write.

## Structure

Use these headings in this order, as real heading styles (Heading 1), not
bold paragraphs. Drop a section only when the request rules it out.

1. **Executive summary** — 3-6 sentences. The conclusion, the two or three
   facts that carry it, and what the reader is asked to decide or do. No
   background, no methodology.
2. **Background** — Why the question exists now. Scope and period. What was
   examined and what was left out, in one short paragraph each.
3. **Findings** (or **Analysis**) — One subsection (Heading 2) per finding,
   ordered by importance to the decision, not by the order you discovered
   them. Each subsection: a one-line finding as its first sentence, then the
   evidence. Put comparisons in a table; put trends in a short bullet list of
   figures, each with its period and source.
4. **Recommendations** — Numbered. Each one is an action with an owner and a
   time frame when the sources allow it, followed by one sentence on the
   cost or risk of not doing it. Recommendations must trace back to a
   finding above; do not introduce new facts here.
5. **Risks and open questions** — What could make the conclusion wrong, and
   what is still unknown. Short bullets.
6. **Appendix** — Source list, data tables too large for the body,
   definitions. Only when there is something to put here.

## Voice

- Plain, declarative sentences. One idea per sentence. Prefer the specific
  figure to the adjective: "fell 12% in Q3" not "fell sharply".
- Every number has a unit, a period and, in the Findings, a source (file
  name or document title in parentheses, or a footnote).
- No hedging stacks ("it may perhaps be possible"). State the confidence
  once, where it matters.
- No filler openers ("It is important to note that", "In today's fast-paced
  world"). Start with the point.
- Keep the reader's language: if the sources and request are in one
  language, the report is in that language throughout, including headings.

## Formatting in the document

- Title as the document title style, then a one-line subtitle with the
  date and author/team if known.
- Real heading styles for sections, real numbered lists for
  recommendations, real tables for comparisons. Never fake structure with
  tabs, manual numbers or bold-only lines.
- Tables: header row, units in the header, numbers right-aligned, at most
  6 columns. Add a one-line caption above each table.
- No decorative elements, colors or images unless the user asks.

## Before you say done

- The executive summary matches the recommendations: same conclusion, same
  count of actions.
- Every figure in the summary appears again in Findings with its source.
- Headings are heading styles; lists are list styles.
- Re-read the first and last paragraphs: they should make sense alone.
- Tell the user the structure you used and anything you could not source.

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
