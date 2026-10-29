/**
 * Lycero Office Desktop
 * Copyright (c) 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright (c) 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { memo } from 'react'
import type { TFunc } from '../locale'

export interface BundleSearchProps {
  value: string
  onChange: (value: string) => void
  t: TFunc
}

export const BundleSearch = memo(function BundleSearch({
  value,
  onChange,
  t,
}: BundleSearchProps) {
  return (
    <input
      type="search"
      className="bc-search"
      placeholder={t('bundleSearchPlaceholder')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t('bundleSearchPlaceholder')}
      autoComplete="off"
      spellCheck={false}
    />
  )
})
