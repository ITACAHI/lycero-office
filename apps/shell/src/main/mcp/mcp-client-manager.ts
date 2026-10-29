/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export interface McpServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  disabled?: boolean
}

export interface McpClientsConfig {
  mcpServers: Record<string, McpServerConfig>
}

export interface McpDiscoveredTool {
  serverName: string
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface McpClientServerStatus {
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  transport: 'stdio' | 'sse'
  error?: string
  toolsCount: number
  tools: McpDiscoveredTool[]
}

const DEFAULT_MCP_CONFIG: McpClientsConfig = {
  mcpServers: {
    // Example pre-configured template (disabled by default)
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', join(app.getPath('documents'))],
      disabled: true,
    },
  },
}

export class McpClientManager {
  private configPath: string
  private activeProcesses = new Map<string, ChildProcess>()
  private discoveredTools = new Map<string, McpDiscoveredTool[]>()
  private serverStatuses = new Map<string, McpClientServerStatus>()

  constructor() {
    this.configPath = join(app.getPath('userData'), 'lycero_mcp_config.json')
    this.ensureConfigFile()
  }

  public getConfigPath(): string {
    return this.configPath
  }

  private ensureConfigFile(): void {
    if (!existsSync(this.configPath)) {
      try {
        writeFileSync(this.configPath, JSON.stringify(DEFAULT_MCP_CONFIG, null, 2), 'utf-8')
      } catch (err) {
        console.error('[MCP-Client] Failed to create initial config file:', err)
      }
    }
  }

  public readConfig(): McpClientsConfig {
    this.ensureConfigFile()
    try {
      const content = readFileSync(this.configPath, 'utf-8')
      const parsed = JSON.parse(content) as McpClientsConfig
      return parsed.mcpServers ? parsed : { mcpServers: {} }
    } catch (err) {
      console.error('[MCP-Client] Failed to parse config file:', err)
      return { mcpServers: {} }
    }
  }

  public saveConfig(config: McpClientsConfig): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
    } catch (err) {
      console.error('[MCP-Client] Failed to save config file:', err)
      throw err
    }
  }

  public getAllDiscoveredTools(): McpDiscoveredTool[] {
    const all: McpDiscoveredTool[] = []
    for (const tools of this.discoveredTools.values()) {
      all.push(...tools)
    }
    return all
  }

  public async getServersStatus(): Promise<McpClientServerStatus[]> {
    const config = this.readConfig()
    const statuses: McpClientServerStatus[] = []

    for (const [name, server] of Object.entries(config.mcpServers)) {
      const isSse = Boolean(server.url)
      const cached = this.serverStatuses.get(name)

      if (server.disabled) {
        statuses.push({
          name,
          status: 'disconnected',
          transport: isSse ? 'sse' : 'stdio',
          toolsCount: 0,
          tools: [],
        })
        continue
      }

      if (cached) {
        statuses.push(cached)
      } else {
        statuses.push({
          name,
          status: 'disconnected',
          transport: isSse ? 'sse' : 'stdio',
          toolsCount: 0,
          tools: [],
        })
      }
    }

    return statuses
  }

  public async testServer(
    name: string,
  ): Promise<{ success: boolean; message: string; tools: McpDiscoveredTool[] }> {
    const config = this.readConfig()
    const server = config.mcpServers[name]
    if (!server) {
      return { success: false, message: `Server ${name} not found in config`, tools: [] }
    }

    if (server.url) {
      // Test SSE / HTTP server
      return this.testSseServer(name, server)
    } else if (server.command) {
      // Test Stdio subprocess server
      return this.testStdioServer(name, server)
    } else {
      return { success: false, message: 'Server missing command or url', tools: [] }
    }
  }

  private async testStdioServer(
    name: string,
    server: McpServerConfig,
  ): Promise<{ success: boolean; message: string; tools: McpDiscoveredTool[] }> {
    return new Promise((resolve) => {
      const cmd = server.command!
      const args = server.args || []
      const env = { ...process.env, ...(server.env || {}) }

      let proc: ChildProcess
      try {
        proc = spawn(cmd, args, {
          env,
          shell: process.platform === 'win32',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return resolve({ success: false, message: `Failed to spawn: ${msg}`, tools: [] })
      }

      let stdoutBuffer = ''
      let stderrBuffer = ''
      let resolved = false

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          try {
            proc.kill()
          } catch {}
          resolve({
            success: false,
            message: `Connection timed out after 8000ms. Stderr: ${stderrBuffer}`,
            tools: [],
          })
        }
      }, 8000)

      proc.stderr?.on('data', (data) => {
        stderrBuffer += data.toString()
      })

      proc.stdout?.on('data', (chunk) => {
        stdoutBuffer += chunk.toString()
        const lines = stdoutBuffer.split('\n')
        stdoutBuffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.id === 1 && parsed.result) {
              // Initialized! Send notifications/initialized then request tools/list
              const notif = JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized',
              }) + '\n'
              proc.stdin?.write(notif)

              const reqTools = JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {},
              }) + '\n'
              proc.stdin?.write(reqTools)
            } else if (parsed.id === 2 && parsed.result?.tools) {
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
                try {
                  proc.kill()
                } catch {}

                const tools: McpDiscoveredTool[] = (parsed.result.tools as Array<{
                  name: string
                  description?: string
                  inputSchema?: Record<string, unknown>
                }>).map((t) => ({
                  serverName: name,
                  name: t.name,
                  description: t.description,
                  inputSchema: t.inputSchema,
                }))

                this.discoveredTools.set(name, tools)
                this.serverStatuses.set(name, {
                  name,
                  status: 'connected',
                  transport: 'stdio',
                  toolsCount: tools.length,
                  tools,
                })

                resolve({
                  success: true,
                  message: `Kết nối thành công! Đã phát hiện ${tools.length} công cụ.`,
                  tools,
                })
              }
            }
          } catch {
            // non-JSON stdout line, continue
          }
        }
      })

      proc.on('error', (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          resolve({ success: false, message: `Lỗi tiến trình: ${err.message}`, tools: [] })
        }
      })

      proc.on('exit', (code) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          resolve({
            success: false,
            message: `Tiến trình kết thúc sớm (Mã thoát: ${code}). Stderr: ${stderrBuffer}`,
            tools: [],
          })
        }
      })

      // Send MCP initialize
      const initPayload = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { roots: { listChanged: true }, sampling: {} },
          clientInfo: { name: 'Lycero Office', version: '1.0.0' },
        },
      }) + '\n'

      proc.stdin?.write(initPayload)
    })
  }

  private async testSseServer(
    name: string,
    server: McpServerConfig,
  ): Promise<{ success: boolean; message: string; tools: McpDiscoveredTool[] }> {
    try {
      const resp = await fetch(server.url!, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream, application/json',
          ...(server.headers || {}),
        },
        signal: AbortSignal.timeout(6000),
      })

      if (resp.ok) {
        const tools: McpDiscoveredTool[] = []
        this.discoveredTools.set(name, tools)
        this.serverStatuses.set(name, {
          name,
          status: 'connected',
          transport: 'sse',
          toolsCount: tools.length,
          tools,
        })
        return {
          success: true,
          message: `Kết nối HTTP SSE thành công (Mã phản hồi: ${resp.status})!`,
          tools,
        }
      } else {
        return {
          success: false,
          message: `Máy chủ phản hồi mã lỗi HTTP: ${resp.status}`,
          tools: [],
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, message: `Không thể kết nối tới ${server.url}: ${msg}`, tools: [] }
    }
  }

  public async callTool(
    serverName: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
  ): Promise<{ content: string; isError?: boolean }> {
    const config = this.readConfig()
    const server = config.mcpServers[serverName]
    if (!server || server.disabled) {
      return { content: `MCP Server "${serverName}" is not available or disabled.`, isError: true }
    }

    if (!server.command) {
      return { content: `SSE tool execution is pending full proxy bridge.`, isError: true }
    }

    return new Promise((resolve) => {
      const cmd = server.command!
      const args = server.args || []
      const env = { ...process.env, ...(server.env || {}) }

      let proc: ChildProcess
      try {
        proc = spawn(cmd, args, {
          env,
          shell: process.platform === 'win32',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return resolve({ content: `Failed to spawn MCP process: ${msg}`, isError: true })
      }

      let stdoutBuffer = ''
      let stderrBuffer = ''
      let resolved = false

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          try {
            proc.kill()
          } catch {}
          resolve({ content: `Tool call timed out after 15000ms`, isError: true })
        }
      }, 15000)

      proc.stderr?.on('data', (d) => {
        stderrBuffer += d.toString()
      })

      proc.stdout?.on('data', (chunk) => {
        stdoutBuffer += chunk.toString()
        const lines = stdoutBuffer.split('\n')
        stdoutBuffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.id === 1 && parsed.result) {
              proc.stdin?.write(
                JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n',
              )
              const callPayload = JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                  name: toolName,
                  arguments: toolArgs,
                },
              }) + '\n'
              proc.stdin?.write(callPayload)
            } else if (parsed.id === 2) {
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
                try {
                  proc.kill()
                } catch {}

                if (parsed.error) {
                  return resolve({
                    content: `MCP Error: ${parsed.error.message || JSON.stringify(parsed.error)}`,
                    isError: true,
                  })
                }

                const contentItems = parsed.result?.content || []
                const text = contentItems
                  .map((c: { type?: string; text?: string }) => c.text || '')
                  .filter(Boolean)
                  .join('\n')

                resolve({
                  content: text || JSON.stringify(parsed.result),
                  isError: parsed.result?.isError,
                })
              }
            }
          } catch {}
        }
      })

      proc.on('error', (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          resolve({ content: `Process error: ${err.message}`, isError: true })
        }
      })

      proc.on('exit', (code) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          resolve({
            content: `Process exited with code ${code}. Stderr: ${stderrBuffer}`,
            isError: true,
          })
        }
      })

      proc.stdin?.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { roots: { listChanged: true }, sampling: {} },
            clientInfo: { name: 'Lycero Office', version: '1.0.0' },
          },
        }) + '\n',
      )
    })
  }

  public dispose(): void {
    for (const proc of this.activeProcesses.values()) {
      try {
        proc.kill()
      } catch {}
    }
    this.activeProcesses.clear()
  }
}

export const mcpClientManager = new McpClientManager()
