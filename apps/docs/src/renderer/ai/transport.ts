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

/** The shared IPC transport wired to the docs preload bridge (window.desktop). */
export function createElectronTransport(
  getSettings: () => AiSettings,
  context?: ElectronTransportContext,
): AgentTransport {
  return createIpcTransport<AiSettings>({
    onStream: (listener) => window.desktop.onAiStream(listener),
    start: (request) => window.desktop.aiStream(request),
    cancel: (requestId) => void window.desktop.aiStreamCancel(requestId),
    getSettings,
    editorModule: 'office_docx',
    getActiveSkillSlugs: context?.getActiveSkillSlugs,
    getUserSkillConfig: context?.getUserSkillConfig,
    unknownErrorText: () => t('aiUnknownError'),
    timeoutErrorText: () => t('aiTimeoutError'),
    creditsErrorText: () => t('aiCreditsExhausted'),
    networkErrorText: () => t('aiNetworkError'),
    overloadedErrorText: () => t('aiOverloadedError'),
    regionErrorText: () => t('aiRegionError'),
  })
}
