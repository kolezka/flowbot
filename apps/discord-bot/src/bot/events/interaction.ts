import type { Client } from 'discord.js'
import type { DiscordFlowEventForwarder } from '../../services/flow-events.js'
import { Events } from 'discord.js'

export function registerInteractionEvents(client: Client, forwarder: DiscordFlowEventForwarder): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    let interactionType: string
    let interactionData: Record<string, unknown> = {}

    if (interaction.isChatInputCommand()) {
      interactionType = 'slash_command'
      interactionData = {
        commandName: interaction.commandName,
        options: interaction.options.data.map(opt => ({
          name: opt.name,
          value: opt.value,
          type: opt.type,
        })),
      }
    }
    else if (interaction.isButton()) {
      interactionType = 'button'
      interactionData = {
        customId: interaction.customId,
      }
    }
    else if (interaction.isModalSubmit()) {
      interactionType = 'modal_submit'
      interactionData = {
        customId: interaction.customId,
        fields: interaction.fields.fields.map(field => ({
          customId: field.customId,
          value: 'value' in field ? String(field.value) : '',
        })),
      }
    }
    else if (interaction.isStringSelectMenu()) {
      interactionType = 'select_menu'
      interactionData = {
        customId: interaction.customId,
        values: interaction.values,
      }
    }
    else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
      interactionType = 'context_menu'
      interactionData = {
        commandName: interaction.commandName,
        targetId: interaction.targetId,
      }
    }
    else {
      interactionType = 'unknown'
    }

    try {
      await forwarder.onInteractionCreate({
        guildId: interaction.guild?.id ?? '',
        channelId: interaction.channel?.id ?? '',
        userId: interaction.user.id,
        username: interaction.user.username,
        interactionType,
        interactionId: interaction.id,
        ...interactionData,
      })
    }
    catch (error) {
      console.error('[discord-bot] Failed to forward interactionCreate event:', error)
    }
  })
}
