/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { createIpcTransport, type AgentTransport } from '@lycero/agent-core'
import type { AiSettings } from '../../shared/ipc'
import { t } from '../i18n/locale'

export interface ElectronTransportContext {
  getActiveSkillSlugs?: () => string[] | undefined
  getUserSkillConfig?: () => Record<string, unknown> | undefined
}

/** The shared IPC transport wired to the slides preload bridge (window.slidesApi). */
export function createElectronTransport(
  getSettings: () => AiSettings,
  context?: ElectronTransportContext,
): AgentTransport {
  return createIpcTransport<AiSettings>({
    onStream: (listener) => window.slidesApi.onAiStream(listener),
    start: (request) => window.slidesApi.aiStream(request),
    cancel: (requestId) => void window.slidesApi.aiStreamCancel(requestId),
    getSettings,
    editorModule: 'office_slide',
    getActiveSkillSlugs: context?.getActiveSkillSlugs,
    getUserSkillConfig: context?.getUserSkillConfig,
    unknownErrorText: () => t('aiErrUnknown'),
    timeoutErrorText: () => t('aiErrStreamTimeout'),
    creditsErrorText: () => t('aiCreditsExhausted'),
    networkErrorText: () => t('aiErrNetwork'),
    overloadedErrorText: () => t('aiErrOverloaded'),
    regionErrorText: () => t('aiErrRegion'),
  })
}
