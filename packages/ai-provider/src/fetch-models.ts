/**
 * Lycero Office Desktop
 * Copyright 2026 ITAC AI Heavy Industries.
 * All rights reserved.
 */
import { aiFetch } from './fetch'
import type { AiProviderConfig, AiProviderId } from './types'
import { AI_PROVIDERS, LYCERO_GATEWAY_URL } from './providers'
import { applyRemoteTokenOptimizerPolicy } from './token-compactor'

/**
 * Queries remote server for live available models (e.g. Lycero, OpenAI-compatible, DeepSeek, Ollama)
 */
export async function fetchRemoteModels(
  provider: AiProviderId,
  config: AiProviderConfig,
): Promise<string[]> {
  const meta = AI_PROVIDERS.find((p) => p.id === provider)
  let endpoint = ''

  if (provider === 'lycero') {
    const gateway = LYCERO_GATEWAY_URL
    endpoint = (config.baseUrl || `${gateway}/api/v1/office/ai`).replace(/\/$/, '') + '/models'
  } else if (
    provider === 'openai' ||
    provider === 'deepseek' ||
    provider === 'openrouter' ||
    provider === 'custom' ||
    provider === 'mistral' ||
    provider === 'xai'
  ) {
    const base = (
      config.baseUrl ||
      (provider === 'deepseek'
        ? 'https://api.deepseek.com/v1'
        : provider === 'openrouter'
          ? 'https://openrouter.ai/api/v1'
          : 'https://api.openai.com/v1')
    ).replace(/\/$/, '')
    endpoint = `${base}/models`
  } else if (provider === 'anthropic') {
    endpoint = 'https://api.anthropic.com/v1/models'
  } else if (provider === 'gemini') {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`
  } else {
    return meta?.models ?? []
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  const token = config.apiKey || (typeof globalThis !== 'undefined' && (globalThis as any).__lyceroSession?.token) || ''
  if (token) {
    if (provider === 'anthropic') {
      headers['x-api-key'] = token
      headers['anthropic-version'] = '2023-06-01'
    } else if (provider !== 'gemini') {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await aiFetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return meta?.models ?? []
    }

    const data = (await res.json()) as any
    const remotePolicy = data?.tokenOptimizerPolicy ?? data?.tokenOptimizer
    if (remotePolicy) {
      applyRemoteTokenOptimizerPolicy(remotePolicy)
    }
    if (Array.isArray(data?.data)) {
      const ids = data.data
        .map((m: any) => (typeof m === 'string' ? m : m?.id))
        .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
      if (ids.length > 0) return ids
    } else if (Array.isArray(data?.models)) {
      const ids = data.models
        .map((m: any) => (typeof m === 'string' ? m : m?.name?.replace(/^models\//, '') || m?.id))
        .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
      if (ids.length > 0) return ids
    }
  } catch {
    // Fall back to default catalog on network or parse error
  }

  return meta?.models ?? []
}
