/**
 * Maps grammY update context objects into the standardized FlowTriggerEvent format
 * used by the flow engine.
 */

import type { FlowTriggerEvent } from '@flowbot/platform-kit'
import type { Context } from 'grammy'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString()
}

function chatId(ctx: Context): string | null {
  return ctx.chat ? String(ctx.chat.id) : null
}

function accountId(ctx: Context): string | null {
  return ctx.from ? String(ctx.from.id) : null
}

// ---------------------------------------------------------------------------
// Message received
// ---------------------------------------------------------------------------

export interface TelegramMessageEventData {
  messageId: number
  text: string | null
  mediaType: string | null
  senderName: string | null
  username: string | null
  isDirectMessage: boolean
  command: string | null
  commandArgs: string | null
}

export function mapMessageEvent(ctx: Context, botInstanceId: string): FlowTriggerEvent | null {
  if (!ctx.message || !ctx.chat || !ctx.from) return null

  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup'
  const isDm = ctx.chat.type === 'private'

  const text = ctx.message.text ?? ctx.message.caption ?? null

  let mediaType: string | null = null
  if (ctx.message.photo) mediaType = 'photo'
  else if (ctx.message.video) mediaType = 'video'
  else if (ctx.message.document) mediaType = 'document'
  else if (ctx.message.sticker) mediaType = 'sticker'
  else if (ctx.message.voice) mediaType = 'voice'
  else if (ctx.message.audio) mediaType = 'audio'
  else if (ctx.message.animation) mediaType = 'animation'
  else if (ctx.message.location) mediaType = 'location'
  else if (ctx.message.contact) mediaType = 'contact'
  else if (ctx.message.poll) mediaType = 'poll'

  let command: string | null = null
  let commandArgs: string | null = null
  if (text?.startsWith('/')) {
    const parts = text.split(/\s+/)
    command = (parts[0] ?? '').replace(/@\w+$/, '')
    commandArgs = parts.slice(1).join(' ') || null
  }

  const data: TelegramMessageEventData = {
    messageId: ctx.message.message_id,
    text,
    mediaType,
    senderName: ctx.from.first_name,
    username: ctx.from.username ?? null,
    isDirectMessage: isDm,
    command,
    commandArgs,
  }

  return {
    platform: 'telegram',
    communityId: isGroup ? String(ctx.chat.id) : null,
    accountId: String(ctx.from.id),
    eventType: 'message_received',
    data,
    timestamp: nowIso(),
    botInstanceId,
  }
}

// ---------------------------------------------------------------------------
// Member join
// ---------------------------------------------------------------------------

export function mapMemberJoinEvent(ctx: Context, botInstanceId: string): FlowTriggerEvent | null {
  if (!ctx.chatMember || !ctx.chat) return null

  const update = ctx.chatMember
  const oldStatus = update.old_chat_member.status
  const newStatus = update.new_chat_member.status

  const wasOut = oldStatus === 'left' || oldStatus === 'kicked'
  const isIn = newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator'

  if (!wasOut || !isIn || update.new_chat_member.user.is_bot) return null

  return {
    platform: 'telegram',
    communityId: String(ctx.chat.id),
    accountId: String(update.new_chat_member.user.id),
    eventType: 'member_join',
    data: {
      userId: update.new_chat_member.user.id,
      username: update.new_chat_member.user.username ?? null,
      firstName: update.new_chat_member.user.first_name,
      newStatus,
    },
    timestamp: nowIso(),
    botInstanceId,
  }
}

// ---------------------------------------------------------------------------
// Member leave
// ---------------------------------------------------------------------------

export function mapMemberLeaveEvent(ctx: Context, botInstanceId: string): FlowTriggerEvent | null {
  if (!ctx.chatMember || !ctx.chat) return null

  const update = ctx.chatMember
  const oldStatus = update.old_chat_member.status
  const newStatus = update.new_chat_member.status

  const wasIn = oldStatus === 'member' || oldStatus === 'administrator' || oldStatus === 'creator'
  const isOut = newStatus === 'left' || newStatus === 'kicked'

  if (!wasIn || !isOut || update.new_chat_member.user.is_bot) return null

  return {
    platform: 'telegram',
    communityId: String(ctx.chat.id),
    accountId: String(update.new_chat_member.user.id),
    eventType: 'member_leave',
    data: {
      userId: update.new_chat_member.user.id,
      username: update.new_chat_member.user.username ?? null,
      firstName: update.new_chat_member.user.first_name,
      wasKicked: newStatus === 'kicked',
      oldStatus,
    },
    timestamp: nowIso(),
    botInstanceId,
  }
}

// ---------------------------------------------------------------------------
// Callback query
// ---------------------------------------------------------------------------

export function mapCallbackQueryEvent(ctx: Context, botInstanceId: string): FlowTriggerEvent | null {
  if (!ctx.callbackQuery || !ctx.from) return null

  const chatIdVal = ctx.callbackQuery.message?.chat
    ? String(ctx.callbackQuery.message.chat.id)
    : null

  return {
    platform: 'telegram',
    communityId: chatIdVal,
    accountId: String(ctx.from.id),
    eventType: 'callback_query',
    data: {
      callbackQueryId: ctx.callbackQuery.id,
      data: ctx.callbackQuery.data ?? null,
      messageId: ctx.callbackQuery.message?.message_id ?? null,
      username: ctx.from.username ?? null,
    },
    timestamp: nowIso(),
    botInstanceId,
  }
}
