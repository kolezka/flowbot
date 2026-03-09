import { schedules } from "@trigger.dev/sdk/v3";
import { getPrisma } from "../lib/prisma.js";
import { checkManagerBotHealth } from "../lib/manager-bot.js";

export const healthCheckTask = schedules.task({
  id: "health-check",
  cron: "*/5 * * * *", // every 5 minutes
  run: async () => {
    const results: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // Check database
    const dbStart = Date.now();
    try {
      const prisma = getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      results.database = { status: "up", latencyMs: Date.now() - dbStart };
    } catch (error) {
      results.database = {
        status: "down",
        latencyMs: Date.now() - dbStart,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Check manager-bot
    const mbStart = Date.now();
    const mbHealthy = await checkManagerBotHealth();
    results.managerBot = {
      status: mbHealthy ? "up" : "unreachable",
      latencyMs: Date.now() - mbStart,
    };

    // Overall status
    const allUp = Object.values(results).every((r) => r.status === "up");
    const anyDown = Object.values(results).some((r) => r.status === "down");

    return {
      overall: anyDown ? "down" : allUp ? "up" : "degraded",
      components: results,
      checkedAt: new Date().toISOString(),
    };
  },
});
