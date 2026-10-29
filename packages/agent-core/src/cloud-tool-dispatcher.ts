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
 * Creates an AgentSkill that routes cloud-defined tools through the Cloud Proxy Dispatcher.
 */
export function createCloudProxySkill(options: {
  id?: string
  skills?: CloudSkillManifest[]
  endpoints?: CloudMcpEndpoint[]
  dispatcher: CloudToolDispatcher
}): AgentSkill {
  const toolToServerMap = new Map<string, string>()
  const tools: AgentToolDef[] = []

  if (options.skills) {
    for (const skill of options.skills) {
      if (!skill.tools) continue
      for (const t of skill.tools) {
        toolToServerMap.set(t.name, skill.slug)
        tools.push({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })
      }
    }
  }

  if (options.endpoints) {
    for (const ep of options.endpoints) {
      for (const t of ep.tools) {
        toolToServerMap.set(t.name, ep.serverKey)
        tools.push({
          name: t.name,
          description: t.description || `Công cụ kết nối: ${ep.name}`,
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        })
      }
    }
  }

  return {
    id: options.id || 'lycero-cloud-proxy',
    systemPrompt: '', // Opaque Manifest: Prompts are managed entirely on the Cloud Gateway
    tools,
    buildContext: () => {
      if (tools.length === 0) return ''
      return `[Cổng Công cụ Đám mây Lycero: ${tools.length} công cụ sẵn sàng]`
    },
    executeTool: async (call: AgentToolCall, signal?: AbortSignal): Promise<ToolExecution> => {
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
