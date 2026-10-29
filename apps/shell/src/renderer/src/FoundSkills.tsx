/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { useCallback, useEffect, useState } from 'react'
import type { StringKey, TFunc } from './locale'
import type { FoundSkill, RecommendedSkill } from '../../shared/found-skill'

/**
 * The skills the user installed into Lycero Office.
 *
 * Only Lycero Office's own folder is listed. A skill gets in one way: the user
 * picks a folder or a zip and presses Import. Nothing on this screen runs
 * anything.
 */

const api = () => window.aiOfficeIntegrations

type Notice = { kind: 'done' | 'removed'; name: string } | { kind: 'failed'; reason: string }

export function FoundSkills({ t }: { t: TFunc }) {
  const [skills, setSkills] = useState<FoundSkill[] | null>(null)
  const [recommended, setRecommended] = useState<RecommendedSkill[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [tab, setTab] = useState<Category | null>(null)
  const [section, setSection] = useState<Section | null>(null)

  const load = useCallback(async () => {
    // the method itself is checked, not just the bridge: a preload from before
    // this feature was added goes on answering with a partial object
    const [found, offered] = await Promise.all([
      api()?.listSkills?.(),
      Promise.resolve()
        .then(() => api()?.listRecommendedSkills?.())
        .catch(() => undefined),
    ])
    if (found) setSkills(found)
    if (offered) setRecommended(offered)
    // decided once from the first complete answer: with nothing installed the
    // catalog is the useful screen, and installing from it must not flip the view
    if (found) {
      setSection((cur) => cur ?? (found.length === 0 && offered?.length ? 'recommended' : 'mine'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const doImport = async (run: (() => Promise<FoundSkill | null>) | undefined) => {
    if (busy || !run) return
    setBusy(true)
    try {
      const skill = await run()
      if (!skill) return
      setNotice({ kind: 'done', name: skill.name })
      await load()
    } catch (e) {
      setNotice({ kind: 'failed', reason: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const doRemove = async (skill: FoundSkill) => {
    if (busy || !window.confirm(t('intgSkillsRemoveConfirm', { name: skill.name }))) return
    setBusy(true)
    try {
      await api()?.removeSkill?.(skill.name)
      setNotice({ kind: 'removed', name: skill.name })
      await load()
    } catch (e) {
      setNotice({ kind: 'failed', reason: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const doInstall = (skill: RecommendedSkill) =>
    doImport(() => api()?.installRecommendedSkill?.(skill.name) ?? Promise.resolve(null))

  // nothing rendered until the listing answers: an empty section that fills in
  // a moment later reads as "none installed", the one thing it must not say
  if (!skills) return null

  const categories = CATEGORY_ORDER.filter((c) => recommended.some((s) => categoryOf(s) === c))
  const current = tab && categories.includes(tab) ? tab : categories[0]
  const shown: Section = section ?? 'mine'
  const sectionTab = (s: Section, label: string) => (
    <button
      key={s}
      type="button"
      role="tab"
      aria-selected={s === shown}
      className={s === shown ? 'set-intg-seg active' : 'set-intg-seg'}
      onClick={() => setSection(s)}
    >
      {label}
    </button>
  )

  return (
    <>
      <h3 className="set-pane-title">{t('setSecSkills')}</h3>
      <div className="set-field-desc set-intg-lead">{t('intgSkillsDesc')}</div>

      <div className="set-intg-head">
        {categories.length > 0 ? (
          <div className="set-intg-tabs set-intg-sections" role="tablist">
            {sectionTab('mine', `${t('intgSkillsMine')} (${skills.length})`)}
            {sectionTab('recommended', t('intgSkillsRecommended'))}
          </div>
        ) : (
          <div className="set-field-label">{t('intgSkillsMine')}</div>
        )}
        <div className="set-intg-actions">
          <button
            className="set-btn"
            disabled={busy}
            onClick={() =>
              void doImport(
                () =>
                  api()?.importSkillZip?.(t('intgSkillsImportZipTitle')) ?? Promise.resolve(null),
              )
            }
          >
            {t('intgSkillsImportZip')}
          </button>
          <button
            className="set-btn"
            disabled={busy}
            onClick={() =>
              void doImport(
                () =>
                  api()?.importSkillFolder?.(t('intgSkillsImportFolderTitle')) ??
                  Promise.resolve(null),
              )
            }
          >
            {t('intgSkillsImportFolder')}
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={
            notice.kind === 'failed'
              ? 'set-field-desc set-intg-warn'
              : 'set-field-desc set-intg-notice'
          }
        >
          {notice.kind === 'failed'
            ? t('intgSkillsImportFailed', { reason: notice.reason })
            : notice.kind === 'done'
              ? t('intgSkillsImportDone', { name: notice.name })
              : t('intgSkillsRemoved', { name: notice.name })}
        </div>
      )}

      {shown === 'mine' && skills.length === 0 && (
        <div className="set-field-desc set-intg-lead">{t('intgSkillsEmpty')}</div>
      )}

      {shown === 'mine' && skills.length > 0 && (
        <div className="set-intg-list">
          {skills.map((skill) => (
            <SkillRow
              key={skill.path}
              t={t}
              skill={skill}
              action={
                <button className="set-btn" disabled={busy} onClick={() => void doRemove(skill)}>
                  {t('intgSkillsRemove')}
                </button>
              }
            />
          ))}
        </div>
      )}

      {shown === 'recommended' && categories.length > 0 && (
        <div className="set-intg-list">
          <div className="set-intg-tabs" role="tablist" aria-label={t('intgSkillsRecommended')}>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={c === current}
                className={c === current ? 'set-intg-tab active' : 'set-intg-tab'}
                onClick={() => setTab(c)}
              >
                {t(CATEGORY_LABELS[c])}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {recommended
              .filter((s) => categoryOf(s) === current)
              .map((skill) => (
                <SkillRow
                  key={skill.path}
                  t={t}
                  skill={skill}
                  action={
                    skill.state === 'installed' ? (
                      <span className="set-intg-state">{t('intgSkillsInstalledTag')}</span>
                    ) : (
                      <button
                        className="set-btn"
                        disabled={busy}
                        onClick={() => void doInstall(skill)}
                      >
                        {skill.state === 'outdated'
                          ? t('intgSkillsUpdate')
                          : t('intgSkillsInstall')}
                      </button>
                    )
                  }
                />
              ))}
          </div>
        </div>
      )}
    </>
  )
}

const CATEGORY_ORDER = [
  'office',
  'business',
  'data',
  'finance',
  'hr',
  'legal',
  'marketing',
  'education',
  'other',
] as const
type Category = (typeof CATEGORY_ORDER)[number]
type Section = 'mine' | 'recommended'

const CATEGORY_LABELS: Record<Category, StringKey> = {
  office: 'intgSkillsCatOffice',
  business: 'intgSkillsCatBusiness',
  data: 'intgSkillsCatData',
  finance: 'intgSkillsCatFinance',
  hr: 'intgSkillsCatHr',
  legal: 'intgSkillsCatLegal',
  marketing: 'intgSkillsCatMarketing',
  education: 'intgSkillsCatEducation',
  other: 'intgSkillsCatOther',
}

function categoryOf(s: RecommendedSkill): Category {
  return (CATEGORY_ORDER as readonly string[]).includes(s.category)
    ? (s.category as Category)
    : 'other'
}

const SKILL_VI_META: Record<string, { title: string; description: string }> = {
  'brand-copy': {
    title: 'Sáng tạo Nội dung Thương hiệu',
    description:
      'Chuyển thông tin sản phẩm và tệp khách hàng thành nhiều phiên bản slogan, điểm bán hàng (USP) và câu chuyện thương hiệu, xuất ra Markdown.',
  },
  'budget-planner': {
    title: 'Lập Kế hoạch Ngân sách',
    description:
      'Chuyển kế hoạch kinh doanh thành bảng ngân sách năm hoặc dự án gồm các khoản mục, phân bổ theo tháng, tổng hợp và trang giả định riêng, xuất ra bảng tính Excel.',
  },
  'business-plan': {
    title: 'Lập Kế hoạch Kinh doanh',
    description:
      'Phát triển ý tưởng dự án thành bản kế hoạch kinh doanh hoàn chỉnh gồm thị trường, sản phẩm, mô hình, đối thủ, dự phóng tài chính và đội ngũ, xuất ra tài liệu Word.',
  },
  'business-report': {
    title: 'Viết Báo cáo Kinh doanh',
    description:
      'Soạn báo cáo phân tích kinh doanh chuẩn cấu trúc (tóm tắt điều hành, bối cảnh, phân tích, khuyến nghị, phụ lục) với số liệu có dẫn nguồn, xuất ra tài liệu Word.',
  },
  'campaign-planner': {
    title: 'Hoạch định Chiến dịch Marketing',
    description:
      'Chuyển mục tiêu và ngân sách thành kế hoạch chiến dịch toàn diện gồm kịch bản triển khai, ấn phẩm, ngân sách, KPI và mẫu nghiệm thu, xuất ra tài liệu Word.',
  },
  'contract-drafter': {
    title: 'Soạn thảo & Rà soát Hợp đồng',
    description:
      'Soạn thảo hợp đồng hoặc thỏa thuận hợp tác đầy đủ kèm danh mục kiểm tra rủi ro trước khi ký kết, xuất ra tài liệu Word.',
  },
  'course-slides': {
    title: 'Thiết kế Bài giảng Trình chiếu',
    description:
      'Chuyển giáo án hoặc tài liệu học tập thành đề cương slide, sau đó dựng bộ bài giảng hoàn chỉnh kèm kịch bản thuyết giảng trong phần ghi chú, xuất ra PowerPoint.',
  },
  'data-analyst': {
    title: 'Phân tích Dữ liệu & Biểu đồ',
    description:
      'Xử lý dữ liệu thô qua các bước làm sạch, lập công thức, vẽ biểu đồ và rút ra kết luận trực quan dễ hiểu, xuất ra bảng tính Excel.',
  },
  'data-cleaning': {
    title: 'Làm sạch & Chuẩn hóa Dữ liệu',
    description:
      'Xác định quy tắc làm sạch, khử trùng lặp và chuẩn hóa dữ liệu lộn xộn thành bảng chuẩn kèm nhật ký xử lý từng dòng, xuất ra bảng tính Excel.',
  },
  'deep-research': {
    title: 'Nghiên cứu Chuyên sâu Đa nguồn',
    description:
      'Thực hiện tra cứu nhiều vòng, đối chiếu chéo dữ liệu và tổng hợp thành báo cáo nghiên cứu có trích dẫn nguồn đầy đủ, xuất ra tài liệu Word.',
  },
  'email-drafter': {
    title: 'Soạn thảo Email Doanh nghiệp',
    description:
      'Soạn email công việc và chuỗi email chăm sóc/nhắc việc theo nhiều giọng điệu từ mục đích, người nhận và ngữ cảnh (đa ngôn ngữ Việt - Anh), xuất ra Markdown.',
  },
  'executive-deck': {
    title: 'Trình chiếu Báo cáo Điều hành',
    description:
      'Xây dựng bài trình chiếu báo cáo lãnh đạo theo cấu trúc kim tự tháp (mỗi tiêu đề slide nêu bật một kết luận cốt lõi), xuất ra PowerPoint.',
  },
  'expense-report': {
    title: 'Tổng hợp & Đối soát Chi phí',
    description:
      'Chuyển danh sách hóa đơn/chứng từ thành bảng kê thanh toán chi phí, tự động cảnh báo thiếu chứng từ, vượt định mức hoặc trùng lặp, xuất ra bảng tính Excel.',
  },
  'financial-statement-analysis': {
    title: 'Phân tích Báo cáo Tài chính',
    description:
      'Phân tích bộ 3 báo cáo tài chính về khả năng sinh lời, thanh khoản, hiệu quả hoạt động và dòng tiền kèm báo cáo nhận định chuyên sâu, xuất ra tài liệu Word.',
  },
  'interview-coach': {
    title: 'Huấn luyện Phỏng vấn Tuyển dụng',
    description:
      'Chuẩn bị bộ câu hỏi phỏng vấn dự kiến, kịch bản trả lời chuẩn STAR và câu hỏi đào sâu từ CV và vị trí ứng tuyển, xuất ra Markdown.',
  },
  'invoice-tax-checklist': {
    title: 'Danh mục Kiểm tra Hóa đơn & Thuế',
    description:
      'Chuyển thông tin giao dịch thành danh mục kiểm tra xuất hóa đơn và tuân thủ thuế cần lưu ý, xuất ra tài liệu Word.',
  },
  'job-description': {
    title: 'Soạn Mô tả Công việc (JD)',
    description:
      'Chuyển nhu cầu tuyển dụng thành bản mô tả công việc (JD) hoàn chỉnh gồm trách nhiệm, yêu cầu, điểm cộng và tiêu chí sàng lọc hồ sơ, xuất ra tài liệu Word.',
  },
  'kpi-dashboard': {
    title: 'Bảng Điều khiển Theo dõi KPI',
    description:
      'Chuyển dữ liệu vận hành thành bảng theo dõi KPI gồm định nghĩa chỉ số, mục tiêu so với thực tế, tỷ lệ hoàn thành và biểu đồ xu hướng, xuất ra bảng tính Excel.',
  },
  'labor-contract': {
    title: 'Hợp đồng Lao động & Thư mời Nhận việc',
    description:
      'Soạn thảo hợp đồng lao động hoặc thư mời nhận việc (Offer Letter) theo vị trí và hình thức làm việc kèm danh mục kiểm tra khi ký, xuất ra tài liệu Word.',
  },
  'lesson-plan': {
    title: 'Thiết kế Giáo án Giảng dạy',
    description:
      'Thiết kế giáo án hoàn chỉnh theo chủ đề và đặc điểm lớp học gồm mục tiêu, phân bổ thời lượng, hoạt động, đánh giá và bài tập phân hóa, xuất ra tài liệu Word.',
  },
  'meeting-minutes': {
    title: 'Biên bản Cuộc họp & Đầu việc',
    description:
      'Chuyển bản ghi âm, lịch sử chat hoặc ghi chú rời rạc thành biên bản cuộc họp có cấu trúc rõ ràng kèm quyết định và đầu việc cần làm, xuất ra tài liệu Word.',
  },
  'nda-drafter': {
    title: 'Soạn Thỏa thuận Bảo mật (NDA)',
    description:
      'Soạn thảo thỏa thuận bảo mật thông tin (NDA) một chiều hoặc hai chiều theo bối cảnh hợp tác kèm ghi chú điều khoản và rủi ro, xuất ra tài liệu Word.',
  },
  'okr-planner': {
    title: 'Thiết lập Mục tiêu OKR',
    description:
      'Phân rã mục tiêu đội nhóm thành bảng OKR (Objectives & Key Results) đo lường được kèm ghi chú đánh giá định kỳ, xuất ra bảng tính Excel.',
  },
  'onboarding-plan': {
    title: 'Kế hoạch Hội nhập Nhân sự Mới (30/60/90)',
    description:
      'Xây dựng lộ trình hội nhập 30/60/90 ngày với các cột mốc, tài liệu và hướng dẫn chi tiết theo từng vị trí, xuất ra bảng tính Excel.',
  },
  'performance-review': {
    title: 'Đánh giá Hiệu suất Nhân sự',
    description:
      'Tổng hợp mục tiêu và kết quả công việc trong kỳ thành bản tự đánh giá hoặc nhận xét của quản lý có số liệu dẫn chứng, xuất ra tài liệu Word.',
  },
  'personal-finance': {
    title: 'Quản lý Tài chính & Tiết kiệm Cá nhân',
    description:
      'Chuyển dữ liệu thu nhập, chi tiêu và mục tiêu tài chính thành bảng ngân sách hàng tháng và kế hoạch tiết kiệm khả thi, xuất ra bảng tính Excel.',
  },
  'policy-compliance': {
    title: 'Chính sách Nội bộ & Tuân thủ',
    description:
      'Soạn thảo quy chế tuân thủ nội bộ hoặc chính sách quyền riêng tư kèm bảng kiểm tự đánh giá (Checklist), xuất ra tài liệu Word và bảng tính Excel.',
  },
  'product-launch': {
    title: 'Kế hoạch Ra mắt Sản phẩm (Go-to-Market)',
    description:
      'Chuyển thông tin sản phẩm mới thành kế hoạch ra mắt gồm lộ trình triển khai, danh sách kênh, thông cáo báo chí và bộ câu hỏi FAQ, xuất ra tài liệu Word.',
  },
  'proposal-writer': {
    title: 'Viết Đề xuất Dự án & Giải pháp',
    description:
      'Chuyển yêu cầu hoặc ý tưởng thành bản đề xuất dự án/giải pháp hoàn chỉnh gồm mục tiêu, thiết kế, cột mốc, ngân sách và rủi ro, xuất ra tài liệu Word.',
  },
  'quiz-maker': {
    title: 'Tạo Đề kiểm tra & Đáp án Chi tiết',
    description:
      'Biên soạn đề kiểm tra hoàn chỉnh theo chủ điểm kiến thức và mức độ khó kèm đáp án, lời giải chi tiết và ma trận câu hỏi, xuất ra tài liệu Word.',
  },
  'resume-polisher': {
    title: 'Tối ưu hóa Hồ sơ Ứng tuyển (CV/Resume)',
    description:
      'Biên tập và nâng cấp CV theo vị trí mục tiêu với các thành tích định lượng rõ ràng và tối ưu từ khóa theo JD, xuất ra tài liệu Word.',
  },
  'sales-forecast': {
    title: 'Dự báo Doanh số & Phân tích Độ nhạy',
    description:
      'Dự báo doanh số từ dữ liệu lịch sử theo xu hướng và tính mùa vụ, kèm khoảng tin cậy, kịch bản (tích cực/cơ sở/thận trọng) và phân tích độ nhạy, xuất ra bảng tính Excel.',
  },
  'seo-content': {
    title: 'Nghiên cứu Từ khóa & Bài viết Chuẩn SEO',
    description:
      'Xây dựng bảng gom cụm từ khóa (Keyword Cluster) theo chủ đề và viết bài chuyên sâu chuẩn SEO, xuất ra bảng tính Excel và tài liệu Markdown.',
  },
  'slide-planner': {
    title: 'Hoạch định & Dựng Bài thuyết trình',
    description:
      'Lên đề cương mạch nội dung thuyết trình trước, sau khi xác nhận sẽ tự động dựng trọn bộ slide hoàn chỉnh, xuất ra PowerPoint.',
  },
  'social-media': {
    title: 'Lịch Nội dung Mạng xã hội Đa kênh',
    description:
      'Xây dựng lịch đăng bài (Content Calendar) và bộ nội dung tuần tối ưu riêng cho từng nền tảng từ định vị kênh, xuất ra bảng tính Excel và Markdown.',
  },
  'sop-writer': {
    title: 'Xây dựng Quy trình Chuẩn (SOP)',
    description:
      'Chuyển quy trình làm việc thực tế thành tài liệu SOP hoặc quy chế chuẩn gồm vai trò, các bước, điểm kiểm soát và xử lý ngoại lệ, xuất ra tài liệu Word.',
  },
  'study-plan': {
    title: 'Lập Thời gian biểu Học tập & Ôn thi',
    description:
      'Xây dựng lịch học tập chi tiết theo tuần và ngày dựa trên mục tiêu và quỹ thời gian, kèm phương pháp học và nguyên tắc điều chỉnh, xuất ra bảng tính Excel.',
  },
  'survey-analyst': {
    title: 'Phân tích Khảo sát & Nghiên cứu Người dùng',
    description:
      'Làm sạch dữ liệu phản hồi khảo sát, chạy bảng chéo (Cross-tab), vẽ biểu đồ và xuất trọn bộ bảng tính phân tích Excel kèm báo cáo kết quả Word.',
  },
  'swot-strategy': {
    title: 'Phân tích Chiến lược SWOT & PEST',
    description:
      'Thực hiện phân tích SWOT, PEST và bức tranh cạnh tranh cho doanh nghiệp/sản phẩm, từ đó đề xuất các khuyến nghị chiến lược khả thi, xuất ra tài liệu Word.',
  },
  'terms-of-service': {
    title: 'Soạn Điều khoản Dịch vụ (ToS) & Bảo mật',
    description:
      'Soạn thảo bộ Điều khoản dịch vụ và Thông báo quyền riêng tư phù hợp với mô hình sản phẩm và tính năng, xuất ra tài liệu Word.',
  },
  'thesis-advisor': {
    title: 'Cố vấn Đề cương Luận văn & Tổng quan Tài liệu',
    description:
      'Xây dựng đề cương luận văn/khóa luận, bản nháp từng chương và khung tổng quan tài liệu (Literature Review) từ đề tài của người học, xuất ra tài liệu Word.',
  },
  'weekly-report': {
    title: 'Báo cáo Tiến độ Tuần / Tháng',
    description:
      'Tổng hợp các ghi chú tiến độ công việc rời rạc thành bản báo cáo tuần/tháng chuẩn chỉnh gồm kết quả, số liệu, rủi ro và kế hoạch kỳ tới, xuất ra tài liệu Word.',
  },
  'lycero-office': {
    title: 'Bộ công cụ Tài liệu Lycero Office (Lõi)',
    description:
      'Tạo mới, chuyển đổi định dạng, đọc cấu trúc và chỉnh sửa trực tiếp các tài liệu Office (.docx, .xlsx, .pptx, .pdf, .md, .html, .csv) cục bộ trên máy tính.',
  },
  genoffice: {
    title: 'Bộ công cụ Tài liệu Lycero Office (Lõi)',
    description:
      'Tạo mới, chuyển đổi định dạng, đọc cấu trúc và chỉnh sửa trực tiếp các tài liệu Office (.docx, .xlsx, .pptx, .pdf, .md, .html, .csv) cục bộ trên máy tính.',
  },
}

/** One skill, with its instructions behind a disclosure fetched on open. */
function SkillRow({ t, skill, action }: { t: TFunc; skill: FoundSkill; action?: React.ReactNode }) {
  const [body, setBody] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const isVi = t('intgSkillsRead') === 'Chi tiết'
  const viMeta = isVi ? SKILL_VI_META[skill.name] : undefined
  const displayTitle = skill.title ?? (viMeta ? viMeta.title : skill.name)
  const showSlug = displayTitle !== skill.name
  const isCloudProtected = Boolean(skill.cloudProtected)

  const show = async () => {
    if (body !== null || reading || isCloudProtected) return
    setReading(true)
    try {
      setBody((await api()?.skillBody?.(skill.path)) ?? '')
    } catch {
      setBody('')
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="set-intg-row set-intg-skill">
      <div className="set-field">
        <div className="set-field-text">
          <div className="set-field-stack">
            <div className="set-intg-skill-title-row">
              <span className="set-field-label">{displayTitle}</span>
              {showSlug && <span className="set-intg-skill-slug">{skill.name}</span>}
              {isCloudProtected && (
                <span className="set-intg-cloud-badge">
                  {skill.tier === 'plus' ? 'CLOUD PLUS' : 'CLOUD PRO'}
                </span>
              )}
            </div>
            <div className="set-field-desc">{viMeta ? viMeta.description : skill.description}</div>
          </div>
        </div>
        {action && <div className="set-intg-actions">{action}</div>}
      </div>
      {isCloudProtected ? (
        <div className="set-intg-cloud-lock">
          {isVi
            ? '🔒 Bảo vệ bản quyền — Thực thi trực tiếp trên Lycero Cloud'
            : '🔒 IP Protected — Executed on Lycero Cloud'}
        </div>
      ) : (
        <details
          className="set-intg-details"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) void show()
          }}
        >
          <summary>{t('intgSkillsRead')}</summary>
          {body === null ? null : (
            <pre className="set-intg-code set-intg-code-block">
              <code>{body}</code>
            </pre>
          )}
        </details>
      )}
    </div>
  )
}
