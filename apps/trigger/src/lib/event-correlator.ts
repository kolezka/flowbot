import { getPrisma } from './prisma.js';

export interface CorrelatedEvent {
  type: string;
  botId: string;
  groupId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface CorrelationResult {
  userId?: string;
  telegramId: bigint;
  reputationScore: number;
  recentEvents: CorrelatedEvent[];
  warningCount: number;
}

/**
 * Correlate events across bots using UserIdentity and ModerationLog.
 *
 * Given a Telegram user ID and the originating event, this function looks up
 * the user's cross-bot identity, reputation score, recent moderation events,
 * and warning history to provide rich context for flow execution decisions.
 */
export async function correlateEvents(
  telegramId: bigint,
  event: { type: string; botId: string; data: Record<string, unknown> },
): Promise<CorrelationResult> {
  const prisma = getPrisma();

  // 1. Look up UserIdentity by telegramId
  const identity = await prisma.userIdentity.findUnique({
    where: { telegramId },
  });

  // 2. Get recent moderation events across all groups/bots for this user
  const recentModerationLogs = await prisma.moderationLog.findMany({
    where: { targetId: telegramId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // 4. Get warning count via GroupMember (warnings are linked through members)
  const memberRecords = await prisma.groupMember.findMany({
    where: { telegramId },
    select: { id: true },
  });
  const memberIds = memberRecords.map((m) => m.id);
  const warningCount = memberIds.length > 0
    ? await prisma.warning.count({
        where: { memberId: { in: memberIds }, isActive: true },
      })
    : 0;

  // 5. Map moderation logs to correlated events
  const recentEvents: CorrelatedEvent[] = recentModerationLogs.map((log) => ({
    type: log.action,
    botId: event.botId, // moderation logs don't track botId directly, use context
    groupId: log.groupId,
    timestamp: log.createdAt,
    details: {
      reason: log.reason,
      automated: log.automated,
      ...(log.details as Record<string, unknown> ?? {}),
    },
  }));

  return {
    userId: identity?.userId ?? undefined,
    telegramId,
    reputationScore: identity?.reputationScore ?? 0,
    recentEvents,
    warningCount,
  };
}

/**
 * Build enriched trigger data by merging the original trigger data
 * with cross-bot correlation context.
 */
export async function enrichTriggerData(
  triggerData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Only enrich if we have a telegramId or userId in trigger data
  const rawTelegramId = triggerData.userId ?? triggerData.telegramId ?? triggerData.fromId;
  if (!rawTelegramId) return triggerData;

  const telegramId = BigInt(String(rawTelegramId));
  const botId = String(triggerData.botId ?? triggerData.botInstanceId ?? '');

  try {
    const correlation = await correlateEvents(telegramId, {
      type: String(triggerData.eventType ?? triggerData.type ?? 'unknown'),
      botId,
      data: triggerData,
    });

    return {
      ...triggerData,
      correlation: {
        userId: correlation.userId,
        reputationScore: correlation.reputationScore,
        warningCount: correlation.warningCount,
        recentEventCount: correlation.recentEvents.length,
        recentEvents: correlation.recentEvents.slice(0, 5).map((e) => ({
          type: e.type,
          botId: e.botId,
          groupId: e.groupId,
          timestamp: e.timestamp.toISOString(),
        })),
      },
    };
  } catch {
    // Don't fail the flow if correlation lookup fails
    return triggerData;
  }
}
