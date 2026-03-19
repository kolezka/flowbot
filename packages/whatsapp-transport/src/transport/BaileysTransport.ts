import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import type { Logger } from '../logger.js'
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
} from './IWhatsAppTransport.js'
import { WhatsAppTransportError } from './errors.js'
import { createDbAuthState } from './auth-state.js'

type WASocket = ReturnType<typeof makeWASocket>
type SendMessageContent = Parameters<WASocket['sendMessage']>[1]
type SendMessageOptions = Parameters<WASocket['sendMessage']>[2]

/** Duck-typed Prisma interface to avoid rootDir issues with @flowbot/db import. */
interface PrismaLike {
  platformConnection: {
    findUnique(args: { where: { id: string }; select: { credentials: true } }): Promise<{ credentials: unknown } | null>
    update(args: { where: { id: string }; data: { credentials: unknown } }): Promise<unknown>
  }
}

interface BaileysTransportConfig {
  connectionId: string
  prisma: PrismaLike
  logger: Logger
}

/**
 * Real Baileys implementation of IWhatsAppTransport.
 * Connects to WhatsApp via the unofficial multi-device API.
 *
 * Unit tests use FakeWhatsAppTransport instead — this class requires a live session.
 */
export class BaileysTransport implements IWhatsAppTransport {
  private readonly connectionId: string
  private readonly prisma: PrismaLike
  private readonly logger: Logger

  private sock: WASocket | null = null
  private connected = false

  private qrCodeCallback: ((qr: string) => void) | null = null
  private connectionUpdateCallback:
    | ((update: { connection?: string; lastDisconnect?: unknown }) => void)
    | null = null

  // Presence cache: jid → last known presence
  private readonly presenceCache = new Map<string, WhatsAppPresenceType>()

  constructor({ connectionId, prisma, logger }: BaileysTransportConfig) {
    this.connectionId = connectionId
    this.prisma = prisma
    this.logger = logger
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    try {
      const { state, saveCreds } = await createDbAuthState(this.connectionId, this.prisma)
      const { version } = await fetchLatestBaileysVersion()

      // Pino logger is compatible with Baileys' ILogger shape
      const baileysLogger = this.logger.child({
        module: 'baileys',
      }) as unknown as Parameters<typeof makeWASocket>[0]['logger']

      this.sock = makeWASocket({
        version,
        // AuthenticationState from our db adapter is structurally compatible
        auth: state as Parameters<typeof makeWASocket>[0]['auth'],
        logger: baileysLogger,
        printQRInTerminal: false,
      })

      // Persist credentials on every update
      this.sock.ev.on('creds.update', saveCreds)

      // Track connection state and emit QR codes
      this.sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr !== undefined && this.qrCodeCallback !== null) {
          this.qrCodeCallback(qr)
        }

        if (connection === 'open') {
          this.connected = true
          this.logger.info({ connectionId: this.connectionId }, 'WhatsApp connection opened')
        } else if (connection === 'close') {
          this.connected = false
          const err = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
          const statusCode = err?.output?.statusCode
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut
          this.logger.info(
            { connectionId: this.connectionId, statusCode, shouldReconnect },
            'WhatsApp connection closed',
          )
        }

        if (this.connectionUpdateCallback !== null) {
          this.connectionUpdateCallback({ connection, lastDisconnect })
        }
      })

      // Cache presence updates for getPresence()
      this.sock.ev.on('presence.update', ({ id, presences }) => {
        for (const [participantJid, presence] of Object.entries(presences)) {
          const jidKey = id === participantJid ? id : participantJid
          const raw = presence.lastKnownPresence as WhatsAppPresenceType | undefined
          if (raw !== undefined) {
            this.presenceCache.set(jidKey, raw)
          }
        }
      })
    } catch (err) {
      throw new WhatsAppTransportError('Failed to connect to WhatsApp', err)
    }
  }

  async disconnect(): Promise<void> {
    if (this.sock === null) return
    try {
      this.sock.end(undefined)
      this.sock = null
      this.connected = false
    } catch (err) {
      throw new WhatsAppTransportError('Failed to disconnect from WhatsApp', err)
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  onQrCode(cb: (qr: string) => void): void {
    this.qrCodeCallback = cb
  }

  onConnectionUpdate(
    cb: (update: { connection?: string; lastDisconnect?: unknown }) => void,
  ): void {
    this.connectionUpdateCallback = cb
  }

  getClient(): unknown {
    return this.sock
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  async sendMessage(
    jid: string,
    text: string,
    opts?: WhatsAppSendOptions,
  ): Promise<WhatsAppMessageResult> {
    const sock = this.requireSocket()
    try {
      const content: SendMessageContent = { text }
      const options: SendMessageOptions = opts?.ephemeral
        ? { ephemeralExpiration: 7 * 24 * 60 * 60 }
        : {}
      const result = await sock.sendMessage(jid, content, options)
      return toMessageResult(result)
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to send message to ${jid}`, err)
    }
  }

  async sendMedia(
    jid: string,
    type: WhatsAppMediaType,
    urlOrBuffer: string | Buffer,
    opts?: WhatsAppMediaOptions,
  ): Promise<WhatsAppMessageResult> {
    const sock = this.requireSocket()
    const content = buildMediaContent(type, urlOrBuffer, opts)
    try {
      const result = await sock.sendMessage(jid, content)
      return toMessageResult(result)
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to send ${type} media to ${jid}`, err)
    }
  }

  async sendDocument(
    jid: string,
    urlOrBuffer: string | Buffer,
    opts?: WhatsAppMediaOptions,
  ): Promise<WhatsAppMessageResult> {
    const sock = this.requireSocket()
    const source =
      typeof urlOrBuffer === 'string'
        ? ({ url: urlOrBuffer } as const)
        : urlOrBuffer
    const content: SendMessageContent = {
      document: source,
      fileName: opts?.fileName,
      mimetype: opts?.mimetype ?? 'application/octet-stream',
      caption: opts?.caption,
    }
    try {
      const result = await sock.sendMessage(jid, content)
      return toMessageResult(result)
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to send document to ${jid}`, err)
    }
  }

  async sendLocation(jid: string, lat: number, lng: number): Promise<WhatsAppMessageResult> {
    const sock = this.requireSocket()
    try {
      const result = await sock.sendMessage(jid, {
        location: { degreesLatitude: lat, degreesLongitude: lng },
      })
      return toMessageResult(result)
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to send location to ${jid}`, err)
    }
  }

  async sendContact(jid: string, contact: WhatsAppContact): Promise<WhatsAppMessageResult> {
    const sock = this.requireSocket()
    const vcard = buildVCard(contact)
    try {
      const result = await sock.sendMessage(jid, {
        contacts: { contacts: [{ vcard }] },
      })
      return toMessageResult(result)
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to send contact to ${jid}`, err)
    }
  }

  // ---------------------------------------------------------------------------
  // Message management
  // ---------------------------------------------------------------------------

  async editMessage(
    jid: string,
    key: WhatsAppMessageKey,
    text: string,
  ): Promise<WhatsAppMessageResult> {
    const sock = this.requireSocket()
    try {
      const result = await sock.sendMessage(jid, { text, edit: toProtoKey(key) })
      return toMessageResult(result)
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to edit message in ${jid}`, err)
    }
  }

  async deleteMessage(jid: string, key: WhatsAppMessageKey): Promise<boolean> {
    const sock = this.requireSocket()
    try {
      await sock.sendMessage(jid, { delete: toProtoKey(key) })
      return true
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to delete message in ${jid}`, err)
    }
  }

  async forwardMessage(
    fromJid: string,
    toJid: string,
    _key: WhatsAppMessageKey,
  ): Promise<WhatsAppMessageResult> {
    const sock = this.requireSocket()
    try {
      // True forwarding requires a full WAMessage object (fetched from store).
      // Without a message store we fall back to a text re-send referencing the source.
      const result = await sock.sendMessage(toJid, {
        text: `[Forwarded from ${fromJid}]`,
      })
      return toMessageResult(result)
    } catch (err) {
      throw new WhatsAppTransportError(
        `Failed to forward message from ${fromJid} to ${toJid}`,
        err,
      )
    }
  }

  async readHistory(jid: string, _count?: number): Promise<void> {
    const sock = this.requireSocket()
    try {
      // chatModify is the standard Baileys way to mark a chat as read
      await sock.chatModify({ markRead: true, lastMessages: [] }, jid)
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to mark history as read for ${jid}`, err)
    }
  }

  // ---------------------------------------------------------------------------
  // Group admin
  // ---------------------------------------------------------------------------

  async kickParticipant(groupJid: string, userJid: string): Promise<boolean> {
    const sock = this.requireSocket()
    try {
      await sock.groupParticipantsUpdate(groupJid, [userJid], 'remove')
      return true
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to kick ${userJid} from ${groupJid}`, err)
    }
  }

  async promoteParticipant(groupJid: string, userJid: string): Promise<boolean> {
    const sock = this.requireSocket()
    try {
      await sock.groupParticipantsUpdate(groupJid, [userJid], 'promote')
      return true
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to promote ${userJid} in ${groupJid}`, err)
    }
  }

  async demoteParticipant(groupJid: string, userJid: string): Promise<boolean> {
    const sock = this.requireSocket()
    try {
      await sock.groupParticipantsUpdate(groupJid, [userJid], 'demote')
      return true
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to demote ${userJid} in ${groupJid}`, err)
    }
  }

  async getGroupMetadata(groupJid: string): Promise<WhatsAppGroupMetadata> {
    const sock = this.requireSocket()
    try {
      const meta = await sock.groupMetadata(groupJid)
      return {
        id: meta.id,
        subject: meta.subject,
        description: meta.desc,
        owner: meta.owner,
        participants: meta.participants.map((p) => ({
          id: p.id,
          admin: (p.admin as 'admin' | 'superadmin' | null | undefined) ?? null,
        })),
        size: meta.size ?? meta.participants.length,
        creation: meta.creation ?? 0,
      }
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to get group metadata for ${groupJid}`, err)
    }
  }

  async getGroupInviteLink(groupJid: string): Promise<string> {
    const sock = this.requireSocket()
    try {
      const code = await sock.groupInviteCode(groupJid)
      if (code === undefined || code === null) {
        throw new WhatsAppTransportError(`No invite code returned for ${groupJid}`)
      }
      return `https://chat.whatsapp.com/${code}`
    } catch (err) {
      if (err instanceof WhatsAppTransportError) throw err
      throw new WhatsAppTransportError(`Failed to get invite link for ${groupJid}`, err)
    }
  }

  // ---------------------------------------------------------------------------
  // Presence
  // ---------------------------------------------------------------------------

  async sendPresenceUpdate(jid: string, type: WhatsAppPresenceType): Promise<void> {
    const sock = this.requireSocket()
    try {
      await sock.presenceSubscribe(jid)
      // WAPresence and WhatsAppPresenceType share the same string literals
      await sock.sendPresenceUpdate(
        type as Parameters<WASocket['sendPresenceUpdate']>[0],
        jid,
      )
    } catch (err) {
      throw new WhatsAppTransportError(`Failed to send presence update to ${jid}`, err)
    }
  }

  async getPresence(jid: string): Promise<WhatsAppPresenceType> {
    // Subscribe so we start receiving updates, then return cached value
    try {
      this.requireSocket().presenceSubscribe(jid).catch(() => undefined)
    } catch {
      // non-fatal if not connected yet
    }
    return this.presenceCache.get(jid) ?? 'unavailable'
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private requireSocket(): WASocket {
    if (this.sock === null) {
      throw new WhatsAppTransportError('Transport not connected — call connect() first')
    }
    return this.sock
  }
}

// ---------------------------------------------------------------------------
// Module-level pure helpers
// ---------------------------------------------------------------------------

type WAMessageResult = Awaited<ReturnType<WASocket['sendMessage']>>

function toMessageResult(result: WAMessageResult): WhatsAppMessageResult {
  if (result === undefined || result === null) {
    return { key: { remoteJid: '', fromMe: true, id: '' }, status: 'pending' }
  }
  return {
    key: {
      remoteJid: result.key.remoteJid ?? '',
      fromMe: result.key.fromMe ?? true,
      id: result.key.id ?? '',
    },
    status: 'sent',
  }
}

function toProtoKey(
  key: WhatsAppMessageKey,
): { remoteJid: string; fromMe: boolean; id: string } {
  return { remoteJid: key.remoteJid, fromMe: key.fromMe, id: key.id }
}

function buildVCard(contact: WhatsAppContact): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.fullName}`,
    `TEL;type=CELL;type=VOICE;waid=${contact.phoneNumber}:+${contact.phoneNumber}`,
  ]
  if (contact.organization !== undefined) {
    lines.push(`ORG:${contact.organization}`)
  }
  lines.push('END:VCARD')
  return lines.join('\n')
}

type MediaSource = { url: string } | Buffer

function buildMediaContent(
  type: WhatsAppMediaType,
  urlOrBuffer: string | Buffer,
  opts?: WhatsAppMediaOptions,
): SendMessageContent {
  const source: MediaSource =
    typeof urlOrBuffer === 'string' ? { url: urlOrBuffer } : urlOrBuffer

  switch (type) {
    case 'image':
      return { image: source, caption: opts?.caption } as SendMessageContent
    case 'video':
      return { video: source, caption: opts?.caption } as SendMessageContent
    case 'audio':
      return {
        audio: source,
        ptt: opts?.ptt ?? false,
        mimetype: opts?.mimetype ?? 'audio/mp4',
      } as SendMessageContent
    case 'sticker':
      return { sticker: source } as SendMessageContent
    case 'document':
      return {
        document: source,
        fileName: opts?.fileName,
        mimetype: opts?.mimetype ?? 'application/octet-stream',
        caption: opts?.caption,
      } as SendMessageContent
    default: {
      const _exhaustive: never = type
      throw new WhatsAppTransportError(`Unknown media type: ${String(_exhaustive)}`)
    }
  }
}
