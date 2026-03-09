import { task } from "@trigger.dev/sdk/v3";
import { getPrisma } from "../lib/prisma.js";
import { getTelegramTransport, getTelegramLogger } from "../lib/telegram.js";

function formatOrderMessage(eventType: string, orderData: Record<string, unknown>): string {
  const productName = (orderData.productName as string) || "an item";

  switch (eventType) {
    case "order_placed":
      return `Someone just purchased ${productName}!`;
    case "order_shipped":
      return `An order of ${productName} has been shipped!`;
    default:
      return `New order event: ${eventType} for ${productName}`;
  }
}

export const orderNotificationTask = task({
  id: "order-notification",
  queue: {
    name: "telegram",
    concurrencyLimit: 1,
  },
  run: async (payload: { orderEventId: string }) => {
    const prisma = getPrisma();
    const logger = getTelegramLogger().child({ task: "order-notification" });

    const event = await prisma.orderEvent.findUnique({
      where: { id: payload.orderEventId },
    });

    if (!event) {
      throw new Error(`OrderEvent ${payload.orderEventId} not found`);
    }

    if (event.processed) {
      logger.info({ orderEventId: event.id }, "Order event already processed, skipping");
      return { skipped: true, reason: "Already processed" };
    }

    const transport = await getTelegramTransport();
    const orderData = event.orderData as Record<string, unknown>;
    const message = formatOrderMessage(event.eventType, orderData);

    const results: Array<{
      chatId: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const chatId of event.targetChatIds) {
      try {
        await transport.sendMessage(chatId.toString(), message);
        results.push({ chatId: chatId.toString(), success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        logger.error({ chatId: chatId.toString(), error: errorMsg }, "Failed to send order notification");
        results.push({ chatId: chatId.toString(), success: false, error: errorMsg });
      }

      // 100ms stagger
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await prisma.orderEvent.update({
      where: { id: event.id },
      data: { processed: true },
    });

    logger.info(
      { orderEventId: event.id, delivered: results.filter((r) => r.success).length },
      "Order notification completed"
    );

    return { orderEventId: event.id, results };
  },
});
