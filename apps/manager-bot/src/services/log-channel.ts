import type { Api } from 'grammy'

const ACTION_ICONS: Record<string, string> = {
  warn: '⚠️',
  unwarn: '✅',
  mute: '🔇',
  unmute: '🔊',
  ban: '🚫',
  unban: '✅',
  kick: '👢',
  link_blocked: '🔗',
  allowlink: '🔗',
  denylink: '🔗',
  config_change: '⚙️',
  promotion: '📢',
  ai_spam_detected: '🤖',
}

export interface LogChannelEvent {
  action: string
  actorId: bigint
  targetId?: bigint
  reason?: string
  automated?: boolean
  groupTitle?: string
}

function formatLogMessage(event: LogChannelEvent): string {
  const icon = ACTION_ICONS[event.action] ?? '📋'
  const actor = event.automated ? 'System' : `<code>${event.actorId}</code>`
  const target = event.targetId ? ` → <code>${event.targetId}</code>` : ''
  const reason = event.reason ? `\nReason: ${event.reason}` : ''
  const group = event.groupTitle ? ` in <b>${event.groupTitle}</b>` : ''
  const time = new Date().toISOString().slice(0, 19).replace('T', ' ')

  return `${icon} <b>${event.action}</b>${group}\nBy: ${actor}${target}${reason}\n🕐 ${time}`
}

export class LogChannelService {
  private api: Api | null = null

  setApi(api: Api) {
    this.api = api
  }

  async sendLogEvent(channelId: bigint, event: LogChannelEvent): Promise<void> {
    if (!this.api)
      return

    const message = formatLogMessage(event)

    try {
      await this.api.sendMessage(Number(channelId), message, { parse_mode: 'HTML' })
    }
    catch {
      // Silently fail — don't break moderation flow because of log channel issues
    }
  }
}

// Singleton instance for cross-module access
export const logChannelService = new LogChannelService()
