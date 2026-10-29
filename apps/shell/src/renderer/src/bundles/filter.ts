/**
 * Lycero Office Desktop
 * Copyright (c) 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright (c) 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import type { WorkBundle } from '@lycero/ai-auth'
import type { InstalledBundleEntry } from '../../../shared/bundle-api'

export type FilterChip = 'all' | 'installed' | 'enabled'

export function normalizeBundle(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function filterBundles(
  bundles: WorkBundle[],
  search: string,
  installed: InstalledBundleEntry[],
  filter: FilterChip,
): WorkBundle[] {
  const term = normalizeBundle(search)
  const installedMap = new Map(installed.map((i) => [i.bundleKey, i]))

  return bundles.filter((b) => {
    if (term) {
      const n = normalizeBundle
      const labelOk = n(b.labelVi).includes(term)
      const descOk = n(b.description).includes(term)
      const keyOk = n(b.key).includes(term)
      const toolOk = b.tools.some((t) => n(t.name).includes(term))
      const skillOk = b.skills.some((s) => n(s.name).includes(term))
      if (!labelOk && !descOk && !keyOk && !toolOk && !skillOk) return false
    }
    if (filter === 'installed') return installedMap.has(b.key)
    if (filter === 'enabled') return installedMap.get(b.key)?.enabled === true
    return true
  })
}
