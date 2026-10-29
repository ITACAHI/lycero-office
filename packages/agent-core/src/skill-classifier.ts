/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import type { CloudSkillManifest } from './cloud-capabilities'

/**
 * Built-in catalog of Cloud Skills mirrored from Lycero Hub (`/api/v1/office/desktop/capabilities`
 * and `/api/v1/office/skills/recommended`) so all skills are immediately available and
 * classifiable even before or during background cloud sync.
 */
export const DEFAULT_CLOUD_SKILL_CATALOG: readonly CloudSkillManifest[] = [
  {
    slug: 'vn-admin-nd30',
    name: 'Soạn thảo Hành chính Nghị định 30/2020/NĐ-CP',
    description:
      'Chuẩn hóa Quốc hiệu, Tiêu ngữ, số ký hiệu, nơi nhận và thể thức công văn, tờ trình, quyết định theo Nghị định 30/2020/NĐ-CP.',
    category: 'Hành chính & Văn phòng',
    version: '2.0.0',
  },
  {
    slug: 'contract-drafter',
    name: 'Soạn thảo & Rà soát Hợp đồng Pháp lý',
    description:
      'Soạn thảo hợp đồng kinh tế, lao động, dịch vụ, NDA và rà soát rủi ro pháp lý theo Bộ luật Dân sự 2015 & Luật Thương mại.',
    category: 'Pháp chế & Hợp đồng',
    version: '2.0.0',
  },
  {
    slug: 'edtech-lesson-5512',
    name: 'Kế hoạch Bài dạy (Giáo án Công văn 5512)',
    description:
      'Thiết kế Kế hoạch bài dạy 4 hoạt động (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng) chuẩn Công văn 5512/BGDĐT-GDTrH.',
    category: 'Sư phạm & Giáo dục',
    version: '2.1.0',
  },
  {
    slug: 'edtech-exam-matrix',
    name: 'Ma trận & Đặc tả Đề kiểm tra (Thang Bloom / CV 7991)',
    description:
      'Xây dựng ma trận đề kiểm tra 4 mức độ Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao kèm câu hỏi và đáp án chi tiết.',
    category: 'Sư phạm & Giáo dục',
    version: '2.1.0',
  },
  {
    slug: 'course-slides',
    name: 'Thiết kế Slide Bài giảng Sư phạm Tương tác',
    description:
      'Chuyển hóa nội dung bài học thành bộ slide 16:9 trực quan có câu hỏi khởi động, sơ đồ tư duy và bài tập củng cố.',
    category: 'Sư phạm & Giáo dục',
    version: '2.0.0',
  },
  {
    slug: 'rubric-builder',
    name: 'Thiết kế Bảng kiểm & Rubric Đánh giá Năng lực',
    description:
      'Xây dựng tiêu chí đánh giá (Rubric) định lượng rõ ràng theo từng mức độ hoàn thành cho bài tập, dự án học tập.',
    category: 'Sư phạm & Giáo dục',
    version: '2.0.0',
  },
  {
    slug: 'hr-payroll-3p',
    name: 'Bảng lương 3P, KPI & Thuế TNCN / BHXH',
    description:
      'Thiết kế bảng tính lương 3P (P1-P2-P3), trích nộp BHXH 10.5% / 21.5%, giảm trừ gia cảnh và tính thuế TNCN lũy tiến.',
    category: 'Nhân sự & Tiền lương',
    version: '2.0.0',
  },
  {
    slug: 'financial-statement-analysis',
    name: 'Phân tích Báo cáo Tài chính & Dòng tiền CFO',
    description:
      'Phân tích Bảng cân đối kế toán, KQKD, Lưu chuyển tiền tệ, biên lợi nhuận, ROE/ROA, EBITDA và cảnh báo rủi ro thanh khoản.',
    category: 'Tài chính & Kế toán',
    version: '2.0.0',
  },
  {
    slug: 'invoice-tax-checklist',
    name: 'Kiểm toán Hóa đơn & Rà soát Thuế GTGT / TNDN',
    description:
      'Đối chiếu hóa đơn điện tử, kiểm tra điều kiện khấu trừ thuế GTGT, chi phí hợp lệ tính thuế TNDN và lập bảng kê.',
    category: 'Tài chính & Kế toán',
    version: '2.0.0',
  },
  {
    slug: 'budget-planner',
    name: 'Lập Kế hoạch Ngân sách & Dự phóng Tài chính',
    description:
      'Xây dựng mô hình dự phóng ngân sách phòng ban, kịch bản Base/Best/Worst case và theo dõi định mức chi phí.',
    category: 'Tài chính & Kế toán',
    version: '2.0.0',
  },
  {
    slug: 'data-analyst',
    name: 'Phân tích Dữ liệu & Thống kê Bảng tính',
    description:
      'Tổng hợp dữ liệu bảng tính, phát hiện xu hướng, tính toán chỉ số thống kê, viết công thức Excel nâng cao và tóm tắt insight.',
    category: 'Dữ liệu & Bảng tính',
    version: '2.0.0',
  },
  {
    slug: 'data-cleaning',
    name: 'Làm sạch & Chuẩn hóa Dữ liệu (Data Cleaning)',
    description:
      'Chuẩn hóa họ tên, ngày tháng, mã số, phát hiện dòng trùng lặp và xử lý ô trống trong danh sách học sinh, khách hàng, nhân sự.',
    category: 'Dữ liệu & Bảng tính',
    version: '2.0.0',
  },
  {
    slug: 'executive-deck',
    name: 'Thiết kế Pitch Deck & Báo cáo Hội đồng Quản trị',
    description:
      'Cấu trúc bài thuyết trình chiến lược theo nguyên tắc Pyramid Principle (Minto), Bento Grid 16:9 và biểu đồ số liệu điều hành.',
    category: 'Trình chiếu & Thiết kế',
    version: '2.0.0',
  },
  {
    slug: 'slide-planner',
    name: 'Kiến trúc sư Dàn ý & Bố cục Slide 16:9',
    description:
      'Lập dàn ý phân trang trình chiếu, cân đối mật độ chữ và chọn bố cục hình học hiện đại chuẩn Astryx.',
    category: 'Trình chiếu & Thiết kế',
    version: '2.0.0',
  },
  {
    slug: 'deep-research',
    name: 'Nghiên cứu Chuyên sâu & Tổng quan Tài liệu Học thuật',
    description:
      'Tổng hợp đa nguồn tài liệu, phân tích phản biện, trích dẫn chuẩn APA/IEEE và cấu trúc bài báo khoa học / luận văn.',
    category: 'Nghiên cứu & Học thuật',
    version: '2.0.0',
  },
  {
    slug: 'report-writer',
    name: 'Soạn thảo Báo cáo Tổng kết & Đề án Chuyên nghiệp',
    description:
      'Viết báo cáo công việc, đề án triển khai, biên bản cuộc họp và tóm tắt điều hành rõ ràng, mạch lạc.',
    category: 'Hành chính & Văn phòng',
    version: '2.0.0',
  },
]

interface SkillClassificationRule {
  slug: string
  /** Modules where this skill gets a context affinity boost */
  modules: readonly string[]
  /** Pipeline stages where this skill is directly relevant */
  stages?: readonly string[]
  /** Keywords (Vietnamese diacritic-insensitive & English) that trigger this skill */
  keywords: readonly string[]
}

const CLASSIFICATION_RULES: readonly SkillClassificationRule[] = [
  {
    slug: 'vn-admin-nd30',
    modules: ['office_docx', 'office_pdf', 'office_markdown', 'office_html'],
    stages: ['doc_longform', 'chat'],
    keywords: [
      'cong van',
      'to trinh',
      'quyet dinh',
      'nghi dinh 30',
      'nd30',
      'nd 30',
      'the thuc van ban',
      'quoc hieu',
      'tieu ngu',
      'noi nhan',
      'thong bao hanh chinh',
      'van ban hanh chinh',
      'bien ban hop',
      'giay moi',
      'kinh gui',
    ],
  },
  {
    slug: 'contract-drafter',
    modules: ['office_docx', 'office_pdf', 'office_markdown'],
    stages: ['doc_longform', 'chat'],
    keywords: [
      'hop dong',
      'dieu khoan',
      'phap ly',
      'ben a',
      'ben b',
      'phat vi pham',
      'bat kha khang',
      'thanh ly hop dong',
      'phu luc hop dong',
      'thoa thuan',
      'nda',
      'bo luat dan su',
      'luat thuong mai',
      'tranh chap',
      'contract',
      'agreement',
      'legal',
    ],
  },
  {
    slug: 'edtech-lesson-5512',
    modules: ['office_docx', 'office_markdown', 'office_pdf'],
    stages: ['doc_longform', 'chat'],
    keywords: [
      'giao an',
      'ke hoach bai day',
      'khbd',
      '5512',
      'cong van 5512',
      'hoat dong day hoc',
      'muc tieu bai hoc',
      'nang luc',
      'pham chat',
      'khoi dong',
      'hinh thanh kien thuc',
      'luyen tap',
      'van dung',
      'lesson plan',
      'gdpt 2018',
      'chuong trinh 2018',
      'tiet hoc',
    ],
  },
  {
    slug: 'edtech-exam-matrix',
    modules: ['office_docx', 'office_sheet', 'office_pdf', 'office_markdown'],
    stages: ['doc_longform', 'chat'],
    keywords: [
      'ma tran de',
      'dac ta de',
      'de kiem tra',
      'de thi',
      'trac nghiem',
      'tu luan',
      'bloom',
      'nhan biet',
      'thong hieu',
      'van dung cao',
      '7991',
      'cong van 7991',
      'dap an',
      'thang diem',
      'ngan hang cau hoi',
      'quiz',
      'exam matrix',
    ],
  },
  {
    slug: 'course-slides',
    modules: ['office_slide'],
    stages: ['slide_style', 'slide_outline', 'slide_page_spec', 'slide_edit', 'chat'],
    keywords: [
      'bai giang',
      'slide bai giang',
      'giang day',
      'hoc sinh',
      'sinh vien',
      'lop hoc',
      'su pham',
      'mon hoc',
      'bai hoc',
      'kien thuc',
      'on tap',
      'chuyen de hoc tap',
      'lecture',
      'classroom',
    ],
  },
  {
    slug: 'rubric-builder',
    modules: ['office_docx', 'office_sheet', 'office_markdown'],
    keywords: [
      'rubric',
      'tieu chi danh gia',
      'bang kiem',
      'phieu danh gia',
      'danh gia hoc sinh',
      'danh gia nang luc',
      'muc do dat',
      'thang danh gia',
    ],
  },
  {
    slug: 'hr-payroll-3p',
    modules: ['office_sheet', 'office_docx'],
    stages: ['sheet_formula', 'chat'],
    keywords: [
      'bang luong',
      'luong 3p',
      '3p',
      'kpi',
      'bhxh',
      'bhyt',
      'bhtn',
      'bao hiem xa hoi',
      'thue tncn',
      'giam tru gia canh',
      'cham cong',
      'ngay cong',
      'phu cap',
      'thu nhap chiu thue',
      'nhan su',
      'payroll',
      'salary',
    ],
  },
  {
    slug: 'financial-statement-analysis',
    modules: ['office_sheet', 'office_docx', 'office_pdf', 'office_slide'],
    stages: ['sheet_formula', 'doc_longform', 'chat'],
    keywords: [
      'bao cao tai chinh',
      'dong tien',
      'can doi ke toan',
      'ket qua kinh doanh',
      'luu chuyen tien te',
      'ebitda',
      'roe',
      'roa',
      'cfo',
      'thanh khoan',
      'bien loi nhuan',
      'doanh thu',
      'loi nhuan',
      'tai san',
      'nguon von',
      'financial statement',
      'cash flow',
      'balance sheet',
    ],
  },
  {
    slug: 'invoice-tax-checklist',
    modules: ['office_sheet', 'office_docx', 'office_pdf'],
    stages: ['sheet_formula', 'chat'],
    keywords: [
      'hoa don',
      'thue gtgt',
      'vat',
      'thue tndn',
      'khau tru thue',
      'quyet toan thue',
      'bang ke hoa don',
      'chi phi hop le',
      'ke toan thue',
      'kiem toan',
      'invoice',
      'tax',
    ],
  },
  {
    slug: 'budget-planner',
    modules: ['office_sheet', 'office_slide'],
    stages: ['sheet_formula', 'chat'],
    keywords: [
      'ngan sach',
      'du phong',
      'ke hoach tai chinh',
      'chi phi',
      'dinh muc',
      'capex',
      'opex',
      'budget',
      'forecast',
    ],
  },
  {
    slug: 'data-cleaning',
    modules: ['office_sheet'],
    stages: ['sheet_formula', 'chat'],
    keywords: [
      'danh sach',
      'danh sach hoc sinh',
      'lam sach',
      'chuan hoa',
      'trung lap',
      'loc du lieu',
      'sap xep',
      'tach ho ten',
      'ngay sinh',
      'gioi tinh',
      'lop',
      'clean data',
      'duplicate',
      'xls',
      'xlsx',
      'csv',
    ],
  },
  {
    slug: 'data-analyst',
    modules: ['office_sheet'],
    stages: ['sheet_formula', 'chat'],
    keywords: [
      'thong ke',
      'phan tich du lieu',
      'tong hop',
      'bieu do',
      'cong thuc',
      'trung binh',
      'ty le',
      'phan tram',
      'so sanh',
      'bang tinh',
      'sheet',
      'excel',
      'sum',
      'vlookup',
      'xlookup',
      'pivot',
      'tom tat noi dung',
      'tom tat bang',
    ],
  },
  {
    slug: 'executive-deck',
    modules: ['office_slide'],
    stages: ['slide_style', 'slide_outline', 'slide_page_spec', 'slide_edit', 'chat'],
    keywords: [
      'pitch deck',
      'hoi dong quan tri',
      'chien luoc',
      'goi von',
      'startup',
      'dau tu',
      'bao cao dieu hanh',
      'executive',
      'bento',
      'q1',
      'q2',
      'q3',
      'q4',
      'okr',
    ],
  },
  {
    slug: 'slide-planner',
    modules: ['office_slide'],
    stages: ['slide_style', 'slide_outline', 'slide_page_spec', 'slide_edit', 'chat'],
    keywords: [
      'slide',
      'thuyet trinh',
      'trinh chieu',
      'deck',
      'powerpoint',
      'pptx',
      'trang bia',
      'bo cuc',
    ],
  },
  {
    slug: 'deep-research',
    modules: ['office_docx', 'office_pdf', 'office_markdown'],
    stages: ['doc_longform', 'chat'],
    keywords: [
      'nghien cuu',
      'luan van',
      'luan an',
      'de tai',
      'khoa hoc',
      'scopus',
      'isi',
      'apa',
      'ieee',
      'trich dan',
      'tong quan tai lieu',
      'literature review',
      'research',
      'paper',
      'pdf',
    ],
  },
  {
    slug: 'report-writer',
    modules: ['office_docx', 'office_markdown', 'office_html', 'office_pdf'],
    stages: ['doc_longform', 'chat'],
    keywords: [
      'bao cao',
      'tom tat',
      'de an',
      'ke hoach',
      'soan thao',
      'viet',
      'chinh sua',
      'report',
      'summary',
      'document',
    ],
  },
]

const MODULE_DEFAULT_SKILLS: Readonly<Record<string, readonly string[]>> = {
  office_docx: ['report-writer'],
  office_sheet: ['data-analyst', 'data-cleaning'],
  office_slide: ['slide-planner'],
  office_pdf: ['deep-research', 'report-writer'],
  office_markdown: ['report-writer'],
  office_html: ['report-writer'],
}

const STAGE_REQUIRED_SKILLS: Readonly<Record<string, readonly string[]>> = {
  doc_longform: ['pipeline-doc-writer'],
  slide_style: ['pipeline-slide-style'],
  slide_outline: ['pipeline-slide-outline'],
  slide_page_spec: ['pipeline-slide-page'],
  sheet_formula: ['data-analyst'],
}

/**
 * Normalizes Vietnamese text (strips diacritics, converts đ -> d, lowercases)
 * for fast and reliable semantic keyword matching across prompts and document headings.
 */
export function normalizeSkillMatchText(input: string): string {
  if (!input) return ''
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface ClassifySkillsInput {
  /** User's prompt or latest message text */
  prompt?: string
  /** System prompt or document context (title, headings, outline, active sheet summary) */
  system?: string
  /** Active editor module ('office_docx' | 'office_sheet' | 'office_slide' | 'office_pdf' | 'office_markdown' | 'office_html') */
  editorModule?: string
  /** Current pipeline stage ('chat' | 'doc_longform' | 'slide_style' | 'slide_outline' | 'slide_page_spec' | 'slide_edit' | 'sheet_formula') */
  pipelineStage?: string
  /** Optional dynamic catalog of Cloud Skills synced from server */
  availableSkills?: readonly {
    slug: string
    name?: string
    description?: string
    category?: string
  }[]
  /** Explicitly requested/pinned skill slugs to always preserve */
  manualSlugs?: readonly string[]
  /** Maximum number of auto-classified domain skills to attach per turn (default: 4) */
  maxAutoSkills?: number
}

/**
 * Classifies and selects the most relevant Cloud Skills for a single AI turn
 * based on the active editor module, pipeline stage, document context, and user prompt.
 */
export function classifySkillsForContext(input: ClassifySkillsInput): string[] {
  const maxAuto = input.maxAutoSkills ?? 4
  const normPrompt = normalizeSkillMatchText(input.prompt ?? '')
  // Keep only the first 4000 chars of system/document context so boilerplate tool docs don't dilute scoring
  const normSystem = normalizeSkillMatchText((input.system ?? '').slice(0, 4000))
  const moduleKey = input.editorModule ?? ''
  const stageKey = input.pipelineStage ?? 'chat'

  const result: string[] = []
  const addSlug = (slug: string) => {
    const clean = slug.trim()
    if (clean && !result.includes(clean)) {
      result.push(clean)
    }
  }

  // 1. Always preserve explicitly pinned/tagged skills (e.g. [LYCERO_CLOUD_SKILL:...])
  if (input.manualSlugs) {
    for (const slug of input.manualSlugs) {
      addSlug(slug)
    }
  }

  // 2. Include pipeline-stage-specific orchestrator skills
  const stageSkills = STAGE_REQUIRED_SKILLS[stageKey]
  if (stageSkills) {
    for (const slug of stageSkills) {
      addSlug(slug)
    }
  }

  // 3. Score domain skills against prompt (weight 3x), document context (weight 1x), and module affinity
  const scores = new Map<string, number>()

  for (const rule of CLASSIFICATION_RULES) {
    let score = 0
    const hasModuleAffinity = moduleKey ? rule.modules.includes(moduleKey) : false

    for (const kw of rule.keywords) {
      if (normPrompt.includes(kw)) {
        score += kw.includes(' ') ? 6 : 3
      } else if (normSystem.includes(kw)) {
        score += kw.includes(' ') ? 2 : 1
      }
    }

    if (score > 0 && hasModuleAffinity) {
      score += 4
    }
    if (score > 0 && rule.stages?.includes(stageKey)) {
      score += 2
    }

    if (score > 0) {
      scores.set(rule.slug, (scores.get(rule.slug) ?? 0) + score)
    }
  }

  // 4. Also score any custom/newly-added Cloud Skills from the server that aren't in static rules
  if (input.availableSkills) {
    for (const skill of input.availableSkills) {
      if (!skill.slug || scores.has(skill.slug)) continue
      const slugWords = normalizeSkillMatchText(skill.slug.replace(/-/g, ' '))
      const nameWords = normalizeSkillMatchText(skill.name ?? '')
      let dynamicScore = 0
      if (slugWords && normPrompt.includes(slugWords)) dynamicScore += 6
      if (nameWords && normPrompt.includes(nameWords)) dynamicScore += 6
      if (dynamicScore > 0) {
        scores.set(skill.slug, dynamicScore)
      }
    }
  }

  // Sort matched domain skills by descending score
  const rankedSlugs = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxAuto)
    .map(([slug]) => slug)

  for (const slug of rankedSlugs) {
    addSlug(slug)
  }

  // 5. Fallback to editor-module baseline skills if no specific keyword matched yet
  if (rankedSlugs.length === 0 && moduleKey && MODULE_DEFAULT_SKILLS[moduleKey]) {
    for (const fallbackSlug of MODULE_DEFAULT_SKILLS[moduleKey]!) {
      addSlug(fallbackSlug)
    }
  }

  return result
}
