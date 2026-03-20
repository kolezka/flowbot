/**
 * Maps discord.js event objects into the standardized FlowTriggerEvent format
 * used by the flow engine.
 */

import type { FlowTriggerEvent } from '@flowbot/platform-kit'
import type {
  Message,
  GuildMember,
  PartialGuildMember,
  Interaction,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  VoiceState,
} from 'discord.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString()
}

// ---------------------------------------------------------------------------
// Message received
// ---------------------------------------------------------------------------

export interface DiscordMessageEventData {
  messageId: string
  channelId: string
  guildId: string
  content: string
  authorId: string
  authorUsername: string
  hasAttachments: boolean
  attachmentCount: number
}

export function mapMessageEvent(message: Message, botInstanceId: string): FlowTriggerEvent | null {
  if (message.author.bot) return null
  if (!message.guild) return null

  const data: DiscordMessageEventData = {
    messageId: message.id,
    channelId: message.channel.id,
    guildId: message.guild.id,
    content: message.content,
    authorId: message.author.id,
    authorUsername: message.author.username,
    hasAttachments: message.attachments.size > 0,
    attachmentCount: message.attachments.size,
  }

  return {
    platform: 'discord',
    communityId: message.guild.id,
    accountId: message.author.id,
    eventType: 'message_received',
    data,
    timestamp: nowIso(),
    botInstanceId,
  }
}

// ---------------------------------------------------------------------------
// Member join
// ---------------------------------------------------------------------------

export interface DiscordMemberJoinEventData {
  guildId: string
  userId: string
  username: string
  displayName: string
  accountCreatedAt: string
}

export function mapMemberJoinEvent(
  member: GuildMember | PartialGuildMember,
  botInstanceId: string,
): FlowTriggerEvent | null {
  if (member.user.bot) return null

  const data: DiscordMemberJoinEventData = {
    guildId: member.guild.id,
    userId: member.user.id,
    username: member.user.username,
    displayName: member.displayName,
    accountCreatedAt: member.user.createdAt.toISOString(),
  }

  return {
    platform: 'discord',
    communityId: member.guild.id,
    accountId: member.user.id,
    eventType: 'member_join',
    data,
    timestamp: nowIso(),
    botInstanceId,
  }
}

// ---------------------------------------------------------------------------
// Member leave
// ---------------------------------------------------------------------------

export interface DiscordMemberLeaveEventData {
  guildId: string
  userId: string
  username: string
  displayName: string
}

export function mapMemberLeaveEvent(
  member: GuildMember | PartialGuildMember,
  botInstanceId: string,
): FlowTriggerEvent | null {
  if (member.user.bot) return null

  const data: DiscordMemberLeaveEventData = {
    guildId: member.guild.id,
    userId: member.user.id,
    username: member.user.username,
    displayName: member.displayName,
  }

  return {
    platform: 'discord',
    communityId: member.guild.id,
    accountId: member.user.id,
    eventType: 'member_leave',
    data,
    timestamp: nowIso(),
    botInstanceId,
  }
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

export interface DiscordInteractionEventData {
  guildId: string | null
  channelId: string | null
  userId: string
  username: string
  interactionType: string
  interactionId: string
  [key: string]: unknown
}

export function mapInteractionEvent(interaction: Interaction, botInstanceId: string): FlowTriggerEvent | null {
  let interactionType: string
  const extra: Record<string, unknown> = {}

  if (interaction.isChatInputCommand()) {
    interactionType = 'slash_command'
    extra['commandName'] = interaction.commandName
    extra['options'] = interaction.options.data.map(opt => ({
      name: opt.name,
      value: opt.value,
      type: opt.type,
    }))
  } else if (interaction.isButton()) {
    interactionType = 'button'
    extra['customId'] = interaction.customId
  } else if (interaction.isModalSubmit()) {
    interactionType = 'modal_submit'
    extra['customId'] = interaction.customId
    extra['fields'] = interaction.fields.fields.map(field => ({
      customId: field.customId,
      value: 'value' in field ? String(field.value) : '',
    }))
  } else if (interaction.isStringSelectMenu()) {
    interactionType = 'select_menu'
    extra['customId'] = interaction.customId
    extra['values'] = interaction.values
  } else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
    interactionType = 'context_menu'
    extra['commandName'] = interaction.commandName
    extra['targetId'] = interaction.targetId
  } else {
    interactionType = 'unknown'
  }

  const data: DiscordInteractionEventData = {
    guildId: interaction.guild?.id ?? null,
    channelId: interaction.channel?.id ?? null,
    userId: interaction.user.id,
    username: interaction.user.username,
    interactionType,
    interactionId: interaction.id,
    ...extra,
  }

  return {
    platform: 'discord',
    communityId: interaction.guild?.id ?? null,
    accountId: interaction.user.id,
    eventType: 'interaction',
    data,
    timestamp: nowIso(),
    botInstanceId,
  }
}

// ---------------------------------------------------------------------------
// Reaction add / remove
// ---------------------------------------------------------------------------

export interface DiscordReactionEventData {
  guildId: string | null
  channelId: string
  messageId: string
  userId: string
  emoji: string
  emojiId?: string
}

export function mapReactionAddEvent(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  botInstanceId: string,
): FlowTriggerEvent | null {
  if (user.bot) return null

  const data: DiscordReactionEventData = {
    guildId: reaction.message.guild?.id ?? null,
    channelId: reaction.message.channel.id,
    messageId: reaction.message.id,
    userId: user.id,
    emoji: reaction.emoji.name ?? reaction.emoji.id ?? '',
    emojiId: reaction.emoji.id ?? undefined,
  }

  return {
    platform: 'discord',
    communityId: reaction.message.guild?.id ?? null,
    accountId: user.id,
    eventType: 'reaction_add',
    data,
    timestamp: nowIso(),
    botInstanceId,
  }
}

export function mapReactionRemoveEvent(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  botInstanceId: string,
): FlowTriggerEvent | null {
  if (user.bot) return null

  const data: DiscordReactionEventData = {
    guildId: reaction.message.guild?.id ?? null,
    channelId: reaction.message.channel.id,
    messageId: reaction.message.id,
    userId: user.id,
    emoji: reaction.emoji.name ?? reaction.emoji.id ?? '',
    emojiId: reaction.emoji.id ?? undefined,
  }

  return {
    platform: 'discord',
    communityId: reaction.message.guild?.id ?? null,
    accountId: user.id,
    eventType: 'reaction_remove',
    data,
    timestamp: nowIso(),
    botInstanceId,
  }
}

// ---------------------------------------------------------------------------
// Voice state update
// ---------------------------------------------------------------------------

export interface DiscordVoiceStateEventData {
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
}

export function mapVoiceStateEvent(
  oldState: VoiceState,
  newState: VoiceState,
  botInstanceId: string,
): FlowTriggerEvent | null {
  const userId = newState.member?.user.id ?? oldState.member?.user.id
  if (!userId) return null
  if (newState.member?.user.bot || oldState.member?.user.bot) return null

  let action: string
  if (!oldState.channelId && newState.channelId) {
    action = 'joined'
  } else if (oldState.channelId && !newState.channelId) {
    action = 'left'
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    action = 'moved'
  } else {
    action = 'updated'
  }

  const data: DiscordVoiceStateEventData = {
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
  }

  return {
    platform: 'discord',
    communityId: newState.guild.id,
    accountId: userId,
    eventType: 'voice_state_update',
    data,
    timestamp: nowIso(),
    botInstanceId,
  }
}
