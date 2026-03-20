import { logger } from '@trigger.dev/sdk/v3';
import type { FlowContext } from './types.js';
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
    const response = await fetch(`${community.botInstance.apiUrl}/execute`, {
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

  const mode = transportConfig?.transport ?? 'connector';
  const botInstanceId = transportConfig?.botInstanceId;
  const discordBotInstanceId = transportConfig?.discordBotInstanceId;
  const useBot = (mode === 'bot_api' || mode === 'connector') && !!botInstanceId;
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
        // Connector / bot_api mode — route to platform-kit /execute endpoint
        response = await dispatchViaBotApi(action, output, botInstanceId!);
      } else if (useAuto) {
        // Auto mode: try connector first, fall back is no longer supported (MTProto removed)
        response = await dispatchViaBotApi(action, output, botInstanceId!);
      } else {
        throw new Error(`Telegram action '${action}' requires a botInstanceId in transportConfig (MTProto transport removed)`);
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

  const response = await fetch(`${botInstance.apiUrl}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Telegram connector returned ${response.status}: ${text}`);
  }

  return response.json();
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

        if (!transportConfig?.botInstanceId) {
          throw new Error(`Telegram unified action '${action}' requires a botInstanceId in transportConfig`);
        }
        const response = await dispatchViaBotApi(telegramAction, telegramParams, transportConfig.botInstanceId);
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
