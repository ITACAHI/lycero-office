/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { run, tempDir } from './helpers'

async function readPartXml(docxOrXlsxPath: string, partPath: string): Promise<string> {
  const zip = await JSZip.loadAsync(readFileSync(docxOrXlsxPath))
  const file = zip.file(partPath)
  if (!file) throw new Error(`Missing part ${partPath} in ${docxOrXlsxPath}`)
  return file.async('string')
}

describe('Super Plan v2.0.19 QA Regression & Smoke Suite', () => {
  it('FX-31/FX-34/FX-03/FX-13/FX-14/FX-17: creates NĐ30 DOCX with Times New Roman, 40/60 Quốc hiệu, keepNext on Điều, no auto "(Ký, ghi rõ...)", HR table preserved, and kb-* stripped', async () => {
    const dir = tempDir()
    const htmlPath = join(dir, 'quyet-dinh.html')
    const outDocx = join(dir, 'Quyet_dinh_bo_nhiem.docx')

    writeFileSync(
      htmlPath,
      [
        '<table style="width: 100%; border: none;">',
        '  <tr>',
        '    <td><p>ỦY BAN NHÂN DÂN THÀNH PHỐ</p><p><strong><u>SỞ NỘI VỤ</u></strong></p><p>Số: 18/QĐ-SNV</p></td>',
        '    <td><p><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p><p><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p><p><em>Hà Nội, ngày 02 tháng 11 năm 2026</em></p></td>',
        '  </tr>',
        '</table>',
        '<h1><strong>QUYẾT ĐỊNH</strong></h1>',
        '<p style="text-align: center;"><strong>Về việc phân công nhân sự (kb-ask-20261102-999)</strong></p>',
        '<p><em>Căn cứ Luật Tổ chức chính quyền địa phương ngày 16 tháng 6 năm 2025;</em></p>',
        '<p><strong>Điều 1.</strong> Phân công nhân sự theo danh sách dưới đây:</p>',
        '<table>',
        '  <tr><th>STT</th><th>Họ và tên</th><th>Chức vụ</th><th>Phòng ban</th><th>Nhiệm vụ</th><th>Ghi chú</th></tr>',
        '  <tr><td>1</td><td>Nguyễn Văn An</td><td>Trưởng phòng</td><td>Tổ chức</td><td>Phụ trách chung</td><td>Chính thức</td></tr>',
        '</table>',
        '<p><strong>Điều 2.</strong> Quyết định này có hiệu lực kể từ ngày ký.</p>',
      ].join('\n'),
      'utf-8',
    )

    const res = await run(['create', '--type', 'docx', '--from', htmlPath, '--out', outDocx, '--json'])
    expect(res.code).toBe(0)
    const payload = res.json()
    expect(payload.status).toBe('ok')
    expect(payload.detail.readback_verified_values).toMatchObject({
      default_font: 'Times New Roman',
    })

    const docXml = await readPartXml(outDocx, 'word/document.xml')
    const stylesXml = await readPartXml(outDocx, 'word/styles.xml')

    // FX-17: Times New Roman default & NĐ30 margins (1134/1134/1701/850)
    expect(stylesXml).toContain('Times New Roman')
    expect(stylesXml).not.toContain('Calibri')
    expect(docXml).toContain('w:top="1134"')
    expect(docXml).toContain('w:left="1701"')

    // FX-03: Leaked session ID kb-ask-... stripped
    expect(docXml).not.toContain('kb-ask-20261102-999')

    // FX-13: 40/60 Quốc hiệu table (3760 / 5600 twips) & no auto-injected "(Ký, ghi rõ họ tên và đóng dấu)"
    expect(docXml).toContain('w:w="5600"')
    expect(docXml).not.toContain('(Ký, ghi rõ họ tên và đóng dấu)')

    // FX-13: keepNext on Điều headings
    expect(docXml).toContain('<w:keepNext/>')

    // FX-14: HR table keeps its 6 columns ("Họ và tên", "Chức vụ") without forcing ĐVT / SL
    expect(docXml).toContain('Họ và tên')
    expect(docXml).toContain('Chức vụ')

    // FX-34: Rejects mismatched extension (.md output when --type docx is requested)
    const badOut = join(dir, 'wrong.md')
    const badRes = await run(['create', '--type', 'docx', '--from', htmlPath, '--out', badOut, '--json'])
    expect(badRes.code).toBe(1)
    expect(badRes.json().error).toBe('invalid_argument')
  })

  it('FX-02: blocks self-test junk artifacts (test.docx, "Hello test")', async () => {
    const dir = tempDir()
    const helloSrc = join(dir, 'source.md')
    writeFileSync(helloSrc, 'Hello test', 'utf-8')
    const outDocx = join(dir, 'Real_Document.docx')
    const res = await run(['create', '--type', 'docx', '--from', helloSrc, '--out', outDocx, '--json'])
    expect(res.code).toBe(1)
    expect(res.json().message).toContain('Self-test')
  })

  it('FX-01/FX-19/FX-33/FX-41: sanitizes self-referencing SUM formulas, formats 0.0% percentages, supports Confidence 1-10 validation, and returns READBACK_VERIFIED_VALUES', async () => {
    const dir = tempDir()
    const tableJson = join(dir, 'kpi.json')
    const outXlsx = join(dir, 'Bang_KPI.xlsx')

    writeFileSync(
      tableJson,
      JSON.stringify([
        ['STT', 'Mục tiêu', 'Tỷ lệ hoàn thành (%)', 'Confidence', 'Điểm', 'Thành tiền'],
        [1, 'Mục tiêu A', '50%', 8, 10, 1000000],
        [2, 'Mục tiêu B', 0.75, 9, 20, 2500000],
        ['', 'TỔNG CỘNG', '=AVERAGE(C2:C3)', '', '=SUM(E2:E3)', '=SUM(F2:F4)'],
      ]),
      'utf-8',
    )

    const createRes = await run([
      'create',
      '--type',
      'xlsx',
      '--from',
      tableJson,
      '--out',
      outXlsx,
      '--json',
    ])
    expect(createRes.code).toBe(0)
    const createPayload = createRes.json()
    expect(createPayload.detail.readback_verified_values).toBeTruthy()
    // F4 self-reference =SUM(F2:F4) must be auto-clipped to =SUM(F2:F3) = 3,500,000
    expect(JSON.stringify(createPayload.detail.readback_verified_values)).toContain('3500000')

    // Apply data validation (Confidence 1-10 using LLM alias style) + conditional format
    const opsJson = join(dir, 'ops.json')
    writeFileSync(
      opsJson,
      JSON.stringify([
        {
          op: 'set_data_validation',
          range: 'D2:D3',
          type: 'whole',
          minimum: 1,
          maximum: 10,
        },
        {
          op: 'add_conditional_format',
          range: 'F2:F3',
          type: 'greaterThan',
          value: 2000000,
          fillColor: 'red',
        },
      ]),
      'utf-8',
    )

    const applyRes = await run(['sheet', 'apply', outXlsx, '--ops', opsJson, '--json'])
    expect(applyRes.code).toBe(0)
    const applyPayload = applyRes.json()
    expect(applyPayload.status).toBe('ok')
    expect(applyPayload.detail.readback_verified_values).toBeTruthy()

    const sheetXml = await readPartXml(outXlsx, 'xl/worksheets/sheet1.xml')
    expect(sheetXml).toContain('<dataValidations')
    expect(sheetXml).toContain('<conditionalFormatting')
  })
})
