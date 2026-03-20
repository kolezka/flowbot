import { logger } from '@trigger.dev/sdk/v3';
import { getTelegramTransport } from '../telegram.js';
import type { FlowContext } from './types.js';
import type { GramJsTransport } from '@flowbot/telegram-transport';
import { dispatchUserAction } from './user-actions.js';

/**
 * Data-driven dispatch: resolve the bot instance from a community ID,
 * then dispatch the action via that bot's HTTP API.
 *
 * This is the new multi-platform routing path. The action name does NOT
 * need a platform prefix — the platform is determined by the community's
 * bot instance.
 *
 * Falls back to the legacy prefix-based routing if no communityId is provided.
 */
export async function dispatchActionToCommunity(
  action: string,
  params: Record<string, unknown>,
  communityId: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { getPrisma } = await import('../prisma.js');
  const prisma = getPrisma();

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    include: { botInstance: { select: { id: true, apiUrl: true, isActive: true, platform: true } } },
  });

  if (!community) {
    return { success: false, error: `Community ${communityId} not found` };
  }

  if (!community.botInstance) {
    return { success: false, error: `Community ${communityId} has no bot instance assigned` };
  }

  if (!community.botInstance.apiUrl || !community.botInstance.isActive) {
    return { success: false, error: `Bot instance ${community.botInstance.id} is not available` };
  }

  try {
    const response = await fetch(`${community.botInstance.apiUrl}/api/execute-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        params,
        communityId: community.platformCommunityId,
        platform: community.platform,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, error: `Bot API returned ${response.status}: ${text}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

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

/** Actions routed to the telegram bot HTTP API. */
const BOT_API_ACTIONS = new Set(['bot_action']);

/**
 * After flow execution, dispatch action results to Telegram.
 * Returns dispatch results for logging/persistence.
 *
 * @param transportConfig - Per-flow transport configuration. When transport is
 *   'bot_api' and a botInstanceId is set, actions are dispatched via the bot's
 *   HTTP API. When 'auto', bot API is tried first (if botInstanceId is set) and
 *   falls back to MTProto. Default behaviour (undefined / 'mtproto') uses the
 *   GramJS MTProto transport.
 */
export async function dispatchActions(
  ctx: FlowContext,
  transportConfig?: {
    transport?: string;
    botInstanceId?: string;
    platform?: string;
    discordBotInstanceId?: string;
    platformConnectionId?: string;
    whatsappBotInstanceId?: string;
  },
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];
  let transport: GramJsTransport | null = null;

  const mode = transportConfig?.transport ?? 'mtproto';
  const botInstanceId = transportConfig?.botInstanceId;
  const discordBotInstanceId = transportConfig?.discordBotInstanceId;
  const useBot = mode === 'bot_api' && !!botInstanceId;
  const useAuto = mode === 'auto' && !!botInstanceId;

  for (const [nodeId, result] of ctx.nodeResults) {
    if (result.status !== 'success' || !result.output) continue;

    const output = result.output as Record<string, unknown>;
    const action = output.action as string | undefined;
    if (!action || !output.executed) continue;

    // Skip internal actions
    if (INTERNAL_ACTIONS.has(action)) continue;

    // Skip context/chaining actions (handled in-engine)
    if (action === 'get_context' || action === 'set_context' || action === 'delete_context' ||
        action === 'run_flow' || action === 'emit_event') continue;

    // Bot action -> already executed via HTTP in actions.ts
    if (BOT_API_ACTIONS.has(action)) continue;

    // Handle user account actions (MTProto only, requires PlatformConnection)
    if (action.startsWith('user_')) {
      const nodeConfig = output.connectionOverride as string | undefined;
      const connectionId = nodeConfig ?? transportConfig?.platformConnectionId;

      if (!connectionId) {
        results.push({ nodeId, dispatched: false, error: 'User account connection required for user_* actions' });
        continue;
      }

      const result = await dispatchUserAction(action, output, connectionId);
      results.push({ ...result, nodeId });
      continue;
    }

    try {
      let response: unknown;

      // Handle unified cross-platform actions
      if (action.startsWith('unified_')) {
        const unifiedResults = await dispatchUnifiedAction(
          nodeId, action, output, transportConfig,
        );
        results.push(...unifiedResults);
        continue;
      }

      // Determine platform from action name prefix
      const platform = action.startsWith('discord_')
        ? 'discord'
        : action.startsWith('whatsapp_')
          ? 'whatsapp'
          : 'telegram';

      if (platform === 'discord') {
        // Discord actions are dispatched via Discord bot API
        const effectiveBotId = discordBotInstanceId ?? botInstanceId;
        if (effectiveBotId) {
          response = await dispatchViaDiscordBotApi(action, output, effectiveBotId);
        } else {
          throw new Error(`Discord action '${action}' requires a discordBotInstanceId in transportConfig`);
        }
      } else if (platform === 'whatsapp') {
        const whatsappAction = action.replace(/^whatsapp_/, '');
        const whatsappBotId = transportConfig?.whatsappBotInstanceId ?? transportConfig?.botInstanceId;
        if (whatsappBotId) {
          response = await dispatchViaWhatsAppConnector(whatsappAction, output, whatsappBotId);
        } else {
          throw new Error(`WhatsApp action '${action}' requires a whatsappBotInstanceId or botInstanceId in transportConfig`);
        }
      } else if (useBot) {
        // Forced bot_api mode
        response = await dispatchViaBotApi(action, output, botInstanceId!);
      } else if (useAuto) {
        // Auto mode: try bot API first, fall back to MTProto
        try {
          response = await dispatchViaBotApi(action, output, botInstanceId!);
        } catch (botErr) {
          logger.warn(`Bot API dispatch failed for ${action}, falling back to MTProto: ${botErr instanceof Error ? botErr.message : String(botErr)}`);
          if (!transport) {
            transport = await getTelegramTransport();
          }
          response = await dispatchToTelegram(transport, action, output);
        }
      } else {
        // MTProto mode (default)
        if (!transport) {
          transport = await getTelegramTransport();
        }
        response = await dispatchToTelegram(transport, action, output);
      }

      results.push({ nodeId, dispatched: true, response });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Dispatch failed for ${action} on node ${nodeId}: ${msg}`);
      results.push({ nodeId, dispatched: false, error: msg });
    }
  }

  return results;
}

async function dispatchViaBotApi(
  action: string,
  params: Record<string, unknown>,
  botInstanceId: string,
): Promise<unknown> {
  const { getPrisma } = await import('../prisma.js');
  const prisma = getPrisma();

  const botInstance = await prisma.botInstance.findUnique({
    where: { id: botInstanceId },
    select: { apiUrl: true, isActive: true },
  });

  if (!botInstance?.apiUrl || !botInstance.isActive) {
    throw new Error(`Bot instance ${botInstanceId} not available`);
  }

  const response = await fetch(`${botInstance.apiUrl}/api/execute-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Bot API returned ${response.status}: ${text}`);
  }

  return response.json();
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

    // --- SP2: Inline & Payments ---
    case 'answer_inline_query':
      return transport.answerInlineQuery(
        String(params.queryId ?? ''),
        (params.results as unknown[]) ?? [],
        { cacheTime: params.cacheTime ? Number(params.cacheTime) : undefined },
      );

    case 'send_invoice':
      return transport.sendInvoice(chatId, {
        title: String(params.title ?? ''),
        description: String(params.description ?? ''),
        payload: String(params.payload ?? ''),
        currency: String(params.currency ?? 'USD'),
        prices: (params.prices as Array<{ label: string, amount: number }>) ?? [],
      });

    case 'answer_pre_checkout':
      return transport.answerPreCheckoutQuery(
        String(params.queryId ?? ''),
        Boolean(params.ok),
        params.errorMessage ? String(params.errorMessage) : undefined,
      );

    // --- SP2: Bot configuration ---
    case 'set_chat_menu_button':
      return transport.setChatMenuButton(chatId, params.menuButton as { type: string, text?: string, url?: string });

    case 'set_my_commands':
      return transport.setMyCommands(
        (params.commands as Array<{ command: string, description: string }>) ?? [],
        params.scope,
      );

    // --- SP2: Media & Forum ---
    case 'send_media_group':
      return transport.sendMediaGroup(chatId, (params.media as Array<{ type: string, url: string, caption?: string }>) ?? []);

    case 'create_forum_topic':
      return transport.createForumTopic(chatId, String(params.name ?? ''), {
        iconColor: params.iconColor ? Number(params.iconColor) : undefined,
        iconEmojiId: params.iconEmojiId ? String(params.iconEmojiId) : undefined,
      });

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

// ---------------------------------------------------------------------------
// Discord dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatch a Discord action via the Discord bot's HTTP API.
 * The Discord bot instance exposes /api/execute-action just like Telegram bot instances.
 */
async function dispatchViaDiscordBotApi(
  action: string,
  params: Record<string, unknown>,
  botInstanceId: string,
): Promise<unknown> {
  const { getPrisma } = await import('../prisma.js');
  const prisma = getPrisma();

  const botInstance = await prisma.botInstance.findUnique({
    where: { id: botInstanceId },
    select: { apiUrl: true, isActive: true },
  });

  if (!botInstance?.apiUrl || !botInstance.isActive) {
    throw new Error(`Discord bot instance ${botInstanceId} not available`);
  }

  const response = await fetch(`${botInstance.apiUrl}/api/execute-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Discord bot API returned ${response.status}: ${text}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// WhatsApp connector dispatch (platform-kit server)
// ---------------------------------------------------------------------------

/**
 * Dispatch a WhatsApp action via the platform-kit connector server.
 * The whatsapp-user connector exposes /execute (not /api/execute-action).
 */
async function dispatchViaWhatsAppConnector(
  action: string,
  params: Record<string, unknown>,
  botInstanceId: string,
): Promise<unknown> {
  const { getPrisma } = await import('../prisma.js');
  const prisma = getPrisma();

  const botInstance = await prisma.botInstance.findUnique({
    where: { id: botInstanceId },
    select: { apiUrl: true, isActive: true },
  });

  if (!botInstance?.apiUrl || !botInstance.isActive) {
    throw new Error(`WhatsApp bot instance ${botInstanceId} not available`);
  }

  const response = await fetch(`${botInstance.apiUrl}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`WhatsApp connector returned ${response.status}: ${text}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Unified cross-platform dispatch
// ---------------------------------------------------------------------------

export interface UnifiedDispatchError {
  platform: 'telegram' | 'discord' | 'whatsapp';
  code: 'RATE_LIMITED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'UNKNOWN';
  message: string;
  originalError?: unknown;
}

const UNIFIED_TO_TELEGRAM: Record<string, string> = {
  unified_send_message: 'send_message',
  unified_send_media: 'send_photo',
  unified_delete_message: 'delete_message',
  unified_ban_user: 'ban_user',
  unified_kick_user: 'ban_user',
  unified_pin_message: 'pin_message',
  unified_send_dm: 'send_message',
  unified_set_role: 'promote_user',
};

const UNIFIED_TO_DISCORD: Record<string, string> = {
  unified_send_message: 'discord_send_message',
  unified_send_media: 'discord_send_message',
  unified_delete_message: 'discord_delete_message',
  unified_ban_user: 'discord_ban_member',
  unified_kick_user: 'discord_kick_member',
  unified_pin_message: 'discord_pin_message',
  unified_send_dm: 'discord_send_dm',
  unified_set_role: 'discord_add_role',
};

const UNIFIED_TO_WHATSAPP: Record<string, string> = {
  unified_send_message: 'send_message',
  unified_send_media: 'send_photo',
  unified_delete_message: 'delete_message',
  unified_ban_user: 'kick_user',
  unified_kick_user: 'kick_user',
  unified_pin_message: 'send_message',
  unified_send_dm: 'send_message',
  unified_set_role: 'promote_user',
  unified_promote_user: 'promote_user',
  unified_demote_user: 'demote_user',
};

async function dispatchUnifiedAction(
  nodeId: string,
  action: string,
  output: Record<string, unknown>,
  transportConfig?: { transport?: string; botInstanceId?: string; platform?: string; discordBotInstanceId?: string; whatsappBotInstanceId?: string },
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];
  const platform = transportConfig?.platform ?? 'telegram';

  if (platform === 'telegram' || platform === 'cross_platform') {
    const telegramAction = UNIFIED_TO_TELEGRAM[action];
    if (telegramAction) {
      try {
        const telegramParams: Record<string, unknown> = {
          ...output,
          action: telegramAction,
          chatId: output.targetChatId,
          userId: output.targetUserId,
          ...(output.telegramOverrides as Record<string, unknown> ?? {}),
        };
        delete telegramParams.telegramOverrides;
        delete telegramParams.discordOverrides;
        delete telegramParams.targetChatId;
        delete telegramParams.targetUserId;

        let response: unknown;
        if (transportConfig?.botInstanceId) {
          response = await dispatchViaBotApi(telegramAction, telegramParams, transportConfig.botInstanceId);
        } else {
          const transport = await getTelegramTransport();
          response = await dispatchToTelegram(transport, telegramAction, telegramParams);
        }
        results.push({ nodeId: `${nodeId}:telegram`, dispatched: true, response });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({ nodeId: `${nodeId}:telegram`, dispatched: false, error: msg });
      }
    }
  }

  if (platform === 'discord' || platform === 'cross_platform') {
    const discordAction = UNIFIED_TO_DISCORD[action];
    if (discordAction) {
      try {
        const discordParams: Record<string, unknown> = {
          ...output,
          action: discordAction,
          channelId: output.targetChatId,
          userId: output.targetUserId,
          ...(output.discordOverrides as Record<string, unknown> ?? {}),
        };
        delete discordParams.telegramOverrides;
        delete discordParams.discordOverrides;
        delete discordParams.targetChatId;
        delete discordParams.targetUserId;

        const effectiveBotId = transportConfig?.discordBotInstanceId ?? transportConfig?.botInstanceId;
        if (!effectiveBotId) {
          throw new Error('Discord dispatch requires discordBotInstanceId');
        }
        const response = await dispatchViaDiscordBotApi(discordAction, discordParams, effectiveBotId);
        results.push({ nodeId: `${nodeId}:discord`, dispatched: true, response });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({ nodeId: `${nodeId}:discord`, dispatched: false, error: msg });
      }
    }
  }

  if (platform === 'whatsapp' || platform === 'cross_platform') {
    const whatsappAction = UNIFIED_TO_WHATSAPP[action];
    if (whatsappAction) {
      try {
        const waParams: Record<string, unknown> = {
          ...output,
          action: whatsappAction,
          chatId: output.targetChatId,
          userId: output.targetUserId,
          ...(output.whatsappOverrides as Record<string, unknown> ?? {}),
        };
        delete waParams.telegramOverrides;
        delete waParams.discordOverrides;
        delete waParams.whatsappOverrides;
        delete waParams.targetChatId;
        delete waParams.targetUserId;

        const waBotId = transportConfig?.whatsappBotInstanceId ?? transportConfig?.botInstanceId;
        if (!waBotId) {
          throw new Error('WhatsApp dispatch requires whatsappBotInstanceId or botInstanceId');
        }
        const response = await dispatchViaWhatsAppConnector(whatsappAction, waParams, waBotId);
        results.push({ nodeId: `${nodeId}:whatsapp`, dispatched: true, response });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({ nodeId: `${nodeId}:whatsapp`, dispatched: false, error: msg });
      }
    }
  }

  return results;
}
