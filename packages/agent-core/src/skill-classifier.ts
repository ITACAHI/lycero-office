/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import type { CloudSkillManifest } from './cloud-capabilities'

/**
 * Out-of-scope skills (FX-26) and merged duplicate slugs (FX-24, FX-25).
 */
export const HIDDEN_OR_MERGED_SKILL_SLUGS: ReadonlySet<string> = new Set([
  "tu-vi-dau-so",
  "ponytail",
  "hallmark",
  "taste-skill",
  "image-to-code",
  "open-code-review",
  "vn-admin-nd30",
  "edtech-lesson-5512",
  "vn-edtech-lesson-5512",
  "edtech-exam-matrix",
  "vn-periodic-exam-7991-true-false-short-answer",
  "vn-tax-accounting-tt200",
  "vn-hr-compensation-law",
  "product-launch-gtm-playbook",
  "performance-appraisal-360-pip",
  "legal-contract-redline-playbook",
  "healthcare-clinical-soap-case-note"
])

/**
 * Narrow vertical skills (Clinical SOAP & Pharma GMP/ACTD) that only activate on explicit domain queries (FX-26).
 */
export const NARROW_VERTICAL_SKILL_SLUGS: ReadonlySet<string> = new Set([
  'clinical-protocol-soap-medical-record',
  'pharma-gmp-regulatory-drug-dossier',
])

/**
 * Basic & tool skills (42 basic skills from v2.0.18 + 9 lycero-* tool skills + lycero-office)
 * that are bundled locally in `resources/cli/skills/recommended` and work 100% offline (FX-30, FX-43).
 */
export const BASIC_BUNDLED_SKILL_SLUGS: ReadonlySet<string> = new Set([
  'brand-copy',
  'budget-planner',
  'business-plan',
  'business-report',
  'campaign-planner',
  'contract-drafter',
  'course-slides',
  'data-analyst',
  'data-cleaning',
  'deep-research',
  'email-drafter',
  'executive-deck',
  'expense-report',
  'financial-statement-analysis',
  'interview-coach',
  'invoice-tax-checklist',
  'job-description',
  'kpi-dashboard',
  'labor-contract',
  'lesson-plan',
  'meeting-minutes',
  'nda-drafter',
  'okr-planner',
  'onboarding-plan',
  'performance-review',
  'personal-finance',
  'policy-compliance',
  'product-launch',
  'proposal-writer',
  'quiz-maker',
  'resume-polisher',
  'sales-forecast',
  'seo-content',
  'slide-planner',
  'social-media',
  'sop-writer',
  'study-plan',
  'survey-analyst',
  'swot-strategy',
  'terms-of-service',
  'thesis-advisor',
  'weekly-report',
  'lycero-docs',
  'lycero-form-architect',
  'lycero-html',
  'lycero-markdown',
  'lycero-office',
  'lycero-pdf',
  'lycero-sheets',
  'lycero-slides',
  'lycero-visual-director',
])

/**
 * 155 Advanced Cloud Skills that must NEVER be bundled in the client installer or written to local disk (FX-43).
 * Client only keeps `{ slug, name, description, category, version }` metadata in memory.
 */
export const ADVANCED_CLOUD_SKILL_SLUGS: ReadonlySet<string> = new Set([
  'ab-testing-experimentation-framework',
  'academic-paper-ieee-apa-latex',
  'agile-sprint-retrospective-scrum',
  'annual-report-esg-sustainability',
  'b2b-cold-outreach-sequence',
  'bilingual-contract-translation-legal-plain',
  'brand-positioning-messaging-house',
  'business-continuity-disaster-recovery',
  'business-model-lean-canvas-architect',
  'cap-table-dilution-waterfall',
  'cfo-financial-modeling-dcf',
  'channel-partner-reseller-program',
  'cim-confidential-info-memorandum',
  'clinical-protocol-soap-medical-record',
  'cognitive-load-worked-example-fading',
  'commercial-arbitration-viac-icc-brief',
  'commercial-banking-alm-basel-iii',
  'commercial-lease-real-estate-contract',
  'comparable-company-analysis-comps',
  'competency-framework-career-ladder',
  'competitive-intelligence-porter-5-forces',
  'construction-boq-fidic-dossier',
  'contract-ambiguity-crossref-auditor',
  'conversion-copywriting-landing-page',
  'corporate-governance-charter-resolution',
  'corporate-training-curriculum-ld',
  'cost-accounting-abc-standard-costing',
  'credit-underwriting-debt-covenants',
  'crisis-escalation-apology-comms',
  'criterion-rubric-tilt-assignment',
  'cross-examination-hearing-rehearsal',
  'customer-health-score-churn-playbooks',
  'cybersecurity-iso27001-soc2-incident',
  'dashi-12-editorial-slide-themes',
  'data-privacy-dpa-nd13',
  'demand-letter-cease-desist-escalation',
  'edtech-exam-matrix',
  'edtech-lesson-5512',
  'email-lifecycle-drip-automation',
  'employee-engagement-pulse-survey',
  'employee-handbook-code-of-conduct',
  'employment-dispute-disciplinary',
  'enterprise-onboarding-implementation-plan',
  'enterprise-sop-rfp-operations',
  'excel-executive-dashboard-architect',
  'executive-bi-data-storytelling',
  'executive-board-memo-mckinsey',
  'experiential-career-guidance-hdtn',
  'forensic-accounting-fraud-examination',
  'hallmark',
  'healthcare-clinical-soap-case-note',
  'hospitality-hotel-revpar-yield-management',
  'hr-payroll-3p',
  'image-to-code',
  'inclusive-education-udl-iep-plan',
  'influencer-kol-koc-affiliate-campaign',
  'insurance-actuarial-underwriting-claims',
  'internal-audit-sox-controls',
  'international-logistics-incoterms-customs',
  'ip-licensing-technology-transfer',
  'jobs-to-be-done-user-research',
  'judge-arbitrator-bench-perspective',
  'knowledge-space-adaptive-learning-graph',
  'lbo-leveraged-buyout-model',
  'lean-six-sigma-dmaic-kaizen',
  'legal-contract-redline-playbook',
  'legal-reasoning-irac-crac-memorandum',
  'lesson-study-teacher-coaching-ngcbh',
  'litigation-opposing-counsel-simulator',
  'litigation-settlement-ev-decision-tree',
  'ma-legal-due-diligence-red-flag',
  'manufacturing-oee-tpm-production-plan',
  'mckinsey-22-chart-exhibit-selector',
  'meddpicc-enterprise-deal-qualification',
  'merger-accretion-dilution-ma',
  'morph-cinematic-slide-choreography',
  'open-code-review',
  'org-design-headcount-planning',
  'paid-media-roas-attribution',
  'performance-appraisal-360-pip',
  'pharma-gmp-regulatory-drug-dossier',
  'pipeline-doc-writer',
  'pipeline-slide-outline',
  'pipeline-slide-page-spec',
  'pipeline-slide-style',
  'pmp-project-charter-wbs-risk-register',
  'ponytail',
  'postmortem-rca-sre-runbook',
  'pricing-packaging-monetization',
  'prisma-systematic-literature-review',
  'product-launch-gtm-playbook',
  'product-roadmap-now-next-later',
  'product-strategy-prd-okr',
  'programmatic-seo-pillar-cluster',
  'psychometric-item-analysis-exam-audit',
  'quality-management-iso9001-capa',
  'report-writer',
  'research-grant-proposal-nafo-ministry',
  'retail-merchandising-category-otb-plan',
  'rubric-builder',
  'saas-arr-cohort-waterfall',
  'saas-msa-sla-negotiation',
  'sales-commission-quota-comp-plan',
  'sales-objection-battlecard',
  'shareholder-agreement-sha-term-sheet',
  'socratic-feynman-active-tutoring',
  'spaced-repetition-retrieval-flashcards',
  'sql-data-warehouse-etl-modeling',
  'strategic-account-expansion-qbr',
  'strategic-sourcing-tco-negotiation',
  'structured-interview-scorecard',
  'supply-chain-inventory-eoq-safety-stock',
  'system-architecture-rfc-adr',
  'taste-skill',
  'tu-vi-dau-so',
  'ubd-backwards-curriculum-designer',
  'university-syllabus-obe-aun-qa',
  'variance-analysis-budget-vs-actual',
  'vc-pitch-deck-architect',
  'vn-accounting-payment-voucher-forms-tt200',
  'vn-admin-doc-nd30',
  'vn-admin-nd30',
  'vn-administrative-complaint-denunciation',
  'vn-bi-cohort-analytics',
  'vn-bidding-dossier-pro',
  'vn-citizen-residence-ct01-household-forms',
  'vn-construction-site-acceptance-forms-nd06',
  'vn-corporate-accounting-tt200-tt133',
  'vn-court-petition-civil-litigation',
  'vn-edtech-lesson-5512',
  'vn-enterprise-licensing-investment-irc-erc',
  'vn-exam-matrix-specification-tt22',
  'vn-gdpt2018-lesson-plan-cv5512',
  'vn-gtm-growth-strategy',
  'vn-homeroom-teacher-student-evaluation',
  'vn-hr-recruitment-handover-admin-forms',
  'vn-import-export-commercial-invoice-customs-forms',
  'vn-intellectual-property-trademark-patent',
  'vn-land-real-estate-legal-dossier',
  'vn-land-registration-redbook-04dk-11dk',
  'vn-legal-contract-audit',
  'vn-legislative-normative-drafting',
  'vn-notary-inheritance-matrimonial-law',
  'vn-olympiad-gifted-student-coaching',
  'vn-periodic-exam-7991-true-false-short-answer',
  'vn-primary-school-lesson-plan-cv2345',
  'vn-real-estate-sale-transfer-contract-nd96',
  'vn-sang-kien-kinh-nghiem-skkn',
  'vn-school-principal-annual-plan-qa',
  'vn-stem-steam-5e-lesson-architect',
  'vn-tax-accounting-tt200',
  'vn-tax-declaration-refund-exemption-tt80',
  'vn-tax-inspection-explanation-appeal',
  'vn-transfer-pricing-giao-dich-lien-ket',
  'working-capital-cash-conversion',
])

export function isBasicBundledSkill(slug: string): boolean {
  return BASIC_BUNDLED_SKILL_SLUGS.has((slug || '').trim().toLowerCase())
}

export function isAdvancedCloudSkill(slug: string): boolean {
  const clean = (slug || '').trim().toLowerCase()
  return ADVANCED_CLOUD_SKILL_SLUGS.has(clean)
}

/**
 * Canonical skill slug alias map (FX-24, FX-25).
 */
export const SKILL_SLUG_ALIAS_MAP: Readonly<Record<string, string>> = {
  "vn-admin-nd30": "vn-admin-doc-nd30",
  "vn-admin-doc-nd30": "vn-admin-doc-nd30",
  "general_office": "vn-admin-doc-nd30",
  "edtech-lesson-5512": "vn-gdpt2018-lesson-plan-cv5512",
  "vn-edtech-lesson-5512": "vn-gdpt2018-lesson-plan-cv5512",
  "vn-lesson-plan-5512": "vn-gdpt2018-lesson-plan-cv5512",
  "vn-gdpt2018-lesson-plan-cv5512": "vn-gdpt2018-lesson-plan-cv5512",
  "k12_teacher": "vn-gdpt2018-lesson-plan-cv5512",
  "cv-5512-template": "vn-gdpt2018-lesson-plan-cv5512",
  "edtech-lesson-2345": "vn-primary-school-lesson-plan-cv2345",
  "vn-primary-school-lesson-plan-cv2345": "vn-primary-school-lesson-plan-cv2345",
  "lesson-plan": "lesson-plan",
  "edtech-exam-matrix": "vn-exam-matrix-specification-tt22",
  "vn-periodic-exam-7991-true-false-short-answer": "vn-exam-matrix-specification-tt22",
  "vn-exam-matrix-specification-tt22": "vn-exam-matrix-specification-tt22",
  "bloom-taxonomy-vi": "vn-exam-matrix-specification-tt22",
  "exam-7991": "vn-exam-matrix-specification-tt22",
  "vn-tax-accounting-tt200": "vn-corporate-accounting-tt200-tt133",
  "vn-corporate-accounting-tt200-tt133": "vn-corporate-accounting-tt200-tt133",
  "vn-corporate-accounting-tt99-tt133": "vn-corporate-accounting-tt200-tt133",
  "vn-accounting-tt99": "vn-corporate-accounting-tt200-tt133",
  "tt99-2025": "vn-corporate-accounting-tt200-tt133",
  "accounting_vn": "vn-corporate-accounting-tt200-tt133",
  "vn-tax-tt200": "vn-corporate-accounting-tt200-tt133",
  "vn-mtt-201-balance": "vn-corporate-accounting-tt200-tt133",
  "vn-accounting-payment-voucher-forms-tt200": "vn-accounting-payment-voucher-forms-tt200",
  "vn-hr-compensation-law": "hr-payroll-3p",
  "hr-payroll-3p": "hr-payroll-3p",
  "hr_3p_kpi": "hr-payroll-3p",
  "product-launch-gtm-playbook": "product-launch",
  "product-launch": "product-launch",
  "performance-appraisal-360-pip": "performance-review",
  "performance-review": "performance-review",
  "legal-contract-redline-playbook": "vn-legal-contract-audit",
  "vn-legal-contract-audit": "vn-legal-contract-audit",
  "vn-commercial-contract-review": "vn-legal-contract-audit",
  "contract-drafter": "contract-drafter",
  "pipeline-doc-writer": "pipeline-doc-writer",
  "pipeline-doc-section-writer": "pipeline-doc-writer",
  "pipeline-doc-write": "pipeline-doc-writer",
  "pipeline-doc-structure": "pipeline-doc-writer",
  "pipeline-slide-page": "pipeline-slide-page-spec",
  "pipeline-slide-page-spec": "pipeline-slide-page-spec",
  "pipeline-slide-style": "pipeline-slide-style",
  "pipeline-slide-outline": "pipeline-slide-outline",
  "pipeline-sheet-plan": "lycero-sheets",
  "pipeline-sheet-planner": "lycero-sheets",
  "report-writer": "report-writer",
  "rubric-builder": "rubric-builder",
  "competency-rubric-assessment-designer": "rubric-builder",
  "freelance_solo": "vn-legal-contract-audit",
  "freelance-invoice-vn": "vn-accounting-payment-voucher-forms-tt200",
  "small_business": "fpa-budget-variance-forecasting",
  "smb-quarterly-report": "fpa-budget-variance-forecasting",
  "marketing_seo": "seo-content-cluster-b2b-inbound",
  "seo-content-outline": "seo-content-cluster-b2b-inbound",
  "vn-marketing-tone": "vn-gtm-growth-strategy",
  "legal_contract": "vn-legal-contract-audit",
  "vn-civil-code-2015": "vn-legal-contract-audit",
  "vn-labor-code-2019": "vn-labor-contract-collective-agreement",
  "real_estate": "vn-real-estate-land-law-2024",
  "vn-land-law-2024": "vn-real-estate-land-law-2024",
  "higher_ed": "university-syllabus-obe-cdio",
  "higher-ed-syllabus-vi": "university-syllabus-obe-cdio",
  "docs-skill": "lycero-docs",
  "sheets-skill": "lycero-sheets",
  "slides-skill": "lycero-slides",
  "pdf-skill": "lycero-pdf",
  "markdown-skill": "lycero-markdown",
  "html-skill": "lycero-html",
  "healthcare-clinical-soap-case-note": "clinical-protocol-soap-medical-record"
}

export function resolveCanonicalSkillSlug(slug: string): string {
  const clean = (slug || '').trim().toLowerCase()
  return SKILL_SLUG_ALIAS_MAP[clean] ?? clean
}

/**
 * FX-82: Short display titles for merged skills so the skill picker can show
 * `"Đã gộp vào: Ma trận & đặc tả đề (TT22)"` when the user searches by a merged slug or alias (e.g. `"7991"` or `"vn-periodic"`).
 */
export const MERGED_SKILL_DISPLAY_TITLES: Readonly<Record<string, string>> = {
  'vn-exam-matrix-specification-tt22': 'Ma trận & đặc tả đề (TT22)',
  'vn-gdpt2018-lesson-plan-cv5512': 'Kế hoạch bài dạy GDPT 2018 (CV 5512)',
  'vn-admin-doc-nd30': 'Thể thức văn bản hành chính (NĐ30/2020)',
  'vn-corporate-accounting-tt200-tt133': 'Kế toán doanh nghiệp (TT200 / TT99)',
  'vn-legal-contract-audit': 'Thẩm định & rà soát hợp đồng',
}

export function getMergedSkillRedirectNotice(
  skillName: string,
  aliases: readonly string[] | undefined,
  query: string,
  fallbackTitle?: string,
): string | null {
  const q = (query || '').trim().toLowerCase()
  if (!q) return null
  const cleanName = (skillName || '').trim().toLowerCase()
  if (cleanName.includes(q)) return null
  const matchedAlias = (aliases ?? []).some(
    (alias) => alias.toLowerCase() !== cleanName && alias.toLowerCase().includes(q),
  )
  if (!matchedAlias) return null
  const targetLabel =
    MERGED_SKILL_DISPLAY_TITLES[cleanName] ?? fallbackTitle ?? skillName
  return `Đã gộp vào: ${targetLabel}`
}

/**
 * Built-in catalog of all active canonical Cloud Skills (190 active skills from the 206 registry)
 * mirrored from Lycero Hub so all skills are immediately available and classifiable offline and online.
 */
export const DEFAULT_CLOUD_SKILL_CATALOG: readonly CloudSkillManifest[] = [
  {
    "slug": "brand-copy",
    "name": "Sáng tạo Nội dung Thương hiệu",
    "description": "Chuyển thông tin sản phẩm và tệp khách hàng thành nhiều phiên bản slogan, điểm bán hàng (USP) và câu chuyện thương hiệu, xuất ra Markdown.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "budget-planner",
    "name": "Lập Kế hoạch Ngân sách",
    "description": "Chuyển kế hoạch kinh doanh thành bảng ngân sách năm hoặc dự án gồm các khoản mục, phân bổ theo tháng, tổng hợp và trang giả định riêng, xuất ra bảng tính Excel.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "business-plan",
    "name": "Lập Kế hoạch Kinh doanh",
    "description": "Phát triển ý tưởng dự án thành bản kế hoạch kinh doanh hoàn chỉnh gồm thị trường, sản phẩm, mô hình, đối thủ, dự phóng tài chính và đội ngũ, xuất ra tài liệu Word.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "business-report",
    "name": "Viết Báo cáo Kinh doanh",
    "description": "Soạn báo cáo phân tích kinh doanh chuẩn cấu trúc (tóm tắt điều hành, bối cảnh, phân tích, khuyến nghị, phụ lục) với số liệu có dẫn nguồn, xuất ra tài liệu Word.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "campaign-planner",
    "name": "Hoạch định Chiến dịch Marketing",
    "description": "Chuyển mục tiêu và ngân sách thành kế hoạch chiến dịch toàn diện gồm kịch bản triển khai, ấn phẩm, ngân sách, KPI và mẫu nghiệm thu, xuất ra tài liệu Word.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "contract-drafter",
    "name": "Soạn thảo Hợp đồng Kinh tế & Thương mại",
    "description": "Soạn thảo hợp đồng kinh tế, thương mại hoặc thỏa thuận hợp tác chuẩn Bộ luật Dân sự 2015 và Luật Thương mại 2005 (phần rà soát & sửa đổi điều khoản hợp đồng tách sang vn-legal-contract-audit), xuất ra tài liệu Word.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "course-slides",
    "name": "Thiết kế Bài giảng Trình chiếu",
    "description": "Chuyển giáo án hoặc tài liệu học tập thành đề cương slide, sau đó dựng bộ bài giảng hoàn chỉnh kèm kịch bản thuyết giảng trong phần ghi chú, xuất ra PowerPoint.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "data-analyst",
    "name": "Phân tích Dữ liệu & Biểu đồ",
    "description": "Xử lý dữ liệu thô qua các bước làm sạch, lập công thức, vẽ biểu đồ và rút ra kết luận trực quan dễ hiểu, xuất ra bảng tính Excel.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "data-cleaning",
    "name": "Làm sạch & Chuẩn hóa Dữ liệu",
    "description": "Xác định quy tắc làm sạch, khử trùng lặp và chuẩn hóa dữ liệu lộn xộn thành bảng chuẩn kèm nhật ký xử lý từng dòng, xuất ra bảng tính Excel.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "deep-research",
    "name": "Nghiên cứu Chuyên sâu Đa nguồn",
    "description": "Thực hiện tra cứu nhiều vòng, đối chiếu chéo dữ liệu và tổng hợp thành báo cáo nghiên cứu có trích dẫn nguồn đầy đủ, xuất ra tài liệu Word.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "email-drafter",
    "name": "Soạn thảo Email Doanh nghiệp",
    "description": "Soạn email công việc và chuỗi email chăm sóc/nhắc việc theo nhiều giọng điệu từ mục đích, người nhận và ngữ cảnh (đa ngôn ngữ Việt - Anh), xuất ra Markdown.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "executive-deck",
    "name": "Trình chiếu Báo cáo Điều hành",
    "description": "Xây dựng bài trình chiếu báo cáo lãnh đạo theo cấu trúc kim tự tháp (mỗi tiêu đề slide nêu bật một kết luận cốt lõi), xuất ra PowerPoint.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "expense-report",
    "name": "Tổng hợp & Đối soát Chi phí",
    "description": "Chuyển danh sách hóa đơn/chứng từ thành bảng kê thanh toán chi phí, tự động cảnh báo thiếu chứng từ, vượt định mức hoặc trùng lặp, xuất ra bảng tính Excel.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "financial-statement-analysis",
    "name": "Phân tích Báo cáo Tài chính",
    "description": "Phân tích bộ 3 báo cáo tài chính về khả năng sinh lời, thanh khoản, hiệu quả hoạt động và dòng tiền kèm báo cáo nhận định chuyên sâu, xuất ra tài liệu Word.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "interview-coach",
    "name": "Huấn luyện Phỏng vấn Tuyển dụng",
    "description": "Chuẩn bị bộ câu hỏi phỏng vấn dự kiến, kịch bản trả lời chuẩn STAR và câu hỏi đào sâu từ CV và vị trí ứng tuyển, xuất ra Markdown.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "invoice-tax-checklist",
    "name": "Danh mục Kiểm tra Hóa đơn & Thuế",
    "description": "Chuyển thông tin giao dịch thành danh mục kiểm tra xuất hóa đơn và tuân thủ thuế cần lưu ý, xuất ra tài liệu Word.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "job-description",
    "name": "Soạn Mô tả Công việc (JD)",
    "description": "Chuyển nhu cầu tuyển dụng thành bản mô tả công việc (JD) hoàn chỉnh gồm trách nhiệm, yêu cầu, điểm cộng và tiêu chí sàng lọc hồ sơ, xuất ra tài liệu Word.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "kpi-dashboard",
    "name": "Bảng Điều khiển Theo dõi KPI",
    "description": "Chuyển dữ liệu vận hành thành bảng theo dõi KPI gồm định nghĩa chỉ số, mục tiêu so với thực tế, tỷ lệ hoàn thành và biểu đồ xu hướng, xuất ra bảng tính Excel.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "labor-contract",
    "name": "Hợp đồng Lao động & Thư mời Nhận việc",
    "description": "Soạn thảo hợp đồng lao động hoặc thư mời nhận việc (Offer Letter) theo vị trí và hình thức làm việc kèm danh mục kiểm tra khi ký, xuất ra tài liệu Word.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "lesson-plan",
    "name": "Thiết kế Giáo án Giảng dạy",
    "description": "Thiết kế giáo án hoàn chỉnh theo chủ đề và đặc điểm lớp học gồm mục tiêu, phân bổ thời lượng, hoạt động, đánh giá và bài tập phân hóa, xuất ra tài liệu Word.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "meeting-minutes",
    "name": "Biên bản Cuộc họp & Đầu việc",
    "description": "Chuyển bản ghi âm, lịch sử chat hoặc ghi chú rời rạc thành biên bản cuộc họp có cấu trúc rõ ràng kèm quyết định và đầu việc cần làm, xuất ra tài liệu Word.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "nda-drafter",
    "name": "Soạn Thỏa thuận Bảo mật (NDA)",
    "description": "Soạn thảo thỏa thuận bảo mật thông tin (NDA) một chiều hoặc hai chiều theo bối cảnh hợp tác kèm ghi chú điều khoản và rủi ro, xuất ra tài liệu Word.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "okr-planner",
    "name": "Thiết lập Mục tiêu OKR",
    "description": "Phân rã mục tiêu đội nhóm thành bảng OKR (Objectives & Key Results) đo lường được kèm ghi chú đánh giá định kỳ, xuất ra bảng tính Excel.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "onboarding-plan",
    "name": "Kế hoạch Hội nhập Nhân sự Mới (30/60/90)",
    "description": "Xây dựng lộ trình hội nhập 30/60/90 ngày với các cột mốc, tài liệu và hướng dẫn chi tiết theo từng vị trí, xuất ra bảng tính Excel.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "performance-review",
    "name": "Đánh giá Hiệu suất Nhân sự 360°, 9-Box & Kế hoạch PIP",
    "description": "Tổng hợp mục tiêu và kết quả công việc trong kỳ thành bản đánh giá hiệu suất 360 độ, phân loại Ma trận Nhân tài 9-Box Grid và Kế hoạch Cải thiện Hiệu suất (PIP 30-60 ngày), xuất ra tài liệu Word/Excel.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "personal-finance",
    "name": "Quản lý Tài chính & Tiết kiệm Cá nhân",
    "description": "Chuyển dữ liệu thu nhập, chi tiêu và mục tiêu tài chính thành bảng ngân sách hàng tháng và kế hoạch tiết kiệm khả thi, xuất ra bảng tính Excel.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "policy-compliance",
    "name": "Chính sách Nội bộ & Tuân thủ",
    "description": "Soạn thảo quy chế tuân thủ nội bộ hoặc chính sách quyền riêng tư kèm bảng kiểm tự đánh giá (Checklist), xuất ra tài liệu Word và bảng tính Excel.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "product-launch",
    "name": "Kế hoạch Ra mắt Sản phẩm & Go-to-Market (GTM Playbook)",
    "description": "Chuyển thông tin sản phẩm mới thành kế hoạch ra mắt GTM Playbook (phân tầng Mức 1/2/3, định vị ICP, kênh phân phối, thông cáo báo chí và bộ câu hỏi FAQ), xuất ra tài liệu Word/Excel.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "proposal-writer",
    "name": "Viết Đề xuất Dự án & Giải pháp",
    "description": "Chuyển yêu cầu hoặc ý tưởng thành bản đề xuất dự án/giải pháp hoàn chỉnh gồm mục tiêu, thiết kế, cột mốc, ngân sách và rủi ro, xuất ra tài liệu Word.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "quiz-maker",
    "name": "Tạo Đề kiểm tra & Đáp án Chi tiết (Chuẩn CV 7991)",
    "description": "Biên soạn đề kiểm tra hoàn chỉnh theo 3 mức độ nhận thức (Biết 40% - Hiểu 30% - Vận dụng 30%) kèm đáp án, lời giải chi tiết và ma trận câu hỏi, xuất ra tài liệu Word.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "resume-polisher",
    "name": "Tối ưu hóa Hồ sơ Ứng tuyển (CV/Resume)",
    "description": "Biên tập và nâng cấp CV theo vị trí mục tiêu với các thành tích định lượng rõ ràng và tối ưu từ khóa theo JD, xuất ra tài liệu Word.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "sales-forecast",
    "name": "Dự báo Doanh số & Phân tích Độ nhạy",
    "description": "Dự báo doanh số từ dữ liệu lịch sử theo xu hướng và tính mùa vụ, kèm khoảng tin cậy, kịch bản (tích cực/cơ sở/thận trọng) và phân tích độ nhạy, xuất ra bảng tính Excel.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "seo-content",
    "name": "Nghiên cứu Từ khóa & Bài viết Chuẩn SEO",
    "description": "Xây dựng bảng gom cụm từ khóa (Keyword Cluster) theo chủ đề và viết bài chuyên sâu chuẩn SEO, xuất ra bảng tính Excel và tài liệu Markdown.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "slide-planner",
    "name": "Hoạch định & Dựng Bài thuyết trình",
    "description": "Lên đề cương mạch nội dung thuyết trình trước, sau khi xác nhận sẽ tự động dựng trọn bộ slide hoàn chỉnh, xuất ra PowerPoint.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "social-media",
    "name": "Lịch Nội dung Mạng xã hội Đa kênh",
    "description": "Xây dựng lịch đăng bài (Content Calendar) và bộ nội dung tuần tối ưu riêng cho từng nền tảng từ định vị kênh, xuất ra bảng tính Excel và Markdown.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "sop-writer",
    "name": "Xây dựng Quy trình Chuẩn (SOP)",
    "description": "Chuyển quy trình làm việc thực tế thành tài liệu SOP hoặc quy chế chuẩn gồm vai trò, các bước, điểm kiểm soát và xử lý ngoại lệ, xuất ra tài liệu Word.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "study-plan",
    "name": "Lập Thời gian biểu Học tập & Ôn thi",
    "description": "Xây dựng lịch học tập chi tiết theo tuần và ngày dựa trên mục tiêu và quỹ thời gian, kèm phương pháp học và nguyên tắc điều chỉnh, xuất ra bảng tính Excel.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "survey-analyst",
    "name": "Phân tích Khảo sát & Nghiên cứu Người dùng",
    "description": "Làm sạch dữ liệu phản hồi khảo sát, chạy bảng chéo (Cross-tab), vẽ biểu đồ và xuất trọn bộ bảng tính phân tích Excel kèm báo cáo kết quả Word.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "swot-strategy",
    "name": "Phân tích Chiến lược SWOT & PEST",
    "description": "Thực hiện phân tích SWOT, PEST và bức tranh cạnh tranh cho doanh nghiệp/sản phẩm, từ đó đề xuất các khuyến nghị chiến lược khả thi, xuất ra tài liệu Word.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "terms-of-service",
    "name": "Soạn Điều khoản Dịch vụ (ToS) & Bảo mật",
    "description": "Soạn thảo bộ Điều khoản dịch vụ và Thông báo quyền riêng tư phù hợp với mô hình sản phẩm và tính năng, xuất ra tài liệu Word.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "thesis-advisor",
    "name": "Cố vấn Đề cương Luận văn & Tổng quan Tài liệu",
    "description": "Xây dựng đề cương luận văn/khóa luận, bản nháp từng chương và khung tổng quan tài liệu (Literature Review) từ đề tài của người học, xuất ra tài liệu Word.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "weekly-report",
    "name": "Báo cáo Tiến độ Tuần / Tháng",
    "description": "Tổng hợp các ghi chú tiến độ công việc rời rạc thành bản báo cáo tuần/tháng chuẩn chỉnh gồm kết quả, số liệu, rủi ro và kế hoạch kỳ tới, xuất ra tài liệu Word.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-office",
    "name": "Xử Lý Tài Liệu Văn Phòng Chuyên Nghiệp",
    "description": "Tạo, biên tập và chuyển đổi tài liệu Office (DOCX, XLSX, PPTX, PDF) với cấu trúc cây AST bảo toàn byte nguyên bản.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-docs",
    "name": "Động Cơ Biên Tập Văn Bản Word (Cloud Docs AST)",
    "description": "Bí quyết biên tập DOCX cấp độ byte, chuẩn hóa văn bản hành chính Nghị định 30/2020/NĐ-CP và Tracked Changes.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-sheets",
    "name": "Động Cơ Mô Hình Hóa Bảng Tính Excel (Cloud Sheets Engine)",
    "description": "Quy tắc dựng công thức sống (Live Formulas), kiểm toán chéo bảng cân đối và bảo vệ vùng ô tính nhạy cảm.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-slides",
    "name": "Động Cơ Kiến Trúc Trình Chiếu 16:9 (Cloud Slides Architect)",
    "description": "Quy chuẩn thiết kế bố cục trình chiếu 16:9 Astryx, chống tràn chữ (HarfBuzz metrics) và phân cấp thị giác.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-pdf",
    "name": "Động Cơ Phân Tích & Chỉnh Sửa PDF Cấp Độ Byte (Cloud PDF Engine)",
    "description": "Trích xuất cấu trúc bảng biểu, OCR đa ngôn ngữ và biên tập trực tiếp văn bản PDF.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-markdown",
    "name": "Động Cơ Soạn Thảo Kỹ Thuật Markdown (Cloud Markdown Engine)",
    "description": "Biên tập tài liệu kỹ thuật, sơ đồ Mermaid, công thức KaTeX và chuyển đổi sang Word chuẩn.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-html",
    "name": "Động Cơ Biên Tập Giao Diện HTML (Cloud HTML Engine)",
    "description": "Biên tập trang HTML độc lập, chuẩn hóa CSS Astryx và xuất tài liệu DOCX bảo toàn kiểu dáng.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "vn-admin-doc-nd30",
    "name": "Soạn Thảo Công Văn & Tờ Trình Chuẩn Nghị Định 30/2020/NĐ-CP",
    "description": "Soạn thảo công văn, tờ trình, quyết định, biên bản hành chính nhà nước và doanh nghiệp đúng chuẩn thể thức Nghị định 30/2020/NĐ-CP, xuất ra tài liệu Word.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "vn-bidding-dossier-pro",
    "name": "Lập Hồ Sơ Dự Thầu & Thuyết Minh Kỹ Thuật (Luật Đấu Thầu VN)",
    "description": "Xây dựng hồ sơ đề xuất kỹ thuật, ma trận đáp ứng E-HSMT, biện pháp tổ chức thi công/triển khai và biểu giá dự thầu theo Luật Đấu thầu mới nhất, xuất ra Word và Excel.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "vn-bi-cohort-analytics",
    "name": "Phân Tích Cohort, RFM & Dự Báo Dòng Tiền Doanh Nghiệp",
    "description": "Phân tích chân dung khách hàng RFM, tỷ lệ giữ chân (Cohort Retention), Unit Economics (CAC/LTV/Payback) và mô hình hóa dữ liệu kinh doanh đa chiều, xuất ra bảng tính Excel.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "hr-payroll-3p",
    "name": "Thiết Kế Thang Bảng Lương 3P & BHXH Chuẩn Bộ Luật Lao Động VN",
    "description": "Xây dựng hệ thống lương 3P, tính toán BHXH/BHYT/BHTN (NLĐ 10,5% / DN 21,5%), thuế TNCN lũy tiến 5 bậc (giảm trừ 15,5tr / 6,2tr) và quy chế lương thưởng theo Bộ luật Lao động 2019, xuất ra Excel và Word.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "vn-legal-contract-audit",
    "name": "Rà Soát, Kiểm Toán Pháp Lý & Đàm Phán Sửa Đổi Hợp Đồng (GREEN/YELLOW/RED — BLDS 2015 & Luật Thương Mại)",
    "description": "Chuyên trách rà soát lỗ hổng pháp lý hợp đồng, kiểm soát trần phạt vi phạm 8% (Điều 301 Luật Thương mại), bồi thường thiệt hại, bất khả kháng, phân loại rủi ro GREEN/YELLOW/RED và xuất câu chữ sửa đổi, bổ sung theo 3 mức ưu tiên theo pháp luật Việt Nam (phần soạn mới hợp đồng nằm ở contract-drafter).",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-gtm-growth-strategy",
    "name": "Chiến Lược Go-To-Market & Phễu Chuyển Đổi Đa Kênh Thị Trường Việt Nam",
    "description": "Lập kế hoạch thâm nhập thị trường, phân bổ ngân sách Media Mix (Zalo OA, TikTok Shop, Shopee Mall, Meta, Google), tính toán ROAS/CPA mục tiêu và kịch bản tăng trưởng, xuất ra Word và Excel.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-visual-director",
    "name": "Đạo Diễn Nghệ Thuật & Sinh Ảnh Minh Họa (Cloud Visual Director)",
    "description": "Tự động nâng cấp câu lệnh sinh ảnh (Image Prompt Enhancer) cho Slide và Tài liệu: kiểm soát bố cục ánh sáng, tỷ lệ khung hình, đồng bộ bảng màu và loại bỏ hoàn toàn chữ vỡ/rác thị giác.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "lycero-form-architect",
    "name": "Kiến Trúc Sư Biểu Mẫu & Form Hành Chính A4 (Cloud Form Architect)",
    "description": "Chuyên gia dựng các biểu mẫu doanh nghiệp có khung điền thông tin (Đơn xin nghỉ phép, Phiếu đề xuất mua sắm, Biên bản nghiệm thu, Phiếu đánh giá KPI, Hồ sơ nhân sự) bằng bảng biểu chuẩn A4.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "pipeline-slide-style",
    "name": "Pipeline Stage 1: Kiến Tạo Style Skill Trình Chiếu (Slide Style Generator)",
    "description": "Master System Prompt cho giai đoạn generateStyleSkill của Desktop Slide Agent — thiết lập bảng màu Hex tương phản cao, hệ font tiếng Việt/Latin và 17 biến thể bố cục.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "pipeline-slide-outline",
    "name": "Pipeline Stage 2: Hoạch Định Dàn Ý Chiến Lược Slide (Deck Outline Planner)",
    "description": "Master System Prompt cho giai đoạn planDeckOutline — xây dựng cốt truyện Pyramid Principle, core_hook sắc bén, phân bổ layout không trùng lặp và truy vấn ảnh sát ngữ cảnh.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "pipeline-slide-page-spec",
    "name": "Pipeline Stage 3: Đặc Tả Tọa Độ JSON Từng Trang Slide (1280×720 Page Spec)",
    "description": "Master System Prompt cho giai đoạn generatePageLocal — kiểm soát tọa độ x, y, w, h trên khung 1280×720, tính toán chiều cao khung chữ tiếng Việt có dấu và thứ tự z-index.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "pipeline-doc-writer",
    "name": "Pipeline Stage 4: Động Cơ Soạn Thảo Văn Bản Dài (Long-Form Doc Writer HTML)",
    "description": "Master System Prompt cho giai đoạn buildDocWriterRequest (doc-writer.ts) — sinh Restricted HTML Fragment chuẩn xác, giữ nguyên cấu trúc bảng biểu NĐ30/Hợp đồng và số liệu thực.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "cfo-financial-modeling-dcf",
    "name": "Mô Hình Tài Chính 3 Báo Cáo, Định Giá DCF/LBO & Độ Nhạy WACC (CFO Financial Modeling)",
    "description": "Xây dựng mô hình tài chính 3 báo cáo liên kết (P&L, Balance Sheet, Cash Flow), định giá DCF 5 năm, LBO, ma trận độ nhạy WACC × Terminal Growth và kiểm toán cân đối tự động trên Excel.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "vc-pitch-deck-architect",
    "name": "Kiến Trúc Sư Pitch Deck Gọi Vốn Đầu Tư Seed / Series A-B-C (VC Pitch Deck Architect)",
    "description": "Thiết kế bộ Slide Gọi Vốn Đầu Tư (VC Pitch Deck 10-12 slides) theo chuẩn Sequoia / Y Combinator / McKinsey: phân hóa theo vòng gọi vốn (Seed, Series A, Series B/C) và ngành nghề (B2B SaaS, AI/DeepTech, Consumer, FinTech).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "enterprise-sop-rfp-operations",
    "name": "Xây Dựng Quy Trình Vận Hành Chuẩn SOP, Ma Trận RACI & Hồ Sơ Mời Thầu RFP/SOW",
    "description": "Thiết kế Quy trình Vận hành Chuẩn (SOP ISO 9001), Ma trận Phân quyền Trách nhiệm RACI, Hồ sơ Yêu cầu Đề xuất (RFP), Đặc tả Công việc (SOW) và Đánh giá Nhà cung cấp (Vendor Scorecard).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "product-strategy-prd-okr",
    "name": "Chiến Lược Sản Phẩm PRD, Khung Chiến Lược SWOT/Porter & Quản Trị Mục Tiêu OKRs",
    "description": "Biên soạn Tài liệu Đặc tả Sản phẩm (PRD), Khung phân tích chiến lược (SWOT, PESTLE, Porter 5 Forces, Ansoff, Lean Canvas), User Stories (Gherkin Given/When/Then), Ma trận Ưu tiên RICE và Hệ thống OKRs.",
    "category": "product",
    "version": "3.3.0"
  },
  {
    "slug": "executive-board-memo-mckinsey",
    "name": "Báo Cáo Hội Đồng Quản Trị, IC Memo Đầu Tư & Trực Quan Hóa Chiến Lược McKinsey",
    "description": "Soạn thảo Báo cáo trình Hội đồng Quản trị (Board Pack / Amazon 6-Pager Memo), Tờ trình Ủy ban Đầu tư (Investment Committee Memo), Thẩm định M&A Due Diligence và Bộ Slide Chiến lược chuẩn McKinsey SCQA.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "rubric-builder",
    "name": "Thiết Kế Rubric Đánh Giá Năng Lực & Tiêu Chí Chấm Điểm Liên Tục",
    "description": "Xây dựng bảng Rubric đánh giá bài tập lớn, dự án, thuyết trình và thực hành với thang điểm liên tục, khép kín, không có khoảng hở hay chồng lấn.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "report-writer",
    "name": "Soạn Thảo Báo Cáo Điều Hành & Phân Tích Chuyên Sâu",
    "description": "Biên soạn báo cáo tổng kết, báo cáo phân tích kinh doanh, báo cáo nghiên cứu và đề xuất điều hành chuẩn thể thức Việt Nam 2026.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "lbo-leveraged-buyout-model",
    "name": "Mô Hình Mua Lại Bằng Đòn Bẩy Tài Chính LBO & Thác Trả Nợ (Private Equity LBO)",
    "description": "Xây dựng mô hình LBO chuẩn Quỹ Đầu tư Tư nhân (Private Equity): Bảng Nguồn vốn & Sử dụng vốn (Sources & Uses), Lịch trả nợ nhiều tầng (Senior/Mezzanine Debt Sweep), IRR và MOIC.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "comparable-company-analysis-comps",
    "name": "Định Giá So Sánh Bội Số Thị Trường (Trading Comps & Precedent Transactions)",
    "description": "Xây dựng bảng định giá so sánh các công ty cùng ngành (Peer Group Comps) và giao dịch tiền lệ: EV/Revenue, EV/EBITDA, P/E, P/B kèm thống kê Phân vị 25th / Trung vị Median / 75th.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "merger-accretion-dilution-ma",
    "name": "Mô Hình Sáp Nhập M&A Accretion / Dilution & Cộng Hưởng Tài Chính (Merger Model)",
    "description": "Phân tích tác động tài chính thương vụ Mua bán & Sáp nhập (M&A): Tỷ lệ tăng/pha loãng EPS (Accretion/Dilution), Phân bổ giá mua (PPA Goodwill) và Điểm hòa vốn cộng hưởng (Breakeven Synergies).",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "cim-confidential-info-memorandum",
    "name": "Soạn Thảo Bản Công Bố Thông Tin Bảo Mật M&A (Sell-Side CIM 8 Chương)",
    "description": "Biên soạn tài liệu Confidential Information Memorandum (CIM / Info Memo) chuẩn Ngân hàng Đầu tư phục vụ chào bán doanh nghiệp hoặc huy động vốn chiến lược.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "saas-arr-cohort-waterfall",
    "name": "Mô Hình Thác Doanh Thu ARR Bridge & Phân Tích Giữ Chân Cohort (SaaS Revenue Waterfall)",
    "description": "Xây dựng bảng tính thác biến động doanh thu định kỳ (ARR Waterfall: Beginning ARR + New + Expansion - Contraction - Churn = Ending ARR) và ma trận Cohort Retention (GDR / NDR).",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "working-capital-cash-conversion",
    "name": "Quản Trị Vốn Lưu Động, Chu Kỳ Tiền Mặt CCC & Dự Báo Thanh Khoản 13 Tuần (Treasury)",
    "description": "Thiết kế mô hình Dự báo Dòng tiền Trực tiếp 13 Tuần (13-Week Cash Flow Forecast) và tối ưu hóa Chu kỳ Chuyển đổi Tiền mặt (CCC = DSO + DIO - DPO) trên Excel.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "variance-analysis-budget-vs-actual",
    "name": "Phân Tích Biến Động Thực Tế vs Ngân Sách (BvA Variance & Price-Volume-Mix)",
    "description": "Báo cáo phân tích chênh lệch Thực hiện so với Kế hoạch (Budget vs Actual) và Cùng kỳ (YoY), bóc tách nguyên nhân biến động theo Giá bán (Price), Sản lượng (Volume) và Cơ cấu (Mix).",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "cap-table-dilution-waterfall",
    "name": "Bảng Cấu Trúc Vốn Cổ Phần Cap Table, ESOP, SAFE & Phân Chia Thoái Vốn (Exit Waterfall)",
    "description": "Mô hình hóa bảng cổ đông (Cap Table) qua các vòng gọi vốn (Seed, Series A, Series B), tính toán pha loãng cổ phần khi chuyển đổi SAFE/Convertible Note, quỹ quyền chọn ESOP và dòng tiền Exit.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "internal-audit-sox-controls",
    "name": "Kiểm Toán Nội Bộ, Ma Trận Kiểm Soát Rủi Ro (RCM) & Báo Cáo Kiểm Toán COSO",
    "description": "Xây dựng Ma trận Rủi ro & Kiểm soát (Risk & Control Matrix - RCM), chương trình kiểm toán nội bộ theo khung COSO/SOX và Báo cáo Phát hiện Kiểm toán (Audit Findings & CAPA).",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "credit-underwriting-debt-covenants",
    "name": "Thẩm Định Tín Dụng Doanh Nghiệp, Khả Năng Trả Nợ DSCR & Giám Sát Khế Ước Vay",
    "description": "Lập tờ trình thẩm định tín dụng ngân hàng / trái phiếu doanh nghiệp: phân tích mô hình 5C, hệ số trả nợ DSCR, Interest Coverage Ratio, Debt/EBITDA và kiểm tra tuân thủ Covenants.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "saas-msa-sla-negotiation",
    "name": "Soạn Thảo & Đàm Phán Hợp Đồng Dịch Vụ Đám Mây MSA, Cam Kết SLA & Service Credits",
    "description": "Soạn thảo và rà soát Hợp đồng Khung Dịch vụ Phần mềm/Cloud (Master Services Agreement - MSA) kèm Phụ lục Cam kết Chất lượng Dịch vụ (SLA 99.9% Uptime, MTTR và khấu trừ cước).",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "data-privacy-dpa-nd13",
    "name": "Thỏa Thuận Xử Lý Dữ Liệu Cá Nhân DPA & Hồ Sơ Đánh Giá Tác Động Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026)",
    "description": "Soạn thảo Phụ lục Bảo vệ Dữ liệu Cá nhân (DPA), Hồ sơ Đánh giá Tác động Xử lý Dữ liệu Cá nhân (DPIA) và Hồ sơ Chuyển dữ liệu xuyên biên giới theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026) & GDPR.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "ip-licensing-technology-transfer",
    "name": "Hợp Đồng Chuyển Giao Công Nghệ, Cấp Phép Sở Hữu Trí Tuệ (IP Licensing) & Mã Nguồn",
    "description": "Soạn thảo Hợp đồng Cấp phép Quyền Sở hữu Trí tuệ (Exclusive / Non-Exclusive License), Hợp đồng Chuyển giao Công nghệ, Ký quỹ Mã nguồn (Source Code Escrow) theo Luật SHTT Việt Nam.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "shareholder-agreement-sha-term-sheet",
    "name": "Thỏa Thuận Cổ Đông (SHA), Term Sheet Đầu Tư & Quyền Bảo Vệ Nhà Đầu Tư",
    "description": "Soạn thảo Term Sheet và Thỏa thuận Cổ đông (Shareholders Agreement - SHA) theo Luật Doanh nghiệp 2020: Quyền ưu tiên mua trước (ROFR), Tag-Along, Drag-Along, Anti-Dilution và Reserved Matters.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "employment-dispute-disciplinary",
    "name": "Quy Trình Xử Lý Kỷ Luật Lao Động, Biên Bản Sa Thải & Giải Quyết Tranh Chấp BLLĐ 2019",
    "description": "Soạn thảo Hồ sơ xử lý kỷ luật lao động, Thông báo mời họp kỷ luật, Biên bản họp xử lý kỷ luật và Quyết định kỷ luật/chấm dứt HĐLĐ chặt chẽ theo Điều 122-127 Bộ luật Lao động 2019 và Nghị định 145/2020/NĐ-CP.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "corporate-governance-charter-resolution",
    "name": "Điều Lệ Công Ty, Nghị Quyết ĐHĐCĐ / HĐQT & Quy Chế Quản Trị Nội Bộ (Luật Doanh Nghiệp)",
    "description": "Soạn thảo Điều lệ Công ty Cổ phần / TNHH, Tờ trình, Biên bản kiểm phiếu và Nghị quyết Đại hội đồng cổ đông / Hội đồng quản trị / Hội đồng thành viên đúng chuẩn Luật Doanh nghiệp 2020.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "commercial-lease-real-estate-contract",
    "name": "Thẩm Định & Soạn Thảo Hợp Đồng Thuê Văn Phòng, Mặt Bằng Thương Mại & Kho Xưởng",
    "description": "Soạn thảo và rà soát Hợp đồng thuê văn phòng hạng A/B, mặt bằng bán lẻ hoặc nhà xưởng khu công nghiệp: thời gian Fit-out miễn tiền thuê, điều chỉnh giá thuê, đặt cọc và hoàn trả mặt bằng.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "competency-framework-career-ladder",
    "name": "Xây Dựng Khung Năng Lực ASK, Từ Điển Năng Lực & Lộ Trình Thăng Tiến (Career Path)",
    "description": "Thiết kế Từ điển Năng lực (Năng lực cốt lõi, Năng lực chuyên môn, Năng lực lãnh đạo) theo 5 cấp độ thông thạo và Khung Lộ trình Nghề nghiệp (Career Ladder IC1–IC6 / M1–M6).",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "structured-interview-scorecard",
    "name": "Bộ Câu Hỏi Phỏng Vấn Hành Vi STAR, Bài Test Tình Huống & Bảng Chấm Điểm Ứng Viên",
    "description": "Thiết kế Bộ công cụ Phỏng vấn Tuyển dụng có cấu trúc (Structured Interview Kit): Câu hỏi hành vi STAR, câu hỏi tình huống chuyên môn, tiêu chí nhận diện Red Flags và Bảng chấm điểm 1-5.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "org-design-headcount-planning",
    "name": "Thiết Kế Cơ Cấu Tổ Chức, Định Biên Nhân Sự (Headcount Plan) & Dự Toán Quỹ Lương Năm",
    "description": "Lập Kế hoạch Định biên Nhân sự năm (Annual Headcount & Workforce Plan) theo phòng ban, tính toán Tỷ lệ Span of Control, Chi phí Tuyển dụng và Dự toán Tổng Quỹ lương trên Excel.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "employee-engagement-pulse-survey",
    "name": "Khảo Sát Gắn Kết Nhân Sự eNPS, Phân Tích Nghỉ Việc & Chiến Lược Giữ Chân Nhân Tài",
    "description": "Thiết kế Bộ câu hỏi Khảo sát Độ gắn kết Nhân viên (Employee Engagement & eNPS Survey), phân tích dữ liệu khảo sát theo phòng ban và lập Kế hoạch Hành động Giữ chân Nhân tài.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "corporate-training-curriculum-ld",
    "name": "Xây Dựng Khung Chương Trình Đào Tạo Nội Bộ (L&D), Ma Trận Kỹ Năng & Đánh Giá Kirkpatrick",
    "description": "Lập Kế hoạch Đào tạo & Phát triển năng lực năm (TNA - Training Needs Analysis), thiết kế Khung chương trình học tập theo mô hình 70-20-10 và đo lường hiệu quả sau đào tạo 4 cấp Kirkpatrick.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "employee-handbook-code-of-conduct",
    "name": "Biên Soạn Sổ Tay Nhân Viên, Quy Tắc Ứng Xử Đạo Đức & Nội Quy Lao Động Doanh Nghiệp",
    "description": "Soạn thảo trọn bộ Sổ tay Nhân viên (Employee Handbook), Bộ Quy tắc Ứng xử & Chống xung đột lợi ích (Code of Conduct) và Nội quy Lao động đúng chuẩn Bộ luật Lao động 2019.",
    "category": "hr",
    "version": "3.3.0"
  },
  {
    "slug": "conversion-copywriting-landing-page",
    "name": "Nghệ Thuật Copywriting Chuyển Đổi Cao (PAS/AIDA), Cấu Trúc Landing Page & Tối Ưu CRO",
    "description": "Viết nội dung Landing Page, Sales Page và Quảng cáo chuyển đổi cao theo công thức PAS / AIDA / StoryBrand, kiểm toán 7 điểm nghẽn CRO và tối ưu nút kêu gọi hành động (CTA).",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "programmatic-seo-pillar-cluster",
    "name": "Chiến Lược Nội Dung SEO Topical Authority, Cụm Chủ Đề Pillar-Cluster & AI Search (GEO)",
    "description": "Thiết kế kiến trúc SEO tổng thể: Bản đồ Cụm chủ đề (Topic Cluster & Pillar Pages), nghiên cứu Search Intent, Programmatic SEO quy mô lớn và tối ưu hiển thị trên AI Search (GEO/AEO).",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "paid-media-roas-attribution",
    "name": "Tối Ưu Quảng Cáo Đa Kênh (Meta, Google, TikTok Ads), Media Mix & Phân Bổ Ngân Sách ROAS",
    "description": "Lập kế hoạch ngân sách quảng cáo trả phí (Paid Media Plan), ma trận thử nghiệm Creative Hooks, tính toán CPM/CTR/CVR/CPA/ROAS mục tiêu và mô hình phân bổ chuyển đổi (Attribution).",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "email-lifecycle-drip-automation",
    "name": "Chuỗi Email Tự Động Hóa Vòng Đời Khách Hàng (Onboarding, Nurturing & Win-Back Flows)",
    "description": "Thiết kế luồng Email/Zalo ZNS Lifecycle Automation: Chuỗi chào mừng kích hoạt người dùng mới (Welcome/Onboarding), nuôi dưỡng Lead B2B, cứu đơn hàng bỏ giỏ và thu hồi khách hàng rời bỏ.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "brand-positioning-messaging-house",
    "name": "Định Vị Thương Hiệu, Kiến Trúc Thông Điệp (Messaging House) & Cẩm Nang Thương Hiệu",
    "description": "Xây dựng Tuyên ngôn Định vị Thương hiệu (Positioning Statement chuẩn April Dunford), Ngôi nhà Thông điệp (Messaging House), Cá tính Giọng văn (Brand Voice) và Brand Guidelines.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "ab-testing-experimentation-framework",
    "name": "Khung Thử Nghiệm Tăng Trưởng A/B Testing, Giả Thuyết ICE & Kiểm Định Thống Kê",
    "description": "Thiết kế kế hoạch thử nghiệm tăng trưởng (Growth Experimentation): Đặt giả thuyết khoa học, chấm điểm ưu tiên ICE/PIE, tính cỡ mẫu tối thiểu (Sample Size & MDE) và phân tích ý nghĩa thống kê.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "influencer-kol-koc-affiliate-campaign",
    "name": "Kế Hoạch Tiếp Thị KOL/KOC, Affiliate Livestream TikTok/Shopee & Hợp Đồng Booking",
    "description": "Xây dựng chiến dịch Influencer Marketing & Affiliate Commerce: Ma trận lựa chọn Mega/Macro/Micro KOL & KOC, kịch bản Brief sáng tạo nội dung, bảng tính ROI/GPM Livestream và điều khoản Booking.",
    "category": "marketing",
    "version": "3.3.0"
  },
  {
    "slug": "meddpicc-enterprise-deal-qualification",
    "name": "Thẩm Định Cơ Hội Bán Hàng Lớn B2B Theo Khung MEDDPICC & Chiến Lược Đóng Deal (Close Plan)",
    "description": "Chấm điểm và thẩm định các thương vụ B2B quy mô lớn theo chuẩn MEDDPICC (Metrics, Economic Buyer, Decision Criteria/Process, Paper Process, Identify Pain, Champion, Competition) và lập Mutual Action Plan.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "b2b-cold-outreach-sequence",
    "name": "Chuỗi Kịch Bản Tiếp Cận Khách Hàng B2B Đa Điểm Chạm (Cold Email, LinkedIn, Zalo & Telesales)",
    "description": "Thiết kế kịch bản tiếp cận khách hàng tiềm năng B2B cá nhân hóa theo cấp bậc (CEO/CFO/CTO), kết hợp đa kênh Email, LinkedIn, Zalo và Kịch bản Gọi điện Vượt rào cản Gatekeeper.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "sales-objection-battlecard",
    "name": "Thẻ Chiến Đấu Cạnh Tranh (Competitive Battlecards) & Kịch Bản Xử Lý Từ Chối (Objection Handling)",
    "description": "Xây dựng bộ Competitive Battlecards so sánh trực diện với từng đối thủ trên thị trường và Kịch bản Xử lý 20 lời từ chối phổ biến nhất (Giá cao, Đang dùng đối thủ, Chưa có ngân sách).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "sales-commission-quota-comp-plan",
    "name": "Thiết Kế Cơ Chế Hoa Hồng Kinh Doanh, Giao Chỉ Tiêu Quota, OTE & Accelerator Trên Excel",
    "description": "Xây dựng chính sách lương thưởng và hoa hồng đội ngũ Sales (SDR, AE, AM, Sales Manager): Tính OTE, Base/Variable Split, Quota-to-OTE Ratio, bậc thang nhân thưởng (Accelerator) và điều khoản Clawback.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "strategic-account-expansion-qbr",
    "name": "Kế Hoạch Mở Rộng Khách Hàng Trọng Điểm (Key Account Plan) & Họp Đánh Giá Quý (Executive QBR)",
    "description": "Thiết kế bản đồ phát triển Khách hàng Lớn (Key Account Whitespace Mapping, Stakeholder Power Map) và Bộ Slide Họp Đánh giá Kinh doanh Hàng Quý (Executive QBR / EBR) chứng minh ROI.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "channel-partner-reseller-program",
    "name": "Xây Dựng Chính Sách Đại Lý Phân Phối, Chiết Khấu Kênh (Channel Partner) & Deal Registration",
    "description": "Thiết kế chương trình Hợp tác Kênh phân phối & Đại lý (Silver/Gold/Platinum Partner Tiers), bảng tính chiết khấu thương mại (Margin/Rebate), cơ chế Bảo vệ Cơ hội (Deal Registration) và MDF.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "jobs-to-be-done-user-research",
    "name": "Nghiên Cứu Người Dùng Theo Khung Jobs-To-Be-Done (JTBD), Bản Đồ Hành Trình & Phỏng Vấn Sâu",
    "description": "Thiết kế kịch bản phỏng vấn người dùng (Mom Test / JTBD Switch Interview), phân tích 4 lực tác động chuyển đổi (Push, Pull, Anxiety, Habit) và lập Bản đồ Hành trình Khách hàng (Customer Journey Map).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "competitive-intelligence-porter-5-forces",
    "name": "Phân Tích Chiến Lược Cạnh Tranh (Porter 5 Forces, PESTLE, Đại Dương Xanh & Ma Trận ERRC)",
    "description": "Phân tích toàn diện môi trường vĩ mô và cấu trúc ngành bằng mô hình 5 Áp lực Cạnh tranh của Michael Porter, PESTLE, Chiến lược Đại dương Xanh (Strategy Canvas & ERRC Grid) và Wardley Mapping.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "business-model-lean-canvas-architect",
    "name": "Thiết Kế Mô Hình Kinh Doanh (Business Model Canvas, Lean Canvas & Value Proposition Canvas)",
    "description": "Xây dựng và kiểm định Mô hình Kinh doanh 9 khối (Osterwalder Business Model Canvas), Lean Canvas cho Startup/Sản phẩm mới, và Value Proposition Canvas khớp nối Pain Relievers & Gain Creators.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "product-roadmap-now-next-later",
    "name": "Hoạch Định Lộ Trình Sản Phẩm (Now-Next-Later & Outcome Roadmap) & Phân Bổ Nguồn Lực R&D",
    "description": "Thiết kế Lộ trình Sản phẩm định hướng Kết quả (Outcome-Driven Product Roadmap), mô hình Now-Next-Later, phân bổ ngân sách R&D theo tỷ lệ 70-20-10 (Core, Adjacent, Transformational) và quản trị phụ thuộc.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "pricing-packaging-monetization",
    "name": "Chiến Lược Định Giá Sản Phẩm (Value-Based Pricing), Đóng Gói Good-Better-Best & Van Westendorp",
    "description": "Thiết kế chiến lược kiếm tiền (Monetization & Pricing Architecture): Chọn Value Metric tối ưu, đóng gói 3 tầng Good-Better-Best, phân tích độ nhạy giá Van Westendorp và mô hình hóa doanh thu trên Excel.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "agile-sprint-retrospective-scrum",
    "name": "Quản Trị Agile/Scrum Chuyên Nghiệp: Sprint Planning, Tách Epic/User Stories, DoD & Retrospective",
    "description": "Chuẩn hóa vận hành Agile/Scrum cho đội ngũ Kỹ thuật & Sản phẩm: Phân rã Epic thành User Stories chuẩn INVEST kèm Gherkin Acceptance Criteria, tính Velocity/Capacity và điều phối Sprint Retrospective.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "supply-chain-inventory-eoq-safety-stock",
    "name": "Tối Ưu Tồn Kho Chuỗi Cung Ứng: Mô Hình EOQ, Tồn Kho An Toàn (Safety Stock), ROP & Phân Tích ABC/XYZ",
    "description": "Xây dựng bảng tính quản trị tồn kho và hoạch định vật tư trên Excel: Tính Sản lượng Đặt hàng Kinh tế (EOQ), Tồn kho An toàn theo mức phục vụ (Service Level Z-score), Điểm Đặt hàng lại (ROP) và Ma trận ABC/XYZ.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "lean-six-sigma-dmaic-kaizen",
    "name": "Cải Tiến Quy Trình Lean Six Sigma (DMAIC), Phân Tích Gốc Rễ 5 Whys/Fishbone & Loại Bỏ 8 Lãng Phí",
    "description": "Thiết kế dự án cải tiến năng suất và chất lượng theo chuẩn Lean Six Sigma Black Belt: Khung DMAIC, Bản đồ Dòng Giá trị (Value Stream Mapping), 8 Lãng phí DOWNTIME, biểu đồ xương cá Ishikawa và FMEA.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "strategic-sourcing-tco-negotiation",
    "name": "Chiến Lược Mua Sắm Tập Trung, Phân Tích Tổng Chi Phí Sở Hữu (TCO) & Ma Trận Kraljic",
    "description": "Xây dựng chiến lược Mua sắm & Đấu thầu Nhà cung cấp: Phân loại danh mục mua hàng theo Ma trận Kraljic, mô hình tính Tổng Chi phí Sở hữu (Total Cost of Ownership - TCO) trên Excel và kịch bản đàm phán ép giá.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "pmp-project-charter-wbs-risk-register",
    "name": "Quản Lý Dự Án Chuẩn PMI/PMP: Tuyên Bố Dự Án (Project Charter), WBS, EVM & Sổ Đăng Ký Rủi Ro",
    "description": "Thiết lập bộ hồ sơ Quản lý Dự án chuẩn PMBOK/PMP: Project Charter, Cấu trúc Phân rã Công việc (WBS), Quản trị Giá trị Thu được (Earned Value Management - CPI/SPI) và Sổ đăng ký Rủi ro (Risk Register).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "business-continuity-disaster-recovery",
    "name": "Kế Hoạch Duy Trì Hoạt Động Kinh Doanh (BCP), Khôi Phục Thảm Họa (DRP) & Ứng Phó Khủng Hoảng",
    "description": "Xây dựng Kế hoạch Duy trì Hoạt động Kinh doanh (Business Continuity Plan - ISO 22301) và Khôi phục Thảm họa CNTT: Phân tích Tác động Kinh doanh (BIA), xác định RTO/RPO và quy trình kích hoạt khẩn cấp.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "quality-management-iso9001-capa",
    "name": "Hệ Thống Quản Lý Chất Lượng ISO 9001, Danh Mục Đánh Giá Nội Bộ (Audit Checklist) & Báo Cáo CAPA",
    "description": "Thiết kế tài liệu Hệ thống Quản lý Chất lượng theo tiêu chuẩn ISO 9001:2015: Sổ tay Chất lượng, Phiếu Kiểm tra Đánh giá Nội bộ (Internal Audit), Báo cáo Sự không phù hợp (NCR) và Hành động Khắc phục Phòng ngừa (CAPA).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "system-architecture-rfc-adr",
    "name": "Thiết Kế Kiến Trúc Hệ Thống Phân Tán, Tài Liệu Kỹ Thuật RFC, Bản Ghi Quyết Định ADR & Sơ Đồ C4",
    "description": "Biên soạn Tài liệu Thiết kế Kỹ thuật (System Design Document / Engineering RFC), Bản ghi Quyết định Kiến trúc (Architecture Decision Record - ADR), mô hình C4, thiết kế API/Database và tính toán tải lượng (Capacity Planning).",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "cybersecurity-iso27001-soc2-incident",
    "name": "Chính Sách An Toàn Thông Tin ISO 27001 / SOC 2, Mô Hình Đe Dọa STRIDE & Ứng Cứu Sự Cố Bảo Mật",
    "description": "Xây dựng bộ Chính sách An ninh Mạng & Bảo mật Hệ thống theo tiêu chuẩn ISO/IEC 27001:2022 và SOC 2 Type II, phân tích mối đe dọa STRIDE, kiểm soát phân quyền Zero-Trust RBAC và quy trình Ứng cứu Sự cố (CSIRT).",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "postmortem-rca-sre-runbook",
    "name": "Báo Cáo Phân Tích Sự Cố Không Đổ Lỗi (Blameless Postmortem), RCA 5 Whys & Sổ Tay SRE Runbook",
    "description": "Soạn thảo Báo cáo Phân tích Sự cố Kỹ thuật chuẩn Google SRE (Blameless Postmortem): Dòng thời gian sự cố từng phút, phân tích nguyên nhân gốc rễ, tính toán thiệt hại Error Budget và danh mục hành động khắc phục.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "sql-data-warehouse-etl-modeling",
    "name": "Thiết Kế Kho Dữ Liệu (Star/Snowflake Schema), Đường Ống ETL/ELT & Quản Trị Dữ Liệu (Data Governance)",
    "description": "Thiết kế kiến trúc Kho dữ liệu doanh nghiệp (Dimensional Modeling Kimball Star Schema / Medallion Bronze-Silver-Gold), đặc tả luồng biến đổi dữ liệu ETL/ELT, kiểm soát chất lượng dữ liệu và Từ điển Dữ liệu.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "executive-bi-data-storytelling",
    "name": "Nghệ Thuật Kể Chuyện Bằng Dữ Liệu (Data Storytelling), Thiết Kế BI Dashboard & Phân Tích Bất Thường",
    "description": "Chuyển hóa bảng số liệu thô phức tạp thành câu chuyện chiến lược có sức thuyết phục cao theo phương pháp Cole Nussbaumer Knaflic & Edward Tufte: Chọn đúng biểu đồ, loại bỏ rác thị giác và rút ra khuyến nghị hành động.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "excel-executive-dashboard-architect",
    "name": "Kiến Trúc Bảng Điều Khiển Excel Đa Phần Tử (KPI Cards, Công Thức Động, Sparklines & Kiểm Toán Mô Hình)",
    "description": "Thiết kế Executive Dashboard chuẩn C-Level ngay trên Excel: Dải thẻ KPI Cards có chỉ báo biến động ▲/▼, bảng tổng hợp đa chiều bằng SUMIFS/INDEX-MATCH, định dạng có điều kiện thông minh và bảng kiểm tra cân đối.",
    "category": "data",
    "version": "3.3.0"
  },
  {
    "slug": "customer-health-score-churn-playbooks",
    "name": "Mô Hình Điểm Sức Khỏe Khách Hàng (Customer Health Score), Cảnh Báo Sớm Rời Bỏ & Kịch Bản Giữ Chân",
    "description": "Xây dựng hệ thống chấm điểm Sức khỏe Khách hàng đa trọng số (Product Usage, Support Tickets, NPS, Executive Engagement) trên Excel và Bộ kịch bản can thiệp sớm chống rời bỏ (Churn Save Playbooks).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "enterprise-onboarding-implementation-plan",
    "name": "Kế Hoạch Triển Khai & Chuyển Giao Hệ Thống Khách Hàng Lớn (30-60-90 Day Onboarding & Time-to-Value)",
    "description": "Thiết kế lộ trình Onboarding và Triển khai hệ thống (Implementation Kickoff Deck & Project Tracker) cho khách hàng doanh nghiệp: Rút ngắn Time-to-First-Value (TTFV), di chuyển dữ liệu, UAT và đào tạo Go-Live.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "crisis-escalation-apology-comms",
    "name": "Nghệ Thuật Xử Lý Khiếu Nại Nghiêm Trọng, Công Văn Giải Trình Sự Cố SLA & Truyền Thông Phục Hồi Niềm Tin",
    "description": "Soạn thảo Công văn Giải trình Sự cố, Thư Xin lỗi Khách hàng Cấp cao (Executive Apology & SLA Remediation Letter) và Thông cáo Xử lý Khủng hoảng Truyền thông theo nguyên tắc Minh bạch - Nhận trách nhiệm - Khắc phục.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "mckinsey-22-chart-exhibit-selector",
    "name": "22 Mẫu Biểu Đồ Chiến Lược Chuẩn McKinsey (Marimekko, Waterfall, Tornado, Bullet, 2×2 Matrix & Harvey Balls)",
    "description": "Chọn và thiết kế 22 loại biểu đồ phân tích chiến lược chuẩn McKinsey/BCG/Bain cho Slide và Báo cáo: Cầu nối Waterfall, Marimekko, Tornado Sensitivity, Ma trận 2×2, Harvey Balls và Value Pool Chart.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "dashi-12-editorial-slide-themes",
    "name": "12 Hệ Thẩm Mỹ Slide Đương Đại Dashi (Bento Grid, Swiss International, Luxury Editorial & Dark Tech)",
    "description": "Thiết kế bộ Slide thuyết trình mang tính thẩm mỹ tạp chí và nghệ thuật đương đại với 12 hệ ngôn ngữ thiết kế: Swiss International Grid, Apple Bento Box, Dark Tech Keynote, Luxury Editorial, Neo-Brutalist & Warm Craft.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "morph-cinematic-slide-choreography",
    "name": "Thiết Kế Chuyển Cảnh Điện Ảnh PowerPoint Morph (Scene Actors !!scene-*, !!actor-* & Ghosting 36cm)",
    "description": "Kịch bản hóa hiệu ứng chuyển cảnh mượt mà như phim điện ảnh trên PowerPoint (Morph Transition Choreography): Đồng bộ tên đối tượng !!actor-*, dịch chuyển tiêu điểm máy quay, phóng đại chi tiết và Ghosting ngoài khung.",
    "category": "office",
    "version": "3.3.0"
  },
  {
    "slug": "academic-paper-ieee-apa-latex",
    "name": "Biên Soạn Bài Báo Khoa Học Quốc Tế (IMRaD), Luận Văn Thạc Sĩ/Tiến Sĩ, Chuẩn APA 7/IEEE & Phản Biện",
    "description": "Biên soạn Công trình Nghiên cứu Khoa học, Bài báo Tạp chí Quốc tế (ISI/Scopus cấu trúc IMRaD), Đề cương Luận văn/Luận án, chuẩn hóa trích dẫn APA 7th / IEEE và soạn Thư trả lời Phản biện (Point-by-Point Reviewer Response).",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "annual-report-esg-sustainability",
    "name": "Báo Cáo Thường Niên Doanh Nghiệp (Annual Report) & Báo Cáo Phát Triển Bền Vững ESG (Chuẩn GRI / Net Zero)",
    "description": "Biên soạn Báo cáo Thường niên Công ty Đại chúng (theo Thông tư 96/2020/TT-BTC) và Báo cáo Phát triển Bền vững ESG theo tiêu chuẩn Quốc tế GRI / TCFD: Kiểm kê khí nhà kính Scope 1-2-3, lộ trình Net Zero và Quản trị công ty.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "construction-boq-fidic-dossier",
    "name": "Dự Toán Khối Lượng Xây Dựng (BOQ), Hợp Đồng FIDIC, Nhật Ký Thi Công & Hồ Sơ Nghiệm Thu Công Trình",
    "description": "Thiết lập bộ hồ sơ Quản lý Dự án Xây dựng & Bất động sản: Bảng Dự toán Khối lượng (Bill of Quantities - BOQ) trên Excel, điều khoản Hợp đồng EPC/FIDIC, Tiến độ Thi công và Biên bản Nghiệm thu Khối lượng Thanh toán (IPC).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "vn-legislative-normative-drafting",
    "name": "Kỹ Thuật Soạn Thảo Văn Bản Quy Phạm Pháp Luật & Đánh Giá Tác Động Chính Sách (RIA)",
    "description": "Soạn thảo Dự thảo Văn bản Quy phạm Pháp luật (Luật, Nghị định, Thông tư, Quyết định), Tờ trình Chính phủ, Báo cáo Đánh giá Tác động Chính sách (RIA) và Bản Tổng hợp Giải trình Ý kiến Góp ý theo Luật Ban hành VBQPPL.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-court-petition-civil-litigation",
    "name": "Soạn Thảo Đơn Khởi Kiện, Bản Tự Khai, Đơn Phản Tố & Đơn Kháng Cáo Tố Tụng Dân Sự / Thương Mại",
    "description": "Soạn thảo chuẩn xác Đơn Khởi kiện (Mẫu số 23-DS Nghị quyết 01/2017/NQ-HĐTP), Bản Tự khai của Nguyên đơn/Bị đơn, Đơn Yêu cầu Áp dụng Biện pháp Khẩn cấp Tạm thời, Đơn Phản tố và Đơn Kháng cáo.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-administrative-complaint-denunciation",
    "name": "Soạn Thảo Đơn Khiếu Nại Quyết Định Hành Chính, Đơn Tố Cáo & Khởi Kiện Vụ Án Hành Chính",
    "description": "Soạn thảo Đơn Khiếu nại lần đầu/lần hai đối với Quyết định hành chính hoặc Hành vi hành chính (Luật Khiếu nại 2011), Đơn Tố cáo và Đơn Khởi kiện Vụ án Hành chính (Luật Tố tụng Hành chính 2015).",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-enterprise-licensing-investment-irc-erc",
    "name": "Hồ Sơ Đăng Ký Đầu Tư (IRC), Đăng Ký Doanh Nghiệp (ERC), M&A Vốn Nước Ngoài & Giấy Phép Con",
    "description": "Thiết lập bộ hồ sơ Đề xuất Dự án Đầu tư (cấp/điều chỉnh IRC), Đăng ký Doanh nghiệp (ERC), Chấp thuận Góp vốn Mua cổ phần của Nhà đầu tư Nước ngoài (M&A Approval) theo Luật Đầu tư 2020 và Luật Doanh nghiệp 2020.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-land-real-estate-legal-dossier",
    "name": "Pháp Lý Dự Án Bất Động Sản, Đất Đai, Hợp Đồng Mua Bán Căn Hộ & Chuyển Nhượng Dự Án (Luật Đất Đai 2024)",
    "description": "Tư vấn và soạn thảo hồ sơ pháp lý Bất động sản theo Luật Đất đai 2024, Luật Nhà ở 2023 và Luật Kinh doanh Bất động sản 2023: Quy trình pháp lý dự án, Hợp đồng Mua bán Nhà ở hình thành trong tương lai, đặt cọc và chuyển nhượng QSDĐ.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-tax-inspection-explanation-appeal",
    "name": "Công Văn Giải Trình Thanh Tra Kiểm Tra Thuế, Quyết Toán Thuế TNDN/GTGT & Khiếu Nại Ấn Định Thuế",
    "description": "Soạn thảo Công văn Giải trình số liệu với Đoàn Thanh tra/Kiểm tra Thuế, bảo vệ Chi phí được trừ khi tính Thuế TNDN, Hồ sơ Hoàn thuế GTGT và Đơn Khiếu nại Biên bản/Quyết định Xử phạt Thuế theo Luật Quản lý Thuế 2019.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-intellectual-property-trademark-patent",
    "name": "Hồ Sơ Đăng Ký Nhãn Hiệu, Bản Quyền, Sáng Chế (Cục SHTT) & Xử Lý Xâm Phạm Sở Hữu Trí Tuệ",
    "description": "Tra cứu phân loại Nice, lập Tờ khai & Bản mô tả Đăng ký Nhãn hiệu/Sáng chế/Kiểu dáng công nghiệp tại Cục SHTT, Phúc đáp Thông báo Dự định Từ chối của Cục SHTT và lập Hồ sơ Giám định VIPRI xử lý hàng giả/xâm phạm SHTT.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-notary-inheritance-matrimonial-law",
    "name": "Văn Bản Công Chứng Di Chúc, Phân Chia Di Sản Thừa Kế & Thỏa Thuận Tài Sản Vợ Chồng",
    "description": "Soạn thảo Di chúc hợp pháp, Văn bản Thỏa thuận Phân chia/Khai nhận Di sản Thừa kế (Bộ luật Dân sự 2015), Văn bản Thỏa thuận Xác lập Chế độ Tài sản Vợ chồng trước kết hôn và Phân chia Tài sản Chung (Luật HNGĐ 2014).",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "legal-reasoning-irac-crac-memorandum",
    "name": "Tư Duy Pháp Lý Cấu Trúc IRAC / CRAC / CREAC & Soạn Thảo Bản Tư Vấn Pháp Lý (Legal Opinion)",
    "description": "Phân tích tình huống pháp lý phức tạp và biên soạn Bản Ý kiến Pháp lý (Legal Opinion / Legal Memorandum) theo khung tư duy chuẩn mực quốc tế IRAC / CRAC / CREAC có phản biện hai chiều.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "litigation-opposing-counsel-simulator",
    "name": "Giả Lập Chiến Thuật Luật Sư Đối Phương (Opposing Counsel Simulator) & Kịch Bản Phản Công",
    "description": "Đóng vai Luật sư của Phía Đối lập để tấn công thử vào hồ sơ của bạn (Red-Teaming Legal Strategy): Dự đoán các đòn đánh thủ tục, yêu cầu phản tố, bẫy chứng cứ và thiết kế lá chắn phòng thủ trước phiên tòa/đàm phán.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "judge-arbitrator-bench-perspective",
    "name": "Phân Tích Vụ Việc Từ Góc Nhìn Thẩm Phán / Hội Đồng Trọng Tài (Bench Perspective & Chứng Cứ)",
    "description": "Đặt mình vào vị trí Hội đồng Xét xử hoặc Hội đồng Trọng tài (VIAC/ICC) để thẩm định khách quan hồ sơ vụ án: Kiểm tra chuỗi chứng cứ (Chain of Evidence), những câu hỏi xoáy của Thẩm phán và nguy cơ bị bác yêu cầu.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "cross-examination-hearing-rehearsal",
    "name": "Kịch Bản Xét Hỏi Chéo Tại Phiên Tòa / Trọng Tài (Cross-Examination) & Chuẩn Bị Nhân Chứng",
    "description": "Thiết kế hệ thống câu hỏi xét hỏi tại phiên tòa/phiên họp Trọng tài theo kỹ thuật Phễu Khóa chặt (Funnel & Leading Questions), bóc trần mâu thuẫn lời khai đối phương và huấn luyện đại diện doanh nghiệp trả lời xét hỏi.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "litigation-settlement-ev-decision-tree",
    "name": "Mô Hình Cây Quyết Định Định Lượng Hòa Giải vs Khởi Kiện (Settlement vs Trial EV & BATNA/ZOPA)",
    "description": "Xây dựng bảng tính Excel phân tích Giá trị Kỳ vọng (Expected Value - EV) của phương án Theo đuổi Tố tụng/Trọng tài so với Hòa giải Thương lượng: Tính xác suất thắng từng phần, chi phí luật sư/án phí, chi phí cơ hội thời gian và xác định vùng ZOPA.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "contract-ambiguity-crossref-auditor",
    "name": "Kiểm Toán Tính Nhất Quán Định Nghĩa, Tham Chiếu Chéo & Bắt Lỗi Mơ Hồ Câu Chữ Hợp Đồng",
    "description": "Quét toàn diện văn bản Hợp đồng để phát hiện: Thuật ngữ viết hoa nhưng chưa định nghĩa, Định nghĩa không được sử dụng, Tham chiếu chéo sai số Điều/Khoản (Broken Cross-References), Xung đột giữa Hợp đồng và Phụ lục, và Câu chữ mơ hồ đa nghĩa.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "ma-legal-due-diligence-red-flag",
    "name": "Thẩm Định Pháp Lý Mua Bán Sáp Nhập (M&A Legal Due Diligence Red-Flag Report & Điều Kiện Tiên Quyết CP)",
    "description": "Lập Báo cáo Thẩm định Pháp lý Trọng yếu (Red-Flag Legal Due Diligence Report) cho thương vụ M&A / Đầu tư: Rà soát Lịch sử Vốn điều lệ, Điều khoản Thay đổi Quyền kiểm soát (Change of Control), Tài sản/SHTT, Lao động, Thuế và chuyển hóa thành CP / CS / Indemnity.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "commercial-arbitration-viac-icc-brief",
    "name": "Soạn Thảo Bản Luận Cứ Trọng Tài Thương Mại (VIAC / SIAC / ICC) & Thỏa Thuận Trọng Tài Mẫu",
    "description": "Soạn thảo Đơn Khởi kiện Trọng tài, Bản Tự bảo vệ, Bản Luận cứ Pháp lý tại Trung tâm Trọng tài Quốc tế Việt Nam (VIAC) / SIAC / ICC, thiết kế Điều khoản Trọng tài Đa tầng (Multi-tier Dispute Resolution Clause) và thủ tục Yêu cầu Hủy Phán quyết Trọng tài.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "demand-letter-cease-desist-escalation",
    "name": "Thư Yêu Cầu Thanh Toán Công Nợ (Demand Letter), Thông Báo Vi Phạm & Thư Cảnh Báo (Cease & Desist)",
    "description": "Soạn thảo chuỗi Công văn Đòi nợ Thương mại phân cấp (Nhắc nợ thiện chí -> Thông báo vi phạm & Tính lãi chậm trả -> Thư Yêu cầu Thanh toán Cuối cùng trước khi Khởi kiện / Final Demand Letter) và Thư Cảnh báo Chấm dứt Vi phạm (Cease & Desist).",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "bilingual-contract-translation-legal-plain",
    "name": "Biên Dịch & Đối Chiếu Hợp Đồng Song Ngữ Việt - Anh (Side-by-Side) & Giải Nghĩa Pháp Lý Đời Thường",
    "description": "Soạn thảo hoặc chuyển ngữ Hợp đồng Song ngữ Việt - Anh trình bày 2 cột đối xứng chuẩn xác thuật ngữ Common Law vs Civil Law Việt Nam, kèm bản Giải nghĩa Ngôn ngữ Đời thường (Plain Language Summary) cho Ban Giám đốc.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-gdpt2018-lesson-plan-cv5512",
    "name": "Thiết Kế Kế Hoạch Bài Dạy (Giáo Án) Chuẩn Công Văn 5512/BGDĐT-GDTrH & Chương Trình GDPT 2018",
    "description": "Biên soạn Kế hoạch Bài dạy (Giáo án THCS/THPT theo Phụ lục IV Công văn 5512/BGDĐT-GDTrH, Chương trình GDPT 2018): Xác định Yêu cầu cần đạt (Năng lực chung, Năng lực đặc thù, Phẩm chất) và chuỗi 4 Hoạt động học tập tổ chức theo 4 bước kèm Bảng 2 cột và Phiếu học tập.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "vn-exam-matrix-specification-tt22",
    "name": "Thiết Kế Ma Trận, Bản Đặc Tả & Đề Kiểm Tra Định Kỳ Chuẩn Công Văn 7991/BGDĐT-GDTrH (3 Mức Độ: Biết – Hiểu – Vận dụng)",
    "description": "Xây dựng trọn bộ Hồ sơ Đề kiểm tra Định kỳ (Giữa kỳ / Cuối kỳ) thống nhất theo Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 và Thông tư 22/2021/TT-BGDĐT: (1) Khung Ma trận đề theo 3 mức độ nhận thức (Nhận biết 40% – Thông hiểu 30% – Vận dụng 30%); (2) Bản Đặc tả chi tiết; (3) Đề kiểm tra Phần I Trắc nghiệm 3 dạng (Nhiều lựa chọn, Đúng/Sai 4 ý a-b-c-d, Trả lời ngắn) + Phần II Tự luận; và (4) Đáp án - Hướng dẫn chấm chi tiết.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "vn-sang-kien-kinh-nghiem-skkn",
    "name": "Biên Soạn Sáng Kiến Kinh Nghiệm (SKKN) & Báo Cáo Biện Pháp Thi Giáo Viên Giỏi Cấp Trường / Tỉnh",
    "description": "Biên soạn hoàn chỉnh Hồ sơ Sáng kiến Kinh nghiệm (SKKN) xét Chiến sĩ Thi đua và Báo cáo Biện pháp Nâng cao Chất lượng Công tác Giảng dạy thi Giáo viên Dạy giỏi theo Thông tư 22/2019/TT-BGDĐT kèm số liệu thực nghiệm Trước/Sau tác động.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "vn-stem-steam-5e-lesson-architect",
    "name": "Thiết Kế Chủ Đề Dạy Học STEM / STEAM Theo Chu Trình 5E & Quy Trình Thiết Kế Kỹ Thuật (Công Văn 3089)",
    "description": "Thiết kế Bài học STEM / Chủ đề STEAM liên môn (Khoa học - Công nghệ - Kỹ thuật - Nghệ thuật - Toán học) theo Công văn 3089/BGDĐT-GDTrH: Chu trình 5E, Quy trình Thiết kế Kỹ thuật 8 bước, Bản vẽ thiết kế và Tiêu chí đánh giá sản phẩm.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "vn-homeroom-teacher-student-evaluation",
    "name": "Trợ Lý Giáo Viên Chủ Nhiệm: Nhận Xét Học Bạ (Thông Tư 27 & 22), Kế Hoạch Chủ Nhiệm & Họp Phụ Huynh",
    "description": "Hỗ trợ Giáo viên Chủ nhiệm toàn diện: Viết lời nhận xét Học bạ cá nhân hóa theo Thông tư 27/2020 (Tiểu học) và Thông tư 22/2021 (THCS/THPT), lập Kế hoạch Chủ nhiệm năm học, xử lý tình huống sư phạm và thiết kế Kịch bản Họp Phụ huynh Truyền cảm hứng.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "vn-olympiad-gifted-student-coaching",
    "name": "Biên Soạn Chuyên Đề Bồi Dưỡng Học Sinh Giỏi (HSG Tỉnh / Quốc Gia / Olympic) & Bài Tập Phân Hóa Cao",
    "description": "Biên soạn Tài liệu Chuyên đề Bồi dưỡng Học sinh Giỏi (THCS, THPT Chuyên, Thi HSG Tỉnh/Quốc gia): Hệ thống hóa lý thuyết nâng cao, phân dạng phương pháp giải, kỹ thuật suy luận ngược, bẫy tư duy và bài tập phát triển từ đề thi chính thức.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "vn-school-principal-annual-plan-qa",
    "name": "Quản Lý Nhà Trường: Kế Hoạch Giáo Dục Nhà Trường, Tự Đánh Giá Kiểm Định Chất Lượng & Tổ Chuyên Môn",
    "description": "Hỗ trợ Ban Giám hiệu (Hiệu trưởng/Phó Hiệu trưởng) và Tổ trưởng Chuyên môn: Xây dựng Kế hoạch Giáo dục Nhà trường (Phụ lục 1, 2, 3 Công văn 5512), Báo cáo Tự đánh giá Kiểm định Chất lượng Giáo dục (Thông tư 17/18/19/BGDĐT) và Nghị quyết Hội đồng trường.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "experiential-career-guidance-hdtn",
    "name": "Thiết Kế Hoạt Động Trải Nghiệm - Hướng Nghiệp (HĐTN-HN) & Tư Vấn Chọn Nghề Theo Holland / Ikigai",
    "description": "Thiết kế kịch bản Hoạt động Trải nghiệm và Hướng nghiệp (GDPT 2018) theo 3 loại hình (Sinh hoạt dưới cờ, Hoạt động giáo dục theo chủ đề, Sinh hoạt lớp) và Tư vấn Hướng nghiệp Học sinh THPT theo mật mã Holland (RIASEC) & Ikigai.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "lesson-study-teacher-coaching-ngcbh",
    "name": "Sinh Hoạt Chuyên Môn Theo Nghiên Cứu Bài Học (Lesson Study) & Huấn Luyện Sư Phạm Đồng Đẳng",
    "description": "Tổ chức Sinh hoạt Tổ/Nhóm chuyên môn theo hướng Nghiên cứu Bài học (Công văn 5555/BGDĐT): Thiết kế bài học minh họa, Phiếu quan sát việc học của học sinh (không chấm điểm giáo viên) và Phản tư suy ngẫm sau dự giờ.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "inclusive-education-udl-iep-plan",
    "name": "Giáo Dục Hòa Nhập (Universal Design for Learning - UDL) & Kế Hoạch Giáo Dục Cá Nhân (IEP)",
    "description": "Thiết kế bài học Đa phương thức tiếp cận theo khung Universal Design for Learning (UDL - CAST) và lập Kế hoạch Giáo dục Cá nhân (IEP) cho học sinh có nhu cầu giáo dục đặc biệt / học sinh khuyết tật học hòa nhập.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "ubd-backwards-curriculum-designer",
    "name": "Thiết Kế Chương Trình Học Theo Mô Hình Thiết Kế Ngược (Understanding by Design - UbD 3 Giai Đoạn)",
    "description": "Xây dựng Chương trình Môn học / Học phần theo khung Thiết kế Ngược (Wiggins & McTighe Understanding by Design - UbD) và Tương thích Kiến tạo (Biggs Constructive Alignment): Kết quả mong đợi -> Bằng chứng đánh giá GRASPS -> Kế hoạch học tập WHERETO.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "university-syllabus-obe-aun-qa",
    "name": "Thiết Kế Đề Cương Chi Tiết Học Phần Đại Học Chuẩn Đầu Ra OBE (CDIO / AUN-QA / ABET) & Ma Trận PLO-CLO",
    "description": "Xây dựng Đề cương Chi tiết Học phần (Course Syllabus) bậc Đại học/Sau đại học đạt chuẩn Kiểm định Quốc tế AUN-QA / ABET / Thông tư 17/2021/TT-BGDĐT: Chuẩn đầu ra học phần (CLOs), Ma trận đóng góp PLO-CLO (I/R/M) và Trọng số đánh giá.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "criterion-rubric-tilt-assignment",
    "name": "Thiết Kế Thang Chấm Điểm Rubric Đa Tiêu Chí (Analytic / Single-Point) & Đề Bài Dự Án Chuẩn TILT",
    "description": "Thiết kế Thang đánh giá tiêu chí tường minh (Analytic Rubric 4 mức, Holistic Rubric, Single-Point Rubric) với mô tả hành vi quan sát được và Biên soạn Đề bài Bài tập lớn/Đồ án theo khung Minh bạch TILT (Purpose - Task - Criteria).",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "psychometric-item-analysis-exam-audit",
    "name": "Phân Tích Thống Kê Đề Thi Sau Kiểm Tra (Độ Khó, Độ Phân Biệt, Phân Tích Nhiễu & Phổ Điểm Trên Excel)",
    "description": "Xử lý và phân tích chất lượng đề thi trắc nghiệm/tự luận sau kỳ thi theo Lý thuyết Khảo thí Cổ điển (CTT): Tính Chỉ số Độ khó (p-value), Độ phân biệt (Discrimination Index D), Hiệu quả Phương án Nhiễu và Độ tin cậy Cronbach Alpha trên Excel.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "socratic-feynman-active-tutoring",
    "name": "Thiết Kế Chuỗi Câu Hỏi Truy Vấn Socratic, Kỹ Thuật Giải Thích Ngược Feynman & Câu Hỏi Bản Lề (Hinge)",
    "description": "Thiết kế kịch bản Gia sư AI / Giảng dạy Tích cực: Dẫn dắt học sinh tự khám phá bản chất bằng Phương pháp Truy vấn Socratic 6 tầng, kiểm tra lỗ hổng hiểu biết bằng Kỹ thuật Feynman (Teach-Back) và Câu hỏi Bản lề (Hinge Questions) giữa tiết học.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "cognitive-load-worked-example-fading",
    "name": "Tối Ưu Hóa Tải Nhận Thức (Cognitive Load Theory), Mã Hóa Kép (Dual Coding) & Ví Dụ Mẫu Giảm Dần (Fading)",
    "description": "Thiết kế tài liệu học tập và bài giảng dựa trên Khoa học Thần kinh Nhận thức (Sweller Cognitive Load Theory & Mayer Multimedia Principles): Cắt bỏ tải nhận thức ngoại lai, kết hợp Mã hóa kép và chuỗi Worked-Example Fading.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "spaced-repetition-retrieval-flashcards",
    "name": "Lập Lịch Ôn Tập Ngắt Quãng (Spaced Repetition), Bài Tập Truy Xuất Chủ Động & Bộ Thẻ Anki/Quizlet",
    "description": "Chuyển hóa tài liệu bài giảng/giáo trình thành Hệ thống Ôn tập Ghi nhớ Dài hạn: Thiết kế Lịch ôn tập ngắt quãng chống đường cong quên lãng Ebbinghaus, Bài tập Truy xuất Chủ động (Retrieval Practice) và Bộ thẻ Flashcards nguyên tử.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "knowledge-space-adaptive-learning-graph",
    "name": "Thiết Kế Đồ Thị Không Gian Tri Thức (Knowledge Space Theory), Cây Tiên Quyết & Lộ Trình Học Thích Ứng",
    "description": "Phân rã môn học thành Đồ thị Không gian Tri thức (Knowledge Space Theory - KST / DAG): Xác định các nút kiến thức nguyên tử, quan hệ tiên quyết (Prerequisite Graph), Vùng phát triển gần nhất (Outer Fringe) và bài kiểm tra chẩn đoán thích ứng.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "prisma-systematic-literature-review",
    "name": "Tổng Quan Tài Liệu Hệ Thống Chuẩn PRISMA 2020 (Chiến Lược Tìm Kiếm PICOS & Bảng Tổng Hợp Chứng Cứ)",
    "description": "Thực hiện Tổng quan Tài liệu Hệ thống (Systematic Literature Review) và Phân tích Gộp (Meta-Analysis) theo tiêu chuẩn Quốc tế PRISMA 2020: Xây dựng câu hỏi nghiên cứu PICOS/SPIDER, chuỗi truy vấn Boolean Scopus/PubMed/WoS và Ma trận Tổng hợp Nghiên cứu.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "research-grant-proposal-nafo-ministry",
    "name": "Thuyết Minh Đề Tài Nghiên Cứu Khoa Học Cấp Quốc Gia (NAFOSTED), Cấp Bộ / Tỉnh & Dự Án Quốc Tế",
    "description": "Biên soạn Hồ sơ Thuyết minh Đề tài KH&CN cấp Quốc gia (Quỹ NAFOSTED), cấp Bộ, cấp Tỉnh hoặc cấp Trường: Luận giải tính cấp thiết, tổng quan tình hình nghiên cứu trong và ngoài nước, cách tiếp cận, nội dung thực hiện, sản phẩm khoa học và dự toán kinh phí.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "vn-corporate-accounting-tt200-tt133",
    "name": "Kế Toán Doanh Nghiệp & Thuế (Thông Tư 99/2025/TT-BTC & TT133), BCTC & Quyết Toán Thuế TNDN/GTGT",
    "description": "Hướng dẫn hạch toán định khoản kế toán doanh nghiệp Việt Nam theo Thông tư 99/2025/TT-BTC (hiệu lực từ 01/01/2026, thay thế chế độ kế toán doanh nghiệp cũ năm 2014) và Thông tư 99/2025/TT-BTC, xử lý Chênh lệch tạm thời Thuế TNDN hoãn lại (TK 243/347), đối chiếu Sổ cái - Bảng CĐPS - BCTC và Quyết toán Thuế TNDN/GTGT/TNCN.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "vn-transfer-pricing-giao-dich-lien-ket",
    "name": "Hồ Sơ Xác Định Giá Giao Dịch Liên Kết (Nghị Định 132/2020/NĐ-CP) & Khống Chế Chi Phí Lãi Vay 30% EBITDA",
    "description": "Lập Hồ sơ Xác định Giá Giao dịch Liên kết (Hồ sơ Quốc gia Local File, Hồ sơ Toàn cầu Master File), Phụ lục I/II/III Nghị định 132/2020/NĐ-CP và Bảng tính Mức trần Chi phí Lãi vay được trừ (30% EBITDA) kèm chuyển tiếp 5 năm trên Excel.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "commercial-banking-alm-basel-iii",
    "name": "Quản Trị Tài Sản Nợ - Có Ngân Hàng (ALM), Rủi Ro Thanh Khoản (LCR/NSFR) & An Toàn Vốn Basel III (CAR)",
    "description": "Xây dựng báo cáo và mô hình quản trị rủi ro Ngân hàng Thương mại: Khe hở Kỳ hạn Lãi suất (Interest Rate Gap & Duration Gap), Tỷ lệ Đảm bảo Thanh khoản (LCR/NSFR), Tỷ lệ An toàn Vốn (CAR theo Thông tư 41/Basel III) và Kiểm định Sức chịu đựng (Stress Testing).",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "insurance-actuarial-underwriting-claims",
    "name": "Nghiệp Vụ Bảo Hiểm: Định Phí Bảo Hiểm (Actuarial Pricing), Thẩm Định Rủi Ro & Giám Định Bồi Thường",
    "description": "Thiết lập bảng tính và quy trình Nghiệp vụ Bảo hiểm Nhân thọ / Phi nhân thọ: Tính Phí thuần & Phí toàn bộ (Pure Premium & Gross Rate), Tỷ lệ Bồi thường (Loss Ratio), Tỷ lệ Kết hợp (Combined Ratio), Dự phòng Nghiệp vụ (IBNR) và Hồ sơ Giải quyết Quyền lợi Bảo hiểm.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "forensic-accounting-fraud-examination",
    "name": "Kế Toán Điều Tra & Kiểm Toán Phát Hiện Gian Lận Tài Chính (Beneish M-Score, Luật Benford & Red Flags)",
    "description": "Kiểm toán điều tra phát hiện gian lận và làm đẹp Báo cáo Tài chính (Financial Statement Manipulation): Tính chỉ số Beneish M-Score 8 biến, Altman Z-Score, kiểm định phân phối chữ số đầu Benford Law và truy vết dòng tiền rút ruột/hóa đơn khống.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "cost-accounting-abc-standard-costing",
    "name": "Kế Toán Quản Trị Giá Thành Sản Xuất: Tính Giá Thành Theo Hoạt Động (ABC), Định Mức BOM & Điểm Hòa Vốn",
    "description": "Thiết kế hệ thống Kế toán Quản trị Giá thành cho doanh nghiệp sản xuất: Định mức Nguyên vật liệu (Bill of Materials - BOM), phân bổ chi phí sản xuất chung theo Hoạt động (Activity-Based Costing - ABC), phân tích biến động giá thành và Điểm hòa vốn đa sản phẩm.",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "clinical-protocol-soap-medical-record",
    "name": "Chuẩn Hóa Hồ Sơ Bệnh Án Y Khoa (Cấu Trúc SOAP), Phác Đồ Điều Trị Lâm Sàng & Tờ Thông Tin Bệnh Nhân",
    "description": "Biên soạn tài liệu quản lý chuyên môn Y tế - Bệnh viện: Tóm tắt Bệnh án chuẩn cấu trúc SOAP (Subjective - Objective - Assessment - Plan), Phác đồ Chẩn đoán & Điều trị dựa trên Y học Thực chứng (EBM) và Tờ Hướng dẫn Giáo dục Sức khỏe cho người bệnh.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "pharma-gmp-regulatory-drug-dossier",
    "name": "Hồ Sơ Đăng Ký Thuốc & Thiết Bị Y Tế (ACTD/ICH), Quy Trình Sản Xuất GMP-WHO & Cảnh Giác Dược",
    "description": "Soạn thảo tài liệu Pháp chế Dược phẩm & Thiết bị Y tế (Regulatory Affairs - RA): Hồ sơ Kỹ thuật Chung ASEAN (ACTD), Quy trình Thao tác Chuẩn nhà máy dược GMP-WHO / GSP, Báo cáo Đánh giá Tương đương Sinh học và Báo cáo Phản ứng Có hại của Thuốc (ADR).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "international-logistics-incoterms-customs",
    "name": "Vận Tải Quốc Tế, Xuất Nhập Khẩu (Incoterms 2020), Phân Loại Mã HS Code, C/O & Tính Giá Vốn Hàng Nhập",
    "description": "Thiết lập bộ chứng từ Xuất Nhập Khẩu (Commercial Invoice, Packing List, Bill of Lading, L/C) và Bảng tính Giá vốn Hàng Nhập khẩu (Landed Cost Calculator) trên Excel theo 11 điều kiện Incoterms 2020, phân tích Mã HS Code và Thuế quan ưu đãi C/O.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "manufacturing-oee-tpm-production-plan",
    "name": "Quản Trị Sản Xuất Nhà Máy: Tính Hiệu Suất Thiết Bị Toàn Phần (OEE), Bảo Trì TPM & Kế Hoạch Sản Xuất MPS/MRP",
    "description": "Xây dựng bảng tính điều hành Nhà máy Sản xuất trên Excel: Đo lường Hiệu suất Thiết bị Toàn phần (OEE = Availability × Performance × Quality), phân tích 6 Tổn thất Lớn (Six Big Losses), Lịch Sản xuất Tổng thể (MPS) và Hoạch định Nhu cầu Vật tư (MRP).",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "retail-merchandising-category-otb-plan",
    "name": "Quản Trị Ngành Hàng Bán Lẻ & Chuỗi Cửa Hàng: Ngân Sách Mua Hàng (Open-To-Buy OTB), GMROI & Planogram",
    "description": "Thiết lập bảng tính Quản trị Mua hàng & Ngành hàng Chuỗi Bán lẻ (Retail Merchandising): Hoạch định Ngân sách Mua hàng Mở (Open-To-Buy - OTB), Tỷ suất Lợi nhuận Gộp trên Vốn Tồn kho (GMROI), Sell-Through Rate, WSSI và Tối ưu Doanh thu/m².",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "hospitality-hotel-revpar-yield-management",
    "name": "Quản Trị Doanh Thu Khách Sạn, Resort & Chuỗi F&B (Occupancy, ADR, RevPAR, GOPPAR & Định Giá Menu)",
    "description": "Xây dựng mô hình Quản trị Doanh thu và Vận hành Khách sạn / Khu nghỉ dưỡng ( chuẩn USALI) và Chuỗi Nhà hàng F&B trên Excel: Tối ưu Công suất phòng (Occupancy, ADR, RevPAR, TRevPAR, GOPPAR), Ma trận Kỹ thuật Thực đơn (Menu Engineering Stars/Plowhorses) và Kiểm soát Food Cost.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "vn-citizen-residence-ct01-household-forms",
    "name": "Thủ Tục Hành Chính Cư Trú, Hộ Tịch & Đơn Từ Công Dân (Tờ Khai CT01 TT 66/2023/TT-BCA, Đơn Xin Tạm Trú, Xác Nhận Nhân Thân)",
    "description": "Chuyên gia soạn thảo hệ thống biểu mẫu thủ tục hành chính công dân Việt Nam theo Luật Cư trú 2020, Thông tư 66/2023/TT-BCA và Luật Hộ tịch: Tờ khai thay đổi thông tin cư trú (Mẫu CT01) để đăng ký tạm trú / thường trú / tách hộ / gia hạn tạm trú; Đơn xin xác nhận tạm trú, xác nhận nơi cư trú, xác nhận nhân thân / hạnh kiểm có khung xác nhận của Công an xã/phường.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-land-registration-redbook-04dk-11dk",
    "name": "Hồ Sơ Đăng Ký Đất Đai, Cấp Sổ Đỏ Lần Đầu & Đăng Ký Biến Động Sang Tên (Mẫu 04/ĐK, 11/ĐK — Nghị định 101/2024/NĐ-CP & Luật Đất đai 2024)",
    "description": "Thiết kế và soạn thảo chuẩn xác hệ thống biểu mẫu hành chính đất đai theo Luật Đất đai số 31/2024/QH15 và Phụ lục Nghị định 101/2024/NĐ-CP: Đơn đăng ký đất đai, tài sản gắn liền với đất, cấp Giấy chứng nhận lần đầu (Mẫu số 04/ĐK); Đơn đăng ký biến động đất đai, sang tên chuyển nhượng, tặng cho, thừa kế, cấp đổi Sổ đỏ (Mẫu số 11/ĐK).",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-tax-declaration-refund-exemption-tt80",
    "name": "Kê Khai Thuế Nhà Đất, Lệ Phí Trước Bạ, Hoàn Thuế & Gia Hạn Nộp Thuế (Mẫu 01/LPTB, 03/BĐS-TNCN, 01/ĐNHT, 01/GHAN — Luật Quản lý thuế số 108/2025/QH15 và Thông tư 91/2026/TT-BTC)",
    "description": "Soạn thảo trọn bộ hồ sơ kê khai thuế, nộp thuế, hoàn thuế và gia hạn nộp thuế theo Luật Quản lý thuế số 108/2025/QH15 (hiệu lực 01/7/2026) và Phụ lục I Luật Quản lý thuế số 108/2025/QH15 và Thông tư 91/2026/TT-BTC: Tờ khai lệ phí trước bạ nhà đất (Mẫu 01/LPTB) và thuế TNCN chuyển nhượng BĐS (Mẫu 03/BĐS-TNCN); Giấy đề nghị hoàn trả khoản thu ngân sách nhà nước (Mẫu 01/ĐNHT); Giấy đề nghị gia hạn nộp thuế (Mẫu 01/GHAN).",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "vn-real-estate-sale-transfer-contract-nd96",
    "name": "Hợp Đồng Chuyển Nhượng Quyền Sử Dụng Đất, Mua Bán Nhà Ở & Đặt Cọc BĐS (Phụ lục Ia/Ic/VII Nghị định 96/2024/NĐ-CP)",
    "description": "Soạn thảo và rà soát Hợp đồng chuyển nhượng quyền sử dụng đất và mua bán nhà ở theo Phụ lục Nghị định 96/2024/NĐ-CP hướng dẫn Luật Kinh doanh bất động sản 2023, Luật Nhà ở 2023 và Luật Đất đai 2024: Bảng thông tin 2 bên, Đặc điểm thửa đất & nhà ở, Giá thực tế & Tiến độ thanh toán 3 đợt, Thuế phí sang tên, Cam đoan tài sản chung/riêng và Khối Lời chứng của Công chứng viên.",
    "category": "legal",
    "version": "3.3.0"
  },
  {
    "slug": "vn-primary-school-lesson-plan-cv2345",
    "name": "Kế Hoạch Bài Dạy (Giáo Án) Tiểu Học Bảng 2 Cột Chuẩn Công Văn 2345/BGDĐT-GDTH (4 Hoạt Động: Khởi động, Khám phá, Luyện tập, Vận dụng)",
    "description": "Thiết kế Kế hoạch bài dạy (Giáo án) cấp Tiểu học (Lớp 1, 2, 3, 4, 5) đúng chuẩn Phụ lục III Công văn số 2345/BGDĐT-GDTH ngày 07/6/2021 của Bộ GD&ĐT và Thông tư 27/2020/TT-BGDĐT: Mục tiêu phẩm chất & năng lực, Đồ dùng dạy học, Bảng 2 cột (Hoạt động của Giáo viên | Hoạt động của Học sinh) cho 4 hoạt động (Khởi động, Khám phá, Luyện tập - Thực hành, Vận dụng - Trải nghiệm) và Điều chỉnh sau bài dạy.",
    "category": "education",
    "version": "3.3.0"
  },
  {
    "slug": "vn-accounting-payment-voucher-forms-tt200",
    "name": "Biểu Mẫu Chứng Từ Thanh Toán, Tạm Ứng & Hoàn Ứng Kế Toán Nội Bộ (Mẫu 03-TT, 04-TT, 05-TT Thông tư 99/2025/TT-BTC (hiệu lực 01/01/2026))",
    "description": "Soạn thảo chuẩn xác hệ thống biểu mẫu chứng từ kế toán tiền tệ và thanh toán nội bộ theo Phụ lục 3 Thông tư 99/2025/TT-BTC (hiệu lực 01/01/2026) (và Thông tư 99/2025/TT-BTC): Giấy đề nghị tạm ứng (Mẫu 03-TT), Giấy thanh toán tiền tạm ứng / Hoàn ứng công tác phí (Mẫu 04-TT), Giấy đề nghị thanh toán kèm Bảng kê hóa đơn chứng từ (Mẫu 05-TT), Phiếu thu (01-TT), Phiếu chi (02-TT).",
    "category": "finance",
    "version": "3.3.0"
  },
  {
    "slug": "vn-hr-recruitment-handover-admin-forms",
    "name": "Hệ Thống Biểu Mẫu Hành Chính - Nhân Sự: Bàn Giao Công Việc/Tài Sản, Đánh Giá Thử Việc & Quyết Định Nhân Sự (BLLĐ 2019)",
    "description": "Thiết kế hệ thống biểu mẫu quản trị Hành chính - Nhân sự (HR & Admin Operations) chuẩn doanh nghiệp Việt Nam và Bộ luật Lao động 2019: Biên bản bàn giao công việc, hồ sơ tài liệu, tài sản IT & thu hồi quyền truy cập hệ thống (Offboarding / Điều chuyển); Phiếu đánh giá kết quả thử việc; Phiếu đề xuất tuyển dụng (Hiring Requisition); Quyết định bổ nhiệm / điều chỉnh lương / chấm dứt HĐLĐ.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "vn-construction-site-acceptance-forms-nd06",
    "name": "Hệ Thống Biểu Mẫu Nghiệm Thu Công Trình Xây Dựng, Nhật Ký Thi Công & Hồ Sơ Chất Lượng (Nghị định 06/2021/NĐ-CP)",
    "description": "Soạn thảo trọn bộ Hồ sơ Quản lý Chất lượng Công trình Xây dựng theo Nghị định 06/2021/NĐ-CP và Luật Xây dựng sửa đổi: Phiếu yêu cầu nghiệm thu, Biên bản nghiệm thu vật liệu/thiết bị đầu vào, Biên bản nghiệm thu công việc xây dựng (cốt thép, cốp pha, bê tông, cơ điện MEP), Biên bản nghiệm thu hoàn thành hạng mục công trình đưa vào sử dụng.",
    "category": "business",
    "version": "3.3.0"
  },
  {
    "slug": "vn-import-export-commercial-invoice-customs-forms",
    "name": "Bộ Chứng Từ Ngoại Thương & Hải Quan Xuất Nhập Khẩu (Commercial Invoice, Packing List, C/O, Tờ Khai VNACCS & Landed Cost)",
    "description": "Soạn thảo và chuẩn hóa trọn bộ Hồ sơ Chứng từ Xuất Nhập Khẩu (Import-Export Documentation) và Hải quan theo Incoterms 2020, Thông tư 38/2015/TT-BTC (sửa đổi bởi TT 39/2018/TT-BTC): Hợp đồng ngoại thương song ngữ (Sales Contract), Hóa đơn thương mại (Commercial Invoice), Phiếu đóng gói (Packing List), Công văn giải trình trị giá hải quan / mã HS và Bảng tính giá vốn hàng nhập khẩu (Landed Cost).",
    "category": "business",
    "version": "3.3.0"
  }
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
    "slug": "vn-admin-doc-nd30",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "cong van",
      "to trinh",
      "quyet dinh",
      "nghi dinh 30",
      "nd30",
      "nd 30",
      "the thuc van ban",
      "quoc hieu",
      "tieu ngu",
      "noi nhan",
      "thong bao hanh chinh",
      "van ban hanh chinh",
      "bien ban hop",
      "giay moi",
      "kinh gui",
      "vn admin doc nd30",
      "soan thao cong van to trinh chuan nghi dinh 30 2020 nd-cp"
    ]
  },
  {
    "slug": "contract-drafter",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "hop dong",
      "dieu khoan",
      "phap ly",
      "ben a",
      "ben b",
      "phat vi pham",
      "bat kha khang",
      "thanh ly hop dong",
      "phu luc hop dong",
      "thoa thuan",
      "nda",
      "bo luat dan su",
      "luat thuong mai",
      "tranh chap",
      "contract",
      "agreement",
      "legal",
      "contract drafter",
      "soan thao hop dong kinh te thuong mai"
    ]
  },
  {
    "slug": "vn-gdpt2018-lesson-plan-cv5512",
    "modules": [
      "office_docx",
      "office_markdown",
      "office_pdf",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "giao an",
      "ke hoach bai day",
      "khbd",
      "5512",
      "cong van 5512",
      "hoat dong day hoc",
      "muc tieu bai hoc",
      "nang luc",
      "pham chat",
      "khoi dong",
      "hinh thanh kien thuc",
      "luyen tap",
      "van dung",
      "lesson plan",
      "gdpt 2018",
      "chuong trinh 2018",
      "tiet hoc",
      "giao an 5512",
      "nang luc pham chat",
      "soan giao an",
      "chuyen giao nhiem vu",
      "edtech-lesson-5512",
      "vn-edtech-lesson-5512",
      "ke hoach bai day 5512",
      "phu luc iv 5512",
      "4 hoat dong day hoc",
      "giao an thcs",
      "giao an thpt",
      "vn gdpt2018 lesson plan cv5512",
      "thiet ke ke hoach bai day chuan cong van 5512 bgddt-gdtrh chuong trinh gdpt 2018"
    ]
  },
  {
    "slug": "vn-exam-matrix-specification-tt22",
    "modules": [
      "office_docx",
      "office_sheet",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "ma tran de",
      "dac ta de",
      "de kiem tra",
      "de thi",
      "trac nghiem",
      "tu luan",
      "bloom",
      "nhan biet",
      "thong hieu",
      "van dung cao",
      "7991",
      "cong van 7991",
      "dap an",
      "thang diem",
      "ngan hang cau hoi",
      "quiz",
      "exam matrix",
      "trac nghiem dung sai",
      "tra loi ngan",
      "de kiem tra dinh ky 7991",
      "cau truc de thi moi",
      "4 menh de a b c d",
      "ma tran de kiem tra",
      "ban dac ta de kiem tra",
      "thong tu 22",
      "nhan biet thong hieu van dung",
      "de kiem tra giua ky",
      "de kiem tra cuoi ky",
      "7991 bgddt-gdtrh",
      "trac nghiem tra loi ngan",
      "3 muc do nhan thuc",
      "edtech-exam-matrix",
      "de kiem tra dinh ky",
      "vn exam matrix specification tt22",
      "thiet ke ma tran ban dac ta de kiem tra dinh ky chuan cong van 7991 bgddt-gdtrh",
      "3 muc do nhan biet thong hieu van dung"
    ]
  },
  {
    "slug": "course-slides",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "slide_style",
      "slide_outline",
      "slide_page_spec",
      "slide_edit",
      "chat",
      "doc_longform",
      "sheet_formula"
    ],
    "keywords": [
      "bai giang",
      "slide bai giang",
      "giang day",
      "hoc sinh",
      "sinh vien",
      "lop hoc",
      "su pham",
      "mon hoc",
      "bai hoc",
      "kien thuc",
      "on tap",
      "chuyen de hoc tap",
      "lecture",
      "classroom",
      "course slides",
      "thiet ke bai giang trinh chieu"
    ]
  },
  {
    "slug": "rubric-builder",
    "modules": [
      "office_docx",
      "office_sheet",
      "office_markdown",
      "office_pdf",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "rubric",
      "tieu chi danh gia",
      "bang kiem",
      "phieu danh gia",
      "danh gia hoc sinh",
      "danh gia nang luc",
      "muc do dat",
      "thang danh gia",
      "rubric builder",
      "thiet ke rubric danh gia nang luc tieu chi cham diem lien tuc"
    ]
  },
  {
    "slug": "hr-payroll-3p",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "sheet_formula",
      "chat",
      "doc_longform"
    ],
    "keywords": [
      "bang luong",
      "luong 3p",
      "3p",
      "kpi",
      "bhxh",
      "bhyt",
      "bhtn",
      "bao hiem xa hoi",
      "thue tncn",
      "giam tru gia canh",
      "cham cong",
      "ngay cong",
      "phu cap",
      "thu nhap chiu thue",
      "nhan su",
      "payroll",
      "salary",
      "hr payroll 3p",
      "thiet ke thang bang luong 3p bhxh chuan bo luat lao dong vn"
    ]
  },
  {
    "slug": "financial-statement-analysis",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf",
      "office_slide"
    ],
    "stages": [
      "sheet_formula",
      "doc_longform",
      "chat"
    ],
    "keywords": [
      "bao cao tai chinh",
      "dong tien",
      "can doi ke toan",
      "ket qua kinh doanh",
      "luu chuyen tien te",
      "ebitda",
      "roe",
      "roa",
      "cfo",
      "thanh khoan",
      "bien loi nhuan",
      "doanh thu",
      "loi nhuan",
      "tai san",
      "nguon von",
      "financial statement",
      "cash flow",
      "balance sheet",
      "financial statement analysis",
      "phan tich bao cao tai chinh"
    ]
  },
  {
    "slug": "invoice-tax-checklist",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "sheet_formula",
      "chat",
      "doc_longform"
    ],
    "keywords": [
      "hoa don",
      "thue gtgt",
      "vat",
      "thue tndn",
      "khau tru thue",
      "quyet toan thue",
      "bang ke hoa don",
      "chi phi hop le",
      "ke toan thue",
      "kiem toan",
      "invoice",
      "tax",
      "invoice tax checklist",
      "danh muc kiem tra hoa don thue"
    ]
  },
  {
    "slug": "budget-planner",
    "modules": [
      "office_sheet",
      "office_slide",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "sheet_formula",
      "chat",
      "doc_longform"
    ],
    "keywords": [
      "ngan sach",
      "du phong",
      "ke hoach tai chinh",
      "chi phi",
      "dinh muc",
      "capex",
      "opex",
      "budget",
      "forecast",
      "budget planner",
      "lap ke hoach ngan sach"
    ]
  },
  {
    "slug": "data-cleaning",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "sheet_formula",
      "chat",
      "doc_longform"
    ],
    "keywords": [
      "danh sach",
      "danh sach hoc sinh",
      "lam sach",
      "chuan hoa",
      "trung lap",
      "loc du lieu",
      "sap xep",
      "tach ho ten",
      "ngay sinh",
      "gioi tinh",
      "lop",
      "clean data",
      "duplicate",
      "xls",
      "xlsx",
      "csv",
      "data cleaning",
      "lam sach chuan hoa du lieu"
    ]
  },
  {
    "slug": "data-analyst",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "sheet_formula",
      "chat",
      "doc_longform"
    ],
    "keywords": [
      "thong ke",
      "phan tich du lieu",
      "tong hop",
      "bieu do",
      "cong thuc",
      "trung binh",
      "ty le",
      "phan tram",
      "so sanh",
      "bang tinh",
      "sheet",
      "excel",
      "sum",
      "vlookup",
      "xlookup",
      "pivot",
      "tom tat noi dung",
      "tom tat bang",
      "data analyst",
      "phan tich du lieu bieu do"
    ]
  },
  {
    "slug": "executive-deck",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "slide_style",
      "slide_outline",
      "slide_page_spec",
      "slide_edit",
      "chat",
      "doc_longform",
      "sheet_formula"
    ],
    "keywords": [
      "pitch deck",
      "hoi dong quan tri",
      "chien luoc",
      "goi von",
      "startup",
      "dau tu",
      "bao cao dieu hanh",
      "executive",
      "bento",
      "q1",
      "q2",
      "q3",
      "q4",
      "okr",
      "executive deck",
      "trinh chieu bao cao dieu hanh"
    ]
  },
  {
    "slug": "slide-planner",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "slide_style",
      "slide_outline",
      "slide_page_spec",
      "slide_edit",
      "chat",
      "doc_longform",
      "sheet_formula"
    ],
    "keywords": [
      "slide",
      "thuyet trinh",
      "trinh chieu",
      "deck",
      "powerpoint",
      "pptx",
      "trang bia",
      "bo cuc",
      "slide planner",
      "hoach dinh dung bai thuyet trinh"
    ]
  },
  {
    "slug": "deep-research",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "nghien cuu",
      "luan van",
      "luan an",
      "de tai",
      "khoa hoc",
      "scopus",
      "isi",
      "apa",
      "ieee",
      "trich dan",
      "tong quan tai lieu",
      "literature review",
      "research",
      "paper",
      "pdf",
      "deep research",
      "nghien cuu chuyen sau da nguon"
    ]
  },
  {
    "slug": "report-writer",
    "modules": [
      "office_docx",
      "office_markdown",
      "office_html",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "bao cao",
      "tom tat",
      "de an",
      "ke hoach",
      "soan thao",
      "viet",
      "chinh sua",
      "report",
      "summary",
      "document",
      "report writer",
      "soan thao bao cao dieu hanh phan tich chuyen sau"
    ]
  },
  {
    "slug": "vn-citizen-residence-ct01-household-forms",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "ct01",
      "mau ct01",
      "tam tru",
      "thuong tru",
      "luu tru",
      "to khai thay doi thong tin cu tru",
      "dang ky tam tru",
      "dang ky thuong tru",
      "gia han tam tru",
      "thong tu 66 2023",
      "ho tich",
      "khai sinh",
      "thong tu 66 2023 tt-bca",
      "don xin tam tru",
      "xac nhan cu tru",
      "xac nhan nhan than",
      "xac nhan hanh kiem",
      "thu tuc hanh chinh cong dan",
      "vn citizen residence ct01 household forms",
      "thu tuc hanh chinh cu tru ho tich don tu cong dan",
      "to khai ct01 tt 66 2023 tt-bca don xin tam tru xac nhan nhan than"
    ]
  },
  {
    "slug": "vn-land-registration-redbook-04dk-11dk",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "so do",
      "cap so do",
      "04 dk",
      "11 dk",
      "mau 04 dk",
      "mau 11 dk",
      "dang ky dat dai",
      "bien dong dat dai",
      "sang ten so do",
      "quyen su dung dat",
      "luat dat dai 2024",
      "nghi dinh 101 2024",
      "thua dat",
      "to ban do",
      "mau so 04 dk",
      "mau so 11 dk",
      "don cap so do",
      "xin cap so do",
      "dang ky dat dai lan dau",
      "dang ky bien dong dat dai",
      "cap doi so do",
      "vn land registration redbook 04dk 11dk",
      "ho so dang ky dat dai cap so do lan dau dang ky bien dong sang ten",
      "mau 04 dk 11 dk nghi dinh 101 2024 nd-cp luat dat dai 2024"
    ]
  },
  {
    "slug": "vn-tax-declaration-refund-exemption-tt80",
    "modules": [
      "office_docx",
      "office_sheet",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "le phi truoc ba",
      "01 lptb",
      "hoan thue",
      "de nghi hoan thue",
      "01 dnht",
      "mien giam thue",
      "01 mgth",
      "thong tu 80 2021",
      "02 qtt tncn",
      "dong thue",
      "to khai thue",
      "mau 01 lptb",
      "to khai le phi truoc ba",
      "mau 03 bds-tncn",
      "thue chuyen nhuong bat dong san",
      "dong thue dat",
      "mau 01 dnht",
      "don hoan thue",
      "giay de nghi hoan tra khoan thu ngan sach",
      "mau 01 ghan",
      "gia han nop thue",
      "vn tax declaration refund exemption tt80",
      "ke khai thue nha dat le phi truoc ba hoan thue gia han nop thue",
      "mau 01 lptb 03 bds-tncn 01 dnht 01 ghan thong tu 80 2021 tt-btc"
    ]
  },
  {
    "slug": "vn-real-estate-sale-transfer-contract-nd96",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "mua ban nha",
      "mua ban can ho",
      "chuyen nhuong quyen su dung dat",
      "mua ban nha dat",
      "chuyen nhuong dat",
      "nghi dinh 96 2024",
      "dat coc mua nha",
      "hop dong chuyen nhuong quyen su dung dat",
      "hop dong mua ban nha dat",
      "hop dong mua ban nha o",
      "hop dong dat coc nha dat",
      "chuyen nhuong so do",
      "cong chung chuyen nhuong dat",
      "vn real estate sale transfer contract nd96",
      "hop dong chuyen nhuong quyen su dung dat mua ban nha o dat coc bds",
      "phu luc ia ic vii nghi dinh 96 2024 nd-cp"
    ]
  },
  {
    "slug": "vn-primary-school-lesson-plan-cv2345",
    "modules": [
      "office_docx",
      "office_markdown",
      "office_pdf",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "2345",
      "cong van 2345",
      "giao an tieu hoc",
      "ke hoach bai day tieu hoc",
      "lop 1",
      "lop 2",
      "lop 3",
      "lop 4",
      "lop 5",
      "giao an 2345",
      "phu luc 3 cong van 2345",
      "thong tu 27 tieu hoc",
      "soan giao an lop 1",
      "soan giao an lop 2",
      "soan giao an lop 3",
      "soan giao an lop 4",
      "soan giao an lop 5",
      "vn primary school lesson plan cv2345",
      "ke hoach bai day tieu hoc bang 2 cot chuan cong van 2345 bgddt-gdth",
      "giao an",
      "4 hoat dong khoi dong kham pha luyen tap van dung"
    ]
  },
  {
    "slug": "vn-accounting-payment-voucher-forms-tt200",
    "modules": [
      "office_docx",
      "office_sheet",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "giay de nghi thanh toan",
      "de nghi thanh toan",
      "05 tt",
      "mau 05 tt",
      "de nghi tam ung",
      "thanh toan tam ung",
      "hoan ung",
      "phieu thu",
      "phieu chi",
      "doi chieu cong no",
      "mau 05-tt",
      "giay de nghi tam ung",
      "mau 03-tt",
      "giay thanh toan tien tam ung",
      "mau 04-tt",
      "hoan ung cong tac phi",
      "phieu thu 01-tt",
      "phieu chi 02-tt",
      "bieu mau ke toan thong tu 200",
      "vn accounting payment voucher forms tt200",
      "bieu mau chung tu thanh toan tam ung hoan ung ke toan noi bo",
      "mau 03-tt 04-tt 05-tt thong tu 99 2025 tt-btc hieu luc 01 01 2026"
    ]
  },
  {
    "slug": "vn-hr-recruitment-handover-admin-forms",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "ban giao cong viec",
      "bien ban ban giao",
      "ban giao tai san",
      "ban giao nghi viec",
      "de xuat tuyen dung",
      "danh gia thu viec",
      "bien ban ban giao cong viec",
      "ban giao tai san nhan su",
      "bien ban ban giao nghi viec",
      "phieu danh gia thu viec",
      "phieu de xuat tuyen dung",
      "quyet dinh bo nhiem",
      "quyet dinh cham dut hop dong lao dong",
      "bieu mau hanh chinh nhan su",
      "vn hr recruitment handover admin forms",
      "he thong bieu mau hanh chinh - nhan su ban giao cong viec tai san danh gia thu viec quyet dinh nhan su",
      "blld 2019"
    ]
  },
  {
    "slug": "vn-construction-site-acceptance-forms-nd06",
    "modules": [
      "office_docx",
      "office_sheet",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "nghiem thu xay dung",
      "nghiem thu cong viec xay dung",
      "nghi dinh 06 2021",
      "nghiem thu cot thep",
      "nghiem thu be tong",
      "nhat ky thi cong",
      "boq",
      "ipc",
      "bien ban nghiem thu xay dung",
      "phieu yeu cau nghiem thu",
      "nghiem thu vat lieu dau vao",
      "ho so chat luong cong trinh",
      "vn construction site acceptance forms nd06",
      "he thong bieu mau nghiem thu cong trinh xay dung nhat ky thi cong ho so chat luong",
      "nghi dinh 06 2021 nd-cp"
    ]
  },
  {
    "slug": "vn-import-export-commercial-invoice-customs-forms",
    "modules": [
      "office_docx",
      "office_sheet",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "commercial invoice",
      "packing list",
      "hop dong ngoai thuong",
      "sales contract",
      "xuat nhap khau",
      "hai quan",
      "incoterms",
      "ma hs",
      "tham van gia",
      "chung tu xuat nhap khau",
      "ho so hai quan",
      "cong van giai trinh hai quan",
      "tham van gia hai quan",
      "incoterms 2020",
      "vn import export commercial invoice customs forms",
      "bo chung tu ngoai thuong hai quan xuat nhap khau",
      "commercial invoice packing list c o to khai vnaccs landed cost"
    ]
  },
  {
    "slug": "vn-legal-irac-reasoning-engine",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown"
    ],
    "stages": [
      "doc_longform",
      "chat"
    ],
    "keywords": [
      "irac",
      "creac",
      "tu duy phap ly",
      "phan tich tinh huong phap ly",
      "don khoi kien",
      "23 ds",
      "mau 23 ds",
      "ban luan cu",
      "tranh tung",
      "an le"
    ]
  },
  {
    "slug": "cfo-dcf-valuation-modeler",
    "modules": [
      "office_sheet",
      "office_docx"
    ],
    "stages": [
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "dcf",
      "wacc",
      "fcff",
      "fcfe",
      "terminal value",
      "dinh gia doanh nghiep",
      "npv",
      "irr",
      "dong tien chiet khau"
    ]
  },
  {
    "slug": "clinical-protocol-soap-medical-record",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "chat",
      "sheet_formula"
    ],
    "keywords": [
      "benh an",
      "soap",
      "hoi chan",
      "lam sang",
      "phac do dieu tri",
      "y khoa",
      "benh vien",
      "ho so benh an",
      "benh an soap",
      "y hoc thuc chung",
      "chan doan phan biet",
      "giao duc suc khoe",
      "clinical protocol soap medical record",
      "chuan hoa ho so benh an y khoa phac do dieu tri lam sang to thong tin benh nhan",
      "cau truc soap"
    ]
  },
  {
    "slug": "manufacturing-oee-lean-six-sigma",
    "modules": [
      "office_docx",
      "office_sheet",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "ncr",
      "capa",
      "8d",
      "5 whys",
      "oee",
      "six sigma",
      "iatf 16949",
      "su co chat luong",
      "khong phu hop"
    ]
  },
  {
    "slug": "lbo-leveraged-buyout-model",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lbo",
      "leveraged buyout",
      "private equity",
      "sources and uses",
      "debt sweep",
      "moic",
      "don bay tai chinh",
      "mua lai doanh nghiep",
      "lbo leveraged buyout model",
      "mo hinh mua lai bang don bay tai chinh lbo thac tra no",
      "private equity lbo"
    ]
  },
  {
    "slug": "comparable-company-analysis-comps",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "comps",
      "trading comps",
      "precedent transactions",
      "ev ebitda",
      "p e",
      "boi so dinh gia",
      "dinh gia so sanh",
      "peer group",
      "comparable company analysis comps",
      "dinh gia so sanh boi so thi truong",
      "trading comps precedent transactions"
    ]
  },
  {
    "slug": "merger-accretion-dilution-ma",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "merger model",
      "accretion dilution",
      "m a model",
      "pro forma eps",
      "synergies",
      "cong huong",
      "pha loang eps",
      "mua ban sap nhap",
      "merger accretion dilution ma",
      "mo hinh sap nhap m a accretion dilution cong huong tai chinh"
    ]
  },
  {
    "slug": "cim-confidential-info-memorandum",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "cim",
      "confidential information memorandum",
      "info memo",
      "offering memorandum",
      "sell-side m a",
      "ban cong bo thong tin",
      "cim confidential info memorandum",
      "soan thao ban cong bo thong tin bao mat m a",
      "sell-side cim 8 chuong"
    ]
  },
  {
    "slug": "saas-arr-cohort-waterfall",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "arr waterfall",
      "arr bridge",
      "net dollar retention",
      "ndr",
      "gdr",
      "expansion mrr",
      "churn mrr",
      "cohort retention",
      "saas arr cohort waterfall",
      "mo hinh thac doanh thu arr bridge phan tich giu chan cohort",
      "saas revenue waterfall"
    ]
  },
  {
    "slug": "working-capital-cash-conversion",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "von luu dong",
      "working capital",
      "13-week cash flow",
      "dong tien 13 tuan",
      "ccc",
      "dso",
      "dio",
      "dpo",
      "thanh khoan",
      "working capital cash conversion",
      "quan tri von luu dong chu ky tien mat ccc du bao thanh khoan 13 tuan",
      "treasury"
    ]
  },
  {
    "slug": "variance-analysis-budget-vs-actual",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "budget vs actual",
      "bva",
      "variance analysis",
      "phan tich bien dong",
      "chenh lech ngan sach",
      "price volume mix",
      "thuc hien so voi ke hoach",
      "variance analysis budget vs actual",
      "phan tich bien dong thuc te vs ngan sach",
      "bva variance price-volume-mix"
    ]
  },
  {
    "slug": "cap-table-dilution-waterfall",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "cap table",
      "pha loang co phan",
      "esop",
      "safe note",
      "convertible note",
      "pre-money",
      "post-money",
      "liquidation preference",
      "exit waterfall",
      "cap table dilution waterfall",
      "bang cau truc von co phan cap table esop safe phan chia thoai von"
    ]
  },
  {
    "slug": "internal-audit-sox-controls",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "kiem toan noi bo",
      "internal audit",
      "risk control matrix",
      "rcm",
      "coso",
      "sox",
      "kiem soat noi bo",
      "gian lan tai chinh",
      "internal audit sox controls",
      "kiem toan noi bo ma tran kiem soat rui ro bao cao kiem toan coso"
    ]
  },
  {
    "slug": "credit-underwriting-debt-covenants",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "tham dinh tin dung",
      "credit underwriting",
      "dscr",
      "interest coverage",
      "debt covenants",
      "khe uoc vay",
      "ho so vay von",
      "credit underwriting debt covenants",
      "tham dinh tin dung doanh nghiep kha nang tra no dscr giam sat khe uoc vay"
    ]
  },
  {
    "slug": "saas-msa-sla-negotiation",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "msa",
      "sla",
      "master services agreement",
      "service level agreement",
      "uptime 99.9",
      "service credits",
      "hop dong phan mem",
      "hop dong saas",
      "saas msa sla negotiation",
      "soan thao dam phan hop dong dich vu dam may msa cam ket sla service credits"
    ]
  },
  {
    "slug": "data-privacy-dpa-nd13",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "nghi dinh 13 2023",
      "nd13",
      "du lieu ca nhan",
      "dpa",
      "dpia",
      "gdpr",
      "bao ve du lieu ca nhan",
      "a05 bo cong an",
      "data privacy dpa nd13",
      "thoa thuan xu ly du lieu ca nhan dpa ho so danh gia tac dong luat bao ve du lieu ca nhan so 91 2025 qh15 va nghi dinh 356 2025 nd-cp",
      "hieu luc 01 01 2026"
    ]
  },
  {
    "slug": "ip-licensing-technology-transfer",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "chuyen giao cong nghe",
      "so huu tri tue",
      "ip licensing",
      "ban quyen phan mem",
      "royalty",
      "source code escrow",
      "luat so huu tri tue",
      "ip licensing technology transfer",
      "hop dong chuyen giao cong nghe cap phep so huu tri tue ma nguon"
    ]
  },
  {
    "slug": "shareholder-agreement-sha-term-sheet",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "thoa thuan co dong",
      "sha",
      "shareholders agreement",
      "term sheet",
      "rofr",
      "tag-along",
      "drag-along",
      "anti-dilution",
      "vesting",
      "luat doanh nghiep",
      "shareholder agreement sha term sheet",
      "thoa thuan co dong term sheet dau tu quyen bao ve nha dau tu"
    ]
  },
  {
    "slug": "employment-dispute-disciplinary",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "ky luat lao dong",
      "sa thai",
      "cham dut hop dong lao dong",
      "bien ban ky luat",
      "nghi dinh 145",
      "tranh chap lao dong",
      "don phuong cham dut hdld",
      "employment dispute disciplinary",
      "quy trinh xu ly ky luat lao dong bien ban sa thai giai quyet tranh chap blld 2019"
    ]
  },
  {
    "slug": "corporate-governance-charter-resolution",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "dieu le cong ty",
      "nghi quyet hdqt",
      "nghi quyet dhdcd",
      "dai hoi dong co dong",
      "hoi dong thanh vien",
      "bien ban hop hdqt",
      "quy che quan tri",
      "corporate governance charter resolution",
      "dieu le cong ty nghi quyet dhdcd hdqt quy che quan tri noi bo",
      "luat doanh nghiep"
    ]
  },
  {
    "slug": "commercial-lease-real-estate-contract",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "hop dong thue van phong",
      "hop dong thue mat bang",
      "thue kho xuong",
      "commercial lease",
      "fit-out",
      "tien dat coc thue nha",
      "hoan tra mat bang",
      "commercial lease real estate contract",
      "tham dinh soan thao hop dong thue van phong mat bang thuong mai kho xuong"
    ]
  },
  {
    "slug": "competency-framework-career-ladder",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "khung nang luc",
      "tu dien nang luc",
      "ask",
      "career path",
      "career ladder",
      "lo trinh thang tien",
      "competency framework",
      "danh gia nang luc",
      "competency framework career ladder",
      "xay dung khung nang luc ask tu dien nang luc lo trinh thang tien"
    ]
  },
  {
    "slug": "structured-interview-scorecard",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "phong van",
      "cau hoi phong van",
      "star interview",
      "interview kit",
      "scorecard tuyen dung",
      "danh gia ung vien",
      "bai test tuyen dung",
      "structured interview scorecard",
      "bo cau hoi phong van hanh vi star bai test tinh huong bang cham diem ung vien"
    ]
  },
  {
    "slug": "org-design-headcount-planning",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "dinh bien nhan su",
      "headcount plan",
      "co cau to chuc",
      "org chart",
      "quy luong",
      "workforce planning",
      "ke hoach tuyen dung",
      "org design headcount planning",
      "thiet ke co cau to chuc dinh bien nhan su du toan quy luong nam"
    ]
  },
  {
    "slug": "employee-engagement-pulse-survey",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "khao sat gan ket",
      "enps",
      "employee engagement",
      "giu chan nhan su",
      "ty le nghi viec",
      "turnover rate",
      "exit interview",
      "employee engagement pulse survey",
      "khao sat gan ket nhan su enps phan tich nghi viec chien luoc giu chan nhan tai"
    ]
  },
  {
    "slug": "corporate-training-curriculum-ld",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "dao tao noi bo",
      "l d",
      "learning and development",
      "tna",
      "nhu cau dao tao",
      "kirkpatrick",
      "70-20-10",
      "ke hoach dao tao",
      "corporate training curriculum ld",
      "xay dung khung chuong trinh dao tao noi bo ma tran ky nang danh gia kirkpatrick"
    ]
  },
  {
    "slug": "employee-handbook-code-of-conduct",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "so tay nhan vien",
      "employee handbook",
      "noi quy lao dong",
      "code of conduct",
      "quy tac ung xu",
      "van hoa doanh nghiep",
      "employee handbook code of conduct",
      "bien soan so tay nhan vien quy tac ung xu dao duc noi quy lao dong doanh nghiep"
    ]
  },
  {
    "slug": "conversion-copywriting-landing-page",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "landing page",
      "copywriting",
      "cro",
      "toi uu chuyen doi",
      "pas",
      "aida",
      "sales page",
      "viet quang cao",
      "cta",
      "conversion copywriting landing page",
      "nghe thuat copywriting chuyen doi cao cau truc landing page toi uu cro",
      "pas aida"
    ]
  },
  {
    "slug": "programmatic-seo-pillar-cluster",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "seo",
      "programmatic seo",
      "topic cluster",
      "pillar page",
      "topical authority",
      "search intent",
      "ai seo",
      "geo",
      "tu khoa seo",
      "programmatic seo pillar cluster",
      "chien luoc noi dung seo topical authority cum chu de pillar-cluster ai search"
    ]
  },
  {
    "slug": "paid-media-roas-attribution",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "quang cao",
      "meta ads",
      "facebook ads",
      "google ads",
      "tiktok ads",
      "roas",
      "cpa",
      "media mix",
      "ngan sach quang cao",
      "paid media roas attribution",
      "toi uu quang cao da kenh media mix phan bo ngan sach roas",
      "meta google tiktok ads"
    ]
  },
  {
    "slug": "email-lifecycle-drip-automation",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "email marketing",
      "drip campaign",
      "lifecycle marketing",
      "email automation",
      "onboarding email",
      "win-back",
      "abandoned cart",
      "zalo zns",
      "email lifecycle drip automation",
      "chuoi email tu dong hoa vong doi khach hang",
      "onboarding nurturing win-back flows"
    ]
  },
  {
    "slug": "brand-positioning-messaging-house",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "dinh vi thuong hieu",
      "brand positioning",
      "messaging house",
      "brand guidelines",
      "brand voice",
      "kien truc thuong hieu",
      "april dunford",
      "brand positioning messaging house",
      "dinh vi thuong hieu kien truc thong diep cam nang thuong hieu"
    ]
  },
  {
    "slug": "ab-testing-experimentation-framework",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "a b testing",
      "ab test",
      "thu nghiem tang truong",
      "growth experiment",
      "ice score",
      "y nghia thong ke",
      "p-value",
      "conversion test",
      "ab testing experimentation framework",
      "khung thu nghiem tang truong a b testing gia thuyet ice kiem dinh thong ke"
    ]
  },
  {
    "slug": "influencer-kol-koc-affiliate-campaign",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "kol",
      "koc",
      "influencer marketing",
      "affiliate",
      "livestream",
      "tiktok shop",
      "shopee mall",
      "booking kol",
      "brief kol",
      "influencer kol koc affiliate campaign",
      "ke hoach tiep thi kol koc affiliate livestream tiktok shopee hop dong booking"
    ]
  },
  {
    "slug": "meddpicc-enterprise-deal-qualification",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "meddpicc",
      "b2b sales",
      "enterprise sales",
      "tham dinh deal",
      "mutual action plan",
      "close plan",
      "economic buyer",
      "champion",
      "meddpicc enterprise deal qualification",
      "tham dinh co hoi ban hang lon b2b theo khung meddpicc chien luoc dong deal"
    ]
  },
  {
    "slug": "b2b-cold-outreach-sequence",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "cold email",
      "cold call",
      "telesales",
      "b2b outreach",
      "kich ban goi dien",
      "tiep can khach hang",
      "sdr",
      "bdr",
      "linkedin outreach",
      "b2b cold outreach sequence",
      "chuoi kich ban tiep can khach hang b2b da diem cham",
      "cold email linkedin zalo telesales"
    ]
  },
  {
    "slug": "sales-objection-battlecard",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "battlecard",
      "xu ly tu choi",
      "objection handling",
      "doi thu canh tranh",
      "so sanh doi thu",
      "kich ban ban hang",
      "dam phan gia",
      "sales objection battlecard",
      "the chien dau canh tranh kich ban xu ly tu choi",
      "competitive battlecards"
    ]
  },
  {
    "slug": "sales-commission-quota-comp-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "hoa hong kinh doanh",
      "sales commission",
      "quota",
      "ote",
      "chinh sach thuong sales",
      "kpi sales",
      "comp plan",
      "accelerator",
      "sales commission quota comp plan",
      "thiet ke co che hoa hong kinh doanh giao chi tieu quota ote accelerator tren excel"
    ]
  },
  {
    "slug": "strategic-account-expansion-qbr",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "qbr",
      "quarterly business review",
      "key account",
      "khach hang trong diem",
      "account plan",
      "upsell",
      "cross-sell",
      "ebr",
      "strategic account expansion qbr",
      "ke hoach mo rong khach hang trong diem hop danh gia quy",
      "key account plan",
      "executive qbr"
    ]
  },
  {
    "slug": "channel-partner-reseller-program",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "dai ly phan phoi",
      "channel partner",
      "reseller",
      "chinh sach dai ly",
      "chiet khau dai ly",
      "deal registration",
      "nha phan phoi",
      "channel partner reseller program",
      "xay dung chinh sach dai ly phan phoi chiet khau kenh deal registration"
    ]
  },
  {
    "slug": "jobs-to-be-done-user-research",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "jobs to be done",
      "jtbd",
      "nghien cuu nguoi dung",
      "user research",
      "customer journey map",
      "hanh trinh khach hang",
      "mom test",
      "user persona",
      "jobs to be done user research",
      "nghien cuu nguoi dung theo khung jobs-to-be-done ban do hanh trinh phong van sau"
    ]
  },
  {
    "slug": "competitive-intelligence-porter-5-forces",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "porter 5 forces",
      "5 ap luc canh tranh",
      "pestle",
      "dai duong xanh",
      "blue ocean strategy",
      "errc",
      "phan tich canh tranh",
      "chien luoc kinh doanh",
      "competitive intelligence porter 5 forces",
      "phan tich chien luoc canh tranh",
      "porter 5 forces pestle dai duong xanh ma tran errc"
    ]
  },
  {
    "slug": "business-model-lean-canvas-architect",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "business model canvas",
      "lean canvas",
      "mo hinh kinh doanh",
      "value proposition canvas",
      "tuyen ngon gia tri",
      "khoi nghiep",
      "startup",
      "business model lean canvas architect",
      "thiet ke mo hinh kinh doanh",
      "business model canvas lean canvas value proposition canvas"
    ]
  },
  {
    "slug": "product-roadmap-now-next-later",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "product roadmap",
      "lo trinh san pham",
      "now next later",
      "ke hoach san pham",
      "phan bo nguon luc",
      "r d",
      "quan tri san pham",
      "product roadmap now next later",
      "hoach dinh lo trinh san pham phan bo nguon luc r d",
      "now-next-later outcome roadmap"
    ]
  },
  {
    "slug": "pricing-packaging-monetization",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "dinh gia san pham",
      "pricing strategy",
      "monetization",
      "bang gia",
      "good better best",
      "value-based pricing",
      "van westendorp",
      "chien luoc gia",
      "pricing packaging monetization",
      "chien luoc dinh gia san pham dong goi good-better-best van westendorp"
    ]
  },
  {
    "slug": "agile-sprint-retrospective-scrum",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "agile",
      "scrum",
      "sprint planning",
      "user story",
      "retrospective",
      "epic",
      "story points",
      "definition of done",
      "jira backlog",
      "agile sprint retrospective scrum",
      "quan tri agile scrum chuyen nghiep sprint planning tach epic user stories dod retrospective"
    ]
  },
  {
    "slug": "supply-chain-inventory-eoq-safety-stock",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "ton kho",
      "chuoi cung ung",
      "supply chain",
      "eoq",
      "safety stock",
      "ton kho an toan",
      "reorder point",
      "phan tich abc",
      "vong quay hang ton kho",
      "supply chain inventory eoq safety stock",
      "toi uu ton kho chuoi cung ung mo hinh eoq ton kho an toan rop phan tich abc xyz"
    ]
  },
  {
    "slug": "lean-six-sigma-dmaic-kaizen",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lean six sigma",
      "dmaic",
      "kaizen",
      "cai tien quy trinh",
      "5 whys",
      "fishbone",
      "ishikawa",
      "fmea",
      "value stream mapping",
      "8 lang phi",
      "lean six sigma dmaic kaizen",
      "cai tien quy trinh lean six sigma phan tich goc re 5 whys fishbone loai bo 8 lang phi"
    ]
  },
  {
    "slug": "strategic-sourcing-tco-negotiation",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "mua sam",
      "procurement",
      "strategic sourcing",
      "tco",
      "total cost of ownership",
      "danh gia nha cung cap",
      "kraljic",
      "dam phan mua hang",
      "strategic sourcing tco negotiation",
      "chien luoc mua sam tap trung phan tich tong chi phi so huu ma tran kraljic"
    ]
  },
  {
    "slug": "pmp-project-charter-wbs-risk-register",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "quan ly du an",
      "pmp",
      "pmbok",
      "project charter",
      "wbs",
      "risk register",
      "so dang ky rui ro",
      "earned value",
      "cpi",
      "spi",
      "gantt chart",
      "pmp project charter wbs risk register",
      "quan ly du an chuan pmi pmp tuyen bo du an wbs evm so dang ky rui ro"
    ]
  },
  {
    "slug": "business-continuity-disaster-recovery",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "bcp",
      "drp",
      "business continuity",
      "disaster recovery",
      "khoi phuc tham hoa",
      "rto",
      "rpo",
      "iso 22301",
      "ung pho khung hoang",
      "business continuity disaster recovery",
      "ke hoach duy tri hoat dong kinh doanh khoi phuc tham hoa ung pho khung hoang"
    ]
  },
  {
    "slug": "quality-management-iso9001-capa",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "iso 9001",
      "quan ly chat luong",
      "qa qc",
      "capa",
      "ncr",
      "danh gia noi bo",
      "internal audit",
      "khac phuc phong ngua",
      "8d report",
      "quality management iso9001 capa",
      "he thong quan ly chat luong iso 9001 danh muc danh gia noi bo bao cao capa",
      "audit checklist"
    ]
  },
  {
    "slug": "system-architecture-rfc-adr",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "kien truc he thong",
      "system architecture",
      "rfc",
      "adr",
      "system design",
      "microservices",
      "c4 model",
      "thiet ke ky thuat",
      "capacity planning",
      "system architecture rfc adr",
      "thiet ke kien truc he thong phan tan tai lieu ky thuat rfc ban ghi quyet dinh adr so do c4"
    ]
  },
  {
    "slug": "cybersecurity-iso27001-soc2-incident",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "an toan thong tin",
      "an ninh mang",
      "cybersecurity",
      "iso 27001",
      "soc 2",
      "stride",
      "threat modeling",
      "ung cuu su co bao mat",
      "zero trust",
      "cybersecurity iso27001 soc2 incident",
      "chinh sach an toan thong tin iso 27001 soc 2 mo hinh de doa stride ung cuu su co bao mat"
    ]
  },
  {
    "slug": "postmortem-rca-sre-runbook",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "postmortem",
      "rca",
      "root cause analysis",
      "bao cao su co",
      "sre",
      "runbook",
      "downtime",
      "outage",
      "incident report",
      "postmortem rca sre runbook",
      "bao cao phan tich su co khong do loi rca 5 whys so tay sre runbook",
      "blameless postmortem"
    ]
  },
  {
    "slug": "sql-data-warehouse-etl-modeling",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "data warehouse",
      "kho du lieu",
      "star schema",
      "etl",
      "elt",
      "data modeling",
      "dbt",
      "data governance",
      "tu dien du lieu",
      "sql",
      "sql data warehouse etl modeling",
      "thiet ke kho du lieu duong ong etl elt quan tri du lieu",
      "star snowflake schema"
    ]
  },
  {
    "slug": "executive-bi-data-storytelling",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "data storytelling",
      "ke chuyen bang du lieu",
      "bi dashboard",
      "truc quan hoa du lieu",
      "data visualization",
      "phan tich du lieu",
      "insight",
      "executive bi data storytelling",
      "nghe thuat ke chuyen bang du lieu thiet ke bi dashboard phan tich bat thuong"
    ]
  },
  {
    "slug": "excel-executive-dashboard-architect",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "excel dashboard",
      "bao cao quan tri excel",
      "kpi dashboard",
      "bang dieu khien excel",
      "sumifs",
      "index match",
      "conditional formatting",
      "excel executive dashboard architect",
      "kien truc bang dieu khien excel da phan tu",
      "kpi cards cong thuc dong sparklines kiem toan mo hinh"
    ]
  },
  {
    "slug": "customer-health-score-churn-playbooks",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "customer success",
      "health score",
      "churn",
      "giu chan khach hang",
      "chong roi bo",
      "nps",
      "csat",
      "csm playbook",
      "renewal",
      "customer health score churn playbooks",
      "mo hinh diem suc khoe khach hang canh bao som roi bo kich ban giu chan",
      "customer health score"
    ]
  },
  {
    "slug": "enterprise-onboarding-implementation-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "onboarding khach hang",
      "trien khai he thong",
      "implementation plan",
      "go-live",
      "uat",
      "time to value",
      "chuyen giao he thong",
      "kickoff",
      "enterprise onboarding implementation plan",
      "ke hoach trien khai chuyen giao he thong khach hang lon",
      "30-60-90 day onboarding time-to-value"
    ]
  },
  {
    "slug": "crisis-escalation-apology-comms",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "xu ly khung hoang",
      "thu xin loi khach hang",
      "giai trinh su co",
      "khieu nai khach hang",
      "crisis communication",
      "vi pham sla",
      "phuc hoi niem tin",
      "crisis escalation apology comms",
      "nghe thuat xu ly khieu nai nghiem trong cong van giai trinh su co sla truyen thong phuc hoi niem tin"
    ]
  },
  {
    "slug": "mckinsey-22-chart-exhibit-selector",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "bieu do mckinsey",
      "mckinsey chart",
      "waterfall chart",
      "marimekko",
      "mekko chart",
      "tornado chart",
      "harvey balls",
      "ma tran 2x2",
      "bieu do chien luoc",
      "mckinsey 22 chart exhibit selector",
      "22 mau bieu do chien luoc chuan mckinsey",
      "marimekko waterfall tornado bullet 2 2 matrix harvey balls"
    ]
  },
  {
    "slug": "dashi-12-editorial-slide-themes",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "thiet ke slide dep",
      "bento grid",
      "swiss design",
      "slide nghe thuat",
      "editorial slide",
      "keynote style",
      "dark mode slide",
      "dashi slide",
      "dashi 12 editorial slide themes",
      "12 he tham my slide duong dai dashi",
      "bento grid swiss international luxury editorial dark tech"
    ]
  },
  {
    "slug": "morph-cinematic-slide-choreography",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "morph transition",
      "powerpoint morph",
      "hieu ung morph",
      "chuyen canh slide",
      "cinematic slide",
      "slide animation",
      "hieu ung chuyen dong",
      "morph cinematic slide choreography",
      "thiet ke chuyen canh dien anh powerpoint morph",
      "scene actors scene- actor- ghosting 36cm"
    ]
  },
  {
    "slug": "academic-paper-ieee-apa-latex",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "bai bao khoa hoc",
      "nghien cuu khoa hoc",
      "luan van",
      "luan an",
      "imrad",
      "apa 7",
      "ieee",
      "scopus",
      "isi",
      "literature review",
      "phan bien khoa hoc",
      "academic paper ieee apa latex",
      "bien soan bai bao khoa hoc quoc te luan van thac si tien si chuan apa 7 ieee phan bien"
    ]
  },
  {
    "slug": "annual-report-esg-sustainability",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "bao cao thuong nien",
      "annual report",
      "esg",
      "phat trien ben vung",
      "sustainability report",
      "gri",
      "net zero",
      "tin chi carbon",
      "scope 1 2 3",
      "annual report esg sustainability",
      "bao cao thuong nien doanh nghiep bao cao phat trien ben vung esg",
      "chuan gri net zero"
    ]
  },
  {
    "slug": "construction-boq-fidic-dossier",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "xay dung cong trinh",
      "du toan xay dung",
      "boq",
      "bill of quantities",
      "fidic",
      "nghiem thu cong trinh",
      "ho so thanh toan",
      "ipc",
      "nhat ky thi cong",
      "epc",
      "construction boq fidic dossier",
      "du toan khoi luong xay dung hop dong fidic nhat ky thi cong ho so nghiem thu cong trinh"
    ]
  },
  {
    "slug": "vn-legislative-normative-drafting",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "van ban quy pham phap luat",
      "vbqppl",
      "du thao nghi dinh",
      "du thao thong tu",
      "danh gia tac dong chinh sach",
      "ria",
      "ky thuat lap quy",
      "to trinh chinh phu",
      "vn legislative normative drafting",
      "ky thuat soan thao van ban quy pham phap luat danh gia tac dong chinh sach"
    ]
  },
  {
    "slug": "vn-court-petition-civil-litigation",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "don khoi kien",
      "ban tu khai",
      "don phan to",
      "don khang cao",
      "to tung dan su",
      "bien phap khan cap tam thoi",
      "khoi kien ra toa",
      "mau 23-ds",
      "vn court petition civil litigation",
      "soan thao don khoi kien ban tu khai don phan to don khang cao to tung dan su thuong mai"
    ]
  },
  {
    "slug": "vn-administrative-complaint-denunciation",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "don khieu nai",
      "khieu nai hanh chinh",
      "don to cao",
      "vu an hanh chinh",
      "quyet dinh hanh chinh",
      "xu phat vi pham hanh chinh",
      "luat khieu nai",
      "vn administrative complaint denunciation",
      "soan thao don khieu nai quyet dinh hanh chinh don to cao khoi kien vu an hanh chinh"
    ]
  },
  {
    "slug": "vn-enterprise-licensing-investment-irc-erc",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "giay chung nhan dang ky dau tu",
      "irc",
      "erc",
      "dang ky doanh nghiep",
      "nha dau tu nuoc ngoai",
      "fdi",
      "luat dau tu 2020",
      "giay phep con",
      "ma nganh vsic",
      "vn enterprise licensing investment irc erc",
      "ho so dang ky dau tu dang ky doanh nghiep m a von nuoc ngoai giay phep con"
    ]
  },
  {
    "slug": "vn-land-real-estate-legal-dossier",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "luat dat dai 2024",
      "luat kinh doanh bat dong san 2023",
      "luat nha o 2023",
      "phap ly du an bat dong san",
      "quyen su dung dat",
      "nha o hinh thanh trong tuong lai",
      "hop dong dat coc bat dong san",
      "vn land real estate legal dossier",
      "phap ly du an bat dong san dat dai hop dong mua ban can ho chuyen nhuong du an"
    ]
  },
  {
    "slug": "vn-tax-inspection-explanation-appeal",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "giai trinh thue",
      "thanh tra thue",
      "kiem tra thue",
      "quyet toan thue",
      "chi phi duoc tru",
      "hoan thue gtgt",
      "an dinh thue",
      "cong van thue",
      "vn tax inspection explanation appeal",
      "cong van giai trinh thanh tra kiem tra thue quyet toan thue tndn gtgt khieu nai an dinh thue"
    ]
  },
  {
    "slug": "vn-intellectual-property-trademark-patent",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "nhan hieu",
      "cuc so huu tri tue",
      "dang ky nhan hieu",
      "ban quyen tac gia",
      "sang che",
      "kieu dang cong nghiep",
      "xam pham so huu tri tue",
      "phan loai nice",
      "vipri",
      "vn intellectual property trademark patent",
      "ho so dang ky nhan hieu ban quyen sang che xu ly xam pham so huu tri tue",
      "cuc shtt"
    ]
  },
  {
    "slug": "vn-notary-inheritance-matrimonial-law",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "di chuc",
      "thua ke",
      "di san thua ke",
      "tai san vo chong",
      "tai san rieng",
      "cong chung",
      "hang thua ke",
      "luat hon nhan va gia dinh",
      "vn notary inheritance matrimonial law",
      "van ban cong chung di chuc phan chia di san thua ke thoa thuan tai san vo chong"
    ]
  },
  {
    "slug": "legal-reasoning-irac-crac-memorandum",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "tu duy luat",
      "tu duy phap ly",
      "irac",
      "crac",
      "creac",
      "legal opinion",
      "legal memorandum",
      "y kien phap ly",
      "thu tu van phap ly",
      "phan tich tinh huong phap ly",
      "legal reasoning irac crac memorandum",
      "tu duy phap ly cau truc irac crac creac soan thao ban tu van phap ly"
    ]
  },
  {
    "slug": "litigation-opposing-counsel-simulator",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "luat su doi phuong",
      "opposing counsel",
      "chien thuat tranh tung",
      "gia lap tranh tung",
      "phan bien phap ly",
      "red team phap ly",
      "du doan doi phuong",
      "litigation opposing counsel simulator",
      "gia lap chien thuat luat su doi phuong kich ban phan cong",
      "opposing counsel simulator"
    ]
  },
  {
    "slug": "judge-arbitrator-bench-perspective",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "goc nhin tham phan",
      "hoi dong xet xu",
      "hoi dong trong tai",
      "bench perspective",
      "danh gia chung cu",
      "nhan dinh cua toa an",
      "ban an",
      "judge arbitrator bench perspective",
      "phan tich vu viec tu goc nhin tham phan hoi dong trong tai",
      "bench perspective chung cu"
    ]
  },
  {
    "slug": "cross-examination-hearing-rehearsal",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "xet hoi tai phien toa",
      "cross-examination",
      "kich ban xet hoi",
      "hoi dap phien toa",
      "nhan chung",
      "phien hop trong tai",
      "ky nang tranh tung",
      "cross examination hearing rehearsal",
      "kich ban xet hoi cheo tai phien toa trong tai chuan bi nhan chung"
    ]
  },
  {
    "slug": "litigation-settlement-ev-decision-tree",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "hoa giai thuong mai",
      "settlement vs trial",
      "cay quyet dinh kien tung",
      "batna",
      "zopa",
      "chi phi khoi kien",
      "an phi",
      "expected value tranh chap",
      "litigation settlement ev decision tree",
      "mo hinh cay quyet dinh dinh luong hoa giai vs khoi kien",
      "settlement vs trial ev batna zopa"
    ]
  },
  {
    "slug": "contract-ambiguity-crossref-auditor",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "kiem toan hop dong",
      "tham chieu cheo",
      "cross-reference",
      "dinh nghia hop dong",
      "mo ho cau chu",
      "ambiguity check",
      "xung dot phu luc",
      "soat loi hop dong",
      "contract ambiguity crossref auditor",
      "kiem toan tinh nhat quan dinh nghia tham chieu cheo bat loi mo ho cau chu hop dong"
    ]
  },
  {
    "slug": "ma-legal-due-diligence-red-flag",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "tham dinh phap ly",
      "legal due diligence",
      "ldd",
      "red flag report",
      "m a phap ly",
      "change of control",
      "dieu kien tien quyet",
      "conditions precedent",
      "ma legal due diligence red flag",
      "tham dinh phap ly mua ban sap nhap",
      "m a legal due diligence red-flag report dieu kien tien quyet cp"
    ]
  },
  {
    "slug": "commercial-arbitration-viac-icc-brief",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "trong tai thuong mai",
      "viac",
      "siac",
      "icc arbitration",
      "phan quyet trong tai",
      "thoa thuan trong tai",
      "luat trong tai thuong mai",
      "luan cu trong tai",
      "commercial arbitration viac icc brief",
      "soan thao ban luan cu trong tai thuong mai thoa thuan trong tai mau",
      "viac siac icc"
    ]
  },
  {
    "slug": "demand-letter-cease-desist-escalation",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "cong van doi no",
      "thu hoi cong no",
      "demand letter",
      "cease and desist",
      "thu canh bao",
      "thong bao vi pham hop dong",
      "cham thanh toan",
      "demand letter cease desist escalation",
      "thu yeu cau thanh toan cong no thong bao vi pham thu canh bao",
      "cease desist"
    ]
  },
  {
    "slug": "bilingual-contract-translation-legal-plain",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "hop dong song ngu",
      "dich hop dong tieng anh",
      "bilingual contract",
      "tieng anh phap ly",
      "legal english",
      "plain language",
      "giai nghia hop dong",
      "bilingual contract translation legal plain",
      "bien dich doi chieu hop dong song ngu viet - anh giai nghia phap ly doi thuong",
      "side-by-side"
    ]
  },
  {
    "slug": "vn-sang-kien-kinh-nghiem-skkn",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "sang kien kinh nghiem",
      "skkn",
      "bien phap giao vien gioi",
      "thi giao vien day gioi",
      "thong tu 22 2019",
      "chien si thi dua",
      "thuc nghiem su pham",
      "vn sang kien kinh nghiem skkn",
      "bien soan sang kien kinh nghiem bao cao bien phap thi giao vien gioi cap truong tinh"
    ]
  },
  {
    "slug": "vn-stem-steam-5e-lesson-architect",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "bai hoc stem",
      "giao an stem",
      "steam",
      "chu trinh 5e",
      "cong van 3089",
      "thiet ke ky thuat",
      "day hoc du an",
      "project-based learning",
      "vn stem steam 5e lesson architect",
      "thiet ke chu de day hoc stem steam theo chu trinh 5e quy trinh thiet ke ky thuat"
    ]
  },
  {
    "slug": "vn-homeroom-teacher-student-evaluation",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "giao vien chu nhiem",
      "nhan xet hoc ba",
      "thong tu 27",
      "hop phu huynh",
      "ke hoach chu nhiem",
      "tinh huong su pham",
      "bien ban hop phu huynh",
      "vn homeroom teacher student evaluation",
      "tro ly giao vien chu nhiem nhan xet hoc ba ke hoach chu nhiem hop phu huynh",
      "thong tu 27 22"
    ]
  },
  {
    "slug": "vn-olympiad-gifted-student-coaching",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "boi duong hoc sinh gioi",
      "chuyen de hoc sinh gioi",
      "de thi hoc sinh gioi",
      "hsg quoc gia",
      "hsg tinh",
      "olympic",
      "bai tap nang cao",
      "vn olympiad gifted student coaching",
      "bien soan chuyen de boi duong hoc sinh gioi bai tap phan hoa cao",
      "hsg tinh quoc gia olympic"
    ]
  },
  {
    "slug": "vn-school-principal-annual-plan-qa",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "ke hoach giao duc nha truong",
      "kiem dinh chat luong giao duc",
      "tu danh gia truong hoc",
      "ban giam hieu",
      "hieu truong",
      "ke hoach to chuyen mon",
      "truong chuan quoc gia",
      "vn school principal annual plan qa",
      "quan ly nha truong ke hoach giao duc nha truong tu danh gia kiem dinh chat luong to chuyen mon"
    ]
  },
  {
    "slug": "experiential-career-guidance-hdtn",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "hoat dong trai nghiem",
      "huong nghiep",
      "hdtn",
      "sinh hoat duoi co",
      "sinh hoat lop",
      "holland riasec",
      "ikigai",
      "tu van huong nghiep",
      "experiential career guidance hdtn",
      "thiet ke hoat dong trai nghiem - huong nghiep tu van chon nghe theo holland ikigai",
      "hdtn-hn"
    ]
  },
  {
    "slug": "lesson-study-teacher-coaching-ngcbh",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "nghien cuu bai hoc",
      "sinh hoat chuyen mon",
      "lesson study",
      "cong van 5555",
      "du gio",
      "quan sat viec hoc",
      "huan luyen su pham",
      "lesson study teacher coaching ngcbh",
      "sinh hoat chuyen mon theo nghien cuu bai hoc huan luyen su pham dong dang"
    ]
  },
  {
    "slug": "inclusive-education-udl-iep-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "giao duc hoa nhap",
      "ke hoach giao duc ca nhan",
      "iep",
      "udl",
      "universal design for learning",
      "day hoc phan hoa",
      "hoc sinh khuyet tat",
      "inclusive education udl iep plan",
      "giao duc hoa nhap ke hoach giao duc ca nhan",
      "universal design for learning - udl"
    ]
  },
  {
    "slug": "ubd-backwards-curriculum-designer",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "understanding by design",
      "ubd",
      "thiet ke nguoc",
      "backwards design",
      "constructive alignment",
      "thiet ke chuong trinh hoc",
      "grasps",
      "whereto",
      "ubd backwards curriculum designer",
      "thiet ke chuong trinh hoc theo mo hinh thiet ke nguoc",
      "understanding by design - ubd 3 giai doan"
    ]
  },
  {
    "slug": "university-syllabus-obe-aun-qa",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "de cuong hoc phan",
      "de cuong chi tiet hoc phan",
      "chuan dau ra",
      "obe",
      "aun-qa",
      "abet",
      "cdio",
      "plo clo",
      "kiem dinh dai hoc",
      "syllabus",
      "university syllabus obe aun qa",
      "thiet ke de cuong chi tiet hoc phan dai hoc chuan dau ra obe ma tran plo-clo",
      "cdio aun-qa abet"
    ]
  },
  {
    "slug": "criterion-rubric-tilt-assignment",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "rubric",
      "thang cham diem",
      "tieu chi cham diem",
      "analytic rubric",
      "single-point rubric",
      "tilt assignment",
      "de bai bai tap lon",
      "do an mon hoc",
      "criterion rubric tilt assignment",
      "thiet ke thang cham diem rubric da tieu chi de bai du an chuan tilt",
      "analytic single-point"
    ]
  },
  {
    "slug": "psychometric-item-analysis-exam-audit",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "phan tich de thi",
      "do kho cau hoi",
      "do phan biet",
      "item analysis",
      "pho diem",
      "khao thi",
      "cronbach alpha",
      "phuong an nhieu",
      "psychometric item analysis exam audit",
      "phan tich thong ke de thi sau kiem tra",
      "do kho do phan biet phan tich nhieu pho diem tren excel"
    ]
  },
  {
    "slug": "socratic-feynman-active-tutoring",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "phuong phap socratic",
      "socratic method",
      "ky thuat feynman",
      "feynman technique",
      "cau hoi ban le",
      "hinge question",
      "day hoc tich cuc",
      "gia su ai",
      "socratic feynman active tutoring",
      "thiet ke chuoi cau hoi truy van socratic ky thuat giai thich nguoc feynman cau hoi ban le",
      "hinge"
    ]
  },
  {
    "slug": "cognitive-load-worked-example-fading",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "tai nhan thuc",
      "cognitive load",
      "worked example",
      "dual coding",
      "ma hoa kep",
      "khoa hoc hoc tap",
      "learning science",
      "scaffolding",
      "cognitive load worked example fading",
      "toi uu hoa tai nhan thuc ma hoa kep vi du mau giam dan",
      "cognitive load theory",
      "fading"
    ]
  },
  {
    "slug": "spaced-repetition-retrieval-flashcards",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "spaced repetition",
      "on tap ngat quang",
      "flashcard",
      "anki",
      "quizlet",
      "retrieval practice",
      "ghi nho dai han",
      "ebbinghaus",
      "spaced repetition retrieval flashcards",
      "lap lich on tap ngat quang bai tap truy xuat chu dong bo the anki quizlet"
    ]
  },
  {
    "slug": "knowledge-space-adaptive-learning-graph",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "knowledge space",
      "do thi tri thuc",
      "knowledge graph giao duc",
      "hoc tap thich ung",
      "adaptive learning",
      "kien thuc tien quyet",
      "lo trinh ca nhan hoa",
      "knowledge space adaptive learning graph",
      "thiet ke do thi khong gian tri thuc cay tien quyet lo trinh hoc thich ung",
      "knowledge space theory"
    ]
  },
  {
    "slug": "prisma-systematic-literature-review",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "prisma 2020",
      "systematic review",
      "tong quan tai lieu he thong",
      "literature review",
      "picos",
      "meta-analysis",
      "tong quan nghien cuu",
      "prisma systematic literature review",
      "tong quan tai lieu he thong chuan prisma 2020",
      "chien luoc tim kiem picos bang tong hop chung cu"
    ]
  },
  {
    "slug": "research-grant-proposal-nafo-ministry",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "thuyet minh de tai",
      "de tai nghien cuu khoa hoc",
      "nafosted",
      "de tai cap bo",
      "de tai cap tinh",
      "du toan nghien cuu khoa hoc",
      "nckh",
      "research grant proposal nafo ministry",
      "thuyet minh de tai nghien cuu khoa hoc cap quoc gia cap bo tinh du an quoc te"
    ]
  },
  {
    "slug": "vn-corporate-accounting-tt200-tt133",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "thong tu 99 2025",
      "thong tu 99",
      "tt99",
      "thong tu 200",
      "thong tu 133",
      "dinh khoan ke toan",
      "hach toan ke toan",
      "thuyet minh bao cao tai chinh",
      "thue thu nhap hoan lai",
      "chuan muc ke toan vas",
      "bang can doi phat sinh",
      "quyet toan thue",
      "bang can doi ke toan",
      "quyet toan thue tndn",
      "vn corporate accounting tt200 tt133",
      "ke toan doanh nghiep thue bctc quyet toan thue tndn gtgt",
      "thong tu 99 2025 tt-btc tt133"
    ]
  },
  {
    "slug": "vn-transfer-pricing-giao-dich-lien-ket",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "giao dich lien ket",
      "nghi dinh 132",
      "chuyen gia",
      "transfer pricing",
      "khong che lai vay",
      "30 ebitda",
      "local file",
      "phu luc gdlk",
      "vn transfer pricing giao dich lien ket",
      "ho so xac dinh gia giao dich lien ket khong che chi phi lai vay 30 ebitda",
      "nghi dinh 132 2020 nd-cp"
    ]
  },
  {
    "slug": "commercial-banking-alm-basel-iii",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "ngan hang thuong mai",
      "alm",
      "basel iii",
      "basel ii",
      "ty le an toan von",
      "car",
      "thong tu 41",
      "rui ro thanh khoan",
      "lcr",
      "nsfr",
      "nim",
      "commercial banking alm basel iii",
      "quan tri tai san no - co ngan hang rui ro thanh khoan an toan von basel iii",
      "lcr nsfr"
    ]
  },
  {
    "slug": "insurance-actuarial-underwriting-claims",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "bao hiem",
      "dinh phi bao hiem",
      "actuarial",
      "giam dinh boi thuong",
      "loss ratio",
      "combined ratio",
      "du phong nghiep vu",
      "ibnr",
      "luat kinh doanh bao hiem",
      "insurance actuarial underwriting claims",
      "nghiep vu bao hiem dinh phi bao hiem tham dinh rui ro giam dinh boi thuong",
      "actuarial pricing"
    ]
  },
  {
    "slug": "forensic-accounting-fraud-examination",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "ke toan dieu tra",
      "forensic accounting",
      "gian lan tai chinh",
      "beneish m-score",
      "altman z-score",
      "benford law",
      "lam dep bao cao tai chinh",
      "kiem toan gian lan",
      "forensic accounting fraud examination",
      "ke toan dieu tra kiem toan phat hien gian lan tai chinh",
      "beneish m-score luat benford red flags"
    ]
  },
  {
    "slug": "cost-accounting-abc-standard-costing",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "ke toan gia thanh",
      "tinh gia thanh san xuat",
      "activity-based costing",
      "dinh muc bom",
      "diem hoa von",
      "break-even",
      "so du dam phi",
      "chi phi san xuat chung",
      "cost accounting abc standard costing",
      "ke toan quan tri gia thanh san xuat tinh gia thanh theo hoat dong dinh muc bom diem hoa von",
      "abc"
    ]
  },
  {
    "slug": "pharma-gmp-regulatory-drug-dossier",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "duoc pham",
      "dang ky thuoc",
      "actd",
      "gmp-who",
      "gsp",
      "thiet bi y te",
      "canh giac duoc",
      "phan ung co hai adr",
      "to huong dan su dung thuoc",
      "pharma gmp regulatory drug dossier",
      "ho so dang ky thuoc thiet bi y te quy trinh san xuat gmp-who canh giac duoc",
      "actd ich"
    ]
  },
  {
    "slug": "international-logistics-incoterms-customs",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "xuat nhap khau",
      "logistics",
      "incoterms 2020",
      "hai quan",
      "ma hs",
      "hs code",
      "chung nhan xuat xu",
      "c o",
      "landed cost",
      "fob",
      "cif",
      "ddp",
      "international logistics incoterms customs",
      "van tai quoc te xuat nhap khau phan loai ma hs code c o tinh gia von hang nhap"
    ]
  },
  {
    "slug": "manufacturing-oee-tpm-production-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "quan tri san xuat",
      "nha may",
      "oee",
      "hieu suat thiet bi",
      "bao tri tpm",
      "mps",
      "mrp",
      "hoach dinh san xuat",
      "six big losses",
      "takt time",
      "manufacturing oee tpm production plan",
      "quan tri san xuat nha may tinh hieu suat thiet bi toan phan bao tri tpm ke hoach san xuat mps mrp"
    ]
  },
  {
    "slug": "retail-merchandising-category-otb-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "ban le",
      "chuoi cua hang",
      "merchandising",
      "open to buy",
      "otb",
      "gmroi",
      "sell-through",
      "quan tri nganh hang",
      "category management",
      "retail merchandising category otb plan",
      "quan tri nganh hang ban le chuoi cua hang ngan sach mua hang gmroi planogram",
      "open-to-buy otb"
    ]
  },
  {
    "slug": "hospitality-hotel-revpar-yield-management",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "khach san",
      "resort",
      "nha hang",
      "f b",
      "revpar",
      "goppar",
      "gia phong trung binh adr",
      "menu engineering",
      "food cost",
      "quan tri khach san",
      "usali",
      "hospitality hotel revpar yield management",
      "quan tri doanh thu khach san resort chuoi f b",
      "occupancy adr revpar goppar dinh gia menu"
    ]
  },
  {
    "slug": "brand-copy",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "brand copy",
      "sang tao noi dung thuong hieu"
    ]
  },
  {
    "slug": "business-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "business plan",
      "lap ke hoach kinh doanh"
    ]
  },
  {
    "slug": "business-report",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "business report",
      "viet bao cao kinh doanh"
    ]
  },
  {
    "slug": "campaign-planner",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "campaign planner",
      "hoach dinh chien dich marketing"
    ]
  },
  {
    "slug": "email-drafter",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "email drafter",
      "soan thao email doanh nghiep"
    ]
  },
  {
    "slug": "expense-report",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "expense report",
      "tong hop doi soat chi phi"
    ]
  },
  {
    "slug": "interview-coach",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "interview coach",
      "huan luyen phong van tuyen dung"
    ]
  },
  {
    "slug": "job-description",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "job description",
      "soan mo ta cong viec"
    ]
  },
  {
    "slug": "kpi-dashboard",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "kpi dashboard",
      "bang dieu khien theo doi kpi"
    ]
  },
  {
    "slug": "labor-contract",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "labor contract",
      "hop dong lao dong thu moi nhan viec"
    ]
  },
  {
    "slug": "lesson-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lesson plan",
      "thiet ke giao an giang day"
    ]
  },
  {
    "slug": "meeting-minutes",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "meeting minutes",
      "bien ban cuoc hop dau viec"
    ]
  },
  {
    "slug": "nda-drafter",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "nda drafter",
      "soan thoa thuan bao mat",
      "nda"
    ]
  },
  {
    "slug": "okr-planner",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "okr planner",
      "thiet lap muc tieu okr"
    ]
  },
  {
    "slug": "onboarding-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "onboarding plan",
      "ke hoach hoi nhap nhan su moi",
      "30 60 90"
    ]
  },
  {
    "slug": "performance-review",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "performance review",
      "danh gia hieu suat nhan su 360 9-box ke hoach pip"
    ]
  },
  {
    "slug": "personal-finance",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "personal finance",
      "quan ly tai chinh tiet kiem ca nhan"
    ]
  },
  {
    "slug": "policy-compliance",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "policy compliance",
      "chinh sach noi bo tuan thu"
    ]
  },
  {
    "slug": "product-launch",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "product launch",
      "ke hoach ra mat san pham go-to-market",
      "gtm playbook"
    ]
  },
  {
    "slug": "proposal-writer",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "proposal writer",
      "viet de xuat du an giai phap"
    ]
  },
  {
    "slug": "quiz-maker",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "quiz maker",
      "tao de kiem tra dap an chi tiet",
      "chuan cv 7991"
    ]
  },
  {
    "slug": "resume-polisher",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "resume polisher",
      "toi uu hoa ho so ung tuyen",
      "cv resume"
    ]
  },
  {
    "slug": "sales-forecast",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "sales forecast",
      "du bao doanh so phan tich do nhay"
    ]
  },
  {
    "slug": "seo-content",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "seo content",
      "nghien cuu tu khoa bai viet chuan seo"
    ]
  },
  {
    "slug": "social-media",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "social media",
      "lich noi dung mang xa hoi da kenh"
    ]
  },
  {
    "slug": "sop-writer",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "sop writer",
      "xay dung quy trinh chuan",
      "sop"
    ]
  },
  {
    "slug": "study-plan",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "study plan",
      "lap thoi gian bieu hoc tap on thi"
    ]
  },
  {
    "slug": "survey-analyst",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "survey analyst",
      "phan tich khao sat nghien cuu nguoi dung"
    ]
  },
  {
    "slug": "swot-strategy",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "swot strategy",
      "phan tich chien luoc swot pest"
    ]
  },
  {
    "slug": "terms-of-service",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "terms of service",
      "soan dieu khoan dich vu bao mat",
      "tos"
    ]
  },
  {
    "slug": "thesis-advisor",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "thesis advisor",
      "co van de cuong luan van tong quan tai lieu"
    ]
  },
  {
    "slug": "weekly-report",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "weekly report",
      "bao cao tien do tuan thang"
    ]
  },
  {
    "slug": "lycero-office",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero office",
      "xu ly tai lieu van phong chuyen nghiep"
    ]
  },
  {
    "slug": "lycero-docs",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero docs",
      "dong co bien tap van ban word",
      "cloud docs ast"
    ]
  },
  {
    "slug": "lycero-sheets",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero sheets",
      "dong co mo hinh hoa bang tinh excel",
      "cloud sheets engine"
    ]
  },
  {
    "slug": "lycero-slides",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero slides",
      "dong co kien truc trinh chieu 16 9",
      "cloud slides architect"
    ]
  },
  {
    "slug": "lycero-pdf",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero pdf",
      "dong co phan tich chinh sua pdf cap do byte",
      "cloud pdf engine"
    ]
  },
  {
    "slug": "lycero-markdown",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero markdown",
      "dong co soan thao ky thuat markdown",
      "cloud markdown engine"
    ]
  },
  {
    "slug": "lycero-html",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero html",
      "dong co bien tap giao dien html",
      "cloud html engine"
    ]
  },
  {
    "slug": "vn-bidding-dossier-pro",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "vn bidding dossier pro",
      "lap ho so du thau thuyet minh ky thuat",
      "luat dau thau vn"
    ]
  },
  {
    "slug": "vn-bi-cohort-analytics",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "vn bi cohort analytics",
      "phan tich cohort rfm du bao dong tien doanh nghiep"
    ]
  },
  {
    "slug": "vn-legal-contract-audit",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "vn legal contract audit",
      "ra soat kiem toan phap ly dam phan sửa đổi điều khoản hop dong",
      "green yellow red blds 2015 luat thuong mai"
    ]
  },
  {
    "slug": "vn-gtm-growth-strategy",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "vn gtm growth strategy",
      "chien luoc go-to-market pheu chuyen doi da kenh thi truong viet nam"
    ]
  },
  {
    "slug": "lycero-visual-director",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero visual director",
      "dao dien nghe thuat sinh anh minh hoa",
      "cloud visual director"
    ]
  },
  {
    "slug": "lycero-form-architect",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "lycero form architect",
      "kien truc su bieu mau form hanh chinh a4",
      "cloud form architect"
    ]
  },
  {
    "slug": "pipeline-slide-style",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "pipeline slide style",
      "pipeline stage 1 kien tao style skill trinh chieu",
      "slide style generator"
    ]
  },
  {
    "slug": "pipeline-slide-outline",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "pipeline slide outline",
      "pipeline stage 2 hoach dinh dan y chien luoc slide",
      "deck outline planner"
    ]
  },
  {
    "slug": "pipeline-slide-page-spec",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "pipeline slide page spec",
      "pipeline stage 3 dac ta toa do json tung trang slide",
      "1280 720 page spec"
    ]
  },
  {
    "slug": "pipeline-doc-writer",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "pipeline doc writer",
      "pipeline stage 4 dong co soan thao van ban dai",
      "long-form doc writer html"
    ]
  },
  {
    "slug": "cfo-financial-modeling-dcf",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "cfo financial modeling dcf",
      "mo hinh tai chinh 3 bao cao dinh gia dcf lbo do nhay wacc",
      "cfo financial modeling"
    ]
  },
  {
    "slug": "vc-pitch-deck-architect",
    "modules": [
      "office_slide",
      "office_docx"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "vc pitch deck architect",
      "kien truc su pitch deck goi von dau tu seed series a-b-c"
    ]
  },
  {
    "slug": "enterprise-sop-rfp-operations",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "enterprise sop rfp operations",
      "xay dung quy trinh van hanh chuan sop ma tran raci ho so moi thau rfp sow"
    ]
  },
  {
    "slug": "product-strategy-prd-okr",
    "modules": [
      "office_sheet",
      "office_docx",
      "office_pdf"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "product strategy prd okr",
      "chien luoc san pham prd khung chien luoc swot porter quan tri muc tieu okrs"
    ]
  },
  {
    "slug": "executive-board-memo-mckinsey",
    "modules": [
      "office_docx",
      "office_pdf",
      "office_markdown",
      "office_html"
    ],
    "stages": [
      "doc_longform",
      "sheet_formula",
      "chat"
    ],
    "keywords": [
      "executive board memo mckinsey",
      "bao cao hoi dong quan tri ic memo dau tu truc quan hoa chien luoc mckinsey"
    ]
  }
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
  /** Optional dynamic catalog of Cloud Skills synced from server (defaults to DEFAULT_CLOUD_SKILL_CATALOG) */
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
  const rawPrompt = (input.prompt ?? '').toLowerCase()
  const normPrompt = normalizeSkillMatchText(input.prompt ?? '')
  // Keep only the first 4000 chars of system/document context so boilerplate tool docs don't dilute scoring
  const normSystem = normalizeSkillMatchText((input.system ?? '').slice(0, 4000))
  const moduleKey = input.editorModule ?? ''
  const stageKey = input.pipelineStage ?? 'chat'
  const availableSkills =
    input.availableSkills && input.availableSkills.length > 0
      ? input.availableSkills
      : DEFAULT_CLOUD_SKILL_CATALOG

  const result: string[] = []
  const addSlug = (slug: string, preserveCustom = false) => {
    const rawClean = slug.trim()
    if (!rawClean) return
    const canonical = preserveCustom ? (SKILL_SLUG_ALIAS_MAP[rawClean.toLowerCase()] ?? rawClean) : resolveCanonicalSkillSlug(rawClean)
    if (HIDDEN_OR_MERGED_SKILL_SLUGS.has(canonical.toLowerCase())) return
    if (!result.includes(canonical)) {
      result.push(canonical)
    }
  }

  // 1. Always preserve explicitly pinned/tagged skills (e.g. [LYCERO_CLOUD_SKILL:...])
  if (input.manualSlugs) {
    for (const slug of input.manualSlugs) {
      addSlug(slug, true)
    }
  }

  // 2. Include pipeline-stage-specific orchestrator skills
  const stageSkills = STAGE_REQUIRED_SKILLS[stageKey]
  if (stageSkills) {
    for (const slug of stageSkills) {
      const clean = slug.trim()
      if (clean && !result.includes(clean)) {
        result.push(clean)
      }
    }
  }

  // 3. Score domain skills against prompt (weight 3x), document context (weight 1x), and module affinity
  const scores = new Map<string, number>()

  for (const rule of CLASSIFICATION_RULES) {
    const canonicalSlug = resolveCanonicalSkillSlug(rule.slug)
    if (HIDDEN_OR_MERGED_SKILL_SLUGS.has(canonicalSlug)) continue

    // Narrow vertical guard (FX-26)
    if (NARROW_VERTICAL_SKILL_SLUGS.has(canonicalSlug)) {
      const hasMedicalOrPharmaContext =
        canonicalSlug === 'clinical-protocol-soap-medical-record'
          ? /(benh an|soap|phac do dieu tri|chan doan phan biet|ho so benh an|lam sang|icd-10|hoi chan)/i.test(
              normPrompt || rawPrompt,
            )
          : /(dang ky thuoc|ho so actd|gmp-who|canh giac duoc|phan ung co hai adr|duoc pham)/i.test(
              normPrompt || rawPrompt,
            )
      if (!hasMedicalOrPharmaContext) continue
    }

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
      scores.set(canonicalSlug, (scores.get(canonicalSlug) ?? 0) + score)
    }
  }

  // 4. Also score against availableSkills metadata (slug, name, description) so all 190 active skills can match (FX-24)
  for (const skill of availableSkills) {
    if (!skill.slug) continue
    const canonicalSlug = resolveCanonicalSkillSlug(skill.slug)
    if (HIDDEN_OR_MERGED_SKILL_SLUGS.has(canonicalSlug)) continue
    if (NARROW_VERTICAL_SKILL_SLUGS.has(canonicalSlug) && !scores.has(canonicalSlug)) continue

    const slugWords = normalizeSkillMatchText(canonicalSlug.replace(/-/g, ' '))
    const nameWords = normalizeSkillMatchText(skill.name ?? '')
    const descWords = normalizeSkillMatchText(skill.description ?? '')
    let dynamicScore = 0
    if (slugWords && normPrompt.includes(slugWords)) dynamicScore += 8
    if (nameWords && normPrompt.includes(nameWords)) dynamicScore += 8
    if (dynamicScore === 0 && normPrompt.length >= 6) {
      // Check significant 2+ word phrases in skill name or description
      const tokens = nameWords.split(' ').filter((w) => w.length >= 3)
      if (tokens.length >= 2) {
        let matchedTokens = 0
        for (const t of tokens) {
          if (normPrompt.includes(t)) matchedTokens++
        }
        if (matchedTokens >= 3 || (matchedTokens >= 2 && matchedTokens / tokens.length >= 0.6)) {
          dynamicScore += matchedTokens * 2
        }
      }
      if (dynamicScore === 0 && descWords && normPrompt.length >= 10 && descWords.includes(normPrompt)) {
        dynamicScore += 5
      }
    }
    if (dynamicScore > 0) {
      scores.set(canonicalSlug, (scores.get(canonicalSlug) ?? 0) + dynamicScore)
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
