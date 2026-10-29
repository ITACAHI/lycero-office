/**
 * Lycero Office Desktop
 * Copyright (c) 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright (c) 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase B.2: freelance_solo bundle -- Vitest test suite.
 */

import { describe, it, expect } from 'vitest'
import { executeFreelanceTool, __resetInvoiceStore } from '../../src/bundles/freelance-solo/tools'
import type { AgentToolCall } from '../../src/types'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

let _callCount = 0
function makeCall(name: string, input: Record<string, unknown>): AgentToolCall {
  _callCount++
  return { id: 'call-' + _callCount + '-' + Math.random().toString(36).slice(2, 6), name, input }
}

// -- C1: freelance_contract ----------------------------------------------------

describe('docs.freelance_contract', () => {
  it('C1.1 returns contract text with all parties filled', async () => {
    const call = makeCall('docs.freelance_contract', {
      parties: [
        { role: 'client', name: 'Cong Ty TNHH ABC', address: '123 Nguyen Trai, Q1, TP.HCM' },
        { role: 'freelancer', name: 'Nguyen Van Minh', address: '456 Le loi, Q3, TP.HCM' },
      ],
      scope: 'Thiet ke logo va bo nhan dien thuong hieu',
      fee: 15000000,
      deadline: '2026-12-31',
    })

    const result = await executeFreelanceTool(call)

    expect(result.isError).toBeFalsy()
    expect(result.output).toContain('HOP DONG THUE DICH VU')
    expect(result.output).toContain('Cong Ty TNHH ABC')
    expect(result.output).toContain('Nguyen Van Minh')
    expect(result.output).toContain('123 Nguyen Trai, Q1, TP.HCM')
    expect(result.output).toContain('456 Le loi, Q3, TP.HCM')
    expect(result.output).toContain('15.000.000 dong')
    expect(result.output).toContain('ngay 31 thang muoi hai nam 2026')
    expect(result.summary).toBe('freelance_contract')
  })

  it('C1.2 returns error when parties missing freelancer', async () => {
    const call = makeCall('docs.freelance_contract', {
      parties: [{ role: 'client', name: 'ABC Corp', address: 'Ha Noi' }],
      scope: 'Tu van',
      fee: 5000000,
      deadline: '2026-12-01',
    })

    const result = await executeFreelanceTool(call)

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Loi')
    expect(result.output).toContain('freelancer')
  })

  it('C1.3 articles in correct order (Dieu 1 to 10)', async () => {
    const call = makeCall('docs.freelance_contract', {
      parties: [
        { role: 'client', name: 'XYZ JSC', address: 'Ha Noi' },
        { role: 'freelancer', name: 'Tran Thi Lan', address: 'Da Nang' },
      ],
      scope: 'Lap trinh website',
      fee: 30000000,
      deadline: '2026-06-30',
    })

    const result = await executeFreelanceTool(call)

    const idx = (n: string) => result.output.indexOf('Dieu ' + n + '.')
    expect(idx('1')).toBeGreaterThan(-1)
    expect(idx('2')).toBeGreaterThan(idx('1'))
    expect(idx('3')).toBeGreaterThan(idx('2'))
    expect(idx('4')).toBeGreaterThan(idx('3'))
    expect(idx('5')).toBeGreaterThan(idx('4'))
    expect(idx('6')).toBeGreaterThan(idx('5'))
    expect(idx('7')).toBeGreaterThan(idx('6'))
    expect(idx('8')).toBeGreaterThan(idx('7'))
    expect(idx('9')).toBeGreaterThan(idx('8'))
    expect(idx('10')).toBeGreaterThan(idx('9'))
  })

  it('C1.4 Bo luat Dan su article references present', async () => {
    const call = makeCall('docs.freelance_contract', {
      parties: [
        { role: 'client', name: 'ClientCo', address: 'HCM' },
        { role: 'freelancer', name: 'FreelancerCo', address: 'HN' },
      ],
      scope: 'Dich vu tu van',
      fee: 10000000,
      deadline: '2026-09-01',
    })

    const result = await executeFreelanceTool(call)

    expect(result.output).toContain('Bo luat Dan su 2015')
    expect(result.output).toContain('Dieu 601')
    expect(result.output).toContain('Dieu 360')
    expect(result.output).toContain('Dieu 366')
  })
})

// -- C2: nda_template ---------------------------------------------------------

describe('docs.nda_template', () => {
  it('C2.1 returns NDA text with both parties', async () => {
    const call = makeCall('docs.nda_template', {
      partyA: 'Cong ty ABC',
      partyB: 'Nguyen Van X',
      purpose: 'Du an phat trien phan mem',
      duration: 2,
    })

    const result = await executeFreelanceTool(call)

    expect(result.isError).toBeFalsy()
    expect(result.output).toContain('THOA THUAN BAO MAT HAI CHIEU')
    expect(result.output).toContain('Cong ty ABC')
    expect(result.output).toContain('Nguyen Van X')
    expect(result.output).toContain('Du an phat trien phan mem')
    expect(result.summary).toBe('nda_template')
  })

  it('C2.2 returns error when required fields missing', async () => {
    const call = makeCall('docs.nda_template', {
      partyA: 'Cong ty ABC',
      duration: 1,
    })

    const result = await executeFreelanceTool(call)

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Loi')
  })

  it('C2.3 legal references (Bo luat Dan su, Luat SHTT)', async () => {
    const call = makeCall('docs.nda_template', {
      partyA: 'Ben A',
      partyB: 'Ben B',
      purpose: 'Hop tac kinh doanh',
      duration: 3,
    })

    const result = await executeFreelanceTool(call)

    expect(result.output).toContain('Bo luat Dan su 2015')
    expect(result.output).toContain('Luat So huu tri tue')
    expect(result.output).toContain('Dieu 601')
    expect(result.output).toContain('Dieu 4')
  })

  it('C2.4 three-section structure in order', async () => {
    const call = makeCall('docs.nda_template', {
      partyA: 'A Co',
      partyB: 'B Co',
      purpose: 'Trao doi ky thuat',
      duration: 2,
    })

    const result = await executeFreelanceTool(call)

    const idxInfo = result.output.indexOf('THONG TIN CAC BEN')
    const idxScope = result.output.indexOf('PHAM VI BAO MAT')
    const idxDuration = result.output.indexOf('THOI HAN VA CAM KET')

    expect(idxInfo).toBeGreaterThan(-1)
    expect(idxScope).toBeGreaterThan(idxInfo)
    expect(idxDuration).toBeGreaterThan(idxScope)
  })
})

// -- C3: invoice_tracker -------------------------------------------------------

describe('sheets.invoice_tracker', () => {
  it('C3.1 create invoice -- success', async () => {
    __resetInvoiceStore()
    const call = makeCall('sheets.invoice_tracker', {
      action: 'create',
      client: 'KhachHangUniqueC3A',
      amount: 20000000,
    })

    const result = await executeFreelanceTool(call)

    expect(result.isError).toBeFalsy()
    expect(result.output).toContain('Da tao hoa don moi')
    expect(result.output).toContain('KhachHangUniqueC3A')
    expect(result.output).toContain('20.000.000 dong')
    expect(result.output).toContain('Chua thanh toan')
    expect(result.output).toMatch(/Ma hoa don: INV-/)
    expect(result.summary).toBe('invoice_tracker')
  })

  it('C3.2 create -- error when client missing', async () => {
    const call = makeCall('sheets.invoice_tracker', {
      action: 'create',
      amount: 5000000,
    })

    const result = await executeFreelanceTool(call)

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Loi')
    expect(result.output).toContain('client')
  })

  it('C3.3 create -- error on negative amount', async () => {
    const call = makeCall('sheets.invoice_tracker', {
      action: 'create',
      client: 'TestClientUniqueC3',
      amount: -1000,
    })

    const result = await executeFreelanceTool(call)

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Loi')
  })

  it('C3.4 list -- returns valid output format', async () => {
    const call = makeCall('sheets.invoice_tracker', { action: 'list' })
    const result = await executeFreelanceTool(call)
    expect(result.isError).toBeFalsy()
    const hasEntries = result.output.includes('INV-')
    const hasEmptyMsg = result.output.includes('Chua co hoa don')
    expect(hasEntries || hasEmptyMsg).toBe(true)
  })

  it('C3.5 create -> mark_paid -> list -- state persistence', async () => {
    __resetInvoiceStore()

    // Step 1: Create invoice
    const r1 = await executeFreelanceTool(makeCall('sheets.invoice_tracker', {
      action: 'create',
      client: 'KhachHangC35UniqueTestX',
      amount: 15000000,
    }))
    expect(r1.isError).toBeFalsy()

    // Extract the invoice ID from "Ma hoa don: INV-<id>"
    const idLineMatch = r1.output.match(/Ma hoa don: (INV-[^\n]+)/)
    expect(idLineMatch).not.toBeNull()
    const invId = idLineMatch![1].trim()

    // Step 2: Create second invoice
    await executeFreelanceTool(makeCall('sheets.invoice_tracker', {
      action: 'create',
      client: 'KhachHangC35BUniqueY',
      amount: 25000000,
    }))

    // Step 3: List -- both present
    const listResult = await executeFreelanceTool(
      makeCall('sheets.invoice_tracker', { action: 'list' })
    )
    expect(listResult.output).toContain('KhachHangC35UniqueTestX')
    expect(listResult.output).toContain('KhachHangC35BUniqueY')
    expect(listResult.output).toContain('15.000.000 dong')
    expect(listResult.output).toContain('25.000.000 dong')
    expect(listResult.output).toContain('Chua thanh toan')

    // Step 4: Mark first invoice as paid
    const paidResult = await executeFreelanceTool(
      makeCall('sheets.invoice_tracker', { action: 'mark_paid', invoiceId: invId })
    )
    expect(paidResult.isError).toBeFalsy()
    // The mark_paid output starts with "Da danh dau thanh toan cho hoa don <id>."
    expect(paidResult.output.startsWith('Da danh dau thanh toan cho hoa don ' + invId + '.')).toBe(true)

    // Step 5: List -- both still present, first now paid
    const listAfter = await executeFreelanceTool(
      makeCall('sheets.invoice_tracker', { action: 'list' })
    )
    expect(listAfter.output).toContain('KhachHangC35UniqueTestX')
    expect(listAfter.output).toContain('KhachHangC35BUniqueY')
    // Paid invoices show "Da thanh toan" status in list output
    expect(listAfter.output).toContain('Da thanh toan')
  })

  it('C3.6 mark_paid -- error on unknown invoiceId', async () => {
    __resetInvoiceStore()
    const result = await executeFreelanceTool(
      makeCall('sheets.invoice_tracker', { action: 'mark_paid', invoiceId: 'INV-NOTFOUND-1234' })
    )

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Khong tim thay')
  })

  it('C3.7 mark_paid -- error when invoiceId missing', async () => {
    const result = await executeFreelanceTool(
      makeCall('sheets.invoice_tracker', { action: 'mark_paid' })
    )

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Loi')
  })

  it('C3.8 invalid action returns error', async () => {
    const result = await executeFreelanceTool(
      makeCall('sheets.invoice_tracker', { action: 'delete' })
    )

    expect(result.isError).toBe(true)
    expect(result.output).toContain('khong hop le')
  })
})

// -- C4: SKILL.md shape -------------------------------------------------------

describe('freelance_solo SKILL.md', () => {
  it('C4.1 SKILL.md contains required sections and legal references', async () => {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const skillPath = resolve(__dirname, '../../src/bundles/freelance-solo/SKILL.md')
    const fs = await import('node:fs')
    const content = fs.readFileSync(skillPath, 'utf-8')

    expect(content).toContain('name: freelance-invoice-vn')
    expect(content).toContain('## 1. Doi tuong ap dung')
    expect(content).toContain('## 2. Cac loai hoa don')
    expect(content).toContain('## 3. Thue TNCN')
    expect(content).toContain('Bo luat Dan su 2015')
    expect(content).toContain('Dieu 360')
    expect(content).toContain('Nghi dinh 123')
    expect(content).toContain('Luat Thue TNCN')
    expect(content).toContain('Bieu thue luy tien')
    expect(content).toContain('## 5. Quy trinh xuat hoa don')
    expect(content).toContain('## 6. Checklist')
  })
})

// -- C5: Unknown tool ---------------------------------------------------------

describe('unknown tool', () => {
  it('C5.1 returns error for unknown tool name', async () => {
    const result = await executeFreelanceTool(makeCall('docs.unknown_tool', { foo: 'bar' }))

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Unknown tool')
  })
})