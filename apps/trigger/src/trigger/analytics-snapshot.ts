import { schedules } from "@trigger.dev/sdk/v3";
import { getPrisma } from "../lib/prisma.js";

export const analyticsSnapshotTask = schedules.task({
  id: "analytics-snapshot",
  cron: "0 2 * * *", // daily at 2am
  run: async () => {
    const prisma = getPrisma();

    const groups = await prisma.managedGroup.findMany({
      where: { isActive: true },
      select: { id: true, chatId: true, title: true },
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: Array<{ groupId: string; success: boolean }> = [];

    for (const group of groups) {
      try {
        // Count moderation actions for yesterday
        const logs = await prisma.moderationLog.findMany({
          where: {
            groupId: group.id,
            createdAt: { gte: yesterday, lt: today },
          },
          select: { action: true },
        });

        const actionCounts = logs.reduce<Record<string, number>>((acc, log) => {
          acc[log.action] = (acc[log.action] || 0) + 1;
          return acc;
        }, {});

        // Count members
        const memberCount = await prisma.groupMember.count({
          where: { groupId: group.id },
        });

        // Count new/left members (approximation from logs)
        const newMembers = actionCounts["member_join"] || 0;
        const leftMembers = actionCounts["member_leave"] || 0;

        // Message count from member stats (delta since yesterday)
        const messageCount = actionCounts["message"] || 0;

        await prisma.groupAnalyticsSnapshot.upsert({
          where: {
            groupId_date: {
              groupId: group.id,
              date: yesterday,
            },
          },
          create: {
            groupId: group.id,
            date: yesterday,
            memberCount,
            newMembers,
            leftMembers,
            messageCount,
            spamDetected: actionCounts["spam_detected"] || 0,
            linksBlocked: actionCounts["link_blocked"] || 0,
            warningsIssued: actionCounts["warn"] || 0,
            mutesIssued: actionCounts["mute"] || 0,
            bansIssued: actionCounts["ban"] || 0,
            deletedMessages: actionCounts["message_delete"] || 0,
          },
          update: {
            memberCount,
            newMembers,
            leftMembers,
            messageCount,
            spamDetected: actionCounts["spam_detected"] || 0,
            linksBlocked: actionCounts["link_blocked"] || 0,
            warningsIssued: actionCounts["warn"] || 0,
            mutesIssued: actionCounts["mute"] || 0,
            bansIssued: actionCounts["ban"] || 0,
            deletedMessages: actionCounts["message_delete"] || 0,
          },
        });

        results.push({ groupId: group.id, success: true });
      } catch {
        results.push({ groupId: group.id, success: false });
      }
    }

    return {
      totalGroups: groups.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  },
});
