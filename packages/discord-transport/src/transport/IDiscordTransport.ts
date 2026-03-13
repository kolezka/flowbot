export interface DiscordMessageOptions {
  replyToMessageId?: string
  tts?: boolean
  suppressEmbeds?: boolean
}

export interface DiscordEmbedData {
  title?: string
  description?: string
  url?: string
  color?: number
  timestamp?: string
  footer?: { text: string, iconURL?: string }
  thumbnail?: { url: string }
  image?: { url: string }
  author?: { name: string, iconURL?: string, url?: string }
  fields?: { name: string, value: string, inline?: boolean }[]
}

export type DiscordChannelType = 'text' | 'voice' | 'category' | 'announcement' | 'stage' | 'forum'

export interface DiscordChannelOptions {
  topic?: string
  nsfw?: boolean
  parentId?: string
  rateLimitPerUser?: number
  bitrate?: number
  userLimit?: number
  position?: number
}

export interface DiscordThreadOptions {
  autoArchiveDuration?: 60 | 1440 | 4320 | 10080
  rateLimitPerUser?: number
  reason?: string
}

export interface DiscordRoleOptions {
  color?: number
  hoist?: boolean
  mentionable?: boolean
  permissions?: bigint
  reason?: string
}

export interface DiscordInviteOptions {
  maxAge?: number
  maxUses?: number
  temporary?: boolean
  unique?: boolean
  reason?: string
}

export interface DiscordScheduledEventOptions {
  description?: string
  scheduledStartTime: Date
  scheduledEndTime?: Date
  entityType: 'stage' | 'voice' | 'external'
  channelId?: string
  location?: string
}

export interface DiscordMessageResult {
  id: string
  channelId: string
  timestamp: number
}

export interface IDiscordTransport {
  // Connection
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  isConnected: () => boolean

  // Messaging
  sendMessage: (channelId: string, content: string, options?: DiscordMessageOptions) => Promise<DiscordMessageResult>
  sendEmbed: (channelId: string, embed: DiscordEmbedData, content?: string) => Promise<DiscordMessageResult>
  sendDM: (userId: string, content: string, options?: DiscordMessageOptions) => Promise<DiscordMessageResult>

  // Message management
  editMessage: (channelId: string, messageId: string, content: string) => Promise<DiscordMessageResult>
  deleteMessage: (channelId: string, messageId: string) => Promise<boolean>
  pinMessage: (channelId: string, messageId: string) => Promise<boolean>
  unpinMessage: (channelId: string, messageId: string) => Promise<boolean>

  // Reactions
  addReaction: (channelId: string, messageId: string, emoji: string) => Promise<boolean>
  removeReaction: (channelId: string, messageId: string, emoji: string) => Promise<boolean>

  // Member management
  banMember: (guildId: string, userId: string, reason?: string, deleteMessageDays?: number) => Promise<boolean>
  kickMember: (guildId: string, userId: string, reason?: string) => Promise<boolean>
  timeoutMember: (guildId: string, userId: string, durationMs: number, reason?: string) => Promise<boolean>
  addRole: (guildId: string, userId: string, roleId: string) => Promise<boolean>
  removeRole: (guildId: string, userId: string, roleId: string) => Promise<boolean>
  setNickname: (guildId: string, userId: string, nickname: string) => Promise<boolean>

  // Channel management
  createChannel: (guildId: string, name: string, type: DiscordChannelType, options?: DiscordChannelOptions) => Promise<string>
  deleteChannel: (channelId: string) => Promise<boolean>
  createThread: (channelId: string, name: string, options?: DiscordThreadOptions) => Promise<string>
  sendThreadMessage: (threadId: string, content: string) => Promise<DiscordMessageResult>

  // Guild management
  createRole: (guildId: string, name: string, options?: DiscordRoleOptions) => Promise<string>
  createInvite: (channelId: string, options?: DiscordInviteOptions) => Promise<string>
  moveMember: (guildId: string, userId: string, channelId: string) => Promise<boolean>
  createScheduledEvent: (guildId: string, name: string, options: DiscordScheduledEventOptions) => Promise<string>
}
