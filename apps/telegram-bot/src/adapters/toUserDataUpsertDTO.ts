import type { Context } from 'grammy'
import type { UserDataUpsertDTO, UserDataUpsertDTOUpdateKind } from '../dto/UserDataUpsertDTO.js'

export function toUserDataUpsertDTO(
  ctx: Context,
  now: Date = new Date(),
): UserDataUpsertDTO {
  if (!ctx.from?.id) {
    throw new Error('toUserDataUpsertDTO: ctx.from is missing')
  }

  const isMessage = Boolean(ctx.message)
  const text = ctx.message?.text ?? null
  const isCommand = Boolean(text && text.startsWith('/'))

  const updateKind: UserDataUpsertDTOUpdateKind = isMessage
    ? 'message'
    : ctx.callbackQuery
      ? 'callback'
      : 'other'

  return {
    telegramId: BigInt(ctx.from.id),
    username: ctx.from.username ?? null,
    firstName: ctx.from.first_name ?? null,
    lastName: ctx.from.last_name ?? null,
    languageCode: ctx.from.language_code ?? null,
    isBot: Boolean(ctx.from.is_bot),
    lastChatId: ctx.chat?.id ? BigInt(ctx.chat.id) : null,
    updateKind,
    lastMessageText: text,
    seenAt: now,
    messageAt: isMessage ? now : null,
    isCommand,
    messageCountDelta: isMessage ? 1 : 0,
    commandCountDelta: isCommand ? 1 : 0,
  }
}
