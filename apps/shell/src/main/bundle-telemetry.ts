/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import { appendFileSync, copyFileSync, existsSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

// ── Constants ─────────────────────────────────────────────────────

/**
 * ponytail: JSONL append-only, no rotation by date.
 * Upgrade path: SQLite if volume grows (see bundle-telemetry.ts ceiling note).
 */
const TELEMETRY_FILENAME = 'bundle-usage.jsonl'

/**
 * Simple size cap, not date-based.
 * Upgrade path: date-based rolling when JSONL exceeds ~50MB.
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

// ── Types ────────────────────────────────────────────────────────

export type TelemetryEvent = 'enable' | 'disable' | 'tool_use'

export interface TelemetryEntry {
  ts: string
  bundleId: string
  event: TelemetryEvent
  toolName?: string
  promptSnippet?: string
}

export interface UsageCounts {
  enable: number
  disable: number
  toolUse: number
}

// ── Helpers ──────────────────────────────────────────────────────

function getFilePath(userData: string): string {
  return join(userData, TELEMETRY_FILENAME)
}

/** Strip diacritics for normalized comparison */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * ponytail: append-only JSONL writer with simple 10MB size cap.
 * Fails-soft: if write fails (disk full, permission), logs and returns.
 * Ceiling: rename to .1.jsonl when > 10MB; sequential rotation (.2, .3…)
 * deferred until volume actually warrants it.
 */
function appendEntry(userData: string, entry: TelemetryEntry): void {
  const filePath = getFilePath(userData)
  try {
    // ponytail: size check every write is cheap; no caching needed at this scale
    if (existsSync(filePath)) {
      const size = statSync(filePath).size
      if (size >= MAX_FILE_SIZE_BYTES) {
        rotateOldest(filePath)
      }
    }
    appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8')
  } catch (err) {
    // fail-soft: never throw to caller
    console.warn('[bundle-telemetry] failed to write usage log:', err)
  }
}

/**
 * Rename oldest rotated file to make room, or just rotate the main file.
 * ponytail: sequential rotation (.1.jsonl, .2.jsonl, …) deferred.
 * Simple ceiling: rename main → .1, next write starts fresh.
 */
function rotateOldest(currentPath: string): void {
  const rotated = currentPath + '.1'
  try {
    // ponytail: renameSync can fail across filesystems on Windows;
    // use copy + delete instead
    try { unlinkSync(rotated) } catch { /* ignore if missing */ }
    copyFileSync(currentPath, rotated)
    unlinkSync(currentPath)
  } catch {
    // ignore rotation failure — next write will retry
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Record a bundle telemetry event.
 * Call this from BundleStore.setEnabled and from tool-dispatch hooks.
 *
 * @param userData     app.getPath('userData') from electron
 * @param bundleId     snake_case bundle key
 * @param event        enable | disable | tool_use
 * @param extra        toolName + promptSnippet for tool_use events
 */
export function recordBundleEvent(
  userData: string,
  bundleId: string,
  event: TelemetryEvent,
  extra?: { toolName?: string; promptSnippet?: string },
): void {
  const entry: TelemetryEntry = {
    ts: new Date().toISOString(),
    bundleId,
    event,
    ...(extra?.toolName && { toolName: extra.toolName }),
    ...(extra?.promptSnippet && { promptSnippet: extra.promptSnippet }),
  }
  appendEntry(userData, entry)
}

/**
 * Aggregate usage counts from the JSONL file.
 * Returns zero counts for any bundle with no events.
 *
 * ponytail: synchronous line-by-line read — JSONL files are small enough.
 * Upgrade path: streaming reader if volume grows.
 *
 * @param userData app.getPath('userData') from electron
 * @returns Record<bundleId, { enable, disable, toolUse }>
 */
export function getUsageCounts(userData: string): Record<string, UsageCounts> {
  const filePath = getFilePath(userData)
  if (!existsSync(filePath)) return {}

  const counts: Record<string, UsageCounts> = {}

  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const entry: TelemetryEntry = JSON.parse(trimmed)
        if (!counts[entry.bundleId]) {
          counts[entry.bundleId] = { enable: 0, disable: 0, toolUse: 0 }
        }
        if (entry.event === 'enable') counts[entry.bundleId]!.enable++
        else if (entry.event === 'disable') counts[entry.bundleId]!.disable++
        else if (entry.event === 'tool_use') counts[entry.bundleId]!.toolUse++
      } catch {
        // skip malformed lines
      }
    }
  } catch (err) {
    // fail-soft: return whatever we already accumulated
    console.warn('[bundle-telemetry] failed to read usage log:', err)
  }

  return counts
}
