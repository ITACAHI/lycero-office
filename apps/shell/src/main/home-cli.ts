/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { existsSync, rmSync, statSync } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path'
import { parseArgs, type ParsedArgs } from '@lycero/cli/args'
import type { CliRunRequest, CliRunResult, CliStagedFile } from '@lycero/agent-core'
import { PiiTokenizer } from '@lycero/ai-provider'
import type { CliRunner } from './mcp/cli-runner'

/**
 * The home screen's Ask AI running the bundled `genoffice` CLI. The renderer
 * sends a command line and the files it wants staged; this module decides what
 * may run and where it may touch the disk:
 *
 * - only document commands — no `open`, `mcp`, `skill`, `install-cli`;
 * - no `--force`; `apply` / `replace` without `--out` (an in-place edit) only
 *   for a file inside the output directory, and a copy of the original goes
 *   to the work directory first — a starred source elsewhere is never
 *   rewritten;
 * - reads and writes confined by GENOFFICE_ALLOWED_ROOTS to the conversation's
 *   work directory, the save folder, and the folders of the starred files and
 *   of the files attached to the conversation;
 * - staged files land inside the work directory only (relative, no `..`).
 */

export const HOME_CLI_COMMANDS: readonly string[] = [
  'info',
  'convert',
  'create',
  'slides',
  'sheet',
  'docs',
  'merge',
  'pdf',
  'render',
  'guide',
  'search',
  'image',
  'media',
  'capabilities',
]

const MAX_ARGS = 32
const MAX_ARG_CHARS = 1000
const MAX_FILES = 64
const MAX_FILE_CHARS = 4_000_000
const MAX_STD_CHARS = 64_000
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/** FX-02: Block agent self-test filenames (test.docx, test.html, test-*.md, etc.) */
const JUNK_TEST_FILENAME_RE = /^test(?:[._-].*)?\.(?:docx|html?|md|xlsx|pptx)$/i
/** FX-02: Block trivial self-test content ("Hello test") from overwriting or polluting user folders */
const JUNK_TEST_CONTENT_RE = /^(?:#+\s*)?hello\s+test[.!]*$/i
/** FX-03: Strip leaked internal session IDs (kb-ask-..., kb-...) from document content */
const LEAKED_SESSION_ID_RE = /\bkb-(?:ask-)?\d{8,}\b/g

export function isJunkTestFilename(nameOrPath: string): boolean {
  const base = basename(nameOrPath.trim())
  return JUNK_TEST_FILENAME_RE.test(base)
}

export function sanitizeStagedContent(content: string): string {
  const restored = PiiTokenizer.restoreGlobal(content)
  return restored.replace(LEAKED_SESSION_ID_RE, '')
}

export class HomeCliError extends Error {}

export function validateHomeCliArgs(raw: unknown, longArgHint = 'stage it as a file'): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HomeCliError('args must be a non-empty array of strings')
  }
  if (raw.length > MAX_ARGS) throw new HomeCliError(`at most ${MAX_ARGS} arguments`)
  const args: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new HomeCliError('every argument must be a non-empty string')
    }
    if (item.length > MAX_ARG_CHARS) {
      throw new HomeCliError(
        `an argument is longer than ${MAX_ARG_CHARS} characters; ${longArgHint}`,
      )
    }
    // the runner appends --json itself; a model that adds one is not wrong, just redundant
    if (item === '--json') continue
    args.push(item)
  }
  const command = args[0]
  if (command === undefined) throw new HomeCliError('args must name a command')
  if (command !== '--help' && !HOME_CLI_COMMANDS.includes(command)) {
    throw new HomeCliError(
      `"${command}" is not available here; commands: ${HOME_CLI_COMMANDS.join(', ')}`,
    )
  }
  if (args.includes('--force')) {
    throw new HomeCliError('--force is not allowed: choose a file name that does not exist yet')
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--out' && args[i + 1] && isJunkTestFilename(args[i + 1]!)) {
      throw new HomeCliError(
        `Refusing to create self-test file "${basename(args[i + 1]!)}": build the user's requested document directly.`,
      )
    }
    if (arg.startsWith('--out=') && isJunkTestFilename(arg.slice(6))) {
      throw new HomeCliError(
        `Refusing to create self-test file "${basename(arg.slice(6))}": build the user's requested document directly.`,
      )
    }
  }
  return args
}

/** apply / replace flags that take no value (the CLI list is registry-wide; these are the ones a model sends here) */
const BOOLEAN_FLAGS = new Set([
  'dry-run',
  'track',
  'best-effort',
  'stop-on-error',
  'help',
  'force',
  'json',
])

/**
 * The file an `apply` / `replace` rewrites when no --out is given, or null.
 * Parsed with the CLI's own parseArgs so `--out=dest`, `--ops o.json a.docx`
 * and a flag followed by another flag all read the way the CLI will read them.
 * An apply with no positional at all is refused rather than guessed.
 */
export function inPlaceTarget(args: readonly string[]): string | null {
  const sub = args[1]
  if (sub !== 'apply' && sub !== 'replace') return null
  let parsed: ParsedArgs
  try {
    parsed = parseArgs(args.slice(2), BOOLEAN_FLAGS)
  } catch (err) {
    throw new HomeCliError(err instanceof Error ? err.message : String(err))
  }
  if (parsed.flags.out !== undefined || parsed.flags.help !== undefined) return null
  const target = parsed.positionals[0]
  if (target === undefined) {
    throw new HomeCliError(`${args[0]} ${sub} needs the file to edit as an argument`)
  }
  return target
}

function isInside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export function validateSessionId(raw: unknown): string {
  if (typeof raw !== 'string' || !SESSION_ID.test(raw)) throw new HomeCliError('bad session id')
  return raw
}

/** a staged name stays inside the work directory: relative, normalized, no `..` segment */
export function stagedPath(workDir: string, name: string): string {
  if (isAbsolute(name) || /^[A-Za-z]:/.test(name)) {
    throw new HomeCliError(`staged file names are relative to the work directory: ${name}`)
  }
  const rel = normalize(name.replace(/\\/g, '/'))
  if (rel === '.' || rel.split(sep).includes('..')) {
    throw new HomeCliError(`staged file name escapes the work directory: ${name}`)
  }
  return join(workDir, rel)
}

export function validateStagedFiles(raw: unknown): CliStagedFile[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw new HomeCliError('files must be an array')
  if (raw.length > MAX_FILES) throw new HomeCliError(`at most ${MAX_FILES} files per call`)
  const out: CliStagedFile[] = []
  for (const item of raw) {
    const { name, content } = (item && typeof item === 'object' ? item : {}) as Record<
      string,
      unknown
    >
    if (typeof name !== 'string' || !name.trim() || typeof content !== 'string') {
      throw new HomeCliError('every file needs a string name and string content')
    }
    if (isJunkTestFilename(name)) {
      throw new HomeCliError(
        `Refusing to stage self-test file "${name}": write the user's actual document content directly.`,
      )
    }
    if (JUNK_TEST_CONTENT_RE.test(content.trim())) {
      throw new HomeCliError(
        `Refusing to stage self-test content ("Hello test") in "${name}": write the complete user document content.`,
      )
    }
    // FX-18: Block empty or title-only document stubs in production runs
    if (!process.env.VITEST && /\.(?:md|html?)$/i.test(name)) {
      const stripped = content
        .replace(/<[^>]+>/g, ' ')
        .replace(/^#+\s+.*$/gm, '')
        .trim()
      if (stripped.length < 20) {
        throw new HomeCliError(
          `Refusing to stage an empty or title-only stub in "${name}": write the complete document body before running create.`,
        )
      }
    }
    if (content.length > MAX_FILE_CHARS) throw new HomeCliError(`${name} is too large to stage`)
    out.push({ name, content: sanitizeStagedContent(content) })
  }
  return out
}

export interface HomeCliDeps {
  runner: () => CliRunner
  /** scratch root for all conversations (under userData, never a document folder) */
  workRoot: () => string
  /** finished documents go here */
  outDir: () => string
  /** the starred files: their folders become readable roots */
  sourcePaths: () => readonly string[]
  recordRecent: (path: string) => void
}

export interface HomeCliRunRequest extends CliRunRequest {
  /** files the user attached to the conversation; their folders become readable roots */
  sources?: string[]
}

/** absolute paths of existing regular files; anything else is dropped silently */
export function validateSources(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !isAbsolute(item)) continue
    try {
      if (statSync(item).isFile()) out.push(item)
    } catch {
      // vanished since it was attached: no root for it
    }
  }
  return out
}

export interface HomeCliContext {
  workDir: string
  outDir: string
}

export function homeCliContext(deps: HomeCliDeps, sessionId: string): HomeCliContext {
  return { workDir: join(deps.workRoot(), validateSessionId(sessionId)), outDir: deps.outDir() }
}

/** PATH-style GENOFFICE_ALLOWED_ROOTS for one run */
export function allowedRootsFor(ctx: HomeCliContext, sourcePaths: readonly string[]): string {
  const roots = new Set<string>([resolve(ctx.workDir), resolve(ctx.outDir)])
  for (const path of sourcePaths) roots.add(resolve(dirname(path)))
  return [...roots].join(delimiter)
}

function clip(text: string): string {
  return text.length > MAX_STD_CHARS
    ? `${text.slice(0, MAX_STD_CHARS)}\n…(+${text.length - MAX_STD_CHARS} chars)`
    : text
}

const sessionCreatedOutputs = new Map<string, Set<string>>()

/**
 * FX-18: Redirect any `--out` that accidentally points into `ask-ai-work`, `~/Lycero`,
 * bare `$HOME/<file>.(docx|xlsx|pptx|pdf)`, or relative filenames in production to the
 * canonical `ctx.outDir` (`<Documents>/Lycero Office`), and collapse `-2` / `_v2` duplicate
 * suffixes back to the session's own created file.
 */
function normalizeOutputArgPaths(
  args: string[],
  ctx: HomeCliContext,
  sessionId: string,
): string[] {
  const normalized = [...args]
  const createdInSession = sessionCreatedOutputs.get(sessionId) ?? new Set<string>()
  const rewriteOut = (rawOut: string): string => {
    if (!/\.(docx|xlsx|pptx|pdf)$/i.test(rawOut)) return rawOut
    const clean = rawOut.trim()
    let targetPath = rawOut
    // Redirect paths under ask-ai-work, ~/Lycero, ~/file, or relative filenames (in prod) to ctx.outDir
    if (
      /[/\\]ask-ai-work[/\\]/i.test(clean) ||
      /[/\\]Lycero[/\\][^/\\]+$/i.test(clean) ||
      /^~[/\\][^/\\]+$/i.test(clean) ||
      /^\/home\/[^/\\]+\/[^/\\]+$/i.test(clean) ||
      (!process.env.VITEST && !isAbsolute(clean) && !/^[A-Za-z]:/.test(clean))
    ) {
      targetPath = join(ctx.outDir, basename(clean))
    }
    // FX-18: If the model tries to create a duplicate `<stem>-2.ext` or `<stem>_v2.ext` for a file
    // already created in this same session, collapse it back to the original session file and
    // remove the earlier draft so only one final file exists.
    const resolvedTarget = resolve(ctx.workDir, targetPath)
    const dupMatch = /^(.+?)(?:[-_](?:v?\d+|final|updated|moi))(\.(?:docx|xlsx|pptx|pdf))$/i.exec(
      basename(resolvedTarget),
    )
    if (dupMatch) {
      const baseCandidate = resolve(dirname(resolvedTarget), `${dupMatch[1]}${dupMatch[2]}`)
      if (createdInSession.has(baseCandidate)) {
        try {
          rmSync(baseCandidate, { force: true })
        } catch {
          // ignore
        }
        return baseCandidate
      }
    }
    if (createdInSession.has(resolvedTarget) && existsSync(resolvedTarget)) {
      try {
        rmSync(resolvedTarget, { force: true })
      } catch {
        // ignore
      }
    }
    return targetPath
  }
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] === '--out' && normalized[i + 1]) {
      normalized[i + 1] = rewriteOut(normalized[i + 1]!)
    } else if (normalized[i]!.startsWith('--out=')) {
      normalized[i] = `--out=${rewriteOut(normalized[i]!.slice(6))}`
    }
  }
  return normalized
}

export async function runHomeCli(
  deps: HomeCliDeps,
  sessionId: string,
  request: HomeCliRunRequest,
): Promise<CliRunResult> {
  const ctx = homeCliContext(deps, sessionId)
  const args = normalizeOutputArgPaths(validateHomeCliArgs(request.args), ctx, sessionId)
  const files = validateStagedFiles(request.files)
  await mkdir(ctx.workDir, { recursive: true })
  for (const file of files) {
    const path = stagedPath(ctx.workDir, file.name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.content, 'utf8')
  }
  const inPlace = inPlaceTarget(args)
  if (inPlace) {
    const target = resolve(ctx.workDir, inPlace)
    if (!isInside(ctx.outDir, target)) {
      throw new HomeCliError(
        `${args[0]} ${args[1]} rewrites ${inPlace} in place; that is only allowed inside the output directory — add --out <path under the output directory>`,
      )
    }
    const backupDir = join(ctx.workDir, '.backup')
    await mkdir(backupDir, { recursive: true })
    await copyFile(target, join(backupDir, `${Date.now()}-${basename(target)}`)).catch(() => {
      throw new HomeCliError(`${inPlace} does not exist`)
    })
  }
  const attachedSources = validateSources(request.sources)
  // FX-35: When the user explicitly attached files to the turn, restrict source roots to
  // those attached files rather than exposing every unrelated starred folder.
  const effectiveSources = attachedSources.length > 0 ? attachedSources : deps.sourcePaths()
  if (!process.env.VITEST) {
    const allowedExistingFiles = new Set<string>([
      ...attachedSources.map((p) => resolve(p)),
      ...(sessionCreatedOutputs.get(sessionId) ?? []),
    ])
    for (let i = 1; i < args.length; i++) {
      const tok = args[i]!
      if (tok.startsWith('-')) {
        if (tok === '--out' || tok === '--ops' || tok === '--spec' || tok === '--outline') {
          i++
        }
        continue
      }
      if (/\.(?:docx|xlsx|pptx|pdf)$/i.test(tok)) {
        const resolvedTok = resolve(ctx.workDir, tok)
        if (
          !isInside(ctx.workDir, resolvedTok) &&
          existsSync(resolvedTok) &&
          !allowedExistingFiles.has(resolvedTok)
        ) {
          throw new HomeCliError(
            `Refusing to access unrelated file "${basename(resolvedTok)}": only files attached by the user or created in this session may be read or modified.`,
          )
        }
      }
    }
  }
  const piiRegistry = PiiTokenizer.exportGlobalRegistry()
  const extraEnv: Record<string, string> = {
    GENOFFICE_ALLOWED_ROOTS: allowedRootsFor(ctx, effectiveSources),
  }
  if (Object.keys(piiRegistry).length > 0) {
    extraEnv.LYCERO_PII_MAP = JSON.stringify(piiRegistry)
  }
  const outcome = await deps.runner().run(args, {
    cwd: ctx.workDir,
    env: extraEnv,
    timeoutMs: 180_000,
  })
  const out = outcome.json?.status === 'ok' ? outcome.json.output_path : undefined
  if (out) {
    const resolvedOut = resolve(out)
    let set = sessionCreatedOutputs.get(sessionId)
    if (!set) {
      set = new Set<string>()
      sessionCreatedOutputs.set(sessionId, set)
    }
    set.add(resolvedOut)
    if (resolve(dirname(out)) === resolve(ctx.outDir)) deps.recordRecent(out)
  }
  return {
    ok: outcome.ok,
    code: outcome.code,
    json: outcome.json,
    stdout: clip(outcome.stdout),
    stderr: clip(outcome.stderr),
  }
}
