import { task } from "@trigger.dev/sdk/v3";
import { getTelegramTransport, getTelegramLogger } from "../lib/telegram.js";

export const crossPostTask = task({
  id: "cross-post",
  queue: {
    name: "telegram",
    concurrencyLimit: 1,
  },
  run: async (payload: {
    templateId?: string;
    messageText: string;
    targetChatIds: string[];
  }) => {
    const transport = await getTelegramTransport();
    const logger = getTelegramLogger().child({ task: "cross-post" });

    const results: Array<{
      chatId: string;
      success: boolean;
      messageId?: number;
      error?: string;
    }> = [];

    for (const chatId of payload.targetChatIds) {
      try {
        const result = await transport.sendMessage(chatId, payload.messageText);
        results.push({
          chatId,
          success: true,
          messageId: result.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error({ chatId, error: message }, "Failed to cross-post message");
        results.push({ chatId, success: false, error: message });
      }

      // 100ms stagger between messages
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info(
      {
        templateId: payload.templateId,
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
      },
      "Cross-post completed"
    );

    return { results };
  },
});
