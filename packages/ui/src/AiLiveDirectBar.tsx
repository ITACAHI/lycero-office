/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import React from 'react'

export interface AiLiveDirectBarProps {
  /** Whether AI is actively streaming, reasoning, or executing direct tools */
  readonly busy: boolean
  /** Current phase or active tool summary */
  readonly phaseLabel?: string | null | undefined
  /** Active tool name (mapped to a friendly label when phaseLabel is generic) */
  readonly activeToolName?: string | null | undefined
  /** Whether the model is currently streaming reasoning tokens */
  readonly isReasoning?: boolean | undefined
  /** Number of tool steps executed in this run */
  readonly stepCount?: number | undefined
  /** Stop / cancel callback while busy */
  readonly onStop?: (() => void) | undefined
  /** Whether the completed run has direct canvas edits ready for review (Undo / Keep) */
  readonly hasReview?: boolean | undefined
  /** Optional custom label for the post-edit review bar */
  readonly reviewLabel?: string | null | undefined
  /** Revert / rollback the latest AI direct edit */
  readonly onUndo?: (() => void) | undefined
  /** Accept / keep the latest AI direct edit and dismiss the review bar */
  readonly onKeep?: (() => void) | undefined
  /** UI language ('vi' default) */
  readonly lang?: string | undefined
  /** Portal the remote AI cursor/caret over the center editor canvas (default: true) */
  readonly portalCanvas?: boolean | undefined
  /** Exact target location being edited on the screen (e.g. "Slide 2/8 • #e_3", "Đoạn #4–6", "Sheet1 • A1:D10") */
  readonly targetLocation?: string | null | undefined
  /** Real-time snippet of the content/text/formula AI is actively writing or modifying */
  readonly livePreview?: string | null | undefined
}

/**
 * Virtual AI cursor / floating remote caret overlay is intentionally disabled
 * so the center canvas stays clean and natural during AI edits.
 */
export function AiLiveDirectBar(_props: AiLiveDirectBarProps): React.ReactElement | null {
  return null
}
