import type { FlowNode, FlowContext } from './types.js';
import { interpolate } from './variables.js';
import { getPrisma } from '../prisma.js';

export async function executeAction(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  switch (node.type) {
    case 'send_message':
      return executeSendMessage(node, ctx);
    case 'forward_message':
      return executeForwardMessage(node, ctx);
    case 'ban_user':
      return executeBanUser(node, ctx);
    case 'mute_user':
      return executeMuteUser(node, ctx);
    case 'api_call':
      return executeApiCall(node, ctx);
    case 'delay':
      return executeDelay(node, ctx);
    case 'bot_action':
      return executeBotAction(node, ctx);
    default:
      throw new Error(`Unknown action type: ${node.type}`);
  }
}

async function executeSendMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const chatId = interpolate(String(node.config.chatId ?? '{{trigger.chatId}}'), ctx);
  const text = interpolate(String(node.config.text ?? ''), ctx);

  // In production this would call the transport layer
  return { action: 'send_message', chatId, text, executed: true };
}

async function executeForwardMessage(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const fromChatId = interpolate(String(node.config.fromChatId ?? ''), ctx);
  const toChatId = interpolate(String(node.config.toChatId ?? ''), ctx);
  const messageId = node.config.messageId ?? ctx.triggerData.messageId;

  return { action: 'forward_message', fromChatId, toChatId, messageId, executed: true };
}

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

async function executeApiCall(node: FlowNode, ctx: FlowContext): Promise<unknown> {
  const url = interpolate(String(node.config.url ?? ''), ctx);
  const method = String(node.config.method ?? 'GET');
  const bodyTemplate = node.config.body ? interpolate(JSON.stringify(node.config.body), ctx) : undefined;

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: bodyTemplate,
  });

  return { status: response.status, data: await response.json().catch(() => null) };
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

  // Make HTTP call to the bot's API endpoint
  const url = `${botInstance.apiUrl.replace(/\/+$/, '')}/api/send-message`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...interpolatedParams }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Bot action failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return { action: 'bot_action', botInstanceId, botAction: action, status: response.status, data };
}
