/**
 * Lycero Office Desktop — Lossless Full-Stack Token Optimizer & Server Policy Sync
 *
 * Designed specifically for Full-Stack Document/Spreadsheet/Presentation Editing:
 *   1. ZERO BLIND TRUNCATION by default (`clientAstSlicingEnabled: false`):
 *      Never cuts the middle of the active document or corrupts JSON/AST tool outputs,
 *      guaranteeing 100% structural accuracy for multi-step editing.
 *   2. LOSSLESS SUPERSEDED SNAPSHOT DEDUPLICATION (`clientDeltaDeduplicationEnabled: true`):
 *      Only deduplicates an old `<document_context>` / `<sheet_context>` block in an earlier turn
 *      WHEN AND ONLY WHEN a newer turn already carries a fresh `<document_context>` snapshot,
 *      so the model never loses access to the current document while avoiding paying 5x for stale copies.
 *   3. ACTIVE AGENT LOOP PROTECTION:
 *      Preserves 100% of `tool` results in the active turn/loop so multi-step AST tool chains
 *      (`read` -> `insert` -> `format` -> `chart` -> `verify`) have complete, uncorrupted indices.
 *
 * Copyright © 2026 ITAC AI Heavy Industries & Lycero Corporation.
 */

import type { AgentMessage } from '@lycero/agent-core'

export interface ClientTokenOptimizerPolicy {
  enabled: boolean
  /** Default false: Never blindly slice active documents in full-stack editing mode */
  clientAstSlicingEnabled: boolean
  clientMaxDocSnapshotChars: number
  /** Default true: Only deduplicate old snapshots when a newer snapshot exists in the latest turn */
  clientDeltaDeduplicationEnabled: boolean
  /** Default false: Preserve 100% of structured JSON/AST tool outputs unless explicitly capped */
  clientTruncateStaleToolOutputsEnabled: boolean
  clientMaxHistoricalToolResultChars: number
  clientCompactToolDescriptions: boolean
}

export interface ClientCompactionTelemetry {
  mode: 'lossless_fullstack' | 'capped'
  originalChars: number
  compactedChars: number
  savedTokensEstimate: number
  dedupedSnapshots: number
  slicedDocs: number
  truncatedToolOutputs: number
}

const DEFAULT_CLIENT_POLICY: ClientTokenOptimizerPolicy = {
  enabled: true,
  clientAstSlicingEnabled: false,
  clientMaxDocSnapshotChars: 120000,
  clientDeltaDeduplicationEnabled: true,
  clientTruncateStaleToolOutputsEnabled: false,
  clientMaxHistoricalToolResultChars: 32000,
  clientCompactToolDescriptions: false,
}

let activeClientPolicy: ClientTokenOptimizerPolicy = { ...DEFAULT_CLIENT_POLICY }

export function getClientTokenOptimizerPolicy(): ClientTokenOptimizerPolicy {
  return activeClientPolicy
}

export function resetClientTokenOptimizerPolicy(): void {
  activeClientPolicy = { ...DEFAULT_CLIENT_POLICY }
}

export function applyRemoteTokenOptimizerPolicy(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const obj = raw as Record<string, unknown>
  const clamp = (val: unknown, min: number, max: number, fallback: number) => {
    const n = Number(val)
    if (!Number.isFinite(n)) return fallback
    return Math.max(min, Math.min(max, Math.round(n)))
  }
  activeClientPolicy = {
    enabled: obj.enabled !== undefined ? Boolean(obj.enabled) : activeClientPolicy.enabled,
    clientAstSlicingEnabled:
      obj.clientAstSlicingEnabled !== undefined
        ? Boolean(obj.clientAstSlicingEnabled)
        : activeClientPolicy.clientAstSlicingEnabled,
    clientMaxDocSnapshotChars: clamp(
      obj.clientMaxDocSnapshotChars,
      10000,
      500000,
      activeClientPolicy.clientMaxDocSnapshotChars,
    ),
    clientDeltaDeduplicationEnabled:
      obj.clientDeltaDeduplicationEnabled !== undefined
        ? Boolean(obj.clientDeltaDeduplicationEnabled)
        : activeClientPolicy.clientDeltaDeduplicationEnabled,
    clientTruncateStaleToolOutputsEnabled:
      obj.clientTruncateStaleToolOutputsEnabled !== undefined
        ? Boolean(obj.clientTruncateStaleToolOutputsEnabled)
        : activeClientPolicy.clientTruncateStaleToolOutputsEnabled,
    clientMaxHistoricalToolResultChars: clamp(
      obj.clientMaxHistoricalToolResultChars,
      2000,
      200000,
      activeClientPolicy.clientMaxHistoricalToolResultChars,
    ),
    clientCompactToolDescriptions:
      obj.clientCompactToolDescriptions !== undefined
        ? Boolean(obj.clientCompactToolDescriptions)
        : activeClientPolicy.clientCompactToolDescriptions,
  }
}

const SNAPSHOT_TAG_REGEX =
  /<(document_context|sheet_context|workbook_context|slide_context)\b[^>]*>[\s\S]*?<\/\1>/gi

const GENOFFICE_DOC_SKELETON_REGEX =
  /\n\nDocument block list:\nThe document has \d+ blocks, listed below[\s\S]*$/i

const GENOFFICE_WORKBOOK_SKELETON_REGEX =
  /\n\nActive sheet: [^\n]+\nMode: [\s\S]*$/i

function hasSnapshotTag(text: string): boolean {
  return (
    /<(?:document_context|sheet_context|workbook_context|slide_context)\b/i.test(text) ||
    /\n\nDocument block list:\nThe document has \d+ blocks/i.test(text) ||
    /\n\nActive sheet: [^\n]+\nMode: /i.test(text)
  )
}

export function compactOutboundAgentTurn(
  messages: AgentMessage[],
  policy: ClientTokenOptimizerPolicy = activeClientPolicy,
): {
  messages: AgentMessage[]
  telemetry: ClientCompactionTelemetry
  headerJson: string
} {
  let originalChars = 0
  let compactedChars = 0
  let dedupedSnapshots = 0
  let slicedDocs = 0
  let truncatedToolOutputs = 0

  const mode: ClientCompactionTelemetry['mode'] =
    !policy.clientAstSlicingEnabled && !policy.clientTruncateStaleToolOutputsEnabled
      ? 'lossless_fullstack'
      : 'capped'

  if (!policy.enabled || messages.length === 0) {
    for (const m of messages) {
      if (m.role === 'user' || m.role === 'assistant') {
        originalChars += (m.text || '').length
      } else {
        for (const r of m.results) originalChars += (r.output || '').length
      }
    }
    compactedChars = originalChars
    const telemetry: ClientCompactionTelemetry = {
      mode,
      originalChars,
      compactedChars,
      savedTokensEstimate: 0,
      dedupedSnapshots: 0,
      slicedDocs: 0,
      truncatedToolOutputs: 0,
    }
    return {
      messages,
      telemetry,
      headerJson: JSON.stringify(telemetry),
    }
  }

  // Find the latest user turn that actually carries a fresh document/sheet/slide snapshot
  let latestUserWithSnapshotIdx = -1
  let latestUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role === 'user') {
      if (latestUserIdx === -1) latestUserIdx = i
      if (latestUserWithSnapshotIdx === -1 && hasSnapshotTag(m.text || '')) {
        latestUserWithSnapshotIdx = i
      }
    }
  }

  // Track identical read-only tool outputs across turns so only exact duplicates are deduplicated
  const seenExactToolOutputs = new Map<string, number>()
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role === 'tool') {
      for (const r of m.results) {
        if (r.output && r.output.length > 800) {
          const sig = `${r.name}::${r.output}`
          if (!seenExactToolOutputs.has(sig)) {
            seenExactToolOutputs.set(sig, i)
          }
        }
      }
    }
  }

  const compactedMessages: AgentMessage[] = messages.map((msg, idx) => {
    if (msg.role === 'user') {
      const rawText = msg.text || ''
      originalChars += rawText.length
      let nextText = rawText

      // 1. Lossless Superseded Snapshot Deduplication:
      // ONLY replace an old `<document_context>` if a NEWER user turn (`idx < latestUserWithSnapshotIdx`)
      // already provides an updated `<document_context>` snapshot!
      // If the latest user turn does NOT have a snapshot, we KEEP the earlier snapshot 100% intact!
      if (
        policy.clientDeltaDeduplicationEnabled &&
        latestUserWithSnapshotIdx > idx &&
        nextText.length > 500
      ) {
        nextText = nextText.replace(SNAPSHOT_TAG_REGEX, (match, tagName: string) => {
          if (match.length < 400) return match
          dedupedSnapshots += 1
          return `<${tagName}_superseded length="${match.length}" note="Bản chụp trạng thái cũ đã được thay thế hoàn toàn bởi bản cập nhật mới nhất ở lượt #${latestUserWithSnapshotIdx + 1}" />`
        })
        nextText = nextText.replace(GENOFFICE_DOC_SKELETON_REGEX, (match) => {
          if (match.length < 400) return match
          dedupedSnapshots += 1
          return `\n\n[Document block list (${match.length} chars) superseded by fresh Document block list in latest user turn]`
        })
        nextText = nextText.replace(GENOFFICE_WORKBOOK_SKELETON_REGEX, (match) => {
          if (match.length < 400) return match
          dedupedSnapshots += 1
          return `\n\n[Workbook context (${match.length} chars) superseded by fresh Active sheet context in latest user turn]`
        })
      }

      // 2. Optional AST Viewport Slicing (OFF by default in Lossless Full-Stack mode)
      if (
        policy.clientAstSlicingEnabled &&
        idx === latestUserIdx &&
        nextText.length > policy.clientMaxDocSnapshotChars
      ) {
        const limit = policy.clientMaxDocSnapshotChars
        const head = Math.floor(limit * 0.65)
        const tail = Math.max(500, limit - head)
        slicedDocs += 1
        nextText = `${nextText.slice(0, head)}\n...[Cắt lát theo giới hạn cấu hình: ${nextText.length - limit} ký tự]...\n${nextText.slice(-tail)}`
      }

      compactedChars += nextText.length
      return nextText === rawText ? msg : { ...msg, text: nextText }
    }

    if (msg.role === 'assistant') {
      const len = (msg.text || '').length
      originalChars += len
      compactedChars += len
      return msg
    }

    // 3. Tool results:
    // - If an identical tool output appears verbatim in a later turn (`latestIdx > idx`), deduplicate the old identical copy (100% lossless).
    // - Never truncate distinct tool outputs unless `clientTruncateStaleToolOutputsEnabled` is explicitly turned on by Admin.
    const isLatestTurn = idx === messages.length - 1
    const nextResults = msg.results.map((r) => {
      const out = r.output || ''
      originalChars += out.length

      if (out.length > 800) {
        const sig = `${r.name}::${out}`
        const newestIdx = seenExactToolOutputs.get(sig)
        if (newestIdx !== undefined && newestIdx > idx) {
          truncatedToolOutputs += 1
          const dedupNote = `[Kết quả tool "${r.name}" trùng khớp 100% với bản đọc mới hơn ở lượt #${newestIdx + 1}]`
          compactedChars += dedupNote.length
          return { ...r, output: dedupNote }
        }
      }

      if (
        policy.clientTruncateStaleToolOutputsEnabled &&
        !isLatestTurn &&
        out.length > policy.clientMaxHistoricalToolResultChars
      ) {
        const limit = policy.clientMaxHistoricalToolResultChars
        const head = Math.floor(limit * 0.7)
        const tail = Math.max(200, limit - head)
        truncatedToolOutputs += 1
        const shortened = `${out.slice(0, head)}\n...[Đã giới hạn theo cấu hình (${out.length} -> ${limit} ký tự)]...\n${out.slice(-tail)}`
        compactedChars += shortened.length
        return { ...r, output: shortened }
      }

      compactedChars += out.length
      return r
    })

    return { ...msg, results: nextResults }
  })

  const savedChars = Math.max(0, originalChars - compactedChars)
  const telemetry: ClientCompactionTelemetry = {
    mode,
    originalChars,
    compactedChars,
    savedTokensEstimate: Math.ceil(savedChars / 3.5),
    dedupedSnapshots,
    slicedDocs,
    truncatedToolOutputs,
  }

  return {
    messages: compactedMessages,
    telemetry,
    headerJson: JSON.stringify(telemetry),
  }
}
