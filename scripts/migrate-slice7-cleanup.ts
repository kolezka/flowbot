/**
 * Slice 7 Cleanup: Documents which old tables/columns can be dropped.
 *
 * This script does NOT drop tables automatically — it verifies data migration
 * completeness and outputs a report of what can be safely removed.
 *
 * Run: npx tsx scripts/migrate-slice7-cleanup.ts
 */

import { PrismaClient } from '@flowbot/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Slice 7 Cleanup Verification Report');
  console.log('====================================\n');

  // Check 1: All Users migrated to PlatformAccount?
  const userCount = await prisma.user.count();
  const accountCount = await prisma.platformAccount.count({ where: { platform: 'telegram' } });
  const usersMigrated = accountCount >= userCount;
  console.log(`[${usersMigrated ? 'OK' : 'WARN'}] Users → PlatformAccount: ${userCount} users, ${accountCount} telegram accounts`);

  // Check 2: All ManagedGroups migrated to Community?
  const groupCount = await prisma.managedGroup.count();
  const communityCount = await prisma.community.count({ where: { platform: 'telegram' } });
  const groupsMigrated = communityCount >= groupCount;
  console.log(`[${groupsMigrated ? 'OK' : 'WARN'}] ManagedGroup → Community: ${groupCount} groups, ${communityCount} communities`);

  // Check 3: All ClientSessions migrated to PlatformConnection?
  const sessionCount = await prisma.clientSession.count();
  const connectionCount = await prisma.platformConnection.count({ where: { platform: 'telegram' } });
  const sessionsMigrated = connectionCount >= sessionCount;
  console.log(`[${sessionsMigrated ? 'OK' : 'WARN'}] ClientSession → PlatformConnection: ${sessionCount} sessions, ${connectionCount} connections`);

  // Check 4: All GroupMembers migrated to CommunityMember?
  const memberCount = await prisma.groupMember.count();
  const communityMemberCount = await prisma.communityMember.count();
  const membersMigrated = communityMemberCount >= memberCount;
  console.log(`[${membersMigrated ? 'OK' : 'WARN'}] GroupMember → CommunityMember: ${memberCount} members, ${communityMemberCount} community members`);

  // Check 5: Analytics snapshots
  const oldSnapshots = await prisma.groupAnalyticsSnapshot.count();
  const newSnapshots = await prisma.communityAnalyticsSnapshot.count();
  const snapshotsMigrated = newSnapshots >= oldSnapshots;
  console.log(`[${snapshotsMigrated ? 'OK' : 'WARN'}] GroupAnalyticsSnapshot → CommunityAnalyticsSnapshot: ${oldSnapshots} old, ${newSnapshots} new`);

  console.log('\n--- Tables safe to drop (once all checks pass) ---');
  console.log('NOTE: Do NOT drop these automatically. Review manually first.\n');

  const allClear = usersMigrated && groupsMigrated && sessionsMigrated && membersMigrated && snapshotsMigrated;

  if (allClear) {
    console.log('All migrations verified. The following can be dropped in a future Prisma migration:');
    console.log('  - User (replaced by PlatformAccount)');
    console.log('  - UserIdentity.telegramId column (no longer needed)');
    console.log('  - UserIdentity.userId column (no longer needed)');
    console.log('  - ManagedGroup (replaced by Community)');
    console.log('  - GroupConfig (replaced by CommunityConfig + CommunityTelegramConfig)');
    console.log('  - GroupMember (replaced by CommunityMember)');
    console.log('  - ClientSession (replaced by PlatformConnection)');
    console.log('  - ClientLog (replaced by PlatformConnectionLog)');
    console.log('  - GroupAnalyticsSnapshot (replaced by CommunityAnalyticsSnapshot)');
    console.log('\n  Tables to KEEP (still in active use):');
    console.log('  - Warning (still referenced by old Warning model — needs new model in future)');
    console.log('  - ModerationLog (still referenced by old model)');
    console.log('  - ScheduledMessage (still referenced by old model)');
    console.log('  - CrossPostTemplate (updated in-place via bridge pattern)');
    console.log('  - BroadcastMessage (updated in-place via bridge pattern)');
    console.log('  - ReputationScore (still uses telegramId — needs migration)');
  } else {
    console.log('Some migrations incomplete. Run the following scripts first:');
    if (!usersMigrated) console.log('  npx tsx scripts/migrate-slice1-identity.ts');
    if (!groupsMigrated || !membersMigrated) console.log('  npx tsx scripts/migrate-slice2-communities.ts');
    if (!sessionsMigrated) console.log('  npx tsx scripts/migrate-slice3-connections.ts');
    if (!snapshotsMigrated) console.log('  npx tsx scripts/migrate-slice5-reputation-analytics.ts');
  }
}

main()
  .catch(e => { console.error('Verification failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
