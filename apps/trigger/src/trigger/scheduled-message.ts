import { schedules } from "@trigger.dev/sdk/v3";
import { getPrisma } from "../lib/prisma.js";
import { sendMessageViaTelegramBot } from "../lib/telegram-bot.js";

export const scheduledMessageTask = schedules.task({
  id: "scheduled-message",
  cron: "* * * * *", // every minute
  run: async () => {
    const prisma = getPrisma();
    const now = new Date();

    const dueMessages = await prisma.scheduledMessage.findMany({
      where: {
        sent: false,
        sendAt: { lte: now },
      },
      take: 50,
      orderBy: { sendAt: "asc" },
    });

    if (dueMessages.length === 0) {
      return { processed: 0 };
    }

    const results: Array<{
      id: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const msg of dueMessages) {
      const result = await sendMessageViaTelegramBot(
        msg.chatId.toString(),
        msg.text
      );

      if (result.success) {
        await prisma.scheduledMessage.update({
          where: { id: msg.id },
          data: { sent: true, sentAt: new Date() },
        });
        results.push({ id: msg.id, success: true });
      } else {
        results.push({ id: msg.id, success: false, error: result.error });
      }
    }

    return {
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  },
});
