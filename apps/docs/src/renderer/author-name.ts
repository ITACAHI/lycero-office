/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
import { t } from './i18n/locale'

let current = ''
const listeners = new Set<() => void>()

/** Settings → General user name; the generic label until the shell has answered */
export function authorName(): string {
  return current || t('editorDefaultAuthor')
}

export function setAuthorName(name: string): void {
  const next = name.trim()
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

export function onAuthorNameChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
