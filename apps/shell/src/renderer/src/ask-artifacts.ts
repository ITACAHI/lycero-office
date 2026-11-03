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
  /** FX-64: set when a failed artifact was later superseded by a successful create in the same turn */
  retried?: boolean
}

const DOC_EXT = /\.(docx|xlsx|pptx|pdf|md|html|csv|png|jpe?g)$/i

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
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
  const out = [...artifacts]
  out[index] = next
  // FX-32: If an earlier card in the same turn targeted the exact same file (by path or baseName),
  // supersede the earlier card so the UI shows one accurate card for the final write.
  // FX-64: If an earlier card in the same turn failed (even with a different file name, e.g.
  // baocao.md -> Bao_Cao_Ra_Soat_Hop_Dong_Mua_Ban.docx) and this card succeeded, mark the
  // earlier failed card as `retried: true` ("Đã thử lại thành công").
  return out
    .filter((item, idx) => {
      if (idx === index) return true
      if (path && item.path && item.path === path) return false
      if (item.name === resolvedName && idx < index) return false
      return true
    })
    .map((item) => {
      if (!execution.isError && item.callId !== call.id && item.status === 'failed') {
        return { ...item, retried: true }
      }
      return item
    })
}

/** the prompt a Retry button sends for one failed artifact */
export function retryInstruction(artifact: Artifact): string {
  return artifact.error
    ? `Build ${artifact.name} again; the previous attempt failed with: ${artifact.error}`
    : `Build ${artifact.name} again.`
}
