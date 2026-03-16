import type { FlowNode, FlowContext } from './types.js';
import { interpolate } from './variables.js';
import { getContext } from './context-store.js';

export async function evaluateCondition(node: FlowNode, ctx: FlowContext): Promise<boolean> {
  switch (node.type) {
    case 'keyword_match':
      return evaluateKeywordMatch(node, ctx);
    case 'user_role':
      return evaluateUserRole(node, ctx);
    case 'time_based':
      return evaluateTimeBased(node, ctx);
    case 'message_type':
      return evaluateMessageType(node, ctx);
    case 'chat_type':
      return evaluateChatType(node, ctx);
    case 'regex_match':
      return evaluateRegexMatch(node, ctx);
    case 'has_media':
      return evaluateHasMedia(node, ctx);
    case 'user_is_admin':
      return evaluateUserIsAdmin(node, ctx);
    case 'message_length':
      return evaluateMessageLength(node, ctx);
    case 'callback_data_match':
      return evaluateCallbackDataMatch(node, ctx);
    case 'user_is_bot':
      return evaluateUserIsBot(node, ctx);

    // --- Context Conditions ---
    case 'context_condition':
      return evaluateContextCondition(node, ctx);

    // --- Discord Conditions ---
    case 'discord_has_role':
      return evaluateDiscordHasRole(node, ctx);
    case 'discord_channel_type':
      return evaluateDiscordChannelType(node, ctx);
    case 'discord_is_bot':
      return evaluateDiscordIsBot(node, ctx);
    case 'discord_message_has_embed':
      return evaluateDiscordMessageHasEmbed(node, ctx);
    case 'discord_member_permissions':
      return evaluateDiscordMemberPermissions(node, ctx);

    default:
      return true;
  }
}

function evaluateKeywordMatch(node: FlowNode, ctx: FlowContext): boolean {
  const keywords = (node.config.keywords as string[]) ?? [];
  const text = String(ctx.triggerData.text ?? '').toLowerCase();
  const mode = (node.config.mode as string) ?? 'any'; // any | all

  if (mode === 'all') {
    return keywords.every((kw) => text.includes(kw.toLowerCase()));
  }
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

function evaluateUserRole(node: FlowNode, ctx: FlowContext): boolean {
  const requiredRoles = (node.config.roles as string[]) ?? [];
  const userRole = String(ctx.triggerData.userRole ?? 'member');
  return requiredRoles.includes(userRole);
}

function evaluateTimeBased(node: FlowNode, ctx: FlowContext): boolean {
  const now = new Date();
  const startHour = (node.config.startHour as number) ?? 0;
  const endHour = (node.config.endHour as number) ?? 24;
  const currentHour = now.getHours();
  return currentHour >= startHour && currentHour < endHour;
}

/**
 * Check if the message type matches one of the expected types.
 * Config: { types: ['text', 'photo', 'video', 'document', 'sticker', 'voice', 'audio', 'animation', 'location', 'contact', 'poll'] }
 */
function evaluateMessageType(node: FlowNode, ctx: FlowContext): boolean {
  const expectedTypes = (node.config.types as string[]) ?? [];
  if (expectedTypes.length === 0) return true;

  const messageType = String(ctx.triggerData.messageType ?? 'text');
  return expectedTypes.includes(messageType);
}

/**
 * Check if the chat type matches one of the expected types.
 * Config: { types: ['private', 'group', 'supergroup', 'channel'] }
 */
function evaluateChatType(node: FlowNode, ctx: FlowContext): boolean {
  const expectedTypes = (node.config.types as string[]) ?? [];
  if (expectedTypes.length === 0) return true;

  const chatType = String(ctx.triggerData.chatType ?? '');
  return expectedTypes.includes(chatType);
}

/**
 * Full regex pattern matching on the message text.
 * Config: { pattern: string, flags?: string }
 */
function evaluateRegexMatch(node: FlowNode, ctx: FlowContext): boolean {
  const pattern = String(node.config.pattern ?? '');
  const flags = String(node.config.flags ?? 'i');
  if (!pattern) return false;

  const text = String(ctx.triggerData.text ?? '');
  try {
    const regex = new RegExp(pattern, flags);
    return regex.test(text);
  } catch {
    return false;
  }
}

/**
 * Check if the incoming message contains media (photo, video, document, etc.).
 * Config: { mediaTypes?: string[] } — optional filter for specific media types.
 */
function evaluateHasMedia(node: FlowNode, ctx: FlowContext): boolean {
  const hasMedia = Boolean(ctx.triggerData.hasMedia);
  const mediaTypes = (node.config.mediaTypes as string[]) ?? [];

  if (mediaTypes.length === 0) return hasMedia;

  const actualType = String(ctx.triggerData.mediaType ?? '');
  return hasMedia && mediaTypes.includes(actualType);
}

/**
 * Check if the user is an admin or creator in the chat.
 * Config: { chatId?, userId? }
 */
function evaluateUserIsAdmin(node: FlowNode, ctx: FlowContext): boolean {
  // In the flow engine context, we check triggerData for admin status
  // This is populated by the manager-bot middleware when it forwards events
  const status = String(ctx.triggerData.userStatus ?? ctx.triggerData.newStatus ?? '');
  return status === 'administrator' || status === 'creator';
}

/**
 * Check if the message length matches the configured threshold.
 * Config: { operator: 'less_than' | 'greater_than' | 'equals' | 'between', threshold: number, maxThreshold?: number }
 */
function evaluateMessageLength(node: FlowNode, ctx: FlowContext): boolean {
  const text = String(ctx.triggerData.text ?? '');
  const length = text.length;
  const operator = String(node.config.operator ?? 'less_than');
  const threshold = Number(node.config.threshold ?? 100);

  switch (operator) {
    case 'less_than': return length < threshold;
    case 'greater_than': return length > threshold;
    case 'equals': return length === threshold;
    case 'between': {
      const maxThreshold = Number(node.config.maxThreshold ?? 500);
      return length >= threshold && length <= maxThreshold;
    }
    default: return false;
  }
}

/**
 * Match callback query data against a pattern.
 * Config: { pattern: string, matchMode: 'exact' | 'starts_with' | 'contains' | 'regex' }
 */
function evaluateCallbackDataMatch(node: FlowNode, ctx: FlowContext): boolean {
  const pattern = String(node.config.pattern ?? '');
  const matchMode = String(node.config.matchMode ?? 'exact');
  const callbackData = String(ctx.triggerData.callbackData ?? '');

  if (!pattern) return false;

  switch (matchMode) {
    case 'exact': return callbackData === pattern;
    case 'starts_with': return callbackData.startsWith(pattern);
    case 'contains': return callbackData.includes(pattern);
    case 'regex': {
      try {
        return new RegExp(pattern).test(callbackData);
      } catch {
        return false;
      }
    }
    default: return false;
  }
}

/**
 * Check if the triggering user is a bot account.
 * Config: { matchBots: boolean }
 */
function evaluateUserIsBot(node: FlowNode, ctx: FlowContext): boolean {
  const isBot = Boolean(ctx.triggerData.isBot ?? false);
  const matchBots = (node.config.matchBots as boolean) ?? true;
  return matchBots ? isBot : !isBot;
}

// ---------------------------------------------------------------------------
// Discord conditions
// ---------------------------------------------------------------------------

/**
 * Check if the triggering Discord member has a specific role.
 * Config: { roleId: string }
 */
function evaluateDiscordHasRole(node: FlowNode, ctx: FlowContext): boolean {
  const roleId = String(node.config.roleId ?? '');
  if (!roleId) return false;
  const roles = (ctx.triggerData.roles as string[]) ?? [];
  return roles.includes(roleId);
}

/**
 * Check if the Discord channel type matches the expected type.
 * Config: { channelType: string }
 */
function evaluateDiscordChannelType(node: FlowNode, ctx: FlowContext): boolean {
  const expected = String(node.config.channelType ?? '');
  if (!expected) return true;
  const actual = String(ctx.triggerData.channelType ?? '');
  return actual === expected;
}

/**
 * Check if the triggering Discord user is a bot.
 * Config: { matchBots?: boolean }
 */
function evaluateDiscordIsBot(node: FlowNode, ctx: FlowContext): boolean {
  const isBot = Boolean(ctx.triggerData.isBot ?? false);
  const matchBots = (node.config.matchBots as boolean) ?? true;
  return matchBots ? isBot : !isBot;
}

/**
 * Check if the Discord message has embedded content.
 * Config: {} (no config needed)
 */
function evaluateDiscordMessageHasEmbed(node: FlowNode, ctx: FlowContext): boolean {
  const embeds = ctx.triggerData.embeds as unknown[] | undefined;
  return Array.isArray(embeds) && embeds.length > 0;
}

/**
 * Check if the Discord member has the required permissions.
 * Config: { permissions: string[] } — list of permission strings (e.g. 'MANAGE_MESSAGES')
 */
function evaluateDiscordMemberPermissions(node: FlowNode, ctx: FlowContext): boolean {
  const required = (node.config.permissions as string[]) ?? [];
  if (required.length === 0) return true;
  const memberPermissions = (ctx.triggerData.permissions as string[]) ?? [];
  return required.every((perm) => memberPermissions.includes(perm));
}

// ---------------------------------------------------------------------------
// Context conditions
// ---------------------------------------------------------------------------

async function evaluateContextCondition(node: FlowNode, ctx: FlowContext): Promise<boolean> {
  const prisma = (ctx as any)._prisma;
  if (!prisma) return false;

  const { key, operator, value: expected } = node.config as {
    key: string;
    operator: 'equals' | 'exists' | 'gt' | 'lt' | 'contains';
    value?: unknown;
  };

  const platformUserId = String(ctx.triggerData.platformUserId ?? ctx.triggerData.userId ?? '');
  const platform = String(ctx.triggerData.platform ?? 'telegram');
  const actual = await getContext(prisma, platformUserId, platform, key);

  switch (operator) {
    case 'exists':
      return actual !== undefined;
    case 'equals':
      return actual === expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    default:
      return false;
  }
}
