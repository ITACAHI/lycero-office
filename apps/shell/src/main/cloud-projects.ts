/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gskApiKey, gskListPastProjects, hasGskAuth } from '@lycero/ai-search'
import type { CloudProjectEntry, CloudProjectKind, CloudProjectsSnapshot } from '../shared/home-api'

const SYNC_PAGE = 100
/** bound on sync cost for huge accounts (10 requests) */
const MAX_PROJECTS = 1000

const KINDS: readonly CloudProjectKind[] = ['docs', 'sheets', 'slides']

/** 'slides_agent_git' / 'docs_agent' / 'sheets_agent_new' â†’ module kind */
export function kindFromType(type: string): CloudProjectKind | 'other' {
  return KINDS.find((k) => type.startsWith(k)) ?? 'other'
}

export const LYCERO_ORIGIN = 'https://lycero.com'

/** API ctime carries no timezone marker and is UTC; append Z before parsing */
function ctimeToMs(ctime: string): number {
  if (!ctime) return 0
  const iso = /[zZ]$|[+-]\d\d:?\d\d$/.test(ctime) ? ctime : `${ctime}Z`
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Account tag the store is bound to: a salted hash of the API key (never the
 * key itself). A key change â€” logout, account switch, even rotation â€” makes
 * the stored list unreadable so one account can never see another's projects.
 * (exported for tests)
 */
export function cloudStoreOwner(): string {
  const key = gskApiKey()
  if (!key) return ''
  return createHash('sha256').update(`lycero-office-cloud-store:${key}`).digest('hex').slice(0, 16)
}

/** disk shape: the snapshot plus the owner tag (stripped before it reaches the renderer) */
type StoredSnapshot = CloudProjectsSnapshot & { owner?: string }

export function clearCloudProjectsStore(storePath: string): void {
  try {
    unlinkSync(storePath)
  } catch {
    // nothing cached; fine
  }
}

/** Locally stored full project list; filtering/paging happen in the renderer. */
export function readCloudProjectsStore(storePath: string): CloudProjectsSnapshot | null {
  if (!hasGskAuth()) return null
  try {
    const raw = JSON.parse(readFileSync(storePath, 'utf-8')) as StoredSnapshot
    if (!Array.isArray(raw.projects)) return null
    if (raw.owner !== cloudStoreOwner()) {
      // another account's cache; drop it from disk rather than leave it around
      clearCloudProjectsStore(storePath)
      return null
    }
    return {
      available: true,
      projects: raw.projects.map((p) => ({ ...p, kind: p.kind ?? 'other' })),
      syncedAt: Number(raw.syncedAt) || 0,
    }
  } catch {
    return null
  }
}

let syncInFlight: Promise<CloudProjectsSnapshot> | null = null
let syncInFlightOwner = ''

/**
 * Full-list sync, deduped so concurrent callers on the SAME account share one
 * run. A caller under a different key never gets the other account's promise;
 * it starts its own run (the orphaned one aborts at its next owner check).
 */
export function syncCloudProjects(storePath: string): Promise<CloudProjectsSnapshot> {
  if (!hasGskAuth()) {
    return Promise.resolve({ available: false, projects: [], syncedAt: 0 })
  }
  const owner = cloudStoreOwner()
  if (!syncInFlight || syncInFlightOwner !== owner) {
    const run = doSync(storePath, owner).finally(() => {
      if (syncInFlight === run) syncInFlight = null
    })
    syncInFlight = run
    syncInFlightOwner = owner
  }
  return syncInFlight
}

/**
 * Pages are newest-first and ctime is immutable, so when the FIRST page is
 * entirely known (ids + titles) and the API total matches the store size,
 * nothing changed and the store is kept as-is (one request). Any difference
 * triggers a full sweep, which also picks up renames and drops deletions.
 *
 * `owner` is the account the sync was started for. Each page is fetched with
 * the LIVE key, so if the account switches (or logs out) mid-sync the pages
 * would belong to someone else; the check after every fetch aborts the run
 * before mixed data can be returned or written to disk. The rejection reaches
 * the renderer as a failed sync (null), which keeps whatever it had.
 */
async function doSync(storePath: string, owner: string): Promise<CloudProjectsSnapshot> {
  const stored = readCloudProjectsStore(storePath)
  const known = new Map((stored?.projects ?? []).map((p) => [p.projectId, p]))
  const collected: CloudProjectEntry[] = []
  const seen = new Set<string>()
  let offset = 0
  for (;;) {
    const page = await gskListPastProjects({
      artifactTypes: [...KINDS],
      limit: SYNC_PAGE,
      offset,
    })
    if (cloudStoreOwner() !== owner) {
      throw new Error('cloud projects sync aborted: account changed mid-sync')
    }
    const entries: CloudProjectEntry[] = page.projects
      .map((p) => ({
        projectId: p.projectId,
        title: p.title,
        kind: kindFromType(p.type),
        ctimeMs: ctimeToMs(p.ctime),
        projectUrl: p.projectUrl,
      }))
      .filter((e) => !seen.has(e.projectId))
    for (const e of entries) seen.add(e.projectId)
    collected.push(...entries)
    // ponytail: J-F-HIGH — only short-circuit on offset 0 when the
    // local store already covers the full API total. Equality was too
    // loose: known.size === page.total also holds when stored projects
    // dropped out of page 1 and were renumbered into page 2+, so a
    // rename or delete on page 2+ was silently skipped.
    if (offset === 0 && known.size >= page.total && known.size <= MAX_PROJECTS) {
      const firstPageKnown = entries.every((e) => {
        const k = known.get(e.projectId)
        return k && k.title === e.title && k.kind === e.kind
      })
      if (firstPageKnown && stored) return stored
    }
    offset += page.projects.length
    if (!page.hasMore || page.projects.length === 0 || collected.length >= MAX_PROJECTS) break
  }
  collected.sort((a, b) => b.ctimeMs - a.ctimeMs)
  const snapshot: CloudProjectsSnapshot = {
    available: true,
    projects: collected,
    syncedAt: Date.now(),
  }
  try {
    const stored: StoredSnapshot = { ...snapshot, owner }
    // ponytail: J-F-MED — atomic write: temp then rename, so a power
    // cut mid-write can never leave a half-written store file.
    const tmpPath = `${storePath}.${process.pid}.${Date.now()}.tmp`
    writeFileSync(tmpPath, JSON.stringify(stored))
    renameSync(tmpPath, storePath)
  } catch {
    // store is best-effort; the fresh list still goes back to the renderer
  }
  return snapshot
}

/** Only relative Lycero paths may be opened externally (renderer input is untrusted). */
export function cloudProjectExternalUrl(projectUrl: unknown): string | null {
  if (typeof projectUrl !== 'string') return null
  // ponytail: J-F-HIGH — reject anything that isn't a plain relative
  // path. `//` is protocol-relative, `/\` and `/\\` are interpreted as
  // host authority by URL parsers (browser / Electron navigation), and
  // any backslash anywhere is a Windows-path-style escape hatch.
  if (!projectUrl.startsWith('/') || projectUrl.startsWith('//') || projectUrl.startsWith('/\\') || projectUrl.includes('\\')) {
    return null
  }
  try {
    const parsed = new URL(projectUrl, LYCERO_ORIGIN)
    if (parsed.origin !== LYCERO_ORIGIN) return null
    return parsed.toString()
  } catch {
    return null
  }
}
