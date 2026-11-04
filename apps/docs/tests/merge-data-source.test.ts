/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { csvToXlsxBuffer } from '@lycero/xlsx-gateway/gateway/csv-import'
import { readMergeDataSource } from '../src/main/merge-data-source'

/**
 * The data source of the mail merge: a local .xlsx or .csv read as a field
 * list plus records. genoffice#2097.
 */

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'genoffice-merge-'))
}

describe('readMergeDataSource', () => {
  it('reads a CSV with a UTF-8 BOM and quoted fields', async () => {
    const dir = await tempDir()
    const path = join(dir, 'recipients.csv')
    await writeFile(
      path,
      '﻿Name,Note\r\n"Ada Lovelace","a, b"\r\n"Grace Hopper","line1\nline2"\r\n',
      'utf8',
    )
    const source = await readMergeDataSource(path)
    expect(source.name).toBe('recipients.csv')
    expect(source.fields).toEqual(['Name', 'Note'])
    expect(source.records).toEqual([
      { Name: 'Ada Lovelace', Note: 'a, b' },
      { Name: 'Grace Hopper', Note: 'line1\nline2' },
    ])
  })

  it('reads the first sheet of an xlsx', async () => {
    const dir = await tempDir()
    const path = join(dir, 'recipients.xlsx')
    await writeFile(path, await csvToXlsxBuffer('First Name,Age\nAda,36\nGrace,45\n'))
    const source = await readMergeDataSource(path)
    expect(source.name).toBe('recipients.xlsx')
    expect(source.fields).toEqual(['First Name', 'Age'])
    expect(source.records).toEqual([
      { 'First Name': 'Ada', Age: '36' },
      { 'First Name': 'Grace', Age: '45' },
    ])
  })

  it('names an empty header column and separates a repeated one', async () => {
    const dir = await tempDir()
    const path = join(dir, 'recipients.csv')
    await writeFile(path, 'Name,,Name\nAda,x,y\n', 'utf8')
    const source = await readMergeDataSource(path)
    expect(source.fields).toEqual(['Name', 'Column2', 'Name2'])
    expect(source.records).toEqual([{ Name: 'Ada', Column2: 'x', Name2: 'y' }])
  })

  it('ignores trailing empty rows and trailing empty columns (FX-90)', async () => {
    const dir = await tempDir()
    const path = join(dir, 'recipients.csv')
    await writeFile(path, 'Họ tên,Email,,\nAn,an@example.com,,\nBình,binh@example.com,,\n,,,\n,,,\n', 'utf8')
    const source = await readMergeDataSource(path)
    expect(source.fields).toEqual(['Họ tên', 'Email'])
    expect(source.records).toHaveLength(2)
    expect(source.records).toEqual([
      { 'Họ tên': 'An', Email: 'an@example.com' },
      { 'Họ tên': 'Bình', Email: 'binh@example.com' },
    ])
  })

  it('preserves all 4 columns including Email across CSV and XLSX (FX-93)', async () => {
    const dir = await tempDir()
    const csvPath = join(dir, 'recipients4.csv')
    const csvText =
      'Họ tên,Chức vụ,Đơn vị,Email\nNguyễn Văn An,Giám đốc,Công ty A,an@congtya.vn\nTrần Thị Bình,Trưởng phòng,Công ty B,binh@congtyb.vn\n'
    await writeFile(csvPath, csvText, 'utf8')
    const csvSource = await readMergeDataSource(csvPath)
    expect(csvSource.fields).toEqual(['Họ tên', 'Chức vụ', 'Đơn vị', 'Email'])
    expect(csvSource.records).toHaveLength(2)

    const xlsxPath = join(dir, 'recipients4.xlsx')
    await writeFile(xlsxPath, await csvToXlsxBuffer(csvText))
    const xlsxSource = await readMergeDataSource(xlsxPath)
    expect(xlsxSource.fields).toEqual(['Họ tên', 'Chức vụ', 'Đơn vị', 'Email'])
    expect(xlsxSource.records).toHaveLength(2)
  })

  it('refuses a format it cannot read', async () => {
    const dir = await tempDir()
    const path = join(dir, 'recipients.txt')
    await writeFile(path, 'Name\nAda\n', 'utf8')
    await expect(readMergeDataSource(path)).rejects.toThrow(/unsupported data source/)
  })
})
