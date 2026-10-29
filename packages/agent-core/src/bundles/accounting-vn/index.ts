/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase B.1: accounting_vn bundle AgentSkill — wires 3 local tools and 2 cloud
 * skills into the agent loop.
 *
 * Tools:
 *   sheets.vn_vat_lookup  — tra cứu MST + thuế suất (Thông tư 200/2014/TT-BTC)
 *   sheets.tncn_calculate  — tính thuế TNCN biểu lũy tiến từng phần
 *   docs.format_vn_currency — định dạng tiền Việt Nam
 *
 * Cloud skills:
 *   vn-tax-tt200           — Thông tư 200/2014/TT-BTC (VAS, BCTC, GTGT)
 *   vn-mtt-201-balance     — Mẫu B 02–2016/QĐ-BTC (Bảng cân đối kế toán)
 *
 * Tax law sources:
 *   - Luật Thuế TNCN sửa đổi 2012 (Điều 22: biểu thuế lũy tiến)
 *   - Thông tư 111/2013/TT-BTC (biểu thuế + căn cứ)
 *   - Nghị định 954/2020/UBTVQH14 (giảm trừ gia cảnh: 11 triệu/tháng)
 *   - Nghị định 103/2014/NĐ-CP (giảm trừ theo vùng I-IV)
 *   - Thông tư 200/2014/TT-BTC (chế độ kế toán doanh nghiệp)
 *   - Quyết định 48/2006/QĐ-BTC + Thông tư 53/2016/TT-BTC (BCTC mẫu)
 */

import type { AgentSkill } from '../../skill'
import type { AgentToolCall, ToolExecution } from '../../types'
import {
  executeVnVatLookup,
  executeTncnCalculate,
  executeFormatVnCurrency,
} from './tools'
import { ACCOUNTING_VN_SKILLS } from './skills'

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions (kept in sync with WORK_BUNDLES[1] in work-bundles.ts)
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_DEFS: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> = [
  {
    name: 'sheets.vn_vat_lookup',
    description: 'Tra cứu thuế suất VAT theo mã số thuế (MST). Trả về tên công ty, địa chỉ, thuế suất (%) và căn cứ pháp lý Thông tư 200/2014/TT-BTC.',
    inputSchema: {
      type: 'object',
      properties: {
        taxCode: {
          type: 'string',
          description: 'Mã số thuế 10 hoặc 14 chữ số (không dấu cách)',
        },
      },
      required: ['taxCode'],
    },
  },
  {
    name: 'sheets.tncn_calculate',
    description: 'Tính thuế TNCN theo biểu thuế lũy tiến từng phần. Tự động trừ giảm trừ gia cảnh (NĐ 954/2020), người phụ thuộc, và giảm trừ theo vùng (NĐ 103/2014).',
    inputSchema: {
      type: 'object',
      properties: {
        income: {
          type: 'number',
          description: 'Tổng thu nhập chịu thuế 1 tháng (VND)',
          minimum: 0,
        },
        dependents: {
          type: 'number',
          description: 'Số người phụ thuộc (mặc định: 0)',
          default: 0,
          minimum: 0,
        },
        region: {
          type: 'string',
          description: 'Vùng I/II/III/IV theo Nghị định 103/2014/NĐ-CP (mặc định: "1")',
          enum: ['1', '2', '3', '4'],
          default: '1',
        },
      },
      required: ['income'],
    },
  },
  {
    name: 'docs.format_vn_currency',
    description: 'Định dạng số tiền theo phong cách Việt Nam: VND (1.234.567 đ), triệu (1,23 triệu), tỷ (0,5 tỷ).',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Số tiền cần định dạng (VND)',
        },
        unit: {
          type: 'string',
          description: 'Đơn vị: "VND" (mặc định), "million", "billion"',
          enum: ['VND', 'million', 'billion'],
          default: 'VND',
        },
      },
      required: ['amount'],
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `## Kế toán Việt Nam — accounting_vn

Bạn là trợ lý AI chuyên về kế toán Việt Nam trong Lycero Office.
Khi người dùng hỏi về thuế VAT, thuế TNCN, báo cáo tài chính, hóa đơn, hoặc bảng cân đối kế toán, hãy dùng các tool có sẵn.

### Tool có sẵn

- **sheets.vn_vat_lookup**: Tra cứu thuế suất VAT theo mã số thuế (MST).
  Dùng khi người dùng cần biết thuế suất của một công ty hoặc mã HS hàng hóa.
  Luôn trích dẫn căn cứ: Thông tư 200/2014/TT-BTC, Điều 9.

- **sheets.tncn_calculate**: Tính thuế TNCN theo biểu thuế lũy tiến từng phần.
  Áp dụng giảm trừ gia cảnh theo Nghị định 954/2020/UBTVQH14 (11 triệu/tháng)
  và giảm trừ vùng theo Nghị định 103/2014/NĐ-CP.

- **docs.format_vn_currency**: Định dạng số tiền chuẩn Việt Nam.
  Dùng cho mọi số tiền trong tài liệu kế toán: "500.000.000 đ".

### Nguyên tắc sư phạm

1. Mọi số liệu thuế phải kèm căn cứ pháp lý đầy đủ (số điều, thông tư, nghị định).
2. Công thức tính phải được trình bày rõ ràng để giáo viên/học sinh hiểu.
3. Mẫu BCTC theo đúng Mẫu B 02–2016/QĐ-BTC (Bảng cân đối kế toán).
4. Thuế suất mặc định: 10% (hàng hóa thông thường, Thông tư 200).
5. Thuế suất 0%: chỉ áp dụng hàng xuất khẩu, theo Điều 8 Thông tư 200.

### Thuật ngữ kế toán chuẩn

| Thuật ngữ | Giải nghĩa |
|---|---|
| Thuế GTGT | Thuế giá trị gia tăng (VAT) |
| TNCN | Thu nhập cá nhân |
| BCTC | Báo cáo tài chính |
| MST | Mã số thuế |
| BCĐKT | Bảng cân đối kế toán |
| VAS | Chuẩn mực kế toán Việt Nam |
| TSCĐ | Tài sản cố định |

Các cloud skill vn-tax-tt200 và vn-mtt-201-balance được tải tự động khi bundle accounting_vn được kích hoạt.`

// ─────────────────────────────────────────────────────────────────────────────
// AgentSkill
// ─────────────────────────────────────────────────────────────────────────────

export const accountingVnSkill: AgentSkill = {
  id: 'accounting_vn',
  slug: 'accounting_vn',
  systemPrompt: SYSTEM_PROMPT,
  tools: TOOL_DEFS.map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
  })),
  executeTool(call: AgentToolCall, _signal?: AbortSignal): ToolExecution | Promise<ToolExecution> {
    if (!TOOL_DEFS.some((t) => t.name === call.name)) {
      return {
        output: `Unknown tool: ${call.name}`,
        isError: true,
        summary: call.name,
      }
    }
    switch (call.name) {
      case 'sheets.vn_vat_lookup':
        return executeVnVatLookup(call)
      case 'sheets.tncn_calculate':
        return executeTncnCalculate(call)
      case 'docs.format_vn_currency':
        return executeFormatVnCurrency(call)
      default:
        return { output: `Unknown tool: ${call.name}`, isError: true, summary: call.name }
    }
  },
}

// Re-export skills for the bundle registry
export { ACCOUNTING_VN_SKILLS }
