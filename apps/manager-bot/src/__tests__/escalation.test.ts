import { describe, expect, it } from 'vitest'
import { checkEscalation } from '../services/moderation.js'

// Minimal GroupConfig mock with the fields checkEscalation uses
function makeConfig(overrides: { warnThresholdMute?: number, warnThresholdBan?: number } = {}) {
  return {
    warnThresholdMute: overrides.warnThresholdMute ?? 3,
    warnThresholdBan: overrides.warnThresholdBan ?? 5,
  } as any
}

describe('checkEscalation', () => {
  it('returns none when warnings are below mute threshold', () => {
    expect(checkEscalation(0, makeConfig())).toBe('none')
    expect(checkEscalation(1, makeConfig())).toBe('none')
    expect(checkEscalation(2, makeConfig())).toBe('none')
  })

  it('returns mute when warnings reach mute threshold', () => {
    expect(checkEscalation(3, makeConfig())).toBe('mute')
  })

  it('returns mute when warnings are between mute and ban thresholds', () => {
    expect(checkEscalation(4, makeConfig())).toBe('mute')
  })

  it('returns ban when warnings reach ban threshold', () => {
    expect(checkEscalation(5, makeConfig())).toBe('ban')
  })

  it('returns ban when warnings exceed ban threshold', () => {
    expect(checkEscalation(10, makeConfig())).toBe('ban')
  })

  it('respects custom thresholds', () => {
    const config = makeConfig({ warnThresholdMute: 2, warnThresholdBan: 4 })
    expect(checkEscalation(1, config)).toBe('none')
    expect(checkEscalation(2, config)).toBe('mute')
    expect(checkEscalation(3, config)).toBe('mute')
    expect(checkEscalation(4, config)).toBe('ban')
  })
})
