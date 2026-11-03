/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '@lycero/i18n'
import { AI_SKILLS_LABELS } from './strings-ai-skills'
import { useDismissablePopover } from './popover-dismiss'
import './ai-skills.css'

/** one installed skill as the menu shows it */
export interface AiSkillsMenuEntry {
  name: string
  title?: string
  description: string
  cloudProtected?: boolean
  tier?: string
  locked?: boolean
  aliases?: readonly string[]
}

const MERGED_SKILL_DISPLAY_TITLES: Readonly<Record<string, string>> = {
  'vn-exam-matrix-specification-tt22': 'Ma trận & đặc tả đề (TT22)',
  'vn-gdpt2018-lesson-plan-cv5512': 'Kế hoạch bài dạy GDPT 2018 (CV 5512)',
  'vn-admin-doc-nd30': 'Thể thức văn bản hành chính (NĐ30/2020)',
  'vn-corporate-accounting-tt200-tt133': 'Kế toán doanh nghiệp (TT200 / TT99)',
  'vn-legal-contract-audit': 'Thẩm định & rà soát hợp đồng',
}

function foldSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

export function getMergedSkillHint(
  entry: AiSkillsMenuEntry,
  query: string,
  lang: Lang = 'vi',
): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const cleanName = entry.name.trim().toLowerCase()
  if (cleanName.includes(q)) return null
  const qFolded = foldSearchText(q)
  const matchedAlias = (entry.aliases ?? []).some((alias) => {
    const a = alias.toLowerCase()
    return a !== cleanName && (a.includes(q) || foldSearchText(a).includes(qFolded))
  })
  if (!matchedAlias) return null
  const targetTitle = MERGED_SKILL_DISPLAY_TITLES[cleanName] ?? entry.title ?? entry.name
  return lang === 'vi' ? `Đã gộp vào: ${targetTitle}` : `Merged into: ${targetTitle}`
}

export function filterSkillsForMenu(
  skills: readonly AiSkillsMenuEntry[],
  query: string,
): readonly AiSkillsMenuEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return skills
  const qFolded = foldSearchText(q)
  return skills.filter((s) => {
    const haystack = [s.name, s.title ?? '', s.description, ...(s.aliases ?? [])]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q) || foldSearchText(haystack).includes(qFolded)
  })
}

/**
 * The composer "+" menu: add a file, or attach one or more installed skills
 * to the next message. Two levels, drilled in place rather than flown out —
 * the AI panel is a narrow sidebar with no room beside the menu.
 *
 * Nothing here loads a skill into the conversation on its own. A skill's text
 * only reaches the model when the user picks it here and sends.
 */
export function AiSkillsMenu({
  lang,
  listSkills,
  selected,
  onToggle,
  onAddFile,
  onManage,
}: {
  readonly lang: Lang
  /** called when the skills page opens, so a fresh install shows up without a reload */
  readonly listSkills: () => Promise<readonly AiSkillsMenuEntry[]>
  readonly selected: readonly string[]
  readonly onToggle: (name: string) => void
  /** absent in apps that take no attachments: the menu then opens on the skills page */
  readonly onAddFile?: (() => void) | undefined
  /** absent when there is no settings page to jump to */
  readonly onManage?: (() => void) | undefined
}): React.JSX.Element {
  const strings = AI_SKILLS_LABELS[lang]
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<'root' | 'skills'>('root')
  const [skills, setSkills] = useState<readonly AiSkillsMenuEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismissablePopover(open, close, { inside: () => [btnRef.current, popRef.current] })

  const showSkills = useCallback(() => {
    setPage('skills')
    setQuery('')
    listSkills()
      .then((list) => setSkills(list))
      .catch(() => setSkills((prev) => prev ?? []))
  }, [listSkills])

  const toggle = () => {
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect()
      // the composer sits at the panel bottom: open upwards, pinned to the button
      if (rect) setPopStyle({ left: rect.left, bottom: window.innerHeight - rect.top + 6 })
      if (onAddFile) {
        setPage('root')
        // FX-69: Pre-warm skill list as soon as the + menu opens so switching to "Kỹ năng" is instant
        if (skills === null) {
          listSkills()
            .then((list) => setSkills(list))
            .catch(() => setSkills((prev) => prev ?? []))
        }
      } else {
        showSkills()
      }
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (open && page === 'skills') searchRef.current?.focus()
  }, [open, page])

  const shown = useMemo(() => {
    if (!skills) return null
    return filterSkillsForMenu(skills, query)
  }, [skills, query])

  return (
    <div className="ai-plus">
      <button
        ref={btnRef}
        type="button"
        className={`ai-plus-btn${open ? ' open' : ''}${selected.length > 0 ? ' has-skills' : ''}`}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={strings.addTitle}
        data-tip={strings.addTitle}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M7 1.5v11M1.5 7h11"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <div ref={popRef} className="ai-plus-pop" role="menu" style={popStyle}>
          {page === 'root' ? (
            <>
              <button
                type="button"
                className="ai-plus-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onAddFile?.()
                }}
              >
                <ClipIcon />
                <span className="ai-plus-item-text">{strings.addFile}</span>
              </button>
              <div className="ai-plus-sep" />
              <button type="button" className="ai-plus-item" role="menuitem" onClick={showSkills}>
                <PenIcon />
                <span className="ai-plus-item-text">{strings.skills}</span>
                <Chevron />
              </button>
            </>
          ) : (
            <>
              <div className="ai-plus-search-row">
                {onAddFile && (
                  <button
                    type="button"
                    className="ai-plus-back"
                    onClick={() => setPage('root')}
                    aria-label={strings.back}
                    data-tip={strings.back}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                      <path
                        d="M7.5 2L3.5 6l4 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
                <input
                  ref={searchRef}
                  className="ai-plus-search"
                  value={query}
                  placeholder={strings.searchPlaceholder}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false)
                    else if (e.key === 'Enter' && shown && shown.length > 0) {
                      e.preventDefault()
                      const first = shown[0]!
                      const isCloud = Boolean(
                        first.cloudProtected || first.tier === 'pro' || first.tier === 'plus',
                      )
                      const isOffline =
                        isCloud && typeof navigator !== 'undefined' && navigator.onLine === false
                      if (!isOffline && !first.locked) {
                        onToggle(first.name)
                        setOpen(false)
                      }
                    }
                  }}
                />
              </div>
              <div className="ai-plus-list" role="group" aria-label={strings.skills}>
                {shown && shown.length === 0 && (
                  <div className="ai-plus-empty">
                    {skills?.length ? strings.noMatch : strings.noSkills}
                  </div>
                )}
                {shown?.map((s) => {
                  const on = selected.includes(s.name)
                  const isCloud = Boolean(s.cloudProtected || s.tier === 'pro' || s.tier === 'plus')
                  const isOffline =
                    isCloud && typeof navigator !== 'undefined' && navigator.onLine === false
                  const isLocked = Boolean(s.locked)
                  const isDisabled = isOffline || isLocked
                  const offlinePrefix =
                    lang === 'vi'
                      ? '[Không khả dụng khi ngoại tuyến] '
                      : '[Unavailable offline] '
                  const lockedPrefix =
                    lang === 'vi' ? '[Khoá theo gói Pro] ' : '[Locked — Pro tier] '
                  const mergedHint = getMergedSkillHint(s, query, lang)
                  const baseDesc = mergedHint ? `${mergedHint} — ${s.description}` : s.description
                  const displayDesc =
                    isOffline && !baseDesc.startsWith('[')
                      ? `${offlinePrefix}${baseDesc}`
                      : isLocked && !baseDesc.startsWith('[')
                        ? `${lockedPrefix}${baseDesc}`
                        : baseDesc
                  return (
                    <button
                      key={s.name}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      disabled={isDisabled}
                      className={`ai-plus-skill${on ? ' on' : ''}${isDisabled ? ' disabled' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!isDisabled) onToggle(s.name)
                      }}
                      title={displayDesc}
                    >
                      <span className="ai-plus-avatar" aria-hidden>
                        {s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="ai-plus-skill-text">
                        <span className="ai-plus-skill-name-row">
                          <span className="ai-plus-skill-name">{s.name}</span>
                          {isCloud && (
                            <span className="ai-plus-cloud-badge">
                              {isLocked
                                ? 'PRO LOCKED'
                                : s.tier === 'plus'
                                  ? 'CLOUD PLUS'
                                  : 'CLOUD PRO'}
                            </span>
                          )}
                        </span>
                        <span className="ai-plus-skill-desc">{displayDesc}</span>
                      </span>
                      {on && (
                        <svg
                          className="ai-plus-check"
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          aria-hidden
                        >
                          <path
                            d="M2.5 7.5l3 3 6-6.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
              {onManage && (
                <button
                  type="button"
                  className="ai-plus-item ai-plus-manage"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onManage()
                  }}
                >
                  <GearIcon />
                  <span className="ai-plus-item-text">{strings.manage}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Chips for the skills attached to the draft (removable) or echoed on a sent bubble. */
export function AiSkillChips({
  lang,
  names,
  onRemove,
}: {
  readonly lang: Lang
  readonly names: readonly string[]
  readonly onRemove?: ((name: string) => void) | undefined
}): React.JSX.Element | null {
  const strings = AI_SKILLS_LABELS[lang]
  if (names.length === 0) return null
  return (
    <div
      className={`ai-skill-chips${onRemove ? '' : ' ai-skill-chips-sent'}`}
      aria-label={strings.attachedTitle}
    >
      {names.map((name) => (
        <span key={name} className="ai-skill-chip" title={name}>
          <PenIcon />
          <span className="ai-skill-chip-name">{name}</span>
          {onRemove && (
            <button
              type="button"
              className="ai-skill-chip-remove"
              onClick={() => onRemove(name)}
              aria-label={strings.removeTitle}
              data-tip={strings.removeTitle}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path
                  d="M2 2l6 6M8 2l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function ClipIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg className="ai-plus-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path
        d="M3.5 2l3 3-3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
