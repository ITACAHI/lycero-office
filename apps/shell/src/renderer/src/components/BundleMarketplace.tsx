/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { WORK_BUNDLES, type WorkBundle } from '@lycero/ai-auth'
import type { InstalledBundleEntry } from '../../../shared/bundle-api'
import type { TFunc } from '../locale'
import { BundleCard } from '../bundles/BundleCard'
import { BundleSearch } from '../bundles/BundleSearch'
import { FilterChips } from '../bundles/FilterChips'
import { filterBundles, type FilterChip } from '../bundles/filter'

interface BundleMarketplaceProps {
  t: TFunc
}

export function BundleMarketplace({ t }: BundleMarketplaceProps) {
  const [installed, setInstalled] = useState<InstalledBundleEntry[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterChip>('all')
  const [busyKey, setBusyKey] = useState<string | null>(null)

  // Initial load
  useEffect(() => {
    void window.aiOffice.bundles.list().then(setInstalled)
  }, [])

  // Subscribe to broadcasts
  useEffect(() => {
    const offInstalled = window.aiOffice.bundles.onInstalled(() => {
      void window.aiOffice.bundles.list().then(setInstalled)
    })
    const offUninstalled = window.aiOffice.bundles.onUninstalled(() => {
      void window.aiOffice.bundles.list().then(setInstalled)
    })
    const offEnabled = window.aiOffice.bundles.onEnabledChanged(() => {
      void window.aiOffice.bundles.list().then(setInstalled)
    })
    return () => {
      offInstalled()
      offUninstalled()
      offEnabled()
    }
  }, [])

  // Memoized filtered bundle list
  const visible = useMemo(
    () => filterBundles([...WORK_BUNDLES], search, installed, filter),
    [installed, search, filter],
  )

  // Usage counts from telemetry
  const usageCounts = useMemo<Record<string, number>>(() => {
    const raw = window.aiOffice.bundles.getUsageCounts?.() ?? {}
    const result: Record<string, number> = {}
    for (const [bundleId, counts] of Object.entries(raw)) {
      if (counts && typeof counts === 'object') {
        result[bundleId] = (counts as { toolUse?: number }).toolUse ?? 0
      }
    }
    return result
  }, [installed])

  // Handlers
  const handleInstall = useCallback(
    (bundle: WorkBundle) => {
      setBusyKey(bundle.key)
      void window.aiOffice.bundles
        .install(bundle.id)
        .finally(() => setBusyKey(null))
    },
    [],
  )

  const handleUninstall = useCallback((bundleKey: string) => {
    setBusyKey(bundleKey)
    void window.aiOffice.bundles
      .uninstall(bundleKey)
      .finally(() => setBusyKey(null))
  }, [])

  const handleToggle = useCallback((bundleKey: string, enabled: boolean) => {
    setBusyKey(bundleKey)
    void window.aiOffice.bundles
      .setEnabled(bundleKey, enabled)
      .finally(() => setBusyKey(null))
  }, [])

  return (
    <div className="bc-marketplace">
      {/* Header: search + filter chips + count */}
      <div className="bc-header">
        <BundleSearch value={search} onChange={setSearch} t={t} />
        <div className="bc-header-row">
          <FilterChips value={filter} onChange={setFilter} t={t} />
          <span className="bc-count">
            {t('bundleInstalledCount', { n: installed.length })}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="bc-grid">
        {visible.map((bundle) => {
          const entry = installed.find((i) => i.bundleKey === bundle.key)
          const isBusy = busyKey === bundle.key
          const usageCount = usageCounts[bundle.key]

          return (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              entry={entry ?? null}
              usageCount={usageCount}
              busy={isBusy}
              t={t}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              onToggle={handleToggle}
            />
          )
        })}
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="bc-empty">{t('bundleEmpty')}</div>
      )}
    </div>
  )
}
