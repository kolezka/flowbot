import * as v from 'valibot'

// --- Messaging ---
export const sendMessageSchema = v.object({ chatId: v.string(), text: v.string() })
export const sendPhotoSchema = v.object({ chatId: v.string(), photoUrl: v.string(), caption: v.optional(v.string()) })
export const sendVideoSchema = v.object({ chatId: v.string(), videoUrl: v.string(), caption: v.optional(v.string()) })
export const sendDocumentSchema = v.object({ chatId: v.string(), documentUrl: v.string(), fileName: v.optional(v.string()), caption: v.optional(v.string()) })
export const sendAudioSchema = v.object({ chatId: v.string(), audioUrl: v.string() })
export const sendVoiceSchema = v.object({ chatId: v.string(), voiceUrl: v.string() })
export const sendStickerSchema = v.object({ chatId: v.string(), sticker: v.string() })
export const sendLocationSchema = v.object({ chatId: v.string(), latitude: v.number(), longitude: v.number() })
export const sendContactSchema = v.object({ chatId: v.string(), phoneNumber: v.string(), fullName: v.string(), organization: v.optional(v.string()) })

// --- Message management ---
export const forwardMessageSchema = v.object({
  fromChatId: v.string(),
  toChatId: v.string(),
  messageKey: v.object({ remoteJid: v.string(), fromMe: v.boolean(), id: v.string() }),
})
export const editMessageSchema = v.object({
  chatId: v.string(),
  messageKey: v.object({ remoteJid: v.string(), fromMe: v.boolean(), id: v.string() }),
  text: v.string(),
})
export const deleteMessageSchema = v.object({
  chatId: v.string(),
  messageKey: v.object({ remoteJid: v.string(), fromMe: v.boolean(), id: v.string() }),
})
export const readHistorySchema = v.object({ chatId: v.string(), count: v.optional(v.number()) })

// --- Group admin ---
export const kickUserSchema = v.object({ chatId: v.string(), userId: v.string() })
export const promoteUserSchema = v.object({ chatId: v.string(), userId: v.string() })
export const demoteUserSchema = v.object({ chatId: v.string(), userId: v.string() })
export const getGroupInfoSchema = v.object({ chatId: v.string() })
export const getInviteLinkSchema = v.object({ chatId: v.string() })

// --- Presence ---
export const sendPresenceSchema = v.object({ chatId: v.string(), type: v.string() })
