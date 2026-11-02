/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { sheetCsvToXlsxBuffer } from '@lycero/xlsx-gateway/gateway/csv-import'
import { createBlankPptx } from '@lycero/pptx-engine'
import { buildDeckPptx, parseDeckSpec, type DeckSpec } from '@lycero/pipelines/slides'
import { HeuristicMetrics } from '@lycero/pptx-render'

export interface TemplateResult {
  kind: 'docs-ai-content' | 'file-on-disk'
  title: string
  html?: string
  filePath?: string
}

export interface CloudTemplateEntry {
  id: string
  slug?: string
  title: string
  description?: string
  category?: string
  format?: 'docx' | 'xlsx' | 'pptx'
  version?: string
  updatedAt?: string
  content?: string | Record<string, unknown>
  html?: string
  csv?: string
  slideSpec?: string | Record<string, unknown>
}

let memoryTemplatesCache: CloudTemplateEntry[] | null = null

export function resetCloudTemplatesCache(): void {
  memoryTemplatesCache = null
}

function resolveTemplatesCachePath(): string {
  if (process.env.LYCERO_TEMPLATES_CACHE_DIR) {
    return join(process.env.LYCERO_TEMPLATES_CACHE_DIR, 'cloud-templates-cache.json')
  }
  try {
    if (app && typeof app.getPath === 'function') {
      return join(app.getPath('userData'), 'cloud-templates-cache.json')
    }
  } catch {
    // Fallback when running outside Electron main ready lifecycle (e.g. unit tests)
  }
  return join(tmpdir(), 'lycero-office-cloud-templates-cache.json')
}

function readCachedCloudTemplates(): CloudTemplateEntry[] {
  if (memoryTemplatesCache) return memoryTemplatesCache
  const cachePath = resolveTemplatesCachePath()
  try {
    if (existsSync(cachePath)) {
      const raw = JSON.parse(readFileSync(cachePath, 'utf-8')) as {
        templates?: CloudTemplateEntry[]
      }
      if (Array.isArray(raw?.templates)) {
        memoryTemplatesCache = raw.templates
        return raw.templates
      }
    }
  } catch {
    // Ignore corrupted cache file
  }
  return []
}

function writeCachedCloudTemplates(templates: CloudTemplateEntry[]): void {
  memoryTemplatesCache = templates
  const cachePath = resolveTemplatesCachePath()
  try {
    mkdirSync(dirname(cachePath), { recursive: true })
    writeFileSync(
      cachePath,
      JSON.stringify({ updatedAt: new Date().toISOString(), templates }, null, 2),
      'utf-8',
    )
  } catch {
    // Best-effort disk cache
  }
}

/**
 * Synchronize template registry from Lycero Web Server (`GET /api/v1/office/templates`).
 * Caches locally to `userData/cloud-templates-cache.json` and falls back smoothly when offline.
 */
export async function fetchCloudTemplates(gatewayUrl?: string): Promise<CloudTemplateEntry[]> {
  const baseUrl = (
    gatewayUrl ||
    process.env.LYCERO_GATEWAY_URL ||
    process.env.LYCERO_BASE_URL ||
    'https://lycero.com'
  ).replace(/\/$/, '')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)
  try {
    const res = await fetch(`${baseUrl}/api/v1/office/templates`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return readCachedCloudTemplates()
    const data = (await res.json()) as
      | { templates?: CloudTemplateEntry[]; data?: CloudTemplateEntry[] }
      | CloudTemplateEntry[]
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.templates)
        ? data.templates
        : Array.isArray(data?.data)
          ? data.data
          : []
    if (list.length > 0) {
      writeCachedCloudTemplates(list)
      return list
    }
    return readCachedCloudTemplates()
  } catch {
    return readCachedCloudTemplates()
  } finally {
    clearTimeout(timer)
  }
}

export function buildKhbd5512Html(): { title: string; html: string } {
  const title = 'Kế hoạch bài dạy (KHBD) - Chuẩn Phụ lục IV CV 5512'
  const html = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; border: none;">
        <tr>
          <td style="width: 50%; text-align: left; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>Trường:</strong> [cần bổ sung: tên trường]</p>
            <p style="margin: 4px 0 0 0;"><strong>Tổ:</strong> [cần bổ sung: tổ chuyên môn]</p>
          </td>
          <td style="width: 50%; text-align: right; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>Họ và tên giáo viên:</strong></p>
            <p style="margin: 4px 0 0 0;">[cần bổ sung: họ và tên giáo viên]</p>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 14pt; text-transform: uppercase; margin-bottom: 4px;">
        <strong>TÊN BÀI DẠY: [cần bổ sung: tên bài học]</strong>
      </h1>
      <p style="text-align: center; font-size: 13pt; margin-top: 0; margin-bottom: 20px;">
        <strong>Môn học/Hoạt động giáo dục: [cần bổ sung: môn học]; lớp: [cần bổ sung: lớp]</strong><br/>
        <em>Thời gian thực hiện: (02 tiết — Tổng thời lượng các hoạt động ≤ 90 phút)</em>
      </p>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px;">
        I. MỤC TIÊU
      </h2>
      <p><strong>1. Về kiến thức:</strong></p>
      <ul>
        <li>Nêu và giải thích được các khái niệm, nguyên lý trọng tâm theo yêu cầu cần đạt của Chương trình GDPT 2018.</li>
        <li>Phân tích và vận dụng được kiến thức bài học vào giải quyết bài tập và tình huống thực tiễn.</li>
      </ul>
      <p><strong>2. Về năng lực:</strong></p>
      <ul>
        <li><strong>Năng lực chung:</strong>
          <ul>
            <li><em>Năng lực tự chủ và tự học:</em> Chủ động đọc học liệu, hoàn thành nhiệm vụ cá nhân trên Phiếu học tập.</li>
            <li><em>Năng lực giao tiếp và hợp tác:</em> Thảo luận nhóm đôi/nhóm 4, trình bày và nhận xét sản phẩm học tập.</li>
            <li><em>Năng lực giải quyết vấn đề và sáng tạo:</em> Vận dụng kiến thức bài học để giải quyết tình huống thực tiễn.</li>
          </ul>
        </li>
        <li><strong>Năng lực đặc thù:</strong> Phát triển năng lực nhận thức, tìm hiểu và vận dụng kiến thức, kĩ năng đặc thù của môn học.</li>
      </ul>
      <p><strong>3. Về phẩm chất:</strong></p>
      <ul>
        <li><em>Chăm chỉ:</em> Tích cực, tự giác thực hiện nhiệm vụ học tập cá nhân và nhóm.</li>
        <li><em>Trung thực:</em> Khách quan trong tự đánh giá và đánh giá đồng đẳng.</li>
        <li><em>Trách nhiệm:</em> Hoàn thành đúng thời hạn sản phẩm nhóm và nhiệm vụ vận dụng.</li>
      </ul>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU
      </h2>
      <p><strong>1. Đối với giáo viên:</strong> Kế hoạch bài dạy, SGK, SGV, bài giảng điện tử, Phiếu học tập số 1, 2 và bảng tiêu chí đánh giá (Rubric).</p>
      <p><strong>2. Đối với học sinh:</strong> Sách giáo khoa, vở ghi, dụng cụ học tập và nội dung chuẩn bị trước theo hướng dẫn.</p>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        III. TIẾN TRÌNH DẠY HỌC
      </h2>

      <h3 style="font-size: 12.5pt; color: #2D2A26; background: #F4F2EB; padding: 6px 10px; border-left: 4px solid #8B3A1A;">
        1. Hoạt động 1: Xác định vấn đề/nhiệm vụ học tập (Mở đầu) (10 phút)
      </h3>
      <p><strong>a) Mục tiêu:</strong> Tạo hứng thú, huy động kiến thức đã biết và xác định vấn đề cần giải quyết của bài học.</p>
      <p><strong>b) Nội dung:</strong> Học sinh quan sát tình huống mở đầu và trả lời câu hỏi gợi mở của giáo viên.</p>
      <p><strong>c) Sản phẩm:</strong> Câu trả lời cá nhân của học sinh và vấn đề trọng tâm cần khám phá trong bài học.</p>
      <p><strong>d) Tổ chức thực hiện:</strong></p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #DDD9CE;">
        <thead>
          <tr style="background: #EBE7DD;">
            <th style="border: 1px solid #DDD9CE; padding: 8px; width: 50%; text-align: center;">HOẠT ĐỘNG CỦA GIÁO VIÊN VÀ HỌC SINH</th>
            <th style="border: 1px solid #DDD9CE; padding: 8px; width: 50%; text-align: center;">SẢN PHẨM DỰ KIẾN</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              <strong>Bước 1: Chuyển giao nhiệm vụ:</strong> GV nêu tình huống thực tế và đặt câu hỏi mở đầu.<br/>
              <strong>Bước 2: Thực hiện nhiệm vụ:</strong> HS suy nghĩ cá nhân và trao đổi nhanh theo cặp.<br/>
              <strong>Bước 3: Báo cáo, thảo luận:</strong> Đại diện 2 HS trình bày ý kiến, các HS khác nhận xét.<br/>
              <strong>Bước 4: Kết luận, nhận định:</strong> GV nhận xét câu trả lời và dẫn dắt vào bài học mới.
            </td>
            <td style="border: 1px solid #DDD9CE; padding: 8px; vertical-align: top;">
              - Câu trả lời của học sinh đối với tình huống mở đầu.<br/>
              - Xác định được nhiệm vụ học tập chính của bài học.
            </td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-size: 12.5pt; color: #2D2A26; background: #F4F2EB; padding: 6px 10px; border-left: 4px solid #8B3A1A; margin-top: 20px;">
        2. Hoạt động 2: Hình thành kiến thức mới (Giải quyết vấn đề) (40 phút)
      </h3>
      <p><strong>a) Mục tiêu:</strong> Học sinh chiếm lĩnh được kiến thức cốt lõi của bài học thông qua hoạt động nghiên cứu học liệu và thảo luận nhóm.</p>
      <p><strong>b) Nội dung:</strong> Học sinh nghiên cứu SGK và hoàn thành Phiếu học tập số 1 theo nhóm.</p>
      <p><strong>c) Sản phẩm:</strong> Phiếu học tập số 1 hoàn chỉnh và kết luận kiến thức chuẩn xác ghi vào vở.</p>
      <p><strong>d) Tổ chức thực hiện:</strong></p>
      <p>- <strong>Bước 1 (Chuyển giao nhiệm vụ):</strong> GV chia lớp thành các nhóm 4 HS, phát Phiếu học tập số 1 và nêu rõ yêu cầu, thời gian thực hiện.<br/>
      - <strong>Bước 2 (Thực hiện nhiệm vụ):</strong> HS đọc SGK, thảo luận nhóm để hoàn thành Phiếu học tập số 1; GV quan sát, hỗ trợ.<br/>
      - <strong>Bước 3 (Báo cáo, thảo luận):</strong> Đại diện nhóm trình bày kết quả; các nhóm khác đặt câu hỏi phản biện, bổ sung.<br/>
      - <strong>Bước 4 (Kết luận, nhận định):</strong> GV nhận xét, chuẩn hóa kiến thức trọng tâm để HS ghi nhận vào vở.</p>

      <h3 style="font-size: 12.5pt; color: #2D2A26; background: #F4F2EB; padding: 6px 10px; border-left: 4px solid #8B3A1A; margin-top: 20px;">
        3. Hoạt động 3: Luyện tập (25 phút)
      </h3>
      <p><strong>a) Mục tiêu:</strong> Củng cố, khắc sâu kiến thức vừa hình thành thông qua hệ thống câu hỏi và bài tập thực hành.</p>
      <p><strong>b) Nội dung:</strong> Học sinh giải hệ thống bài tập trong SGK và Phiếu học tập số 2.</p>
      <p><strong>c) Sản phẩm:</strong> Lời giải chi tiết và đáp án các bài tập luyện tập của học sinh.</p>
      <p><strong>d) Tổ chức thực hiện:</strong></p>
      <p>- <strong>Bước 1 (Chuyển giao nhiệm vụ):</strong> GV giao bài tập luyện tập trên Phiếu học tập số 2 cho cá nhân/cặp đôi.<br/>
      - <strong>Bước 2 (Thực hiện nhiệm vụ):</strong> HS độc lập giải bài tập và trao đổi kết quả với bạn cùng bàn.<br/>
      - <strong>Bước 3 (Báo cáo, thảo luận):</strong> HS lên bảng trình bày lời giải; cả lớp đối chiếu và nhận xét.<br/>
      - <strong>Bước 4 (Kết luận, nhận định):</strong> GV sửa lỗi sai thường gặp, chốt phương pháp giải và cho điểm đánh giá thường xuyên.</p>

      <h3 style="font-size: 12.5pt; color: #2D2A26; background: #F4F2EB; padding: 6px 10px; border-left: 4px solid #8B3A1A; margin-top: 20px;">
        4. Hoạt động 4: Vận dụng (15 phút)
      </h3>
      <p><strong>a) Mục tiêu:</strong> Vận dụng kiến thức, kĩ năng đã học để giải quyết tình huống thực tiễn gắn với đời sống.</p>
      <p><strong>b) Nội dung:</strong> Học sinh thực hiện nhiệm vụ vận dụng kết nối kiến thức bài học với thực tế.</p>
      <p><strong>c) Sản phẩm:</strong> Bài giải tình huống thực tiễn hoặc sản phẩm học tập hoàn chỉnh của học sinh.</p>
      <p><strong>d) Tổ chức thực hiện:</strong></p>
      <p>- <strong>Bước 1 (Chuyển giao nhiệm vụ):</strong> GV nêu bài toán/tình huống thực tiễn và tiêu chí đánh giá sản phẩm.<br/>
      - <strong>Bước 2 (Thực hiện nhiệm vụ):</strong> HS lập phương án giải quyết tại lớp và hoàn thiện sản phẩm.<br/>
      - <strong>Bước 3 (Báo cáo, thảo luận):</strong> HS chia sẻ phương án giải quyết trước lớp.<br/>
      - <strong>Bước 4 (Kết luận, nhận định):</strong> GV nhận xét, tổng kết toàn bài học (Tổng thời gian 4 hoạt động: 10 + 40 + 25 + 15 = 90 phút cho 02 tiết).</p>
  `
  return { title, html }
}

export function buildBloomMatrixHtml(): { title: string; html: string } {
  const title = 'Ma trận, Bản đặc tả & Đề kiểm tra - Chuẩn Công văn 7991/BGDĐT-GDTrH'
  const html = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: none;">
        <tr>
          <td style="width: 50%; text-align: left; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>TRƯỜNG:</strong> [cần bổ sung: tên trường]</p>
            <p style="margin: 4px 0 0 0;"><strong>TỔ CHUYÊN MÔN:</strong> [cần bổ sung: tổ chuyên môn]</p>
          </td>
          <td style="width: 50%; text-align: right; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>ĐỀ KIỂM TRA ĐỊNH KỲ</strong></p>
            <p style="margin: 4px 0 0 0;"><em>Chuẩn Công văn 7991/BGDĐT-GDTrH & Thông tư 22/2021/TT-BGDĐT</em></p>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 15pt; text-transform: uppercase; margin-bottom: 4px;">
        <strong>BẢNG MA TRẬN, BẢN ĐẶC TẢ & ĐỀ KIỂM TRA ĐỊNH KỲ (3 MỨC ĐỘ — 4 PHẦN)</strong>
      </h1>
      <p style="text-align: center; font-size: 12.5pt; margin-top: 0; margin-bottom: 16px;">
        <strong>MÔN HỌC: [cần bổ sung: môn học] — LỚP: [cần bổ sung: lớp]</strong><br/>
        <em>Thời gian làm bài: 90 phút (Không kể thời gian phát đề)</em>
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 11pt; border: 1px solid #DDD9CE;">
        <thead>
          <tr style="background: #EBE7DD; text-align: center;">
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 6%;">TT</th>
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 28%;">Chủ đề / Nội dung & Dạng thức câu hỏi (CV 7991)</th>
            <th colspan="3" style="border: 1px solid #DDD9CE; padding: 6px;">3 Mức độ nhận thức (Công văn 7991/BGDĐT-GDTrH)</th>
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 12%;">Tổng số câu</th>
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 12%;">Tổng điểm</th>
            <th rowspan="2" style="border: 1px solid #DDD9CE; padding: 6px; width: 12%;">Tỉ lệ %</th>
          </tr>
          <tr style="background: #F4F2EB; text-align: center;">
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Nhận biết (40%)</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Thông hiểu (30%)</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 10%;">Vận dụng (30%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>Phần I:</strong> Trắc nghiệm nhiều lựa chọn (12 câu × 0,25đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">8 câu (2,0đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">4 câu (1,0đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">0 câu (0,0đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">12 câu</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">3,0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">30%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>Phần II:</strong> Trắc nghiệm Đúng – Sai (2 câu × 4 ý a,b,c,d = 2,0đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1,0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">0,5 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">0,5 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2 câu (8 ý)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2,0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">20%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">3</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>Phần III:</strong> Trắc nghiệm Trả lời ngắn (4 câu × 0,5đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">0,0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2 câu (1,0đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2 câu (1,0đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">4 câu</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">2,0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">20%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">4</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;"><strong>Phần IV:</strong> Tự luận (3 câu × 1,0đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1 câu (1,0đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">0,5 câu (0,5đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1,5 câu (1,5đ)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">3 câu</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">3,0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">30%</td>
          </tr>
          <tr style="background: #FAF9F6; font-weight: bold; text-align: center;">
            <td colspan="2" style="border: 1px solid #DDD9CE; padding: 6px;">TỔNG CỘNG TOÀN ĐỀ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">4,0 đ (40%)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">3,0 đ (30%)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">3,0 đ (30%)</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">21 câu</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">10,0 đ</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">100%</td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        BẢN ĐẶC TẢ MA TRẬN ĐỀ KIỂM TRA (3 MỨC ĐỘ: NHẬN BIẾT – THÔNG HIỂU – VẬN DỤNG)
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5pt; border: 1px solid #DDD9CE; margin-top: 8px;">
        <thead>
          <tr style="background: #EBE7DD; text-align: center;">
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 6%;">TT</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 24%;">Chủ đề / Nội dung</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 45%;">Yêu cầu cần đạt theo 3 mức độ nhận thức</th>
            <th style="border: 1px solid #DDD9CE; padding: 6px; width: 25%;">Số câu & Phần</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #DDD9CE; padding: 6px; text-align: center;">1</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">Chủ đề trọng tâm</td>
            <td style="border: 1px solid #DDD9CE; padding: 6px;">
              - <em>Nhận biết:</em> Nhận diện được khái niệm, công thức, tính chất cơ bản.<br/>
              - <em>Thông hiểu:</em> Giải thích và biến đổi được các biểu thức/tình huống chuẩn.<br/>
              - <em>Vận dụng:</em> Giải quyết được bài toán tổng hợp và tình huống thực tiễn.
            </td>
            <td style="border: 1px solid #DDD9CE; padding: 6px; font-size: 9.5pt;">
              - Phần I: 12 câu (3,0đ)<br/>
              - Phần II: 2 câu Đ/S (2,0đ)<br/>
              - Phần III: 4 câu TLN (2,0đ)<br/>
              - Phần IV: 3 câu TL (3,0đ)
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-size: 14pt; color: #8B3A1A; border-bottom: 1.5px solid #8B3A1A; padding-bottom: 4px; margin-top: 24px;">
        ĐỀ KIỂM TRA ĐỊNH KỲ (4 PHẦN CHUẨN CÔNG VĂN 7991/BGDĐT-GDTrH)
      </h2>
      <p><strong>PHẦN I. TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (3,0 điểm):</strong> <em>Gồm 12 câu (từ Câu 1 đến Câu 12), mỗi câu trả lời đúng được 0,25 điểm; đáp án phân bổ đều A, B, C, D.</em></p>
      <p><strong>PHẦN II. TRẮC NGHIỆM ĐÚNG – SAI (2,0 điểm):</strong> <em>Gồm 02 câu (Câu 13, Câu 14), mỗi câu có 4 ý a), b), c), d).</em></p>
      <p><strong>PHẦN III. TRẮC NGHIỆM TRẢ LỜI NGẮN (2,0 điểm):</strong> <em>Gồm 04 câu (từ Câu 15 đến Câu 18), mỗi câu trả lời đúng được 0,5 điểm.</em></p>
      <p><strong>PHẦN IV. TỰ LUẬN (3,0 điểm):</strong> <em>Gồm 03 câu (Câu 19, Câu 20, Câu 21), thí sinh trình bày lời giải chi tiết.</em></p>
  `
  return { title, html }
}

export function buildUniversitySyllabusHtml(): { title: string; html: string } {
  const title = 'Đề cương chi tiết học phần - Chuẩn AUN-QA'
  const html = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; border: none;">
        <tr>
          <td style="width: 50%; text-align: left; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>TRƯỜNG ĐẠI HỌC:</strong> [cần bổ sung: tên trường]</p>
            <p style="margin: 4px 0 0 0;"><strong>KHOA/VIỆN:</strong> [cần bổ sung: tên khoa/viện]</p>
          </td>
          <td style="width: 50%; text-align: right; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN</strong></p>
            <p style="margin: 4px 0 0 0;"><em>Chuẩn kiểm định chất lượng AUN-QA / OBE</em></p>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 16pt; text-transform: uppercase; margin-bottom: 4px;">
        <strong>ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN (COURSE SYLLABUS)</strong>
      </h1>
      <p style="text-align: center; font-size: 12.5pt; margin-top: 0; margin-bottom: 20px;">
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
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; border: none;">
        <tr>
          <td style="width: 44%; text-align: center; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong><u>CÔNG TY CỔ PHẦN ....................</u></strong></p>
            <p style="margin: 6px 0 0 0;">Số: ......./2026/HĐDV-............</p>
          </td>
          <td style="width: 56%; text-align: center; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p>
            <p style="margin: 0;"><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p>
            <p style="margin: 6px 0 0 0;"><em>Hà Nội, ngày ..... tháng ..... năm 2026</em></p>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 16pt; text-transform: uppercase; margin-bottom: 6px;">
        <strong>HỢP ĐỒNG CUNG CẤP DỊCH VỤ VÀ PHÁT TRIỂN DỰ ÁN</strong>
      </h1>
      <p style="text-align: center; font-size: 12pt; margin-top: 0; margin-bottom: 20px;">
        <em>(Căn cứ Bộ luật Dân sự và Luật Thương mại)</em>
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
  `
  return { title, html }
}

// ── 7. Mẫu Biên Bản Cuộc Họp Ban Điều Hành / Dự Án ──────────────────────
export function buildMeetingMinutesHtml(): { title: string; html: string } {
  const title = 'Biên bản cuộc họp điều hành doanh nghiệp'
  const html = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; border: none;">
        <tr>
          <td style="width: 44%; text-align: center; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong><u>CÔNG TY / ĐƠN VỊ: ........................</u></strong></p>
            <p style="margin: 6px 0 0 0;">Số: ....../BB-............</p>
          </td>
          <td style="width: 56%; text-align: center; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p>
            <p style="margin: 0;"><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p>
            <p style="margin: 6px 0 0 0;"><em>Hà Nội, ngày ..... tháng ..... năm 2026</em></p>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 16pt; text-transform: uppercase; margin-bottom: 4px;">
        <strong>BIÊN BẢN CUỘC HỌP ĐIỀU HÀNH & KẾ HOẠCH DỰ ÁN</strong>
      </h1>
      <p style="text-align: center; font-size: 12pt; margin-top: 0; margin-bottom: 20px;">
        <strong>Về việc: Đánh giá Tiến độ Q3 và Kế hoạch Tăng trưởng Q4/2026</strong><br/>
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
        III. KẾT LUẬN, VẤN ĐỀ CÒN MỞ VÀ PHÂN CÔNG THỰC HIỆN
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
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; border: none;">
        <tr>
          <td style="width: 44%; text-align: center; vertical-align: top; border: none;">
            <p style="margin: 0;">BỘ GIÁO DỤC VÀ ĐÀO TẠO</p>
            <p style="margin: 0;"><strong><u>ĐƠN VỊ CHỦ TRÌ: ........................</u></strong></p>
          </td>
          <td style="width: 56%; text-align: center; vertical-align: top; border: none;">
            <p style="margin: 0;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p>
            <p style="margin: 0;"><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p>
            <p style="margin: 6px 0 0 0;"><em>Hà Nội, ngày ..... tháng ..... năm 2026</em></p>
          </td>
        </tr>
      </table>

      <h1 style="text-align: center; font-size: 16pt; text-transform: uppercase; margin-bottom: 4px;">
        <strong>THUYẾT MINH ĐỀ TÀI NGHIÊN CỨU KHOA HỌC</strong>
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
  `
  return { title, html }
}

// ── 10. Mẫu Công Văn / Tờ Trình Chuẩn Nghị Định 30/2020/NĐ-CP ──────────────
export function buildOfficialDispatchNd30Html(): { title: string; html: string } {
  const title = 'Công văn / Tờ trình chuẩn Nghị định 30/2020/NĐ-CP'
  const html = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: none;">
        <tr>
          <td style="width: 44%; text-align: center; vertical-align: top; border: none;">
            <p style="margin: 0; font-size: 12pt;">CÔNG TY CỔ PHẦN LYCERO VIỆT NAM</p>
            <p style="margin: 0; font-size: 12.5pt;"><strong><u>PHÒNG HÀNH CHÍNH - QUẢN TRỊ</u></strong></p>
            <p style="margin: 6px 0 0 0; font-size: 13pt;">Số: 15/2026/TTr-HCQT</p>
          </td>
          <td style="width: 56%; text-align: center; vertical-align: top; border: none;">
            <p style="margin: 0; font-size: 12.5pt;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p>
            <p style="margin: 0; font-size: 13.5pt;"><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p>
            <p style="margin: 6px 0 0 0; font-size: 13pt;"><em>Hà Nội, ngày 30 tháng 10 năm 2026</em></p>
          </td>
        </tr>
      </table>

      <p style="text-align: center; font-size: 15pt; margin-top: 12px; margin-bottom: 4px;">
        <strong>TỜ TRÌNH</strong>
      </p>
      <p style="text-align: center; font-size: 13.5pt; margin-top: 0; margin-bottom: 14px;">
        <strong>Về việc phê duyệt dự toán kinh phí triển khai khóa đào tạo nâng cao năng lực số và ứng dụng AI văn phòng năm 2026</strong>
      </p>

      <p style="text-align: center; margin-bottom: 14px;">
        <strong>Kính gửi:</strong> Ban Tổng Giám đốc Công ty Cổ phần Lycero Việt Nam
      </p>

      <p style="text-align: left; text-indent: 1.27cm; margin-bottom: 6px;">
        <em>Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;</em>
      </p>
      <p style="text-align: left; text-indent: 1.27cm; margin-bottom: 6px;">
        <em>Căn cứ Quy chế chi tiêu nội bộ và Quản lý tài chính hiện hành của Công ty Cổ phần Lycero Việt Nam;</em>
      </p>
      <p style="text-align: left; text-indent: 1.27cm; margin-bottom: 10px;">
        <em>Căn cứ Kế hoạch đào tạo và phát triển nguồn nhân lực Quý IV năm 2026 đã được Ban Tổng Giám đốc phê duyệt.</em>
      </p>

      <p style="text-align: justify; text-indent: 1.27cm; margin-bottom: 8px;">
        <strong>1. Sự cần thiết và mục đích thực hiện:</strong> Nhằm chuẩn hóa kỹ năng soạn thảo văn bản hành chính theo Nghị định 30/2020/NĐ-CP, nâng cao năng suất xử lý bảng tính và thiết kế thuyết trình cho đội ngũ cán bộ nhân viên, Phòng Hành chính - Quản trị kính trình Ban Tổng Giám đốc xem xét, phê duyệt kinh phí tổ chức khóa đào tạo nội bộ chuyên sâu.
      </p>

      <p style="text-align: justify; text-indent: 1.27cm; margin-bottom: 6px;">
        <strong>2. Dự toán kinh phí chi tiết:</strong>
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5pt; border: 1px solid #1C1B18; margin-top: 4px; margin-bottom: 8px;">
        <thead>
          <tr style="background: #F4F2EB; text-align: center;">
            <th style="border: 1px solid #1C1B18; padding: 6px; width: 6%; text-align: center;"><strong>STT</strong></th>
            <th style="border: 1px solid #1C1B18; padding: 6px; width: 44%; text-align: center;"><strong>Nội dung chi</strong></th>
            <th style="border: 1px solid #1C1B18; padding: 6px; width: 10%; text-align: center;"><strong>ĐVT</strong></th>
            <th style="border: 1px solid #1C1B18; padding: 6px; width: 8%; text-align: center;"><strong>SL</strong></th>
            <th style="border: 1px solid #1C1B18; padding: 6px; width: 15%; text-align: center;"><strong>Đơn giá (đ)</strong></th>
            <th style="border: 1px solid #1C1B18; padding: 6px; width: 17%; text-align: center;"><strong>Thành tiền (đ)</strong></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">1</td>
            <td style="border: 1px solid #1C1B18; padding: 6px;">Chi phí thù lao chuyên gia giảng dạy và biên soạn học liệu thực hành</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">Buổi</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">04</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: right;">5.000.000</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: right;">20.000.000</td>
          </tr>
          <tr>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">2</td>
            <td style="border: 1px solid #1C1B18; padding: 6px;">Thuê hội trường, hệ thống âm thanh, màn hình LED và thiết bị kỹ thuật</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">Ngày</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">02</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: right;">7.500.000</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: right;">15.000.000</td>
          </tr>
          <tr>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">3</td>
            <td style="border: 1px solid #1C1B18; padding: 6px;">In ấn bộ cẩm nang nghiệp vụ, văn phòng phẩm và hậu cần lớp học</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">Bộ</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;">50</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: right;">200.000</td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: right;">10.000.000</td>
          </tr>
          <tr>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;"></td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;"><strong>TỔNG CỘNG</strong></td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;"></td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: center;"></td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: right;"></td>
            <td style="border: 1px solid #1C1B18; padding: 6px; text-align: right;"><strong>45.000.000</strong></td>
          </tr>
        </tbody>
      </table>
      <p style="text-align: left; text-indent: 1.27cm; margin-bottom: 8px;">
        <em>(Số tiền bằng chữ: Bốn mươi lăm triệu đồng chẵn./.)</em>
      </p>

      <p style="text-align: justify; text-indent: 1.27cm; margin-bottom: 12px;">
        <strong>3. Kiến nghị:</strong> Phòng Hành chính - Quản trị kính trình Ban Tổng Giám đốc xem xét, phê duyệt dự toán kinh phí nêu trên để đơn vị phối hợp với Phòng Tài chính - Kế toán triển khai thực hiện đúng tiến độ./.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 12px; border: none;">
        <tr>
          <td style="width: 50%; vertical-align: top; text-align: left; border: none; font-size: 11pt;">
            <p style="margin: 0;"><strong><em>Nơi nhận:</em></strong></p>
            <p style="margin: 0;">- Như trên;</p>
            <p style="margin: 0;">- Phòng TC-KT, HC-NS (để p/h);</p>
            <p style="margin: 0;">- Lưu: VT, HCQT.</p>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none; font-size: 13pt;">
            <p style="margin: 0;"><strong>TRƯỞNG PHÒNG HÀNH CHÍNH - QUẢN TRỊ</strong></p>
            <p style="margin: 0;">&nbsp;</p>
            <p style="margin: 0;">&nbsp;</p>
            <p style="margin: 0;">&nbsp;</p>
            <p style="margin: 0;"><strong>Nguyễn Văn Minh</strong></p>
          </td>
        </tr>
      </table>
  `
  return { title, html }
}

// ── 11. Mẫu Bảng Lương 3P & Bảo Hiểm Xã Hội (HR & Payroll 3P — Luật Thuế TNCN 2026) ──
export function buildPayroll3pCsv(): string {
  const lines: string[] = [
    'Mã NV,Họ và tên,Phòng ban,Chức danh,Lương P1 (Vị trí),Lương P2 (Năng lực),Thưởng P3 (KPI),Phụ cấp chịu thuế,Tổng thu nhập (Gross),Lương đóng BHXH,BHXH NLĐ (8%),BHYT NLĐ (1.5%),BHTN NLĐ (1%),Số NPT,Thu nhập tính thuế (TNTT),Thuế TNCN (Biểu 5 bậc 2026),Thực lĩnh (Net),BHXH+BHYT+BHTN+KPCĐ DN (23.5%),Tổng chi phí NSDLĐ',
    'NV001,Nguyễn Minh Quân,Ban Giám đốc,Giám đốc Khối Sản phẩm,35000000,15000000,17250000,2500000,"=E2+F2+G2+H2",35000000,"=J2*0.08","=J2*0.015","=J2*0.01",2,"=MAX(0,I2-K2-L2-M2-15500000-N2*6200000)","=ROUND(MAX(0,O2)*0.05+MAX(0,O2-10000000)*0.05+MAX(0,O2-30000000)*0.1+MAX(0,O2-60000000)*0.1+MAX(0,O2-100000000)*0.05,0)","=I2-K2-L2-M2-P2","=J2*0.235","=I2+R2"',
    'NV002,Trần Thu Hà,Kỹ thuật AI,Kỹ sư Trưởng (Principal AI),28000000,12000000,13200000,2000000,"=E3+F3+G3+H3",28000000,"=J3*0.08","=J3*0.015","=J3*0.01",1,"=MAX(0,I3-K3-L3-M3-15500000-N3*6200000)","=ROUND(MAX(0,O3)*0.05+MAX(0,O3-10000000)*0.05+MAX(0,O3-30000000)*0.1+MAX(0,O3-60000000)*0.1+MAX(0,O3-100000000)*0.05,0)","=I3-K3-L3-M3-P3","=J3*0.235","=I3+R3"',
    'NV003,Lê Hoàng Nam,Phát triển SP,Senior Fullstack Engineer,22000000,8000000,9450000,1500000,"=E4+F4+G4+H4",22000000,"=J4*0.08","=J4*0.015","=J4*0.01",1,"=MAX(0,I4-K4-L4-M4-15500000-N4*6200000)","=ROUND(MAX(0,O4)*0.05+MAX(0,O4-10000000)*0.05+MAX(0,O4-30000000)*0.1+MAX(0,O4-60000000)*0.1+MAX(0,O4-100000000)*0.05,0)","=I4-K4-L4-M4-P4","=J4*0.235","=I4+R4"',
    'NV004,Phạm Bảo Ngọc,Thiết kế UI/UX,Lead Product Designer,20000000,7000000,8640000,1500000,"=E5+F5+G5+H5",20000000,"=J5*0.08","=J5*0.015","=J5*0.01",0,"=MAX(0,I5-K5-L5-M5-15500000-N5*6200000)","=ROUND(MAX(0,O5)*0.05+MAX(0,O5-10000000)*0.05+MAX(0,O5-30000000)*0.1+MAX(0,O5-60000000)*0.1+MAX(0,O5-100000000)*0.05,0)","=I5-K5-L5-M5-P5","=J5*0.235","=I5+R5"',
    'NV005,Hoàng Gia Bảo,Kinh doanh B2B,Trưởng nhóm Kinh doanh,16000000,5000000,14400000,2000000,"=E6+F6+G6+H6",16000000,"=J6*0.08","=J6*0.015","=J6*0.01",2,"=MAX(0,I6-K6-L6-M6-15500000-N6*6200000)","=ROUND(MAX(0,O6)*0.05+MAX(0,O6-10000000)*0.05+MAX(0,O6-30000000)*0.1+MAX(0,O6-60000000)*0.1+MAX(0,O6-100000000)*0.05,0)","=I6-K6-L6-M6-P6","=J6*0.235","=I6+R6"',
    'NV006,Đỗ Thùy Trang,Tài chính - Kế toán,Kế toán Tổng hợp,15000000,5000000,5000000,1200000,"=E7+F7+G7+H7",15000000,"=J7*0.08","=J7*0.015","=J7*0.01",1,"=MAX(0,I7-K7-L7-M7-15500000-N7*6200000)","=ROUND(MAX(0,O7)*0.05+MAX(0,O7-10000000)*0.05+MAX(0,O7-30000000)*0.1+MAX(0,O7-60000000)*0.1+MAX(0,O7-100000000)*0.05,0)","=I7-K7-L7-M7-P7","=J7*0.235","=I7+R7"',
    'NV007,Vũ Đức Anh,Hành chính - Nhân sự,Chuyên viên C&B / Pháp chế,13000000,4000000,4080000,1200000,"=E8+F8+G8+H8",13000000,"=J8*0.08","=J8*0.015","=J8*0.01",0,"=MAX(0,I8-K8-L8-M8-15500000-N8*6200000)","=ROUND(MAX(0,O8)*0.05+MAX(0,O8-10000000)*0.05+MAX(0,O8-30000000)*0.1+MAX(0,O8-60000000)*0.1+MAX(0,O8-100000000)*0.05,0)","=I8-K8-L8-M8-P8","=J8*0.235","=I8+R8"',
    'NV008,Bùi Khánh Linh,Chăm sóc KH,Chuyên viên Tư vấn Giáo dục,11000000,3000000,3675000,1200000,"=E9+F9+G9+H9",11000000,"=J9*0.08","=J9*0.015","=J9*0.01",0,"=MAX(0,I9-K9-L9-M9-15500000-N9*6200000)","=ROUND(MAX(0,O9)*0.05+MAX(0,O9-10000000)*0.05+MAX(0,O9-30000000)*0.1+MAX(0,O9-60000000)*0.1+MAX(0,O9-100000000)*0.05,0)","=I9-K9-L9-M9-P9","=J9*0.235","=I9+R9"',
    'TỔNG CỘNG,,,,"=SUM(E2:E9)","=SUM(F2:F9)","=SUM(G2:G9)","=SUM(H2:H9)","=SUM(I2:I9)","=SUM(J2:J9)","=SUM(K2:K9)","=SUM(L2:L9)","=SUM(M2:M9)","=SUM(N2:N9)","=SUM(O2:O9)","=SUM(P2:P9)","=SUM(Q2:Q9)","=SUM(R2:R9)","=SUM(S2:S9)"',
    'GHI CHÚ QUY ĐỊNH 2026,Giảm trừ bản thân: 15.500.000 đ/tháng,Giảm trừ người phụ thuộc: 6.200.000 đ/tháng/người,Biểu thuế lũy tiến 5 bậc: Bậc 1 (đến 10tr: 5%) | Bậc 2 (trên 10-30tr: 10%) | Bậc 3 (trên 30-60tr: 20%) | Bậc 4 (trên 60-100tr: 30%) | Bậc 5 (trên 100tr: 35%),,,,,,,,,,,,,,,',
  ]
  return lines.join('\n')
}

// ── 11b. Mẫu Định Giá Doanh Nghiệp DCF & WACC (Sheets .xlsx có công thức) ──
export function buildDcfValuationCsv(): string {
  const lines: string[] = [
    'Chỉ tiêu (Tỷ VNĐ),Năm cơ sở (2025A),Năm 1 (2026F),Năm 2 (2027F),Năm 3 (2028F),Năm 4 (2029F),Năm 5 (2030F),Ghi chú / Công thức chuẩn',
    '1. Doanh thu thuần,500.0,600.0,714.0,835.4,960.7,1085.6,Tăng trưởng 20% -> 13%/năm',
    '2. EBITDA (Biên 22%),110.0,"=ROUND(C2*0.22,1)","=ROUND(D2*0.22,1)","=ROUND(E2*0.22,1)","=ROUND(F2*0.22,1)","=ROUND(G2*0.22,1)",Biên EBITDA 22%',
    '3. Khấu hao & Phân bổ (D&A),25.0,28.0,32.0,36.0,40.0,44.0,Theo lịch biểu TSCĐ',
    '4. Lợi nhuận hoạt động (EBIT),"=B3-B4","=C3-C4","=D3-D4","=E3-E4","=F3-F4","=G3-G4",= EBITDA - D&A',
    '5. Thuế TNDN thực nộp (20%),"=ROUND(B5*0.2,1)","=ROUND(C5*0.2,1)","=ROUND(D5*0.2,1)","=ROUND(E5*0.2,1)","=ROUND(F5*0.2,1)","=ROUND(G5*0.2,1)",Thuế suất TNDN 20%',
    '6. NOPAT (Lợi nhuận sau thuế HĐKD),"=B5-B6","=C5-C6","=D5-D6","=E5-E6","=F5-F6","=G5-G6",= EBIT * (1 - t)',
    '7. Chi đầu tư TSCĐ (CapEx),35.0,40.0,45.0,48.0,50.0,52.0,Đầu tư mở rộng công suất',
    '8. Thay đổi Vốn lưu động ròng (Delta NWC),8.0,10.0,11.4,12.1,12.5,12.5,10% mức tăng doanh thu',
    '9. Dòng tiền tự do doanh nghiệp (FCFF),"=B7+B4-B8-B9","=C7+C4-C8-C9","=D7+D4-D8-D9","=E7+E4-E8-E9","=F7+F4-F8-F9","=G7+G4-G8-G9",= NOPAT + D&A - CapEx - Delta NWC',
    '10. Hệ số chiết khấu (WACC = 11.5%),1.000,"=ROUND(1/(1+0.115)^1,4)","=ROUND(1/(1+0.115)^2,4)","=ROUND(1/(1+0.115)^3,4)","=ROUND(1/(1+0.115)^4,4)","=ROUND(1/(1+0.115)^5,4)",1 / (1 + WACC)^t',
    '11. Giá trị hiện tại FCFF (PV of FCFF),0.0,"=ROUND(C10*C11,1)","=ROUND(D10*D11,1)","=ROUND(E10*E11,1)","=ROUND(F10*F11,1)","=ROUND(G10*G11,1)",= FCFF * Hệ số chiết khấu',
    '12. Tổng PV của FCFF (5 năm),,"=ROUND(NPV(0.115,C10:G10),1)",,,,,=NPV(WACC; FCFF_1..5)',
    '13. Giá trị cuối kỳ (Terminal Value - g=3%),,,,,,"=ROUND(G10*(1+0.03)/(0.115-0.03),1)",= FCFF_5 * (1+g) / (WACC - g)',
    '14. PV của Terminal Value,,"=ROUND(G14*G11,1)",,,,,= Terminal Value * DF_5',
    '15. Giá trị Doanh nghiệp (Enterprise Value - EV),,"=C13+C15",,,,,= PV(FCFF) + PV(TV)',
    '16. Trừ: Nợ vay ròng (Net Debt),,-120.0,,,,,= Tổng nợ vay - Tiền mặt',
    '17. Giá trị Vốn chủ sở hữu (Equity Value),,"=C16+C17",,,,,= EV - Net Debt',
  ]
  return lines.join('\n')
}

// ── 11c. Mẫu Dự Toán BOQ & Thanh Toán Khối Lượng Xây Dựng IPC (Sheets .xlsx) ──
export function buildBoqIpcCsv(): string {
  const lines: string[] = [
    'Mã hiệu ĐM,Nội dung công việc (Hạng mục),Đơn vị,KL Hợp đồng,Đơn giá HĐ (VNĐ),Thành tiền HĐ (VNĐ),KL lũy kế kỳ trước,KL thực hiện kỳ này,KL lũy kế đến kỳ này,Tỷ lệ hoàn thành (%),Giá trị hoàn thành kỳ này (VNĐ),Giá trị lũy kế đến kỳ này (VNĐ)',
    'AF.11210,Công tác đào móng bằng máy đào 1.25m3 đất cấp II,100m3,45.5,1850000,"=D2*E2",30.0,15.5,"=G2+H2","=ROUND(I2/D2*100,1)","=H2*E2","=I2*E2"',
    'AF.11310,Bê tông lót móng đá 4x6 vữa M100 dày 100mm,m3,120.0,1420000,"=D3*E3",120.0,0.0,"=G3+H3","=ROUND(I3/D3*100,1)","=H3*E3","=I3*E3"',
    'AF.12210,Bê tông móng và đà kiềng thương phẩm M300,m3,850.0,2150000,"=D4*E4",500.0,350.0,"=G4+H4","=ROUND(I4/D4*100,1)","=H4*E4","=I4*E4"',
    'AF.61120,Gia công lắp dựng cốt thép móng D<=18mm CB400-V,tấn,92.4,24500000,"=D5*E5",60.0,32.4,"=G5+H5","=ROUND(I5/D5*100,1)","=H5*E5","=I5*E5"',
    'AF.81130,Ván khuôn móng và đà kiềng phủ phim tiêu chuẩn,100m2,38.0,12800000,"=D6*E6",25.0,13.0,"=G6+H6","=ROUND(I6/D6*100,1)","=H6*E6","=I6*E6"',
    'TỔNG CỘNG,Cộng giá trị trước thuế GTGT,,,,"=SUM(F2:F6)",,,,"=ROUND(L7/F7*100,1)","=SUM(K2:K6)","=SUM(L2:L6)"',
    'VAT 10%,Thuế Giá trị gia tăng (10%),,,,"=ROUND(F7*0.1,0)",,,,,"=ROUND(K7*0.1,0)","=ROUND(L7*0.1,0)"',
    'TỔNG SAU THUẾ,Tổng giá trị thanh toán sau thuế GTGT,,,,"=F7+F8",,,,,"=K7+K8","=L7+L8"',
    'THU HỒI TẠM ỨNG,Khấu trừ tạm ứng hợp đồng (20%),,,,,,,,,"=ROUND(K9*0.2,0)","=ROUND(L9*0.2,0)"',
    'GIỮ LẠI BẢO HÀNH,Giữ lại bảo hành công trình (5%),,,,,,,,,"=ROUND(K9*0.05,0)","=ROUND(L9*0.05,0)"',
    'THỰC NHẬN KỲ NÀY,Giá trị đề nghị thanh toán thực nhận kỳ này (IPC),,,,,,,,,"=K9-K10-K11","=L9-L10-L11"',
  ]
  return lines.join('\n')
}

// ── 12. Bộ Slide Bài Giảng Sư Phạm 6 Trang 16:9 (1280×720) ──────────────────
export function buildPedagogicalSlideDeckSpec(): DeckSpec {
  const font = 'Be Vietnam Pro'
  return {
    pages: [
      // Slide 1: Cover
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'shape',
            shape: 'rect',
            x: 0,
            y: 0,
            w: 440,
            h: 720,
            fill: '#8B3A1A',
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 48,
            y: 64,
            w: 220,
            h: 40,
            fill: '#F9F8F3',
            paragraphs: [
              {
                align: 'center',
                runs: [{ text: 'CHƯƠNG TRÌNH GDPT 2018', sizePt: 11, bold: true, color: '#8B3A1A', font }],
              },
            ],
          },
          {
            type: 'text',
            x: 48,
            y: 220,
            w: 344,
            h: 220,
            paragraphs: [
              {
                runs: [{ text: 'BÀI GIẢNG SƯ PHẠM TƯƠNG TÁC', sizePt: 26, bold: true, color: '#F9F8F3', font }],
                spaceAfterPt: 12,
              },
              {
                runs: [
                  {
                    text: 'Thiết kế theo tiến trình 4 hoạt động Công văn 5512 & Thang nhận thức Bloom',
                    sizePt: 13,
                    color: '#EBE7DD',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'text',
            x: 500,
            y: 130,
            w: 710,
            h: 240,
            paragraphs: [
              {
                runs: [{ text: 'CHỦ ĐỀ BÀI HỌC TRỌNG TÂM', sizePt: 14, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 10,
              },
              {
                runs: [
                  {
                    text: 'Khám Phá Nguyên Lý Hệ Thống & Ứng Dụng Thực Tiễn Trong Đời Sống',
                    sizePt: 34,
                    bold: true,
                    color: '#1C1B18',
                    font,
                  },
                ],
                spaceAfterPt: 16,
              },
              {
                runs: [
                  {
                    text: 'Phát triển năng lực tự chủ, tư duy phản biện và hợp tác giải quyết vấn đề thông qua hệ thống nhiệm vụ học tập trực quan.',
                    sizePt: 16,
                    color: '#4A473E',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 500,
            y: 440,
            w: 710,
            h: 190,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 530,
            y: 465,
            w: 650,
            h: 140,
            paragraphs: [
              {
                runs: [{ text: 'THÔNG TIN LỚP HỌC & HỌC LIỆU', sizePt: 13, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 8,
              },
              {
                runs: [{ text: '• Môn học / Học phần: Khoa học Tự nhiên & Công nghệ — Khối 10 / 11 / 12', sizePt: 13, color: '#1C1B18', font }],
                spaceAfterPt: 4,
              },
              {
                runs: [{ text: '• Thời lượng: 45 phút (1 tiết tiêu chuẩn) • Học liệu: Phiếu học tập số 1 & 2', sizePt: 13, color: '#1C1B18', font }],
                spaceAfterPt: 4,
              },
              {
                runs: [{ text: '• Giáo viên giảng dạy: ThS. ..........................................................', sizePt: 13, color: '#1C1B18', font }],
              },
            ],
          },
        ],
      },
      // Slide 2: Mục tiêu bài học (Executive Summary / Learning Objectives)
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 48,
            w: 1152,
            h: 95,
            paragraphs: [
              {
                runs: [{ text: '01 • MỤC TIÊU BÀI DẠY (CHUẨN ĐẦU RA YÊU CẦU CẦN ĐẠT)', sizePt: 13, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 6,
              },
              {
                runs: [{ text: 'Ba Trụ Cột Kiến Thức, Năng Lực & Phẩm Chất Học Sinh Cần Đạt', sizePt: 28, bold: true, color: '#1C1B18', font }],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 165,
            w: 1152,
            h: 150,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 92,
            y: 185,
            w: 1096,
            h: 110,
            paragraphs: [
              {
                runs: [{ text: '1. Về Kiến Thức Cốt Lõi (Mức Nhận Biết & Thông Hiểu)', sizePt: 18, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 6,
              },
              {
                runs: [
                  {
                    text: 'Trình bày chính xác định nghĩa, cấu trúc thành phần và giải thích được mối quan hệ nhân quả giữa các yếu tố trong mô hình lý thuyết.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 335,
            w: 1152,
            h: 150,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 92,
            y: 355,
            w: 1096,
            h: 110,
            paragraphs: [
              {
                runs: [{ text: '2. Về Năng Lực Đặc Thù & Năng Lực Chung (Mức Vận Dụng)', sizePt: 18, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 6,
              },
              {
                runs: [
                  {
                    text: 'Vận dụng công thức và quy trình chuẩn để giải quyết bài toán thực nghiệm; phối hợp nhóm hiệu quả để hoàn thành Phiếu học tập đúng tiến độ.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 505,
            w: 1152,
            h: 150,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 92,
            y: 525,
            w: 1096,
            h: 110,
            paragraphs: [
              {
                runs: [{ text: '3. Về Phẩm Chất & Thái Độ Học Thuật', sizePt: 18, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 6,
              },
              {
                runs: [
                  {
                    text: 'Rèn luyện tính trung thực khi ghi nhận số liệu quan sát, chủ động phản biện khoa học và liên hệ trách nhiệm bảo vệ môi trường sống.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
      // Slide 3: Nội dung 3 cột (Bento Cards)
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 48,
            w: 1152,
            h: 95,
            paragraphs: [
              {
                runs: [{ text: '02 • HÌNH THÀNH KIẾN THỨC MỚI (KHÁM PHÁ)', sizePt: 13, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 6,
              },
              {
                runs: [{ text: 'Cấu Trúc 3 Thành Phần Trọng Tâm Của Chủ Đề', sizePt: 28, bold: true, color: '#1C1B18', font }],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 165,
            w: 364,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 90,
            y: 195,
            w: 312,
            h: 425,
            paragraphs: [
              {
                runs: [{ text: 'TRỤ CỘT 01', sizePt: 12, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 8,
              },
              {
                runs: [{ text: 'Khái Niệm & Bản Chất Khoa Học', sizePt: 20, bold: true, color: '#1C1B18', font }],
                spaceAfterPt: 14,
              },
              {
                runs: [
                  {
                    text: '• Định nghĩa chuẩn xác các đại lượng và điều kiện biên của hiện tượng.\n• Phân biệt rõ đặc trưng bản chất với các biểu hiện thứ cấp.\n• Ví dụ trực quan từ đời sống hằng ngày giúp học sinh dễ hình dung.',
                    sizePt: 14,
                    color: '#4A473E',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 458,
            y: 165,
            w: 364,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 484,
            y: 195,
            w: 312,
            h: 425,
            paragraphs: [
              {
                runs: [{ text: 'TRỤ CỘT 02', sizePt: 12, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 8,
              },
              {
                runs: [{ text: 'Cơ Chế Vận Hành & Công Thức', sizePt: 20, bold: true, color: '#1C1B18', font }],
                spaceAfterPt: 14,
              },
              {
                runs: [
                  {
                    text: '• Trình tự biến đổi qua 3 giai đoạn liên tiếp có kiểm chứng.\n• Biểu thức toán học liên hệ giữa biến đầu vào và kết quả đầu ra.\n• Quy tắc bảo toàn và giới hạn áp dụng của mô hình.',
                    sizePt: 14,
                    color: '#4A473E',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 852,
            y: 165,
            w: 364,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 878,
            y: 195,
            w: 312,
            h: 425,
            paragraphs: [
              {
                runs: [{ text: 'TRỤ CỘT 03', sizePt: 12, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 8,
              },
              {
                runs: [{ text: 'Ứng Dụng Thực Tiễn & Công Nghệ', sizePt: 20, bold: true, color: '#1C1B18', font }],
                spaceAfterPt: 14,
              },
              {
                runs: [
                  {
                    text: '• Ứng dụng nguyên lý vào thiết kế thiết bị và tối ưu hóa quy trình sản xuất.\n• Phân tích bài toán thực tế tại địa phương và đề xuất cải tiến.\n• Kết nối liên môn STEM (Khoa học - Công nghệ - Kỹ thuật - Toán).',
                    sizePt: 14,
                    color: '#4A473E',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
      // Slide 4: Số liệu / So sánh (Metrics & Bloom Taxonomy Comparison)
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 48,
            w: 1152,
            h: 95,
            paragraphs: [
              {
                runs: [{ text: '03 • PHÂN HÓA NHẬN THỨC & ĐÁNH GIÁ ĐỊNH LƯỢNG', sizePt: 13, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 6,
              },
              {
                runs: [{ text: 'Tỷ Trọng Đánh Giá Theo Thang Nhận Thức Bloom', sizePt: 28, bold: true, color: '#1C1B18', font }],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 165,
            w: 270,
            h: 210,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 84,
            y: 185,
            w: 230,
            h: 170,
            paragraphs: [
              { runs: [{ text: '40%', sizePt: 40, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Mức Nhận Biết', sizePt: 16, bold: true, color: '#1C1B18', font }], spaceAfterPt: 4 },
              { runs: [{ text: 'Ghi nhớ khái niệm, định luật và ký hiệu chuẩn', sizePt: 12, color: '#4A473E', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 358,
            y: 165,
            w: 270,
            h: 210,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 378,
            y: 185,
            w: 230,
            h: 170,
            paragraphs: [
              { runs: [{ text: '30%', sizePt: 40, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Mức Thông Hiểu', sizePt: 16, bold: true, color: '#1C1B18', font }], spaceAfterPt: 4 },
              { runs: [{ text: 'Diễn giải đồ thị, phân tích nguyên nhân hiện tượng', sizePt: 12, color: '#4A473E', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 652,
            y: 165,
            w: 270,
            h: 210,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 672,
            y: 185,
            w: 230,
            h: 170,
            paragraphs: [
              { runs: [{ text: '30%', sizePt: 40, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Mức Vận Dụng', sizePt: 16, bold: true, color: '#1C1B18', font }], spaceAfterPt: 4 },
              { runs: [{ text: 'Giải bài tập tính toán và xử lý tình huống thực tiễn', sizePt: 12, color: '#4A473E', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 946,
            y: 165,
            w: 270,
            h: 210,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 966,
            y: 185,
            w: 230,
            h: 170,
            paragraphs: [
              { runs: [{ text: '10,0đ', sizePt: 40, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: '4 Phần CV 7991', sizePt: 16, bold: true, color: '#1C1B18', font }], spaceAfterPt: 4 },
              { runs: [{ text: '3 mức độ: Nhận biết - Thông hiểu - Vận dụng', sizePt: 12, color: '#4A473E', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 405,
            w: 1152,
            h: 245,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 92,
            y: 430,
            w: 1096,
            h: 195,
            paragraphs: [
              {
                runs: [{ text: 'SO SÁNH PHƯƠNG PHÁP TIẾP CẬN TRUYỀN THỐNG VÀ DẠY HỌC PHÁT TRIỂN NĂNG LỰC', sizePt: 15, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 10,
              },
              {
                runs: [
                  {
                    text: '• Tiếp cận truyền thống: Giáo viên truyền thụ một chiều, học sinh ghi nhớ máy móc công thức, ít gắn kết với bối cảnh thực tế.\n• Tiếp cận phát triển năng lực (CV 5512): Học sinh chủ động khám phá qua nhiệm vụ mở, thảo luận nhóm có rubric đánh giá rõ ràng, tăng 85% mức độ chủ động.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
      // Slide 5: Hoạt động luyện tập & Thảo luận nhóm
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 48,
            w: 1152,
            h: 95,
            paragraphs: [
              {
                runs: [{ text: '04 • HOẠT ĐỘNG LUYỆN TẬP & THẢO LUẬN NHÓM (15 PHÚT)', sizePt: 13, bold: true, color: '#8B3A1A', font }],
                spaceAfterPt: 6,
              },
              {
                runs: [{ text: 'Quy Trình 4 Bước Tổ Chức Nhiệm Vụ Học Tập Trên Lớp', sizePt: 28, bold: true, color: '#1C1B18', font }],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 170,
            w: 556,
            h: 225,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 92,
            y: 195,
            w: 500,
            h: 175,
            paragraphs: [
              { runs: [{ text: 'BƯỚC 1: CHUYỂN GIAO NHIỆM VỤ (2 PHÚT)', sizePt: 16, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 8 },
              {
                runs: [
                  {
                    text: 'Chia lớp thành 4 trạm học tập; mỗi nhóm nhận Phiếu học tập số 2 và bộ dữ liệu tình huống thực tế cần phân tích.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 660,
            y: 170,
            w: 556,
            h: 225,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 688,
            y: 195,
            w: 500,
            h: 175,
            paragraphs: [
              { runs: [{ text: 'BƯỚC 2: THỰC HIỆN NHIỆM VỤ (7 PHÚT)', sizePt: 16, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 8 },
              {
                runs: [
                  {
                    text: 'Học sinh suy nghĩ cá nhân 2 phút, sau đó thảo luận nhóm 5 phút để thống nhất sơ đồ giải pháp trên bảng nhóm.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 425,
            w: 556,
            h: 225,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 92,
            y: 450,
            w: 500,
            h: 175,
            paragraphs: [
              { runs: [{ text: 'BƯỚC 3: BÁO CÁO & PHẢN BIỆN (4 PHÚT)', sizePt: 16, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 8 },
              {
                runs: [
                  {
                    text: 'Đại diện 2 nhóm trình bày kết quả; các nhóm còn lại đặt câu hỏi phản biện và chấm điểm chéo theo Rubric.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 660,
            y: 425,
            w: 556,
            h: 225,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 688,
            y: 450,
            w: 500,
            h: 175,
            paragraphs: [
              { runs: [{ text: 'BƯỚC 4: KẾT LUẬN & NHẬN ĐỊNH (2 PHÚT)', sizePt: 16, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 8 },
              {
                runs: [
                  {
                    text: 'Giáo viên chuẩn hóa kiến thức, giải đáp các sai lầm thường gặp và tuyên dương nhóm có lập luận xuất sắc.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
      // Slide 6: Tổng kết & Hành động (Conclusion & Homework Action Items)
      {
        background: '#1C1B18',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 60,
            w: 1152,
            h: 110,
            paragraphs: [
              {
                runs: [{ text: '05 • TỔNG KẾT BÀI HỌC & NHIỆM VỤ MỞ RỘNG VỀ NHÀ', sizePt: 13, bold: true, color: '#D97757', font }],
                spaceAfterPt: 8,
              },
              {
                runs: [{ text: 'Ghi Nhớ Cốt Lõi & Kế Hoạch Hành Động Sau Giờ Học', sizePt: 30, bold: true, color: '#F5F4EF', font }],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 195,
            w: 556,
            h: 445,
            fill: '#262624',
            stroke: { color: '#3E3D38', widthPt: 1 },
          },
          {
            type: 'text',
            x: 96,
            y: 225,
            w: 492,
            h: 385,
            paragraphs: [
              { runs: [{ text: 'TÓM TẮT KIẾN THỨC TRỌNG TÂM', sizePt: 18, bold: true, color: '#D97757', font }], spaceAfterPt: 12 },
              {
                runs: [
                  {
                    text: '1. Nắm vững khái niệm cốt lõi và điều kiện áp dụng của định luật trong thực tế.\n\n2. Thành thạo quy trình 3 bước phân tích dữ liệu và kiểm chứng kết quả.\n\n3. Luôn đối chiếu đơn vị đo và đánh giá sai số trong quá trình thực nghiệm.',
                    sizePt: 14,
                    color: '#F5F4EF',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 660,
            y: 195,
            w: 556,
            h: 445,
            fill: '#262624',
            stroke: { color: '#3E3D38', widthPt: 1 },
          },
          {
            type: 'text',
            x: 692,
            y: 225,
            w: 492,
            h: 385,
            paragraphs: [
              { runs: [{ text: 'NHIỆM VỤ VỀ NHÀ & DỰ ÁN NHỎ', sizePt: 18, bold: true, color: '#D97757', font }], spaceAfterPt: 12 },
              {
                runs: [
                  {
                    text: '• Bài tập bắt buộc: Hoàn thành bài tập 1, 2, 3 trong Sách bài tập và tải lên hệ thống trước 20:00 thứ Sáu.\n\n• Dự án khuyến khích: Quan sát một ứng dụng thực tế tại gia đình, chụp ảnh minh họa và viết báo cáo ngắn 200 từ.\n\n• Chuẩn bị bài mới: Đọc trước mục I & II của Bài tiếp theo.',
                    sizePt: 14,
                    color: '#F5F4EF',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

// ── 13. Bộ Slide Pitch Deck Gọi Vốn & Chiến Lược 6 Trang 16:9 (1280×720) ─────
export function buildPitchDeckSpec(): DeckSpec {
  const font = 'Be Vietnam Pro'
  return {
    pages: [
      // Slide 1: Cover
      {
        background: '#1C1B18',
        elements: [
          {
            type: 'shape',
            shape: 'rect',
            x: 0,
            y: 0,
            w: 36,
            h: 720,
            fill: '#D97757',
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 96,
            y: 72,
            w: 240,
            h: 40,
            fill: '#262624',
            stroke: { color: '#D97757', widthPt: 1 },
            paragraphs: [
              {
                align: 'center',
                runs: [{ text: 'SERIES A • INVESTOR DECK', sizePt: 11, bold: true, color: '#D97757', font }],
              },
            ],
          },
          {
            type: 'text',
            x: 96,
            y: 165,
            w: 1080,
            h: 240,
            paragraphs: [
              {
                runs: [
                  {
                    text: 'Nền Tảng Tự Động Hóa Tri Thức & Quản Trị Vận Hành Thế Hệ Mới',
                    sizePt: 38,
                    bold: true,
                    color: '#F5F4EF',
                    font,
                  },
                ],
                spaceAfterPt: 18,
              },
              {
                runs: [
                  {
                    text: 'Giúp doanh nghiệp Đông Nam Á tối ưu hiệu suất làm việc văn phòng với kiến trúc AI bảo mật dữ liệu nội bộ tuyệt đối (Local-First & Zero Data Retention).',
                    sizePt: 17,
                    color: '#DDD9CE',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 96,
            y: 465,
            w: 340,
            h: 165,
            fill: '#262624',
            stroke: { color: '#3E3D38', widthPt: 1 },
          },
          {
            type: 'text',
            x: 120,
            y: 488,
            w: 292,
            h: 120,
            paragraphs: [
              { runs: [{ text: '[cần số liệu]', sizePt: 26, bold: true, color: '#D97757', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Doanh thu định kỳ hàng năm (ARR) & tốc độ tăng trưởng YoY', sizePt: 12, color: '#DDD9CE', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 466,
            y: 465,
            w: 340,
            h: 165,
            fill: '#262624',
            stroke: { color: '#3E3D38', widthPt: 1 },
          },
          {
            type: 'text',
            x: 490,
            y: 488,
            w: 292,
            h: 120,
            paragraphs: [
              { runs: [{ text: '[cần số liệu]', sizePt: 26, bold: true, color: '#D97757', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Tỷ lệ giữ chân doanh thu thuần (NDR) khối khách hàng B2B', sizePt: 12, color: '#DDD9CE', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 836,
            y: 465,
            w: 340,
            h: 165,
            fill: '#262624',
            stroke: { color: '#3E3D38', widthPt: 1 },
          },
          {
            type: 'text',
            x: 860,
            y: 488,
            w: 292,
            h: 120,
            paragraphs: [
              { runs: [{ text: '[cần số liệu]', sizePt: 26, bold: true, color: '#D97757', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Biên lợi nhuận gộp nhờ kiến trúc xử lý lai Local + Cloud', sizePt: 12, color: '#DDD9CE', font }] },
            ],
          },
        ],
      },
      // Slide 2: Tóm tắt điều hành (Executive Summary — Problem & Opportunity)
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 48,
            w: 1152,
            h: 95,
            paragraphs: [
              { runs: [{ text: '01 • TÓM TẮT ĐIỀU HÀNH & BỐI CẢNH THỊ TRƯỜNG', sizePt: 13, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Khoảng Trống Hiệu Suất Trong Doanh Nghiệp & Cơ Hội Chuyển Đổi', sizePt: 28, bold: true, color: '#1C1B18', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 165,
            w: 556,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 96,
            y: 195,
            w: 492,
            h: 425,
            paragraphs: [
              { runs: [{ text: 'NỖI ĐAU THỊ TRƯỜNG (THE PROBLEM)', sizePt: 16, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 12 },
              {
                runs: [
                  {
                    text: '• Phân mảnh công cụ: Nhân sự mất nhiều thời gian chuyển đổi qua lại giữa trình soạn thảo văn bản, bảng tính và các cửa sổ chat AI rời rạc.\n\n• Rủi ro rò rỉ dữ liệu: Nhiều doanh nghiệp hạn chế nhân viên tải hợp đồng, báo cáo tài chính lên các công cụ AI đám mây công cộng vì lo ngại lộ dữ liệu nhạy cảm.\n\n• Chi phí bản quyền đắt đỏ: Gói phần mềm văn phòng kèm Copilot quốc tế vượt quá ngân sách của đa số doanh nghiệp SME và tổ chức giáo dục.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 660,
            y: 165,
            w: 556,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 692,
            y: 195,
            w: 492,
            h: 425,
            paragraphs: [
              { runs: [{ text: 'GIẢI PHÁP ĐỘT PHÁ (OUR SOLUTION)', sizePt: 16, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 12 },
              {
                runs: [
                  {
                    text: '• Không gian làm việc hợp nhất: Tích hợp trực tiếp trợ lý AI suy luận sâu ngay bên cạnh trang soạn thảo Word (.docx), Excel (.xlsx), PowerPoint (.pptx).\n\n• Bảo mật PII & Local-First: Mọi tệp tài liệu được xử lý cục bộ trên máy; thông tin nhạy cảm được ẩn danh tự động trước khi gọi AI.\n\n• Chuẩn hóa bản địa: Kho biểu mẫu Nghị định 30, Hợp đồng thương mại, Bảng lương 3P và Giáo án 5512 sẵn sàng chỉ với 1 cú nhấp chuột.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
      // Slide 3: Giải pháp 3 cột (Bento Cards)
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 48,
            w: 1152,
            h: 95,
            paragraphs: [
              { runs: [{ text: '02 • KIẾN TRÚC SẢN PHẨM & LỢI THẾ CÔNG NGHỆ', sizePt: 13, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Ba Động Cơ Cốt Lõi Tạo Nên Lợi Thế Cạnh Tranh Bền Vững', sizePt: 28, bold: true, color: '#1C1B18', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 165,
            w: 364,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 90,
            y: 195,
            w: 312,
            h: 425,
            paragraphs: [
              { runs: [{ text: '01 • NATIVE OOXML ENGINES', sizePt: 12, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 8 },
              { runs: [{ text: 'Động Cơ Tài Liệu Chuẩn ISO', sizePt: 20, bold: true, color: '#1C1B18', font }], spaceAfterPt: 14 },
              {
                runs: [
                  {
                    text: '• Bảo toàn cấu trúc byte-level của file .docx, .xlsx, .pptx khi mở và lưu.\n• Hỗ trợ Track Changes, bình luận, công thức mảng và biểu đồ phức tạp.\n• Hoạt động mượt mà cả khi ngoại tuyến (Offline Core).',
                    sizePt: 14,
                    color: '#4A473E',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 458,
            y: 165,
            w: 364,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 484,
            y: 195,
            w: 312,
            h: 425,
            paragraphs: [
              { runs: [{ text: '02 • AGENTIC AI COPILOT', sizePt: 12, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 8 },
              { runs: [{ text: 'Điều Phối Đa Tác Tử Thông Minh', sizePt: 20, bold: true, color: '#1C1B18', font }], spaceAfterPt: 14 },
              {
                runs: [
                  {
                    text: '• Tự động lập dàn ý, viết văn bản dài, dựng slide 16:9 và kiểm toán công thức bảng tính.\n• Kết nối trực tiếp kho Cloud Skills và công cụ MCP chuyên ngành từ Web Server.\n• Nén ngữ cảnh thông minh giúp tối ưu chi phí vận hành.',
                    sizePt: 14,
                    color: '#4A473E',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 852,
            y: 165,
            w: 364,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 878,
            y: 195,
            w: 312,
            h: 425,
            paragraphs: [
              { runs: [{ text: '03 • ENTERPRISE GOVERNANCE', sizePt: 12, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 8 },
              { runs: [{ text: 'Bảo Mật & Quản Trị Tập Trung', sizePt: 20, bold: true, color: '#1C1B18', font }], spaceAfterPt: 14 },
              {
                runs: [
                  {
                    text: '• Quản trị tập trung mẫu văn bản, kỹ năng AI và hạn ngạch người dùng qua Admin Console.\n• Mã hóa PII phía client trước khi gửi yêu cầu suy luận.\n• Hỗ trợ triển khai On-Premise / Private Cloud cho ngân hàng và cơ quan nhà nước.',
                    sizePt: 14,
                    color: '#4A473E',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
      // Slide 4: Số liệu tài chính & Tăng trưởng (Metrics & Unit Economics)
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 48,
            w: 1152,
            h: 95,
            paragraphs: [
              { runs: [{ text: '03 • CHỈ SỐ TĂNG TRƯỞNG & HIỆU QUẢ ĐƠN VỊ (UNIT ECONOMICS)', sizePt: 13, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Khung Chỉ Số Đo Lường Tăng Trưởng & Hiệu Quả Thu Hồi Vốn', sizePt: 28, bold: true, color: '#1C1B18', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 165,
            w: 270,
            h: 210,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 84,
            y: 185,
            w: 230,
            h: 170,
            paragraphs: [
              { runs: [{ text: '[cần số liệu]', sizePt: 26, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Tỷ Lệ LTV / CAC', sizePt: 16, bold: true, color: '#1C1B18', font }], spaceAfterPt: 4 },
              { runs: [{ text: 'Thời gian hoàn vốn CAC (Payback Period): [cần số liệu]', sizePt: 12, color: '#4A473E', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 358,
            y: 165,
            w: 270,
            h: 210,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 378,
            y: 185,
            w: 230,
            h: 170,
            paragraphs: [
              { runs: [{ text: '[cần số liệu]', sizePt: 26, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Người Dùng Hoạt Động', sizePt: 16, bold: true, color: '#1C1B18', font }], spaceAfterPt: 4 },
              { runs: [{ text: 'Tỷ lệ chuyển đổi từ Free sang Pro: [cần số liệu]', sizePt: 12, color: '#4A473E', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 652,
            y: 165,
            w: 270,
            h: 210,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 672,
            y: 185,
            w: 230,
            h: 170,
            paragraphs: [
              { runs: [{ text: '[cần số liệu]', sizePt: 26, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Monthly Logo Churn', sizePt: 16, bold: true, color: '#1C1B18', font }], spaceAfterPt: 4 },
              { runs: [{ text: 'Độ gắn kết cao nhờ lưu trữ tài liệu & quy trình hàng ngày', sizePt: 12, color: '#4A473E', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 946,
            y: 165,
            w: 270,
            h: 210,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 966,
            y: 185,
            w: 230,
            h: 170,
            paragraphs: [
              { runs: [{ text: '[cần số liệu]', sizePt: 26, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Mục Tiêu ARR Năm Tới', sizePt: 16, bold: true, color: '#1C1B18', font }], spaceAfterPt: 4 },
              { runs: [{ text: 'Mở rộng sang thị trường khu vực Đông Nam Á', sizePt: 12, color: '#4A473E', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 405,
            w: 1152,
            h: 245,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 92,
            y: 430,
            w: 1096,
            h: 195,
            paragraphs: [
              { runs: [{ text: 'ĐỘNG LỰC TĂNG TRƯỞNG DOANH THU QUA CÁC QUÝ (QUARTERLY TRACTION)', sizePt: 15, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 10 },
              {
                runs: [
                  {
                    text: '• Q1: [cần số liệu] — Ra mắt phiên bản Desktop Windows/macOS và triển khai nhóm khách hàng tiên phong.\n• Q2: [cần số liệu] — Triển khai Kho Cloud Skills & Work Bundles cho khối Pháp chế, Tài chính và Giáo dục.\n• Q3-Q4: [cần số liệu] — Mở rộng hợp đồng Enterprise quy mô lớn và tối ưu dòng tiền vận hành.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
      // Slide 5: So sánh vị thế cạnh tranh & Chiến lược Go-To-Market
      {
        background: '#F4F2EB',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 48,
            w: 1152,
            h: 95,
            paragraphs: [
              { runs: [{ text: '04 • VỊ THẾ CẠNH TRANH & CHIẾN LƯỢC CHIẾM LĨNH THỊ TRƯỜNG', sizePt: 13, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 6 },
              { runs: [{ text: 'Sự Khác Biệt Tuyệt Đối So Với Các Giải Pháp Hiện Hành', sizePt: 28, bold: true, color: '#1C1B18', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 165,
            w: 556,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 96,
            y: 195,
            w: 492,
            h: 425,
            paragraphs: [
              { runs: [{ text: 'LỢI THẾ VƯỢT TRỘI CỦA LYCERO OFFICE', sizePt: 16, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 12 },
              {
                runs: [
                  {
                    text: '• So với Bộ Office truyền thống: Tích hợp sẵn Agentic AI chỉnh sửa trực tiếp trên tài liệu với chi phí tối ưu, không yêu cầu mua thêm gói addon rời rạc.\n\n• So với Web Chatbots (ChatGPT / Claude Web): Không phải copy-paste thủ công làm hỏng định dạng bảng biểu, công thức và bố cục trang A4/Slide.\n\n• Chuẩn hóa Pháp quy & Giáo dục Việt Nam: Hỗ trợ chuyên sâu Nghị định 30, Thông tư 22, Công văn 5512 và kế toán doanh nghiệp.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 660,
            y: 165,
            w: 556,
            h: 485,
            fill: '#F9F8F3',
            stroke: { color: '#DDD9CE', widthPt: 1 },
          },
          {
            type: 'text',
            x: 692,
            y: 195,
            w: 492,
            h: 425,
            paragraphs: [
              { runs: [{ text: 'CHIẾN LƯỢC PHÂN PHỐI (GO-TO-MARKET)', sizePt: 16, bold: true, color: '#8B3A1A', font }], spaceAfterPt: 12 },
              {
                runs: [
                  {
                    text: '1. Product-Led Growth (PLG): Bản Desktop miễn phí cho tính năng biên tập cơ bản giúp lan tỏa tự nhiên tới cộng đồng người dùng văn phòng.\n\n2. B2B Work Bundles: Cung cấp gói giải pháp theo phòng ban (HR, Pháp chế, Tài chính, R&D) với hiệu quả vận hành rõ rệt.\n\n3. Liên minh Giáo dục & Sở/Trường: Triển khai đồng bộ cấp trường và đại học thông qua hệ sinh thái EdTech.',
                    sizePt: 14,
                    color: '#1C1B18',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
      // Slide 6: Kết luận / Kế hoạch gọi vốn & Hành động (The Ask & Roadmap)
      {
        background: '#1C1B18',
        elements: [
          {
            type: 'text',
            x: 64,
            y: 60,
            w: 1152,
            h: 110,
            paragraphs: [
              { runs: [{ text: '05 • ĐỀ XUẤT ĐẦU TƯ & LỘ TRÌNH CHIẾN LƯỢC', sizePt: 13, bold: true, color: '#D97757', font }], spaceAfterPt: 8 },
              { runs: [{ text: 'Kế Hoạch Huy Động Vốn ([cần số liệu]) & Phân Bổ Nguồn Lực', sizePt: 30, bold: true, color: '#F5F4EF', font }] },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 64,
            y: 195,
            w: 556,
            h: 445,
            fill: '#262624',
            stroke: { color: '#3E3D38', widthPt: 1 },
          },
          {
            type: 'text',
            x: 96,
            y: 225,
            w: 492,
            h: 385,
            paragraphs: [
              { runs: [{ text: 'PHÂN BỔ NGUỒN VỐN (USE OF FUNDS)', sizePt: 18, bold: true, color: '#D97757', font }], spaceAfterPt: 12 },
              {
                runs: [
                  {
                    text: '• Nghiên cứu & Phát triển (R&D - [cần số liệu]%): Tối ưu hóa động cơ Rust/OOXML cục bộ, mô hình AI chuyên biệt cho tài liệu và hạ tầng Cloud MCP.\n\n• Mở rộng Kinh doanh (Enterprise Sales & GTM - [cần số liệu]%): Xây dựng đội ngũ tư vấn B2B và mạng lưới đối tác triển khai.\n\n• Vận hành & Bảo mật Quốc tế ([cần số liệu]%): Chứng chỉ SOC2 Type II, ISO 27001 và dự trữ thanh khoản.',
                    sizePt: 14,
                    color: '#F5F4EF',
                    font,
                  },
                ],
              },
            ],
          },
          {
            type: 'shape',
            shape: 'roundRect',
            x: 660,
            y: 195,
            w: 556,
            h: 445,
            fill: '#262624',
            stroke: { color: '#3E3D38', widthPt: 1 },
          },
          {
            type: 'text',
            x: 692,
            y: 225,
            w: 492,
            h: 385,
            paragraphs: [
              { runs: [{ text: 'CỘT MỐC CAM KẾT & LIÊN HỆ HỢP TÁC', sizePt: 18, bold: true, color: '#D97757', font }], spaceAfterPt: 12 },
              {
                runs: [
                  {
                    text: '• Cột mốc giai đoạn 1: [cần số liệu] người dùng hoạt động và chỉ tiêu ARR [cần số liệu].\n\n• Cột mốc giai đoạn 2: [cần số liệu] khách hàng doanh nghiệp trả phí định kỳ, sẵn sàng cho vòng gọi vốn tiếp theo.\n\n• Liên hệ Ban Điều hành: founders@lycero.com | https://lycero.com',
                    sizePt: 14,
                    color: '#F5F4EF',
                    font,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

const slideMetrics = new HeuristicMetrics()

async function buildPptxFromDeckSpec(spec: DeckSpec): Promise<Uint8Array> {
  try {
    const built = await buildDeckPptx(spec, {
      fetchImage: async () => null,
      imageDims: () => null,
      fontMetrics: slideMetrics,
    })
    return built.bytes
  } catch {
    return createBlankPptx()
  }
}

export async function buildPedagogicalSlidesPptx(): Promise<Uint8Array> {
  return buildPptxFromDeckSpec(buildPedagogicalSlideDeckSpec())
}

export async function buildPitchDeckPptx(): Promise<Uint8Array> {
  return buildPptxFromDeckSpec(buildPitchDeckSpec())
}

// ── BỘ ĐIỀU PHỐI TẠO MẪU ĐA HÌNH (CLOUD REGISTRY + LOCAL FALLBACK) ──────────
export async function createPedagogicalTemplate(
  templateId: string,
  saveDir: string,
  openDocFn: (payload: { title: string; html: string }) => void,
): Promise<{ filePath?: string }> {
  // 1. Ưu tiên kiểm tra bản cập nhật mới nhất từ Cloud Template Registry (nếu có)
  try {
    const cloudTemplates = await fetchCloudTemplates()
    const cloudMatch = cloudTemplates.find(
      (item) => item.id === templateId || item.slug === templateId,
    )
    if (cloudMatch) {
      const htmlContent =
        cloudMatch.html ??
        (cloudMatch.format === 'docx' && typeof cloudMatch.content === 'string'
          ? cloudMatch.content
          : undefined)
      if (htmlContent && htmlContent.trim()) {
        openDocFn({ title: cloudMatch.title || templateId, html: htmlContent })
        return {}
      }

      const rawCsvOrJson =
        cloudMatch.csv ??
        (cloudMatch.format === 'xlsx' && typeof cloudMatch.content === 'string'
          ? cloudMatch.content
          : undefined)
      if (rawCsvOrJson && rawCsvOrJson.trim()) {
        let normalizedCsv = rawCsvOrJson.trim()
        if (normalizedCsv.startsWith('{')) {
          try {
            const parsedJson = JSON.parse(normalizedCsv) as {
              columns?: unknown[]
              rows?: unknown[][]
            }
            if (Array.isArray(parsedJson.columns) && Array.isArray(parsedJson.rows)) {
              const encodeCsvCell = (cell: unknown): string => {
                const str = cell == null ? '' : String(cell)
                return /[",\n\r]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str
              }
              normalizedCsv = [
                parsedJson.columns.map(encodeCsvCell).join(','),
                ...parsedJson.rows.map((r) =>
                  Array.isArray(r) ? r.map(encodeCsvCell).join(',') : '',
                ),
              ].join('\n')
            }
          } catch {
            // Keep rawCsvOrJson as-is
          }
        }
        const sheetName = (cloudMatch.title || templateId).slice(0, 31)
        const buffer = await sheetCsvToXlsxBuffer(normalizedCsv, sheetName)
        const fileName = `${templateId}-${Date.now().toString().slice(-4)}.xlsx`
        const filePath = join(saveDir, fileName)
        writeFileSync(filePath, buffer)
        return { filePath }
      }

      const rawSlideSpec =
        cloudMatch.slideSpec ?? (cloudMatch.format === 'pptx' ? cloudMatch.content : undefined)
      if (rawSlideSpec) {
        const rawJson =
          typeof rawSlideSpec === 'string' ? rawSlideSpec : JSON.stringify(rawSlideSpec)
        const parsed = parseDeckSpec(rawJson)
        if (parsed.ok) {
          const buffer = await buildPptxFromDeckSpec(parsed.spec)
          const fileName = `${templateId}-16-9-${Date.now().toString().slice(-4)}.pptx`
          const filePath = join(saveDir, fileName)
          writeFileSync(filePath, buffer)
          return { filePath }
        }
      }
    }
  } catch {
    // Offline fallback: tiếp tục dùng bộ mẫu cục bộ bên dưới
  }

  // 2. Bộ mẫu Cục bộ (Local Fallback)
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
    const buffer = await buildPedagogicalSlidesPptx()
    const fileName = `Bai-Giang-Su-Pham-16-9-${Date.now().toString().slice(-4)}.pptx`
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, buffer)
    return { filePath }
  }

  // Hành chính & Doanh nghiệp
  if (templateId === 'cong-van-nd30') {
    const data = buildOfficialDispatchNd30Html()
    openDocFn(data)
    return {}
  }
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
  if (templateId === 'bang-luong-3p') {
    const csv = buildPayroll3pCsv()
    const buffer = await sheetCsvToXlsxBuffer(csv, 'Bảng Lương 3P & BHXH')
    const fileName = `Bang-Luong-3P-BHXH-2026-${Date.now().toString().slice(-4)}.xlsx`
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, buffer)
    return { filePath }
  }
  if (templateId === 'dinh-gia-dcf-wacc') {
    const csv = buildDcfValuationCsv()
    const buffer = await sheetCsvToXlsxBuffer(csv, 'Định Giá DCF WACC')
    const fileName = `Mo-Hinh-Dinh-Gia-DCF-WACC-2026-${Date.now().toString().slice(-4)}.xlsx`
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, buffer)
    return { filePath }
  }
  if (templateId === 'du-toan-khoi-luong-xay-dung-boq-ipc') {
    const csv = buildBoqIpcCsv()
    const buffer = await sheetCsvToXlsxBuffer(csv, 'Dự Toán BOQ & IPC')
    const fileName = `Du-Toan-BOQ-Thanh-Toan-IPC-2026-${Date.now().toString().slice(-4)}.xlsx`
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, buffer)
    return { filePath }
  }
  if (templateId === 'pitch-deck-pptx') {
    const buffer = await buildPitchDeckPptx()
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
