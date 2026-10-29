/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { installPopoverDismiss } from '../src/popover-dismiss'

describe('installPopoverDismiss', () => {
  it('keeps the open class while another popover is open when one teardown runs twice', () => {
    const first = installPopoverDismiss(() => {})
    const second = installPopoverDismiss(() => {})
    expect(document.documentElement.classList.contains('lycero-office-popover-open')).toBe(true)
    first()
    first()
    expect(document.documentElement.classList.contains('lycero-office-popover-open')).toBe(true)
    second()
    expect(document.documentElement.classList.contains('lycero-office-popover-open')).toBe(false)
  })
})
