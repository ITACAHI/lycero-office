/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import type { AgentSkill } from './skill'
import type { AgentToolCall, AgentToolDef, ToolExecution } from './types'

export interface McpToolItem {
  serverName?: string
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface McpSkillOptions {
  /** Return live MCP tools available from configured servers */
  getTools: () => McpToolItem[] | Promise<McpToolItem[]>
  /** Execute an MCP tool call */
  executeTool: (
    toolName: string,
    args: Record<string, unknown>,
    serverName?: string,
  ) => Promise<{
    content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>
    isError?: boolean
    error?: string
  }>
  /** Optional server list status */
  getActiveServers?: () => string[]
}

const MCP_SYSTEM_PROMPT = `## Model Context Protocol (MCP) Tools
You have access to dynamic external tools provided by connected Model Context Protocol (MCP) servers.
- Use these tools to interact with local directories, run external scripts, query databases, or access specialized services configured by the user.
- Adhere strictly to the input schema parameters for each tool.
- If a tool fails with an error, inspect the message and adjust arguments before retrying.`

export function createMcpSkill(options: McpSkillOptions): AgentSkill {
  let cachedTools: AgentToolDef[] = []

  return {
    id: 'mcp-clients',
    systemPrompt: MCP_SYSTEM_PROMPT,
    get tools(): AgentToolDef[] {
      const raw = options.getTools()
      if (Array.isArray(raw)) {
        cachedTools = raw.map((t) => ({
          name: t.name,
          description: t.description || `MCP tool from ${t.serverName || 'server'}`,
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        }))
      }
      return cachedTools
    },
    buildContext: () => {
      const servers = options.getActiveServers?.() ?? []
      if (servers.length === 0 && cachedTools.length === 0) return ''
      return `[Connected MCP Servers: ${servers.join(', ') || 'Active'} | ${cachedTools.length} tools available]`
    },
    executeTool: async (call: AgentToolCall): Promise<ToolExecution> => {
      try {
        const rawTools = options.getTools()
        const toolsList = Array.isArray(rawTools) ? rawTools : cachedTools
        const matched = (toolsList as McpToolItem[]).find((t) => t.name === call.name)
        const serverName = matched?.serverName

        const result = await options.executeTool(call.name, call.input, serverName)

        if (result.error) {
          return {
            output: `Error executing MCP tool "${call.name}": ${result.error}`,
            isError: true,
            summary: `MCP error: ${call.name}`,
          }
        }

        const textChunks: string[] = []
        if (result.content && Array.isArray(result.content)) {
          for (const item of result.content) {
            if (item.text) {
              textChunks.push(item.text)
            } else if (item.data) {
              textChunks.push(`[Binary Data: ${item.mimeType || 'unknown'}]`)
            }
          }
        }

        const output = textChunks.join('\n') || (result.isError ? 'Tool execution failed' : 'Execution succeeded.')

        return {
          output,
          isError: result.isError ?? false,
          summary: `MCP: ${call.name}`,
        }
      } catch (err) {
        return {
          output: `Exception executing MCP tool "${call.name}": ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
          summary: `MCP error: ${call.name}`,
        }
      }
    },
  }
}
