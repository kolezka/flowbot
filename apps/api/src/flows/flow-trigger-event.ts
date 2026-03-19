/**
 * Standardized event format that all platform bots POST to /api/flows/webhook.
 * Both the Telegram manager-bot and Discord bot emit this format.
 */
export interface FlowTriggerEvent {
  platform: string;
  communityId: string;       // platform community ID (chatId for TG, guildId for Discord)
  accountId: string;          // platform user ID of the actor
  eventType: string;          // "message_received", "member_join", etc.
  data: Record<string, unknown>;
  timestamp: string;
  botInstanceId: string;
}
