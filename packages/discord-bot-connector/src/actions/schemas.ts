import * as v from 'valibot'

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export const sendMessageSchema = v.object({
  channelId: v.string(),
  content: v.string(),
  replyToMessageId: v.optional(v.string()),
  tts: v.optional(v.boolean()),
  suppressEmbeds: v.optional(v.boolean()),
})

export const sendEmbedSchema = v.object({
  channelId: v.string(),
  embed: v.object({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    color: v.optional(v.number()),
    timestamp: v.optional(v.string()),
    fields: v.optional(v.array(v.object({
      name: v.string(),
      value: v.string(),
      inline: v.optional(v.boolean()),
    }))),
  }),
  content: v.optional(v.string()),
})

export const sendDMSchema = v.object({
  userId: v.string(),
  content: v.string(),
  tts: v.optional(v.boolean()),
})

// ---------------------------------------------------------------------------
// Message management
// ---------------------------------------------------------------------------

export const editMessageSchema = v.object({
  channelId: v.string(),
  messageId: v.string(),
  content: v.string(),
})

export const deleteMessageSchema = v.object({
  channelId: v.string(),
  messageId: v.string(),
})

export const pinMessageSchema = v.object({
  channelId: v.string(),
  messageId: v.string(),
})

export const unpinMessageSchema = v.object({
  channelId: v.string(),
  messageId: v.string(),
})

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export const addReactionSchema = v.object({
  channelId: v.string(),
  messageId: v.string(),
  emoji: v.string(),
})

export const removeReactionSchema = v.object({
  channelId: v.string(),
  messageId: v.string(),
  emoji: v.string(),
})

// ---------------------------------------------------------------------------
// Member management (Admin)
// ---------------------------------------------------------------------------

export const banMemberSchema = v.object({
  guildId: v.string(),
  userId: v.string(),
  reason: v.optional(v.string()),
  deleteMessageDays: v.optional(v.number()),
})

export const kickMemberSchema = v.object({
  guildId: v.string(),
  userId: v.string(),
  reason: v.optional(v.string()),
})

export const timeoutMemberSchema = v.object({
  guildId: v.string(),
  userId: v.string(),
  durationMs: v.number(),
  reason: v.optional(v.string()),
})

export const addRoleSchema = v.object({
  guildId: v.string(),
  userId: v.string(),
  roleId: v.string(),
})

export const removeRoleSchema = v.object({
  guildId: v.string(),
  userId: v.string(),
  roleId: v.string(),
})

export const setNicknameSchema = v.object({
  guildId: v.string(),
  userId: v.string(),
  nickname: v.string(),
})

// ---------------------------------------------------------------------------
// Channel management
// ---------------------------------------------------------------------------

export const createChannelSchema = v.object({
  guildId: v.string(),
  name: v.string(),
  type: v.optional(v.picklist(['text', 'voice', 'category', 'announcement', 'stage', 'forum'] as const)),
  topic: v.optional(v.string()),
  nsfw: v.optional(v.boolean()),
  parentId: v.optional(v.string()),
  rateLimitPerUser: v.optional(v.number()),
  bitrate: v.optional(v.number()),
  userLimit: v.optional(v.number()),
  position: v.optional(v.number()),
})

export const deleteChannelSchema = v.object({
  channelId: v.string(),
})

export const createThreadSchema = v.object({
  channelId: v.string(),
  name: v.string(),
  autoArchiveDuration: v.optional(v.picklist([60, 1440, 4320, 10080] as const)),
  rateLimitPerUser: v.optional(v.number()),
  reason: v.optional(v.string()),
})

export const sendThreadMessageSchema = v.object({
  threadId: v.string(),
  content: v.string(),
})

// ---------------------------------------------------------------------------
// Guild management
// ---------------------------------------------------------------------------

export const createRoleSchema = v.object({
  guildId: v.string(),
  name: v.string(),
  color: v.optional(v.number()),
  hoist: v.optional(v.boolean()),
  mentionable: v.optional(v.boolean()),
  reason: v.optional(v.string()),
})

export const createInviteSchema = v.object({
  channelId: v.string(),
  maxAge: v.optional(v.number()),
  maxUses: v.optional(v.number()),
  temporary: v.optional(v.boolean()),
  unique: v.optional(v.boolean()),
  reason: v.optional(v.string()),
})

export const moveMemberSchema = v.object({
  guildId: v.string(),
  userId: v.string(),
  channelId: v.string(),
})

export const createScheduledEventSchema = v.object({
  guildId: v.string(),
  name: v.string(),
  scheduledStartTime: v.string(),
  scheduledEndTime: v.optional(v.string()),
  entityType: v.picklist(['stage', 'voice', 'external'] as const),
  channelId: v.optional(v.string()),
  location: v.optional(v.string()),
  description: v.optional(v.string()),
})
