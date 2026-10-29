/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import appIcon from './assets/app-icon.png'
import { useI18n } from './locale'
import './help-modal.css'

interface HelpAboutModalProps {
  open: boolean
  onClose: () => void
}

/** Tài liệu "Giới thiệu Lycero Office" — mở từ menu Trợ giúp > Giới thiệu.
 * Nội dung chuẩn phần mềm chuyên nghiệp, theo tam ngôn ngữ: VI / EN / signature. */
export function HelpAboutModal({ open, onClose }: HelpAboutModalProps) {
  const { t } = useI18n()

  if (!open) return null

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label={t('helpAbout')}>
      <div className="help-card help-card-wide">
        <header className="help-header">
          <h2 className="help-title">{t('helpAboutTitle')}</h2>
          <button className="help-close" aria-label={t('helpClose')} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="help-body">
          {/* Hero / product identity */}
          <section className="help-section help-hero" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <img src={appIcon} alt="Lycero Office" style={{ width: 64, height: 64, borderRadius: 14, marginBottom: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
            <h3 className="help-h3">Lycero Office 2.0.0</h3>
            <p className="help-tagline">
              <strong>Professional Office Suite</strong> — Docs · Sheets · Slides · PDF · Markdown · HTML
            </p>
            <p className="help-muted">
              {t('helpAboutSubtitle')}
            </p>
          </section>

          {/* Vietnamese full description */}
          <section className="help-section">
            <h3 className="help-h3">Giới thiệu sản phẩm</h3>
            <p>
              <strong>Lycero Office</strong> là bộ ứng dụng văn phòng chuyên nghiệp dành cho máy tính để bàn, hỗ trợ
              soạn thảo văn bản, phân tích dữ liệu và thiết kế trình chiếu. Phần mềm đọc, chỉnh sửa và lưu trực tiếp
              các định dạng tài liệu chuẩn quốc tế
              <code className="help-code"> .docx</code>,
              <code className="help-code"> .xlsx</code>,
              <code className="help-code"> .pptx</code>,
              <code className="help-code"> .pdf</code>,
              <code className="help-code"> .md</code> và
              <code className="help-code"> .html</code> với bộ máy byte-preserving, đảm bảo tệp đầu ra không lệch
              chuẩn ISO/IEC 29500. Tích hợp trợ lý AI <strong>Lycero Mate</strong> với quy trình chỉnh sửa minh bạch,
              có thể xem lại và chấp nhận từng bước trước khi áp dụng vào tài liệu.
            </p>
          </section>

          {/* English version for global audience */}
          <section className="help-section help-section-en">
            <h3 className="help-h3">About the product</h3>
            <p>
              <strong>Lycero Office</strong> is a professional desktop office suite for document authoring,
              data analysis and presentation design. It opens, edits and saves native
              <code className="help-code"> .docx</code>,
              <code className="help-code"> .xlsx</code>,
              <code className="help-code"> .pptx</code>,
              <code className="help-code"> .pdf</code>,
              <code className="help-code"> .md</code> and
              <code className="help-code"> .html</code> files with a byte-preserving engine, ensuring full
              conformance with ISO/IEC 29500. Pairs with the <strong>Lycero Mate</strong> AI assistant for
              transparent, reviewable editing workflows.
            </p>
          </section>

          {/* Identity / legal facts (read-only structured) */}
          <section className="help-section help-grid">
            <h3 className="help-h3 help-h3-wide">{t('helpAboutIdentity')}</h3>
            <dl className="help-dl">
              <div className="help-dl-row">
                <dt>Tổ chức phát triển</dt>
                <dd>
                  <strong>ITAC AI Heavy Industries</strong>
                </dd>
              </div>
              <div className="help-dl-row">
                <dt>Hệ sinh thái thương hiệu</dt>
                <dd>Lycero (lycero.com)</dd>
              </div>
              <div className="help-dl-row">
                <dt>Pháp nhân nhãn hiệu</dt>
                <dd>ITAC AI Heavy Industries</dd>
              </div>
              <div className="help-dl-row">
                <dt>Mã phiên bản nội bộ</dt>
                <dd>Lycero Office 2.0.0 (build 2026.10)</dd>
              </div>
              <div className="help-dl-row">
                <dt>Nền tảng kỹ thuật</dt>
                <dd>Electron + React 19 + TypeScript + Vite</dd>
              </div>
              <div className="help-dl-row">
                <dt>Tư cách pháp lý</dt>
                <dd>
                  Tác phẩm phái sinh thương mại hợp pháp (Apache-2.0 / Section 4) — kế thừa từ{' '}
                  <strong>GenOffice</strong> (Copyright © 2026 Mainfunc, Inc.)
                </dd>
              </div>
              <div className="help-dl-row">
                <dt>Cổng hỗ trợ & Tài liệu</dt>
                <dd>https://lycero.com</dd>
              </div>
            </dl>
          </section>

          <section className="help-section">
            <h3 className="help-h3">{t('helpAboutLicenseTitle')}</h3>
            <p className="help-muted">
              {t('helpAboutLicenseBody')}
            </p>
            <p>
              Xem chi tiết tại <code className="help-code">NOTICE</code>,{' '}
              <code className="help-code">LICENSE</code> và{' '}
              <code className="help-code">LEGAL_AND_IP_COMPLIANCE.md</code> ở thư mục gốc. Toàn văn giấy phép
              của từng thành phần nguồn mở được đóng gói kèm bộ cài đặt.
            </p>
          </section>
        </div>

        <footer className="help-footer">
          <button className="help-btn-primary" onClick={onClose}>
            {t('helpClose')}
          </button>
        </footer>
      </div>
    </div>
  )
}
