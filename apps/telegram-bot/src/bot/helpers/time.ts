const UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
}

const MAX_DURATION_S = 30 * 86400 // 30 days

export function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)\s*([smhdw])$/i)
  if (!match)
    return null

  const value = Number.parseInt(match[1]!, 10)
  const unit = match[2]!.toLowerCase()
  const multiplier = UNITS[unit]
  if (!multiplier)
    return null

  const seconds = value * multiplier
  if (seconds <= 0 || seconds > MAX_DURATION_S)
    return null

  return seconds
}

export function formatDuration(seconds: number): string {
  if (seconds >= 86400)
    return `${Math.floor(seconds / 86400)}d`
  if (seconds >= 3600)
    return `${Math.floor(seconds / 3600)}h`
  if (seconds >= 60)
    return `${Math.floor(seconds / 60)}m`
  return `${seconds}s`
}
