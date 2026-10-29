/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import type { WorkBundle } from '@lycero/ai-auth'

// ── Types ────────────────────────────────────────────────────────

export interface InstalledBundleEntry {
  bundleId: number
  bundleKey: string
  enabled: boolean
  installedAt: number
  config: Record<string, unknown>
}

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

// ── API surface exposed to renderer via preload ───────────────────

export interface UsageCounts {
  enable: number
  disable: number
  toolUse: number
}

export interface BundleApi {
  list(): Promise<InstalledBundleEntry[]>
  getEnabled(): Promise<import('@lycero/ai-auth').WorkBundle[]>
  install(bundleId: number): Promise<InstalledBundleEntry>
  uninstall(bundleKey: string): Promise<void>
  setEnabled(bundleKey: string, enabled: boolean): Promise<void>
  setConfig(bundleKey: string, config: Record<string, unknown>): Promise<void>
  fetchManifest(force?: boolean): Promise<RemoteBundleManifest | null>
  getUsageCounts(): Promise<Record<string, UsageCounts>>
  onInstalled(cb: (entry: InstalledBundleEntry) => void): () => void
  onUninstalled(cb: (bundleKey: string) => void): () => void
  onEnabledChanged(cb: (bundleKey: string, enabled: boolean) => void): () => void
}

// ── IPC channel names ────────────────────────────────────────────

export const BUNDLE_IPC_CHANNELS = {
  list: 'bundles:list',
  getEnabled: 'bundles:get-enabled',
  install: 'bundles:install',
  uninstall: 'bundles:uninstall',
  setEnabled: 'bundles:set-enabled',
  setConfig: 'bundles:set-config',
  fetchManifest: 'bundles:fetch-manifest',
  onInstalled: 'bundles:installed',
  onUninstalled: 'bundles:uninstalled',
  onEnabledChanged: 'bundles:enabled-changed',
} as const
