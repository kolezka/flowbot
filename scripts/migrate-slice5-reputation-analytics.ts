/**
 * Slice 5 Migration: Re-link analytics snapshots to communities
 */
import { PrismaClient } from '@flowbot/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Slice 5 migration: Analytics → Community');

  // Copy GroupAnalyticsSnapshot → CommunityAnalyticsSnapshot
  const groups = await prisma.managedGroup.findMany({ select: { id: true, chatId: true } });
  let copied = 0;

  for (const group of groups) {
    const community = await prisma.community.findUnique({
      where: { platform_platformCommunityId: { platform: 'telegram', platformCommunityId: group.chatId.toString() } },
    });
    if (!community) continue;

    const snapshots = await prisma.groupAnalyticsSnapshot.findMany({ where: { groupId: group.id } });

    for (const snap of snapshots) {
      const existing = await prisma.communityAnalyticsSnapshot.findUnique({
        where: { communityId_date_granularity: { communityId: community.id, date: snap.date, granularity: 'DAY' } },
      });
      if (existing) continue;

      await prisma.communityAnalyticsSnapshot.create({
        data: {
          communityId: community.id,
          date: snap.date,
          granularity: 'DAY',
          memberCount: snap.memberCount,
          newMembers: snap.newMembers,
          leftMembers: snap.leftMembers,
          messageCount: snap.messageCount,
          spamDetected: snap.spamDetected,
          warningsIssued: snap.warningsIssued,
          moderationActions: snap.mutesIssued + snap.bansIssued,
          metadata: {
            linksBlocked: snap.linksBlocked,
            mutesIssued: snap.mutesIssued,
            bansIssued: snap.bansIssued,
            deletedMessages: snap.deletedMessages,
          },
        },
      });
      copied++;
    }
  }

  console.log(`Migration complete: ${copied} analytics snapshots copied`);
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
