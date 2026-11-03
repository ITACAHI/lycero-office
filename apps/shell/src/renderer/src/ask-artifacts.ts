/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { CREATE_DOCUMENT_TOOL, RUN_GENOFFICE_TOOL, type AgentToolCall } from '@lycero/agent-core'

/**
 * The task card of one Ask AI answer: every file the turn set out to build,
 * tracked from the tool call that names it to the result that confirms it.
 * Derived from the loop's tool events alone, so the card needs nothing from
 * the model's prose; a path the CLI reports as output_path is the one a click
 * opens.
 */

export type ArtifactStatus = 'building' | 'done' | 'failed'

export interface Artifact {
  /** matches the tool call that started it */
  callId: string
  /** file name as shown; the absolute path once the result reports it */
  name: string
  path?: string
  status: ArtifactStatus
  /** the CLI's one-line reason when status is 'failed' */
  error?: string
  /** optional retry instruction persisted for stopped/failed turns */
  instruction?: string
  /** FX-64: set when a failed artifact was later superseded by a successful create in the same turn */
  retried?: boolean
}

const DOC_EXT = /\.(docx|xlsx|pptx|pdf|md|html|csv|png|jpe?g)$/i

const callMetaById = new Map<string, { command: string; target: string }>()

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

/** Canonical command family for a tool call ('create', 'convert', 'docs apply', 'sheet apply', 'slides apply', 'slides replace'). */
export function artifactCommand(call: AgentToolCall): string {
  if (call.name === CREATE_DOCUMENT_TOOL) return 'create'
  if (call.name !== RUN_GENOFFICE_TOOL || !Array.isArray(call.input.args)) return call.name
  const args = (call.input.args as unknown[]).filter((a): a is string => typeof a === 'string')
  const first = args[0] ?? ''
  if (first === 'docs' || first === 'sheet' || first === 'slides') {
    return `${first} ${args[1] ?? ''}`.trim()
  }
  return first
}

function normalizeTargetStem(nameOrPath: string): string {
  return baseName(nameOrPath)
    .toLowerCase()
    .replace(/(?:[-_](?:v\d{1,3}|\d{1,2}|final|updated|moi)|\s+\(\d+\))(\.[^.]+)$/i, '$1')
}

/** the --out value (or in-place apply/replace target) of a run_genoffice call, or the title of a create_document call */
export function artifactTarget(call: AgentToolCall): string | null {
  if (call.name === CREATE_DOCUMENT_TOOL) {
    const title = typeof call.input.title === 'string' ? call.input.title.trim() : ''
    const format = call.input.format === 'md' ? 'md' : 'docx'
    return `${title || 'Untitled'}.${format}`
  }
  if (call.name !== RUN_GENOFFICE_TOOL || !Array.isArray(call.input.args)) return null
  const args = (call.input.args as unknown[]).filter((a): a is string => typeof a === 'string')
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--out' && typeof args[i + 1] === 'string' && args[i + 1]) {
      return DOC_EXT.test(args[i + 1]!) ? args[i + 1]! : null
    }
    if (arg.startsWith('--out=')) {
      const val = arg.slice(6)
      return val && DOC_EXT.test(val) ? val : null
    }
  }
  // In-place edit (docs/sheet/slides apply|replace <file> without --out)
  if (
    (args[0] === 'docs' || args[0] === 'sheet' || args[0] === 'slides') &&
    (args[1] === 'apply' || args[1] === 'replace')
  ) {
    for (let i = 2; i < args.length; i++) {
      const arg = args[i]!
      if (arg.startsWith('--')) {
        if (!['--dry-run', '--track', '--best-effort', '--stop-on-error', '--help', '--force', '--json'].includes(arg) && !arg.includes('=')) {
          i++
        }
        continue
      }
      if (DOC_EXT.test(arg)) return arg
    }
  }
  return null
}

/**
 * A new 'building' artifact for a call that names a target, else null. With
 * an output directory known, only files going there count: a relative or
 * work-directory --out is an intermediate (a base workbook, a staged spec),
 * not something the user asked for.
 */
export function artifactFromCall(call: AgentToolCall, outDir?: string | null): Artifact | null {
  const target = artifactTarget(call)
  if (!target) return null
  if (outDir && call.name === RUN_GENOFFICE_TOOL && !isInside(outDir, target)) return null
  callMetaById.set(call.id, { command: artifactCommand(call), target })
  return { callId: call.id, name: baseName(target), status: 'building' }
}

function isInside(dir: string, path: string): boolean {
  const root = dir.replace(/[\\/]+$/, '')
  return path.startsWith(`${root}/`) || path.startsWith(`${root}\\`)
}

/**
 * Settle the artifact of `call` from the tool's result text. The CLI skill
 * prints `output_path: <abs>` on success and `summary: <reason>` on failure;
 * create_document prints `path: <abs>`.
 * Synchronizes earlier cards targeting the same file so the chat File Card
 * always reflects 100% the state of the final write (FX-32).
 */
export function settleArtifact(
  artifacts: readonly Artifact[],
  call: AgentToolCall,
  execution: { output: string; isError?: boolean },
): Artifact[] {
  const index = artifacts.findIndex((a) => a.callId === call.id)
  if (index < 0) return [...artifacts]
  const current = artifacts[index]!
  // create_document indents its `path:` line under "saved <name>"
  const path = /^\s*(?:output_path|path): (.+)$/m.exec(execution.output)?.[1]?.trim() ?? undefined
  const resolvedName = path ? baseName(path) : current.name
  const next: Artifact = execution.isError
    ? {
        ...current,
        status: 'failed',
        error:
          /^summary: (.+)$/m.exec(execution.output)?.[1]?.trim() ??
          execution.output.split('\n')[0]?.slice(0, 160),
      }
    : { ...current, status: 'done', ...(path ? { path, name: resolvedName } : {}) }
  const currentCommand = artifactCommand(call)
  const currentTarget = path ?? artifactTarget(call) ?? current.path ?? current.name
  callMetaById.set(call.id, { command: currentCommand, target: currentTarget })
  const out = [...artifacts]
  out[index] = next
  // FX-32: If an earlier card in the same turn targeted the exact same file (by path or baseName),
  // supersede the earlier card ONLY when this new call succeeded (`!execution.isError`).
  // FX-64 & FX-81: Only mark an earlier failed card (`idx < index`) as `retried: true`
  // when a LATER call in the same turn with the SAME command and SAME target file succeeds
  // (or when a retried `create` succeeds after an empty-stub validation error).
  return out
    .filter((item, idx) => {
      if (idx === index) return true
      if (execution.isError) return true
      if (path && item.path && item.path === path) return false
      if (item.name === resolvedName && idx < index) return false
      return true
    })
    .map((item, idx) => {
      if (!execution.isError && idx < index && item.callId !== call.id && item.status === 'failed') {
        const itemMeta = callMetaById.get(item.callId)
        const itemCommand = itemMeta?.command ?? 'create'
        const itemTarget = item.path ?? itemMeta?.target ?? item.name
        const sameCmd = itemCommand === currentCommand
        const sameFile = normalizeTargetStem(itemTarget) === normalizeTargetStem(currentTarget)
        const stubRetry =
          sameCmd &&
          currentCommand === 'create' &&
          /empty or title-only stub/i.test(item.error ?? '')
        if (sameCmd && (sameFile || stubRetry)) {
          return { ...item, retried: true }
        }
      }
      return item
    })
}

/**
 * FX-81: Collect all local file paths referenced by artifact cards, saved answers,
 * or `filenav://` markdown links so the UI can check `fs.existsSync` over IPC.
 */
export function collectReferencedFilePaths(
  messages: ReadonlyArray<{
    text?: string
    artifacts?: readonly Artifact[]
    saved?: { path: string; name: string } | { error: string } | 'saving'
  }>,
): string[] {
  const paths = new Set<string>()
  const filenavRe = /filenav:\/\/([^\s)]+)/g
  for (const m of messages) {
    if (m.artifacts) {
      for (const a of m.artifacts) {
        if (a.path) paths.add(a.path)
      }
    }
    if (m.saved && typeof m.saved === 'object' && 'path' in m.saved && m.saved.path) {
      paths.add(m.saved.path)
    }
    if (typeof m.text === 'string' && m.text.includes('filenav://')) {
      for (const match of m.text.matchAll(filenavRe)) {
        const raw = match[1]
        if (!raw) continue
        try {
          paths.add(decodeURIComponent(raw))
        } catch {
          paths.add(raw)
        }
      }
    }
  }
  return [...paths]
}

/** the prompt a Retry button sends for one failed artifact */
export function retryInstruction(artifact: Artifact): string {
  return artifact.error
    ? `Build ${artifact.name} again; the previous attempt failed with: ${artifact.error}`
    : `Build ${artifact.name} again.`
}
