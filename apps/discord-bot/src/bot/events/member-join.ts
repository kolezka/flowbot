import type { Client } from 'discord.js'
import type { DiscordFlowEventForwarder } from '../../services/flow-events.js'
import { Events } from 'discord.js'

export function registerMemberJoinEvents(client: Client, forwarder: DiscordFlowEventForwarder): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return

    try {
      await forwarder.onMemberJoin({
        guildId: member.guild.id,
        userId: member.user.id,
        username: member.user.username,
        displayName: member.displayName,
        accountCreatedAt: member.user.createdAt.toISOString(),
      })
    }
    catch (error) {
      console.error('[discord-bot] Failed to forward guildMemberAdd event:', error)
    }
  })
}
