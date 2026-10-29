/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { useI18n } from './locale'
import './help-modal.css'

interface HelpNoticesModalProps {
  open: boolean
  onClose: () => void
}

/** Danh sách đầy đủ third-party — được sinh bởi tools/gen-third-party-notices.mjs
 *  Toàn văn: apps/shell/build/THIRD-PARTY-NOTICES.txt (sinh tự động khi đóng gói) */
const NOTICES_SECTIONS = [
  {
    title: 'npm packages (560+ packages)',
    items: [
      { name: 'electron', desc: 'MIT — Chromium-based desktop framework' },
      { name: 'react / react-dom', desc: 'MIT — UI component library' },
      { name: 'typescript', desc: 'Apache-2.0 — TypeScript compiler' },
      { name: 'vite', desc: 'MIT — Next-generation frontend build tool' },
      { name: '@univerjs/*', desc: 'Apache-2.0 — Spreadsheet engine' },
      { name: 'pdfjs-dist', desc: 'Apache-2.0 — PDF rendering engine' },
      { name: '@tiptap/*', desc: 'MIT — Rich-text editor framework' },
      { name: 'codemirror', desc: 'MIT — Code editor component' },
      { name: 'konva / react-konva', desc: 'MIT — Canvas rendering library' },
      { name: 'jszip', desc: 'MIT/GPL — ZIP archive handling' },
      { name: 'harfbuzzjs', desc: 'MIT — Text shaping engine' },
      { name: 'mermaid', desc: 'MIT — Diagram rendering' },
      { name: 'katex', desc: 'MIT — Math typesetting' },
      { name: 'opentype.js', desc: 'MIT — OpenType font parser' },
      { name: '@fluentui/react-icons', desc: 'MIT — Microsoft icon library' },
      { name: 'electron-builder', desc: 'MIT — Application packaging' },
    ],
  },
  {
    title: 'Native components',
    items: [
      { name: 'PDFium', desc: 'BSD-3-Clause — PDF rendering (via Chromium)' },
      { name: 'xlsx-sidecar (Rust)', desc: 'Apache-2.0 — Native Excel calculation engine' },
      { name: 'HarfBuzz', desc: 'MIT — Text shaping (via harfbuzzjs)' },
    ],
  },
  {
    title: 'Fonts bundled (SIL OFL 1.1 / Apache-2.0)',
    items: [
      { name: 'Liberation Sans / Serif / Mono', desc: 'SIL OFL 1.1 — Google Corporation' },
      { name: 'Carlito', desc: 'SIL OFL 1.1 — Lukasz Dziedzic / tyPoland' },
      { name: 'Caladea', desc: 'Apache-2.0 — Huerta Tipográfica' },
      { name: 'Noto Sans/Serif CJK SC/KR', desc: 'SIL OFL 1.1 — Adobe / Google (subset)' },
      { name: 'Noto Naskh Arabic', desc: 'SIL OFL 1.1 — The Noto Project' },
      { name: 'KaTeX webfonts', desc: 'SIL OFL 1.1 — Khan Academy / Design Science' },
    ],
  },
  {
    title: 'Other open data',
    items: [
      { name: 'Unicode Character Database 17.0.0', desc: 'Unicode License v3 — EquivalentUnifiedIdeograph' },
      { name: 'ISO/IEC 29500 OOXML schemas', desc: 'Public domain — ECMA-376' },
    ],
  },
]

/** Tài liệu "Thông báo bản quyền bên thứ 3" — mở từ menu Trợ giúp > Thông báo bản quyền.
 * Tuân thủ Apache-2.0 §4(d): phải phân phối kèm NOTICE với bất kỳ tác phẩm phái sinh nào.
 * Toàn văn: xem apps/shell/build/THIRD-PARTY-NOTICES.txt (sinh tự động khi đóng gói, 1.4MB). */
export function HelpNoticesModal({ open, onClose }: HelpNoticesModalProps) {
  const { t } = useI18n()

  if (!open) return null

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label={t('helpNotices')}>
      <div className="help-card help-card-wide">
        <header className="help-header">
          <h2 className="help-title">{t('helpNoticesTitle')}</h2>
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

        <div className="help-body help-body-scroll">
          <section className="help-section">
            <h3 className="help-h3">{t('helpNoticesIntro')}</h3>
            <p>
              Lycero Office được phân phối kèm theo <strong>560+ gói npm</strong>, <strong>144 crates Rust</strong> và
              các font chữ nguồn mở theo giấy phép nguyên bản. Toàn văn giấy phép được đóng gói cùng bộ cài đặt trong
              tệp <code className="help-code">THIRD-PARTY-NOTICES.txt</code> (1.4 MB).
            </p>
            <p className="help-muted">
              Lycero Office is distributed with <strong>560+ npm packages</strong>, <strong>144 Rust crates</strong> and
              open-source fonts under their original licenses. Full license texts are bundled in{' '}
              <code className="help-code">THIRD-PARTY-NOTICES.txt</code> (1.4 MB) at packaging time.
            </p>
          </section>

          {NOTICES_SECTIONS.map((section) => (
            <section key={section.title} className="help-section">
              <h3 className="help-h3">{section.title}</h3>
              <ul className="help-components">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <strong>{item.name}</strong> — {item.desc}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="help-section help-section-tip">
            <h3 className="help-h3">Toàn văn giấy phép · Full license text</h3>
            <p>
              File <code className="help-code">THIRD-PARTY-NOTICES.txt</code> chứa toàn văn giấy phép của tất cả 560+
              thành phần npm và 144 crates Rust, được sinh tự động bởi{' '}
              <code className="help-code">tools/gen-third-party-notices.mjs</code>. File này được đóng gói kèm bộ cài đặt.
            </p>
            <p className="help-muted">
              The full <code className="help-code">THIRD-PARTY-NOTICES.txt</code> contains complete license texts for all
              560+ npm packages and 144 Rust crates, generated by{' '}
              <code className="help-code">tools/gen-third-party-notices.mjs</code> at packaging time.
            </p>
          </section>

          <section className="help-section help-section-en">
            <h3 className="help-h3">Derivative work notice</h3>
            <p>
              Lycero Office is a derivative work of <strong>GenOffice</strong> (Copyright © 2026 Mainfunc, Inc.,
              distributed under the Apache License, Version 2.0). In compliance with Apache-2.0 §4(a)(b)(c)(d), the
              original copyright notice, a prominent notice of modification, the Apache-2.0 license text and a{' '}
              <code className="help-code">NOTICE</code> file are distributed alongside every binary build. See{' '}
              <code className="help-code">LEGAL_AND_IP_COMPLIANCE.md</code>.
            </p>
          </section>

          <section className="help-section help-section-tip">
            <h3 className="help-h3">Nominative fair use · Trích dẫn hợp lý</h3>
            <p>
              Tên gọi <em>Microsoft</em>, <em>Word</em>, <em>Excel</em>, <em>PowerPoint</em> thuộc bản quyền
              thương hiệu của Microsoft Corporation. Chỉ được dùng để mô tả khả năng tương thích định dạng{' '}
              <code className="help-code">.docx</code>, <code className="help-code">.xlsx</code>,{' '}
              <code className="help-code">.pptx</code>.
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
