/**
 * WhatsApp JID (Jabber ID) formats:
 * - User:  1234567890@s.whatsapp.net
 * - Group: groupid@g.us
 */

export interface WhatsAppMessageKey {
  remoteJid: string
  fromMe: boolean
  id: string
}

export interface WhatsAppMessageResult {
  key: WhatsAppMessageKey
  status: 'sent' | 'pending' | 'error'
}

export interface WhatsAppSendOptions {
  quotedMessageKey?: WhatsAppMessageKey
  ephemeral?: boolean
}

export type WhatsAppMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker'

export interface WhatsAppMediaOptions {
  caption?: string
  fileName?: string
  mimetype?: string
  /** Push-to-talk voice note (audio only) */
  ptt?: boolean
}

export interface WhatsAppGroupParticipant {
  id: string
  admin: 'admin' | 'superadmin' | null
}

export interface WhatsAppGroupMetadata {
  id: string
  subject: string
  description?: string
  owner?: string
  participants: WhatsAppGroupParticipant[]
  size: number
  creation: number
}

export interface WhatsAppContact {
  fullName: string
  phoneNumber: string
  organization?: string
}

export type WhatsAppPresenceType = 'available' | 'composing' | 'recording' | 'paused' | 'unavailable'

export interface IWhatsAppTransport {
  // --- Connection ---
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  onQrCode(cb: (qr: string) => void): void
  onConnectionUpdate(cb: (update: { connection?: string; lastDisconnect?: unknown }) => void): void
  /** Access the underlying platform client for advanced operations. */
  getClient(): unknown

  // --- Messaging ---
  sendMessage(jid: string, text: string, opts?: WhatsAppSendOptions): Promise<WhatsAppMessageResult>
  sendMedia(jid: string, type: WhatsAppMediaType, urlOrBuffer: string | Buffer, opts?: WhatsAppMediaOptions): Promise<WhatsAppMessageResult>
  sendLocation(jid: string, lat: number, lng: number): Promise<WhatsAppMessageResult>
  sendContact(jid: string, contact: WhatsAppContact): Promise<WhatsAppMessageResult>
  sendDocument(jid: string, urlOrBuffer: string | Buffer, opts?: WhatsAppMediaOptions): Promise<WhatsAppMessageResult>

  // --- Message management ---
  editMessage(jid: string, key: WhatsAppMessageKey, text: string): Promise<WhatsAppMessageResult>
  deleteMessage(jid: string, key: WhatsAppMessageKey): Promise<boolean>
  forwardMessage(fromJid: string, toJid: string, key: WhatsAppMessageKey): Promise<WhatsAppMessageResult>
  readHistory(jid: string, count?: number): Promise<void>

  // --- Group admin ---
  kickParticipant(groupJid: string, userJid: string): Promise<boolean>
  promoteParticipant(groupJid: string, userJid: string): Promise<boolean>
  demoteParticipant(groupJid: string, userJid: string): Promise<boolean>
  getGroupMetadata(groupJid: string): Promise<WhatsAppGroupMetadata>
  getGroupInviteLink(groupJid: string): Promise<string>

  // --- Presence ---
  sendPresenceUpdate(jid: string, type: WhatsAppPresenceType): Promise<void>
  getPresence(jid: string): Promise<WhatsAppPresenceType>
}
