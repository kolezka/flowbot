import type { EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import type { Client } from 'discord.js'
import { Events } from 'discord.js'
import {
  mapMessageEvent,
  mapMemberJoinEvent,
  mapMemberLeaveEvent,
  mapInteractionEvent,
  mapReactionAddEvent,
  mapReactionRemoveEvent,
  mapVoiceStateEvent,
} from './mapper.js'

export function registerEventListeners(
  client: Client,
  forwarder: EventForwarder,
  botInstanceId: string,
  logger: Logger,
): void {
  // --- Incoming messages ---
  client.on(Events.MessageCreate, async (message) => {
    try {
      const event = mapMessageEvent(message, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward messageCreate event')
    }
  })

  // --- Member join ---
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const event = mapMemberJoinEvent(member, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward guildMemberAdd event')
    }
  })

  // --- Member leave ---
  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const event = mapMemberLeaveEvent(member, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward guildMemberRemove event')
    }
  })

  // --- Interactions ---
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      const event = mapInteractionEvent(interaction, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward interactionCreate event')
    }
  })

  // --- Reaction add ---
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (reaction.partial) {
        await reaction.fetch()
      }
      const event = mapReactionAddEvent(reaction, user, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward messageReactionAdd event')
    }
  })

  // --- Reaction remove ---
  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
      if (reaction.partial) {
        await reaction.fetch()
      }
      const event = mapReactionRemoveEvent(reaction, user, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward messageReactionRemove event')
    }
  })

  // --- Voice state updates ---
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      const event = mapVoiceStateEvent(oldState, newState, botInstanceId)
      if (event) {
        await forwarder.send(event)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to forward voiceStateUpdate event')
    }
  })

  logger.info('Discord event listeners registered')
}
