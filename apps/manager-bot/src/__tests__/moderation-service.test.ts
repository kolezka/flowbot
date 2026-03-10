import { describe, expect, it } from 'vitest'
import { checkEscalation } from '../services/moderation.js'
import type { GroupConfig } from '@tg-allegro/db'

function makeConfig(overrides: Partial<GroupConfig> = {}): GroupConfig {
  return {
    id: 'config-1',
    groupId: 'group-1',
    antiSpam: false,
    antiLink: false,
    welcomeEnabled: false,
    welcomeMessage: null,
    rulesText: null,
    captchaEnabled: false,
    captchaTimeout: 300,
    maxWarnings: 5,
    warnThresholdMute: 3,
    warnThresholdBan: 5,
    muteDurationMinutes: 60,
    autoDeleteJoinLeave: false,
    mediaRestrict: false,
    mediaRestrictDuration: 86400,
    logChannelId: null,
    locale: 'en',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GroupConfig
}

describe('moderation service - checkEscalation', () => {
  it('returns "none" when warning count is below mute threshold', () => {
    const config = makeConfig({ warnThresholdMute: 3, warnThresholdBan: 5 })
    expect(checkEscalation(0, config)).toBe('none')
    expect(checkEscalation(1, config)).toBe('none')
    expect(checkEscalation(2, config)).toBe('none')
  })

  it('returns "mute" when warning count reaches mute threshold', () => {
    const config = makeConfig({ warnThresholdMute: 3, warnThresholdBan: 5 })
    expect(checkEscalation(3, config)).toBe('mute')
    expect(checkEscalation(4, config)).toBe('mute')
  })

  it('returns "ban" when warning count reaches ban threshold', () => {
    const config = makeConfig({ warnThresholdMute: 3, warnThresholdBan: 5 })
    expect(checkEscalation(5, config)).toBe('ban')
    expect(checkEscalation(10, config)).toBe('ban')
  })

  it('returns "ban" when warning count equals ban threshold exactly', () => {
    const config = makeConfig({ warnThresholdMute: 2, warnThresholdBan: 4 })
    expect(checkEscalation(4, config)).toBe('ban')
  })

  it('handles mute threshold equal to ban threshold (ban takes priority)', () => {
    const config = makeConfig({ warnThresholdMute: 3, warnThresholdBan: 3 })
    // Ban is checked first, so at 3 it should be 'ban'
    expect(checkEscalation(3, config)).toBe('ban')
  })

  it('handles custom threshold values', () => {
    const config = makeConfig({ warnThresholdMute: 1, warnThresholdBan: 2 })
    expect(checkEscalation(0, config)).toBe('none')
    expect(checkEscalation(1, config)).toBe('mute')
    expect(checkEscalation(2, config)).toBe('ban')
  })
})
