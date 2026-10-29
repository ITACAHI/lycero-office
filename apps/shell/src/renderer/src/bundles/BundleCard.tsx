/**
 * Lycero Office Desktop
 * Copyright (c) 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright (c) 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { memo, useEffect, useState } from 'react'
import type { InstalledBundleEntry } from '../../../shared/bundle-api'
import type { WorkBundle } from '@lycero/ai-auth'
import type { TFunc } from '../locale'

export interface BundleCardProps {
  bundle: WorkBundle
  entry: InstalledBundleEntry | null
  usageCount?: number
  busy: boolean
  t: TFunc
  onInstall: (bundle: WorkBundle) => void
  onUninstall: (bundleKey: string) => void
  onToggle: (bundleKey: string, enabled: boolean) => void
}

export const BundleCard = memo(function BundleCard({
  bundle,
  entry,
  usageCount,
  busy,
  t,
  onInstall,
  onUninstall,
  onToggle,
}: BundleCardProps) {
  const isInstalled = !!entry
  const isEnabled = entry?.enabled === true
  const isRequired = bundle.required === true

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    onToggle(bundle.key, e.target.checked)
  }

  return (
    <article
      className={[
        'bc-card',
        isEnabled ? 'bc-card--enabled' : '',
        isInstalled ? 'bc-card--installed' : '',
        mounted ? 'bc-card--mounted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="bc-card-header">
        <div className="bc-card-icon" aria-hidden="true">
          {bundle.labelVi.charAt(0)}
        </div>
        <div className="bc-card-titles">
          <h3 className="bc-card-title">{bundle.labelVi}</h3>
          <span className="bc-card-key">{bundle.key}</span>
        </div>
        {isRequired && (
          <span className="bc-required-badge" title={t('bundleRequired')}>
            {t('bundleRequired')}
          </span>
        )}
      </header>
      <p className="bc-card-desc">{bundle.description}</p>
      <div className="bc-card-meta">
        <span className="bc-card-badge">
          {t('bundleToolsCount', { n: bundle.tools.length })}
        </span>
        {bundle.skills.length > 0 && (
          <span className="bc-card-badge">
            {t('bundleSkillsCount', { n: bundle.skills.length })}
          </span>
        )}
        {usageCount != null && usageCount > 0 && (
          <span className="bc-card-badge bc-card-badge--usage">
            {t('bundleUsageCount', { n: usageCount })}
          </span>
        )}
      </div>
      <footer className="bc-card-actions">
        {!isInstalled && !isRequired ? (
          <button
            className="bc-btn bc-btn--install"
            disabled={busy}
            onClick={() => onInstall(bundle)}
          >
            {busy ? t('bundleBusy') : t('bundleInstall')}
          </button>
        ) : isInstalled && !isRequired ? (
          <>
            <label className="bc-toggle">
              <input
                type="checkbox"
                checked={isEnabled}
                disabled={busy}
                onChange={handleToggle}
                aria-label={isEnabled ? t('bundleEnabled') : t('bundleDisabled')}
              />
              <span>{isEnabled ? t('bundleEnabled') : t('bundleDisabled')}</span>
            </label>
            <button
              className="bc-btn bc-btn--uninstall"
              disabled={busy}
              onClick={() => onUninstall(bundle.key)}
            >
              {t('bundleUninstall')}
            </button>
          </>
        ) : isInstalled && isRequired ? (
          <span className="bc-toggle bc-toggle--on">
            {t('bundleRequired')}
          </span>
        ) : null}
      </footer>
    </article>
  )
})
