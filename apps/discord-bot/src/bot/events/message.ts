import type { Client } from 'discord.js'
import type { DiscordFlowEventForwarder } from '../../services/flow-events.js'
import { Events } from 'discord.js'

export function registerMessageEvents(client: Client, forwarder: DiscordFlowEventForwarder): void {
  client.on(Events.MessageCreate, async (message) => {
    // Ignore bot messages
    if (message.author.bot) return

    // Only process guild (server) messages
    if (!message.guild) return

    try {
      await forwarder.onMessageReceived({
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
        userId: message.author.id,
        username: message.author.username,
        content: message.content,
        hasAttachments: message.attachments.size > 0,
        attachmentCount: message.attachments.size,
      })
    }
    catch (error) {
      console.error('[discord-bot] Failed to forward messageCreate event:', error)
    }
  })
}
