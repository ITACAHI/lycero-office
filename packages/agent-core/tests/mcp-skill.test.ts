/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import { describe, expect, it, vi } from 'vitest'
import { createMcpSkill } from '../src/mcp-skill'

describe('createMcpSkill', () => {
  it('exposes tool definitions and system prompt', () => {
    const mockTools = [
      {
        name: 'query_database',
        description: 'Query PostgreSQL database',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        serverName: 'postgres',
      },
    ]

    const skill = createMcpSkill({
      getTools: () => mockTools,
      executeTool: vi.fn(),
      getActiveServers: () => ['postgres'],
    })

    expect(skill.id).toBe('mcp-clients')
    expect(skill.tools).toHaveLength(1)
    expect(skill.tools[0].name).toBe('query_database')
    expect(skill.tools[0].description).toBe('Query PostgreSQL database')
    expect(skill.systemPrompt).toContain('Model Context Protocol (MCP) Tools')
    expect(skill.buildContext?.()).toContain('Connected MCP Servers: postgres')
  })

  it('executes MCP tool call successfully', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Table users has 42 rows' }],
      isError: false,
    })

    const skill = createMcpSkill({
      getTools: () => [{ name: 'db_query', serverName: 'local-db' }],
      executeTool: mockExecute,
    })

    const result = await skill.executeTool({
      id: 'call_1',
      name: 'db_query',
      input: { sql: 'SELECT count(*) FROM users' },
    })

    expect(mockExecute).toHaveBeenCalledWith(
      'db_query',
      { sql: 'SELECT count(*) FROM users' },
      'local-db',
    )
    expect(result.output).toBe('Table users has 42 rows')
    expect(result.isError).toBe(false)
    expect(result.summary).toBe('MCP: db_query')
  })

  it('handles MCP tool execution error from server', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      error: 'Connection refused',
    })

    const skill = createMcpSkill({
      getTools: () => [{ name: 'db_query', serverName: 'local-db' }],
      executeTool: mockExecute,
    })

    const result = await skill.executeTool({
      id: 'call_2',
      name: 'db_query',
      input: {},
    })

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Error executing MCP tool "db_query": Connection refused')
  })

  it('catches and handles exceptions during execution', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error('Process terminated'))

    const skill = createMcpSkill({
      getTools: () => [{ name: 'fetch_url', serverName: 'fetch' }],
      executeTool: mockExecute,
    })

    const result = await skill.executeTool({
      id: 'call_3',
      name: 'fetch_url',
      input: { url: 'https://invalid.test' },
    })

    expect(result.isError).toBe(true)
    expect(result.output).toContain('Exception executing MCP tool "fetch_url": Process terminated')
  })
})
