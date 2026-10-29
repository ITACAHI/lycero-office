/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Client Cloud Gateway Service for Lycero Office Desktop:
 * Directly bridges the renderer with Central Model Gateway (lycero.com).
 */

import {
  AiGatewayService,
  defaultAiGatewayService,
  type AiChatChunk,
  type AiChatMessage,
  type AiChatStreamController,
  type AiChatStreamPayload,
  type CloudCapabilitiesSyncResult,
  type CloudToolExecuteResponse,
} from '@lycero/agent-core'

export const aiGateway = new AiGatewayService({
  getAccessToken: () => {
    try {
      // In renderer, retrieve authentication token if logged in
      return localStorage.getItem('lycero_cloud_token') || undefined
    } catch {
      return undefined
    }
  },
})

/**
 * 1. GET /api/v1/office/desktop/capabilities
 * Fetches skills and MCP tool capabilities. Caches locally.
 */
export async function fetchCapabilities(options?: {
  forceRefresh?: boolean
}): Promise<CloudCapabilitiesSyncResult> {
  return aiGateway.fetchCapabilities(options)
}

/**
 * 2. POST /api/v1/office/ai/chat
 * Streams chat completions over Server-Sent Events (SSE).
 */
export function streamChatCompletion(
  payload: AiChatStreamPayload,
  onChunk: (chunk: AiChatChunk) => void,
  onDone: (fullText: string) => void,
  onError: (error: Error) => void,
  signal?: AbortSignal,
): AiChatStreamController {
  return aiGateway.streamChatCompletion(payload, onChunk, onDone, onError, signal)
}

/**
 * 3. POST /api/v1/office/desktop/tools/execute
 * Executes reverse-proxied remote tools via Central Model Gateway.
 */
export async function executeProxyTool(
  serverKey: string,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<CloudToolExecuteResponse> {
  return aiGateway.executeProxyTool(serverKey, toolName, args, signal)
}

/**
 * 3b. Tool execution with the direct-MCP endpoint when the Hub published one,
 * falling back to the reverse proxy otherwise. Prefer this over
 * executeProxyTool; the proxy call stays public for callers that must force it.
 */
export async function executeCloudTool(
  serverKey: string,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<CloudToolExecuteResponse> {
  return aiGateway.executeTool(serverKey, toolName, args, signal)
}

export {
  AiGatewayService,
  defaultAiGatewayService,
  type AiChatChunk,
  type AiChatMessage,
  type AiChatStreamController,
  type AiChatStreamPayload,
  type CloudCapabilitiesSyncResult,
  type CloudToolExecuteResponse,
}
