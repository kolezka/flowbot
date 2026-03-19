import type {
  WhatsAppContact,
  WhatsAppMessageKey,
  WhatsAppPresenceType,
  WhatsAppSendOptions,
  WhatsAppMediaOptions,
} from '../transport/IWhatsAppTransport.js'

export enum ActionType {
  SEND_MESSAGE = 'send_message',
  SEND_PHOTO = 'send_photo',
  SEND_VIDEO = 'send_video',
  SEND_DOCUMENT = 'send_document',
  SEND_AUDIO = 'send_audio',
  SEND_VOICE = 'send_voice',
  SEND_STICKER = 'send_sticker',
  SEND_LOCATION = 'send_location',
  SEND_CONTACT = 'send_contact',
  FORWARD_MESSAGE = 'forward_message',
  EDIT_MESSAGE = 'edit_message',
  DELETE_MESSAGE = 'delete_message',
  READ_HISTORY = 'read_history',
  KICK_USER = 'kick_user',
  PROMOTE_USER = 'promote_user',
  DEMOTE_USER = 'demote_user',
  GET_GROUP_INFO = 'get_group_info',
  GET_INVITE_LINK = 'get_invite_link',
  SEND_PRESENCE = 'send_presence',
}

// --- Messaging payloads ---

export interface SendMessagePayload {
  type: ActionType.SEND_MESSAGE
  jid: string
  text: string
  options?: WhatsAppSendOptions
}

export interface SendPhotoPayload {
  type: ActionType.SEND_PHOTO
  jid: string
  url: string
  caption?: string
  options?: WhatsAppMediaOptions
}

export interface SendVideoPayload {
  type: ActionType.SEND_VIDEO
  jid: string
  url: string
  caption?: string
  options?: WhatsAppMediaOptions
}

export interface SendDocumentPayload {
  type: ActionType.SEND_DOCUMENT
  jid: string
  url: string
  fileName?: string
  mimetype?: string
  caption?: string
}

export interface SendAudioPayload {
  type: ActionType.SEND_AUDIO
  jid: string
  url: string
  options?: WhatsAppMediaOptions
}

export interface SendVoicePayload {
  type: ActionType.SEND_VOICE
  jid: string
  url: string
}

export interface SendStickerPayload {
  type: ActionType.SEND_STICKER
  jid: string
  url: string
}

export interface SendLocationPayload {
  type: ActionType.SEND_LOCATION
  jid: string
  latitude: number
  longitude: number
}

export interface SendContactPayload {
  type: ActionType.SEND_CONTACT
  jid: string
  contact: WhatsAppContact
}

// --- Message management payloads ---

export interface ForwardMessagePayload {
  type: ActionType.FORWARD_MESSAGE
  fromJid: string
  toJid: string
  key: WhatsAppMessageKey
}

export interface EditMessagePayload {
  type: ActionType.EDIT_MESSAGE
  jid: string
  key: WhatsAppMessageKey
  text: string
}

export interface DeleteMessagePayload {
  type: ActionType.DELETE_MESSAGE
  jid: string
  key: WhatsAppMessageKey
}

export interface ReadHistoryPayload {
  type: ActionType.READ_HISTORY
  jid: string
  count?: number
}

// --- Group admin payloads ---

export interface KickUserPayload {
  type: ActionType.KICK_USER
  groupJid: string
  userJid: string
}

export interface PromoteUserPayload {
  type: ActionType.PROMOTE_USER
  groupJid: string
  userJid: string
}

export interface DemoteUserPayload {
  type: ActionType.DEMOTE_USER
  groupJid: string
  userJid: string
}

export interface GetGroupInfoPayload {
  type: ActionType.GET_GROUP_INFO
  groupJid: string
}

export interface GetInviteLinkPayload {
  type: ActionType.GET_INVITE_LINK
  groupJid: string
}

// --- Presence payloads ---

export interface SendPresencePayload {
  type: ActionType.SEND_PRESENCE
  jid: string
  presence: WhatsAppPresenceType
}

// --- Union ---

export type Action =
  | SendMessagePayload
  | SendPhotoPayload
  | SendVideoPayload
  | SendDocumentPayload
  | SendAudioPayload
  | SendVoicePayload
  | SendStickerPayload
  | SendLocationPayload
  | SendContactPayload
  | ForwardMessagePayload
  | EditMessagePayload
  | DeleteMessagePayload
  | ReadHistoryPayload
  | KickUserPayload
  | PromoteUserPayload
  | DemoteUserPayload
  | GetGroupInfoPayload
  | GetInviteLinkPayload
  | SendPresencePayload
