import type { Client } from 'discord.js'
import type { DiscordFlowEventForwarder } from '../../services/flow-events.js'
import { Events } from 'discord.js'

export function registerReactionEvents(client: Client, forwarder: DiscordFlowEventForwarder): void {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return

    // Fetch partial reactions if needed
    if (reaction.partial) {
      try {
        await reaction.fetch()
      }
      catch {
        console.error('[discord-bot] Failed to fetch partial reaction')
        return
      }
    }

    try {
      await forwarder.onReactionAdd({
        guildId: reaction.message.guild?.id ?? '',
        channelId: reaction.message.channel.id,
        messageId: reaction.message.id,
        userId: user.id,
        emoji: reaction.emoji.name ?? reaction.emoji.id ?? '',
        emojiId: reaction.emoji.id ?? undefined,
      })
    }
    catch (error) {
      console.error('[discord-bot] Failed to forward messageReactionAdd event:', error)
    }
  })

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return

    if (reaction.partial) {
      try {
        await reaction.fetch()
      }
      catch {
        console.error('[discord-bot] Failed to fetch partial reaction')
        return
      }
    }

    try {
      await forwarder.onReactionRemove({
        guildId: reaction.message.guild?.id ?? '',
        channelId: reaction.message.channel.id,
        messageId: reaction.message.id,
        userId: user.id,
        emoji: reaction.emoji.name ?? reaction.emoji.id ?? '',
        emojiId: reaction.emoji.id ?? undefined,
      })
    }
    catch (error) {
      console.error('[discord-bot] Failed to forward messageReactionRemove event:', error)
    }
  })
}
