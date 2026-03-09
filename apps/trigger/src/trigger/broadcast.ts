import { task } from "@trigger.dev/sdk/v3";
import { getPrisma } from "../lib/prisma.js";
import { getTelegramTransport, getTelegramLogger } from "../lib/telegram.js";

export const broadcastTask = task({
  id: "broadcast",
  queue: {
    name: "telegram",
    concurrencyLimit: 1,
  },
  run: async (payload: { broadcastId: string }) => {
    const prisma = getPrisma();
    const logger = getTelegramLogger().child({ task: "broadcast" });

    const broadcast = await prisma.broadcastMessage.findUnique({
      where: { id: payload.broadcastId },
    });

    if (!broadcast) {
      throw new Error(`BroadcastMessage ${payload.broadcastId} not found`);
    }

    if (broadcast.status !== "pending") {
      logger.info(
        { broadcastId: broadcast.id, status: broadcast.status },
        "Broadcast not in pending state, skipping"
      );
      return { skipped: true, reason: `Status is ${broadcast.status}` };
    }

    // Mark as in-progress
    await prisma.broadcastMessage.update({
      where: { id: broadcast.id },
      data: { status: "sending" },
    });

    const transport = await getTelegramTransport();
    const results: Array<{
      chatId: string;
      success: boolean;
      messageId?: number;
      error?: string;
    }> = [];

    for (const chatId of broadcast.targetChatIds) {
      try {
        const result = await transport.sendMessage(chatId.toString(), broadcast.text);
        results.push({
          chatId: chatId.toString(),
          success: true,
          messageId: result.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error({ chatId: chatId.toString(), error: message }, "Failed to send broadcast message");
        results.push({
          chatId: chatId.toString(),
          success: false,
          error: message,
        });
      }

      // 200ms stagger between messages
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const allSucceeded = results.every((r) => r.success);
    const status = allSucceeded ? "completed" : "failed";

    await prisma.broadcastMessage.update({
      where: { id: broadcast.id },
      data: { status, results },
    });

    logger.info(
      {
        broadcastId: broadcast.id,
        status,
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
      },
      "Broadcast completed"
    );

    return { broadcastId: broadcast.id, status, results };
  },
});
