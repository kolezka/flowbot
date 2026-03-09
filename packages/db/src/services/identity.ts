import type { PrismaClient as PrismaClientType } from "../generated/prisma/client";

export async function resolveIdentity(prisma: PrismaClientType, telegramId: bigint) {
  const existing = await prisma.userIdentity.findUnique({
    where: { telegramId },
  });

  if (existing) {
    return existing;
  }

  // Auto-link to User if one exists with same telegramId
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });

  return prisma.userIdentity.create({
    data: {
      telegramId,
      userId: user?.id ?? undefined,
    },
  });
}

export async function linkToUser(
  prisma: PrismaClientType,
  telegramId: bigint,
  userId: string,
) {
  return prisma.userIdentity.upsert({
    where: { telegramId },
    update: { userId },
    create: { telegramId, userId },
  });
}

export async function getFullProfile(prisma: PrismaClientType, telegramId: bigint) {
  const identity = await prisma.userIdentity.findUnique({
    where: { telegramId },
    include: {
      user: true,
    },
  });

  const memberships = await prisma.groupMember.findMany({
    where: { telegramId },
    include: {
      group: { select: { id: true, chatId: true, title: true } },
      warnings: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const moderationLogs = await prisma.moderationLog.findMany({
    where: { targetId: telegramId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      group: { select: { id: true, chatId: true, title: true } },
    },
  });

  return {
    identity,
    user: identity?.user ?? null,
    memberships,
    moderationLogs,
  };
}
