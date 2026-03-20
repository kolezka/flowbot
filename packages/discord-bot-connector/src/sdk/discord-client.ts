import {
  Client,
  ChannelType,
  EmbedBuilder,
  GatewayIntentBits,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from 'discord.js'
import type { GuildChannelTypes, TextChannel, ThreadChannel } from 'discord.js'
import type {
  DiscordChannelOptions,
  DiscordChannelType,
  DiscordEmbedData,
  DiscordInviteOptions,
  DiscordMessageOptions,
  DiscordMessageResult,
  DiscordRoleOptions,
  DiscordScheduledEventOptions,
  DiscordThreadOptions,
  IDiscordBotTransport,
} from './types.js'

const CHANNEL_TYPE_MAP: Record<DiscordChannelType, GuildChannelTypes> = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  announcement: ChannelType.GuildAnnouncement,
  stage: ChannelType.GuildStageVoice,
  forum: ChannelType.GuildForum,
}

function messageToResult(msg: { id: string, channelId: string, createdTimestamp: number }): DiscordMessageResult {
  return {
    id: msg.id,
    channelId: msg.channelId,
    timestamp: msg.createdTimestamp,
  }
}

export class DiscordClient implements IDiscordBotTransport {
  private readonly client: Client
  private readonly token: string
  private _connected = false

  constructor(config: { token: string, intents?: GatewayIntentBits[] }) {
    this.token = config.token
    this.client = new Client({
      intents: config.intents ?? [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
    })
  }

  async connect(): Promise<void> {
    await this.client.login(this.token)
    this._connected = true
  }

  async disconnect(): Promise<void> {
    this.client.destroy()
    this._connected = false
  }

  isConnected(): boolean {
    return this._connected
  }

  getClient(): Client {
    return this.client
  }

  // --- Messaging ---

  async sendMessage(channelId: string, content: string, options?: DiscordMessageOptions): Promise<DiscordMessageResult> {
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

  async sendEmbed(channelId: string, embed: DiscordEmbedData, content?: string): Promise<DiscordMessageResult> {
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

  async sendDM(userId: string, content: string, options?: DiscordMessageOptions): Promise<DiscordMessageResult> {
    const user = await this.client.users.fetch(userId)
    const msg = await user.send({ content, tts: options?.tts })
    return messageToResult(msg)
  }

  // --- Message management ---

  async editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessageResult> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text channel`)
    }
    const msg = await (channel as TextChannel).messages.fetch(messageId)
    const edited = await msg.edit(content)
    return messageToResult(edited)
  }

  async deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text channel`)
    }
    const msg = await (channel as TextChannel).messages.fetch(messageId)
    await msg.delete()
    return true
  }

  async pinMessage(channelId: string, messageId: string): Promise<boolean> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text channel`)
    }
    const msg = await (channel as TextChannel).messages.fetch(messageId)
    await msg.pin()
    return true
  }

  async unpinMessage(channelId: string, messageId: string): Promise<boolean> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text channel`)
    }
    const msg = await (channel as TextChannel).messages.fetch(messageId)
    await msg.unpin()
    return true
  }

  // --- Reactions ---

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text channel`)
    }
    const msg = await (channel as TextChannel).messages.fetch(messageId)
    await msg.react(emoji)
    return true
  }

  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
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

  // --- Member management ---

  async banMember(guildId: string, userId: string, reason?: string, deleteMessageDays?: number): Promise<boolean> {
    const guild = await this.client.guilds.fetch(guildId)
    await guild.members.ban(userId, {
      reason,
      deleteMessageSeconds: deleteMessageDays ? deleteMessageDays * 86400 : undefined,
    })
    return true
  }

  async kickMember(guildId: string, userId: string, reason?: string): Promise<boolean> {
    const guild = await this.client.guilds.fetch(guildId)
    await guild.members.kick(userId, reason)
    return true
  }

  async timeoutMember(guildId: string, userId: string, durationMs: number, reason?: string): Promise<boolean> {
    const guild = await this.client.guilds.fetch(guildId)
    const member = await guild.members.fetch(userId)
    await member.timeout(durationMs, reason)
    return true
  }

  async addRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    const guild = await this.client.guilds.fetch(guildId)
    const member = await guild.members.fetch(userId)
    await member.roles.add(roleId)
    return true
  }

  async removeRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    const guild = await this.client.guilds.fetch(guildId)
    const member = await guild.members.fetch(userId)
    await member.roles.remove(roleId)
    return true
  }

  async setNickname(guildId: string, userId: string, nickname: string): Promise<boolean> {
    const guild = await this.client.guilds.fetch(guildId)
    const member = await guild.members.fetch(userId)
    await member.setNickname(nickname)
    return true
  }

  // --- Channel management ---

  async createChannel(guildId: string, name: string, type: DiscordChannelType, options?: DiscordChannelOptions): Promise<string> {
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

  async deleteChannel(channelId: string): Promise<boolean> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`)
    }
    await channel.delete()
    return true
  }

  async createThread(channelId: string, name: string, options?: DiscordThreadOptions): Promise<string> {
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

  async sendThreadMessage(threadId: string, content: string): Promise<DiscordMessageResult> {
    const thread = await this.client.channels.fetch(threadId) as ThreadChannel
    if (!thread || !thread.isThread()) {
      throw new Error(`Channel ${threadId} is not a thread`)
    }
    const msg = await thread.send(content)
    return messageToResult(msg)
  }

  // --- Guild management ---

  async createRole(guildId: string, name: string, options?: DiscordRoleOptions): Promise<string> {
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

  async createInvite(channelId: string, options?: DiscordInviteOptions): Promise<string> {
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

  async moveMember(guildId: string, userId: string, channelId: string): Promise<boolean> {
    const guild = await this.client.guilds.fetch(guildId)
    const member = await guild.members.fetch(userId)
    await member.voice.setChannel(channelId)
    return true
  }

  async createScheduledEvent(guildId: string, name: string, options: DiscordScheduledEventOptions): Promise<string> {
    const guild = await this.client.guilds.fetch(guildId)
    const entityTypeMap: Record<string, GuildScheduledEventEntityType> = {
      stage: GuildScheduledEventEntityType.StageInstance,
      voice: GuildScheduledEventEntityType.Voice,
      external: GuildScheduledEventEntityType.External,
    }
    const entityType = entityTypeMap[options.entityType]
    if (!entityType) {
      throw new Error(`Unknown event entity type: ${options.entityType}`)
    }
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

  // --- Interactions ---

  async replyInteraction(_interactionId: string, _params: { content?: string, embeds?: unknown[], components?: unknown[], ephemeral?: boolean }): Promise<void> {
    throw new Error('Interaction replies must be handled via bot event handler, not transport')
  }

  async showModal(_interactionId: string, _params: { customId: string, title: string, components: unknown[] }): Promise<void> {
    throw new Error('Modal display must be handled via bot event handler, not transport')
  }

  async sendComponents(channelId: string, params: { content?: string, components: unknown[] }): Promise<DiscordMessageResult> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel?.isTextBased() || !('send' in channel)) {
      throw new Error(`Channel ${channelId} is not a text channel`)
    }
    const msg = await channel.send({
      content: params.content ?? '',
      components: params.components as any,
    })
    return { id: msg.id, channelId: msg.channelId, timestamp: msg.createdTimestamp }
  }

  async editInteraction(_interactionId: string, _params: { content?: string, embeds?: unknown[], components?: unknown[] }): Promise<void> {
    throw new Error('Interaction edits must be handled via bot event handler, not transport')
  }

  async deferReply(_interactionId: string, _ephemeral?: boolean): Promise<void> {
    throw new Error('Defer reply must be handled via bot event handler, not transport')
  }

  // --- Channel permissions & Forums ---

  async setChannelPermissions(channelId: string, targetId: string, allow?: string, deny?: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel || !('permissionOverwrites' in channel)) {
      throw new Error(`Channel ${channelId} does not support permission overwrites`)
    }
    await (channel as any).permissionOverwrites.edit(targetId, {
      ...(allow ? Object.fromEntries(allow.split(',').map(p => [p.trim(), true])) : {}),
      ...(deny ? Object.fromEntries(deny.split(',').map(p => [p.trim(), false])) : {}),
    })
  }

  async createForumPost(channelId: string, params: { name: string, content: string, tags?: string[] }): Promise<string> {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel || channel.type !== 15) { // 15 = GuildForum
      throw new Error(`Channel ${channelId} is not a forum channel`)
    }
    const thread = await (channel as any).threads.create({
      name: params.name,
      message: { content: params.content },
      appliedTags: params.tags,
    })
    return thread.id
  }

  async registerCommands(guildId: string, commands: unknown[]): Promise<void> {
    const guild = await this.client.guilds.fetch(guildId)
    await guild.commands.set(commands as any)
  }
}
