/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import {
  DEFAULT_CLOUD_SKILL_CATALOG,
  classifySkillsForContext,
  type ClassifySkillsInput,
} from './skill-classifier'

/**
 * Field configuration schema for a Cloud Skill.
 * Used to dynamically render input controls in the Desktop UI without hardcoding.
 */
export interface SkillConfigFieldSchema {
  id?: string
  key?: string
  label: string
  type: 'select' | 'boolean' | 'slider'
  defaultValue: string | number | boolean
  options?: Array<{ label: string; value: string }>
  min?: number
  max?: number
  step?: number
  description?: string
}

export function getFieldKey(field: SkillConfigFieldSchema): string {
  return field.key || field.id || ''
}

/**
 * Opaque Manifest for a Cloud Skill.
 *
 * NOTE: The Desktop client NEVER holds or processes private system prompts,
 * AST transformation rules, or proprietary server logic. The Cloud Gateway
 * executes all cognitive transformations server-side.
 */
export interface CloudSkillManifest {
  slug: string
  name: string
  description: string
  category: string
  version: string
  icon?: string
  clientConfigSchema?: SkillConfigFieldSchema[]
  tools?: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }>
}

export interface CloudMcpEndpoint {
  serverKey: string
  name: string
  description?: string
  /**
   * Địa chỉ MCP trực tiếp do Hub công bố (ví dụ https://mcp.lycero.com/office/sse).
   * Vắng mặt thì client dùng đường proxy qua Hub.
   */
  endpointUrl?: string
  transport?: 'sse' | 'streamable_http' | 'stdio' | 'websocket'
  tools: Array<{
    name: string
    description?: string
    inputSchema?: Record<string, unknown>
  }>
}

export interface CloudCapabilitiesResponse {
  skills: CloudSkillManifest[]
  mcpEndpoints?: CloudMcpEndpoint[]
  version?: string
}

export interface CloudCapabilitiesSyncResult {
  ok: boolean
  fromCache: boolean
  skills: CloudSkillManifest[]
  mcpEndpoints: CloudMcpEndpoint[]
  message?: string
}

export interface CapabilitiesStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
}

class MemoryCapabilitiesStorage implements CapabilitiesStorage {
  private readonly store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

function resolveDefaultStorage(): CapabilitiesStorage {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return {
        getItem: (k) => globalThis.localStorage.getItem(k),
        setItem: (k, v) => {
          globalThis.localStorage.setItem(k, v)
        },
      }
    }
  } catch {
    // LocalStorage might be disabled or restricted in some sandbox modes
  }
  return new MemoryCapabilitiesStorage()
}

export const OFFLINE_CAPABILITIES_MESSAGE =
  'Đang làm việc ngoại tuyến, tính năng trợ lý thông minh sẽ tiếp tục khi có kết nối trở lại.'

export const DEFAULT_CAPABILITIES_GATEWAY_URL = 'https://lycero.com/api/v1/office/desktop/capabilities'

const CACHE_KEY_MANIFEST = 'lycero_cloud_capabilities_manifest'
const CACHE_KEY_CONFIG = 'lycero_cloud_skills_config'
const CACHE_KEY_ACTIVE = 'lycero_cloud_skills_active'

export class CloudCapabilitiesManager {
  private skills: CloudSkillManifest[] = []
  private mcpEndpoints: CloudMcpEndpoint[] = []
  private activeSlugs = new Set<string>()
  private skillConfigs: Record<string, Record<string, unknown>> = {}
  private storage: CapabilitiesStorage
  private gatewayUrl: string
  private listeners = new Set<() => void>()
  private initialized = false

  constructor(options?: {
    gatewayUrl?: string
    storage?: CapabilitiesStorage
  }) {
    this.gatewayUrl = options?.gatewayUrl ?? DEFAULT_CAPABILITIES_GATEWAY_URL
    this.storage = options?.storage ?? resolveDefaultStorage()
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // Safe dispatch: keep other listeners running
      }
    }
  }

  /**
   * Initializes local state from persistent storage cache immediately (zero lag).
   */
  public async loadFromCache(): Promise<boolean> {
    try {
      const rawManifest = await this.storage.getItem(CACHE_KEY_MANIFEST)
      if (rawManifest) {
        const parsed = JSON.parse(rawManifest) as CloudCapabilitiesResponse
        if (Array.isArray(parsed.skills)) {
          this.skills = parsed.skills
          this.mcpEndpoints = parsed.mcpEndpoints ?? []
        }
      }

      const rawActive = await this.storage.getItem(CACHE_KEY_ACTIVE)
      if (rawActive) {
        const parsed = JSON.parse(rawActive) as string[]
        if (Array.isArray(parsed)) {
          this.activeSlugs = new Set(parsed)
        }
      }

      const rawConfig = await this.storage.getItem(CACHE_KEY_CONFIG)
      if (rawConfig) {
        const parsed = JSON.parse(rawConfig) as Record<string, Record<string, unknown>>
        if (parsed && typeof parsed === 'object') {
          this.skillConfigs = parsed
        }
      }

      this.initialized = true
      this.notify()
      return this.skills.length > 0
    } catch {
      return false
    }
  }

  /**
   * Syncs capabilities with the Central Cloud Gateway.
   * If offline or fetch fails, falls back gracefully to cached manifest.
   */
  public async syncCapabilities(options?: {
    token?: string
    gatewayUrl?: string
    forceRefresh?: boolean
  }): Promise<CloudCapabilitiesSyncResult> {
    if (!this.initialized) {
      await this.loadFromCache()
    }

    const targetUrl = options?.gatewayUrl ?? this.gatewayUrl
    const isOnline =
      typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true

    if (!isOnline) {
      return {
        ok: true,
        fromCache: true,
        skills: this.skills,
        mcpEndpoints: this.mcpEndpoints,
        message: OFFLINE_CAPABILITIES_MESSAGE,
      }
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (options?.token) {
        headers.Authorization = `Bearer ${options.token}`
      }

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
      })

      if (!res.ok) {
        return {
          ok: false,
          fromCache: true,
          skills: this.skills,
          mcpEndpoints: this.mcpEndpoints,
          message: OFFLINE_CAPABILITIES_MESSAGE,
        }
      }

      const data = (await res.json()) as CloudCapabilitiesResponse
      if (Array.isArray(data.skills)) {
        this.skills = data.skills
        this.mcpEndpoints = data.mcpEndpoints ?? []

        // Persist to storage
        await this.storage.setItem(CACHE_KEY_MANIFEST, JSON.stringify(data))

        // Automatically activate all synced Cloud Skills if no custom active set was configured yet
        if (this.activeSlugs.size === 0) {
          for (const s of this.skills) {
            this.activeSlugs.add(s.slug)
          }
          await this.storage.setItem(
            CACHE_KEY_ACTIVE,
            JSON.stringify(Array.from(this.activeSlugs)),
          )
        }

        // Set default configs for newly discovered fields
        this.ensureDefaultConfigs()
        this.notify()

        return {
          ok: true,
          fromCache: false,
          skills: this.skills,
          mcpEndpoints: this.mcpEndpoints,
        }
      }

      return {
        ok: false,
        fromCache: true,
        skills: this.skills,
        mcpEndpoints: this.mcpEndpoints,
        message: OFFLINE_CAPABILITIES_MESSAGE,
      }
    } catch {
      return {
        ok: false,
        fromCache: true,
        skills: this.skills,
        mcpEndpoints: this.mcpEndpoints,
        message: OFFLINE_CAPABILITIES_MESSAGE,
      }
    }
  }

  private ensureDefaultConfigs(): void {
    for (const skill of this.skills) {
      if (!skill.clientConfigSchema) continue
      if (!this.skillConfigs[skill.slug]) {
        this.skillConfigs[skill.slug] = {}
      }
      const current = this.skillConfigs[skill.slug]!
      for (const field of skill.clientConfigSchema) {
        const key = getFieldKey(field)
        if (key && current[key] === undefined && field.defaultValue !== undefined) {
          current[key] = field.defaultValue
        }
      }
    }
  }

  public getSkills(): readonly CloudSkillManifest[] {
    return this.skills
  }

  /**
   * Returns all available Cloud Skills (merging synced server skills with the built-in catalog).
   */
  public getCatalogSkills(): readonly CloudSkillManifest[] {
    if (this.skills.length === 0) return DEFAULT_CLOUD_SKILL_CATALOG
    const seen = new Set(this.skills.map((s) => s.slug))
    return [...this.skills, ...DEFAULT_CLOUD_SKILL_CATALOG.filter((s) => !seen.has(s.slug))]
  }

  /**
   * Automatically classifies and selects the relevant Cloud Skills for a turn
   * based on the user's prompt, document context, active editor module, and pipeline stage.
   */
  public classifySkillsForTurn(input: Omit<ClassifySkillsInput, 'availableSkills'>): string[] {
    return classifySkillsForContext({
      ...input,
      availableSkills: this.getCatalogSkills(),
    })
  }

  public getMcpEndpoints(): readonly CloudMcpEndpoint[] {
    return this.mcpEndpoints
  }

  public isSkillActive(slug: string): boolean {
    return this.activeSlugs.has(slug)
  }

  public async setSkillActive(slug: string, active: boolean): Promise<void> {
    if (active) {
      this.activeSlugs.add(slug)
    } else {
      this.activeSlugs.delete(slug)
    }
    await this.storage.setItem(CACHE_KEY_ACTIVE, JSON.stringify(Array.from(this.activeSlugs)))
    this.notify()
  }

  public getActiveSkillSlugs(): string[] {
    return Array.from(this.activeSlugs)
  }

  public getActiveSkills(): CloudSkillManifest[] {
    return this.skills.filter((s) => this.activeSlugs.has(s.slug))
  }

  public getUserSkillConfig(slug?: string): Record<string, unknown> | Record<string, Record<string, unknown>> {
    if (slug) {
      return { ...(this.skillConfigs[slug] ?? {}) }
    }
    return { ...this.skillConfigs }
  }

  public async setSkillConfigValue(slug: string, fieldId: string, value: unknown): Promise<void> {
    if (!this.skillConfigs[slug]) {
      this.skillConfigs[slug] = {}
    }
    this.skillConfigs[slug]![fieldId] = value
    await this.storage.setItem(CACHE_KEY_CONFIG, JSON.stringify(this.skillConfigs))
    this.notify()
  }
}
