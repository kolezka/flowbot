import type { FlowNode, FlowContext } from './types.js';
import { interpolate } from './variables.js';
import { getPrisma } from '../prisma.js';
import { getContext, setContext, deleteContext } from './context-store.js';

export async function executeAction(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  switch (node.type) {
    case 'send_message':
      return executeSendMessage(node, ctx);
    case 'send_photo':
      return executeSendPhoto(node, ctx);
    case 'forward_message':
      return executeForwardMessage(node, ctx);
    case 'copy_message':
      return executeCopyMessage(node, ctx);
    case 'edit_message':
      return executeEditMessage(node, ctx);
    case 'delete_message':
      return executeDeleteMessage(node, ctx);
    case 'pin_message':
      return executePinMessage(node, ctx);
    case 'unpin_message':
      return executeUnpinMessage(node, ctx);
    case 'ban_user':
      return executeBanUser(node, ctx);
    case 'mute_user':
      return executeMuteUser(node, ctx);
    case 'restrict_user':
      return executeRestrictUser(node, ctx);
    case 'promote_user':
      return executePromoteUser(node, ctx);
    case 'create_poll':
      return executeCreatePoll(node, ctx);
    case 'answer_callback_query':
      return executeAnswerCallbackQuery(node, ctx);
    case 'api_call':
      return executeApiCall(node, ctx);
    case 'delay':
      return executeDelay(node, ctx);
    case 'bot_action':
      return executeBotAction(node, ctx);
    case 'send_video':
      return executeSendVideo(node, ctx);
    case 'send_document':
      return executeSendDocument(node, ctx);
    case 'send_sticker':
      return executeSendSticker(node, ctx);
    case 'send_location':
      return executeSendLocation(node, ctx);
    case 'send_voice':
      return executeSendVoice(node, ctx);
    case 'send_contact':
      return executeSendContact(node, ctx);
    case 'set_chat_title':
      return executeSetChatTitle(node, ctx);
    case 'set_chat_description':
      return executeSetChatDescription(node, ctx);
    case 'export_invite_link':
      return executeExportInviteLink(node, ctx);
    case 'get_chat_member':
      return executeGetChatMember(node, ctx);
    case 'send_animation':
      return executeSendAnimation(node, ctx);
    case 'send_venue':
      return executeSendVenue(node, ctx);
    case 'send_dice':
      return executeSendDice(node, ctx);
    case 'send_media_group':
      return executeSendMediaGroup(node, ctx);
    case 'send_audio':
      return executeSendAudio(node, ctx);
    case 'leave_chat':
      return executeLeaveChat(node, ctx);
    case 'get_chat_info':
      return executeGetChatInfo(node, ctx);
    case 'set_chat_photo':
      return executeSetChatPhoto(node, ctx);
    case 'delete_chat_photo':
      return executeDeleteChatPhoto(node, ctx);
    case 'approve_join_request':
      return executeApproveJoinRequest(node, ctx);

    // --- Unified Cross-Platform Actions ---
    case 'unified_send_message':
    case 'unified_send_media':
    case 'unified_delete_message':
    case 'unified_ban_user':
    case 'unified_kick_user':
    case 'unified_pin_message':
    case 'unified_send_dm':
    case 'unified_set_role':
      return executeUnifiedAction(node, ctx);

    // --- Context Actions ---
    case 'get_context':
      return executeGetContext(node, ctx);
    case 'set_context':
      return executeSetContext(node, ctx);
    case 'delete_context':
      return executeDeleteContext(node, ctx);

    // --- Flow Chaining ---
    case 'run_flow':
      return executeRunFlow(node, ctx);
    case 'emit_event':
      return executeEmitEvent(node, ctx);

    // --- Discord Actions ---
    case 'discord_send_message':
      return executeDiscordSendMessage(node, ctx);
    case 'discord_send_embed':
      return executeDiscordSendEmbed(node, ctx);
    case 'discord_send_dm':
      return executeDiscordSendDM(node, ctx);
    case 'discord_edit_message':
      return executeDiscordEditMessage(node, ctx);
    case 'discord_delete_message':
      return executeDiscordDeleteMessage(node, ctx);
    case 'discord_add_reaction':
      return executeDiscordAddReaction(node, ctx);
    case 'discord_remove_reaction':
      return executeDiscordRemoveReaction(node, ctx);
    case 'discord_pin_message':
      return executeDiscordPinMessage(node, ctx);
    case 'discord_unpin_message':
      return executeDiscordUnpinMessage(node, ctx);
    case 'discord_ban_member':
      return executeDiscordBanMember(node, ctx);
    case 'discord_kick_member':
      return executeDiscordKickMember(node, ctx);
    case 'discord_timeout_member':
      return executeDiscordTimeoutMember(node, ctx);
    case 'discord_add_role':
      return executeDiscordAddRole(node, ctx);
    case 'discord_remove_role':
      return executeDiscordRemoveRole(node, ctx);
    case 'discord_create_role':
      return executeDiscordCreateRole(node, ctx);
    case 'discord_set_nickname':
      return executeDiscordSetNickname(node, ctx);
    case 'discord_create_channel':
      return executeDiscordCreateChannel(node, ctx);
    case 'discord_delete_channel':
      return executeDiscordDeleteChannel(node, ctx);
    case 'discord_move_member':
      return executeDiscordMoveMember(node, ctx);
    case 'discord_create_thread':
      return executeDiscordCreateThread(node, ctx);
    case 'discord_send_thread_message':
      return executeDiscordSendThreadMessage(node, ctx);
    case 'discord_create_invite':
      return executeDiscordCreateInvite(node, ctx);
    case 'discord_create_scheduled_event':
      return executeDiscordCreateScheduledEvent(node, ctx);

    default:
      throw new Error(`Unknown action type: ${node.type}`);
  }
}

// ---------------------------------------------------------------------------
// Messaging actions
// ---------------------------------------------------------------------------

async function executeSendMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const text = interpolate(String(node.config.text ?? ''), ctx);
  const parseMode = String(node.config.parseMode ?? 'HTML');
  const disableNotification = Boolean(node.config.disableNotification ?? false);
  const replyToMessageId = node.config.replyToMessageId
    ? interpolate(String(node.config.replyToMessageId), ctx)
    : undefined;

  return {
    action: 'send_message',
    chatId,
    text,
    parseMode,
    disableNotification,
    replyToMessageId,
    executed: true,
  };
}

/**
 * Send a photo message with optional caption.
 * Config: { chatId, photoUrl, caption?, parseMode? }
 */
async function executeSendPhoto(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const photoUrl = interpolate(String(node.config.photoUrl ?? ''), ctx);
  const caption = node.config.caption
    ? interpolate(String(node.config.caption), ctx)
    : undefined;
  const parseMode = String(node.config.parseMode ?? 'HTML');

  if (!photoUrl) {
    throw new Error('send_photo requires photoUrl');
  }

  return { action: 'send_photo', chatId, photoUrl, caption, parseMode, executed: true };
}

async function executeForwardMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const fromChatId = interpolate(String(node.config.fromChatId ?? ''), ctx);
  const toChatId = interpolate(String(node.config.toChatId ?? ''), ctx);
  const messageId = node.config.messageId ?? ctx.triggerData.messageId;

  return { action: 'forward_message', fromChatId, toChatId, messageId, executed: true };
}

/**
 * Copy a message to another chat (like forward but without the "Forwarded from" header).
 * Config: { fromChatId, toChatId, messageId? }
 */
async function executeCopyMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const fromChatId = interpolate(String(node.config.fromChatId ?? '{{trigger.chatId}}'), ctx);
  const toChatId = interpolate(String(node.config.toChatId ?? ''), ctx);
  const messageId = node.config.messageId
    ? interpolate(String(node.config.messageId), ctx)
    : ctx.triggerData.messageId;

  if (!toChatId) {
    throw new Error('copy_message requires toChatId');
  }

  return { action: 'copy_message', fromChatId, toChatId, messageId, executed: true };
}

/**
 * Edit an existing message's text.
 * Config: { chatId, messageId, text, parseMode? }
 */
async function executeEditMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const messageId = node.config.messageId
    ? interpolate(String(node.config.messageId), ctx)
    : ctx.triggerData.messageId;
  const text = interpolate(String(node.config.text ?? ''), ctx);
  const parseMode = String(node.config.parseMode ?? 'HTML');

  if (!messageId) {
    throw new Error('edit_message requires messageId');
  }

  return { action: 'edit_message', chatId, messageId, text, parseMode, executed: true };
}

/**
 * Delete a message from a chat.
 * Config: { chatId, messageId }
 */
async function executeDeleteMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const messageId = node.config.messageId
    ? interpolate(String(node.config.messageId), ctx)
    : ctx.triggerData.messageId;

  if (!messageId) {
    throw new Error('delete_message requires messageId');
  }

  return { action: 'delete_message', chatId, messageId, executed: true };
}

/**
 * Pin a message in a chat.
 * Config: { chatId, messageId, disableNotification? }
 */
async function executePinMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const messageId = node.config.messageId
    ? interpolate(String(node.config.messageId), ctx)
    : ctx.triggerData.messageId;
  const disableNotification = Boolean(node.config.disableNotification ?? false);

  if (!messageId) {
    throw new Error('pin_message requires messageId');
  }

  return { action: 'pin_message', chatId, messageId, disableNotification, executed: true };
}

/**
 * Unpin a message or all messages in a chat.
 * Config: { chatId, messageId? } — if messageId is omitted, unpins all messages.
 */
async function executeUnpinMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const messageId = node.config.messageId
    ? interpolate(String(node.config.messageId), ctx)
    : undefined;

  return { action: 'unpin_message', chatId, messageId, unpinAll: !messageId, executed: true };
}

/**
 * Send a video message with optional caption.
 * Config: { chatId, videoUrl, caption?, parseMode?, duration?, width?, height?, supportsStreaming? }
 */
async function executeSendVideo(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const videoUrl = interpolate(String(node.config.videoUrl ?? ''), ctx);
  const caption = node.config.caption
    ? interpolate(String(node.config.caption), ctx)
    : undefined;
  const parseMode = String(node.config.parseMode ?? 'HTML');
  const duration = (node.config.duration as number) ?? undefined;
  const width = (node.config.width as number) ?? undefined;
  const height = (node.config.height as number) ?? undefined;
  const supportsStreaming = Boolean(node.config.supportsStreaming ?? true);

  if (!videoUrl) {
    throw new Error('send_video requires videoUrl');
  }

  return { action: 'send_video', chatId, videoUrl, caption, parseMode, duration, width, height, supportsStreaming, executed: true };
}

/**
 * Send a document/file message with optional caption.
 * Config: { chatId, documentUrl, caption?, parseMode?, fileName? }
 */
async function executeSendDocument(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const documentUrl = interpolate(String(node.config.documentUrl ?? ''), ctx);
  const caption = node.config.caption
    ? interpolate(String(node.config.caption), ctx)
    : undefined;
  const parseMode = String(node.config.parseMode ?? 'HTML');
  const fileName = node.config.fileName
    ? interpolate(String(node.config.fileName), ctx)
    : undefined;

  if (!documentUrl) {
    throw new Error('send_document requires documentUrl');
  }

  return { action: 'send_document', chatId, documentUrl, caption, parseMode, fileName, executed: true };
}

/**
 * Send a sticker message.
 * Config: { chatId, sticker (file_id or URL) }
 */
async function executeSendSticker(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const sticker = interpolate(String(node.config.sticker ?? ''), ctx);

  if (!sticker) {
    throw new Error('send_sticker requires sticker (file_id or URL)');
  }

  return { action: 'send_sticker', chatId, sticker, executed: true };
}

/**
 * Send a location message.
 * Config: { chatId, latitude, longitude, livePeriod? }
 */
async function executeSendLocation(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const latitude = Number(node.config.latitude ?? 0);
  const longitude = Number(node.config.longitude ?? 0);
  const livePeriod = (node.config.livePeriod as number) ?? undefined;

  if (latitude === 0 && longitude === 0) {
    throw new Error('send_location requires valid latitude and longitude');
  }

  return { action: 'send_location', chatId, latitude, longitude, livePeriod, executed: true };
}

/**
 * Send a voice message.
 * Config: { chatId, voiceUrl, caption?, parseMode?, duration? }
 */
async function executeSendVoice(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const voiceUrl = interpolate(String(node.config.voiceUrl ?? ''), ctx);
  const caption = node.config.caption
    ? interpolate(String(node.config.caption), ctx)
    : undefined;
  const parseMode = String(node.config.parseMode ?? 'HTML');
  const duration = (node.config.duration as number) ?? undefined;

  if (!voiceUrl) {
    throw new Error('send_voice requires voiceUrl');
  }

  return { action: 'send_voice', chatId, voiceUrl, caption, parseMode, duration, executed: true };
}

/**
 * Send a contact card.
 * Config: { chatId, phoneNumber, firstName, lastName? }
 */
async function executeSendContact(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const phoneNumber = interpolate(String(node.config.phoneNumber ?? ''), ctx);
  const firstName = interpolate(String(node.config.firstName ?? ''), ctx);
  const lastName = node.config.lastName
    ? interpolate(String(node.config.lastName), ctx)
    : undefined;

  if (!phoneNumber || !firstName) {
    throw new Error('send_contact requires phoneNumber and firstName');
  }

  return { action: 'send_contact', chatId, phoneNumber, firstName, lastName, executed: true };
}

/**
 * Set the title of a chat (group/supergroup/channel).
 * Config: { chatId, title }
 */
async function executeSetChatTitle(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const title = interpolate(String(node.config.title ?? ''), ctx);

  if (!title) {
    throw new Error('set_chat_title requires title');
  }
  if (title.length > 128) {
    throw new Error('Chat title must be 128 characters or fewer');
  }

  return { action: 'set_chat_title', chatId, title, executed: true };
}

/**
 * Set the description of a chat (group/supergroup/channel).
 * Config: { chatId, description }
 */
async function executeSetChatDescription(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const description = interpolate(String(node.config.description ?? ''), ctx);

  if (description.length > 255) {
    throw new Error('Chat description must be 255 characters or fewer');
  }

  return { action: 'set_chat_description', chatId, description, executed: true };
}

/**
 * Export (generate) a chat invite link.
 * Config: { chatId, name?, expireDate?, memberLimit? }
 */
async function executeExportInviteLink(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const name = node.config.name
    ? interpolate(String(node.config.name), ctx)
    : undefined;
  const expireDate = (node.config.expireDate as number) ?? undefined;
  const memberLimit = (node.config.memberLimit as number) ?? undefined;

  return { action: 'export_invite_link', chatId, name, expireDate, memberLimit, executed: true };
}

/**
 * Get information about a chat member.
 * Config: { chatId, userId }
 */
async function executeGetChatMember(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);

  return { action: 'get_chat_member', chatId, userId, executed: true };
}

// ---------------------------------------------------------------------------
// User management actions
// ---------------------------------------------------------------------------

async function executeBanUser(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const reason = interpolate(String(node.config.reason ?? ''), ctx);

  return { action: 'ban_user', chatId, userId, reason, executed: true };
}

async function executeMuteUser(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const duration = (node.config.durationSeconds as number) ?? 3600;

  return { action: 'mute_user', chatId, userId, duration, executed: true };
}

/**
 * Restrict a user's permissions in a chat.
 * Config: { chatId, userId, permissions: { canSendMessages?, canSendMedia?, canSendPolls?,
 *   canSendOther?, canAddWebPagePreviews?, canChangeInfo?, canInviteUsers?, canPinMessages? },
 *   untilDate? (seconds from now) }
 */
async function executeRestrictUser(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const permissions = (node.config.permissions as Record<string, boolean>) ?? {
    canSendMessages: false,
    canSendMedia: false,
    canSendPolls: false,
    canSendOther: false,
    canAddWebPagePreviews: false,
    canChangeInfo: false,
    canInviteUsers: false,
    canPinMessages: false,
  };
  const untilDateSeconds = (node.config.untilDate as number) ?? 0;
  const untilDate = untilDateSeconds > 0
    ? Math.floor(Date.now() / 1000) + untilDateSeconds
    : 0;

  return { action: 'restrict_user', chatId, userId, permissions, untilDate, executed: true };
}

/**
 * Promote a user to admin with specified privileges.
 * Config: { chatId, userId, privileges: { canManageChat?, canDeleteMessages?, canManageVideoChats?,
 *   canRestrictMembers?, canPromoteMembers?, canChangeInfo?, canInviteUsers?, canPostMessages?,
 *   canEditMessages?, canPinMessages? } }
 */
async function executePromoteUser(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const privileges = (node.config.privileges as Record<string, boolean>) ?? {
    canManageChat: true,
    canDeleteMessages: false,
    canRestrictMembers: false,
    canPromoteMembers: false,
    canChangeInfo: false,
    canInviteUsers: true,
    canPinMessages: false,
  };

  return { action: 'promote_user', chatId, userId, privileges, executed: true };
}

// ---------------------------------------------------------------------------
// Interactive actions
// ---------------------------------------------------------------------------

/**
 * Create a poll in a chat.
 * Config: { chatId, question, options: string[], isAnonymous?, allowsMultipleAnswers?, type? ('regular' | 'quiz'), correctOptionId? }
 */
async function executeCreatePoll(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const question = interpolate(String(node.config.question ?? ''), ctx);
  const options = (node.config.options as string[]) ?? [];
  const isAnonymous = (node.config.isAnonymous as boolean) ?? true;
  const allowsMultipleAnswers = (node.config.allowsMultipleAnswers as boolean) ?? false;
  const pollType = String(node.config.pollType ?? 'regular');
  const correctOptionId = (node.config.correctOptionId as number) ?? undefined;

  if (!question) {
    throw new Error('create_poll requires question');
  }
  if (options.length < 2) {
    throw new Error('create_poll requires at least 2 options');
  }

  return {
    action: 'create_poll',
    chatId,
    question,
    options,
    isAnonymous,
    allowsMultipleAnswers,
    pollType,
    correctOptionId,
    executed: true,
  };
}

/**
 * Answer a callback query (inline button press) with optional alert.
 * Config: { callbackQueryId, text?, showAlert?, url? }
 */
async function executeAnswerCallbackQuery(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const callbackQueryId = interpolate(
    String(node.config.callbackQueryId ?? '{{trigger.callbackQueryId}}'),
    ctx,
  );
  const text = node.config.text
    ? interpolate(String(node.config.text), ctx)
    : undefined;
  const showAlert = Boolean(node.config.showAlert ?? false);
  const url = node.config.url
    ? interpolate(String(node.config.url), ctx)
    : undefined;

  return { action: 'answer_callback_query', callbackQueryId, text, showAlert, url, executed: true };
}

// ---------------------------------------------------------------------------
// Utility actions
// ---------------------------------------------------------------------------

async function executeApiCall(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const url = interpolate(String(node.config.url ?? ''), ctx);
  const method = String(node.config.method ?? 'GET');
  const bodyTemplate = node.config.body ? interpolate(JSON.stringify(node.config.body), ctx) : undefined;
  const timeoutMs = (node.config.timeoutMs as number) ?? 10_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: bodyTemplate,
      signal: controller.signal,
    });

    return { status: response.status, data: await response.json().catch(() => null) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API call to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function executeDelay(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const ms = (node.config.delayMs as number) ?? 1000;
  await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 30000)));
  return { action: 'delay', ms };
}

async function executeBotAction(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const botInstanceId = interpolate(String(node.config.botInstanceId ?? ''), ctx);
  const action = interpolate(String(node.config.action ?? ''), ctx);
  const params = node.config.params as Record<string, unknown> ?? {};

  if (!botInstanceId) {
    throw new Error('bot_action requires botInstanceId');
  }
  if (!action) {
    throw new Error('bot_action requires action');
  }

  // Look up BotInstance from DB to get its API URL
  const prisma = getPrisma();
  const botInstance = await prisma.botInstance.findUnique({
    where: { id: botInstanceId },
  });

  if (!botInstance) {
    throw new Error(`BotInstance not found: ${botInstanceId}`);
  }
  if (!botInstance.apiUrl) {
    throw new Error(`BotInstance ${botInstanceId} has no apiUrl configured`);
  }
  if (!botInstance.isActive) {
    throw new Error(`BotInstance ${botInstanceId} is not active`);
  }

  // Interpolate param values
  const interpolatedParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    interpolatedParams[key] = typeof value === 'string' ? interpolate(value, ctx) : value;
  }

  // Make HTTP call to the bot's API endpoint with timeout
  const url = `${botInstance.apiUrl.replace(/\/+$/, '')}/api/send-message`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  let data: unknown;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...interpolatedParams }),
      signal: controller.signal,
    });
    data = await response.json().catch(() => null);
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Bot action request to ${url} timed out after 10s`);
    }
    throw error;
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(`Bot action failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return { action: 'bot_action', botInstanceId, botAction: action, status: response.status, data };
}

// ---------------------------------------------------------------------------
// Additional messaging actions
// ---------------------------------------------------------------------------

/**
 * Send an animation (GIF) message with optional caption.
 * Config: { chatId, animationUrl, caption?, parseMode?, duration?, width?, height? }
 */
async function executeSendAnimation(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const animationUrl = interpolate(String(node.config.animationUrl ?? ''), ctx);
  const caption = node.config.caption
    ? interpolate(String(node.config.caption), ctx)
    : undefined;
  const parseMode = String(node.config.parseMode ?? 'HTML');
  const duration = (node.config.duration as number) ?? undefined;
  const width = (node.config.width as number) ?? undefined;
  const height = (node.config.height as number) ?? undefined;

  if (!animationUrl) {
    throw new Error('send_animation requires animationUrl');
  }

  return { action: 'send_animation', chatId, animationUrl, caption, parseMode, duration, width, height, executed: true };
}

/**
 * Send a venue (location with name and address).
 * Config: { chatId, latitude, longitude, title, address, foursquareId?, foursquareType? }
 */
async function executeSendVenue(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const latitude = Number(node.config.latitude ?? 0);
  const longitude = Number(node.config.longitude ?? 0);
  const title = interpolate(String(node.config.title ?? ''), ctx);
  const address = interpolate(String(node.config.address ?? ''), ctx);
  const foursquareId = node.config.foursquareId
    ? interpolate(String(node.config.foursquareId), ctx)
    : undefined;
  const foursquareType = node.config.foursquareType
    ? interpolate(String(node.config.foursquareType), ctx)
    : undefined;

  if (!title || !address) {
    throw new Error('send_venue requires title and address');
  }
  if (latitude === 0 && longitude === 0) {
    throw new Error('send_venue requires valid latitude and longitude');
  }

  return { action: 'send_venue', chatId, latitude, longitude, title, address, foursquareId, foursquareType, executed: true };
}

/**
 * Send an animated dice/emoji with a random value.
 * Config: { chatId, emoji? ('🎲' | '🎯' | '🏀' | '⚽' | '🎳' | '🎰') }
 */
async function executeSendDice(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const emoji = String(node.config.emoji ?? '🎲');

  return { action: 'send_dice', chatId, emoji, executed: true };
}

/**
 * Send a group of photos/videos as an album (2-10 items).
 * Config: { chatId, media: Array<{ type: 'photo' | 'video', url: string, caption?: string }> }
 */
async function executeSendMediaGroup(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const media = (node.config.media as Array<{ type: string; url: string; caption?: string }>) ?? [];

  if (media.length < 2) {
    throw new Error('send_media_group requires at least 2 media items');
  }
  if (media.length > 10) {
    throw new Error('send_media_group allows at most 10 media items');
  }

  const resolvedMedia = media.map((item) => ({
    type: item.type,
    url: interpolate(String(item.url), ctx),
    caption: item.caption ? interpolate(String(item.caption), ctx) : undefined,
  }));

  return { action: 'send_media_group', chatId, media: resolvedMedia, executed: true };
}

/**
 * Send an audio file with metadata.
 * Config: { chatId, audioUrl, caption?, parseMode?, duration?, performer?, title? }
 */
async function executeSendAudio(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const audioUrl = interpolate(String(node.config.audioUrl ?? ''), ctx);
  const caption = node.config.caption
    ? interpolate(String(node.config.caption), ctx)
    : undefined;
  const parseMode = String(node.config.parseMode ?? 'HTML');
  const duration = (node.config.duration as number) ?? undefined;
  const performer = node.config.performer
    ? interpolate(String(node.config.performer), ctx)
    : undefined;
  const title = node.config.title
    ? interpolate(String(node.config.title), ctx)
    : undefined;

  if (!audioUrl) {
    throw new Error('send_audio requires audioUrl');
  }

  return { action: 'send_audio', chatId, audioUrl, caption, parseMode, duration, performer, title, executed: true };
}

// ---------------------------------------------------------------------------
// Additional chat management actions
// ---------------------------------------------------------------------------

/**
 * Make the bot leave a chat.
 * Config: { chatId }
 */
async function executeLeaveChat(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);

  return { action: 'leave_chat', chatId, executed: true };
}

/**
 * Get information about a chat (title, description, member count, etc.).
 * Config: { chatId }
 */
async function executeGetChatInfo(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);

  return { action: 'get_chat_info', chatId, executed: true };
}

/**
 * Set a chat's profile photo.
 * Config: { chatId, photoUrl }
 */
async function executeSetChatPhoto(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const photoUrl = interpolate(String(node.config.photoUrl ?? ''), ctx);

  if (!photoUrl) {
    throw new Error('set_chat_photo requires photoUrl');
  }

  return { action: 'set_chat_photo', chatId, photoUrl, executed: true };
}

/**
 * Delete a chat's profile photo.
 * Config: { chatId }
 */
async function executeDeleteChatPhoto(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);

  return { action: 'delete_chat_photo', chatId, executed: true };
}

/**
 * Approve a chat join request.
 * Config: { chatId, userId }
 */
async function executeApproveJoinRequest(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);

  return { action: 'approve_join_request', chatId, userId, executed: true };
}

// ---------------------------------------------------------------------------
// Discord actions
// ---------------------------------------------------------------------------

async function executeDiscordSendMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const content = interpolate(String(node.config.content ?? ''), ctx);

  if (!content) {
    throw new Error('discord_send_message requires content');
  }

  return { action: 'discord_send_message', platform: 'discord', channelId, content, executed: true };
}

async function executeDiscordSendEmbed(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const title = node.config.title ? interpolate(String(node.config.title), ctx) : undefined;
  const description = node.config.description ? interpolate(String(node.config.description), ctx) : undefined;
  const color = (node.config.color as number) ?? undefined;
  const fields = (node.config.fields as Array<{ name: string; value: string; inline?: boolean }>) ?? [];
  const footer = node.config.footer ? interpolate(String(node.config.footer), ctx) : undefined;
  const image = node.config.image ? interpolate(String(node.config.image), ctx) : undefined;

  return {
    action: 'discord_send_embed',
    platform: 'discord',
    channelId,
    embed: { title, description, color, fields, footer, image },
    executed: true,
  };
}

async function executeDiscordSendDM(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const content = interpolate(String(node.config.content ?? ''), ctx);

  if (!content) {
    throw new Error('discord_send_dm requires content');
  }

  return { action: 'discord_send_dm', platform: 'discord', userId, content, executed: true };
}

async function executeDiscordEditMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const messageId = interpolate(String(node.config.messageId ?? '{{trigger.messageId}}'), ctx);
  const content = interpolate(String(node.config.content ?? ''), ctx);

  if (!messageId) {
    throw new Error('discord_edit_message requires messageId');
  }

  return { action: 'discord_edit_message', platform: 'discord', channelId, messageId, content, executed: true };
}

async function executeDiscordDeleteMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const messageId = interpolate(String(node.config.messageId ?? '{{trigger.messageId}}'), ctx);

  if (!messageId) {
    throw new Error('discord_delete_message requires messageId');
  }

  return { action: 'discord_delete_message', platform: 'discord', channelId, messageId, executed: true };
}

async function executeDiscordAddReaction(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const messageId = interpolate(String(node.config.messageId ?? '{{trigger.messageId}}'), ctx);
  const emoji = interpolate(String(node.config.emoji ?? ''), ctx);

  if (!messageId || !emoji) {
    throw new Error('discord_add_reaction requires messageId and emoji');
  }

  return { action: 'discord_add_reaction', platform: 'discord', channelId, messageId, emoji, executed: true };
}

async function executeDiscordRemoveReaction(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const messageId = interpolate(String(node.config.messageId ?? '{{trigger.messageId}}'), ctx);
  const emoji = interpolate(String(node.config.emoji ?? ''), ctx);

  if (!messageId || !emoji) {
    throw new Error('discord_remove_reaction requires messageId and emoji');
  }

  return { action: 'discord_remove_reaction', platform: 'discord', channelId, messageId, emoji, executed: true };
}

async function executeDiscordPinMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const messageId = interpolate(String(node.config.messageId ?? '{{trigger.messageId}}'), ctx);

  if (!messageId) {
    throw new Error('discord_pin_message requires messageId');
  }

  return { action: 'discord_pin_message', platform: 'discord', channelId, messageId, executed: true };
}

async function executeDiscordUnpinMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const messageId = interpolate(String(node.config.messageId ?? '{{trigger.messageId}}'), ctx);

  if (!messageId) {
    throw new Error('discord_unpin_message requires messageId');
  }

  return { action: 'discord_unpin_message', platform: 'discord', channelId, messageId, executed: true };
}

async function executeDiscordBanMember(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const reason = node.config.reason ? interpolate(String(node.config.reason), ctx) : undefined;
  const deleteMessageDays = (node.config.deleteMessageDays as number) ?? undefined;

  return { action: 'discord_ban_member', platform: 'discord', guildId, userId, reason, deleteMessageDays, executed: true };
}

async function executeDiscordKickMember(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const reason = node.config.reason ? interpolate(String(node.config.reason), ctx) : undefined;

  return { action: 'discord_kick_member', platform: 'discord', guildId, userId, reason, executed: true };
}

async function executeDiscordTimeoutMember(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const durationMs = (node.config.durationMs as number) ?? 60_000;
  const reason = node.config.reason ? interpolate(String(node.config.reason), ctx) : undefined;

  return { action: 'discord_timeout_member', platform: 'discord', guildId, userId, durationMs, reason, executed: true };
}

async function executeDiscordAddRole(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const roleId = interpolate(String(node.config.roleId ?? ''), ctx);

  if (!roleId) {
    throw new Error('discord_add_role requires roleId');
  }

  return { action: 'discord_add_role', platform: 'discord', guildId, userId, roleId, executed: true };
}

async function executeDiscordRemoveRole(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const roleId = interpolate(String(node.config.roleId ?? ''), ctx);

  if (!roleId) {
    throw new Error('discord_remove_role requires roleId');
  }

  return { action: 'discord_remove_role', platform: 'discord', guildId, userId, roleId, executed: true };
}

async function executeDiscordCreateRole(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const name = interpolate(String(node.config.name ?? ''), ctx);
  const color = (node.config.color as number) ?? undefined;
  const permissions = node.config.permissions ? String(node.config.permissions) : undefined;

  if (!name) {
    throw new Error('discord_create_role requires name');
  }

  return { action: 'discord_create_role', platform: 'discord', guildId, name, color, permissions, executed: true };
}

async function executeDiscordSetNickname(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const nickname = interpolate(String(node.config.nickname ?? ''), ctx);

  return { action: 'discord_set_nickname', platform: 'discord', guildId, userId, nickname, executed: true };
}

async function executeDiscordCreateChannel(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const name = interpolate(String(node.config.name ?? ''), ctx);
  const type = String(node.config.type ?? 'text');
  const options = (node.config.options as Record<string, unknown>) ?? undefined;

  if (!name) {
    throw new Error('discord_create_channel requires name');
  }

  return { action: 'discord_create_channel', platform: 'discord', guildId, name, type, options, executed: true };
}

async function executeDiscordDeleteChannel(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);

  if (!channelId) {
    throw new Error('discord_delete_channel requires channelId');
  }

  return { action: 'discord_delete_channel', platform: 'discord', channelId, executed: true };
}

async function executeDiscordMoveMember(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const userId = interpolate(String(node.config.userId ?? '{{trigger.userId}}'), ctx);
  const channelId = interpolate(String(node.config.channelId ?? ''), ctx);

  if (!channelId) {
    throw new Error('discord_move_member requires channelId');
  }

  return { action: 'discord_move_member', platform: 'discord', guildId, userId, channelId, executed: true };
}

async function executeDiscordCreateThread(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const name = interpolate(String(node.config.name ?? ''), ctx);
  const options = (node.config.options as Record<string, unknown>) ?? undefined;

  if (!name) {
    throw new Error('discord_create_thread requires name');
  }

  return { action: 'discord_create_thread', platform: 'discord', channelId, name, options, executed: true };
}

async function executeDiscordSendThreadMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const threadId = interpolate(String(node.config.threadId ?? '{{trigger.threadId}}'), ctx);
  const content = interpolate(String(node.config.content ?? ''), ctx);

  if (!content) {
    throw new Error('discord_send_thread_message requires content');
  }

  return { action: 'discord_send_thread_message', platform: 'discord', threadId, content, executed: true };
}

async function executeDiscordCreateInvite(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const channelId = interpolate(String(node.config.channelId ?? '{{trigger.channelId}}'), ctx);
  const options = (node.config.options as Record<string, unknown>) ?? undefined;

  return { action: 'discord_create_invite', platform: 'discord', channelId, options, executed: true };
}

async function executeDiscordCreateScheduledEvent(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const guildId = interpolate(String(node.config.guildId ?? '{{trigger.guildId}}'), ctx);
  const name = interpolate(String(node.config.name ?? ''), ctx);
  const options = (node.config.options as Record<string, unknown>) ?? {};

  if (!name) {
    throw new Error('discord_create_scheduled_event requires name');
  }

  return { action: 'discord_create_scheduled_event', platform: 'discord', guildId, name, options, executed: true };
}

// ---------------------------------------------------------------------------
// Context actions
// ---------------------------------------------------------------------------

async function executeGetContext(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const prisma = (ctx as any)._prisma;
  if (!prisma) throw new Error('get_context requires prisma in executor config');
  const { key, defaultValue } = node.config as { key: string; defaultValue?: unknown };
  const platformUserId = String(ctx.triggerData.platformUserId ?? ctx.triggerData.userId ?? '');
  const platform = String(ctx.triggerData.platform ?? 'telegram');
  const value = await getContext(prisma, platformUserId, platform, key, defaultValue);

  // Populate context cache for {{context.*}} interpolation
  if (!(ctx as any)._contextCache) {
    (ctx as any)._contextCache = new Map<string, unknown>();
  }
  (ctx as any)._contextCache.set(key, value);

  return { action: 'get_context', key, value };
}

async function executeSetContext(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const prisma = (ctx as any)._prisma;
  if (!prisma) throw new Error('set_context requires prisma in executor config');
  const { key, value: rawValue } = node.config as { key: string; value: string };
  const interpolatedValue = interpolate(String(rawValue), ctx);
  const platformUserId = String(ctx.triggerData.platformUserId ?? ctx.triggerData.userId ?? '');
  const platform = String(ctx.triggerData.platform ?? 'telegram');
  await setContext(prisma, platformUserId, platform, key, interpolatedValue);
  return { action: 'set_context', key, value: interpolatedValue, executed: true };
}

async function executeDeleteContext(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const prisma = (ctx as any)._prisma;
  if (!prisma) throw new Error('delete_context requires prisma in executor config');
  const { key } = node.config as { key: string };
  const platformUserId = String(ctx.triggerData.platformUserId ?? ctx.triggerData.userId ?? '');
  const platform = String(ctx.triggerData.platform ?? 'telegram');
  await deleteContext(prisma, platformUserId, platform, key);
  return { action: 'delete_context', key, executed: true };
}

// ---------------------------------------------------------------------------
// Flow chaining actions
// ---------------------------------------------------------------------------

const MAX_CHAIN_DEPTH = 5;

async function executeRunFlow(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const callbacks = (ctx as any)._taskCallbacks as {
    triggerAndWait: (taskId: string, payload: unknown) => Promise<unknown>;
    trigger: (taskId: string, payload: unknown) => Promise<void>;
  } | undefined;

  if (!callbacks) throw new Error('run_flow requires taskCallbacks in executor config');

  const { flowId, waitForResult, inputVariables } = node.config as {
    flowId: string;
    waitForResult: boolean;
    inputVariables?: Record<string, string>;
  };

  const currentDepth = Number(ctx.triggerData._chainDepth ?? 0);
  if (currentDepth >= MAX_CHAIN_DEPTH) {
    throw new Error(`Maximum chain depth (${MAX_CHAIN_DEPTH}) exceeded`);
  }

  const childTriggerData: Record<string, unknown> = {
    ...inputVariables,
    _chainDepth: currentDepth + 1,
  };

  if (waitForResult) {
    const result = await callbacks.triggerAndWait('flow-execution', {
      flowId,
      triggerData: childTriggerData,
    });
    const output = (result as any)?.ok ? (result as any).output : result;
    return { action: 'run_flow', flowId, waitForResult: true, output };
  } else {
    await callbacks.trigger('flow-execution', {
      flowId,
      triggerData: childTriggerData,
    });
    return { action: 'run_flow', flowId, waitForResult: false, fired: true };
  }
}

async function executeEmitEvent(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const prisma = (ctx as any)._prisma;
  const callbacks = (ctx as any)._taskCallbacks;
  if (!prisma) throw new Error('emit_event requires prisma in executor config');

  const { eventName, payload: rawPayload } = node.config as {
    eventName: string;
    payload?: Record<string, string>;
  };

  // Interpolate payload values
  const payload: Record<string, unknown> = {};
  if (rawPayload) {
    for (const [k, v] of Object.entries(rawPayload)) {
      payload[k] = interpolate(String(v), ctx);
    }
  }

  // Write audit record
  await prisma.flowEvent.create({
    data: {
      eventName,
      payload,
      sourceFlowId: ctx.flowId,
      sourceExecutionId: ctx.executionId,
    },
  });

  // Find active flows with custom_event triggers matching this event name
  const listenerFlows = await prisma.flowDefinition.findMany({
    where: {
      status: 'active',
      id: { not: ctx.flowId },
    },
    select: { id: true, nodesJson: true },
  });

  let listenersTriggered = 0;

  for (const flow of listenerFlows) {
    const nodes = flow.nodesJson as Array<{ type: string; config: { eventName?: string } }>;
    const hasMatchingTrigger = nodes.some(
      (n) => n.type === 'custom_event' && n.config?.eventName === eventName,
    );

    if (hasMatchingTrigger && callbacks?.trigger) {
      const chainDepth = Number(ctx.triggerData._chainDepth ?? 0);
      await callbacks.trigger('flow-execution', {
        flowId: flow.id,
        triggerData: {
          event: eventName,
          ...payload,
          _chainDepth: chainDepth + 1,
          _sourceFlowId: ctx.flowId,
          _sourceExecutionId: ctx.executionId,
        },
      });
      listenersTriggered++;
    }
  }

  return { action: 'emit_event', eventName, listenersTriggered };
}

// ---------------------------------------------------------------------------
// Unified cross-platform actions
// ---------------------------------------------------------------------------

async function executeUnifiedAction(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const config = node.config as Record<string, unknown>;
  const result: Record<string, unknown> = { action: node.type, executed: true };

  if (config.text !== undefined) result.text = interpolate(String(config.text), ctx);
  if (config.mediaUrl !== undefined) result.mediaUrl = interpolate(String(config.mediaUrl), ctx);
  if (config.targetUserId !== undefined) result.targetUserId = interpolate(String(config.targetUserId), ctx);
  if (config.targetChatId !== undefined) {
    result.targetChatId = interpolate(String(config.targetChatId), ctx);
  } else if (ctx.triggerData.chatId) {
    result.targetChatId = String(ctx.triggerData.chatId);
  }
  if (config.telegramOverrides !== undefined) result.telegramOverrides = config.telegramOverrides;
  if (config.discordOverrides !== undefined) result.discordOverrides = config.discordOverrides;

  return result;
}
