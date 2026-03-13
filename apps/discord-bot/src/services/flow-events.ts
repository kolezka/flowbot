/**
 * DiscordFlowEventForwarder — normalizes Discord events to flow trigger format
 * and POSTs them to the flow engine webhook endpoint.
 *
 * Parallel to manager-bot's FlowEventForwarder but uses direct HTTP
 * instead of Trigger.dev SDK, and tags events with `platform: 'discord'`.
 */
export class DiscordFlowEventForwarder {
  private readonly webhookUrl: string

  constructor(apiUrl: string) {
    this.webhookUrl = `${apiUrl}/api/flow/webhook`
  }

  async onMessageReceived(data: {
    guildId: string
    channelId: string
    messageId: string
    userId: string
    username: string
    content: string
    hasAttachments: boolean
    attachmentCount: number
  }): Promise<void> {
    await this.forward('discord_message_received', {
      ...data,
      authorId: data.userId,
    })
  }

  async onMemberJoin(data: {
    guildId: string
    userId: string
    username: string
    displayName: string
    accountCreatedAt: string
  }): Promise<void> {
    await this.forward('discord_member_join', data)
  }

  async onMemberLeave(data: {
    guildId: string
    userId: string
    username: string
    displayName: string
  }): Promise<void> {
    await this.forward('discord_member_leave', data)
  }

  async onReactionAdd(data: {
    guildId: string
    channelId: string
    messageId: string
    userId: string
    emoji: string
    emojiId?: string
  }): Promise<void> {
    await this.forward('discord_reaction_add', data)
  }

  async onReactionRemove(data: {
    guildId: string
    channelId: string
    messageId: string
    userId: string
    emoji: string
    emojiId?: string
  }): Promise<void> {
    await this.forward('discord_reaction_remove', data)
  }

  async onInteractionCreate(data: {
    guildId: string
    channelId: string
    userId: string
    username: string
    interactionType: string
    interactionId: string
    [key: string]: unknown
  }): Promise<void> {
    await this.forward('discord_interaction_create', data)
  }

  async onVoiceStateUpdate(data: {
    guildId: string
    userId: string
    username: string
    action: string
    oldChannelId?: string
    newChannelId?: string
    selfMute: boolean
    selfDeaf: boolean
    serverMute: boolean
    serverDeaf: boolean
    streaming: boolean
  }): Promise<void> {
    await this.forward('discord_voice_state_update', data)
  }

  private async forward(eventType: string, data: Record<string, unknown>): Promise<void> {
    const payload = {
      eventType,
      platform: 'discord' as const,
      data: {
        ...data,
        platform: 'discord',
        timestamp: new Date().toISOString(),
      },
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.error(
          `[discord-bot] Flow webhook returned ${response.status}:`,
          await response.text(),
        )
      }
    }
    catch (error) {
      console.error('[discord-bot] Failed to forward event to flow engine:', error)
    }
  }
}
