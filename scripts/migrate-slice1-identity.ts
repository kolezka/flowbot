/**
 * Slice 1 Migration: User → PlatformAccount + UserIdentity
 *
 * Run: npx tsx scripts/migrate-slice1-identity.ts
 * Requires: DATABASE_URL environment variable
 */

import { PrismaClient } from '@flowbot/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Slice 1 migration: User → PlatformAccount + UserIdentity');

  const users = await prisma.user.findMany({
    include: { identity: true },
  });

  console.log(`Found ${users.length} users to migrate`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    // Check if PlatformAccount already exists (idempotent)
    const existing = await prisma.platformAccount.findUnique({
      where: {
        platform_platformUserId: {
          platform: 'telegram',
          platformUserId: user.telegramId.toString(),
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Resolve or create UserIdentity
    let identityId: string | null = null;

    if (user.identity) {
      await prisma.userIdentity.update({
        where: { id: user.identity.id },
        data: {
          displayName: user.username ?? user.firstName ?? undefined,
        },
      });
      identityId = user.identity.id;
    } else {
      const identity = await prisma.userIdentity.create({
        data: {
          telegramId: user.telegramId,
          userId: user.id,
          displayName: user.username ?? user.firstName ?? null,
        },
      });
      identityId = identity.id;
    }

    // Create PlatformAccount
    await prisma.platformAccount.create({
      data: {
        identityId,
        platform: 'telegram',
        platformUserId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        metadata: user.languageCode ? { languageCode: user.languageCode } : undefined,
        isBanned: user.isBanned,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
        messageCount: user.messageCount,
        commandCount: user.commandCount,
        isVerified: user.verifiedAt !== null,
        verifiedAt: user.verifiedAt,
        lastSeenAt: user.lastSeenAt,
        lastMessageAt: user.lastMessageAt,
        lastCommunityId: user.lastChatId?.toString() ?? null,
        referralCode: user.referralCode,
      },
    });

    created++;
    if (created % 100 === 0) {
      console.log(`  Progress: ${created} created, ${skipped} skipped`);
    }
  }

  // Second pass: resolve referral links
  const usersWithReferrals = users.filter((u) => u.referredByUserId);
  let referralsLinked = 0;

  for (const user of usersWithReferrals) {
    const referrer = users.find((u) => u.id === user.referredByUserId);
    if (!referrer) continue;

    const referrerAccount = await prisma.platformAccount.findUnique({
      where: {
        platform_platformUserId: {
          platform: 'telegram',
          platformUserId: referrer.telegramId.toString(),
        },
      },
    });

    const userAccount = await prisma.platformAccount.findUnique({
      where: {
        platform_platformUserId: {
          platform: 'telegram',
          platformUserId: user.telegramId.toString(),
        },
      },
    });

    if (referrerAccount && userAccount) {
      await prisma.platformAccount.update({
        where: { id: userAccount.id },
        data: { referredByAccountId: referrerAccount.id },
      });
      referralsLinked++;
    }
  }

  console.log(`Migration complete: ${created} created, ${skipped} skipped, ${referralsLinked} referrals linked`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
