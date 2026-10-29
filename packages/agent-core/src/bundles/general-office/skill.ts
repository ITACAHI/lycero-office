/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 *
 * Phase B.3: general_office bundle AgentSkill — wires the 3 local tools
 * (docs.format_vn_currency, docs.insert_table, slides.theme_warm) into the
 * agent loop. Cloud skills: none (empty array).
 */

import type { AgentSkill } from '../../skill'
import type { AgentToolCall } from '../../types'
import type { ToolExecution } from '../../types'
import { WORK_BUNDLES } from '@lycero/ai-auth'
import {
  executeGeneralOfficeTool,
  type GeneralOfficeToolName,
} from './tools'

/**
 * Tool definitions as registered in the WorkBundle registry (used for LLM
 * function-calling schema). Keep in sync with WORK_BUNDLES[0].tools.
 */
const TOOL_DEFS: Array<{
  name: string
  description: string
  inputSchema: Record<string, unknown>
}> = [
  {
    name: 'docs.format_vn_currency',
    description: 'Định dạng số tiền VNĐ chuẩn Việt Nam (1.234.567 đ)',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Số tiền cần định dạng' },
        unit: {
          type: 'string',
          enum: ['VND', 'billion', 'million'],
          description: "Đơn vị: 'VND' (mặc định) | 'billion' | 'million'",
          default: 'VND',
        },
      },
      required: ['amount'],
    },
  },
  {
    name: 'docs.insert_table',
    description: 'Chèn bảng biểu vào tài liệu với định dạng chuẩn (markdown)',
    inputSchema: {
      type: 'object',
      properties: {
        rows: { type: 'number', description: 'Số dòng dữ liệu (không tính header)' },
        cols: { type: 'number', description: 'Số cột' },
        headers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tên các cột (tùy chọn, mặc định: Cột 1, Cột 2...)',
        },
        data: {
          type: 'array',
          items: { type: 'array', items: { type: 'string' } },
          description: 'Dữ liệu bảng theo dòng (tùy chọn)',
        },
      },
      required: ['rows', 'cols'],
    },
  },
  {
    name: 'slides.theme_warm',
    description: 'Áp dụng theme màu ấm cho slide trình chiếu (tokens, không phải hex)',
    inputSchema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          enum: ['docs', 'slides', 'sheets'],
          description: 'Ứng dụng áp dụng theme',
          default: 'slides',
        },
      },
      required: ['app'],
    },
  },
]

/**
 * general_office AgentSkill.
 * This bundle is required (always-on) and provides basic office tools.
 */
export const generalOfficeSkill: AgentSkill = {
  id: 'general_office',
  slug: undefined,
  systemPrompt: `## general_office — Văn phòng tổng hợp (mặc định)

Bạn là trợ lý AI cho công việc văn phòng tổng hợp.

**Công cụ sẵn có:**
- docs.format_vn_currency: Định dạng số tiền VNĐ theo chuẩn Việt Nam (1.234.567 đ).
  Dùng khi user cần hiển thị số tiền rõ ràng trong hợp đồng, báo cáo, hóa đơn.
- docs.insert_table: Chèn bảng biểu markdown chuẩn vào tài liệu.
  Dùng khi user cần tạo bảng biểu nhanh (lịch, so sánh, thống kê).
- slides.theme_warm: Trả về spec theme màu ấm (Astryx tokens) cho slide/docs/sheets.
  Dùng khi user muốn chuyển giao diện sang tông màu ấm (Terracotta).`,

  tools: TOOL_DEFS.map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
  })),

  executeTool(call: AgentToolCall, signal?: AbortSignal): ToolExecution {
    const name = call.name as GeneralOfficeToolName

    if (!TOOL_DEFS.some((t) => t.name === name)) {
      return {
        output: `Unknown tool: ${name}`,
        isError: true,
        summary: call.name,
      }
    }

    const result = executeGeneralOfficeTool(name, call.input)
    return {
      output: result.output,
      isError: result.isError,
      summary: result.summary,
    }
  },
}

/** Convenience: the WorkBundle for general_office (id=0). */
export const GENERAL_OFFICE_BUNDLE = WORK_BUNDLES.find((b) => b.key === 'general_office')!
