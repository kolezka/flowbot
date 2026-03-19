/**
 * Slice 4 Migration: Annotate existing broadcasts with multi-platform metadata
 *
 * This migration adds platform metadata to existing BroadcastMessage records
 * and maps targetChatIds to targetCommunities where possible.
 */
import { PrismaClient } from '@flowbot/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Slice 4 migration: Broadcast multi-platform annotations');

  const broadcasts = await prisma.broadcastMessage.findMany();
  console.log(`Found ${broadcasts.length} broadcasts to annotate`);

  let updated = 0;

  for (const broadcast of broadcasts) {
    // Skip if already annotated
    if ((broadcast.results as any)?._multiPlatform) continue;

    // Resolve chatIds to community IDs
    const targetCommunities: string[] = [];
    for (const chatId of broadcast.targetChatIds) {
      const community = await prisma.community.findUnique({
        where: {
          platform_platformCommunityId: {
            platform: 'telegram',
            platformCommunityId: chatId.toString(),
          },
        },
        select: { id: true },
      });
      if (community) targetCommunities.push(community.id);
    }

    await prisma.broadcastMessage.update({
      where: { id: broadcast.id },
      data: {
        results: {
          ...((broadcast.results as any) ?? {}),
          _multiPlatform: true,
          content: { text: broadcast.text },
          platforms: ['telegram'],
          targetCommunities,
        },
      },
    });
    updated++;
  }

  console.log(`Migration complete: ${updated} broadcasts annotated`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
