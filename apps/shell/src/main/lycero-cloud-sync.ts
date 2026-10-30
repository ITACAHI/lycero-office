/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Lycero Cloud Sync IPC Handler
 *
 * Lycero Hub cloud sync replacing GenOffice cloud projects.
 * Supports:
 * - Device registration & heartbeat
 * - Project CRUD with local-first caching
 * - Incremental sync with conflict resolution
 * - Real-time sync via periodic polling
 */
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getSession as getLyceroSession } from './lycero-auth-bridge'
import {
  getDeviceBlockError,
  getStandardLyceroHeaders,
  registerAndVerifyDevice,
  setSyncingProjectsCountProvider,
  startDeviceHeartbeat,
  stopDeviceHeartbeat,
} from './deviceIdentityService'

// ── Types ──────────────────────────────────────────────────────────

type CloudProjectKind = 'docs' | 'sheets' | 'slides' | 'pdf' | 'markdown' | 'html'

interface DeviceRegistration {
  id: string
  deviceId: string
  deviceName: string
  osPlatform: string
  registeredAt: number
}

interface SyncChange {
  projectId: string
  title?: string
  description?: string | null
  kind: CloudProjectKind
  localPath?: string | null
  fileSize?: number
  fileHash?: string | null
  lastModifiedAt: number
  conflict?: boolean
  versionVector?: number
}

interface SyncResult {
  serverChanges: SyncChange[]
  nextSyncAt: number
}

export interface LyceroCloudProject {
  id: string
  title: string
  description?: string | null
  kind: CloudProjectKind
  localPath?: string | null
  fileSize: number
  fileHash?: string | null
  syncStatus: 'synced' | 'pending_upload' | 'pending_download' | 'conflict'
  lastModifiedAt: number
  versionVector: number
  createdAt: number
}

export interface CloudProjectsSnapshot {
  available: boolean
  projects: LyceroCloudProject[]
  syncedAt: number
}

interface StoredSnapshot {
  projects: LyceroCloudProject[]
  syncedAt: number
  owner: string
}

// ── Constants ─────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30000
const SYNC_INTERVAL_MS = 60000

// ── State ─────────────────────────────────────────────────────────

let cloudSyncConfig: {
  baseUrl: string
  deviceId: string
  deviceName: string
  osPlatform: string
  appVersion: string
} | null = null

let registeredDevice: DeviceRegistration | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let syncTimer: ReturnType<typeof setInterval> | null = null
let pendingChanges: SyncChange[] = []
let projectsCache: Map<string, LyceroCloudProject> = new Map()
let lastSyncAt = 0

// ── Device Registration ────────────────────────────────────────────

/**
 * Initialize cloud sync with device registration
 */
export async function initCloudSync(config: {
  baseUrl: string
  deviceId: string
  deviceName: string
  osPlatform: string
  appVersion: string
}): Promise<DeviceRegistration | null> {
  cloudSyncConfig = config
  
  const session = getLyceroSession()
  if (!session?.token) {
    console.log('[CloudSync] No Lycero session, skipping registration')
    return null
  }

  try {
    setSyncingProjectsCountProvider(() => pendingChanges.length)
    const state = await registerAndVerifyDevice({
      accessToken: session.token,
      userFallback: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.name,
        role: session.user.role,
        tier: session.license?.tier || session.user.plan,
      },
    })

    if (!state.verified) {
      console.warn('[CloudSync] Device verification blocked or pending:', state.status, state.error)
      return null
    }

    registeredDevice = {
      id: state.deviceRecordId || state.deviceId,
      deviceId: state.deviceId,
      deviceName: state.deviceName,
      osPlatform: state.osPlatform,
      registeredAt: Date.now(),
    }

    // Start heartbeat and sync loops
    startHeartbeat()
    startPeriodicSync()

    console.log('[CloudSync] Device registered:', registeredDevice.deviceName)
    return registeredDevice
  } catch (err) {
    console.error('[CloudSync] Registration error:', err)
    return null
  }
}

/**
 * Shutdown cloud sync on logout
 */
export function shutdownCloudSync(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  stopDeviceHeartbeat()
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  registeredDevice = null
  cloudSyncConfig = null
  clearCloudProjectsStore(getCloudStorePath())
}

/**
 * Start heartbeat loop
 */
function startHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  startDeviceHeartbeat(() => getLyceroSession()?.token)
}

/**
 * Start periodic sync loop
 */
function startPeriodicSync(): void {
  if (syncTimer) clearInterval(syncTimer)
  
  syncTimer = setInterval(async () => {
    await performSync()
  }, SYNC_INTERVAL_MS)
}

/**
 * Perform incremental sync
 */
async function performSync(): Promise<SyncResult | null> {
  if (!registeredDevice || !cloudSyncConfig) return null
  
  const session = getLyceroSession()
  if (!session?.token) return null

  try {
    const response = await apiRequest('/api/v1/office/hub/projects/sync', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: cloudSyncConfig!.deviceId,
        lastSyncAt: lastSyncAt || null,
        changes: pendingChanges,
      }),
    }, session.token)

    if (!response.ok) {
      console.error('[CloudSync] Sync failed:', response.status)
      return null
    }

    const data: SyncResult = await response.json()

    // Process server changes
    for (const change of data.serverChanges) {
      const project: LyceroCloudProject = {
        id: change.projectId ?? '',
        title: change.title ?? '',
        description: change.description ?? null,
        kind: (change.kind ?? 'other') as CloudProjectKind,
        localPath: change.localPath ?? null,
        fileSize: change.fileSize ?? 0,
        fileHash: change.fileHash ?? null,
        syncStatus: change.conflict ? 'conflict' : 'synced',
        lastModifiedAt: change.lastModifiedAt ? new Date(change.lastModifiedAt).getTime() : Date.now(),
        versionVector: change.versionVector ?? 0,
        createdAt: projectsCache.get(change.projectId ?? '')?.createdAt ?? Date.now(),
      }
      if (change.projectId) projectsCache.set(change.projectId, project)
    }

    // Clear pending changes on success
    pendingChanges = []
    lastSyncAt = data.nextSyncAt
    persistStore()

    return data
  } catch (err) {
    console.error('[CloudSync] Sync error:', err)
    return null
  }
}

// ── Project Operations ──────────────────────────────────────────────

/**
 * Get cached projects (local-first)
 */
export function getCloudProjectsCached(): CloudProjectsSnapshot | null {
  const session = getLyceroSession()
  if (!session?.user) return { available: false, projects: [], syncedAt: 0 }
  
  const stored = loadStore()
  if (!stored) return { available: true, projects: [], syncedAt: 0 }
  
  return {
    available: true,
    projects: stored.projects,
    syncedAt: stored.syncedAt,
  }
}

/**
 * Sync projects from server
 */
export async function syncCloudProjects(): Promise<CloudProjectsSnapshot | null> {
  const session = getLyceroSession()
  if (!session?.user) return { available: false, projects: [], syncedAt: 0 }
  
  try {
    const result = await performSync()
    
    // If we just registered and have no cache, fetch full list
    if (!loadStore()) {
      const response = await apiRequest('/api/v1/office/hub/projects?limit=100', {
        method: 'GET',
      }, session.token)
      
      if (response.ok) {
        const data = await response.json()
        const projects: LyceroCloudProject[] = data.projects.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          title: p.title as string,
          description: p.description as string | null,
          kind: p.kind as CloudProjectKind,
          localPath: p.localPath as string | null,
          fileSize: (p.fileSize as number) ?? 0,
          fileHash: p.fileHash as string | null,
          syncStatus: (p.syncStatus as 'synced') ?? 'synced',
          lastModifiedAt: new Date(p.lastModifiedAt as string).getTime(),
          versionVector: (p.versionVector as number) ?? 1,
          createdAt: new Date(p.createdAt as string).getTime(),
        }))
        
        for (const p of projects) {
          projectsCache.set(p.id, p)
        }
        persistStore()
        
        return { available: true, projects, syncedAt: Date.now() }
      }
    }

    return {
      available: true,
      projects: Array.from(projectsCache.values()),
      syncedAt: lastSyncAt,
    }
  } catch (err) {
    console.error('[CloudSync] Sync error:', err)
    return null
  }
}

/**
 * Queue a change for sync (local-first)
 */
export function queueCloudChange(change: SyncChange): void {
  pendingChanges.push(change)
  
  // Also update local cache
  if (change.projectId) {
    const existing = projectsCache.get(change.projectId)
    if (existing) {
      projectsCache.set(change.projectId, {
        ...existing,
        title: change.title ?? existing.title,
        description: change.description ?? existing.description,
        kind: change.kind,
        localPath: change.localPath ?? existing.localPath,
        fileSize: change.fileSize ?? existing.fileSize,
        fileHash: change.fileHash ?? existing.fileHash,
        syncStatus: 'pending_upload',
        lastModifiedAt: change.lastModifiedAt,
        versionVector: existing.versionVector + 1,
      })
    }
  }
  
  persistStore()
}

// ── Persistence ────────────────────────────────────────────────────

function getCloudStorePath(): string {
  return join(app.getPath('userData'), 'lycero-cloud-projects.json')
}

function ownerTag(): string {
  const session = getLyceroSession()
  const token = session?.token ?? ''
  return createHash('sha256')
    .update(`lycero-cloud-store:${token}`)
    .digest('hex')
    .slice(0, 16)
}

function loadStore(): StoredSnapshot | null {
  const path = getCloudStorePath()
  if (!existsSync(path)) return null

  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as StoredSnapshot
    if (!Array.isArray(raw.projects)) return null
    if (raw.owner !== ownerTag()) {
      clearCloudProjectsStore(path)
      return null
    }
    return raw
  } catch {
    return null
  }
}

function persistStore(): void {
  const path = getCloudStorePath()
  const snapshot: StoredSnapshot = {
    projects: Array.from(projectsCache.values()),
    syncedAt: lastSyncAt || Date.now(),
    owner: ownerTag(),
  }
  try {
    writeFileSync(path, JSON.stringify(snapshot), 'utf-8')
  } catch (err) {
    console.error('[CloudSync] Failed to persist store:', err)
  }
}

export function clearCloudProjectsStore(storePath?: string): void {
  const path = storePath || getCloudStorePath()
  try {
    if (existsSync(path)) {
      unlinkSync(path)
    }
  } catch {
    // ignore
  }
  projectsCache.clear()
  pendingChanges = []
  lastSyncAt = 0
}

// ── HTTP Helper ───────────────────────────────────────────────────

async function apiRequest(
  path: string,
  init: RequestInit = {},
  token: string
): Promise<Response> {
  if (!cloudSyncConfig) {
    throw new Error('Cloud sync not initialized')
  }
  const blockErr = getDeviceBlockError()
  if (blockErr) {
    throw new Error(blockErr)
  }

  const url = `${cloudSyncConfig.baseUrl}${path}`
  const headers: Record<string, string> = {
    ...getStandardLyceroHeaders(token),
    ...(init.headers as Record<string, string> | undefined),
  }

  return fetch(url, {
    ...init,
    headers,
  })
}
