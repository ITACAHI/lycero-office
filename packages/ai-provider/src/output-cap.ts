/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries.
 * Original work Copyright © 2026 Mainfunc, Inc. (GenOffice, Apache-2.0).
 */
/**
 * Providers 400 (not clamp) a max_tokens above the model's output ceiling, and
 * the 32k default is above gpt-4o / claude-3.5 / deepseek-chat. The rejection
 * body names the ceiling: retry once there and remember it per endpoint+model.
 */

const MODEL_CAPS = new Map<string, number>()

const CAP_ERROR_PATTERN =
  /\bHTTP 4(00|22)\b[\s\S]*(max_?tokens|max_completion_tokens|max_?output_?tokens|output tokens|completion tokens)/i

// round like 8192 / 64000 / 128000, unlike model-name dates such as 2024
function looksLikeCeiling(n: number): boolean {
  return n >= 1024 && (n % 1024 === 0 || n % 1000 === 0)
}

// phrasing varies per vendor ("32768 > 8192, which is the maximum", "supports at most 16384",
// "valid range is [1, 8192]"): the largest round number below the request is the ceiling
export function parseOutputCapRejection(message: string, requested: number): number | null {
  if (!CAP_ERROR_PATTERN.test(message)) return null
  let best = 0
  for (const m of message.matchAll(/\d[\d,]*/g)) {
    const n = Number(m[0].replace(/,/g, ''))
    if (n < requested && looksLikeCeiling(n) && n > best) best = n
  }
  return best > 0 ? best : null
}

function capKey(baseUrl: string, model: string): string {
  return `${baseUrl}\0${model}`
}

export function resetOutputCaps(): void {
  MODEL_CAPS.clear()
}

// a 400 arrives before any delta reaches the caller, so the retry is invisible
export async function withOutputCapFallback<T>(
  baseUrl: string,
  model: string,
  requested: number,
  run: (maxTokens: number) => Promise<T>,
): Promise<T> {
  const key = capKey(baseUrl, model)
  const known = MODEL_CAPS.get(key)
  const first = known !== undefined && known < requested ? known : requested
  try {
    return await run(first)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const ceiling = parseOutputCapRejection(message, first)
    if (ceiling === null) throw e
    MODEL_CAPS.set(key, ceiling)
    return run(ceiling)
  }
}
