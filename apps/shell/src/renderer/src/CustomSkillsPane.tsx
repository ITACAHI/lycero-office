/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { useCallback, useEffect, useState } from 'react'
import type { CustomSkill, SkillCategory } from '../../shared/home-api'
import type { TFunc } from './locale'

const CATEGORY_LABELS: Record<SkillCategory, { label: string; icon: string }> = {
  corporate: { label: 'Doanh nghiệp', icon: '🏢' },
  edtech: { label: 'Giáo dục & Đào tạo', icon: '🎓' },
  academic: { label: 'Nghiên cứu & Học thuật', icon: '🔬' },
  creative: { label: 'Sáng tạo & Tự do', icon: '💡' },
  general: { label: 'Chung', icon: '🌐' },
  custom: { label: 'Tùy chỉnh', icon: '🛠️' },
  pedagogical: { label: 'Sư phạm', icon: '📚' },
  productivity: { label: 'Năng suất', icon: '⚡' },
}

export function CustomSkillsPane({ t }: { t: TFunc }) {
  const [skills, setSkills] = useState<CustomSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingSkill, setEditingSkill] = useState<Partial<CustomSkill> | null>(null)
  const [viewingPromptSkill, setViewingPromptSkill] = useState<CustomSkill | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const showNotice = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  const loadSkills = useCallback(async () => {
    try {
      setLoading(true)
      const list = await window.aiOffice?.getCustomSkills?.()
      if (Array.isArray(list)) {
        setSkills(list)
      }
    } catch (err) {
      console.error('Failed to load custom skills:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSkills()
  }, [loadSkills])

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await window.aiOffice?.toggleCustomSkill?.(id, enabled)
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)))
      showNotice(enabled ? 'Đã kích hoạt kỹ năng.' : 'Đã tạm tắt kỹ năng.')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (skill: CustomSkill) => {
    const confirmMsg = skill.builtIn
      ? `Bạn có chắc muốn khôi phục kỹ năng mẫu "${skill.name}" về mặc định?`
      : `Bạn có chắc muốn xóa kỹ năng "${skill.name}"?`
    if (!window.confirm(confirmMsg)) return

    try {
      await window.aiOffice?.deleteCustomSkill?.(skill.id)
      await loadSkills()
      showNotice(skill.builtIn ? 'Đã khôi phục kỹ năng về mặc định.' : 'Đã xóa kỹ năng thành công.')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  const handleImport = async () => {
    try {
      const res = await window.aiOffice?.importCustomSkillDialog?.()
      if (res?.ok && res.skill) {
        await loadSkills()
        showNotice(`Đã nạp thành công kỹ năng: ${res.skill.name}`)
      } else if (res?.error && res.error !== 'Đã hủy chọn tệp.') {
        window.alert(`Lỗi tải lên: ${res.error}`)
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  const handleExport = async (id: string) => {
    try {
      const res = await window.aiOffice?.exportCustomSkill?.(id)
      if (res?.ok && res.path) {
        showNotice(`Đã xuất gói kỹ năng ZIP thành công!`)
      } else if (res?.error && res.error !== 'Đã hủy lưu tệp.') {
        window.alert(`Lỗi xuất tệp: ${res.error}`)
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSaveEdit = async () => {
    if (!editingSkill || !editingSkill.name?.trim() || !editingSkill.systemPrompt?.trim()) {
      window.alert('Vui lòng nhập Tên kỹ năng và Lời nhắc hệ thống (Prompt).')
      return
    }

    try {
      await window.aiOffice?.saveCustomSkill?.(editingSkill as any)
      setEditingSkill(null)
      await loadSkills()
      showNotice('Đã lưu kỹ năng thành công!')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  const filteredSkills = skills.filter((s) => {
    if (selectedCategory !== 'all' && s.category !== selectedCategory) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.triggers?.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="custom-skills-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 className="set-pane-title" style={{ margin: 0 }}>
            Kỹ Năng AI Tùy Biến (Custom Skills)
          </h3>
          <div className="set-field-desc" style={{ marginTop: 4 }}>
            Người dùng tự tạo, tải lên gói ZIP hoặc thư mục để nạp bí kíp nghiệp vụ chuyên sâu vào Lycero Mate.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="set-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() =>
              setEditingSkill({
                name: '',
                title: '',
                description: '',
                category: 'corporate',
                author: 'Tự biên soạn',
                version: '1.0.0',
                enabled: true,
                triggers: [],
                systemPrompt: '',
              })
            }
          >
            <span>+ Tạo kỹ năng</span>
          </button>
          <button
            type="button"
            className="set-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={handleImport}
          >
            <span>📦 Tải lên (.zip / .md)</span>
          </button>
          <button
            type="button"
            className="set-btn"
            title="Mở thư mục lưu trữ kỹ năng trên máy tính"
            onClick={() => void window.aiOffice?.openCustomSkillsFolder?.()}
          >
            <span>📁 Thư mục</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            background: 'var(--accent-tint, rgba(139, 58, 26, 0.08))',
            color: 'var(--accent, #8B3A1A)',
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 14,
            border: '1px solid var(--accent-border, rgba(139, 58, 26, 0.2))',
          }}
        >
          {notice}
        </div>
      )}

      {/* Filter and search row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`persona-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            Tất cả ({skills.length})
          </button>
          {(['corporate', 'edtech', 'academic', 'creative', 'general'] as SkillCategory[]).map((cat) => {
            const count = skills.filter((s) => s.category === cat).length
            return (
              <button
                key={cat}
                type="button"
                className={`persona-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {CATEGORY_LABELS[cat].icon} {CATEGORY_LABELS[cat].label} ({count})
              </button>
            )
          })}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <input
            type="text"
            className="set-input"
            style={{ width: '100%', height: 32, fontSize: 13 }}
            placeholder="Tìm theo tên, mô tả hoặc từ khóa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Skills list */}
      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Đang tải danh sách kỹ năng…
        </div>
      ) : filteredSkills.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            borderRadius: 8,
            border: '1px dashed var(--border)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>💡</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Không tìm thấy kỹ năng phù hợp</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Bấm "+ Tạo kỹ năng" để tự viết hoặc "📦 Tải lên" gói ZIP chứa SKILL.md.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSkills.map((skill) => {
            const catInfo = CATEGORY_LABELS[skill.category] || CATEGORY_LABELS.general
            return (
              <div
                key={skill.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: skill.enabled ? 1 : 0.65,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{skill.name}</span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'var(--surface-sunken, rgba(0,0,0,0.05))',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {catInfo.icon} {catInfo.label}
                    </span>
                    {skill.builtIn && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: 'rgba(139, 58, 26, 0.08)',
                          color: 'var(--accent, #8B3A1A)',
                          fontWeight: 600,
                        }}
                      >
                        Mẫu chuẩn
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      v{skill.version || '1.0.0'} · {skill.author || 'Tự soạn'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      className="set-switch"
                      role="switch"
                      aria-checked={skill.enabled}
                      aria-label={`Bật tắt kỹ năng ${skill.name}`}
                      onClick={() => handleToggle(skill.id, !skill.enabled)}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {skill.description}
                </div>

                {skill.triggers && skill.triggers.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Kích hoạt tự động:
                    </span>
                    {skill.triggers.map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: 11,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--surface-sunken, rgba(0,0,0,0.04))',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 6,
                    paddingTop: 8,
                    borderTop: '1px dashed var(--border)',
                  }}
                >
                  <button
                    type="button"
                    className="set-btn"
                    style={{ fontSize: 12, padding: '0 10px', height: 26 }}
                    onClick={() => setViewingPromptSkill(skill)}
                  >
                    👁️ Xem Prompt
                  </button>
                  <button
                    type="button"
                    className="set-btn"
                    style={{ fontSize: 12, padding: '0 10px', height: 26 }}
                    onClick={() => setEditingSkill({ ...skill })}
                  >
                    ✏️ Sửa
                  </button>
                  <button
                    type="button"
                    className="set-btn"
                    style={{ fontSize: 12, padding: '0 10px', height: 26 }}
                    title="Xuất gói file ZIP chia sẻ"
                    onClick={() => handleExport(skill.id)}
                  >
                    ⬇️ Xuất ZIP
                  </button>
                  <button
                    type="button"
                    className="set-btn"
                    style={{ fontSize: 12, padding: '0 10px', height: 26, color: '#C53030' }}
                    onClick={() => handleDelete(skill)}
                  >
                    {skill.builtIn ? 'Hoàn nguyên' : 'Xóa'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Edit / Create Skill */}
      {editingSkill && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              width: 640,
              maxWidth: '90vw',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                {editingSkill.id ? 'Chỉnh Sửa Kỹ Năng' : 'Tạo Kỹ Năng AI Mới'}
              </h4>
              <button
                type="button"
                className="set-btn"
                style={{ minWidth: 28, padding: 0, height: 28 }}
                onClick={() => setEditingSkill(null)}
              >
                ✕
              </button>
            </div>

            <div>
              <label className="set-field-label" style={{ display: 'block', marginBottom: 4 }}>
                Tên kỹ năng *
              </label>
              <input
                type="text"
                className="set-input"
                style={{ width: '100%' }}
                placeholder="Ví dụ: Rà Soát Hợp Đồng Mua Bán Hàng Hóa"
                value={editingSkill.name || ''}
                onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="set-field-label" style={{ display: 'block', marginBottom: 4 }}>
                  Lĩnh vực áp dụng
                </label>
                <select
                  className="set-input"
                  style={{ width: '100%' }}
                  value={editingSkill.category || 'corporate'}
                  onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value as SkillCategory })}
                >
                  <option value="corporate">🏢 Doanh nghiệp</option>
                  <option value="edtech">🎓 Giáo dục & Đào tạo</option>
                  <option value="academic">🔬 Nghiên cứu & Học thuật</option>
                  <option value="creative">💡 Sáng tạo & Tự do</option>
                  <option value="general">🌐 Lĩnh vực chung</option>
                </select>
              </div>
              <div>
                <label className="set-field-label" style={{ display: 'block', marginBottom: 4 }}>
                  Phiên bản
                </label>
                <input
                  type="text"
                  className="set-input"
                  style={{ width: '100%' }}
                  placeholder="1.0.0"
                  value={editingSkill.version || '1.0.0'}
                  onChange={(e) => setEditingSkill({ ...editingSkill, version: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="set-field-label" style={{ display: 'block', marginBottom: 4 }}>
                Mô tả tóm tắt
              </label>
              <input
                type="text"
                className="set-input"
                style={{ width: '100%' }}
                placeholder="Mô tả mục đích và kết quả đầu ra của kỹ năng này..."
                value={editingSkill.description || ''}
                onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
              />
            </div>

            <div>
              <label className="set-field-label" style={{ display: 'block', marginBottom: 4 }}>
                Từ khóa kích hoạt tự động (phân tách bởi dấu phẩy)
              </label>
              <input
                type="text"
                className="set-input"
                style={{ width: '100%' }}
                placeholder="Ví dụ: hợp đồng mua bán, giao nhận hàng, phạt cọc, bảo hành"
                value={(editingSkill.triggers || []).join(', ')}
                onChange={(e) =>
                  setEditingSkill({
                    ...editingSkill,
                    triggers: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>

            <div>
              <label className="set-field-label" style={{ display: 'block', marginBottom: 4 }}>
                Chỉ dẫn phương pháp nghiệp vụ (System Prompt) *
              </label>
              <textarea
                className="set-input"
                style={{
                  width: '100%',
                  minHeight: 180,
                  fontFamily: 'Consolas, Menlo, Monaco, monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                  padding: 10,
                  resize: 'vertical',
                }}
                placeholder="Viết hướng dẫn chi tiết từng bước, checklist nghiệp vụ và mẫu định dạng đầu ra mà Lycero Mate cần tuân thủ khi kích hoạt kỹ năng này..."
                value={editingSkill.systemPrompt || ''}
                onChange={(e) => setEditingSkill({ ...editingSkill, systemPrompt: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button type="button" className="set-btn" onClick={() => setEditingSkill(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="set-btn"
                style={{ background: 'var(--accent, #8B3A1A)', color: '#fff', borderColor: 'var(--accent, #8B3A1A)' }}
                onClick={handleSaveEdit}
              >
                Lưu kỹ năng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal View Prompt */}
      {viewingPromptSkill && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              width: 600,
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                System Prompt: {viewingPromptSkill.name}
              </h4>
              <button
                type="button"
                className="set-btn"
                style={{ minWidth: 28, padding: 0, height: 28 }}
                onClick={() => setViewingPromptSkill(null)}
              >
                ✕
              </button>
            </div>

            <pre
              style={{
                background: 'var(--surface-sunken, rgba(0,0,0,0.03))',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 14,
                fontSize: 13,
                fontFamily: 'Consolas, Menlo, Monaco, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.55,
                maxHeight: 400,
                overflowY: 'auto',
                color: 'var(--text)',
              }}
            >
              {viewingPromptSkill.systemPrompt}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="set-btn"
                onClick={() => {
                  navigator.clipboard.writeText(viewingPromptSkill.systemPrompt ?? '')
                  showNotice('Đã sao chép System Prompt vào bộ nhớ tạm!')
                }}
              >
                📋 Sao chép
              </button>
              <button type="button" className="set-btn" onClick={() => setViewingPromptSkill(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
