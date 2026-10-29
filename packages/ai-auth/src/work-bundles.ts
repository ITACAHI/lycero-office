/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Work Bundles — taxonomy of common work contexts that the AI can pick tools
 * and skills from. Each bundle lists:
 *   - Required AI tools (registered in @lycero/agent-core)
 *   - Cloud skills (loaded from the Lycero Skills marketplace)
 *   - Terminology overrides (Vietnamese-first labels for UI / Mate copy)
 *   - Template defaults (which document templates to surface first)
 *
 * A user can enable multiple bundles at once (e.g. "accounting" + "freelance"
 * + "marketing" on the same machine). The intent router in
 * @lycero/agent-core picks the right tool/skill per prompt — the bundles
 * are just the user's enable/disable preferences.
 *
 * Single source of truth. When the upstream bundle registry changes
 * (cloud / Skills marketplace), update this file so the UI and Mate stay
 * in sync.
 */

/**
 * Tool descriptor stored inside a WorkBundle.
 * Must be JSON-schema-compatible so it can be passed directly to LLM function calling.
 */
export interface WorkBundleTool {
  name: string
  description: string
  /** JSON Schema (object) for the tool's input parameters */
  parameters: Record<string, unknown>
}

/**
 * Skill descriptor stored inside a WorkBundle.
 * The `content` field is a multi-line prompt injected into the system prompt.
 */
export interface WorkBundleSkill {
  name: string
  description: string
  /** Multi-line prompt content — concatenated into the agent's system prompt */
  content: string
}

export type WorkBundle = {
  /** numeric id; matches the backend `bundle_id` field on the user payload */
  id: number
  /** snake_case key; stable across renames */
  key: string
  /** Vietnamese label shown in the UI */
  labelVi: string
  /** short description for the bundle picker card */
  description: string
  /** Full tool descriptors (JSON-schema-compatible) */
  tools: readonly WorkBundleTool[]
  /** Full skill descriptors (prompt-injectable) */
  skills: readonly WorkBundleSkill[]
  /** default per-bundle config */
  defaultConfig?: Record<string, unknown>
  /**
   * If true, this bundle cannot be disabled by the user (always-on).
   * BundleStore.setEnabled() refuses to disable required bundles.
   */
  required?: boolean
  /**
   * Phase C.1 — custom intent keywords beyond labels/tools.
   * Extra Vietnamese keyword triggers for the intent router.
   * ponytail: small static keyword set — upgrade path: gsk token matcher.
   */
  intents?: readonly string[]
}

/** Ordered as they appear in the bundle picker. `id: 0` is the default. */
export const WORK_BUNDLES: readonly WorkBundle[] = [
  {
    id: 0,
    key: 'general_office',
    labelVi: 'Văn phòng tổng hợp (mặc định)',
    description: 'Công cụ cơ bản cho hợp đồng, báo cáo, biên bản, thuyết trình.',
    // required: true — cannot be disabled by the user (Phase B.3)
    required: true,
    tools: [
      {
        name: 'docs.format_vn_currency',
        description: 'Định dạng số tiền VNĐ chuẩn Việt Nam (1.234.567 đ)',
        parameters: { type: 'object', properties: { amount: { type: 'number', description: 'Số tiền cần định dạng' } }, required: ['amount'] }
      },
      {
        name: 'docs.insert_table',
        description: 'Chèn bảng biểu vào tài liệu với định dạng chuẩn',
        parameters: { type: 'object', properties: { rows: { type: 'number' }, cols: { type: 'number' } }, required: ['rows', 'cols'] }
      },
      {
        name: 'slides.theme_warm',
        description: 'Áp dụng theme màu ấm cho slide trình chiếu',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    ],
    skills: [],
    defaultConfig: {},
    intents: [],
  },
  {
    id: 1,
    key: 'accounting_vn',
    labelVi: 'Kế toán Việt Nam',
    description: 'VAS, MTT 200/201, TNCN, hóa đơn điện tử, sổ sách.',
    tools: [
      {
        name: 'sheets.vn_vat_lookup',
        description: 'Tra cứu thuế suất VAT theo mã hàng hóa Việt Nam',
        parameters: { type: 'object', properties: { ma_hh: { type: 'string', description: 'Mã hàng hóa theo danh mục Việt Nam' } }, required: ['ma_hh'] }
      },
      {
        name: 'sheets.tncn_calculate',
        description: 'Tính thuế thu nhập cá nhân theo biểu thuế lũy tiến từng phần VN',
        parameters: { type: 'object', properties: { thu_nhap_chiu_thue: { type: 'number' }, nguoi_phu_thuoc: { type: 'number', default: 0 } }, required: ['thu_nhap_chiu_thue'] }
      },
      {
        name: 'docs.format_vn_currency',
        description: 'Định dạng số tiền VNĐ chuẩn Việt Nam (1.234.567 đ)',
        parameters: { type: 'object', properties: { amount: { type: 'number', description: 'Số tiền cần định dạng' } }, required: ['amount'] }
      }
    ],
    skills: [
      {
        name: 'vn-tax-tt200',
        description: 'Quy tắc thuế GTGT theo Thông tư 200/2014/TT-BTC',
        content: 'Khi tính thuế GTGT, áp dụng phương pháp khấu trừ. Hàng hóa dịch vụ xuất khẩu được hưởng thuế suất 0%.'
      },
      {
        name: 'vn-mtt-201-balance',
        description: 'Hướng dẫn lập báo cáo tài chính theo MTT 200/201',
        content: 'Báo cáo tài chính theo MTT gồm: Bảng cân đối kế toán, Báo cáo kết quả hoạt động kinh doanh, Báo cáo lưu chuyển tiền tệ, Thuyết minh báo cáo tài chính.'
      }
    ],
    defaultConfig: { accounting_standard: 'vas_2015' },
    intents: [
      'bao cao tai chinh',
      'hoa don',
      'thue',
      'VAT',
      'doanh thu',
      'lo nhuan',
      'bang can doi ke toan',
      'mst',
      'ma so thue',
      'thue gia tri gia tang',
      'thue thu nhap ca nhan',
      'tncn',
      'gtgt',
      'ke toan',
      'so sach ke toan',
      'chung tu',
      'quyet toan',
      'thu chi',
      'tai chinh',
    ],
  },
  {
    id: 2,
    key: 'freelance_solo',
    labelVi: 'Freelance & Cá nhân',
    description: 'Hợp đồng freelance, hóa đơn dịch vụ, NDA, theo dõi công nợ.',
    tools: [
      {
        name: 'docs.freelance_contract',
        description: 'Tạo hợp đồng freelance chuẩn Việt Nam',
        parameters: { type: 'object', properties: { ten_du_an: { type: 'string' }, thoi_han: { type: 'string' }, thanh_toan: { type: 'string' } }, required: ['ten_du_an'] }
      },
      {
        name: 'docs.nda_template',
        description: 'Mẫu thỏa thuận bảo mật (NDA) hai chiều',
        parameters: { type: 'object', properties: { ben_a: { type: 'string' }, ben_b: { type: 'string' } }, required: ['ben_a', 'ben_b'] }
      },
      {
        name: 'sheets.invoice_tracker',
        description: 'Bảng theo dõi công nợ và hóa đơn cho freelancer',
        parameters: { type: 'object', properties: { ten_khach_hang: { type: 'string' } }, required: [] }
      }
    ],
    skills: [
      {
        name: 'freelance-invoice-vn',
        description: 'Mẫu hóa đơn dịch vụ tự xuất cho cá nhân/freelancer',
        content: 'Hóa đơn tự xuất: ghi rõ họ tên, MST (nếu có), địa chỉ, nội dung dịch vụ, số tiền, thuế suất 10% nếu có, ký và đóng dấu.'
      }
    ],
    defaultConfig: { currency: 'VND', tax_rate: 10 },
    intents: [
      'hop dong freelance',
      'hop dong tu do',
      'hop dong dich vu',
      'hoa don freelance',
      'hoa don tu xuat',
      'NDA',
      'thoa thuan bao mat',
      'bao mat',
      'thanh toan',
      'cong no',
      'freelance',
      'freelancer',
      'ca nhan kinh doanh',
      'dich vu',
      'nhan vien',
      'bien ban',
      'dieu khoan',
    ],
  },
  {
    id: 3,
    key: 'small_business',
    labelVi: 'Doanh nghiệp nhỏ & SMB',
    description: 'Báo cáo tài chính, dòng tiền, KPI/OKR, quyết toán cuối năm.',
    tools: [
      {
        name: 'sheets.cashflow',
        description: 'Bảng dòng tiền theo phương pháp gián tiếp',
        parameters: { type: 'object', properties: { quy: { type: 'string', description: 'Quý báo cáo (Q1/Q2/Q3/Q4)' } }, required: ['quy'] }
      },
      {
        name: 'sheets.pnl',
        description: 'Báo cáo kết quả kinh doanh (P&L)',
        parameters: { type: 'object', properties: { thoi_gian: { type: 'string' } }, required: [] }
      },
      {
        name: 'sheets.kpi_tracker',
        description: 'Theo dõi KPI/OKR theo tháng/quý',
        parameters: { type: 'object', properties: { ky: { type: 'string' }, muc_tieu: { type: 'string' } }, required: ['ky'] }
      },
      {
        name: 'docs.report_template',
        description: 'Mẫu báo cáo tháng/quý chuẩn SMB',
        parameters: { type: 'object', properties: { loai_bao_cao: { type: 'string', enum: ['thang', 'quy', 'nam'] } }, required: ['loai_bao_cao'] }
      }
    ],
    skills: [
      {
        name: 'smb-quarterly-report',
        description: 'Cấu trúc báo cáo quý cho doanh nghiệp nhỏ',
        content: 'Báo cáo quý gồm: Tóm tắt điều hành, Kết quả kinh doanh, Dòng tiền, Chỉ số tài chính chính, Kế hoạch quý tới.'
      }
    ],
    defaultConfig: { fiscal_year_start: '01-01' },
  },
  {
    id: 4,
    key: 'marketing_seo',
    labelVi: 'Marketing & Nội dung',
    description: 'SEO, copywriting, content calendar, social media scripts.',
    tools: [
      {
        name: 'docs.seo_brief',
        description: 'Viết SEO brief cho bài viết website',
        parameters: { type: 'object', properties: { chu_de: { type: 'string' }, tu_khoa: { type: 'string' } }, required: ['chu_de'] }
      },
      {
        name: 'docs.copy_review',
        description: 'Rà soát và cải thiện copy marketing',
        parameters: { type: 'object', properties: { text: { type: 'string' }, muc_tieu: { type: 'string' } }, required: ['text'] }
      },
      {
        name: 'sheets.content_calendar',
        description: 'Lịch content calendar theo tuần/tháng',
        parameters: { type: 'object', properties: { so_tuan: { type: 'number', default: 4 } }, required: [] }
      }
    ],
    skills: [
      {
        name: 'seo-content-outline',
        description: 'Tạo outline bài viết chuẩn SEO',
        content: 'Outline SEO gồm: Mở bài (含 keyword), các heading H2/H3, bullet points, kết bài với CTA. Đảm bảo keyword ở title, meta, H1, H2 đầu tiên.'
      },
      {
        name: 'vn-marketing-tone',
        description: 'Giọng văn marketing phù hợp thị trường Việt Nam',
        content: 'Copy Việt Nam: thân thiện, gần gũi, dùng "bạn" thay vì formal. Tránh direct translation từ tiếng Anh. Dùng câu ngắn, action verb mạnh.'
      }
    ],
    defaultConfig: { tone: 'friendly_vn', primary_platform: 'facebook' },
  },
  {
    id: 5,
    key: 'developer',
    labelVi: 'Lập trình viên',
    description: 'Tạo README, API docs, code review, refactor proposals, regex.',
    tools: [
      {
        name: 'docs.readme_gen',
        description: 'Tạo README.md chuẩn cho dự án GitHub',
        parameters: { type: 'object', properties: { ten_du_an: { type: 'string' }, ngon_ngu: { type: 'string', default: 'TypeScript' } }, required: ['ten_du_an'] }
      },
      {
        name: 'docs.api_doc',
        description: 'Viết tài liệu API theo OpenAPI/Swagger',
        parameters: { type: 'object', properties: { endpoints: { type: 'array' }, base_url: { type: 'string' } }, required: ['endpoints'] }
      },
      {
        name: 'markdown.mermaid_diagram',
        description: 'Tạo sơ đồ Mermaid cho tài liệu kỹ thuật',
        parameters: { type: 'object', properties: { loai: { type: 'string', enum: ['flowchart', 'sequence', 'class', 'er'] }, noi_dung: { type: 'string' } }, required: ['loai', 'noi_dung'] }
      }
    ],
    skills: [
      {
        name: 'code-review-vi',
        description: 'Checklist code review chuẩn',
        content: 'Code review checklist: 1) Logic đúng chưa? 2) Edge cases xử lý chưa? 3) Security: injection, auth bypass? 4) Performance: N+1, memory leak? 5) Clean code: DRY, meaningful names?'
      }
    ],
    defaultConfig: { default_language: 'TypeScript', indent: 'spaces_2' },
  },
  {
    id: 6,
    key: 'legal_contract',
    labelVi: 'Pháp lý & Hợp đồng',
    description: 'Hợp đồng dân sự, thương mại, lao động, NDA, điều khoản.',
    tools: [
      {
        name: 'docs.contract_template',
        description: 'Mẫu hợp đồng dân sự/thương mại',
        parameters: { type: 'object', properties: { loai: { type: 'string', enum: ['dansu', 'thuongmai', 'laodong'] } }, required: ['loai'] }
      },
      {
        name: 'docs.clause_compare',
        description: 'So sánh điều khoản giữa 2 văn bản pháp lý',
        parameters: { type: 'object', properties: { van_ban_1: { type: 'string' }, van_ban_2: { type: 'string' } }, required: ['van_ban_1', 'van_ban_2'] }
      },
      {
        name: 'docs.legal_terms',
        description: 'Tra cứu thuật ngữ pháp lý Việt Nam - Anh',
        parameters: { type: 'object', properties: { tu_khoa: { type: 'string' } }, required: ['tu_khoa'] }
      }
    ],
    skills: [
      {
        name: 'vn-civil-code-2015',
        description: 'Nguyên tắc pháp luật dân sự Việt Nam 2015',
        content: 'Bộ luật Dân sự 2015: quyền và nghĩa vụ dân sự, giao dịch dân sự, hợp đồng, trách nhiệm dân sự. Hợp đồng có hiệu lực khi đủ điều kiện: chủ thể có năng lực, mục đích hợp pháp, không vi phạm điều cấm.'
      },
      {
        name: 'vn-labor-code-2019',
        description: 'Luật Lao động Việt Nam 2019',
        content: 'Luật Lao động 2019: HĐLĐ phải ghi rõ công việc, địa điểm, thời giờ làm việc, lương, thời hạn. Thử việc tối đa 180 ngày. Nghỉ phép năm: 12-16 ngày tùy thâm niên.'
      }
    ],
    defaultConfig: { legal_system: 'vn_2019', contract_lang: 'vi' },
  },
  {
    id: 7,
    key: 'real_estate',
    labelVi: 'Bất động sản',
    description: 'Hợp đồng đặt cọc, môi giới, thẩm định, báo giá đất.',
    tools: [
      {
        name: 'docs.deposit_contract',
        description: 'Hợp đồng đặt cọc mua bán BĐS',
        parameters: { type: 'object', properties: { ten_tai_san: { type: 'string' }, gia_ban: { type: 'number' }, tien_dat_coc: { type: 'number' } }, required: ['ten_tai_san', 'gia_ban', 'tien_dat_coc'] }
      },
      {
        name: 'docs.broker_agreement',
        description: 'Hợp đồng môi giới BĐS',
        parameters: { type: 'object', properties: { ty_le_hoa_hong: { type: 'number' }, thoi_han: { type: 'string' } }, required: ['ty_le_hoa_hong'] }
      },
      {
        name: 'sheets.property_compare',
        description: 'Bảng so sánh bất động sản',
        parameters: { type: 'object', properties: { so_lua_chon: { type: 'number', default: 3 } }, required: [] }
      }
    ],
    skills: [
      {
        name: 'vn-land-law-2024',
        description: 'Luật Đất đai 2024 và các văn bản hướng dẫn',
        content: 'Luật Đất đai 2024: quyền sử dụng đất, chuyển nhượng, thuê, thế chấp. Lưu ý: đất nông nghiệp không được chuyển thành đất ở nếu không đủ điều kiện. Hạn mức nhận chuyển nhượng: 10ha tỉnh, 30ha thành phố.'
      }
    ],
    defaultConfig: { region: 'south', property_type: 'residential' },
  },
  {
    id: 8,
    key: 'k12_teacher',
    labelVi: 'Giáo viên K-12',
    description: 'Kế hoạch bài dạy 5512, đề kiểm tra Bloom, sổ chủ nhiệm.',
    tools: [
      {
        name: 'docs.khbd_5512',
        description: 'Tạo kế hoạch bài dạy theo Thông tư 5512/2020',
        parameters: { type: 'object', properties: { mon: { type: 'string' }, lop: { type: 'string' }, bai: { type: 'string' } }, required: ['mon', 'lop', 'bai'] }
      },
      {
        name: 'docs.bloom_test',
        description: 'Tạo đề kiểm tra theo thang Bloom (NHẬN BIẾT, THÔNG HIỂU, VẬN DỤNG, PHÂN TÍCH, ĐÁNH GIÁ, SÁNG TẠO)',
        parameters: { type: 'object', properties: { mon: { type: 'string' }, so_cau: { type: 'number', default: 10 } }, required: ['mon'] }
      },
      {
        name: 'sheets.student_gradebook',
        description: 'Bảng điểm học sinh theo học kỳ',
        parameters: { type: 'object', properties: { lop: { type: 'string' }, so_hs: { type: 'number' } }, required: ['lop'] }
      }
    ],
    skills: [
      {
        name: 'cv-5512-template',
        description: 'Mẫu kế hoạch bài dạy chuẩn 5512',
        content: 'Cấu trúc KHBD 5512: I. Mục tiêu (chung + về PC&NL), II. Thiết bị dạy học, III. Chuẩn bị của GV&HS, IV. Tiến trình dạy học (hoạt động khởi động, hình thành kiến thức, luyện tập, vận dụng, tìm tòi mở rộng), V. Điều chỉnh sau giảng.'
      },
      {
        name: 'bloom-taxonomy-vi',
        description: 'Thang tư duy Bloom phiên bản tiếng Việt',
        content: '6 mức Bloom: 1. NHẬN BIẾT - nhớ lại, 2. THÔNG HIỂU - giải thích, 3. VẬN DỤNG - sử dụng quy tắc, 4. PHÂN TÍCH - phân rã, 5. ĐÁNH GIÁ - phán đoán, 6. SÁNG TẠO - thiết kế mới.'
      }
    ],
    defaultConfig: { grade_level: 'thcs', curriculum: '2018' },
  },
  {
    id: 9,
    key: 'higher_ed',
    labelVi: 'Giảng viên Đại học / CĐ',
    description: 'Đề cương học phần, rubric, CLO/PLO, chuyên đề NCKH.',
    tools: [
      {
        name: 'docs.syllabus',
        description: 'Tạo đề cương chi tiết học phần chuẩn',
        parameters: { type: 'object', properties: { ten_hp: { type: 'string' }, so_tin_chi: { type: 'number' } }, required: ['ten_hp', 'so_tin_chi'] }
      },
      {
        name: 'docs.clo_plo',
        description: 'Thiết kế CLO (Chuẩn đầu ra học phần) và PLO (Chuẩn đầu ra chương trình)',
        parameters: { type: 'object', properties: { loai: { type: 'string', enum: ['CLO', 'PLO'] }, so_chuan: { type: 'number' } }, required: ['loai', 'so_chuan'] }
      },
      {
        name: 'docs.rubric',
        description: 'Tạo rubric đánh giá kết quả học tập',
        parameters: { type: 'object', properties: { tieu_chi: { type: 'array' }, muc_xiu: { type: 'number', default: 2 } }, required: ['tieu_chi'] }
      }
    ],
    skills: [
      {
        name: 'higher-ed-syllabus-vi',
        description: 'Cấu trúc đề cương học phần đại học chuẩn Việt Nam',
        content: 'Đề cương HP gồm: Thông tin chung, Mục tiêu (PLO mapping), Chuẩn đầu ra (CLO), Nội dung (phân bổ tuần), Phương pháp giảng dạy, Đánh giá (rubric), Tài liệu. Theo thông tư sửa đổi về chuẩn đầu ra.'
      }
    ],
    defaultConfig: { university_type: 'dhcn', credit_system: '3' },
  },
]

/** Lookup by id. Falls back to the default (id 0) when not found. */
export function findWorkBundle(id: number | undefined): WorkBundle {
  if (typeof id !== 'number') return WORK_BUNDLES[0]!
  return WORK_BUNDLES.find((b) => b.id === id) ?? WORK_BUNDLES[0]!
}

/** Lookup by snake_case key. Falls back to the default when not found. */
export function findWorkBundleByKey(key: string | undefined): WorkBundle {
  if (!key) return WORK_BUNDLES[0]!
  return WORK_BUNDLES.find((b) => b.key === key) ?? WORK_BUNDLES[0]!
}

/** Back-compat alias for code that still references the old name. */
export const ARCHETYPES = WORK_BUNDLES
export const findArchetype = findWorkBundle
export const findArchetypeByKey = findWorkBundleByKey
export type Archetype = WorkBundle
