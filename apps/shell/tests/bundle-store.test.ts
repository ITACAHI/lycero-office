/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { BundleStore } from '../src/main/bundle-store'

const freshDir = (): string => join(tmpdir(), `bundle-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)

describe('BundleStore', () => {
  let dir: string

  beforeEach(() => {
    dir = freshDir()
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  // ── Happy path ───────────────────────────────────────────────────

  it('installs a bundle and returns an InstalledBundleEntry', async () => {
    const store = new BundleStore({ storageDir: dir })
    const entry = await store.install(1) // accounting_vn
    expect(entry.bundleId).toBe(1)
    expect(entry.bundleKey).toBe('accounting_vn')
    expect(entry.enabled).toBe(true)
    expect(typeof entry.installedAt).toBe('number')
    expect(entry.config).toEqual({})
  })

  it('list returns all installed entries', async () => {
    const store = new BundleStore({ storageDir: dir })
    await store.install(1)
    await store.install(2)
    const list = await store.list()
    expect(list).toHaveLength(2)
    expect(list.map((e) => e.bundleKey).sort()).toEqual(['accounting_vn', 'freelance_solo'])
  })

  it('getEnabledBundles returns WorkBundle definitions for enabled entries', async () => {
    const store = new BundleStore({ storageDir: dir })
    await store.install(1) // accounting_vn
    await store.install(2) // freelance_solo
    await store.setEnabled('accounting_vn', false)
    // general_office is always-on (required), freelance_solo still enabled
    const bundles = await store.getEnabledBundles()
    const keys = bundles.map((b) => b.key)
    expect(keys).toContain('general_office') // always-on (required)
    expect(keys).toContain('freelance_solo') // installed + still enabled
    expect(keys).not.toContain('accounting_vn') // disabled
    expect(keys).toHaveLength(2)
  })

  it('uninstall removes the entry', async () => {
    const store = new BundleStore({ storageDir: dir })
    await store.install(1)
    await store.uninstall('accounting_vn')
    const list = await store.list()
    expect(list).toHaveLength(0)
  })

  it('setEnabled toggles the enabled flag', async () => {
    const store = new BundleStore({ storageDir: dir })
    await store.install(1) // accounting_vn
    await store.install(2) // freelance_solo
    // general_office is always-on (required)
    const keys0 = (await store.getEnabledBundles()).map((b) => b.key)
    expect(keys0).toContain('general_office')
    expect(keys0).toHaveLength(3) // general_office + accounting_vn + freelance_solo

    await store.setEnabled('accounting_vn', false)
    const bundles = await store.getEnabledBundles()
    const keys = bundles.map((b) => b.key)
    // general_office (required) + freelance_solo; accounting_vn disabled
    expect(keys).toHaveLength(2)
    expect(keys).toContain('general_office')
    expect(keys).toContain('freelance_solo')
    expect(keys).not.toContain('accounting_vn')

    await store.setEnabled('accounting_vn', true)
    const bundles2 = await store.getEnabledBundles()
    const keys2 = bundles2.map((b) => b.key)
    // general_office (required) + accounting_vn (re-enabled) + freelance_solo
    expect(keys2).toHaveLength(3)
    expect(keys2).toContain('general_office')
    expect(keys2).toContain('accounting_vn')
    expect(keys2).toContain('freelance_solo')
  })

  it('setConfig stores per-bundle configuration', async () => {
    const store = new BundleStore({ storageDir: dir })
    await store.install(1)
    await store.setConfig('accounting_vn', { preferredFormat: 'xlsx' })
    const list = await store.list()
    expect(list[0]?.config).toEqual({ preferredFormat: 'xlsx' })
  })

  // ── Idempotent install ───────────────────────────────────────────

  it('installing the same bundle twice is a no-op', async () => {
    const store = new BundleStore({ storageDir: dir })
    await store.install(1)
    const before = await store.list()
    await store.install(1) // same id
    const after = await store.list()
    expect(after).toEqual(before)
    // installedAt should not change
    expect(after[0]?.installedAt).toBe(before[0]?.installedAt)
  })

  // ── Persistence ─────────────────────────────────────────────────

  it('writes survive a fresh instance', async () => {
    const store1 = new BundleStore({ storageDir: dir })
    await store1.install(1)
    await store1.install(2)
    await store1.setEnabled('accounting_vn', false)

    const store2 = new BundleStore({ storageDir: dir })
    const list = await store2.list()
    expect(list).toHaveLength(2)
    expect(list.find((e) => e.bundleKey === 'accounting_vn')?.enabled).toBe(false)
    expect(list.find((e) => e.bundleKey === 'freelance_solo')?.enabled).toBe(true)
  })

  // ── Events ──────────────────────────────────────────────────────

  it('onInstalled fires when a bundle is installed', async () => {
    const store = new BundleStore({ storageDir: dir })
    const received: unknown[] = []
    const unsub = store.onInstalled((entry) => received.push(entry))
    await store.install(1)
    unsub()
    expect(received).toHaveLength(1)
    expect((received[0] as { bundleKey: string }).bundleKey).toBe('accounting_vn')
  })

  it('onUninstalled fires when a bundle is uninstalled', async () => {
    const store = new BundleStore({ storageDir: dir })
    await store.install(1)
    const received: unknown[] = []
    const unsub = store.onUninstalled((key) => received.push(key))
    await store.uninstall('accounting_vn')
    unsub()
    expect(received).toEqual(['accounting_vn'])
  })

  it('onEnabledChanged fires when enabled state changes', async () => {
    const store = new BundleStore({ storageDir: dir })
    await store.install(1)
    const received: unknown[] = []
    const unsub = store.onEnabledChanged((key, enabled) => received.push({ key, enabled }))
    await store.setEnabled('accounting_vn', false)
    expect(received).toEqual([{ key: 'accounting_vn', enabled: false }])
    unsub()
  })

  // ── Edge cases ─────────────────────────────────────────────────

  it('uninstalling an unknown key is a no-op with a warning', async () => {
    const store = new BundleStore({ storageDir: dir })
    const warnSpy = vi.fn()
    console.warn = warnSpy
    await store.uninstall('nonexistent_bundle_key')
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('creates the storage directory automatically if missing', async () => {
    const nested = join(dir, 'nested', 'bundles')
    const store = new BundleStore({ storageDir: nested })
    await store.install(1)
    const list = await store.list()
    expect(list).toHaveLength(1)
  })

  it('install throws for unknown bundle id', async () => {
    const store = new BundleStore({ storageDir: dir })
    await expect(store.install(9999)).rejects.toThrow('no bundle with id 9999')
  })

  it('setEnabled throws for uninstalled bundle', async () => {
    const store = new BundleStore({ storageDir: dir })
    await expect(store.setEnabled('accounting_vn', true)).rejects.toThrow('no installed bundle')
  })

  it('setConfig throws for uninstalled bundle', async () => {
    const store = new BundleStore({ storageDir: dir })
    await expect(store.setConfig('accounting_vn', {})).rejects.toThrow('no installed bundle')
  })

  it('fetchRemoteManifest returns null when no fetcher is provided', async () => {
    const store = new BundleStore({ storageDir: dir })
    const result = await store.fetchRemoteManifest()
    expect(result).toBeNull()
  })
})
