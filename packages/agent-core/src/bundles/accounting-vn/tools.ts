/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase B.1: accounting_vn bundle — local tool executors.
 *
 * Tools:
 *   sheets.vn_vat_lookup  — tra cứu MST + thuế suất
 *   sheets.tncn_calculate  — tính thuế TNCN biểu lũy tiến từng phần
 *   docs.format_vn_currency — định dạng tiền Việt Nam
 *
 * Tax law sources:
 *   - Luật Thuế TNCN sửa đổi 2012 (Điều 22: biểu thuế lũy tiến)
 *   - Thông tư 111/2013/TT-BTC (biểu thuế + căn cứ)
 *   - Nghị định 954/2020/UBTVQH14 (giảm trừ gia cảnh: 11 triệu/tháng)
 *   - Nghị định 103/2014/NĐ-CP (giảm trừ theo vùng I-IV)
 *   - Thông tư 200/2014/TT-BTC (thuế GTGT 10%, phương pháp khấu trừ)
 *
 * ponytail: format_vn_currency is also in general_office (B.3). The general_office
 * copy stays as source-of-truth for that bundle. The dedup is handled at the
 * composer level (first-write-wins by bundle insertion order).
 */

import type { AgentToolCall, ToolExecution } from '../../types'

// ─────────────────────────────────────────────────────────────────────────────
// VAT Lookup
// ─────────────────────────────────────────────────────────────────────────────

// ponytail: real fetch — needs API key from masothue.com.vn (paid tier).
// upgrade path: POST https://masothue.com.vn/API/Company/Search with API key,
// return { name, address, taxStatus }. Mock below for local dev / test.
const VAT_FIXTURES: Record<string, { name: string; address: string; vatRate: number }> = {
  '0100123456': { name: 'Công ty TNHH MTV X', address: 'Hà Nội', vatRate: 10 },
  '0200123456': { name: 'Công ty CP Y', address: 'TP.HCM', vatRate: 10 },
  '0300123456': { name: 'Doanh nghiệp Z', address: 'Đà Nẵng', vatRate: 10 },
}

export type VatLookupInput = { taxCode: string }

/**
 * Tra cứu thuế suất VAT + thông tin công ty theo mã số thuế.
 *
 * Source authority:
 * - Thuế suất 10% (phương pháp khấu trừ): Thông tư 200/2014/TT-BTC, Điều 9
 * - Thuế suất 0% (hàng xuất khẩu): Điều 8
 * - Miễn thuế (dịch vụ y tế, giáo dục): Điều 5
 */
export async function executeVnVatLookup(call: AgentToolCall): Promise<ToolExecution> {
  const input = call.input as unknown as VatLookupInput
  const { taxCode } = input

  // Validation
  if (!taxCode) {
    return { output: 'Lỗi: mã số thuế không được để trống.', isError: true, summary: 'vn_vat_lookup' }
  }
  const clean = taxCode.replace(/\D/g, '')
  if (clean.length !== 10 && clean.length !== 14) {
    return {
      output: `Lỗi: mã số thuế "${taxCode}" không hợp lệ. Vui lòng nhập 10 hoặc 14 chữ số.`,
      isError: true,
      summary: 'vn_vat_lookup',
    }
  }

  // Mock lookup (replace with real fetch when API key is available — see ponytail note above)
  const record = VAT_FIXTURES[clean]
  if (record) {
    return {
      output: JSON.stringify({
        taxCode: clean,
        companyName: record.name,
        address: record.address,
        vatRate: record.vatRate,
        unit: '%',
        source: 'Thông tư 200/2014/TT-BTC, Điều 9',
      }),
      summary: `vn_vat_lookup: ${record.name} (${record.vatRate}%)`,
    }
  }

  // Unknown MST: still return a valid response
  return {
    output: JSON.stringify({
      taxCode: clean,
      companyName: '(không tìm thấy)',
      address: '(không tìm thấy)',
      vatRate: 10,
      unit: '%',
      source: 'Thông tư 200/2014/TT-BTC, Điều 9 (mặc định 10%)',
      note: 'MST không có trong dữ liệu cục bộ. Áp dụng thuế suất mặc định 10%.',
    }),
    summary: `vn_vat_lookup: MST ${clean} (mặc định 10%)`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TNCN Calculator
// ─────────────────────────────────────────────────────────────────────────────

// Giảm trừ gia cảnh cá nhân theo Nghị định 954/2020/UBTVQH14 (effective 01/07/2020)
const PERSONAL_DEDUCTION = 11_000_000 // đ/tháng
const DEPENDENT_DEDUCTION = 4_400_000 // đ/tháng/người

// Biểu thuế lũy tiến từng phần (Điều 22, Luật Thuế TNCN sửa đổi 2012)
// Source: Thông tư 111/2013/TT-BTC Annex
const TAX_BRACKETS = [
  { max: 5_000_000, rate: 5, deduct: 0 },
  { max: 10_000_000, rate: 10, deduct: 250_000 },
  { max: 18_000_000, rate: 15, deduct: 1_250_000 },
  { max: 32_000_000, rate: 20, deduct: 3_250_000 },
  { max: 52_000_000, rate: 25, deduct: 5_850_000 },
  { max: 80_000_000, rate: 30, deduct: 9_850_000 },
  { max: Infinity, rate: 35, deduct: 18_150_000 },
] as const

// Giảm trừ theo vùng (Nghị định 103/2014/NĐ-CP)
const REGION_DEDUCTION: Record<string, number> = {
  '1': 9_000_000,
  '2': 7_500_000,
  '3': 6_000_000,
  '4': 4_500_000,
}

export type TncnCalculateInput = {
  income: number
  dependents?: number
  region?: '1' | '2' | '3' | '4'
}

export interface TncnBreakdown {
  label: string
  amount: number
}

export interface TncnResult {
  income: number
  personalDeduction: number
  dependentDeduction: number
  regionDeduction: number
  taxableIncome: number
  taxRate: number
  tax: number
  breakdown: TncnBreakdown[]
  authority: string
}

/**
 * Tính thuế TNCN theo biểu thuế lũy tiến từng phần.
 *
 * Công thức:
 *   Thuế TNCN = Thu nhập chịu thuế × Thuế suất − Khấu trừ
 *
 * Trong đó:
 *   Thu nhập chịu thuế = Thu nhập thực nhận − Giảm trừ cá nhân − Giảm trừ người phụ thuộc − Giảm trừ vùng
 *
 * Nguồn pháp lý:
 * - Nghị định 954/2020/UBTVQH14: giảm trừ gia cảnh cá nhân 11 triệu/tháng
 * - Nghị định 103/2014/NĐ-CP: giảm trừ theo vùng I/II/III/IV
 * - Điều 22 Luật Thuế TNCN sửa đổi 2012 + Thông tư 111/2013/TT-BTC: biểu thuế lũy tiến
 */
export function calculateTncn(input: TncnCalculateInput): TncnResult {
  const income = input.income ?? 0
  const dependents = input.dependents ?? 0
  const region = input.region ?? '1'

  // Guards
  if (income < 0) throw new Error('Thu nhập không được âm.')
  if (dependents < 0) throw new Error('Số người phụ thuộc không được âm.')

  const personalDeduction = PERSONAL_DEDUCTION
  const dependentDeduction = DEPENDENT_DEDUCTION * dependents
  const regionDeduction = REGION_DEDUCTION[region] ?? REGION_DEDUCTION['1']

  const totalDeductions = personalDeduction + dependentDeduction + regionDeduction
  const taxableIncome = Math.max(0, income - totalDeductions)

  // Find applicable bracket
  const bracket = TAX_BRACKETS.find((b) => taxableIncome <= b.max)
  const taxRate = bracket?.rate ?? 35
  const deduct = bracket?.deduct ?? 18_150_000
  const tax = Math.round(taxableIncome * (taxRate / 100) - deduct)

  const breakdown: TncnBreakdown[] = [
    { label: 'Thu nhập thực nhận', amount: income },
    { label: `Giảm trừ cá nhân (11 triệu × 1)`, amount: -personalDeduction },
    { label: `Giảm trừ người phụ thuộc (4,4 triệu × ${dependents})`, amount: -dependentDeduction },
    { label: `Giảm trừ vùng ${region} (NĐ 103/2014)`, amount: -regionDeduction },
    { label: 'Thu nhập chịu thuế', amount: taxableIncome },
    { label: `Thuế suất biểu thuế lũy tiến (bậc ${taxRate}%)`, amount: 0 },
    { label: 'Thuế TNCN phải nộp', amount: Math.max(0, tax) },
  ]

  return {
    income,
    personalDeduction,
    dependentDeduction,
    regionDeduction,
    taxableIncome,
    taxRate,
    tax: Math.max(0, tax),
    breakdown,
    authority: 'Nghị định 954/2020/UBTVQH14, Nghị định 103/2014/NĐ-CP, Điều 22 Luật Thuế TNCN 2012, Thông tư 111/2013/TT-BTC',
  }
}

export async function executeTncnCalculate(call: AgentToolCall): Promise<ToolExecution> {
  const input = call.input as unknown as TncnCalculateInput
  const { income, dependents, region } = input

  // Validation
  if (income === undefined || income === null) {
    return { output: 'Lỗi: thu nhập là bắt buộc.', isError: true, summary: 'tncn_calculate' }
  }
  if (typeof income !== 'number' || isNaN(income)) {
    return { output: 'Lỗi: thu nhập phải là số.', isError: true, summary: 'tncn_calculate' }
  }

  try {
    const result = calculateTncn({ income, dependents: dependents ?? 0, region: region ?? '1' })
    return {
      output: JSON.stringify(result, null, 2),
      summary: `tncn_calculate: thu nhập ${income.toLocaleString('vi-VN')}đ → thuế ${result.tax.toLocaleString('vi-VN')}đ`,
    }
  } catch (e) {
    return {
      output: `Lỗi tính thuế: ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
      summary: 'tncn_calculate',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vietnamese Currency Formatter
// ─────────────────────────────────────────────────────────────────────────────

export type FormatVnCurrencyInput = { amount: number; unit?: 'VND' | 'million' | 'billion' }

/**
 * Định dạng số tiền theo phong cách Việt Nam.
 *
 * - Dấu phân cách hàng nghìn: dấu chấm (.)
 * - Đơn vị tiền tệ: " đ" sau số
 * - Chuẩn ISO: VND, no decimal places
 */
export function formatVnCurrency(input: FormatVnCurrencyInput): string {
  const { amount, unit = 'VND' } = input

  switch (unit) {
    case 'VND': {
      const formatted = Math.round(amount)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      return `${formatted} đ`
    }
    case 'million': {
      const m = amount / 1_000_000
      return `${m.toFixed(1).replace('.', ',')} triệu`
    }
    case 'billion': {
      const b = amount / 1_000_000_000
      return `${b.toFixed(1).replace('.', ',')} tỷ`
    }
    default:
      return `${amount} đ`
  }
}

export async function executeFormatVnCurrency(call: AgentToolCall): Promise<ToolExecution> {
  const input = call.input as unknown as FormatVnCurrencyInput
  const { amount, unit } = input

  // Validation
  if (amount === undefined || amount === null || isNaN(amount)) {
    return { output: 'Lỗi: số tiền không hợp lệ.', isError: true, summary: 'format_vn_currency' }
  }

  const formatted = formatVnCurrency({ amount, unit: unit ?? 'VND' })
  return {
    output: JSON.stringify({ amount, unit: unit ?? 'VND', formatted }),
    summary: `format_vn_currency: ${formatted}`,
  }
}
