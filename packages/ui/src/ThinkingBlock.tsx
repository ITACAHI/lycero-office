/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Lycero Mate — ThinkingBlock (reasoning accordion).
 * Auto-expands while reasoning streams, collapses when finished.
 *
 * Vietnamese primary; English fallback where literacy would help, so the same
 * block works for both archetypes (DEEP-THINKING title in both tongues).
 */
import React from 'react'
import { ThinkingBlockI18n } from './thinking-block-i18n'
import './ThinkingBlock.css'

export interface ThinkingBlockProps {
  readonly reasoning: string
  readonly isThinking?: boolean
  readonly defaultExpanded?: boolean
  /** language override; falls back to ui-lang of the panel when omitted */
  readonly i18n?: ThinkingBlockI18n
}

export function ThinkingBlock(_props: ThinkingBlockProps): React.JSX.Element | null {
  return null
}
