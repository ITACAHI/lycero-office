/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */

import type { WorkBundle, WorkBundleTool, WorkBundleSkill } from '@lycero/ai-auth'
import { routeIntent } from './router/intent-router'

/**
 * Composed tool descriptor ready for LLM function calling.
 */
export interface ComposedTool {
  name: string
  description: string
  parameters: Record<string, unknown>  // JSON schema
  source: {
    bundleKey: string
    bundleLabel: string
  }
}

/**
 * Composed skill descriptor (prompt-injectable).
 */
export interface ComposedSkill {
  name: string
  description: string
  content: string  // multi-line prompt content
  source: {
    bundleKey: string
    bundleLabel: string
  }
}

/**
 * Final composed context fed into agent loop.
 */
export interface ComposedAgentContext {
  tools: ComposedTool[]
  skills: ComposedSkill[]
  systemPromptAddition: string  // concatenated skill instructions for system prompt
  bundleKeys: string[]           // for telemetry / debug
  composedAt: number             // Date.now() — for cache invalidation
}

/**
 * Compose a flat tool catalog from enabled bundles.
 *
 * Collisions: if two bundles define a tool with the same name, the first one
 * wins (insertion order = bundles array order). Collisions are logged to
 * console.warn so the dev sees them.
 */
export function composeBundleTools(bundles: WorkBundle[]): ComposedTool[] {
  const seen = new Set<string>()
  const out: ComposedTool[] = []
  for (const bundle of bundles) {
    for (const tool of bundle.tools) {
      if (seen.has(tool.name)) {
        console.warn(
          `[composer] tool name collision: "${tool.name}" ` +
          `(kept from earlier bundle, skipped from "${bundle.key}")`
        )
        continue
      }
      seen.add(tool.name)
      out.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        source: { bundleKey: bundle.key, bundleLabel: bundle.labelVi }
      })
    }
  }
  return out
}

/**
 * Compose a flat skill catalog from enabled bundles.
 * Same collision policy as composeBundleTools.
 *
 * Phase C.1 — optional router integration:
 * - If `prompt` is provided, the intent router picks the primary bundle.
 * - If the routed bundle is enabled, it gets priority (moved to first position).
 * - If the routed bundle is NOT enabled, add a note suggesting it.
 * - Without `prompt`, falls back to insertion-order (backward compat).
 */
export function composeBundleSkills(
  bundles: WorkBundle[],
  prompt?: string
): ComposedSkill[] {
  let orderedBundles = bundles

  if (prompt) {
    const decision = routeIntent(prompt, bundles)

    // Check if the routed bundle is already in the enabled set
    const routedIndex = bundles.findIndex((b) => b.key === decision.bundleId)
    if (routedIndex > 0) {
      // Reroute: move routed bundle to front (primary = highest priority)
      orderedBundles = [
        bundles[routedIndex]!,
        ...bundles.slice(0, routedIndex),
        ...bundles.slice(routedIndex + 1),
      ]
    }
    // If routedIndex === 0 or not found, bundles order is unchanged.
    // The suggestion note (when routed bundle is disabled) is handled at the
    // caller level (AgentLoop / buildBundleContextResolver), not here.
  }

  const seen = new Set<string>()
  const out: ComposedSkill[] = []
  for (const bundle of orderedBundles) {
    for (const skill of bundle.skills) {
      if (seen.has(skill.name)) {
        console.warn(
          `[composer] skill name collision: "${skill.name}" ` +
          `(kept from earlier bundle, skipped from "${bundle.key}")`
        )
        continue
      }
      seen.add(skill.name)
      out.push({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        source: { bundleKey: bundle.key, bundleLabel: bundle.labelVi }
      })
    }
  }
  return out
}

/**
 * Build the system-prompt addition: each skill's `content` joined under
 * a single markdown section. Empty string if no skills.
 *
 * Format:
 *   ## Skills loaded (N)
 *   - skill_name: skill description
 *
 *   ### skill_name
 *   <content>
 *
 *   ### other_skill_name
 *   <content>
 */
export function buildSystemPromptAddition(skills: ComposedSkill[]): string {
  if (skills.length === 0) return ''

  const lines: string[] = []
  lines.push(`## Skills loaded (${skills.length})`)
  for (const s of skills) {
    lines.push(`- ${s.name}: ${s.description}`)
  }
  lines.push('')
  for (const s of skills) {
    lines.push(`### ${s.name}`)
    lines.push(s.content)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

/**
 * Top-level: compose a full agent context from enabled bundles.
 *
 * @param bundles - enabled bundles
 * @param prompt  - optional user prompt for intent routing (Phase C.1).
 *                  When provided, the routed bundle gets priority boost.
 */
export function composeAgentContext(bundles: WorkBundle[], prompt?: string): ComposedAgentContext {
  const tools = composeBundleTools(bundles)
  const skills = composeBundleSkills(bundles, prompt)
  return {
    tools,
    skills,
    systemPromptAddition: buildSystemPromptAddition(skills),
    bundleKeys: bundles.map(b => b.key),
    composedAt: Date.now()
  }
}

/**
 * ponytail: O(n*m) collision check uses Set.has(). For n=m=10 bundles
 * with ~5 tools each, that's 50 ops — negligible. If we ever ship 100+
 * bundles, switch to a Map<name, owner> for O(1) insert + ownership report.
 */
