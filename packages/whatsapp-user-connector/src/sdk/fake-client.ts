import type {
  IWhatsAppTransport,
  WhatsAppContact,
  WhatsAppGroupMetadata,
  WhatsAppMediaOptions,
  WhatsAppMediaType,
  WhatsAppMessageKey,
  WhatsAppMessageResult,
  WhatsAppPresenceType,
  WhatsAppSendOptions,
} from './types.js'

export interface SentWhatsAppMessage {
  jid: string
  text: string
  opts?: WhatsAppSendOptions
  result: WhatsAppMessageResult
}

export interface DeletedWhatsAppMessage {
  jid: string
  key: WhatsAppMessageKey
}

export interface KickedParticipant {
  groupJid: string
  userJid: string
}

export class FakeWhatsAppTransport implements IWhatsAppTransport {
  private connected = false
  private nextId = 1
  private sentMessages: SentWhatsAppMessage[] = []
  private deletedMessages: DeletedWhatsAppMessage[] = []
  private kickedParticipants: KickedParticipant[] = []
  private qrCallback: ((qr: string) => void) | null = null
  private connectionUpdateCallback: ((update: { connection?: string; lastDisconnect?: unknown }) => void) | null = null

  private makeKey(jid: string): WhatsAppMessageKey {
    return { remoteJid: jid, fromMe: true, id: `fake-msg-${this.nextId++}` }
  }

  private makeResult(jid: string, status: 'sent' | 'pending' | 'error' = 'sent'): WhatsAppMessageResult {
    return { key: this.makeKey(jid), status }
  }

  // --- Connection ---

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  onQrCode(cb: (qr: string) => void): void {
    this.qrCallback = cb
  }

  onConnectionUpdate(cb: (update: { connection?: string; lastDisconnect?: unknown }) => void): void {
    this.connectionUpdateCallback = cb
  }

  getClient(): unknown {
    return null
  }

  // --- Messaging ---

  async sendMessage(jid: string, text: string, opts?: WhatsAppSendOptions): Promise<WhatsAppMessageResult> {
    const result = this.makeResult(jid)
    this.sentMessages.push({ jid, text, opts, result })
    return result
  }

  async sendMedia(_jid: string, _type: WhatsAppMediaType, _urlOrBuffer: string | Buffer, _opts?: WhatsAppMediaOptions): Promise<WhatsAppMessageResult> {
    return this.makeResult(_jid)
  }

  async sendLocation(jid: string, _lat: number, _lng: number): Promise<WhatsAppMessageResult> {
    return this.makeResult(jid)
  }

  async sendContact(jid: string, _contact: WhatsAppContact): Promise<WhatsAppMessageResult> {
    return this.makeResult(jid)
  }

  async sendDocument(jid: string, _urlOrBuffer: string | Buffer, _opts?: WhatsAppMediaOptions): Promise<WhatsAppMessageResult> {
    return this.makeResult(jid)
  }

  // --- Message management ---

  async editMessage(jid: string, _key: WhatsAppMessageKey, _text: string): Promise<WhatsAppMessageResult> {
    return this.makeResult(jid)
  }

  async deleteMessage(jid: string, key: WhatsAppMessageKey): Promise<boolean> {
    this.deletedMessages.push({ jid, key })
    return true
  }

  async forwardMessage(_fromJid: string, toJid: string, _key: WhatsAppMessageKey): Promise<WhatsAppMessageResult> {
    return this.makeResult(toJid)
  }

  async readHistory(_jid: string, _count?: number): Promise<void> {
    // no-op in fake
  }

  // --- Group admin ---

  async kickParticipant(groupJid: string, userJid: string): Promise<boolean> {
    this.kickedParticipants.push({ groupJid, userJid })
    return true
  }

  async promoteParticipant(_groupJid: string, _userJid: string): Promise<boolean> {
    return true
  }

  async demoteParticipant(_groupJid: string, _userJid: string): Promise<boolean> {
    return true
  }

  async getGroupMetadata(groupJid: string): Promise<WhatsAppGroupMetadata> {
    return {
      id: groupJid,
      subject: 'Fake Group',
      description: 'A fake group for testing',
      owner: 'owner@s.whatsapp.net',
      participants: [{ id: 'owner@s.whatsapp.net', admin: 'superadmin' }],
      size: 1,
      creation: Math.floor(Date.now() / 1000),
    }
  }

  async getGroupInviteLink(groupJid: string): Promise<string> {
    return `https://chat.whatsapp.com/fake-invite-${groupJid}`
  }

  // --- Presence ---

  async sendPresenceUpdate(_jid: string, _type: WhatsAppPresenceType): Promise<void> {
    // no-op in fake
  }

  async getPresence(_jid: string): Promise<WhatsAppPresenceType> {
    return 'available'
  }

  // --- Test helpers ---

  /** Trigger the registered QR code callback. */
  emitQr(qr: string): void {
    this.qrCallback?.(qr)
  }

  /** Trigger the registered connection update callback. */
  emitConnectionUpdate(update: { connection?: string; lastDisconnect?: unknown }): void {
    this.connectionUpdateCallback?.(update)
  }

  getSentMessages(): readonly SentWhatsAppMessage[] {
    return this.sentMessages
  }

  getDeletedMessages(): readonly DeletedWhatsAppMessage[] {
    return this.deletedMessages
  }

  getKickedParticipants(): readonly KickedParticipant[] {
    return this.kickedParticipants
  }

  clear(): void {
    this.sentMessages = []
    this.deletedMessages = []
    this.kickedParticipants = []
    this.nextId = 1
  }
}
