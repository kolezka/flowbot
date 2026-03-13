import { logger } from '@trigger.dev/sdk/v3';
import { getTelegramTransport } from '../telegram.js';
import type { FlowContext } from './types.js';
import type { GramJsTransport } from '@tg-allegro/telegram-transport';

export interface DispatchResult {
  nodeId: string;
  dispatched: boolean;
  response?: unknown;
  error?: string;
}

/** Actions that don't need Telegram (already fully executed during flow). */
const INTERNAL_ACTIONS = new Set([
  'delay', 'api_call', 'db_query', 'transform', 'loop', 'switch',
  'parallel_branch', 'notification',
]);

/** Actions routed to the manager bot HTTP API. */
const BOT_API_ACTIONS = new Set(['bot_action']);

/**
 * After flow execution, dispatch action results to Telegram.
 * Returns dispatch results for logging/persistence.
 */
export async function dispatchActions(
  ctx: FlowContext,
  managerBotApiUrl?: string,
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];
  let transport: GramJsTransport | null = null;

  for (const [nodeId, result] of ctx.nodeResults) {
    if (result.status !== 'success' || !result.output) continue;

    const output = result.output as Record<string, unknown>;
    const action = output.action as string | undefined;
    if (!action || !output.executed) continue;

    // Skip internal actions
    if (INTERNAL_ACTIONS.has(action)) continue;

    // Bot action → already executed via HTTP in actions.ts
    if (BOT_API_ACTIONS.has(action)) continue;

    try {
      // Lazy-init transport
      if (!transport) {
        transport = await getTelegramTransport();
      }
      const response = await dispatchToTelegram(transport, action, output);
      results.push({ nodeId, dispatched: true, response });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Dispatch failed for ${action} on node ${nodeId}: ${msg}`);
      results.push({ nodeId, dispatched: false, error: msg });
    }
  }

  return results;
}

async function dispatchToTelegram(
  transport: GramJsTransport,
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const chatId = String(params.chatId ?? '');
  const userId = String(params.userId ?? '');
  const messageId = params.messageId ? Number(params.messageId) : undefined;

  switch (action) {
    // --- Messaging ---
    case 'send_message':
      return transport.sendMessage(chatId, String(params.text ?? ''), {
        parseMode: mapParseMode(params.parseMode),
        silent: Boolean(params.disableNotification),
        replyToMsgId: params.replyToMessageId ? Number(params.replyToMessageId) : undefined,
      });

    case 'send_photo':
      return transport.sendPhoto(chatId, String(params.photoUrl ?? ''), {
        caption: params.caption ? String(params.caption) : undefined,
        parseMode: mapParseMode(params.parseMode),
      });

    case 'send_video':
      return transport.sendVideo(chatId, String(params.videoUrl ?? ''), {
        caption: params.caption ? String(params.caption) : undefined,
        parseMode: mapParseMode(params.parseMode),
      });

    case 'send_document':
      return transport.sendDocument(chatId, String(params.documentUrl ?? ''), {
        caption: params.caption ? String(params.caption) : undefined,
        parseMode: mapParseMode(params.parseMode),
        fileName: params.fileName ? String(params.fileName) : undefined,
      });

    case 'send_sticker':
      return transport.sendSticker(chatId, String(params.sticker ?? ''));

    case 'send_voice':
      return transport.sendVoice(chatId, String(params.voiceUrl ?? ''), {
        caption: params.caption ? String(params.caption) : undefined,
        parseMode: mapParseMode(params.parseMode),
      });

    case 'send_audio':
      return transport.sendAudio(chatId, String(params.audioUrl ?? ''), {
        caption: params.caption ? String(params.caption) : undefined,
        parseMode: mapParseMode(params.parseMode),
      });

    case 'send_animation':
      return transport.sendAnimation(chatId, String(params.animationUrl ?? ''), {
        caption: params.caption ? String(params.caption) : undefined,
        parseMode: mapParseMode(params.parseMode),
      });

    case 'send_location':
      return transport.sendLocation(chatId, Number(params.latitude), Number(params.longitude), {
        livePeriod: params.livePeriod ? Number(params.livePeriod) : undefined,
      });

    case 'send_contact':
      return transport.sendContact(
        chatId,
        String(params.phoneNumber ?? ''),
        String(params.firstName ?? ''),
        params.lastName ? String(params.lastName) : undefined,
      );

    case 'send_venue':
      return transport.sendVenue(
        chatId,
        Number(params.latitude),
        Number(params.longitude),
        String(params.title ?? ''),
        String(params.address ?? ''),
      );

    case 'send_dice':
      return transport.sendDice(chatId, params.emoji ? String(params.emoji) : undefined);

    // --- Message management ---
    case 'forward_message':
      return transport.forwardMessage(
        String(params.fromChatId ?? ''),
        String(params.toChatId ?? ''),
        messageId ? [messageId] : [],
      );

    case 'copy_message':
      return transport.copyMessage(
        String(params.fromChatId ?? ''),
        String(params.toChatId ?? ''),
        messageId ?? 0,
      );

    case 'edit_message':
      return transport.editMessage(chatId, messageId ?? 0, String(params.text ?? ''), {
        parseMode: mapParseMode(params.parseMode),
      });

    case 'delete_message':
      return transport.deleteMessages(chatId, messageId ? [messageId] : []);

    case 'pin_message':
      return transport.pinMessage(chatId, messageId ?? 0, Boolean(params.disableNotification));

    case 'unpin_message':
      return transport.unpinMessage(chatId, messageId ?? undefined);

    // --- User management ---
    case 'ban_user':
      return transport.banUser(chatId, userId);

    case 'mute_user':
      return transport.restrictUser(chatId, userId, { canSendMessages: false }, params.duration ? Number(params.duration) : undefined);

    case 'restrict_user':
      return transport.restrictUser(
        chatId,
        userId,
        (params.permissions as Record<string, boolean>) ?? {},
        params.untilDate ? Number(params.untilDate) : undefined,
      );

    case 'promote_user':
      return transport.promoteUser(chatId, userId, (params.privileges as Record<string, boolean>) ?? {});

    // --- Chat management ---
    case 'set_chat_title':
      return transport.setChatTitle(chatId, String(params.title ?? ''));

    case 'set_chat_description':
      return transport.setChatDescription(chatId, String(params.description ?? ''));

    case 'export_invite_link':
      return transport.exportInviteLink(chatId);

    case 'get_chat_member':
      return transport.getChatMember(chatId, userId);

    case 'leave_chat':
      return transport.leaveChat(chatId);

    // --- Interactive ---
    case 'create_poll':
      return transport.createPoll(
        chatId,
        String(params.question ?? ''),
        (params.options as string[]) ?? [],
        {
          isAnonymous: params.isAnonymous as boolean | undefined,
          multipleChoice: params.allowsMultipleAnswers as boolean | undefined,
        },
      );

    case 'answer_callback_query':
      return transport.answerCallbackQuery(
        String(params.callbackQueryId ?? ''),
        {
          text: params.text ? String(params.text) : undefined,
          showAlert: params.showAlert as boolean | undefined,
          url: params.url ? String(params.url) : undefined,
        },
      );

    // Catch-all for not-yet-implemented actions
    default:
      logger.warn(`Telegram action '${action}' dispatch not yet implemented`);
      return { action, dispatched: false, reason: 'not_implemented' };
  }
}

function mapParseMode(mode: unknown): 'html' | 'markdown' | undefined {
  const str = String(mode ?? '').toLowerCase();
  if (str === 'html') return 'html';
  if (str === 'markdownv2' || str === 'markdown') return 'markdown';
  return undefined;
}
