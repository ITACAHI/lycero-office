/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Long digit-only strings are usually identifiers (phone numbers, account
 * numbers, tracking codes, and so on), not values intended for arithmetic.
 * Keeping them as text also preserves leading zeroes and full precision.
 */
export function isNumericIdentifierText(value: string): boolean {
  return /^\d{7,}$/.test(value.trim())
}
