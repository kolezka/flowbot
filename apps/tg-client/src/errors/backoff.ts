const DEFAULT_BASE_MS = 1000
const DEFAULT_MAX_MS = 60000
const JITTER_FACTOR = 0.25

export function calculateBackoff(
  attempt: number,
  baseMs: number = DEFAULT_BASE_MS,
  maxMs: number = DEFAULT_MAX_MS,
): number {
  const exponential = baseMs * 2 ** attempt
  const capped = Math.min(exponential, maxMs)
  const jitter = capped * JITTER_FACTOR * Math.random()
  return Math.floor(capped + jitter)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
