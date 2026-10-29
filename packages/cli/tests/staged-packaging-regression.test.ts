/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const cliRoot = resolve(here, '..')
const repoRootDir = resolve(cliRoot, '../..')
const distBundle = join(cliRoot, 'dist', 'lycero-office.cjs')
const distNodeModules = join(cliRoot, 'dist', 'node_modules')

interface StagedCliResult {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
  readonly json: Record<string, unknown> | null
}

function runStagedCli(
  bundlePath: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): StagedCliResult {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_PATH: '',
    LYCERO_SECRET_CANARY: 'SUPER_SECRET_DO_NOT_LEAK_999',
    ...extraEnv,
  }
  delete env.NODE_OPTIONS

  const proc = spawnSync(process.execPath, [bundlePath, ...args], {
    cwd,
    env,
    encoding: 'utf-8',
    timeout: 60_000,
  })
  let parsed: Record<string, unknown> | null = null
  const trimmed = (proc.stdout ?? '').trim()
  if (trimmed.startsWith('{')) {
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      parsed = null
    }
  }
  return {
    status: proc.status,
    stdout: proc.stdout ?? '',
    stderr: proc.stderr ?? '',
    json: parsed,
  }
}

async function extractDocxText(docxPath: string): Promise<{ rawXml: string; texts: string[] }> {
  const zip = await JSZip.loadAsync(readFileSync(docxPath))
  const docXmlFile = zip.file('word/document.xml')
  expect(docXmlFile, 'word/document.xml must exist inside DOCX zip').toBeTruthy()
  const rawXml = await docXmlFile!.async('string')
  const texts = [...rawXml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1] ?? '')
  return { rawXml, texts }
}

describe('staged CLI packaging & jsdom/undici dependency tree regression', () => {
  let stageRoot = ''
  let stagedResources = ''
  let stagedCliDir = ''
  let stagedBundle = ''
  let workDir = ''

  beforeAll(() => {
    expect(existsSync(distBundle), 'dist/lycero-office.cjs must be built').toBe(true)
    expect(existsSync(distNodeModules), 'dist/node_modules must be collected').toBe(true)

    // Stage in os.tmpdir() with spaces in path so no ancestor node_modules or repoRoot exists
    stageRoot = mkdtempSync(join(tmpdir(), 'Lycero Office Staged CLI '))
    stagedResources = join(stageRoot, 'resources')
    stagedCliDir = join(stagedResources, 'cli')
    stagedBundle = join(stagedCliDir, 'lycero-office.cjs')
    workDir = join(stageRoot, 'Work Folder With Spaces')

    mkdirSync(stagedCliDir, { recursive: true })
    mkdirSync(join(stagedResources, 'wasm'), { recursive: true })
    mkdirSync(workDir, { recursive: true })

    // Marker file so packagedResourcesDir() identifies stagedResources as packaged layout
    writeFileSync(join(stagedResources, 'wasm', 'pdfium.wasm'), '')

    // Copy xlsx-sidecar if present so staged XLSX formula caching works identically to installed app
    const sidecarExe = process.platform === 'win32' ? 'xlsx-sidecar.exe' : 'xlsx-sidecar'
    const sidecarCandidates = [
      join(
        repoRootDir,
        'apps/sheets/native/xlsx-engine/target/x86_64-pc-windows-gnu/release',
        sidecarExe,
      ),
      join(repoRootDir, 'apps/sheets/native/xlsx-engine/target/release', sidecarExe),
    ]
    const foundSidecar = sidecarCandidates.find((p) => existsSync(p))
    if (foundSidecar) {
      mkdirSync(join(stagedResources, 'native'), { recursive: true })
      cpSync(foundSidecar, join(stagedResources, 'native', sidecarExe))
    }

    cpSync(distBundle, stagedBundle)
    cpSync(distNodeModules, join(stagedCliDir, 'node_modules'), {
      recursive: true,
      dereference: true,
    })
  }, 60_000)

  afterAll(() => {
    if (stageRoot && existsSync(stageRoot)) {
      rmSync(stageRoot, { recursive: true, force: true })
    }
  })

  it('A. resolves and imports jsdom from staged CLI with compatible undici (^7.21.0) and wrap-handler.js', () => {
    const stagedJsdomPkg = join(stagedCliDir, 'node_modules', 'jsdom', 'package.json')
    expect(existsSync(stagedJsdomPkg)).toBe(true)

    const jsdomMeta = JSON.parse(readFileSync(stagedJsdomPkg, 'utf-8')) as {
      version: string
      dependencies?: Record<string, string>
    }
    expect(jsdomMeta.dependencies?.undici).toMatch(/^\^?7\./)

    const reqFromJsdom = createRequire(stagedJsdomPkg)
    const resolvedJsdomEntry = reqFromJsdom.resolve('jsdom')
    expect(resolvedJsdomEntry.startsWith(stagedCliDir)).toBe(true)

    // Verify the undici that jsdom resolves to is v7.x and contains wrap-handler.js
    const resolvedWrapHandler = reqFromJsdom.resolve('undici/lib/handler/wrap-handler.js')
    expect(resolvedWrapHandler.startsWith(stagedCliDir)).toBe(true)
    expect(existsSync(resolvedWrapHandler)).toBe(true)

    // Actually import jsdom in an isolated child Node process with empty NODE_PATH
    const probeScript = `
      const { createRequire } = require('node:module');
      const { pathToFileURL } = require('node:url');
      (async () => {
        const entry = createRequire(${JSON.stringify(stagedJsdomPkg)}).resolve('jsdom');
        const mod = await import(pathToFileURL(entry).href);
        if (typeof mod.JSDOM !== 'function') throw new Error('JSDOM missing');
        const dom = new mod.JSDOM('<!doctype html><p>ok</p>');
        if (dom.window.document.querySelector('p').textContent !== 'ok') throw new Error('DOM failed');
        console.log('JSDOM_IMPORT_OK');
      })();
    `
    const out = execFileSync(process.execPath, ['-e', probeScript], {
      cwd: workDir,
      env: { ...process.env, NODE_PATH: '' },
      encoding: 'utf-8',
    })
    expect(out).toContain('JSDOM_IMPORT_OK')

    // Ensure workspace consumers that declare undici ^6.29.1 still resolve undici 6.x in the repo
    const cliReq = createRequire(join(cliRoot, 'package.json'))
    const repoUndiciEntry = cliReq.resolve('undici')
    expect(existsSync(repoUndiciEntry)).toBe(true)
  })

  it('B1. creates DOCX from minimal Markdown in staged CLI and verifies XML content', async () => {
    const mdPath = join(workDir, 'short-convert.md')
    const outPath = join(workDir, 'minimal.docx')
    writeFileSync(mdPath, '# Minimal fixture\n\nLocal conversion should work.\n', 'utf-8')

    const res = runStagedCli(
      stagedBundle,
      ['create', '--type', 'docx', '--from', mdPath, '--out', outPath, '--json'],
      workDir,
    )
    expect(res.status, `stderr: ${res.stderr}\nstdout: ${res.stdout}`).toBe(0)
    expect(res.json).toMatchObject({
      status: 'ok',
      command: 'create',
      output_path: outPath,
    })
    expect(existsSync(outPath)).toBe(true)

    const { rawXml, texts } = await extractDocxText(outPath)
    const combined = texts.join(' ')
    expect(combined).toContain('Minimal fixture')
    expect(combined).toContain('Local conversion should work.')
    expect(rawXml).toContain('<w:p')
  })

  it('B2. creates DOCX from HTML fragment preserving Vietnamese diacritics', async () => {
    const htmlPath = join(workDir, 'vietnamese.html')
    const outPath = join(workDir, 'vietnamese.docx')
    writeFileSync(
      htmlPath,
      '<h1>Báo cáo Kiểm thử Lycero Office</h1><p>Tiếng Việt có dấu: Đặng Trần Côn, Nguyễn Du, chữ Quốc ngữ.</p>',
      'utf-8',
    )

    const res = runStagedCli(
      stagedBundle,
      ['create', '--type', 'docx', '--from', htmlPath, '--out', outPath, '--json'],
      workDir,
    )
    expect(res.status, `stderr: ${res.stderr}\nstdout: ${res.stdout}`).toBe(0)
    expect(res.json).toMatchObject({
      status: 'ok',
      command: 'create',
      output_path: outPath,
    })

    const { texts } = await extractDocxText(outPath)
    const combined = texts.join(' ')
    expect(combined).toContain('Báo cáo Kiểm thử Lycero Office')
    expect(combined).toContain('Tiếng Việt có dấu: Đặng Trần Côn, Nguyễn Du, chữ Quốc ngữ.')
  })

  it('B3. converts medium Markdown with headings, table, and Unicode to DOCX and verifies XML structure', async () => {
    const mdPath = join(workDir, 'medium-unicode.md')
    const outPath = join(workDir, 'medium-unicode.docx')
    const mdContent = [
      '# Hồ sơ Kỹ thuật Đa Ngôn Ngữ',
      '',
      '## 1. Bảng kết quả kiểm thử',
      '',
      '| Hạng mục | Trạng thái | Ghi chú |',
      '| --- | --- | --- |',
      '| Chuyển đổi Markdown | Đạt 100% | Hỗ trợ Tiếng Việt & Unicode |',
      '| Đa ngôn ngữ | 合格 / 합격 | 日本語・한국어・Tiếng Việt |',
      '',
      '## 2. Kết luận',
      '',
      '- Không phụ thuộc node_modules của checkout.',
      '- Bảo toàn cấu trúc bảng và đoạn văn.',
      '',
    ].join('\n')
    writeFileSync(mdPath, mdContent, 'utf-8')

    const res = runStagedCli(
      stagedBundle,
      ['create', '--type', 'docx', '--from', mdPath, '--out', outPath, '--json'],
      workDir,
    )
    expect(res.status, `stderr: ${res.stderr}\nstdout: ${res.stdout}`).toBe(0)
    expect(res.json).toMatchObject({
      status: 'ok',
      command: 'create',
      output_path: outPath,
    })

    const { rawXml, texts } = await extractDocxText(outPath)
    const combined = texts.join(' ')
    expect(rawXml).toContain('<w:tbl>')
    expect(rawXml).toContain('<w:tr>')
    expect(rawXml).toContain('<w:tc>')
    expect(combined).toContain('Hồ sơ Kỹ thuật Đa Ngôn Ngữ')
    expect(combined).toContain('Chuyển đổi Markdown')
    expect(combined).toContain('Đạt 100%')
    expect(combined).toContain('日本語・한국어・Tiếng Việt')
  })

  it('C. preserves non-regression on DOCX info, XLSX formula/cached values, PPTX create/read, and --force guard', () => {
    // 1. DOCX info
    const docxPath = join(workDir, 'medium-unicode.docx')
    const infoRes = runStagedCli(stagedBundle, ['info', docxPath, '--json'], workDir)
    expect(infoRes.status).toBe(0)
    expect(infoRes.json).toMatchObject({
      status: 'ok',
      command: 'info',
      detail: {
        format: 'docx',
      },
    })

    // 2. Output exists guard without --force
    const beforeBytes = readFileSync(docxPath)
    const overwriteRes = runStagedCli(
      stagedBundle,
      [
        'create',
        '--type',
        'docx',
        '--from',
        join(workDir, 'short-convert.md'),
        '--out',
        docxPath,
        '--json',
      ],
      workDir,
    )
    expect(overwriteRes.status).toBe(2)
    expect(overwriteRes.json).toMatchObject({
      status: 'error',
      code: 2,
      error: 'output_exists',
    })
    expect(Buffer.compare(beforeBytes, readFileSync(docxPath))).toBe(0)

    // 3. XLSX create + read with formula & cached value
    const xlsxInput = join(workDir, 'sheet-data.json')
    const xlsxOut = join(workDir, 'metrics.xlsx')
    writeFileSync(
      xlsxInput,
      JSON.stringify([
        ['Mục', 'Giá trị'],
        ['A', 12],
        ['B', 18],
        ['Tổng', '=SUM(B2:B3)'],
      ]),
      'utf-8',
    )
    const xlsxCreate = runStagedCli(
      stagedBundle,
      ['create', '--type', 'xlsx', '--from', xlsxInput, '--out', xlsxOut, '--json'],
      workDir,
    )
    expect(xlsxCreate.status, xlsxCreate.stderr).toBe(0)
    expect(xlsxCreate.json).toMatchObject({
      status: 'ok',
      command: 'create',
      detail: {
        sheets: 1,
        formulas: 1,
      },
    })

    const xlsxRead = runStagedCli(
      stagedBundle,
      ['sheet', 'read', xlsxOut, '--range', 'A1:B4', '--json'],
      workDir,
    )
    expect(xlsxRead.status, xlsxRead.stderr).toBe(0)
    expect(JSON.stringify(xlsxRead.json)).toContain('30')

    // 4. PPTX create + read
    const pptxSpec = join(workDir, 'slides-spec.json')
    const pptxOut = join(workDir, 'deck.pptx')
    writeFileSync(
      pptxSpec,
      JSON.stringify({
        pages: [
          {
            background: '#F4F2EB',
            elements: [
              {
                type: 'text',
                x: 80,
                y: 60,
                w: 600,
                h: 60,
                paragraphs: [
                  {
                    runs: [
                      { text: 'Slide Kiểm Thử Lycero', sizePt: 28, bold: true, color: '#1C1B18' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
      'utf-8',
    )
    const pptxCreate = runStagedCli(
      stagedBundle,
      ['create', '--type', 'pptx', '--spec', pptxSpec, '--out', pptxOut, '--json'],
      workDir,
    )
    expect(pptxCreate.status, pptxCreate.stderr).toBe(0)
    const pptxRead = runStagedCli(stagedBundle, ['slides', 'read', pptxOut, '--json'], workDir)
    expect(pptxRead.status, pptxRead.stderr).toBe(0)
    expect(JSON.stringify(pptxRead.json)).toContain('Slide Kiểm Thử Lycero')
  })

  it('D. distinguishes missing jsdom from broken transitive dependency without leaking secrets', () => {
    const mdPath = join(workDir, 'short-convert.md')

    // Case 1: jsdom genuinely absent
    const missingStage = mkdtempSync(join(tmpdir(), 'Lycero Missing Jsdom '))
    try {
      const cliDir = join(missingStage, 'resources', 'cli')
      mkdirSync(join(cliDir, 'node_modules'), { recursive: true })
      mkdirSync(join(missingStage, 'resources', 'wasm'), { recursive: true })
      writeFileSync(join(missingStage, 'resources', 'wasm', 'pdfium.wasm'), '')
      const bundle = join(cliDir, 'lycero-office.cjs')
      cpSync(distBundle, bundle)

      const res = runStagedCli(
        bundle,
        [
          'create',
          '--type',
          'docx',
          '--from',
          mdPath,
          '--out',
          join(workDir, 'never1.docx'),
          '--json',
        ],
        workDir,
      )
      expect(res.status).toBe(3)
      expect(res.json).toMatchObject({
        status: 'error',
        command: 'create',
        code: 3,
        error: 'conversion_failed',
      })
      expect(String(res.json?.message ?? '')).toContain('jsdom not found')
      expect(JSON.stringify(res.json)).not.toContain('run from a checkout')
      expect(JSON.stringify(res.json)).not.toContain('SUPER_SECRET_DO_NOT_LEAK_999')
    } finally {
      rmSync(missingStage, { recursive: true, force: true })
    }

    // Case 2: jsdom present, but transitive dependency file (undici wrap-handler.js) is missing
    const brokenStage = mkdtempSync(join(tmpdir(), 'Lycero Broken Transitive '))
    try {
      const cliDir = join(brokenStage, 'resources', 'cli')
      mkdirSync(cliDir, { recursive: true })
      mkdirSync(join(brokenStage, 'resources', 'wasm'), { recursive: true })
      writeFileSync(join(brokenStage, 'resources', 'wasm', 'pdfium.wasm'), '')
      const bundle = join(cliDir, 'lycero-office.cjs')
      cpSync(distBundle, bundle)
      cpSync(join(stagedCliDir, 'node_modules'), join(cliDir, 'node_modules'), {
        recursive: true,
      })
      // Remove wrap-handler.js to simulate the undici@6.29.1 transitive mismatch
      rmSync(join(cliDir, 'node_modules', 'undici', 'lib', 'handler', 'wrap-handler.js'), {
        force: true,
      })

      const res = runStagedCli(
        bundle,
        [
          'create',
          '--type',
          'docx',
          '--from',
          mdPath,
          '--out',
          join(workDir, 'never2.docx'),
          '--json',
        ],
        workDir,
      )
      expect(res.status).toBe(3)
      expect(res.json).toMatchObject({
        status: 'error',
        command: 'create',
        code: 3,
        error: 'conversion_failed',
      })
      expect(String(res.json?.message ?? '')).toContain('jsdom failed to load')
      expect(String(res.json?.message ?? '')).not.toContain('jsdom not found')
      expect(JSON.stringify(res.json?.detail ?? {})).toContain('wrap-handler')
      expect(JSON.stringify(res.json)).not.toContain('run from a checkout')
      expect(JSON.stringify(res.json)).not.toContain('SUPER_SECRET_DO_NOT_LEAK_999')
      expect(JSON.stringify(res.json)).not.toContain('Local conversion should work')
    } finally {
      rmSync(brokenStage, { recursive: true, force: true })
    }
  })
})
