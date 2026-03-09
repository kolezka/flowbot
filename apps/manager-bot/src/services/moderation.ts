import type { GroupConfig } from '@tg-allegro/db'

export type EscalationAction = 'none' | 'mute' | 'ban'

export function checkEscalation(warningCount: number, config: GroupConfig): EscalationAction {
  if (warningCount >= config.warnThresholdBan)
    return 'ban'
  if (warningCount >= config.warnThresholdMute)
    return 'mute'
  return 'none'
}
