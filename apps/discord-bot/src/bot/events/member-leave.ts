import type { Client } from 'discord.js'
import type { DiscordFlowEventForwarder } from '../../services/flow-events.js'
import { Events } from 'discord.js'

export function registerMemberLeaveEvents(client: Client, forwarder: DiscordFlowEventForwarder): void {
  client.on(Events.GuildMemberRemove, async (member) => {
    if (member.user.bot) return

    try {
      await forwarder.onMemberLeave({
        guildId: member.guild.id,
        userId: member.user.id,
        username: member.user.username,
        displayName: member.displayName,
      })
    }
    catch (error) {
      console.error('[discord-bot] Failed to forward guildMemberRemove event:', error)
    }
  })
}
