/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { describe, expect, it } from 'vitest'
import { marginsFitPage } from '../src/renderer/components/MarginDialog'

describe('page margins', () => {
  it('rejects margins that do not leave the minimum page body', () => {
    expect(marginsFitPage({ top: 720, right: 5000, bottom: 720, left: 5000 }, 10319, 14572)).toBe(
      false,
    )
    expect(marginsFitPage({ top: 720, right: 720, bottom: 720, left: 720 }, 10319, 14572)).toBe(
      true,
    )
  })
})
