/**
 * Maps raw Baileys WhatsApp events into the standardized FlowTriggerEvent format
 * used by the flow engine.
 */

import type { FlowTriggerEvent } from '@flowbot/platform-kit'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isGroup(jid: string): boolean {
  return jid.endsWith('@g.us')
}

function isDm(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net')
}

function extractText(message: Record<string, unknown> | null | undefined): string | null {
  if (!message) return null
  if (typeof message.conversation === 'string') return message.conversation
  const ext = message.extendedTextMessage as Record<string, unknown> | null | undefined
  if (ext && typeof ext.text === 'string') return ext.text
  return null
}

type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker'

const MEDIA_KEYS: Record<string, MediaType> = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
}

function detectMediaType(message: Record<string, unknown> | null | undefined): MediaType | null {
  if (!message) return null
  for (const [key, type] of Object.entries(MEDIA_KEYS)) {
    if (key in message) return type
  }
  return null
}

function nowIso(): string {
  return new Date().toISOString()
}

// ---------------------------------------------------------------------------
// Message upsert (incoming messages)
// ---------------------------------------------------------------------------

export interface BaileysMessageUpsert {
  messages: Array<{
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    message?: Record<string, unknown> | null
    pushName?: string | null
    messageTimestamp?: number | Long | null
  }>
  type: string
}

// Baileys uses a Long type for timestamps in some cases; accept any numeric-ish value.
type Long = { toNumber(): number }

function toTimestampMs(ts: number | Long | null | undefined): number {
  if (ts == null) return Date.now()
  if (typeof ts === 'number') return ts * 1000
  if (typeof (ts as Long).toNumber === 'function') return (ts as Long).toNumber() * 1000
  return Date.now()
}

export function mapMessageUpsert(
  upsert: BaileysMessageUpsert,
  botInstanceId: string,
): FlowTriggerEvent[] {
  const events: FlowTriggerEvent[] = []

  for (const msg of upsert.messages) {
    // Skip messages sent by the bot itself
    if (msg.key.fromMe) continue

    const jid = msg.key.remoteJid
    const isGroup_ = isGroup(jid)
    const isDm_ = isDm(jid)

    const communityId = isGroup_ ? jid : null
    // For groups the participant is identified separately; for DMs use the JID itself
    const accountId = isDm_ ? jid : (msg.pushName ?? jid)

    const text = extractText(msg.message)
    const mediaType = detectMediaType(msg.message)
    const timestamp = new Date(toTimestampMs(msg.messageTimestamp)).toISOString()

    events.push({
      platform: 'whatsapp',
      communityId,
      accountId,
      eventType: 'message_received',
      data: {
        messageId: msg.key.id,
        text,
        mediaType,
        senderName: msg.pushName ?? null,
        isDirectMessage: !isGroup_,
        rawMessage: msg.message ?? null,
      },
      timestamp,
      botInstanceId,
    })
  }

  return events
}

// ---------------------------------------------------------------------------
// Group participants update (join / leave / promote / demote)
// ---------------------------------------------------------------------------

export type GroupParticipantAction = 'add' | 'remove' | 'promote' | 'demote'

export interface BaileysGroupParticipantsUpdate {
  id: string
  participants: string[]
  action: GroupParticipantAction
}

const ACTION_TO_EVENT: Record<GroupParticipantAction, string> = {
  add: 'member_join',
  remove: 'member_leave',
  promote: 'member_promoted',
  demote: 'member_demoted',
}

export function mapGroupParticipantsUpdate(
  update: BaileysGroupParticipantsUpdate,
  botInstanceId: string,
): FlowTriggerEvent[] {
  const eventType = ACTION_TO_EVENT[update.action] ?? `member_${update.action}`
  const timestamp = nowIso()

  return update.participants.map(participantJid => ({
    platform: 'whatsapp' as const,
    communityId: update.id,
    accountId: participantJid,
    eventType,
    data: {
      groupId: update.id,
      participantJid,
      action: update.action,
    },
    timestamp,
    botInstanceId,
  }))
}

// ---------------------------------------------------------------------------
// Groups update (metadata changes: title, description, etc.)
// ---------------------------------------------------------------------------

export interface BaileysGroupUpdate {
  id: string
  subject?: string
  description?: string
  [key: string]: unknown
}

export function mapGroupsUpdate(
  updates: BaileysGroupUpdate[],
  botInstanceId: string,
): FlowTriggerEvent[] {
  const timestamp = nowIso()
  return updates.map(update => ({
    platform: 'whatsapp' as const,
    communityId: update.id,
    accountId: update.id,
    eventType: 'group_updated',
    data: { ...update },
    timestamp,
    botInstanceId,
  }))
}

// ---------------------------------------------------------------------------
// Presence update
// ---------------------------------------------------------------------------

export interface BaileysPresenceUpdate {
  id: string
  presences: Record<string, { lastKnownPresence: string; lastSeen?: number }>
}

export function mapPresenceUpdate(
  update: BaileysPresenceUpdate,
  botInstanceId: string,
): FlowTriggerEvent[] {
  const timestamp = nowIso()
  const events: FlowTriggerEvent[] = []

  for (const [participantJid, presence] of Object.entries(update.presences)) {
    events.push({
      platform: 'whatsapp',
      communityId: isGroup(update.id) ? update.id : null,
      accountId: participantJid,
      eventType: 'presence_update',
      data: {
        jid: update.id,
        participantJid,
        presence: presence.lastKnownPresence,
        lastSeen: presence.lastSeen ?? null,
      },
      timestamp,
      botInstanceId,
    })
  }

  return events
}
