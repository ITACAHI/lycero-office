/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { createAttachmentsSkill, type AgentSkill } from '@lycero/agent-core'
import type { AttachmentMeta } from '../../shared/ipc'
import { t } from '../i18n/locale'

/** the shared attachments skill over the Docs attachment IPC (parsing happens in the main process) */
export function createFilesSkill(getAttachments: () => AttachmentMeta[]): AgentSkill {
  return createAttachmentsSkill({
    list: getAttachments,
    read: async (path, offset, maxChars) => {
      const result = await window.desktop.readAttachment(path, offset, maxChars)
      if (!result.ok) throw new Error(result.error ?? 'read failed')
      return {
        text: result.text ?? '',
        totalChars: result.totalChars ?? 0,
        offset: result.offset ?? 0,
      }
    },
    labels: {
      read: (name) => t('aiSumReadAttachmentName', { name }),
      image: (name) => t('aiSumImageAttachment', { name }),
      invalid: t('aiSumReadAttachment'),
    },
  })
}
