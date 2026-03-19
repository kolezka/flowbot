/**
 * Slice 2 Migration: ManagedGroup → Community + configs, GroupMember → CommunityMember
 *
 * Run: npx tsx scripts/migrate-slice2-communities.ts
 * Requires: DATABASE_URL, Slice 1 migration must have run first
 */

import { PrismaClient } from '@flowbot/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Slice 2 migration: ManagedGroup → Community');

  // Resolve botInstanceId: find the manager bot instance for telegram
  const managerBot = await prisma.botInstance.findFirst({
    where: { platform: 'telegram', type: 'manager' },
  });
  const defaultBotId = managerBot?.id ?? null;
  if (defaultBotId) {
    console.log(`Found manager bot instance: ${defaultBotId}`);
  } else {
    console.log('No manager bot instance found — communities will have null botInstanceId');
  }

  // Migrate ManagedGroup → Community
  const groups = await prisma.managedGroup.findMany({
    include: { config: true, members: true },
  });
  console.log(`Found ${groups.length} groups to migrate`);

  let communitiesCreated = 0;
  let communitiesSkipped = 0;
  let membersCreated = 0;
  let membersSkipped = 0;

  for (const group of groups) {
    // Check idempotency
    const existing = await prisma.community.findUnique({
      where: {
        platform_platformCommunityId: {
          platform: 'telegram',
          platformCommunityId: group.chatId.toString(),
        },
      },
    });

    if (existing) {
      communitiesSkipped++;
      continue;
    }

    // Create Community
    const community = await prisma.community.create({
      data: {
        platform: 'telegram',
        platformCommunityId: group.chatId.toString(),
        name: group.title,
        type: 'supergroup', // default for Telegram groups
        memberCount: group.members.length,
        isActive: group.isActive,
        botInstanceId: defaultBotId,
        joinedAt: group.joinedAt,
        leftAt: group.leftAt,
      },
    });

    // Migrate GroupConfig → CommunityConfig + CommunityTelegramConfig
    if (group.config) {
      const cfg = group.config;

      await prisma.communityConfig.create({
        data: {
          communityId: community.id,
          welcomeEnabled: cfg.welcomeEnabled,
          welcomeMessage: cfg.welcomeMessage,
          rulesText: cfg.rulesText,
          antiSpamEnabled: cfg.antiSpamEnabled,
          antiSpamAction: 'delete', // new field, default
          antiSpamMaxMessages: cfg.antiSpamMaxMessages,
          antiSpamWindowSeconds: cfg.antiSpamWindowSeconds,
          antiLinkEnabled: cfg.antiLinkEnabled,
          antiLinkAction: 'delete', // new field, default
          antiLinkWhitelist: cfg.antiLinkWhitelist,
          warnThresholdMute: cfg.warnThresholdMute,
          warnThresholdBan: cfg.warnThresholdBan,
          warnDecayDays: cfg.warnDecayDays,
          defaultMuteDurationS: cfg.defaultMuteDurationS,
          logChannelId: cfg.logChannelId?.toString() ?? null,
          autoDeleteCommandsS: cfg.autoDeleteCommandsS,
          silentMode: cfg.silentMode,
          keywordFiltersEnabled: cfg.keywordFiltersEnabled,
          keywordFilters: cfg.keywordFilters,
          aiModerationEnabled: cfg.aiModEnabled,
          aiModerationAction: 'delete', // new field, default
          aiModThreshold: cfg.aiModThreshold,
          notificationEvents: cfg.notificationEvents,
          pipelineEnabled: cfg.pipelineEnabled,
          pipelineDmTemplate: cfg.pipelineDmTemplate,
          pipelineDeeplink: cfg.pipelineDeeplink,
        },
      });

      await prisma.communityTelegramConfig.create({
        data: {
          communityId: community.id,
          captchaEnabled: cfg.captchaEnabled,
          captchaMode: cfg.captchaMode,
          captchaTimeoutS: cfg.captchaTimeoutS,
          quarantineEnabled: cfg.quarantineEnabled,
          quarantineDurationS: cfg.quarantineDurationS,
          slowModeDelay: cfg.slowModeDelay,
        },
      });
    }

    // Migrate GroupMembers → CommunityMembers
    for (const member of group.members) {
      // Find corresponding PlatformAccount
      const account = await prisma.platformAccount.findUnique({
        where: {
          platform_platformUserId: {
            platform: 'telegram',
            platformUserId: member.telegramId.toString(),
          },
        },
      });

      if (!account) {
        membersSkipped++;
        continue;
      }

      const existingMember = await prisma.communityMember.findUnique({
        where: {
          communityId_platformAccountId: {
            communityId: community.id,
            platformAccountId: account.id,
          },
        },
      });

      if (existingMember) {
        membersSkipped++;
        continue;
      }

      await prisma.communityMember.create({
        data: {
          communityId: community.id,
          platformAccountId: account.id,
          role: member.role,
          messageCount: member.messageCount,
          joinedAt: member.joinedAt,
          warningCount: 0, // will be recalculated
          isMuted: false,
          isQuarantined: member.isQuarantined,
          quarantineExpiresAt: member.quarantineExpiresAt,
          lastSeenAt: member.lastSeenAt,
        },
      });
      membersCreated++;
    }

    communitiesCreated++;
    if (communitiesCreated % 10 === 0) {
      console.log(`  Progress: ${communitiesCreated} communities, ${membersCreated} members`);
    }
  }

  console.log(`Migration complete:`);
  console.log(`  Communities: ${communitiesCreated} created, ${communitiesSkipped} skipped`);
  console.log(`  Members: ${membersCreated} created, ${membersSkipped} skipped`);
}

main()
  .catch((e) => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
