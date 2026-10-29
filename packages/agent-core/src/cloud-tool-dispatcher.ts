/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import type { AgentSkill } from './skill'
import type { AgentToolCall, AgentToolDef, ToolExecution } from './types'
import type { CloudMcpEndpoint, CloudSkillManifest } from './cloud-capabilities'

export const DEFAULT_TOOL_DISPATCHER_URL = 'https://lycero.com/api/v1/office/desktop/tools/execute'

export interface CloudToolExecuteRequest {
  serverKey: string
  toolName: string
  arguments: Record<string, unknown>
}

export interface CloudToolExecuteResponse {
  ok: boolean
  result?: unknown
  error?: string
}

export interface CloudToolDispatcherOptions {
  gatewayUrl?: string | undefined
  getAccessToken?: (() => string | null | undefined) | undefined
}

export class CloudToolDispatcher {
  private gatewayUrl: string
  private getAccessToken?: (() => string | null | undefined) | undefined

  constructor(options?: CloudToolDispatcherOptions) {
    this.gatewayUrl = options?.gatewayUrl ?? DEFAULT_TOOL_DISPATCHER_URL
    this.getAccessToken = options?.getAccessToken
  }

  public async executeTool(
    req: CloudToolExecuteRequest,
    signal?: AbortSignal,
  ): Promise<ToolExecution> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }

      const token = this.getAccessToken?.()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const reqInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
      }
      if (signal) {
        reqInit.signal = signal
      }

      const res = await fetch(this.gatewayUrl, reqInit)

      if (!res.ok) {
        return {
          output: 'Không thể kết nối tới dịch vụ xử lý công cụ trên Cổng Trí tuệ Lycero.',
          isError: true,
          summary: `Lỗi công cụ: ${req.toolName}`,
        }
      }

      const data = (await res.json()) as CloudToolExecuteResponse
      if (!data.ok || data.error) {
        return {
          output: data.error || 'Thao tác xử lý công cụ không thành công.',
          isError: true,
          summary: `Lỗi công cụ: ${req.toolName}`,
        }
      }

      const stringified =
        typeof data.result === 'string'
          ? data.result
          : JSON.stringify(data.result, null, 2)

      return {
        output: stringified || 'Thực thi thành công.',
        isError: false,
        summary: `Đã thực thi: ${req.toolName}`,
      }
    } catch (err) {
      if (signal?.aborted) {
        return {
          output: 'Đã hủy thao tác thực thi công cụ.',
          isError: true,
          summary: `Đã hủy: ${req.toolName}`,
        }
      }
      return {
        output: 'Không thể hoàn thành thao tác xử lý công cụ trên hệ thống đám mây.',
        isError: true,
        summary: `Lỗi kết nối: ${req.toolName}`,
      }
    }
  }
}

/**
 * Local editor tools that always take precedence over Cloud Proxy tools so
 * `composeSkills(...)` never hits a duplicate tool name collision.
 */
export const LOCAL_EDITOR_TOOL_NAMES: ReadonlySet<string> = new Set([
  // Docs local tools
  'write_document',
  'replace_blocks',
  'insert_blocks',
  'delete_blocks',
  'format_blocks',
  'read_document',
  'search_document',
  'read_blocks',
  'find_replace',
  'format_text',
  'insert_table',
  'edit_table',
  'add_comment',
  'reply_comment',
  'resolve_comment',
  'read_comments',
  'set_header_footer',
  'set_page_setup',
  'insert_section_break',
  'define_style',
  'apply_style',
  'set_watermark',
  'insert_footnote',
  'insert_endnote',
  'delete_note',
  'read_notes',
  'build_mindmap',
  // Slides local tools
  'propose_operations',
  'generate_deck',
  'inspect_slide',
  'edit_slide',
  'apply_slide_ops',
  'regenerate_slide',
  'ask_clarification',
  'save_style_template',
  'list_style_templates',
  'load_style_template',
  // Sheets local tools
  'read_sheet',
  'write_cells',
  'set_formula',
  'format_cells',
  'insert_rows_cols',
  'delete_rows_cols',
  // Shared attachments / KB / CLI / Media tools
  'read_attachment',
  'list_attachments',
  'create_document',
  'run_cli',
  'load_guide',
  'run_genoffice',
  'web_search',
  'image_search',
  'generate_image',
  'analyze_media',
  'kb_list',
  'kb_search',
  'kb_read',
])

/**
 * Creates an AgentSkill that routes cloud-defined tools through the Cloud Proxy Dispatcher.
 * Deduplicates against local editor tools so local tools always take precedence.
 */
export function createCloudProxySkill(options: {
  id?: string
  skills?: CloudSkillManifest[] | (() => CloudSkillManifest[])
  endpoints?: CloudMcpEndpoint[] | (() => CloudMcpEndpoint[])
  excludeToolNames?: Iterable<string> | (() => Iterable<string>)
  dispatcher: CloudToolDispatcher
}): AgentSkill {
  const resolveSkills = (): CloudSkillManifest[] =>
    typeof options.skills === 'function' ? options.skills() : (options.skills ?? [])
  const resolveEndpoints = (): CloudMcpEndpoint[] =>
    typeof options.endpoints === 'function' ? options.endpoints() : (options.endpoints ?? [])
  const resolveExcluded = (): Set<string> => {
    const excluded = new Set<string>(LOCAL_EDITOR_TOOL_NAMES)
    const extra =
      typeof options.excludeToolNames === 'function'
        ? options.excludeToolNames()
        : options.excludeToolNames
    if (extra) {
      for (const name of extra) excluded.add(name)
    }
    return excluded
  }

  const buildCatalog = (): {
    tools: AgentToolDef[]
    toolToServerMap: Map<string, string>
  } => {
    const excluded = resolveExcluded()
    const seen = new Set<string>()
    const toolToServerMap = new Map<string, string>()
    const tools: AgentToolDef[] = []

    for (const skill of resolveSkills()) {
      if (!skill.tools) continue
      for (const t of skill.tools) {
        if (!t?.name || excluded.has(t.name) || seen.has(t.name)) continue
        seen.add(t.name)
        toolToServerMap.set(t.name, skill.slug)
        tools.push({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        })
      }
    }

    for (const ep of resolveEndpoints()) {
      if (!ep?.tools) continue
      for (const t of ep.tools) {
        if (!t?.name || excluded.has(t.name) || seen.has(t.name)) continue
        seen.add(t.name)
        toolToServerMap.set(t.name, ep.serverKey)
        tools.push({
          name: t.name,
          description: t.description || `Công cụ kết nối: ${ep.name}`,
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        })
      }
    }

    return { tools, toolToServerMap }
  }

  return {
    id: options.id || 'lycero-cloud-proxy',
    systemPrompt: '', // Opaque Manifest: Prompts are managed entirely on the Cloud Gateway
    get tools() {
      return buildCatalog().tools
    },
    buildContext: () => {
      const { tools } = buildCatalog()
      if (tools.length === 0) return ''
      return `[Cổng Công cụ Đám mây Lycero: ${tools.length} công cụ sẵn sàng]`
    },
    executeTool: async (call: AgentToolCall, signal?: AbortSignal): Promise<ToolExecution> => {
      const { toolToServerMap } = buildCatalog()
      const serverKey = toolToServerMap.get(call.name) || 'default'
      return options.dispatcher.executeTool(
        {
          serverKey,
          toolName: call.name,
          arguments: call.input,
        },
        signal,
      )
    },
  }
}
