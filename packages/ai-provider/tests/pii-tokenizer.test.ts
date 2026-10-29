/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { PiiTokenizer } from '../src/pii-tokenizer'

describe('PiiTokenizer', () => {
  it('masks Vietnamese phone numbers and emails correctly', () => {
    const input = 'Vui lòng liên hệ thầy Nguyễn qua SĐT 0912345678 hoặc email nguyen.edu@lycero.vn để nhận giáo án.'
    const { maskedText, piiMap } = PiiTokenizer.mask(input)

    expect(maskedText).not.toContain('0912345678')
    expect(maskedText).not.toContain('nguyen.edu@lycero.vn')
    expect(maskedText).toContain('[PII_PHONE_')
    expect(maskedText).toContain('[PII_EMAIL_')

    // Restores faithfully
    const restored = PiiTokenizer.restore(maskedText, piiMap)
    expect(restored).toBe(input)
  })

  it('masks 12-digit CCCD and 9-digit CMND numbers', () => {
    const input = 'Số CCCD của công dân là 001234567890 và CMND cũ 123456789.'
    const { maskedText, piiMap } = PiiTokenizer.mask(input)

    expect(maskedText).not.toContain('001234567890')
    expect(maskedText).not.toContain('123456789')
    expect(maskedText).toContain('[PII_CCCD_')
    expect(maskedText).toContain('[PII_CMND_')

    const restored = PiiTokenizer.restore(maskedText, piiMap)
    expect(restored).toBe(input)
  })

  it('masks 16-digit credit and payment card numbers', () => {
    const input = 'Thẻ giao dịch: 4123 4567 8901 2345.'
    const { maskedText, piiMap } = PiiTokenizer.mask(input)

    expect(maskedText).not.toContain('4123 4567 8901 2345')
    expect(maskedText).toContain('[PII_CARD_')

    const restored = PiiTokenizer.restore(maskedText, piiMap)
    expect(restored).toBe(input)
  })

  it('unmasks PII tokens streaming across chunk boundaries', () => {
    const input = 'Số điện thoại: 0987654321'
    const { maskedText, piiMap } = PiiTokenizer.mask(input)

    // Token should look like [PII_PHONE_1]
    const unmasker = PiiTokenizer.createStreamUnmasker(piiMap)

    // Split maskedText into 2 chunks right inside the token!
    const tokenIndex = maskedText.indexOf('[PII_')
    const splitPoint = tokenIndex + 6 // after '[PII_P'
    const chunk1 = maskedText.slice(0, splitPoint)
    const chunk2 = maskedText.slice(splitPoint)

    const out1 = unmasker(chunk1)
    const out2 = unmasker(chunk2)

    expect(out1 + out2).toBe(input)
  })

  it('preserves financial figures (9, 10, 12 digits ending in 000), dates, and decimal scores without false PII masking', () => {
    const input = 'Doanh thu quý 1 ngày 01/10/2026 đạt 150000000 VNĐ, chi phí 245500000 VNĐ, ngân sách 100000000000 VNĐ, điểm 8.5.'
    const { maskedText, piiMap } = PiiTokenizer.mask(input)

    expect(maskedText).toContain('150000000')
    expect(maskedText).toContain('245500000')
    expect(maskedText).toContain('100000000000')
    expect(maskedText).toContain('01/10/2026')
    expect(maskedText).toContain('8.5')
    expect(piiMap.size).toBe(0)
  })

  it('recovers original PII when LLM substitutes a dummy phone number or alters token prefix', () => {
    const input = 'Soạn thông báo nghỉ Tết, liên hệ hotline 0901234567.'
    const { piiMap } = PiiTokenizer.mask(input)

    // Case 1: LLM substituted dummy phone 0987654321 instead of keeping [PII_PHONE_1]
    const llmDummyOutput = 'Mọi sự cố khẩn cấp xin liên hệ hotline: 0987654321.'
    expect(PiiTokenizer.restore(llmDummyOutput, piiMap)).toBe(
      'Mọi sự cố khẩn cấp xin liên hệ hotline: 0901234567.'
    )

    // Case 2: LLM dropped PII_ prefix and wrote [PHONE_1]
    const llmShortTokenOutput = 'Mọi sự cố khẩn cấp xin liên hệ hotline: [PHONE_1].'
    expect(PiiTokenizer.restore(llmShortTokenOutput, piiMap)).toBe(
      'Mọi sự cố khẩn cấp xin liên hệ hotline: 0901234567.'
    )
  })
})
