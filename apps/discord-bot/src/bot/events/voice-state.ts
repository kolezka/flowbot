import type { Client } from 'discord.js'
import type { DiscordFlowEventForwarder } from '../../services/flow-events.js'
import { Events } from 'discord.js'

export function registerVoiceStateEvents(client: Client, forwarder: DiscordFlowEventForwarder): void {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const userId = newState.member?.user.id ?? oldState.member?.user.id
    if (!userId) return

    // Ignore bot voice state changes
    if (newState.member?.user.bot || oldState.member?.user.bot) return

    let action: string
    if (!oldState.channelId && newState.channelId) {
      action = 'joined'
    }
    else if (oldState.channelId && !newState.channelId) {
      action = 'left'
    }
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      action = 'moved'
    }
    else {
      // State change (mute, deaf, etc.) — still forward
      action = 'updated'
    }

    try {
      await forwarder.onVoiceStateUpdate({
        guildId: newState.guild.id,
        userId,
        username: newState.member?.user.username ?? '',
        action,
        oldChannelId: oldState.channelId ?? undefined,
        newChannelId: newState.channelId ?? undefined,
        selfMute: newState.selfMute ?? false,
        selfDeaf: newState.selfDeaf ?? false,
        serverMute: newState.serverMute ?? false,
        serverDeaf: newState.serverDeaf ?? false,
        streaming: newState.streaming ?? false,
      })
    }
    catch (error) {
      console.error('[discord-bot] Failed to forward voiceStateUpdate event:', error)
    }
  })
}
