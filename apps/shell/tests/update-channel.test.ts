/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { describe, expect, it } from 'vitest'
import { isUpdateChannel } from '../src/shared/update-api'

/** Update-channel value guard: settings files and IPC payloads are untrusted. */
describe('isUpdateChannel', () => {
  it('accepts the two known channels', () => {
    expect(isUpdateChannel('stable')).toBe(true)
    expect(isUpdateChannel('beta')).toBe(true)
  })

  it('rejects anything else', () => {
    for (const bad of ['latest', 'BETA', '', 42, null, undefined, {}, []]) {
      expect(isUpdateChannel(bad)).toBe(false)
    }
  })
})
