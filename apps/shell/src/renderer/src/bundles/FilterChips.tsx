/**
 * Lycero Office Desktop
 * Copyright (c) 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright (c) 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { memo } from 'react'
import type { TFunc } from '../locale'

export type { FilterChip } from './filter'

export interface FilterChipsProps {
  value: 'all' | 'installed' | 'enabled'
  onChange: (value: 'all' | 'installed' | 'enabled') => void
  t: TFunc
}

const CHIPS: { value: 'all' | 'installed' | 'enabled'; labelKey: (t: TFunc) => string }[] = [
  { value: 'all', labelKey: (t) => t('bundleFilterAll') },
  { value: 'installed', labelKey: (t) => t('bundleFilterInstalled') },
  { value: 'enabled', labelKey: (t) => t('bundleFilterEnabled') },
]

export const FilterChips = memo(function FilterChips({
  value,
  onChange,
  t,
}: FilterChipsProps) {
  return (
    <div className="bc-filters" role="group" aria-label={t('bundleFilterLabel')}>
      {CHIPS.map((chip) => (
        <button
          key={chip.value}
          type="button"
          className={`bc-chip${value === chip.value ? ' bc-chip--active' : ''}`}
          aria-pressed={value === chip.value}
          onClick={() => onChange(chip.value)}
        >
          {chip.labelKey(t)}
        </button>
      ))}
    </div>
  )
})
