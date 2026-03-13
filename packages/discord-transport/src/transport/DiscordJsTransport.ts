import { Client, ChannelType, GatewayIntentBits, EmbedBuilder, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from 'discord.js'
import type { GuildChannelTypes, TextChannel, ThreadChannel } from 'discord.js'

import type { DiscordChannelOptions, DiscordChannelType, DiscordEmbedData, DiscordInviteOptions, DiscordMessageOptions, DiscordMessageResult, DiscordRoleOptions, DiscordScheduledEventOptions, DiscordThreadOptions, IDiscordTransport } from './IDiscordTransport.js'
import { TransportError } from './errors.js'

const CHANNEL_TYPE_MAP: Record<DiscordChannelType, GuildChannelTypes> = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  announcement: ChannelType.GuildAnnouncement,
  stage: ChannelType.GuildStageVoice,
  forum: ChannelType.GuildForum,
}

function resolveEventEntityType(type: string): GuildScheduledEventEntityType {
  switch (type) {
    case 'stage': return GuildScheduledEventEntityType.StageInstance
    case 'voice': return GuildScheduledEventEntityType.Voice
    case 'external': return GuildScheduledEventEntityType.External
    default: throw new TransportError(`Unknown event entity type: ${type}`)
  }
}

function messageToResult(msg: { id: string, channelId: string, createdTimestamp: number }): DiscordMessageResult {
  return {
    id: msg.id,
    channelId: msg.channelId,
    timestamp: msg.createdTimestamp,
  }
}

export class DiscordJsTransport implements IDiscordTransport {
  private readonly client: Client
  private readonly token: string
  private connected = false

  constructor(config: { token: string, intents?: GatewayIntentBits[] }) {
    this.token = config.token
    this.client = new Client({
      intents: config.intents ?? [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
      ],
    })
  }

  async connect(): Promise<void> {
    try {
      await this.client.login(this.token)
      this.connected = true
    }
    catch (error) {
      throw new TransportError('Failed to connect to Discord', error)
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.client.destroy()
      this.connected = false
    }
    catch (error) {
      throw new TransportError('Failed to disconnect from Discord', error)
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  // --- Messaging ---

  async sendMessage(channelId: string, content: string, options?: DiscordMessageOptions): Promise<DiscordMessageResult> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const msg = await (channel as TextChannel).send({
        content,
        tts: options?.tts,
        reply: options?.replyToMessageId ? { messageReference: options.replyToMessageId } : undefined,
        flags: options?.suppressEmbeds ? [4096] : undefined,
      })
      return messageToResult(msg)
    }
    catch (error) {
      throw new TransportError('Failed to send message', error)
    }
  }

  async sendEmbed(channelId: string, embed: DiscordEmbedData, content?: string): Promise<DiscordMessageResult> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const embedBuilder = new EmbedBuilder()
      if (embed.title) embedBuilder.setTitle(embed.title)
      if (embed.description) embedBuilder.setDescription(embed.description)
      if (embed.url) embedBuilder.setURL(embed.url)
      if (embed.color !== undefined) embedBuilder.setColor(embed.color)
      if (embed.timestamp) embedBuilder.setTimestamp(new Date(embed.timestamp))
      if (embed.footer) embedBuilder.setFooter(embed.footer)
      if (embed.thumbnail) embedBuilder.setThumbnail(embed.thumbnail.url)
      if (embed.image) embedBuilder.setImage(embed.image.url)
      if (embed.author) embedBuilder.setAuthor(embed.author)
      if (embed.fields) embedBuilder.addFields(embed.fields)

      const msg = await (channel as TextChannel).send({
        content: content ?? undefined,
        embeds: [embedBuilder],
      })
      return messageToResult(msg)
    }
    catch (error) {
      throw new TransportError('Failed to send embed', error)
    }
  }

  async sendDM(userId: string, content: string, options?: DiscordMessageOptions): Promise<DiscordMessageResult> {
    try {
      const user = await this.client.users.fetch(userId)
      const msg = await user.send({
        content,
        tts: options?.tts,
      })
      return messageToResult(msg)
    }
    catch (error) {
      throw new TransportError('Failed to send DM', error)
    }
  }

  // --- Message management ---

  async editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessageResult> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const msg = await (channel as TextChannel).messages.fetch(messageId)
      const edited = await msg.edit(content)
      return messageToResult(edited)
    }
    catch (error) {
      throw new TransportError('Failed to edit message', error)
    }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const msg = await (channel as TextChannel).messages.fetch(messageId)
      await msg.delete()
      return true
    }
    catch (error) {
      throw new TransportError('Failed to delete message', error)
    }
  }

  async pinMessage(channelId: string, messageId: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const msg = await (channel as TextChannel).messages.fetch(messageId)
      await msg.pin()
      return true
    }
    catch (error) {
      throw new TransportError('Failed to pin message', error)
    }
  }

  async unpinMessage(channelId: string, messageId: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const msg = await (channel as TextChannel).messages.fetch(messageId)
      await msg.unpin()
      return true
    }
    catch (error) {
      throw new TransportError('Failed to unpin message', error)
    }
  }

  // --- Reactions ---

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const msg = await (channel as TextChannel).messages.fetch(messageId)
      await msg.react(emoji)
      return true
    }
    catch (error) {
      throw new TransportError('Failed to add reaction', error)
    }
  }

  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const msg = await (channel as TextChannel).messages.fetch(messageId)
      const reaction = msg.reactions.cache.get(emoji)
      if (reaction) {
        await reaction.users.remove(this.client.user!.id)
      }
      return true
    }
    catch (error) {
      throw new TransportError('Failed to remove reaction', error)
    }
  }

  // --- Member management ---

  async banMember(guildId: string, userId: string, reason?: string, deleteMessageDays?: number): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      await guild.members.ban(userId, {
        reason,
        deleteMessageSeconds: deleteMessageDays ? deleteMessageDays * 86400 : undefined,
      })
      return true
    }
    catch (error) {
      throw new TransportError('Failed to ban member', error)
    }
  }

  async kickMember(guildId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      await guild.members.kick(userId, reason)
      return true
    }
    catch (error) {
      throw new TransportError('Failed to kick member', error)
    }
  }

  async timeoutMember(guildId: string, userId: string, durationMs: number, reason?: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      const member = await guild.members.fetch(userId)
      await member.timeout(durationMs, reason)
      return true
    }
    catch (error) {
      throw new TransportError('Failed to timeout member', error)
    }
  }

  async addRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      const member = await guild.members.fetch(userId)
      await member.roles.add(roleId)
      return true
    }
    catch (error) {
      throw new TransportError('Failed to add role', error)
    }
  }

  async removeRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      const member = await guild.members.fetch(userId)
      await member.roles.remove(roleId)
      return true
    }
    catch (error) {
      throw new TransportError('Failed to remove role', error)
    }
  }

  async setNickname(guildId: string, userId: string, nickname: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      const member = await guild.members.fetch(userId)
      await member.setNickname(nickname)
      return true
    }
    catch (error) {
      throw new TransportError('Failed to set nickname', error)
    }
  }

  // --- Channel management ---

  async createChannel(guildId: string, name: string, type: DiscordChannelType, options?: DiscordChannelOptions): Promise<string> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      const channel = await guild.channels.create({
        name,
        type: CHANNEL_TYPE_MAP[type],
        topic: options?.topic,
        nsfw: options?.nsfw,
        parent: options?.parentId,
        rateLimitPerUser: options?.rateLimitPerUser,
        bitrate: options?.bitrate,
        userLimit: options?.userLimit,
        position: options?.position,
      })
      return channel.id
    }
    catch (error) {
      throw new TransportError('Failed to create channel', error)
    }
  }

  async deleteChannel(channelId: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`)
      }
      await channel.delete()
      return true
    }
    catch (error) {
      throw new TransportError('Failed to delete channel', error)
    }
  }

  async createThread(channelId: string, name: string, options?: DiscordThreadOptions): Promise<string> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`)
      }
      const thread = await (channel as TextChannel).threads.create({
        name,
        autoArchiveDuration: options?.autoArchiveDuration,
        rateLimitPerUser: options?.rateLimitPerUser,
        reason: options?.reason,
      })
      return thread.id
    }
    catch (error) {
      throw new TransportError('Failed to create thread', error)
    }
  }

  async sendThreadMessage(threadId: string, content: string): Promise<DiscordMessageResult> {
    try {
      const thread = await this.client.channels.fetch(threadId) as ThreadChannel
      if (!thread || !thread.isThread()) {
        throw new Error(`Channel ${threadId} is not a thread`)
      }
      const msg = await thread.send(content)
      return messageToResult(msg)
    }
    catch (error) {
      throw new TransportError('Failed to send thread message', error)
    }
  }

  // --- Guild management ---

  async createRole(guildId: string, name: string, options?: DiscordRoleOptions): Promise<string> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      const role = await guild.roles.create({
        name,
        color: options?.color,
        hoist: options?.hoist,
        mentionable: options?.mentionable,
        permissions: options?.permissions,
        reason: options?.reason,
      })
      return role.id
    }
    catch (error) {
      throw new TransportError('Failed to create role', error)
    }
  }

  async createInvite(channelId: string, options?: DiscordInviteOptions): Promise<string> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !('createInvite' in channel)) {
        throw new Error(`Channel ${channelId} does not support invites`)
      }
      const invite = await (channel as TextChannel).createInvite({
        maxAge: options?.maxAge,
        maxUses: options?.maxUses,
        temporary: options?.temporary,
        unique: options?.unique,
        reason: options?.reason,
      })
      return invite.url
    }
    catch (error) {
      throw new TransportError('Failed to create invite', error)
    }
  }

  async moveMember(guildId: string, userId: string, channelId: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      const member = await guild.members.fetch(userId)
      await member.voice.setChannel(channelId)
      return true
    }
    catch (error) {
      throw new TransportError('Failed to move member', error)
    }
  }

  async createScheduledEvent(guildId: string, name: string, options: DiscordScheduledEventOptions): Promise<string> {
    try {
      const guild = await this.client.guilds.fetch(guildId)
      const entityType = resolveEventEntityType(options.entityType)
      const event = await guild.scheduledEvents.create({
        name,
        description: options.description,
        scheduledStartTime: options.scheduledStartTime,
        scheduledEndTime: options.scheduledEndTime,
        entityType,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        channel: options.channelId,
        entityMetadata: options.location ? { location: options.location } : undefined,
      })
      return event.id
    }
    catch (error) {
      throw new TransportError('Failed to create scheduled event', error)
    }
  }
}
