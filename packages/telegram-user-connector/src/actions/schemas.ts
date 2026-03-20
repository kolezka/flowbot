import * as v from 'valibot'

// --- Send options (shared) ---
const sendOptionsSchema = v.optional(v.object({
  parseMode: v.optional(v.union([v.literal('html'), v.literal('markdown')])),
  replyToMsgId: v.optional(v.number()),
  silent: v.optional(v.boolean()),
}))

const mediaOptionsSchema = v.optional(v.object({
  caption: v.optional(v.string()),
  parseMode: v.optional(v.union([v.literal('html'), v.literal('markdown')])),
  silent: v.optional(v.boolean()),
  replyToMsgId: v.optional(v.number()),
  fileName: v.optional(v.string()),
}))

// --- Messaging ---
export const sendMessageSchema = v.object({
  peer: v.string(),
  text: v.string(),
  options: sendOptionsSchema,
})

export const sendPhotoSchema = v.object({
  peer: v.string(),
  photoUrl: v.string(),
  options: mediaOptionsSchema,
})

export const sendVideoSchema = v.object({
  peer: v.string(),
  videoUrl: v.string(),
  options: mediaOptionsSchema,
})

export const sendDocumentSchema = v.object({
  peer: v.string(),
  documentUrl: v.string(),
  options: mediaOptionsSchema,
})

export const sendStickerSchema = v.object({
  peer: v.string(),
  sticker: v.string(),
  silent: v.optional(v.boolean()),
})

export const sendVoiceSchema = v.object({
  peer: v.string(),
  voiceUrl: v.string(),
  options: mediaOptionsSchema,
})

export const sendAudioSchema = v.object({
  peer: v.string(),
  audioUrl: v.string(),
  options: mediaOptionsSchema,
})

export const sendAnimationSchema = v.object({
  peer: v.string(),
  animationUrl: v.string(),
  options: mediaOptionsSchema,
})

export const sendLocationSchema = v.object({
  peer: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  livePeriod: v.optional(v.number()),
  silent: v.optional(v.boolean()),
})

export const sendContactSchema = v.object({
  peer: v.string(),
  phoneNumber: v.string(),
  firstName: v.string(),
  lastName: v.optional(v.string()),
})

export const sendVenueSchema = v.object({
  peer: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  title: v.string(),
  address: v.string(),
})

export const sendDiceSchema = v.object({
  peer: v.string(),
  emoji: v.optional(v.string()),
})

export const forwardMessageSchema = v.object({
  fromPeer: v.string(),
  toPeer: v.string(),
  messageIds: v.array(v.number()),
  silent: v.optional(v.boolean()),
  dropAuthor: v.optional(v.boolean()),
})

// --- Message management ---
export const editMessageSchema = v.object({
  peer: v.string(),
  messageId: v.number(),
  text: v.string(),
  options: sendOptionsSchema,
})

export const deleteMessageSchema = v.object({
  peer: v.string(),
  messageIds: v.array(v.number()),
})

export const pinMessageSchema = v.object({
  peer: v.string(),
  messageId: v.number(),
  silent: v.optional(v.boolean()),
})

export const unpinMessageSchema = v.object({
  peer: v.string(),
  messageId: v.optional(v.number()),
})

export const copyMessageSchema = v.object({
  fromPeer: v.string(),
  toPeer: v.string(),
  messageId: v.number(),
})

// --- User management ---
export const banUserSchema = v.object({
  peer: v.string(),
  userId: v.string(),
})

export const restrictUserSchema = v.object({
  peer: v.string(),
  userId: v.string(),
  permissions: v.object({
    canSendMessages: v.optional(v.boolean()),
    canSendMedia: v.optional(v.boolean()),
    canSendPolls: v.optional(v.boolean()),
    canSendOther: v.optional(v.boolean()),
    canAddWebPagePreviews: v.optional(v.boolean()),
    canChangeInfo: v.optional(v.boolean()),
    canInviteUsers: v.optional(v.boolean()),
    canPinMessages: v.optional(v.boolean()),
  }),
  untilDate: v.optional(v.number()),
})

export const promoteUserSchema = v.object({
  peer: v.string(),
  userId: v.string(),
  privileges: v.object({
    canManageChat: v.optional(v.boolean()),
    canDeleteMessages: v.optional(v.boolean()),
    canManageVideoChats: v.optional(v.boolean()),
    canRestrictMembers: v.optional(v.boolean()),
    canPromoteMembers: v.optional(v.boolean()),
    canChangeInfo: v.optional(v.boolean()),
    canInviteUsers: v.optional(v.boolean()),
    canPinMessages: v.optional(v.boolean()),
  }),
})

// --- Chat management ---
export const setChatTitleSchema = v.object({
  peer: v.string(),
  title: v.string(),
})

export const setChatDescriptionSchema = v.object({
  peer: v.string(),
  description: v.string(),
})

export const exportInviteLinkSchema = v.object({
  peer: v.string(),
})

export const getChatMemberSchema = v.object({
  peer: v.string(),
  userId: v.string(),
})

export const leaveChatSchema = v.object({
  peer: v.string(),
})

// --- Interactive ---
export const createPollSchema = v.object({
  peer: v.string(),
  question: v.string(),
  answers: v.array(v.string()),
  isAnonymous: v.optional(v.boolean()),
  multipleChoice: v.optional(v.boolean()),
})

// --- Media group & Forum ---
export const sendMediaGroupSchema = v.object({
  peer: v.string(),
  media: v.array(v.object({
    type: v.string(),
    url: v.string(),
    caption: v.optional(v.string()),
  })),
})

export const createForumTopicSchema = v.object({
  peer: v.string(),
  name: v.string(),
  iconColor: v.optional(v.number()),
  iconEmojiId: v.optional(v.string()),
})

// --- Resolve username ---
export const resolveUsernameSchema = v.object({
  username: v.string(),
})
