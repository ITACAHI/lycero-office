/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { describe, expect, it } from 'vitest'
import { parseFileToText, xlsToText } from '../src/index'
import { buildXlsxFixture, writeFixture } from './helpers/fixtures'

describe('parseFileToText: legacy .xls', () => {
  it('parses an HTML-table .xls export (e.g., vnEdu/SMAS danh_sach_hoc_sinh.xls) without false-positive password errors', async () => {
    const htmlXls = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table>
            <tr><th>STT</th><th>Họ và tên</th><th>Lớp</th><th>Điểm TB</th></tr>
            <tr><td>1</td><td>Nguyễn Văn An</td><td>10A1</td><td>8.6</td></tr>
            <tr><td>2</td><td>Trần Thị Bình</td><td>10A1</td><td>9.1</td></tr>
          </table>
        </body>
      </html>
    `
    const path = writeFixture('danh_sach_hoc_sinh.xls', Buffer.from(htmlXls, 'utf8'))
    const result = await parseFileToText(path)
    expect(result.ok).toBe(true)
    expect(result.text).toContain('STT\tHọ và tên\tLớp\tĐiểm TB')
    expect(result.text).toContain('1\tNguyễn Văn An\t10A1\t8.6')
    expect(result.text).toContain('2\tTrần Thị Bình\t10A1\t9.1')
  })

  it('parses an Excel 2003 XML SpreadsheetML .xls file', async () => {
    const xmlXls = `<?xml version="1.0"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
                xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Worksheet ss:Name="Danh sách lớp 10A1">
          <Table>
            <Row>
              <Cell><Data ss:Type="String">Mã HS</Data></Cell>
              <Cell><Data ss:Type="String">Họ tên</Data></Cell>
            </Row>
            <Row>
              <Cell><Data ss:Type="String">HS001</Data></Cell>
              <Cell><Data ss:Type="String">Lê Hoàng Nam</Data></Cell>
            </Row>
          </Table>
        </Worksheet>
      </Workbook>`
    const text = await xlsToText(Buffer.from(xmlXls, 'utf8'))
    expect(text).toContain('## Danh sách lớp 10A1')
    expect(text).toContain('Mã HS\tHọ tên')
    expect(text).toContain('HS001\tLê Hoàng Nam')
  })

  it('parses an OOXML .xlsx saved with a .xls extension', async () => {
    const path = writeFixture('misnamed.xls', await buildXlsxFixture())
    const result = await parseFileToText(path)
    expect(result.ok).toBe(true)
    expect(result.text).toContain('# Grades')
    expect(result.text).toContain('Alice | 95')
  })
})
