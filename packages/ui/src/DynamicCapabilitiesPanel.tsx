/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * DynamicCapabilitiesPanel: Astryx schema-driven UI for configuring
 * cloud-synced Opaque Manifest Skills without exposing raw technical internals.
 */

import React, { useState } from 'react'
import { getFieldKey, type CloudSkillManifest, type SkillConfigFieldSchema } from '@lycero/agent-core'
import './dynamic-capabilities.css'

export interface DynamicCapabilitiesPanelProps {
  skills: readonly CloudSkillManifest[]
  activeSkillSlugs: readonly string[]
  skillConfigs: Record<string, Record<string, unknown>>
  isOffline?: boolean
  isSyncing?: boolean
  onToggleSkill: (slug: string, active: boolean) => void
  onChangeConfig: (slug: string, fieldId: string, value: unknown) => void
  onRefreshSkills: () => void | Promise<void>
}

export function DynamicCapabilitiesPanel({
  skills,
  activeSkillSlugs,
  skillConfigs,
  isOffline = false,
  isSyncing = false,
  onToggleSkill,
  onChangeConfig,
  onRefreshSkills,
}: DynamicCapabilitiesPanelProps): React.JSX.Element {
  const [expandedConfigs, setExpandedConfigs] = useState<Record<string, boolean>>({})

  const toggleExpand = (slug: string) => {
    setExpandedConfigs((prev) => ({ ...prev, [slug]: !prev[slug] }))
  }

  const activeCount = activeSkillSlugs.length

  const renderField = (
    skillSlug: string,
    field: SkillConfigFieldSchema,
    currentValue: unknown,
  ): React.JSX.Element => {
    const fieldKey = getFieldKey(field)
    const val = currentValue ?? field.defaultValue

    switch (field.type) {
      case 'select':
        return (
          <div key={fieldKey} className="lycero-cap-field">
            <div className="lycero-cap-field-label-row">
              <label htmlFor={`field-${skillSlug}-${fieldKey}`}>{field.label}</label>
            </div>
            {field.description && (
              <span className="lycero-cap-field-desc">{field.description}</span>
            )}
            <select
              id={`field-${skillSlug}-${fieldKey}`}
              className="lycero-cap-select"
              value={String(val ?? '')}
              onChange={(e) => onChangeConfig(skillSlug, fieldKey, e.target.value)}
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'boolean':
        return (
          <div key={fieldKey} className="lycero-cap-field">
            <label className="lycero-cap-checkbox-row">
              <input
                type="checkbox"
                className="lycero-cap-checkbox"
                checked={Boolean(val)}
                onChange={(e) => onChangeConfig(skillSlug, fieldKey, e.target.checked)}
              />
              <span>{field.label}</span>
            </label>
            {field.description && (
              <span className="lycero-cap-field-desc">{field.description}</span>
            )}
          </div>
        )

      case 'slider': {
        const numVal = typeof val === 'number' ? val : Number(field.defaultValue ?? 0)
        return (
          <div key={fieldKey} className="lycero-cap-field">
            <div className="lycero-cap-field-label-row">
              <label htmlFor={`field-${skillSlug}-${fieldKey}`}>{field.label}</label>
              <span className="lycero-cap-slider-val">{numVal}</span>
            </div>
            {field.description && (
              <span className="lycero-cap-field-desc">{field.description}</span>
            )}
            <div className="lycero-cap-slider-wrap">
              <input
                id={`field-${skillSlug}-${fieldKey}`}
                type="range"
                className="lycero-cap-slider"
                min={field.min ?? 1}
                max={field.max ?? 5}
                step={field.step ?? 1}
                value={numVal}
                onChange={(e) =>
                  onChangeConfig(skillSlug, fieldKey, parseFloat(e.target.value))
                }
              />
            </div>
          </div>
        )
      }
      default:
        return <div key={fieldKey} />
    }
  }

  return (
    <div className="lycero-cap-panel" data-lycero="dynamic-capabilities">
      {/* Header */}
      <div className="lycero-cap-header">
        <div className="lycero-cap-title-wrap">
          <h3 className="lycero-cap-title">Kỹ năng Trợ lý Đám mây</h3>
          {activeCount > 0 && (
            <span className="lycero-cap-active-badge">
              Đang áp dụng Kỹ năng ({activeCount})
            </span>
          )}
        </div>
        <button
          type="button"
          className="lycero-cap-refresh-btn"
          onClick={() => onRefreshSkills()}
          disabled={isSyncing}
          title="Làm mới Kỹ năng"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isSyncing ? 'lycero-cap-spin' : undefined}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>{isSyncing ? 'Đang cập nhật...' : 'Làm mới Kỹ năng'}</span>
        </button>
      </div>

      {/* Offline notification banner */}
      {isOffline && (
        <div className="lycero-cap-offline-banner" role="status">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Đang làm việc ngoại tuyến, tính năng trợ lý thông minh sẽ tiếp tục khi có kết nối trở lại.
          </span>
        </div>
      )}

      {/* Skills list */}
      <div className="lycero-cap-list">
        {skills.length === 0 ? (
          <div className="lycero-cap-empty">Chưa có kỹ năng nào khả dụng.</div>
        ) : (
          skills.map((skill) => {
            const isActive = activeSkillSlugs.includes(skill.slug)
            const hasConfig =
              skill.clientConfigSchema && skill.clientConfigSchema.length > 0
            const isExpanded = expandedConfigs[skill.slug] ?? isActive
            const currentConfig = skillConfigs[skill.slug] ?? {}

            return (
              <div
                key={skill.slug}
                className={`lycero-cap-card${isActive ? ' active' : ''}`}
              >
                <div className="lycero-cap-card-header">
                  <div className="lycero-cap-card-info">
                    <div className="lycero-cap-card-name-row">
                      <span className="lycero-cap-card-name">{skill.name}</span>
                      {skill.category && (
                        <span className="lycero-cap-category-tag">{skill.category}</span>
                      )}
                    </div>
                    <p className="lycero-cap-card-desc">{skill.description}</p>
                  </div>

                  {/* Toggle Switch */}
                  <label
                    className="lycero-cap-toggle-label"
                    title={isActive ? 'Tắt kỹ năng' : 'Bật kỹ năng'}
                  >
                    <input
                      type="checkbox"
                      className="lycero-cap-toggle-input"
                      checked={isActive}
                      onChange={(e) => onToggleSkill(skill.slug, e.target.checked)}
                      role="switch"
                      aria-checked={isActive}
                    />
                    <div className="lycero-cap-toggle-track">
                      <div className="lycero-cap-toggle-thumb" />
                    </div>
                  </label>
                </div>

                {/* Dynamic Configuration Form (when active and schema is present) */}
                {isActive && hasConfig && (
                  <div className="lycero-cap-config-form">
                    <div
                      className="lycero-cap-config-title"
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      onClick={() => toggleExpand(skill.slug)}
                    >
                      <span>Tùy biến Kỹ năng</span>
                      <span style={{ fontSize: '11px', textTransform: 'none' }}>
                        {isExpanded ? 'Thu gọn ▲' : 'Mở rộng ▼'}
                      </span>
                    </div>

                    {isExpanded &&
                      skill.clientConfigSchema?.map((field) => {
                        const fieldKey = getFieldKey(field)
                        return renderField(skill.slug, field, currentConfig[fieldKey])
                      })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
