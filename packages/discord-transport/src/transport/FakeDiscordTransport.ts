import type { DiscordChannelOptions, DiscordChannelType, DiscordEmbedData, DiscordInviteOptions, DiscordMessageOptions, DiscordMessageResult, DiscordRoleOptions, DiscordScheduledEventOptions, DiscordThreadOptions, IDiscordTransport } from './IDiscordTransport.js'

export interface SentMessage {
  channelId: string
  content: string
  options?: DiscordMessageOptions
  result: DiscordMessageResult
}

export interface SentEmbed {
  channelId: string
  embed: DiscordEmbedData
  content?: string
  result: DiscordMessageResult
}

export interface SentDM {
  userId: string
  content: string
  options?: DiscordMessageOptions
  result: DiscordMessageResult
}

export interface EditedMessage {
  channelId: string
  messageId: string
  content: string
  result: DiscordMessageResult
}

export interface DeletedMessage {
  channelId: string
  messageId: string
}

export interface PinnedMessage {
  channelId: string
  messageId: string
}

export interface Reaction {
  channelId: string
  messageId: string
  emoji: string
}

export interface BannedMember {
  guildId: string
  userId: string
  reason?: string
  deleteMessageDays?: number
}

export interface KickedMember {
  guildId: string
  userId: string
  reason?: string
}

export interface TimedOutMember {
  guildId: string
  userId: string
  durationMs: number
  reason?: string
}

export interface RoleChange {
  guildId: string
  userId: string
  roleId: string
}

export interface NicknameChange {
  guildId: string
  userId: string
  nickname: string
}

export interface CreatedChannel {
  guildId: string
  name: string
  type: DiscordChannelType
  options?: DiscordChannelOptions
  id: string
}

export interface CreatedThread {
  channelId: string
  name: string
  options?: DiscordThreadOptions
  id: string
}

export interface CreatedRole {
  guildId: string
  name: string
  options?: DiscordRoleOptions
  id: string
}

export interface CreatedInvite {
  channelId: string
  options?: DiscordInviteOptions
  url: string
}

export interface MovedMember {
  guildId: string
  userId: string
  channelId: string
}

export interface CreatedEvent {
  guildId: string
  name: string
  options: DiscordScheduledEventOptions
  id: string
}

export class FakeDiscordTransport implements IDiscordTransport {
  private connected = false
  private nextId = 1
  private sentMessages: SentMessage[] = []
  private sentEmbeds: SentEmbed[] = []
  private sentDMs: SentDM[] = []
  private editedMessages: EditedMessage[] = []
  private deletedMessages: DeletedMessage[] = []
  private pinnedMessages: PinnedMessage[] = []
  private unpinnedMessages: PinnedMessage[] = []
  private addedReactions: Reaction[] = []
  private removedReactions: Reaction[] = []
  private bannedMembers: BannedMember[] = []
  private kickedMembers: KickedMember[] = []
  private timedOutMembers: TimedOutMember[] = []
  private addedRoles: RoleChange[] = []
  private removedRoles: RoleChange[] = []
  private nicknameChanges: NicknameChange[] = []
  private createdChannels: CreatedChannel[] = []
  private deletedChannels: string[] = []
  private createdThreads: CreatedThread[] = []
  private sentThreadMessages: SentMessage[] = []
  private createdRoles: CreatedRole[] = []
  private createdInvites: CreatedInvite[] = []
  private movedMembers: MovedMember[] = []
  private createdEvents: CreatedEvent[] = []

  private generateId(): string {
    return String(this.nextId++)
  }

  private makeResult(channelId: string): DiscordMessageResult {
    return {
      id: this.generateId(),
      channelId,
      timestamp: Date.now(),
    }
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  // --- Messaging ---

  async sendMessage(channelId: string, content: string, options?: DiscordMessageOptions): Promise<DiscordMessageResult> {
    const result = this.makeResult(channelId)
    this.sentMessages.push({ channelId, content, options, result })
    return result
  }

  async sendEmbed(channelId: string, embed: DiscordEmbedData, content?: string): Promise<DiscordMessageResult> {
    const result = this.makeResult(channelId)
    this.sentEmbeds.push({ channelId, embed, content, result })
    return result
  }

  async sendDM(userId: string, content: string, options?: DiscordMessageOptions): Promise<DiscordMessageResult> {
    const result = this.makeResult(`dm-${userId}`)
    this.sentDMs.push({ userId, content, options, result })
    return result
  }

  // --- Message management ---

  async editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessageResult> {
    const result = this.makeResult(channelId)
    this.editedMessages.push({ channelId, messageId, content, result })
    return result
  }

  async deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    this.deletedMessages.push({ channelId, messageId })
    return true
  }

  async pinMessage(channelId: string, messageId: string): Promise<boolean> {
    this.pinnedMessages.push({ channelId, messageId })
    return true
  }

  async unpinMessage(channelId: string, messageId: string): Promise<boolean> {
    this.unpinnedMessages.push({ channelId, messageId })
    return true
  }

  // --- Reactions ---

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
    this.addedReactions.push({ channelId, messageId, emoji })
    return true
  }

  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
    this.removedReactions.push({ channelId, messageId, emoji })
    return true
  }

  // --- Member management ---

  async banMember(guildId: string, userId: string, reason?: string, deleteMessageDays?: number): Promise<boolean> {
    this.bannedMembers.push({ guildId, userId, reason, deleteMessageDays })
    return true
  }

  async kickMember(guildId: string, userId: string, reason?: string): Promise<boolean> {
    this.kickedMembers.push({ guildId, userId, reason })
    return true
  }

  async timeoutMember(guildId: string, userId: string, durationMs: number, reason?: string): Promise<boolean> {
    this.timedOutMembers.push({ guildId, userId, durationMs, reason })
    return true
  }

  async addRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    this.addedRoles.push({ guildId, userId, roleId })
    return true
  }

  async removeRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
    this.removedRoles.push({ guildId, userId, roleId })
    return true
  }

  async setNickname(guildId: string, userId: string, nickname: string): Promise<boolean> {
    this.nicknameChanges.push({ guildId, userId, nickname })
    return true
  }

  // --- Channel management ---

  async createChannel(guildId: string, name: string, type: DiscordChannelType, options?: DiscordChannelOptions): Promise<string> {
    const id = this.generateId()
    this.createdChannels.push({ guildId, name, type, options, id })
    return id
  }

  async deleteChannel(channelId: string): Promise<boolean> {
    this.deletedChannels.push(channelId)
    return true
  }

  async createThread(channelId: string, name: string, options?: DiscordThreadOptions): Promise<string> {
    const id = this.generateId()
    this.createdThreads.push({ channelId, name, options, id })
    return id
  }

  async sendThreadMessage(threadId: string, content: string): Promise<DiscordMessageResult> {
    const result = this.makeResult(threadId)
    this.sentThreadMessages.push({ channelId: threadId, content, result })
    return result
  }

  // --- Guild management ---

  async createRole(guildId: string, name: string, options?: DiscordRoleOptions): Promise<string> {
    const id = this.generateId()
    this.createdRoles.push({ guildId, name, options, id })
    return id
  }

  async createInvite(channelId: string, options?: DiscordInviteOptions): Promise<string> {
    const url = `https://discord.gg/fake_${this.generateId()}`
    this.createdInvites.push({ channelId, options, url })
    return url
  }

  async moveMember(guildId: string, userId: string, channelId: string): Promise<boolean> {
    this.movedMembers.push({ guildId, userId, channelId })
    return true
  }

  async createScheduledEvent(guildId: string, name: string, options: DiscordScheduledEventOptions): Promise<string> {
    const id = this.generateId()
    this.createdEvents.push({ guildId, name, options, id })
    return id
  }

  // --- Getters for test assertions ---

  getSentMessages(): readonly SentMessage[] {
    return this.sentMessages
  }

  getSentEmbeds(): readonly SentEmbed[] {
    return this.sentEmbeds
  }

  getSentDMs(): readonly SentDM[] {
    return this.sentDMs
  }

  getEditedMessages(): readonly EditedMessage[] {
    return this.editedMessages
  }

  getDeletedMessages(): readonly DeletedMessage[] {
    return this.deletedMessages
  }

  getPinnedMessages(): readonly PinnedMessage[] {
    return this.pinnedMessages
  }

  getUnpinnedMessages(): readonly PinnedMessage[] {
    return this.unpinnedMessages
  }

  getAddedReactions(): readonly Reaction[] {
    return this.addedReactions
  }

  getRemovedReactions(): readonly Reaction[] {
    return this.removedReactions
  }

  getBannedMembers(): readonly BannedMember[] {
    return this.bannedMembers
  }

  getKickedMembers(): readonly KickedMember[] {
    return this.kickedMembers
  }

  getTimedOutMembers(): readonly TimedOutMember[] {
    return this.timedOutMembers
  }

  getAddedRoles(): readonly RoleChange[] {
    return this.addedRoles
  }

  getRemovedRoles(): readonly RoleChange[] {
    return this.removedRoles
  }

  getNicknameChanges(): readonly NicknameChange[] {
    return this.nicknameChanges
  }

  getCreatedChannels(): readonly CreatedChannel[] {
    return this.createdChannels
  }

  getDeletedChannels(): readonly string[] {
    return this.deletedChannels
  }

  getCreatedThreads(): readonly CreatedThread[] {
    return this.createdThreads
  }

  getSentThreadMessages(): readonly SentMessage[] {
    return this.sentThreadMessages
  }

  getCreatedRoles(): readonly CreatedRole[] {
    return this.createdRoles
  }

  getCreatedInvites(): readonly CreatedInvite[] {
    return this.createdInvites
  }

  getMovedMembers(): readonly MovedMember[] {
    return this.movedMembers
  }

  getCreatedEvents(): readonly CreatedEvent[] {
    return this.createdEvents
  }

  reset(): void {
    this.sentMessages = []
    this.sentEmbeds = []
    this.sentDMs = []
    this.editedMessages = []
    this.deletedMessages = []
    this.pinnedMessages = []
    this.unpinnedMessages = []
    this.addedReactions = []
    this.removedReactions = []
    this.bannedMembers = []
    this.kickedMembers = []
    this.timedOutMembers = []
    this.addedRoles = []
    this.removedRoles = []
    this.nicknameChanges = []
    this.createdChannels = []
    this.deletedChannels = []
    this.createdThreads = []
    this.sentThreadMessages = []
    this.createdRoles = []
    this.createdInvites = []
    this.movedMembers = []
    this.createdEvents = []
    this.nextId = 1
  }

  // SP2: Interactions
  async replyInteraction(_interactionId: string, _params: { content?: string, embeds?: unknown[], components?: unknown[], ephemeral?: boolean }): Promise<void> {}

  async showModal(_interactionId: string, _params: { customId: string, title: string, components: unknown[] }): Promise<void> {}

  async sendComponents(channelId: string, _params: { content?: string, components: unknown[] }): Promise<DiscordMessageResult> {
    return { id: String(this.nextId++), channelId, timestamp: Date.now() }
  }

  async editInteraction(_interactionId: string, _params: { content?: string, embeds?: unknown[], components?: unknown[] }): Promise<void> {}

  async deferReply(_interactionId: string, _ephemeral?: boolean): Promise<void> {}

  // SP2: Channel permissions & Forums
  async setChannelPermissions(_channelId: string, _targetId: string, _allow?: string, _deny?: string): Promise<void> {}

  async createForumPost(_channelId: string, _params: { name: string, content: string, tags?: string[] }): Promise<string> {
    return String(this.nextId++)
  }

  async registerCommands(_guildId: string, _commands: unknown[]): Promise<void> {}
}
