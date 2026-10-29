/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sheetCsvToXlsxBuffer } from '@lycero/xlsx-gateway/gateway/csv-import'
import { createBlankPptx } from '@lycero/pptx-engine'

export interface TemplateResult {
  kind: 'docs-ai-content' | 'file-on-disk'
  title: string
  html?: string
  filePath?: string
}

export function buildKhbd5512Html(): { title: string; html: string } {
  const title = 'Kế hoạch bài dạy (KHBD) - Chuẩn 5512'
  const html = `
    <div style="font-family: 'Be Vietnam Pro', 'Times New Roman', serif; line-height: 1.5; color: #1C1B18;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: none;">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            <strong>TRƯỜNG: ............................................</strong><br/>
            <strong>TỔ CHUYÊN MÔN: ............................</strong><br/>
            <em>Họ và tên giáo viên: ................................</em>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
            <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
            <em>.................., ngày ..... tháng ..... năm 202...</em>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 18pt; text-transform: uppercase; margin-bottom: 4px; color: #8B3A1A;">
        KẾ HOẠCH BÀI DẠY (GIÁO ÁN)
      </h1>
      <p style="text-align: center; font-size: 13pt; margin-top: 0; margin-bottom: 20px;">
        <strong>BÀI: [TÊN BÀI HỌC]</strong><br/>
        <em>Môn học: ...................... - Lớp: ........ - Thời lượng: ..... tiết</em>
      </p>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px;">
        I. MỤC TIÊU BÀI DẠY
      </h2>
      <p><strong>1. Về kiến thức:</strong></p>
      <ul>
        <li>Học sinh trình bày và giải thích được: [Nội dung trọng tâm 1]</li>
        <li>Học sinh phân tích và áp dụng được: [Nội dung trọng tâm 2]</li>
      </ul>
      <p><strong>2. Về năng lực:</strong></p>
      <ul>
        <li><strong>Năng lực chung:</strong>
          <ul>
            <li><em>Năng lực tự chủ và tự học:</em> Chủ động tìm kiếm học liệu, nghiên cứu trước nội dung bài học.</li>
            <li><em>Năng lực giao tiếp và hợp tác:</em> Tích cực thảo luận nhóm, lắng nghe và phản biện tôn trọng ý kiến thành viên khác.</li>
            <li><em>Năng lực giải quyết vấn đề và sáng tạo:</em> Đề xuất được giải pháp cho tình huống sư phạm đặt ra.</li>
          </ul>
        </li>
        <li><strong>Năng lực đặc thù bộ môn:</strong> Nhận diện, vận dụng thành thạo các phương pháp và công cụ đặc thù của môn học vào bài tập thực tế.</li>
      </ul>
      <p><strong>3. Về phẩm chất:</strong></p>
      <ul>
        <li><em>Chăm chỉ:</em> Kiên trì hoàn thành nhiệm vụ được phân công trong nhóm và cá nhân.</li>
        <li><em>Trung thực:</em> Khách quan trong đánh giá chéo và báo cáo kết quả học tập.</li>
        <li><em>Trách nhiệm:</em> Có ý thức trách nhiệm với nhóm và liên hệ thực tế đời sống.</li>
      </ul>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU
      </h2>
      <p><strong>1. Thiết bị và học liệu của giáo viên:</strong> Giáo án điện tử, bài giảng trình chiếu đa phương tiện (PPTX), video clip thực tế, Phiếu học tập số 1, 2, 3; Bảng phân nhiệm vụ nhóm.</p>
      <p><strong>2. Thiết bị và học liệu của học sinh:</strong> Sách giáo khoa, vở ghi bài, bút màu, sản phẩm đã chuẩn bị theo dặn dò từ tiết học trước.</p>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        III. TIẾN TRÌNH DẠY HỌC (CHUẨN 4 HOẠT ĐỘNG CÔNG VĂN 5512)
      </h2>

      <h3 style="font-size: 12.5pt; color: #2D2A26; background: #F4F2EB; padding: 6px 10px; border-left: 4px solid #8B3A1A;">
        HOẠT ĐỘNG 1: XÁC ĐỊNH VẤN ĐỀ / MỞ ĐẦU (KHỞI ĐỘNG) (Thời lượng: 5 - 7 phút)
      </h3>
      <p><strong>a) Mục tiêu:</strong> Tạo hứng thú, kích hoạt kiến thức nền tảng của học sinh và tạo tâm thế bước vào bài học mới.</p>
      <p><strong>b) Nội dung:</strong> Giáo viên chiếu tình huống thực tế / câu hỏi thách đố / trò chơi khởi động ngắn.</p>
      <p><strong>c) Sản phẩm:</strong> Câu trả lời miệng hoặc phiếu trả lời nhanh của học sinh ghi nhận mâu thuẫn nhận thức cần giải quyết.</p>
      <p><strong>d) Tổ chức thực hiện:</strong></p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #DDD9CE;">
        <thead>
          <tr style="background: #EBE7DD;">
            <th style="border: 1px solid #DDD9CE; padding: 8px; width: 50%; text-align: center;">HOẠT ĐỘNG CỦA GIÁO VIÊN</th>
            <th style="border: 1px solid #DDD9CE; padding: 8px; width: 50%; text-align: center;">HOẠT ĐỘNG CỦA HỌC SINH</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              <strong>Bước 1: Chuyển giao nhiệm vụ:</strong><br/>
              - Giáo viên trình chiếu video/tình huống và đặt câu hỏi gợi mở.<br/>
              - Quy định thời gian suy nghĩ: 2 phút.
            </td>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              - Học sinh quan sát, tiếp nhận nhiệm vụ được giao.
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              <strong>Bước 2: Thực hiện nhiệm vụ:</strong><br/>
              - Theo dõi học sinh suy nghĩ, hỗ trợ học sinh gặp khó khăn.
            </td>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              - Cá nhân độc lập suy nghĩ và ghi nhanh từ khóa ra giấy nháp.
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              <strong>Bước 3: Báo cáo, thảo luận:</strong><br/>
              - Mời đại diện 2 học sinh phát biểu câu trả lời.
            </td>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              - Trình bày câu trả lời; các học sinh khác chú ý lắng nghe, bổ sung.
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              <strong>Bước 4: Kết luận, nhận định:</strong><br/>
              - Giáo viên nhận xét tinh thần khởi động và dẫn dắt vào bài học.
            </td>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              - Lắng nghe, ghi tên bài học vào vở ghi.
            </td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-size: 12.5pt; color: #2D2A26; background: #F4F2EB; padding: 6px 10px; border-left: 4px solid #8B3A1A; margin-top: 20px;">
        HOẠT ĐỘNG 2: HÌNH THÀNH KIẾN THỨC MỚI (KHÁM PHÁ) (Thời lượng: 20 - 25 phút)
      </h3>
      <p><strong>a) Mục tiêu:</strong> Học sinh tự lực chiếm lĩnh kiến thức trọng tâm của bài học thông qua hoạt động nhóm/cá nhân.</p>
      <p><strong>b) Nội dung:</strong> Đọc tài liệu, thực hiện Phiếu học tập số 1 để xây dựng khái niệm/quy luật.</p>
      <p><strong>c) Sản phẩm:</strong> Phiếu học tập đã điền đầy đủ và sơ đồ tư duy tóm tắt kiến thức cốt lõi.</p>
      <p><strong>d) Tổ chức thực hiện:</strong> (Thực hiện tuần tự 4 bước: Chuyển giao nhiệm vụ -> Thực hiện nhiệm vụ -> Báo cáo, thảo luận -> Kết luận, nhận định chuẩn hóa kiến thức).</p>

      <h3 style="font-size: 12.5pt; color: #2D2A26; background: #F4F2EB; padding: 6px 10px; border-left: 4px solid #8B3A1A; margin-top: 20px;">
        HOẠT ĐỘNG 3: LUYỆN TẬP (Thời lượng: 8 - 10 phút)
      </h3>
      <p><strong>a) Mục tiêu:</strong> Củng cố, khắc sâu kiến thức vừa hình thành qua hệ thống bài tập trắc nghiệm và tự luận phân hóa.</p>
      <p><strong>b) Nội dung:</strong> Giải quyết bài tập trong Phiếu học tập số 2 hoặc trò chơi trắc nghiệm tương tác.</p>
      <p><strong>c) Sản phẩm:</strong> Đáp án bài tập của học sinh được đối chiếu với thang đo chuẩn.</p>
      <p><strong>d) Tổ chức thực hiện:</strong> Học sinh thực hiện cá nhân kết hợp đánh giá chéo giữa các cặp đôi.</p>

      <h3 style="font-size: 12.5pt; color: #2D2A26; background: #F4F2EB; padding: 6px 10px; border-left: 4px solid #8B3A1A; margin-top: 20px;">
        HOẠT ĐỘNG 4: VẬN DỤNG & MỞ RỘNG (Thời lượng: 3 - 5 phút)
      </h3>
      <p><strong>a) Mục tiêu:</strong> Khuyến khích học sinh vận dụng kiến thức bài học để giải quyết vấn đề thực tiễn trong cuộc sống.</p>
      <p><strong>b) Nội dung:</strong> Nhiệm vụ dự án nhỏ hoặc câu hỏi nghiên cứu tại nhà.</p>
      <p><strong>c) Sản phẩm:</strong> Bài thu hoạch hoặc sản phẩm sáng tạo nộp vào tiết học tiếp theo.</p>
      <p><strong>d) Hướng dẫn học sinh tự học:</strong> Ôn tập bài cũ, chuẩn bị bài mới [Tên bài học tiếp theo].</p>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        IV. HỒ SƠ DẠY HỌC & PHIẾU HỌC TẬP
      </h2>
      <div style="border: 1px dashed #DDD9CE; padding: 12px; background: #FAF9F6; margin-top: 8px;">
        <p style="text-align: center; margin: 0; font-weight: bold;">PHIẾU HỌC TẬP SỐ 1</p>
        <p><strong>Nhóm:</strong> .................... - <strong>Lớp:</strong> ....................</p>
        <p><em>Nhiệm vụ: Hãy đọc thông tin mục 1 SGK trang ..... và hoàn thành bảng so sánh dưới đây:</em></p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #DDD9CE;">
          <tr style="background: #F4F2EB;">
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 30%;">Tiêu chí</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 35%;">Đối tượng A</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 35%;">Đối tượng B</th>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Đặc điểm nhận diện</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">...................................</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">...................................</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Vai trò ứng dụng</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">...................................</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">...................................</td>
          </tr>
        </table>
      </div>
    </div>
  `
  return { title, html }
}

export function buildBloomMatrixHtml(): { title: string; html: string } {
  const title = 'Ma trận & Đề kiểm tra - Chuẩn Bloom'
  const html = `
    <div style="font-family: 'Be Vietnam Pro', 'Times New Roman', serif; line-height: 1.5; color: #1C1B18;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: none;">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            <strong>SỞ GIÁO DỤC VÀ ĐÀO TẠO ....................</strong><br/>
            <strong>TRƯỜNG THPT / THCS ............................</strong>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            <strong>KHUNG MA TRẬN & BẢN ĐẶC TẢ ĐỀ KIỂM TRA</strong><br/>
            <strong>NĂM HỌC 2025 - 2026</strong><br/>
            <em>Môn: ........................ - Thời gian: 45 phút</em>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 16pt; text-transform: uppercase; color: #8B3A1A; margin-bottom: 16px;">
        BẢNG MA TRẬN ĐỀ KIỂM TRA ĐỊNH KỲ (CHUẨN 4 MỨC ĐỘ BLOOM)
      </h1>

      <table style="width: 100%; border-collapse: collapse; font-size: 11pt; border: 1px solid #DDD9CE;">
        <thead>
          <tr style="background: #EBE7DD; text-align: center;">
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 5%;">STT</th>
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 25%;">Chủ đề / Đơn vị kiến thức</th>
            <th colspan="4" style="border: 1px solid #DDD9CE; padding: 6px;">Mức độ nhận thức (Bloom)</th>
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Tổng số câu</th>
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Tổng điểm</th>
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Tỉ lệ %</th>
          </tr>
          <tr style="background: #F4F2EB; text-align: center;">
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Nhận biết (40%)</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Thông hiểu (30%)</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Vận dụng (20%)</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Vận dụng cao (10%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>Chủ đề 1:</strong> [Tên chủ đề hoặc chương 1]</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">4 câu (TN)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2 câu (TN)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1 câu (TL)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">0</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">7</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">3.5 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">35%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>Chủ đề 2:</strong> [Tên chủ đề hoặc chương 2]</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">4 câu (TN)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">3 câu (TN)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1 câu (TL)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1 câu (TL)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">9</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">4.5 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">45%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">3</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>Chủ đề 3:</strong> [Tên chủ đề hoặc chương 3]</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2 câu (TN)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2 câu (TN)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">0</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">0</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">4</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2.0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">20%</td>
          </tr>
          <tr style="background: #FAF9F6; font-weight: bold; text-align: center;">
            <td colspan="2" style="border: 1px solid #DDD9CE; padding: 6px;">TỔNG CỘNG</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">10 câu (4.0 đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">7 câu (3.0 đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">2 câu (2.0 đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">1 câu (1.0 đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">20 câu</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">10.0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">100%</td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        BẢN ĐẶC TẢ MA TRẬN ĐỀ KIỂM TRA
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5pt; border: 1px solid #DDD9CE; margin-top: 8px;">
        <thead>
          <tr style="background: #EBE7DD; text-align: center;">
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 5%;">STT</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 25%;">Chủ đề</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 45%;">Yêu cầu cần đạt (Chuẩn KT-KN)</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 25%;">Số câu hỏi theo mức độ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Chủ đề 1</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">
              - <em>Nhận biết:</em> Nêu được định nghĩa, phân biệt các thành phần cốt lõi.<br/>
              - <em>Thông hiểu:</em> Giải thích được mối liên hệ giữa các hiện tượng.<br/>
              - <em>Vận dụng:</em> Giải bài tập cơ bản áp dụng công thức.
            </td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; font-size: 9.5pt;">
              - C1, C2, C3, C4 (NB)<br/>
              - C5, C6 (TH)<br/>
              - C17 (VD)
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        ĐỀ THI MINH HỌA
      </h2>
      <p><strong>PHẦN I: TRẮC NGHIỆM NHIỀU LỰA CHỌN (7.0 điểm)</strong></p>
      <p><em>Thí sinh trả lời từ câu 1 đến câu 17. Mỗi câu trả lời đúng được điểm theo quy định.</em></p>
      <p><strong>Câu 1 (Nhận biết):</strong> [Nội dung câu hỏi trắc nghiệm số 1]...<br/>
        A. Lựa chọn A &nbsp;&nbsp;&nbsp;&nbsp; B. Lựa chọn B &nbsp;&nbsp;&nbsp;&nbsp; C. Lựa chọn C &nbsp;&nbsp;&nbsp;&nbsp; D. Lựa chọn D
      </p>
      <p><strong>Câu 2 (Nhận biết):</strong> [Nội dung câu hỏi trắc nghiệm số 2]...<br/>
        A. Lựa chọn A &nbsp;&nbsp;&nbsp;&nbsp; B. Lựa chọn B &nbsp;&nbsp;&nbsp;&nbsp; C. Lựa chọn C &nbsp;&nbsp;&nbsp;&nbsp; D. Lựa chọn D
      </p>

      <p style="margin-top: 16px;"><strong>PHẦN II: TỰ LUẬN (3.0 điểm)</strong></p>
      <p><strong>Câu 18 (1.5 điểm - Vận dụng):</strong> [Nội dung bài tập vận dụng kiến thức đã học vào tình huống cụ thể]...</p>
      <p><strong>Câu 19 (1.5 điểm - Vận dụng cao):</strong> [Nội dung bài toán liên hệ thực tiễn, đòi hỏi tư duy phân tích tổng hợp sáng tạo]...</p>
    </div>
  `
  return { title, html }
}

export function buildUniversitySyllabusHtml(): { title: string; html: string } {
  const title = 'Đề cương chi tiết học phần - Chuẩn AUN-QA'
  const html = `
    <div style="font-family: 'Be Vietnam Pro', 'Times New Roman', serif; line-height: 1.5; color: #1C1B18;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: none;">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            <strong>BỘ GIÁO DỤC VÀ ĐÀO TẠO</strong><br/>
            <strong>TRƯỜNG ĐẠI HỌC ................................</strong><br/>
            <strong>KHOA: ................................................</strong>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
            <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
            <em>.................., ngày ..... tháng ..... năm 202...</em>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 16pt; text-transform: uppercase; color: #8B3A1A; margin-bottom: 4px;">
        ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN (COURSE SYLLABUS)
      </h1>
      <p style="text-align: center; font-size: 12pt; margin-top: 0; margin-bottom: 20px;">
        <strong>HỌC PHẦN: [TÊN HỌC PHẦN ĐÀO TẠO]</strong><br/>
        <em>Chuẩn kiểm định chất lượng AUN-QA / CDIO - 15 tuần đào tạo tín chỉ</em>
      </p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 3px;">
        1. THÔNG TIN TỔNG QUÁT VỀ HỌC PHẦN
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 11pt; border: 1px solid #DDD9CE;">
        <tr>
          <td style="width: 30%; padding: 6px; border: 1px solid #DDD9CE; background: #F4F2EB;"><strong>Tên tiếng Việt:</strong></td>
          <td style="padding: 6px; border: 1px solid #DDD9CE;">[Tên học phần bằng tiếng Việt]</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #DDD9CE; background: #F4F2EB;"><strong>Tên tiếng Anh:</strong></td>
          <td style="padding: 6px; border: 1px solid #DDD9CE;">[Course Name in English]</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #DDD9CE; background: #F4F2EB;"><strong>Mã học phần:</strong></td>
          <td style="padding: 6px; border: 1px solid #DDD9CE;">EDU301 / CS201</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #DDD9CE; background: #F4F2EB;"><strong>Số tín chỉ:</strong></td>
          <td style="padding: 6px; border: 1px solid #DDD9CE;">3 tín chỉ (Lý thuyết: 2, Thực hành/Thảo luận: 1, Tự học: 6)</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #DDD9CE; background: #F4F2EB;"><strong>Học phần tiên quyết:</strong></td>
          <td style="padding: 6px; border: 1px solid #DDD9CE;">[Mã học phần trước nếu có]</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #DDD9CE; background: #F4F2EB;"><strong>Giảng viên phụ trách:</strong></td>
          <td style="padding: 6px; border: 1px solid #DDD9CE;">TS. / ThS. ..................................... - Email: ..........................</td>
        </tr>
      </table>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 3px; margin-top: 20px;">
        2. MÔ TẢ HỌC PHẦN (COURSE DESCRIPTION)
      </h2>
      <p style="text-align: justify;">
        Học phần cung cấp cho người học hệ thống tri thức nền tảng và chuyên sâu về lý thuyết và phương pháp ứng dụng trong lĩnh vực chuyên ngành. Sinh viên được trang bị kỹ năng phân tích phản biện, giải quyết vấn đề kỹ thuật và làm việc nhóm thông qua các dự án bài tập lớn (Capstone) và nghiên cứu tình huống thực tế (Case study).
      </p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 3px; margin-top: 20px;">
        3. CHUẨN ĐẦU RA CỦA HỌC PHẦN (CLOs)
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 11pt; border: 1px solid #DDD9CE;">
        <thead>
          <tr style="background: #EBE7DD;">
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 15%; text-align: center;">Ký hiệu CLO</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 65%;">Mô tả chuẩn đầu ra học phần (Người học hoàn thành có thể:)</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 20%; text-align: center;">Ánh xạ PLO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center; font-weight: bold;">CLO1</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Trình bày được các nguyên lý cơ bản và kiến trúc hệ thống của chuyên ngành.</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">PLO1, PLO2</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center; font-weight: bold;">CLO2</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Vận dụng các thuật toán và mô hình phân tích để thiết kế giải pháp kỹ thuật.</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">PLO3</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center; font-weight: bold;">CLO3</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Triển khai và thực nghiệm thành công một dự án phần mềm/nghiệp vụ theo nhóm.</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">PLO4, PLO5</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center; font-weight: bold;">CLO4</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Thể hiện tư duy liêm chính học thuật, đạo đức nghề nghiệp và giao tiếp chuyên nghiệp.</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">PLO7</td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 3px; margin-top: 20px;">
        4. PHƯƠNG PHÁP ĐÁNH GIÁ KẾT QUẢ HỌC TẬP
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 11pt; border: 1px solid #DDD9CE;">
        <thead>
          <tr style="background: #EBE7DD; text-align: center;">
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 25%;">Thành phần đánh giá</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 35%;">Hình thức đánh giá</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 20%;">Chuẩn CLO</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 20%;">Trọng số %</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>A1. Đánh giá chuyên cần</strong></td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Điểm danh, tham gia thảo luận trên lớp</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">CLO4</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">10%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>A2. Đánh giá quá trình</strong></td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Bài kiểm tra giữa kỳ + Bài tập dự án nhóm</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">CLO1, CLO2, CLO3</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">40%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>A3. Thi kết thúc học phần</strong></td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Thi viết tự luận / Vấn đáp bảo vệ đồ án</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">CLO1, CLO2, CLO4</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">50%</td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 3px; margin-top: 20px;">
        5. KẾ HOẠCH GIẢNG DẠY VÀ HỌC TẬP CHI TIẾT (15 TUẦN)
      </h2>
      <p><em>(Giảng viên cập nhật các tuần học từ Tuần 1 đến Tuần 15 theo tiến độ đề cương).</em></p>
    </div>
  `
  return { title, html }
}

export function buildGradebookTt22Csv(): string {
  const lines: string[] = [
    'BẢNG THEO DÕI VÀ ĐÁNH GIÁ HỌC SINH (CHUẨN THÔNG TƯ 22/2021/TT-BGDĐT)',
    'Trường: ............................................;Lớp: 10A1;Năm học: 2025 - 2026;Học kỳ: I',
    '',
    'STT,Họ và tên học sinh,Giới tính,Ngày sinh,ĐĐGtx 1,ĐĐGtx 2,ĐĐGtx 3,ĐĐGtx 4,ĐĐGgk,ĐĐGck,ĐTBmhk,Kết quả xếp loại',
    '1,Nguyễn An Bình,Nam,15/02/2009,8.5,9.0,8.0,9.0,8.5,9.0,8.7,Tốt',
    '2,Trần Thị Mai Chi,Nữ,22/04/2009,9.0,9.5,9.0,9.5,9.0,9.5,9.3,Tốt',
    '3,Lê Hoàng Dũng,Nam,10/08/2009,7.0,7.5,8.0,7.0,7.5,8.0,7.6,Khá',
    '4,Phạm Ngọc Diệp,Nữ,05/11/2009,8.0,8.5,8.0,8.5,8.0,8.5,8.3,Tốt',
    '5,Vũ Tuấn Đạt,Nam,18/01/2009,6.5,7.0,6.0,7.0,6.5,7.0,6.7,Khá',
    '6,Hoàng Minh Hải,Nam,30/06/2009,7.5,8.0,7.5,8.0,8.0,8.5,8.0,Tốt',
    '7,Đỗ Quỳnh Hương,Nữ,14/09/2009,8.5,9.0,8.5,9.0,8.5,9.0,8.8,Tốt',
    '8,Bùi Gia Huy,Nam,27/03/2009,6.0,6.5,6.0,6.5,6.0,6.5,6.3,Đạt',
    '9,Ngô Bảo Khánh,Nam,02/12/2009,8.0,8.0,8.5,8.5,8.0,8.5,8.2,Tốt',
    '10,Đặng Thùy Linh,Nữ,19/05/2009,7.5,8.0,7.5,8.0,7.5,8.0,7.8,Khá',
    '11,Dương Quốc Nam,Nam,11/07/2009,5.5,6.0,5.5,6.0,6.0,6.5,6.0,Đạt',
    '12,Lý Trúc Như,Nữ,25/10/2009,9.0,9.5,9.0,9.5,9.5,9.5,9.4,Tốt',
    '13,Phan Văn Phúc,Nam,08/03/2009,7.0,7.5,7.0,7.5,7.0,7.5,7.3,Khá',
    '14,Trịnh Kim Quyên,Nữ,16/12/2009,8.5,8.5,9.0,9.0,8.5,9.0,8.8,Tốt',
    '15,Võ Minh Trí,Nam,03/09/2009,6.5,7.0,6.5,7.0,7.0,7.5,7.1,Khá',
    '',
    'Quy định tính ĐTBmhk theo TT 22/2021/TT-BGDĐT: ĐTBmhk = (Tổng ĐĐGtx + 2*ĐĐGgk + 3*ĐĐGck) / (Số ĐĐGtx + 5)',
    'Xếp loại học lực: Tốt (ĐTBm >= 8.0); Khá (6.5 <= ĐTBm < 8.0); Đạt (5.0 <= ĐTBm < 6.5); Chưa đạt (ĐTBm < 5.0)',
  ]
  return lines.join('\n')
}

// ── 6. Mẫu Hợp Đồng Kinh Tế & Dịch Vụ Thương Mại Chuẩn ───────────────────
export function buildBusinessContractHtml(): { title: string; html: string } {
  const title = 'Hợp đồng dịch vụ thương mại chuẩn mực'
  const html = `
    <div style="font-family: 'Be Vietnam Pro', Arial, sans-serif; line-height: 1.6; color: #1C1B18;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: none;">
        <tr>
          <td style="width: 100%; text-align: center; border: none;">
            <strong style="font-size: 13pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
            <strong style="font-size: 12pt;">Độc lập - Tự do - Hạnh phúc</strong><br/>
            <span style="font-size: 11pt;">***</span>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 18pt; text-transform: uppercase; margin-bottom: 6px; color: #8B3A1A;">
        HỢP ĐỒNG CUNG CẤP DỊCH VỤ VÀ PHÁT TRIỂN DỰ ÁN
      </h1>
      <p style="text-align: center; font-size: 11pt; margin-top: 0; margin-bottom: 24px;">
        <em>Số: ......./2026/HĐDV/ITAC-LYCERO</em><br/>
        <em>Hôm nay, ngày ..... tháng ..... năm 2026, tại Trụ sở Công ty Cổ phần ....................</em>
      </p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #DDD9CE; padding-bottom: 4px;">
        CÁC BÊN THAM GIA KÝ KẾT HỢP ĐỒNG:
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 12px;">
            <p><strong>BÊN A (BÊN SỬ DỤNG DỊCH VỤ):</strong></p>
            <p>Tên tổ chức / Doanh nghiệp: ........................................</p>
            <p>Mã số doanh nghiệp: ...................................................</p>
            <p>Địa chỉ trụ sở: ..............................................................</p>
            <p>Người đại diện theo pháp luật: ......................................</p>
            <p>Chức vụ: Giám đốc / Tổng Giám đốc</p>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 12px; border-left: 1px solid #DDD9CE;">
            <p><strong>BÊN B (BÊN CUNG CẤP DỊCH VỤ):</strong></p>
            <p>Tên tổ chức / Doanh nghiệp: <strong>CÔNG TY CỔ PHẦN CÔNG NGHỆ LYCERO</strong></p>
            <p>Mã số doanh nghiệp: 0109988776</p>
            <p>Địa chỉ trụ sở: Tầng 8, Tòa nhà Công nghệ cao, Hà Nội</p>
            <p>Người đại diện theo pháp luật: Ông/Bà .............................</p>
            <p>Chức vụ: Giám đốc Điều hành</p>
          </td>
        </tr>
      </table>

      <p>Sau khi bàn bạc và thống nhất, Hai Bên đồng ý ký kết Hợp đồng dịch vụ với các điều khoản sau:</p>

      <h3 style="font-size: 12pt; color: #8B3A1A;">ĐIỀU 1: ĐỐI TƯỢNG VÀ PHẠM VI DỊCH VỤ</h3>
      <p>1.1. Bên A đồng ý thuê và Bên B đồng ý cung cấp giải pháp chuyển đổi số và triển khai nền tảng công nghệ cho Bên A.</p>
      <p>1.2. Chi tiết hạng mục công việc, yêu cầu kỹ thuật và lộ trình bàn giao được quy định chi tiết tại Phụ lục 01 kèm theo Hợp đồng này.</p>

      <h3 style="font-size: 12pt; color: #8B3A1A;">ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN</h3>
      <p>2.1. Tổng giá trị Hợp đồng (đã bao gồm thuế GTGT 10%): <strong>............ VNĐ</strong> (Bằng chữ: ....................................).</p>
      <p>2.2. Tiến độ thanh toán chia làm 03 đợt chuyển khoản:</p>
      <ul>
        <li><strong>Đợt 1 (Tạm ứng):</strong> Thanh toán 40% giá trị hợp đồng ngay sau khi ký kết.</li>
        <li><strong>Đợt 2 (Nghiệm thu giai đoạn):</strong> Thanh toán 40% giá trị hợp đồng sau khi hoàn thành chạy thử nghiệm.</li>
        <li><strong>Đợt 3 (Thanh lý):</strong> Thanh toán 20% còn lại trong vòng 10 ngày sau khi ký Biên bản nghiệm thu tổng thể.</li>
      </ul>

      <h3 style="font-size: 12pt; color: #8B3A1A;">ĐIỀU 3: BẢO MẬT THÔNG TIN VÀ SỞ HỮU TRÍ TUỆ</h3>
      <p>3.1. Hai Bên cam kết bảo mật tuyệt đối toàn bộ dữ liệu kinh doanh, mã nguồn và thông tin trao đổi trong suốt thời gian thực hiện Hợp đồng và 03 năm sau khi Hợp đồng chấm dứt.</p>
      <p>3.2. Quyền sở hữu trí tuệ đối với các sản phẩm bàn giao thuộc về Bên A sau khi Bên A đã hoàn tất 100% nghĩa vụ thanh toán.</p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 36px; border: none;">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            <strong>ĐẠI DIỆN BÊN A</strong><br/>
            <em>(Ký, đóng dấu và ghi rõ họ tên)</em><br/><br/><br/><br/><br/>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            <strong>ĐẠI DIỆN BÊN B</strong><br/>
            <em>(Ký, đóng dấu và ghi rõ họ tên)</em><br/><br/><br/><br/><br/>
          </td>
        </tr>
      </table>
    </div>
  `
  return { title, html }
}

// ── 7. Mẫu Biên Bản Cuộc Họp Ban Điều Hành / Dự Án ──────────────────────
export function buildMeetingMinutesHtml(): { title: string; html: string } {
  const title = 'Biên bản cuộc họp điều hành doanh nghiệp'
  const html = `
    <div style="font-family: 'Be Vietnam Pro', Arial, sans-serif; line-height: 1.6; color: #1C1B18;">
      <h1 style="text-align: center; font-size: 18pt; text-transform: uppercase; margin-bottom: 4px; color: #8B3A1A;">
        BIÊN BẢN CUỘC HỌP ĐIỀU HÀNH & KẾ HOẠCH DỰ ÁN
      </h1>
      <p style="text-align: center; font-size: 11pt; margin-top: 0; margin-bottom: 20px;">
        <strong>Chủ đề cuộc họp: Đánh giá Tiến độ Q3 và Kế hoạch Tăng trưởng Q4/2026</strong><br/>
        <em>Thời gian: 09:00 - 11:30, Ngày ...../...../2026 | Địa điểm: Phòng họp tầng 5 & Online</em>
      </p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1px solid #DDD9CE; padding-bottom: 4px;">
        I. THÀNH PHẦN THAM DỰ
      </h2>
      <p><strong>1. Chủ tọa:</strong> Ông/Bà ........................................ - Tổng Giám đốc</p>
      <p><strong>2. Thư ký:</strong> Ông/Bà ........................................ - Thư ký Ban Điều hành</p>
      <p><strong>3. Thành phần tham dự:</strong> Trưởng bộ phận Kỹ thuật, Kinh doanh, Marketing, Tài chính và Quản lý Dự án.</p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1px solid #DDD9CE; padding-bottom: 4px; margin-top: 20px;">
        II. NỘI DUNG CUỘC HỌP
      </h2>
      <p><strong>1. Báo cáo kết quả hoạt động tháng trước:</strong> Toàn đội đạt 108% KPI kinh doanh; triển khai đúng hạn phiên bản mới của hệ thống.</p>
      <p><strong>2. Khó khăn, vướng mắc:</strong> Thời gian phản hồi tích hợp API bên thứ ba còn chậm; cần bổ sung thêm nhân sự tester.</p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1px solid #DDD9CE; padding-bottom: 4px; margin-top: 20px;">
        III. KẾT LUẬN VÀ PHÂN CÔNG NHIỆM VỤ (ACTION ITEMS)
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background: #F4F2EB;">
            <th style="border: 1px solid #DDD9CE; padding: 8px; width: 8%;">STT</th>
            <th style="border: 1px solid #DDD9CE; padding: 8px; width: 42%;">Nhiệm vụ / Công việc</th>
            <th style="border: 1px solid #DDD9CE; padding: 8px; width: 25%;">Người phụ trách</th>
            <th style="border: 1px solid #DDD9CE; padding: 8px; width: 25%;">Hạn hoàn thành</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 8px; text-align: center;">1</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px;">Tối ưu hóa tốc độ phản hồi API hệ thống dưới 200ms</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px;">Trưởng nhóm Backend</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px; text-align: center;">25/10/2026</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 8px; text-align: center;">2</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px;">Hoàn thiện báo giá và gửi hợp đồng dịch vụ cho đối tác</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px;">Trưởng phòng Kinh doanh</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px; text-align: center;">20/10/2026</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 8px; text-align: center;">3</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px;">Tổ chức phỏng vấn tuyển dụng 02 kỹ sư kiểm thử QA</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px;">Phòng Nhân sự</td>
            <td style="border: 1px solid #DDD9CE; padding: 8px; text-align: center;">30/10/2026</td>
          </tr>
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-top: 36px; border: none;">
        <tr>
          <td style="width: 50%; text-align: center; border: none;">
            <strong>THƯ KÝ CUỘC HỌP</strong><br/>
            <em>(Ký và ghi rõ họ tên)</em><br/><br/><br/><br/>
          </td>
          <td style="width: 50%; text-align: center; border: none;">
            <strong>CHỦ TỌA CUỘC HỌP</strong><br/>
            <em>(Ký và ghi rõ họ tên)</em><br/><br/><br/><br/>
          </td>
        </tr>
      </table>
    </div>
  `
  return { title, html }
}

// ── 8. Mẫu Bảng Dự Toán Kế Hoạch Tài Chính & Dòng Tiền (Sheets) ───────────
export function buildFinancialPlanCsv(): string {
  const lines = [
    'BẢNG DỰ TOÁN KẾ HOẠCH DOANH THU - CHI PHÍ - DÒNG TIỀN DOANH NGHIỆP NĂM 2026',
    'Đơn vị tính: Triệu VNĐ',
    '',
    'STT,Hạng mục tài chính,Q1/2026,Q2/2026,Q3/2026,Q4/2026,Tổng cả năm,Tỷ trọng (%)',
    'A,TỔNG DOANH THU BÁN HÀNG VÀ DỊCH VỤ,1250,1850,2400,3100,=SUM(C5:F5),100%',
    '1,Doanh thu phần mềm SaaS Lycero,800,1200,1650,2100,=SUM(C6:F6),68.7%',
    '2,Doanh thu dịch vụ tư vấn đào tạo & AI,350,500,600,800,=SUM(C7:F7),25.7%',
    '3,Doanh thu bản quyền & tích hợp hệ thống,100,150,150,200,=SUM(C8:F8),5.6%',
    '',
    'B,TỔNG CHI PHÍ HOẠT ĐỘNG (OPEX),820,1050,1280,1550,=SUM(C10:F10),64.8%',
    '1,Chi phí lương nhân sự & chuyên gia,500,600,700,850,=SUM(C11:F11),39.6%',
    '2,Hạ tầng máy chủ Cloud & GPU Server,120,180,250,320,=SUM(C12:F12),12.3%',
    '3,Chi phí Marketing và Phát triển thị trường,150,200,250,300,=SUM(C13:F13),13.2%',
    '4,Chi phí quản lý & vận hành văn phòng,50,70,80,80,=SUM(C14:F14),4.1%',
    '',
    'C,LỢI NHUẬN TRƯỚC THUẾ (EBITDA),=C5-C10,=D5-D10,=E5-E10,=F5-F10,=SUM(C16:F16),35.2%',
    'D,Thuế thu nhập doanh nghiệp (20%),=C16*0.2,=D16*0.2,=E16*0.2,=F16*0.2,=G16*0.2,7.0%',
    'E,LỢI NHUẬN SAU THUẾ,=C16-C17,=D16-D17,=E16-E17,=F16-F17,=G16-G17,28.2%',
  ]
  return lines.join('\n')
}

// ── 9. Mẫu Đề Cương Nghiên Cứu Khoa Học (Academic Research Proposal) ──────
export function buildResearchProposalHtml(): { title: string; html: string } {
  const title = 'Đề cương nghiên cứu khoa học (Research Proposal)'
  const html = `
    <div style="font-family: 'Be Vietnam Pro', 'Times New Roman', serif; line-height: 1.6; color: #1C1B18;">
      <h1 style="text-align: center; font-size: 18pt; text-transform: uppercase; margin-bottom: 4px; color: #8B3A1A;">
        THUYẾT MINH ĐỀ TÀI NGHIÊN CỨU KHOA HỌC
      </h1>
      <p style="text-align: center; font-size: 13pt; margin-top: 0; margin-bottom: 24px;">
        <strong>TÊN ĐỀ TÀI: [ỨNG DỤNG MÔ HÌNH NGÔN NGỮ LỚN VÀ ĐỒ THỊ TRI THỨC VÀO CÁ NHÂN HÓA HỌC TẬP]</strong><br/>
        <em>Mã số đề tài: NCKH-2026-...... | Chuyên ngành: Khoa học Dữ liệu & Trí tuệ Nhân tạo</em>
      </p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px;">
        1. TÍNH CẤP THIẾT CỦA ĐỀ TÀI (RATIONALE)
      </h2>
      <p>Trình bày bối cảnh thực tiễn, những thách thức hiện tại chưa được giải quyết thỏa đáng, và lý do tại sao nghiên cứu này cần được thực hiện tại thời điểm hiện nay...</p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 20px;">
        2. TỔNG QUAN TÌNH HÌNH NGHIÊN CỨU THẾ GIỚI VÀ TRONG NƯỚC (LITERATURE REVIEW)
      </h2>
      <p>Tổng hợp các công trình tiêu biểu theo chuẩn trích dẫn APA 7th (Smith et al., 2024; Tran & Nguyen, 2025). Phân tích ma trận so sánh các phương pháp hiện hành và chỉ rõ khoảng trống nghiên cứu (Research Gap) mà đề tài hướng tới lấp đầy.</p>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 20px;">
        3. MỤC TIÊU VÀ CÂU HỎI NGHIÊN CỨU (RESEARCH OBJECTIVES & QUESTIONS)
      </h2>
      <p><strong>Mục tiêu tổng quát:</strong> Xây dựng khung kiến trúc tích hợp giữa LLM và Đồ thị tri thức giúp tối ưu hóa 35% hiệu quả ghi nhớ của người học.</p>
      <p><strong>Câu hỏi nghiên cứu:</strong></p>
      <ul>
        <li><em>RQ1:</em> Kiến trúc suy luận đa bước nào đảm bảo độ chính xác cao nhất mà vẫn tiết kiệm chi phí tính toán?</li>
        <li><em>RQ2:</em> Mức độ chấp nhận của người dạy và người học đối với trợ lý AI trong môi trường học thuật ra sao?</li>
      </ul>

      <h2 style="font-size: 13pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 20px;">
        4. PHƯƠNG PHÁP NGHIÊN CỨU (METHODOLOGY)
      </h2>
      <p>Mô tả chi tiết phương pháp hỗn hợp (Mixed Methods): Thu thập dữ liệu định lượng qua khảo sát (N=500), phỏng vấn sâu định tính (N=20), và kiểm định giả thuyết mô hình SEM / ANOVA.</p>
    </div>
  `
  return { title, html }
}

// ── BỘ ĐIỀU PHỐI TẠO MẪU ĐA HÌNH ──────────────────────────────────────────
export async function createPedagogicalTemplate(
  templateId: string,
  saveDir: string,
  openDocFn: (payload: { title: string; html: string }) => void,
): Promise<{ filePath?: string }> {
  // Giáo dục
  if (templateId === 'khbd-5512') {
    const data = buildKhbd5512Html()
    openDocFn(data)
    return {}
  }
  if (templateId === 'de-thi-bloom') {
    const data = buildBloomMatrixHtml()
    openDocFn(data)
    return {}
  }
  if (templateId === 'syllabus-dai-hoc') {
    const data = buildUniversitySyllabusHtml()
    openDocFn(data)
    return {}
  }
  if (templateId === 'so-diem-tt22') {
    const csv = buildGradebookTt22Csv()
    const buffer = await sheetCsvToXlsxBuffer(csv, 'Sổ Điểm TT22')
    const fileName = `So-Diem-Danh-Gia-Hoc-Sinh-TT22-${Date.now().toString().slice(-4)}.xlsx`
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, buffer)
    return { filePath }
  }
  if (templateId === 'slide-su-pham') {
    const buffer = await createBlankPptx()
    const fileName = `Bai-Giang-Su-Pham-16-9-${Date.now().toString().slice(-4)}.pptx`
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, buffer)
    return { filePath }
  }

  // Doanh nghiệp
  if (templateId === 'hop-dong-kinh-te') {
    const data = buildBusinessContractHtml()
    openDocFn(data)
    return {}
  }
  if (templateId === 'bien-ban-hop') {
    const data = buildMeetingMinutesHtml()
    openDocFn(data)
    return {}
  }
  if (templateId === 'ke-hoach-tai-chinh') {
    const csv = buildFinancialPlanCsv()
    const buffer = await sheetCsvToXlsxBuffer(csv, 'Kế Hoạch Tài Chính')
    const fileName = `Ke-Hoach-Tai-Chinh-Dong-Tien-2026-${Date.now().toString().slice(-4)}.xlsx`
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, buffer)
    return { filePath }
  }
  if (templateId === 'pitch-deck-pptx') {
    const buffer = await createBlankPptx()
    const fileName = `Pitch-Deck-Goi-Von-16-9-${Date.now().toString().slice(-4)}.pptx`
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, buffer)
    return { filePath }
  }

  // Nghiên cứu & Sáng tạo
  if (templateId === 'de-cuong-nckh') {
    const data = buildResearchProposalHtml()
    openDocFn(data)
    return {}
  }

  throw new Error(`Unknown template ID: ${templateId}`)
}
