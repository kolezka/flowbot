/**
 * Slice 3 Migration: ClientSession → PlatformConnection, ClientLog → PlatformConnectionLog
 *
 * Run: npx tsx scripts/migrate-slice3-connections.ts
 * Requires: DATABASE_URL
 */

import { PrismaClient } from '@flowbot/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Slice 3 migration: ClientSession → PlatformConnection');

  // Migrate ClientSessions → PlatformConnections
  const sessions = await prisma.clientSession.findMany();
  console.log(`Found ${sessions.length} sessions to migrate`);

  let connectionsCreated = 0;
  let connectionsSkipped = 0;

  for (const session of sessions) {
    // Check idempotency by looking for a connection with matching metadata
    const existing = await prisma.platformConnection.findFirst({
      where: {
        platform: 'telegram',
        connectionType: 'mtproto',
        metadata: { path: ['phoneNumber'], equals: session.phoneNumber },
      },
    });

    if (existing) {
      connectionsSkipped++;
      continue;
    }

    await prisma.platformConnection.create({
      data: {
        platform: 'telegram',
        name: session.displayName ?? session.phoneNumber ?? `Session ${session.id}`,
        connectionType: session.sessionType === 'bot' ? 'bot_token' : 'mtproto',
        status: session.isActive ? 'active' : (session.errorCount > 0 ? 'error' : 'inactive'),
        credentials: { sessionString: session.sessionString },
        metadata: {
          phoneNumber: session.phoneNumber,
          dcId: session.dcId,
          sessionType: session.sessionType,
          legacySessionId: session.id,
        },
        errorCount: session.errorCount,
        lastErrorMessage: session.lastError,
        lastActiveAt: session.lastUsedAt,
      },
    });
    connectionsCreated++;
  }

  // Migrate ClientLogs → PlatformConnectionLog
  // Create a "legacy" connection to hold orphan logs (ClientLog has no FK to ClientSession)
  const logs = await prisma.clientLog.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`Found ${logs.length} logs to migrate`);

  let logsCreated = 0;

  if (logs.length > 0) {
    let legacyConnection = await prisma.platformConnection.findFirst({
      where: { name: '__legacy_logs__' },
    });

    if (!legacyConnection) {
      legacyConnection = await prisma.platformConnection.create({
        data: {
          platform: 'telegram',
          name: '__legacy_logs__',
          connectionType: 'mtproto',
          status: 'inactive',
          metadata: { description: 'Container for migrated ClientLog entries without session association' },
        },
      });
    }

    for (const log of logs) {
      await prisma.platformConnectionLog.create({
        data: {
          connectionId: legacyConnection.id,
          level: log.level,
          message: log.message,
          details: log.details,
          createdAt: log.createdAt,
        },
      });
      logsCreated++;
    }
  }

  console.log(`Migration complete: ${connectionsCreated} connections created, ${connectionsSkipped} skipped, ${logsCreated} logs migrated`);
}

main()
  .catch((e) => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
