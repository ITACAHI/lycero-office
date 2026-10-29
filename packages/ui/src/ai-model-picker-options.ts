/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import {
  AI_PROVIDERS,
  activeProvider,
  customEndpointLabel,
  resolveCustomEndpoints,
  upsertCustomEndpoint,
  type AiProviderId,
  type AiSettings,
} from '@lycero/ai-provider/browser'

export interface AiModelPickerGroup {
  readonly id: AiProviderId
  /** set on custom groups: one group per saved endpoint */
  readonly endpoint?: string | undefined
  readonly label: string
  readonly models: readonly string[]
}

export interface AiModelPickerSelection {
  readonly provider: AiProviderId
  readonly endpoint?: string | undefined
  readonly model: string
}

/**
 * Providers the composer chip may switch to: Lycero while signed in, every
 * other vendor once its settings pass the same usability test the chat path
 * applies (`activeProvider`), so picking a row never lands on a 401. A model
 * typed into the settings page that is not in the catalog is listed first.
 */
export function aiModelPickerGroups(input: AiSettings, gskLoggedIn: boolean): AiModelPickerGroup[] {
  const settings = resolveCustomEndpoints(input)
  const groups: AiModelPickerGroup[] = []
  for (const meta of AI_PROVIDERS) {
    if (meta.id === 'custom') {
      for (const ep of settings.customEndpoints ?? []) {
        if (!ep.baseUrl || !ep.model) continue
        // Declared models come before a server probe's answer: a profile entry
        // is the user's own list, which outranks what the server advertised
        // (a server that no longer serves an id the user pinned keeps it
        // selectable). The configured model is pinned to the top, as before.
        const ids = [ep.model, ...(ep.modelProfiles ?? []).map((m) => m.id), ...(ep.models ?? [])]
        const seen = new Set<string>()
        const models = ids.filter((m) => {
          if (!m || seen.has(m)) return false
          seen.add(m)
          return true
        })
        groups.push({
          id: meta.id,
          endpoint: ep.id,
          label: customEndpointLabel(ep, meta.label),
          models,
        })
      }
      continue
    }
    const config = settings.providers?.[meta.id]
    const stored = config?.model?.trim() ?? ''
    // CLI vendors pass activeProvider unconfigured (the binary auto-discovers);
    // list them only once the settings page holds a model or a path
    const usable =
      meta.id === 'lycero'
        ? gskLoggedIn
        : meta.needsCliPath
          ? Boolean(stored || config?.cliPath?.trim())
          : activeProvider({ ...settings, provider: meta.id }) === meta.id
    if (!usable) continue
    const serverLyceroIds =
      meta.id === 'lycero' && settings.lyceroModelLabels
        ? Object.keys(settings.lyceroModelLabels).filter((id) => id.startsWith('lycero-2.5-'))
        : []
    const models =
      meta.id === 'lycero'
        ? serverLyceroIds.length > 0
          ? serverLyceroIds
          : meta.models
        : stored && !meta.models.includes(stored)
          ? [stored, ...meta.models]
          : meta.models
    if (models.length === 0 && !meta.needsCliPath) continue
    groups.push({ id: meta.id, label: meta.label, models })
  }
  return groups
}

export function aiModelPickerSelection(input: AiSettings): AiModelPickerSelection {
  const settings = resolveCustomEndpoints(input)
  const provider = activeProvider(settings)
  const meta = AI_PROVIDERS.find((m) => m.id === provider)
  const rawModel = settings.providers?.[provider]?.model?.trim() || meta?.defaultModel || ''
  const lyceroAllowed =
    provider === 'lycero' && settings.lyceroModelLabels
      ? Object.keys(settings.lyceroModelLabels).filter((id) => id.startsWith('lycero-2.5-'))
      : meta?.models ?? []
  const model =
    provider === 'lycero' && meta && lyceroAllowed.length > 0 && !lyceroAllowed.includes(rawModel)
      ? meta.defaultModel
      : rawModel
  if (provider === 'custom' && settings.customEndpoint) {
    return { provider, endpoint: settings.customEndpoint, model }
  }
  return { provider, model }
}

export function withAiModelSelection(input: AiSettings, pick: AiModelPickerSelection): AiSettings {
  const settings = resolveCustomEndpoints(input)
  if (pick.provider === 'custom' && pick.endpoint) {
    const ep = settings.customEndpoints?.find((e) => e.id === pick.endpoint)
    if (ep) {
      return {
        ...upsertCustomEndpoint(settings, { ...ep, model: pick.model }, true),
        provider: 'custom',
      }
    }
  }
  const config = settings.providers[pick.provider] ?? { apiKey: '', model: '' }
  return {
    ...settings,
    provider: pick.provider,
    providers: { ...settings.providers, [pick.provider]: { ...config, model: pick.model } },
  }
}
