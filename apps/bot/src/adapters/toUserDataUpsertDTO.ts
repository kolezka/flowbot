import { Context } from 'grammy';
import { UserDataUpsertDTO, UserDataUpsertDTOUpdateKind } from '../dto/UserDataUpsertDTO';

/**
 * Convert Telegram context to UserUpsertDTO
 * This is inbound adapter - maps external Telegram data to internal DTO
 */
export function toUserDataUpsertDTO(
  ctx: Context,
  now: Date = new Date(),
): UserDataUpsertDTO {
  if (!ctx.from?.id) {
    throw new Error('toUserUpsertDTO: ctx.from is missing');
  }

  const isMessage = Boolean(ctx.message);
  const text = ctx.message?.text ?? null;
  const isCommand = Boolean(text && text.startsWith('/'));

  const updateKind: UserDataUpsertDTOUpdateKind = isMessage
    ? 'message'
    : ctx.callbackQuery
      ? 'callback'
      : 'other';

  return {
    // identity
    telegramId: BigInt(ctx.from.id),
    username: ctx.from.username ?? null,
    firstName: ctx.from.first_name ?? null,
    lastName: ctx.from.last_name ?? null,
    languageCode: ctx.from.language_code ?? null,
    isBot: Boolean(ctx.from.is_bot),

    // context
    lastChatId: ctx.chat?.id ? BigInt(ctx.chat.id) : null,
    updateKind,
    lastMessageText: text,

    // times
    seenAt: now,
    messageAt: isMessage ? now : null,
    isCommand,

    // deltas
    messageCountDelta: isMessage ? 1 : 0,
    commandCountDelta: isCommand ? 1 : 0,
  };
}
