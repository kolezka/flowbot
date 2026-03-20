import * as v from 'valibot'

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export const sendMessageSchema = v.object({
  chatId: v.string(),
  text: v.string(),
  parseMode: v.optional(v.picklist(['HTML', 'MarkdownV2'])),
  disableNotification: v.optional(v.boolean()),
  replyToMessageId: v.optional(v.number()),
})

export const sendPhotoSchema = v.object({
  chatId: v.string(),
  photoUrl: v.string(),
  caption: v.optional(v.string()),
  parseMode: v.optional(v.picklist(['HTML', 'MarkdownV2'])),
})

export const sendVideoSchema = v.object({
  chatId: v.string(),
  videoUrl: v.string(),
  caption: v.optional(v.string()),
  parseMode: v.optional(v.picklist(['HTML', 'MarkdownV2'])),
})

export const sendDocumentSchema = v.object({
  chatId: v.string(),
  documentUrl: v.string(),
  fileName: v.optional(v.string()),
  caption: v.optional(v.string()),
  parseMode: v.optional(v.picklist(['HTML', 'MarkdownV2'])),
})

export const sendAudioSchema = v.object({
  chatId: v.string(),
  audioUrl: v.string(),
  caption: v.optional(v.string()),
  parseMode: v.optional(v.picklist(['HTML', 'MarkdownV2'])),
})

export const sendVoiceSchema = v.object({
  chatId: v.string(),
  voiceUrl: v.string(),
  caption: v.optional(v.string()),
})

export const sendStickerSchema = v.object({
  chatId: v.string(),
  sticker: v.string(),
})

export const sendLocationSchema = v.object({
  chatId: v.string(),
  latitude: v.number(),
  longitude: v.number(),
})

export const sendContactSchema = v.object({
  chatId: v.string(),
  phoneNumber: v.string(),
  firstName: v.string(),
  lastName: v.optional(v.string()),
})

export const sendPollSchema = v.object({
  chatId: v.string(),
  question: v.string(),
  options: v.array(v.string()),
  isAnonymous: v.optional(v.boolean()),
  allowsMultipleAnswers: v.optional(v.boolean()),
  pollType: v.optional(v.picklist(['regular', 'quiz'])),
})

// ---------------------------------------------------------------------------
// Edit / Delete / Pin
// ---------------------------------------------------------------------------

export const editMessageSchema = v.object({
  chatId: v.string(),
  messageId: v.number(),
  text: v.string(),
  parseMode: v.optional(v.picklist(['HTML', 'MarkdownV2'])),
})

export const deleteMessageSchema = v.object({
  chatId: v.string(),
  messageId: v.number(),
})

export const pinMessageSchema = v.object({
  chatId: v.string(),
  messageId: v.number(),
  disableNotification: v.optional(v.boolean()),
})

export const unpinMessageSchema = v.object({
  chatId: v.string(),
  messageId: v.optional(v.number()),
})

export const replyToMessageSchema = v.object({
  chatId: v.string(),
  messageId: v.number(),
  text: v.string(),
  parseMode: v.optional(v.picklist(['HTML', 'MarkdownV2'])),
  disableNotification: v.optional(v.boolean()),
})

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const banUserSchema = v.object({
  chatId: v.string(),
  userId: v.number(),
})

export const unbanUserSchema = v.object({
  chatId: v.string(),
  userId: v.number(),
})

export const restrictUserSchema = v.object({
  chatId: v.string(),
  userId: v.number(),
  canSendMessages: v.optional(v.boolean()),
  canSendOther: v.optional(v.boolean()),
  canAddWebPagePreviews: v.optional(v.boolean()),
  canChangeInfo: v.optional(v.boolean()),
  canInviteUsers: v.optional(v.boolean()),
  canPinMessages: v.optional(v.boolean()),
  untilDate: v.optional(v.number()),
})

export const promoteUserSchema = v.object({
  chatId: v.string(),
  userId: v.number(),
  canManageChat: v.optional(v.boolean()),
  canDeleteMessages: v.optional(v.boolean()),
  canManageVideoChats: v.optional(v.boolean()),
  canRestrictMembers: v.optional(v.boolean()),
  canPromoteMembers: v.optional(v.boolean()),
  canChangeInfo: v.optional(v.boolean()),
  canInviteUsers: v.optional(v.boolean()),
  canPinMessages: v.optional(v.boolean()),
})

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export const getChatSchema = v.object({
  chatId: v.string(),
})

export const getChatMemberSchema = v.object({
  chatId: v.string(),
  userId: v.number(),
})

export const getChatMembersCountSchema = v.object({
  chatId: v.string(),
})

export const setChatTitleSchema = v.object({
  chatId: v.string(),
  title: v.string(),
})

export const setChatDescriptionSchema = v.object({
  chatId: v.string(),
  description: v.string(),
})
