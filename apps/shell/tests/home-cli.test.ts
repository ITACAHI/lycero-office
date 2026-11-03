/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  allowedRootsFor,
  validateSources,
  HomeCliError,
  homeCliContext,
  inPlaceTarget,
  runHomeCli,
  stagedPath,
  validateHomeCliArgs,
  validateSessionId,
  validateStagedFiles,
  type HomeCliDeps,
} from '../src/main/home-cli'
import type { CliRunOptions, CliRunOutcome } from '../src/main/mcp/cli-runner'

describe('validateHomeCliArgs', () => {
  it('accepts a document command line', () => {
    expect(
      validateHomeCliArgs(['create', '--type', 'docx', '--from', 'r.md', '--out', 'x.docx']),
    ).toHaveLength(7)
  })

  it('refuses commands that leave the document domain', () => {
    for (const cmd of ['open', 'mcp', 'skill', 'install-cli', 'selection', 'rm']) {
      expect(() => validateHomeCliArgs([cmd])).toThrow(HomeCliError)
    }
  })

  it('refuses --force, drops a stray --json and lets --help through', () => {
    expect(() => validateHomeCliArgs(['convert', 'a.docx', '--to', 'pdf', '--force'])).toThrow(
      /--force/,
    )
    expect(validateHomeCliArgs(['info', 'a.docx', '--json'])).toEqual(['info', 'a.docx'])
    expect(validateHomeCliArgs(['docs', '--help'])).toEqual(['docs', '--help'])
    expect(validateHomeCliArgs(['--help'])).toEqual(['--help'])
  })

  it('names the file an apply / replace without --out rewrites', () => {
    expect(inPlaceTarget(['docs', 'apply', 'a.docx', '--ops', 'o.json'])).toBe('a.docx')
    expect(inPlaceTarget(['slides', 'replace', 'd.pptx', '--slide', '1'])).toBe('d.pptx')
    expect(inPlaceTarget(['docs', 'apply', 'a.docx', '--ops', 'o.json', '--out', 'b.docx'])).toBe(
      null,
    )
    expect(inPlaceTarget(['docs', 'apply', '--help'])).toBe(null)
    expect(inPlaceTarget(['docs', 'read', 'a.docx'])).toBe(null)
    // the file may come after the flags; a flag's value is not the file
    expect(inPlaceTarget(['docs', 'apply', '--ops', 'o.json', 'a.docx'])).toBe('a.docx')
    expect(inPlaceTarget(['docs', 'apply', '--track', '--author', 'AI', 'a.docx'])).toBe('a.docx')
    expect(inPlaceTarget(['sheet', 'apply', '--dry-run', 'b.xlsx', '--ops', 'o'])).toBe('b.xlsx')
    expect(() => inPlaceTarget(['docs', 'apply', '--ops', 'o.json'])).toThrow(HomeCliError)
    expect(inPlaceTarget(['docs', 'apply', 'a.docx', '--ops', 'o.json', '--out=b.docx'])).toBe(null)
    expect(inPlaceTarget(['docs', 'apply', '--author', '--track', 'a.docx', '--ops', 'o'])).toBe(
      'a.docx',
    )
    expect(inPlaceTarget(['docs', 'apply', '--ops=o.json', 'a.docx'])).toBe('a.docx')
    expect(() => inPlaceTarget(['docs', 'apply', 'a.docx', '--track=yes'])).toThrow(HomeCliError)
  })

  it('bounds the argv', () => {
    expect(() => validateHomeCliArgs([])).toThrow(HomeCliError)
    expect(() => validateHomeCliArgs(['info', ''])).toThrow(HomeCliError)
    expect(() => validateHomeCliArgs(['info', 'x'.repeat(1001)])).toThrow(/stage it as a file/)
    expect(() => validateHomeCliArgs(Array.from({ length: 33 }, () => 'a'))).toThrow(/at most/)
  })
})

describe('staging', () => {
  it('keeps staged names inside the work directory', () => {
    expect(stagedPath('/w', 'deck/pages/01.json')).toBe(join('/w', 'deck', 'pages', '01.json'))
    expect(stagedPath('/w', './ops.json')).toBe(join('/w', 'ops.json'))
    expect(() => stagedPath('/w', '../ops.json')).toThrow(HomeCliError)
    expect(() => stagedPath('/w', 'a/../../ops.json')).toThrow(HomeCliError)
    expect(() => stagedPath('/w', '/etc/ops.json')).toThrow(HomeCliError)
    expect(() => stagedPath('/w', 'C:\\x.json')).toThrow(HomeCliError)
  })

  it('validates the staged file list', () => {
    expect(validateStagedFiles(undefined)).toEqual([])
    expect(validateStagedFiles([{ name: 'a.md', content: '#' }])).toEqual([
      { name: 'a.md', content: '#' },
    ])
    expect(
      validateStagedFiles([
        {
          name: 'doc.md',
          content:
            '# Title\n<thinking>secret thought</thinking><tool_call>{"name":"cli"}</tool_call>[LYCERO_INTERNAL_TAG] Body kb-ask-1760000000000 text [PII_PERSON_1]',
        },
      ]),
    ).toEqual([
      {
        name: 'doc.md',
        content: '# Title\n Body  text ',
      },
    ])
    expect(() => validateStagedFiles([{ name: 'a.md' }])).toThrow(HomeCliError)
    expect(() => validateStagedFiles('x')).toThrow(HomeCliError)
  })

  it('accepts thread ids and rejects path-like ones', () => {
    expect(validateSessionId('kb-ask')).toBe('kb-ask')
    expect(validateSessionId('kb-ask-1760000000000')).toBeTruthy()
    expect(() => validateSessionId('../x')).toThrow(HomeCliError)
    expect(() => validateSessionId('')).toThrow(HomeCliError)
    expect(() => validateSessionId(42)).toThrow(HomeCliError)
  })
})

describe('runHomeCli', () => {
  let root: string
  const runs: Array<{ args: string[]; options?: CliRunOptions }> = []
  let outcome: CliRunOutcome
  const recent: string[] = []
  let deps: HomeCliDeps

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'home-cli-'))
    runs.length = 0
    recent.length = 0
    outcome = { ok: true, code: 0, stdout: '{"status":"ok"}', stderr: '' }
    deps = {
      runner: () => ({
        run: async (args, options) => {
          runs.push({ args, options })
          return outcome
        },
      }),
      workRoot: () => join(root, 'work'),
      outDir: () => join(root, 'Documents'),
      sourcePaths: () => [join(root, 'src', 'a.xlsx'), join(root, 'src', 'b.xlsx')],
      recordRecent: (path) => void recent.push(path),
    }
  })
  afterEach(() => rm(root, { recursive: true, force: true }))

  it('stages files into the thread work directory and confines the CLI to the roots', async () => {
    const out = join(root, 'Documents', 'report.docx')
    outcome.json = { status: 'ok', command: 'create', summary: 'ok', output_path: out }
    const res = await runHomeCli(deps, 'kb-ask', {
      args: ['create', '--type', 'docx', '--from', 'report.md', '--out', out],
      files: [{ name: 'report.md', content: '# Hi' }],
    })
    const workDir = join(root, 'work', 'kb-ask')
    expect(await readFile(join(workDir, 'report.md'), 'utf8')).toBe('# Hi')
    expect(runs[0]!.options?.cwd).toBe(workDir)
    const roots = runs[0]!.options?.env?.GENOFFICE_ALLOWED_ROOTS?.split(delimiter) ?? []
    expect(roots).toEqual([
      resolve(workDir),
      resolve(join(root, 'Documents')),
      resolve(join(root, 'src')),
    ])
    expect(runs[0]!.args.at(-1)).toBe(out)
    expect(res.ok).toBe(true)
    expect(recent).toEqual([out])
  })

  it('does not record files written outside the output directory as recent', async () => {
    outcome.json = {
      status: 'ok',
      command: 'render',
      summary: 'ok',
      output_path: join(root, 'work', 'kb-ask', 'shots'),
    }
    await runHomeCli(deps, 'kb-ask', { args: ['render', 'x.docx', '--out', 'shots'] })
    expect(recent).toEqual([])
  })

  it('edits a file inside the output directory in place after backing it up', async () => {
    await mkdir(join(root, 'Documents'), { recursive: true })
    const target = join(root, 'Documents', 'book.xlsx')
    await writeFile(target, 'original')
    await runHomeCli(deps, 'kb-ask', {
      args: ['sheet', 'apply', target, '--ops', 'ops.json'],
      files: [{ name: 'ops.json', content: '[]' }],
    })
    expect(runs).toHaveLength(1)
    const backups = await readdir(join(root, 'work', 'kb-ask', '.backup'))
    expect(backups).toHaveLength(1)
    expect(backups[0]).toMatch(/-book\.xlsx$/)
    expect(await readFile(join(root, 'work', 'kb-ask', '.backup', backups[0]!), 'utf8')).toBe(
      'original',
    )
  })

  it('refuses an in-place edit of a source outside the output directory', async () => {
    await expect(
      runHomeCli(deps, 'kb-ask', {
        args: ['docs', 'apply', join(root, 'src', 'a.docx'), '--ops', 'ops.json'],
        files: [{ name: 'ops.json', content: '[]' }],
      }),
    ).rejects.toThrow(/only allowed inside the output directory/)
    await expect(
      runHomeCli(deps, 'kb-ask', {
        args: ['docs', 'apply', '--ops', 'ops.json', join(root, 'src', 'a.docx')],
        files: [{ name: 'ops.json', content: '[]' }],
      }),
    ).rejects.toThrow(/only allowed inside the output directory/)
    await expect(
      runHomeCli(deps, 'kb-ask', {
        args: ['docs', 'apply', join(root, 'Documents', 'missing.docx'), '--ops', 'o'],
      }),
    ).rejects.toThrow(/does not exist/)
    expect(runs).toEqual([])
  })

  it('rejects before spawning when the argv or a staged name is bad', async () => {
    await expect(runHomeCli(deps, 'kb-ask', { args: ['open', 'x.docx'] })).rejects.toThrow(
      HomeCliError,
    )
    await expect(
      runHomeCli(deps, 'kb-ask', { args: ['info', 'x'], files: [{ name: '../x', content: '' }] }),
    ).rejects.toThrow(HomeCliError)
    expect(runs).toEqual([])
  })

  it('names the per-thread directories', () => {
    expect(homeCliContext(deps, 'kb-ask-7')).toEqual({
      workDir: join(root, 'work', 'kb-ask-7'),
      outDir: join(root, 'Documents'),
    })
    expect(() => homeCliContext(deps, '')).toThrow(HomeCliError)
  })

  it('attached files widen the roots to their folders when they exist', async () => {
    const att = join(root, 'Downloads', 'brief.pdf')
    await mkdir(dirname(att), { recursive: true })
    await writeFile(att, 'pdf')
    await runHomeCli(deps, 'kb-ask', {
      args: ['convert', att, '--out', join(root, 'Documents', 'brief.docx')],
      sources: [att, join(root, 'gone', 'x.docx'), 'relative.docx', 42 as unknown as string],
    })
    const roots = runs[0]!.options?.env?.GENOFFICE_ALLOWED_ROOTS?.split(delimiter) ?? []
    expect(roots).toContain(resolve(join(root, 'Downloads')))
    expect(roots).not.toContain(resolve(join(root, 'gone')))
    expect(validateSources([att, join(root, 'Downloads')])).toEqual([att])
  })

  it('allowedRootsFor de-duplicates folders', () => {
    const ctx = { workDir: '/w', outDir: '/o' }
    expect(allowedRootsFor(ctx, ['/o/a.docx', '/o/b.docx', '/s/c.pdf']).split(delimiter)).toEqual([
      resolve('/w'),
      resolve('/o'),
      resolve('/s'),
    ])
  })

  it('FX-50: appends " (1)" instead of overwriting a pre-existing file in the output directory, and redirects same-session edits to it', async () => {
    const outDir = join(root, 'Documents')
    await mkdir(outDir, { recursive: true })
    const existing = join(outDir, 'report.docx')
    await writeFile(existing, 'pre-existing user file')

    const expectedSuffixed = join(outDir, 'report (1).docx')
    outcome.json = {
      status: 'ok',
      command: 'create',
      summary: 'ok',
      output_path: expectedSuffixed,
    }
    await runHomeCli(deps, 'kb-ask-fx50', {
      args: ['create', '--type', 'docx', '--from', 'report.md', '--out', existing],
      files: [{ name: 'report.md', content: '# New Report' }],
    })

    // Pre-existing file must NOT be deleted or overwritten
    expect(await readFile(existing, 'utf8')).toBe('pre-existing user file')
    // CLI must have received the suffixed " (1)" output path
    expect(runs[0]!.args).toEqual([
      'create',
      '--type',
      'docx',
      '--from',
      'report.md',
      '--out',
      expectedSuffixed,
    ])

    // Simulate the CLI having written the suffixed file, then running an in-place apply on the original name in the same session
    await writeFile(expectedSuffixed, 'new session content')
    await runHomeCli(deps, 'kb-ask-fx50', {
      args: ['docs', 'apply', existing, '--ops', 'ops.json'],
      files: [{ name: 'ops.json', content: '[]' }],
    })
    expect(runs[1]!.args).toEqual(['docs', 'apply', resolve(expectedSuffixed), '--ops', 'ops.json'])

    // FX-50 (in-session): a subsequent `create` targeting the same name in the same session must NOT overwrite `report (1).docx`
    const expectedSuffixed2 = join(outDir, 'report (2).docx')
    outcome.json = {
      status: 'ok',
      command: 'create',
      summary: 'ok',
      output_path: expectedSuffixed2,
    }
    await runHomeCli(deps, 'kb-ask-fx50', {
      args: ['create', '--type', 'docx', '--from', 'report2.md', '--out', existing],
      files: [{ name: 'report2.md', content: '# Second Report' }],
    })
    expect(await readFile(expectedSuffixed, 'utf8')).toBe('new session content')
    expect(runs[2]!.args).toEqual([
      'create',
      '--type',
      'docx',
      '--from',
      'report2.md',
      '--out',
      expectedSuffixed2,
    ])
  })

  it('FX-66: dupMatch rewrites --out <stem>_final.docx / -v2.xlsx / -moi.pptx to the original session file WITHOUT deleting it, and preserves 4-digit years (-2026)', async () => {
    const outDir = join(root, 'Documents')
    await mkdir(outDir, { recursive: true })

    // 1. Case 24 reproduction: create X.docx -> docs apply X.docx --ops ok.json --out X_final.docx
    const docPath = join(outDir, 'Van_ban_thoa_thuan_phan_chia_di_san_Nguyen_Van_Hoa.docx')
    const docFinalPath = join(
      outDir,
      'Van_ban_thoa_thuan_phan_chia_di_san_Nguyen_Van_Hoa_final.docx',
    )
    deps = {
      ...deps,
      runner: () => ({
        run: async (args, options) => {
          runs.push({ args, options })
          if (args[0] === 'create') {
            const outIdx = args.indexOf('--out')
            const outTarget = args[outIdx + 1]!
            await writeFile(outTarget, 'initial-created-bytes')
            return {
              ok: true,
              code: 0,
              stdout: JSON.stringify({
                status: 'ok',
                command: 'create',
                summary: 'ok',
                output_path: outTarget,
              }),
              stderr: '',
              json: {
                status: 'ok',
                command: 'create',
                summary: 'ok',
                output_path: outTarget,
              },
            }
          }
          if (args[1] === 'apply') {
            const inputPath = args[2]!
            // The source file MUST still exist on disk when the CLI starts!
            const currentBytes = await readFile(inputPath, 'utf8')
            const opsIdx = args.indexOf('--ops')
            const opsName = args[opsIdx + 1]!
            if (opsName.includes('bad')) {
              return {
                ok: false,
                code: 1,
                stdout: JSON.stringify({
                  status: 'error',
                  command: `${args[0]} apply`,
                  code: 1,
                  message: 'invalid ops',
                }),
                stderr: '',
                json: {
                  status: 'error',
                  command: `${args[0]} apply`,
                  code: 1,
                  message: 'invalid ops',
                },
              }
            }
            const outIdx = args.indexOf('--out')
            const outTarget = outIdx >= 0 ? args[outIdx + 1]! : inputPath
            await writeFile(outTarget, `${currentBytes}+applied`)
            return {
              ok: true,
              code: 0,
              stdout: JSON.stringify({
                status: 'ok',
                command: `${args[0]} apply`,
                summary: 'ok',
                output_path: outTarget,
              }),
              stderr: '',
              json: {
                status: 'ok',
                command: `${args[0]} apply`,
                summary: 'ok',
                output_path: outTarget,
              },
            }
          }
          return outcome
        },
      }),
    }

    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['create', '--type', 'docx', '--from', 'doc.md', '--out', docPath],
      files: [{ name: 'doc.md', content: '# Di san' }],
    })
    expect(await readFile(docPath, 'utf8')).toBe('initial-created-bytes')

    // Apply with valid ops and `--out <file>_final.docx` -> rewrites `--out` to `docPath` without deleting `docPath`
    const applyOk = await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['docs', 'apply', docPath, '--ops', 'ok.json', '--out', docFinalPath],
      files: [{ name: 'ok.json', content: '[{"op":"setStyle"}]' }],
    })
    expect(applyOk.ok).toBe(true)
    expect(await readFile(docPath, 'utf8')).toBe('initial-created-bytes+applied')

    // Apply with bad ops and `--out <file>_final.docx` -> fails, and `docPath` remains 100% intact!
    const applyBad = await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['docs', 'apply', docPath, '--ops', 'bad.json', '--out', docFinalPath],
      files: [{ name: 'bad.json', content: 'invalid' }],
    })
    expect(applyBad.ok).toBe(false)
    expect(await readFile(docPath, 'utf8')).toBe('initial-created-bytes+applied')

    // 2. Test -v2 for xlsx and -moi for pptx, and ensure -2026 is NOT stripped
    const xlsxPath = join(outDir, 'Bang_tinh.xlsx')
    const xlsxV2Path = join(outDir, 'Bang_tinh-v2.xlsx')
    const xlsx2026Path = join(outDir, 'Bang_tinh-2026.xlsx')
    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['create', '--type', 'xlsx', '--from', 'data.json', '--out', xlsxPath],
      files: [{ name: 'data.json', content: '[["A","B"],[1,2]]' }],
    })
    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['sheet', 'apply', xlsxPath, '--ops', 'ok.json', '--out', xlsxV2Path],
      files: [{ name: 'ok.json', content: '[]' }],
    })
    expect(await readFile(xlsxPath, 'utf8')).toBe('initial-created-bytes+applied')

    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['sheet', 'apply', xlsxPath, '--ops', 'bad.json', '--out', xlsxV2Path],
      files: [{ name: 'bad.json', content: '[]' }],
    })
    expect(await readFile(xlsxPath, 'utf8')).toBe('initial-created-bytes+applied')

    // -2026 must NOT match dupMatch
    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['sheet', 'apply', xlsxPath, '--ops', 'ok.json', '--out', xlsx2026Path],
      files: [{ name: 'ok.json', content: '[]' }],
    })
    expect(runs.at(-1)!.args.at(-1)).toBe(xlsx2026Path)
    expect(await readFile(xlsx2026Path, 'utf8')).toBe('initial-created-bytes+applied+applied')

    const pptxPath = join(outDir, 'Bai_giang.pptx')
    const pptxMoiPath = join(outDir, 'Bai_giang-moi.pptx')
    const pptx2026Path = join(outDir, 'Bai_giang-2026.pptx')
    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['create', '--type', 'pptx', '--spec', 'spec.json', '--out', pptxPath],
      files: [{ name: 'spec.json', content: '{"pages":[]}' }],
    })
    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['slides', 'apply', pptxPath, '--ops', 'ok.json', '--out', pptxMoiPath],
      files: [{ name: 'ok.json', content: '[]' }],
    })
    expect(await readFile(pptxPath, 'utf8')).toBe('initial-created-bytes+applied')

    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['slides', 'apply', pptxPath, '--ops', 'bad.json', '--out', pptxMoiPath],
      files: [{ name: 'bad.json', content: '[]' }],
    })
    expect(await readFile(pptxPath, 'utf8')).toBe('initial-created-bytes+applied')

    await runHomeCli(deps, 'kb-ask-fx66', {
      args: ['slides', 'apply', pptxPath, '--ops', 'ok.json', '--out', pptx2026Path],
      files: [{ name: 'ok.json', content: '[]' }],
    })
    expect(runs.at(-1)!.args.at(-1)).toBe(pptx2026Path)
  })
})
