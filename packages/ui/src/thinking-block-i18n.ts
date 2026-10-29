/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Lycero Mate — ThinkingBlock UI strings (VN primary, EN secondary).
 * Vietnamese is primary per DESIGN.md §1 (thuần sư phạm).
 */

export interface ThinkingBlockI18n {
  readonly thinkingNow: string
  readonly thinkingDone: string
  readonly expand: string
  readonly collapse: string
  readonly chars: string
}

const VI: ThinkingBlockI18n = {
  thinkingNow: 'Lycero 2.5 đang suy luận sâu…',
  thinkingDone: 'Quá trình tư duy & suy luận',
  expand: 'Mở chi tiết',
  collapse: 'Thu gọn',
  chars: 'ký tự',
}

const EN: ThinkingBlockI18n = {
  thinkingNow: 'Lycero 2.5 is reasoning…',
  thinkingDone: 'Reasoning process',
  expand: 'Show details',
  collapse: 'Collapse',
  chars: 'chars',
}

export const DEFAULT_THINKING_BLOCK_I18N: ThinkingBlockI18n = VI
export const EN_THINKING_BLOCK_I18N: ThinkingBlockI18n = EN
