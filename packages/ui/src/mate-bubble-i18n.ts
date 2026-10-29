/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 *
 * Lycero Mate — Floating Bubble Toolbar UI strings (VN primary, EN secondary).
 * Vietnamese is primary per DESIGN.md §1 (thuần sư phạm).
 */

export type MateBubbleAction = 'expand' | 'shorten' | 'grammarcheck' | 'gen-mcq'

export interface MateBubbleState {
  /** the selected text */
  readonly text: string
  /** viewport-relative rect (window.scrollX/Y already added by the host) */
  readonly rect: { readonly top: number; readonly left: number; readonly width: number; readonly height: number }
  /** which side of the bubble the tail should anchor to */
  readonly tailwind: 'left' | 'center' | 'right'
  /** identifier of the broadcasting host (e.g. tabId); informational only */
  readonly hostId?: string
}

export interface MateBubbleI18n {
  readonly expand: string
  readonly shorten: string
  readonly grammar: string
  readonly quiz: string
  readonly handoff: string
  readonly expandTitle: string
  readonly shortenTitle: string
  readonly grammarTitle: string
  readonly quizTitle: string
  readonly handoffTitle: string
  readonly toolbarLabel: string
}

const VI: MateBubbleI18n = {
  expand: 'Mở rộng ý',
  shorten: 'Rút gọn',
  grammar: 'Sửa chính tả',
  quiz: 'Tạo trắc nghiệm',
  handoff: 'Đưa vào Mate',
  expandTitle: 'Mở rộng nội dung đoạn chọn',
  shortenTitle: 'Rút gọn đoạn chọn',
  grammarTitle: 'Sửa chính tả và diễn đạt',
  quizTitle: 'Sinh câu hỏi trắc nghiệm từ đoạn chọn',
  handoffTitle: 'Gửi đoạn chọn sang khung chat Lycero Mate',
  toolbarLabel: 'Thanh công cụ Lycero Mate nổi',
}

const EN: MateBubbleI18n = {
  expand: 'Expand',
  shorten: 'Shorten',
  grammar: 'Fix grammar',
  quiz: 'Make quiz',
  handoff: 'Send to Mate',
  expandTitle: 'Expand the selected passage',
  shortenTitle: 'Shorten the selected passage',
  grammarTitle: 'Fix grammar and clarity',
  quizTitle: 'Generate quiz items from the selection',
  handoffTitle: 'Hand the selection off to Lycero Mate',
  toolbarLabel: 'Lycero Mate floating toolbar',
}

export const defaultMateBubbleI18n: MateBubbleI18n = VI
export const EN_MATE_BUBBLE_I18N: MateBubbleI18n = EN
