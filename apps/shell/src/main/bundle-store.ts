/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { writeJsonAtomic } from '@lycero/electron-utils'
import { WORK_BUNDLES, findWorkBundleByKey, type WorkBundle } from '@lycero/ai-auth/main'

// ── Types ──────────────────────────────────────────────────────────

export interface InstalledBundleEntry {
  bundleId: number
  bundleKey: string
  enabled: boolean
  installedAt: number
  config: Record<string, unknown>
}

/**
 * Remote manifest for cloud bundle discovery (Phase 2).
 * ponytail: simplified — no actual fetch logic yet; `fetchRemoteManifest`
 * returns null. Phase 6.1 will wire the real URL.
 */
export interface RemoteBundleManifest {
  version: string
  updatedAt: number
  bundles: RemoteBundleEntry[]
}

export interface RemoteBundleEntry {
  id: number
  key: string
  labelVi: string
  description: string
  tools: readonly string[]
  skills: readonly string[]
  sizeKb: number
  author: string
  downloadUrl: string
}

// ── Constants ─────────────────────────────────────────────────────

export const BUNDLE_STORAGE_DIR = 'bundles'
export const INSTALLED_FILENAME = 'installed.json'

/**
 * Remote manifest TTL — refresh no more than every 6 hours.
 * ponytail: in-memory cache only; no disk persistence of manifest yet.
 * Ceiling: Phase 6.1 adds manifest disk cache + conditional fetch.
 */
export const REMOTE_MANIFEST_TTL_MS = 6 * 60 * 60 * 1000

// ── BundleStore ───────────────────────────────────────────────────

export class BundleStore {
  /**
   * @param opts.storageDir  Base userData directory (e.g. `app.getPath('userData')`).
   *                         The store writes to `<storageDir>/bundles/installed.json`.
   * @param opts.fetchRemoteManifest  Optional async fn to fetch remote manifest.
   *                                  Defaults to a no-op returning null.
   */
  constructor(opts: {
    storageDir: string
    fetchRemoteManifest?: () => Promise<RemoteBundleManifest | null>
  }) {
    this._storageDir = opts.storageDir
    this._fetchRemoteManifest = opts.fetchRemoteManifest ?? (async () => null)
    this._installDir = join(this._storageDir, BUNDLE_STORAGE_DIR)
    this._installedPath = join(this._installDir, INSTALLED_FILENAME)
    // Ensure the directory exists on construction so first read/write is safe.
    if (!existsSync(this._installDir)) {
      mkdirSync(this._installDir, { recursive: true })
    }
  }

  private readonly _storageDir: string
  private readonly _installDir: string
  private readonly _installedPath: string
  private readonly _fetchRemoteManifest: () => Promise<RemoteBundleManifest | null>

  /** In-memory snapshot of installed bundles. */
  private _installed: InstalledBundleEntry[] = []

  /** Load flag — lazy loaded on first access. */
  private _loaded = false

  /** Simple mutex queue to serialise writes. */
  private _writeQueue: Promise<void> = Promise.resolve()

  private readonly _emitter = new EventEmitter()

  // ── Persistence helpers ─────────────────────────────────────────

  private async _load(): Promise<void> {
    if (this._loaded) return
    if (!existsSync(this._installedPath)) {
      this._installed = []
      this._loaded = true
      return
    }
    try {
      const raw = JSON.parse(readFileSync(this._installedPath, 'utf-8'))
      this._installed = Array.isArray(raw) ? raw.filter(isInstalledEntry) : []
    } catch {
      this._installed = []
    }
    this._loaded = true
  }

  private _enqueueWrite(op: () => void): Promise<void> {
    const prev = this._writeQueue
    this._writeQueue = (async (): Promise<void> => {
      await prev
      // ponytail: mkdirSync already called in constructor; only recreate if
      // the dir was deleted externally between writes (rare).
      if (!existsSync(this._installDir)) mkdirSync(this._installDir, { recursive: true })
      writeJsonAtomic(this._installedPath, this._installed)
      op()
    })()
    return this._writeQueue
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Return all installed bundle entries (includes disabled ones).
   */
  async list(): Promise<InstalledBundleEntry[]> {
    await this._load()
    return [...this._installed]
  }

  /**
   * Return full `WorkBundle` definitions for every enabled entry.
   * Entries without a matching registry bundle are silently skipped.
   *
   * Note: `general_office` (id=0, required=true) is ALWAYS included regardless
   * of installation state — it is a required bundle that cannot be disabled.
   */
  async getEnabledBundles(): Promise<WorkBundle[]> {
    await this._load()
    const result: WorkBundle[] = []

    // Always include general_office (required, always-on)
    const generalOffice = WORK_BUNDLES.find((b) => b.key === 'general_office')
    if (generalOffice) result.push(generalOffice)

    // Add explicitly enabled non-required bundles
    for (const entry of this._installed) {
      if (entry.bundleKey === 'general_office') continue // already added above
      if (!entry.enabled) continue
      const bundle = findWorkBundleByKey(entry.bundleKey)
      if (bundle && !bundle.required) {
        result.push(bundle)
      }
    }

    return result
  }

  /**
   * Install (or re-record) a bundle from the registry.
   * Idempotent — installing the same bundle twice is a no-op.
   *
   * @throws Error  When no bundle with the given id exists in the registry.
   */
  async install(bundleId: number): Promise<InstalledBundleEntry> {
    await this._load()

    const bundle = WORK_BUNDLES.find((b) => b.id === bundleId)
    if (!bundle) {
      throw new Error(`BundleStore: no bundle with id ${bundleId} found in registry.`)
    }

    const existing = this._installed.find((e) => e.bundleKey === bundle.key)
    if (existing) return { ...existing }

    const entry: InstalledBundleEntry = {
      bundleId: bundle.id,
      bundleKey: bundle.key,
      enabled: true,
      installedAt: Date.now(),
      config: {},
    }
    this._installed.push(entry)
    await this._enqueueWrite(() => {})

    this._emitter.emit('installed', entry)
    return { ...entry }
  }

  /**
   * Remove an installed bundle by its `bundleKey`.
   * No-op if the bundle was not installed.
   */
  async uninstall(bundleKey: string): Promise<void> {
    await this._load()
    const before = this._installed.length
    this._installed = this._installed.filter((e) => e.bundleKey !== bundleKey)
    if (this._installed.length === before) {
      console.warn(`[BundleStore] uninstall: no bundle with key "${bundleKey}" is installed.`)
      return
    }
    await this._enqueueWrite(() => {})
    this._emitter.emit('uninstalled', bundleKey)
  }

  /**
   * Enable or disable an installed bundle.
   *
   * @throws Error  When no bundle with the given key exists in the registry.
   * @throws Error  When the bundle has `required: true` and `enabled` is false
   *                (required bundles cannot be disabled).
   */
  async setEnabled(bundleKey: string, enabled: boolean): Promise<void> {
    await this._load()
    const bundle = WORK_BUNDLES.find((b) => b.key === bundleKey)
    if (!bundle) {
      throw new Error(`BundleStore: no bundle with key "${bundleKey}" found in registry.`)
    }
    if (bundle.required && !enabled) {
      throw new Error(`BundleStore: bundle "${bundleKey}" is required and cannot be disabled.`)
    }
    const entry = this._installed.find((e) => e.bundleKey === bundleKey)
    if (!entry) {
      throw new Error(`BundleStore: no installed bundle with key "${bundleKey}".`)
    }
    entry.enabled = enabled
    await this._enqueueWrite(() => {})
    this._emitter.emit('enabled-changed', bundleKey, enabled)
  }

  /**
   * Store per-bundle configuration (e.g. user preferences).
   *
   * @throws Error  When no bundle with the given key is installed.
   */
  async setConfig(bundleKey: string, config: Record<string, unknown>): Promise<void> {
    await this._load()
    const entry = this._installed.find((e) => e.bundleKey === bundleKey)
    if (!entry) {
      throw new Error(`BundleStore: no installed bundle with key "${bundleKey}".`)
    }
    entry.config = { ...config }
    await this._enqueueWrite(() => {})
  }

  /**
   * Fetch the remote bundle manifest from the marketplace.
   * Returns the cached manifest if it was fetched within `REMOTE_MANIFEST_TTL_MS`.
   *
   * @param force  Bypass the TTL cache and fetch fresh.
   */
  async fetchRemoteManifest(force = false): Promise<RemoteBundleManifest | null> {
    if (!force && this._cachedManifest && Date.now() - this._cachedAt < REMOTE_MANIFEST_TTL_MS) {
      return this._cachedManifest
    }
    const manifest = await this._fetchRemoteManifest()
    if (manifest) {
      this._cachedManifest = manifest
      this._cachedAt = Date.now()
    }
    return manifest
  }

  private _cachedManifest: RemoteBundleManifest | null = null
  private _cachedAt = 0

  // ── Event subscriptions ────────────────────────────────────────

  onInstalled(cb: (entry: InstalledBundleEntry) => void): () => void {
    this._emitter.on('installed', cb as (...args: unknown[]) => void)
    return () => this._emitter.off('installed', cb as (...args: unknown[]) => void)
  }

  onUninstalled(cb: (bundleKey: string) => void): () => void {
    this._emitter.on('uninstalled', cb as (...args: unknown[]) => void)
    return () => this._emitter.off('uninstalled', cb as (...args: unknown[]) => void)
  }

  onEnabledChanged(cb: (bundleKey: string, enabled: boolean) => void): () => void {
    this._emitter.on('enabled-changed', cb as (...args: unknown[]) => void)
    return () => this._emitter.off('enabled-changed', cb as (...args: unknown[]) => void)
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function isInstalledEntry(v: unknown): v is InstalledBundleEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return (
    typeof e.bundleId === 'number' &&
    typeof e.bundleKey === 'string' &&
    typeof e.enabled === 'boolean' &&
    typeof e.installedAt === 'number' &&
    (e.config === undefined || (e.config !== null && typeof e.config === 'object'))
  )
}
